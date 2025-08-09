// server.cjs
// -------------------------------------------------------------
// Backend Express + SQLite (sqlite3 async, compatível com bolt.new)
// Funcionalidades: Reservas, Portaria, Trocas, Mural, TI, Gamificação
// -------------------------------------------------------------
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { format, parseISO } = require('date-fns');
const { ptBR } = require('date-fns/locale');

const app = express();
const PORT = process.env.PORT || 5173; // backend em 3000 (Vite fica em 5173)

// -------------------------------------------------------------
// Infra básica
// -------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// -------------------------------------------------------------
// Banco de dados (cria pasta e arquivo se não existirem)
// -------------------------------------------------------------
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Erro ao abrir o banco:', err.message);
  else console.log('Banco conectado:', dbPath);
});

// IDs dos calendários do Google para cada sala
const roomCalendars = {
  aquario: 'sala.aquario@group.calendar.google.com',
  reuniao: 'sala.reuniao@group.calendar.google.com',
  treinamento: 'sala.treinamento@group.calendar.google.com',
  videoconferencia: 'sala.videoconferencia@group.calendar.google.com'
};

// -------------------------------------------------------------
// Helpers para promisificar sqlite3
// -------------------------------------------------------------
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// -------------------------------------------------------------
// Schema do banco
// -------------------------------------------------------------
function createSchema() {
  try {
    db.run(`CREATE TABLE IF NOT EXISTS reservas_salas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sala TEXT NOT NULL,
      title TEXT NOT NULL,
      start DATETIME NOT NULL,
      end DATETIME NOT NULL,
      created_by_email TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      google_event_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS agendamentos_portaria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitante TEXT NOT NULL,
      documento TEXT,
      empresa TEXT,
      motivo TEXT,
      start DATETIME NOT NULL,
      end DATETIME NOT NULL,
      created_by_email TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS trocas_proteina (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data DATE NOT NULL,
      dia TEXT NOT NULL,
      proteina_original TEXT NOT NULL,
      proteina_nova TEXT NOT NULL,
      email TEXT NOT NULL,
      nome TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS mural_comentarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      usuario_email TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS mural_reacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      usuario_email TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      tipo TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, usuario_email, tipo)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS solicitacoes_ti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_email TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      equipamento TEXT NOT NULL,
      descricao TEXT,
      status TEXT DEFAULT 'pendente',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS pontos_gamificacao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_email TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      acao TEXT NOT NULL,
      pontos INTEGER NOT NULL,
      ref_table TEXT,
      ref_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS mural_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_email TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      imagem_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('Schema criado/verificado com sucesso');
  } catch (e) {
    console.error('Erro ao criar schema:', e);
  }
}

createSchema();

// -------------------------------------------------------------
// Middleware de autenticação simulada
// -------------------------------------------------------------
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token não fornecido' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Token inválido' });
  }
}

// Aplicar middleware de auth em todas as rotas exceto login
app.use((req, res, next) => {
  if (req.path === '/api/login' || req.path === '/api/health') {
    return next();
  }
  return authMiddleware(req, res, next);
});

// -------------------------------------------------------------
// Sistema de Pontos/Gamificação
// -------------------------------------------------------------
async function registrarPontos({ email, nome, acao, pontos, refTable = null, refId = null }) {
  try {
    await run(
      `INSERT INTO pontos_gamificacao (usuario_email, usuario_nome, acao, pontos, ref_table, ref_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, nome, acao, pontos, refTable, refId]
    );
  } catch (e) {
    console.error('Erro ao registrar pontos:', e);
  }
}

app.get('/api/pontos', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const totalRow = await get(
      `SELECT COALESCE(SUM(pontos), 0) as total FROM pontos_gamificacao WHERE usuario_email = ?`,
      [userEmail]
    );
    const historico = await all(
      `SELECT acao, pontos, created_at FROM pontos_gamificacao 
       WHERE usuario_email = ? ORDER BY created_at DESC LIMIT 10`,
      [userEmail]
    );
    res.json({ total: totalRow.total, historico });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/ranking', async (req, res) => {
  try {
    const ranking = await all(
      `SELECT usuario_nome, usuario_email, SUM(pontos) as total_pontos
       FROM pontos_gamificacao
       GROUP BY usuario_email, usuario_nome
       ORDER BY total_pontos DESC
       LIMIT 10`
    );
    res.json(ranking);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// -------------------------------------------------------------
// Endpoints básicos
// -------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Server running' });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email e senha obrigatórios' });
  }
  
  // Simulação de autenticação
  const user = {
    email,
    name: email.split('@')[0],
    sector: email.includes('ti') ? 'TI' : email.includes('rh') ? 'RH' : 'Geral'
  };
  
  const token = Buffer.from(JSON.stringify(user)).toString('base64');
  res.json({ ok: true, token, user });
});

// -------------------------------------------------------------
// Reservas de Salas (+10 pontos)
// -------------------------------------------------------------
app.post('/api/reservas-salas', async (req, res) => {
  try {
    const { sala, title, start, end } = req.body;
    if (!sala || !title || !start || !end) {
      return res.status(400).json({ ok: false, error: 'Campos obrigatórios: sala, title, start, end' });
    }
    
    const info = await run(
      `INSERT INTO reservas_salas (sala, title, start, end, created_by_email, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sala, title, start, end, req.user.email, req.user.name]
    );
    
    await registrarPontos({ email: req.user.email, nome: req.user.name, acao: 'reserva_sala', pontos: 10, refTable: 'reservas_salas', refId: info.lastID });
    res.json({ ok: true, id: info.lastID });
  } catch (e) {
    console.error('POST /api/reservas-salas', e);
    res.status(500).json({ ok: false, error: 'Erro ao salvar reserva' });
  }
});

app.get('/api/reservas-salas', async (req, res) => {
  try {
    const { sala, from, to } = req.query;
    let sql = `SELECT * FROM reservas_salas`;
    const params = [];
    const conditions = [];
    
    if (sala) {
      conditions.push('sala = ?');
      params.push(sala);
    }
    if (from && to) {
      conditions.push('date(start) BETWEEN date(?) AND date(?)');
      params.push(from, to);
    }
    
    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY start ASC';
    
    const rows = await all(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// -------------------------------------------------------------
// Agendamentos de Portaria (+10 pontos)
// -------------------------------------------------------------
app.post('/api/agendamentos-portaria', async (req, res) => {
  try {
    const { visitante, documento, empresa, motivo, start, end } = req.body;
    if (!visitante || !start || !end) {
      return res.status(400).json({ ok: false, error: 'Campos obrigatórios: visitante, start, end' });
    }
    
    const info = await run(
      `INSERT INTO agendamentos_portaria (visitante, documento, empresa, motivo, start, end, created_by_email, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [visitante, documento, empresa, motivo, start, end, req.user.email, req.user.name]
    );
    
    await registrarPontos({ email: req.user.email, nome: req.user.name, acao: 'portaria', pontos: 10, refTable: 'agendamentos_portaria', refId: info.lastID });
    res.json({ ok: true, id: info.lastID });
  } catch (e) {
    console.error('POST /api/agendamentos-portaria', e);
    res.status(500).json({ ok: false, error: 'Erro ao salvar agendamento' });
  }
});

app.get('/api/agendamentos-portaria', async (_req, res) => {
  try {
    const rows = await all(
      `SELECT id, visitante, documento, empresa, motivo, start, end, created_by_name, created_by_email, created_at
       FROM agendamentos_portaria ORDER BY start ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// -------------------------------------------------------------
// Trocas de Proteína (+5) + Exportações
// -------------------------------------------------------------
app.post('/api/trocas-proteina', async (req, res) => {
  try {
    const { data, proteina_original, proteina_nova } = req.body;
    if (!data || !proteina_original || !proteina_nova) {
      return res.status(400).json({ ok: false, error: 'Campos: data, proteina_original, proteina_nova' });
    }
    const exists = await get(
      `SELECT id FROM trocas_proteina WHERE email = ? AND date(data) = date(?)`,
      [req.user.email, data]
    );
    if (exists) {
      return res.status(400).json({ ok: false, error: 'Troca já registrada para esta data' });
    }
    const dia = format(parseISO(data), 'EEEE', { locale: ptBR });
    const info = await run(
      `INSERT INTO trocas_proteina (data, dia, proteina_original, proteina_nova, email, nome)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data, dia, proteina_original, proteina_nova, req.user.email, req.user.name]
    );
    await registrarPontos({ email: req.user.email, nome: req.user.name, acao: 'troca_proteina', pontos: 5, refTable: 'trocas_proteina', refId: info.lastID });
    res.json({ ok: true, id: info.lastID });
  } catch (e) {
    console.error('POST /api/trocas-proteina', e);
    res.status(500).json({ ok: false, error: 'Erro ao salvar troca de proteína' });
  }
});

app.get('/api/trocas-proteina', async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `SELECT * FROM trocas_proteina WHERE email = ?`;
    const params = [req.user.email];
    if (from && to) {
      sql += ` AND date(data) BETWEEN date(?) AND date(?)`;
      params.push(from, to);
    }
    sql += ` ORDER BY date(data) ASC`;
    const rows = await all(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/admin/exportar-trocas', async (req, res) => {
  try {
    if (!['TI', 'RH'].includes(req.user.sector)) {
      return res.status(403).json({ ok: false, error: 'Sem permissão' });
    }

    const { formato = 'xlsx', from, to, q } = req.query;
    let sql =
      `SELECT nome, email, data, proteina_original, proteina_nova, created_at FROM trocas_proteina`;
    const params = [];
    const conds = [];

    if (from && to) {
      conds.push(`date(data) BETWEEN date(?) AND date(?)`);
      params.push(from, to);
    }
    if (q) {
      conds.push(`(LOWER(nome) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?))`);
      params.push(`%${q}%`, `%${q}%`);
    }
    if (conds.length) sql += ` WHERE ` + conds.join(' AND ');
    sql += ` ORDER BY date(data) ASC, nome ASC`;
    const rows = await all(sql, params);

    const cols = [
      'Nome do usuário',
      'E-mail',
      'Dia da troca',
      'Proteína original',
      'Nova proteína',
      'Data da solicitação',
    ];

    switch (String(formato).toLowerCase()) {
      case 'csv': {
        let csv = cols.join(';') + '\n';
        rows.forEach(r => {
          csv +=
            [
              r.nome,
              r.email,
              r.data,
              r.proteina_original,
              r.proteina_nova,
              r.created_at,
            ].join(';') + '\n';
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="trocas_proteina.csv"`);
        return res.send(csv);
      }
      case 'pdf': {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="trocas_proteina.pdf"`);
        const doc = new PDFDocument({ margin: 36 });
        doc.pipe(res);
        doc.fontSize(16).text('Relatório - Trocas de Proteína', { align: 'center' });
        doc.moveDown();
        rows.forEach(r => {
          doc
            .fontSize(11)
            .text(
              `${r.nome} <${r.email}> | Dia: ${r.data} | ${r.proteina_original} -> ${r.proteina_nova} | Solicitação: ${r.created_at}`
            );
          doc.moveDown(0.2);
        });
        doc.end();
        return;
      }
      default: {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Trocas de Proteína');
        ws.addRow(cols);
        rows.forEach(r =>
          ws.addRow([
            r.nome,
            r.email,
            r.data,
            r.proteina_original,
            r.proteina_nova,
            r.created_at,
          ])
        );
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="trocas_proteina.xlsx"`
        );
        await wb.xlsx.write(res);
        return res.end();
      }
    }
  } catch (e) {
    console.error('GET /admin/exportar-trocas', e);
    res.status(500).json({ ok: false, error: 'Erro ao gerar arquivo' });
  }
});

// -------------------------------------------------------------
// Mural: Comentários (+5) e Reações/curtidas (+5)
// -------------------------------------------------------------
app.get('/api/mural-posts', async (req, res) => {
  try {
    const posts = await all(
      `SELECT id, usuario_nome, usuario_email, conteudo, imagem_url, created_at
       FROM mural_posts ORDER BY created_at DESC`
    );
    
    for (let post of posts) {
      const comentarios = await all(
        `SELECT id, usuario_nome, usuario_email, conteudo, created_at
         FROM mural_comentarios WHERE post_id = ? ORDER BY created_at ASC`,
        [post.id]
      );
      
      const reacoes = await all(
        `SELECT tipo, COUNT(*) as count
         FROM mural_reacoes WHERE post_id = ? GROUP BY tipo`,
        [post.id]
      );
      
      post.comentarios = comentarios;
      post.reacoes = reacoes.reduce((acc, r) => {
        acc[r.tipo] = r.count;
        return acc;
      }, {});
    }
    
    res.json(posts);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/mural-posts', async (req, res) => {
  try {
    const { conteudo, imagem_url } = req.body;
    if (!conteudo) {
      return res.status(400).json({ ok: false, error: 'Conteúdo obrigatório' });
    }
    
    const info = await run(
      `INSERT INTO mural_posts (usuario_email, usuario_nome, conteudo, imagem_url)
       VALUES (?, ?, ?, ?)`,
      [req.user.email, req.user.name, conteudo, imagem_url]
    );
    
    await registrarPontos({ email: req.user.email, nome: req.user.name, acao: 'post_mural', pontos: 10, refTable: 'mural_posts', refId: info.lastID });
    res.json({ ok: true, id: info.lastID });
  } catch (e) {
    console.error('POST /api/mural-posts', e);
    res.status(500).json({ ok: false, error: 'Erro ao criar post' });
  }
});

app.post('/api/mural-comentarios', async (req, res) => {
  try {
    const { post_id, conteudo } = req.body;
    if (!post_id || !conteudo) {
      return res.status(400).json({ ok: false, error: 'post_id e conteúdo obrigatórios' });
    }
    
    const info = await run(
      `INSERT INTO mural_comentarios (post_id, usuario_email, usuario_nome, conteudo)
       VALUES (?, ?, ?, ?)`,
      [post_id, req.user.email, req.user.name, conteudo]
    );
    
    await registrarPontos({ email: req.user.email, nome: req.user.name, acao: 'comentario_mural', pontos: 5, refTable: 'mural_comentarios', refId: info.lastID });
    res.json({ ok: true, id: info.lastID });
  } catch (e) {
    console.error('POST /api/mural-comentarios', e);
    res.status(500).json({ ok: false, error: 'Erro ao criar comentário' });
  }
});

app.post('/api/mural-reacoes', async (req, res) => {
  try {
    const { post_id, tipo } = req.body;
    if (!post_id || !tipo) {
      return res.status(400).json({ ok: false, error: 'post_id e tipo obrigatórios' });
    }
    
    const existing = await get(
      `SELECT id FROM mural_reacoes WHERE post_id = ? AND usuario_email = ? AND tipo = ?`,
      [post_id, req.user.email, tipo]
    );
    
    if (existing) {
      await run(
        `DELETE FROM mural_reacoes WHERE id = ?`,
        [existing.id]
      );
      res.json({ ok: true, action: 'removed' });
    } else {
      const info = await run(
        `INSERT INTO mural_reacoes (post_id, usuario_email, usuario_nome, tipo)
         VALUES (?, ?, ?, ?)`,
        [post_id, req.user.email, req.user.name, tipo]
      );
      
      await registrarPontos({ email: req.user.email, nome: req.user.name, acao: 'reacao_mural', pontos: 5, refTable: 'mural_reacoes', refId: info.lastID });
      res.json({ ok: true, action: 'added', id: info.lastID });
    }
  } catch (e) {
    console.error('POST /api/mural-reacoes', e);
    res.status(500).json({ ok: false, error: 'Erro ao processar reação' });
  }
});

// -------------------------------------------------------------
// Solicitações de TI (+15 pontos)
// -------------------------------------------------------------
app.post('/api/solicitacoes-ti', async (req, res) => {
  try {
    const { equipamento, descricao } = req.body;
    if (!equipamento) {
      return res.status(400).json({ ok: false, error: 'Equipamento obrigatório' });
    }
    
    const info = await run(
      `INSERT INTO solicitacoes_ti (usuario_email, usuario_nome, equipamento, descricao)
       VALUES (?, ?, ?, ?)`,
      [req.user.email, req.user.name, equipamento, descricao]
    );
    
    await registrarPontos({ email: req.user.email, nome: req.user.name, acao: 'solicitacao_ti', pontos: 15, refTable: 'solicitacoes_ti', refId: info.lastID });
    res.json({ ok: true, id: info.lastID });
  } catch (e) {
    console.error('POST /api/solicitacoes-ti', e);
    res.status(500).json({ ok: false, error: 'Erro ao criar solicitação' });
  }
});

app.get('/api/solicitacoes-ti', async (req, res) => {
  try {
    let sql = `SELECT * FROM solicitacoes_ti`;
    const params = [];
    
    if (req.user.sector !== 'TI') {
      sql += ` WHERE usuario_email = ?`;
      params.push(req.user.email);
    }
    
    sql += ` ORDER BY created_at DESC`;
    const rows = await all(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.put('/api/solicitacoes-ti/:id', async (req, res) => {
  try {
    if (req.user.sector !== 'TI') {
      return res.status(403).json({ ok: false, error: 'Sem permissão' });
    }
    
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ ok: false, error: 'Status obrigatório' });
    }
    
    await run(
      `UPDATE solicitacoes_ti SET status = ? WHERE id = ?`,
      [status, req.params.id]
    );
    
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/solicitacoes-ti/:id', e);
    res.status(500).json({ ok: false, error: 'Erro ao atualizar status' });
  }
});

// -------------------------------------------------------------
// Inicialização do servidor
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});