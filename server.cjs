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

// Helpers Promises
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // this.lastID, this.changes
    });
  });
const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

// -------------------------------------------------------------
// DDL - Tabelas e View
// -------------------------------------------------------------
function createSchema() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      sector TEXT,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
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
      data_ref DATE NOT NULL,
      proteina_original TEXT NOT NULL,
      proteina_nova TEXT NOT NULL,
      usuario_email TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
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
      status TEXT DEFAULT 'aberta',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS points_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_email TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      acao TEXT NOT NULL,
      pontos INTEGER NOT NULL,
      ref_table TEXT,
      ref_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE VIEW IF NOT EXISTS v_leaderboard AS
      SELECT usuario_email,
             usuario_nome,
             SUM(pontos) AS total_pontos,
             COUNT(*) AS qtd_acoes,
             MAX(created_at) AS ultima_acao
      FROM points_ledger
      GROUP BY usuario_email, usuario_nome
      ORDER BY total_pontos DESC, ultima_acao DESC
    `);
  });
}
createSchema();

// -------------------------------------------------------------
// Health (sem auth)
// -------------------------------------------------------------
app.get('/api/health', (_req, res) => res.send('OK'));

// -------------------------------------------------------------
// Auth middleware (DEV com usuário padrão automático)
// Aceita também x-user e Authorization: Bearer <Base64(JSON)>
// -------------------------------------------------------------
function authMiddleware(req, res, next) {
  if (req.method === 'OPTIONS') return res.sendStatus(204); // pré-flight CORS

  (async () => {
    try {
      let user = null;

      // 1) Header x-user: Base64(JSON)
      const xUser = req.headers['x-user'];
      if (xUser) {
        try {
          const decoded = Buffer.from(String(xUser), 'base64').toString('utf8');
          user = JSON.parse(decoded);
        } catch {
          return res.status(400).json({ ok: false, error: 'Header x-user inválido. Use Base64 de {"email","name","sector","avatar"}.' });
        }
      }

      // 2) Authorization: Bearer <Base64(JSON)>
      if (!user && req.headers.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.slice(7).trim();
        try {
          const decoded = Buffer.from(String(token), 'base64').toString('utf8');
          user = JSON.parse(decoded);
        } catch {
          return res.status(400).json({ ok: false, error: 'Authorization inválido. Use Bearer <Base64(JSON)>.' });
        }
      }

      // 3) DEV: usuário padrão automático
      if (!user && process.env.NODE_ENV !== 'production') {
        const { dev_email, dev_name, dev_sector, dev_avatar } = req.query || {};
        const { email, name, sector, avatar } = req.body || {};
        user = {
          email: dev_email || email || 'dev@teste.com',
          name:  dev_name  || name  || 'Usuário Dev',
          sector: dev_sector || sector || 'TI',
          avatar: dev_avatar || avatar || null
        };
      }

      if (!user?.email || !user?.name) {
        return res.status(401).json({ ok: false, error: 'Não autenticado.' });
      }

      req.user = {
        email: String(user.email).trim(),
        name: String(user.name).trim(),
        sector: user.sector || null,
        avatar: user.avatar || null
      };

      // upsert usuário
      await run(
        `INSERT INTO users (name, email, sector, avatar) VALUES (?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           name=excluded.name,
           sector=COALESCE(excluded.sector, users.sector),
           avatar=COALESCE(excluded.avatar, users.avatar)`,
        [req.user.name, req.user.email, req.user.sector, req.user.avatar]
      );

      next();
    } catch (err) {
      console.error('Auth error:', err);
      res.status(500).json({ ok: false, error: 'Falha de autenticação' });
    }
  })();
}

// A partir daqui, exige auth
app.use(authMiddleware);

// -------------------------------------------------------------
// Util: registrar pontos (pontuação fixa atual)
// -------------------------------------------------------------
async function registrarPontos({ email, nome, acao, pontos, refTable = null, refId = null }) {
  await run(
    `INSERT INTO points_ledger (usuario_email, usuario_nome, acao, pontos, ref_table, ref_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [email, nome, acao, pontos, refTable, refId]
  );
}

// -------------------------------------------------------------
// Reservas de Salas (+10)
// -------------------------------------------------------------
app.post('/api/reservas-salas', async (req, res) => {
  try {
    const { sala, title, start, end } = req.body;
    if (!sala || !title || !start || !end) return res.status(400).json({ ok: false, error: 'Campos: sala, title, start, end' });
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

app.get('/api/reservas-salas', async (_req, res) => {
  try {
    const rows = await all(
      `SELECT id, sala, title, start, end, created_by_name, created_by_email, created_at
       FROM reservas_salas ORDER BY start ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.put('/api/reservas-salas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { sala, title, start, end } = req.body;
    const info = await run(
      `UPDATE reservas_salas SET
         sala=COALESCE(?, sala),
         title=COALESCE(?, title),
         start=COALESCE(?, start),
         end=COALESCE(?, end)
       WHERE id=?`,
      [sala ?? null, title ?? null, start ?? null, end ?? null, id]
    );
    res.json({ ok: true, changes: info.changes });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/reservas-salas/:id', async (req, res) => {
  try {
    const info = await run(`DELETE FROM reservas_salas WHERE id=?`, [req.params.id]);
    res.json({ ok: true, changes: info.changes });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// -------------------------------------------------------------
// Agendamentos da Portaria (+10)
// -------------------------------------------------------------
app.post('/api/agendamentos-portaria', async (req, res) => {
  try {
    const { visitante, documento, empresa, motivo, start, end } = req.body;
    if (!visitante || !start || !end) return res.status(400).json({ ok: false, error: 'Campos: visitante, start, end' });
    const info = await run(
      `INSERT INTO agendamentos_portaria
       (visitante, documento, empresa, motivo, start, end, created_by_email, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [visitante, documento || null, empresa || null, motivo || null, start, end, req.user.email, req.user.name]
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
    const { data_ref, proteina_original, proteina_nova } = req.body;
    if (!data_ref || !proteina_original || !proteina_nova) {
      return res.status(400).json({ ok: false, error: 'Campos: data_ref, proteina_original, proteina_nova' });
    }
    const info = await run(
      `INSERT INTO trocas_proteina (data_ref, proteina_original, proteina_nova, usuario_email, usuario_nome)
       VALUES (?, ?, ?, ?, ?)`,
      [data_ref, proteina_original, proteina_nova, req.user.email, req.user.name]
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
    let sql = `SELECT * FROM trocas_proteina`;
    const params = [];
    if (from && to) {
      sql += ` WHERE date(data_ref) BETWEEN date(?) AND date(?)`;
      params.push(from, to);
    }
    sql += ` ORDER BY date(data_ref) ASC, usuario_nome ASC`;
    const rows = await all(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/trocas-proteina/exportar', async (req, res) => {
  try {
    const { formato = 'xlsx', from, to } = req.query;
    let sql = `SELECT * FROM trocas_proteina`;
    const params = [];
    if (from && to) {
      sql += ` WHERE date(data_ref) BETWEEN date(?) AND date(?)`;
      params.push(from, to);
    }
    sql += ` ORDER BY date(data_ref) ASC, usuario_nome ASC`;
    const rows = await all(sql, params);

    if (String(formato).toLowerCase() === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Trocas de Proteína');
      ws.addRow(['Data', 'Usuário', 'E-mail', 'Original', 'Nova', 'Criado em']);
      rows.forEach(r => ws.addRow([r.data_ref, r.usuario_nome, r.usuario_email, r.proteina_original, r.proteina_nova, r.created_at]));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="trocas_proteina.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="trocas_proteina.pdf"`);
    const doc = new PDFDocument({ margin: 36 });
    doc.pipe(res);
    doc.fontSize(16).text('Relatório - Trocas de Proteína', { align: 'center' });
    doc.moveDown();
    rows.forEach(r => {
      doc.fontSize(11).text(
        `Data: ${r.data_ref} | ${r.usuario_nome} <${r.usuario_email}> | ${r.proteina_original} -> ${r.proteina_nova} | Criado: ${r.created_at}`
      );
      doc.moveDown(0.2);
    });
    doc.end();
  } catch (e) {
    console.error('GET /api/trocas-proteina/exportar', e);
    res.status(500).json({ ok: false, error: 'Erro ao gerar arquivo' });
  }
});

// -------------------------------------------------------------
// Mural: Comentários (+5) e Reações/curtidas (+5)
// -------------------------------------------------------------
app.post('/api/mural/comentarios', async (req, res) => {
  try {
    const { post_id, conteudo } = req.body;
    if (!post_id || !conteudo) return res.status(400).json({ ok: false, error: 'Campos: post_id, conteudo' });
    const info = await run(
      `INSERT INTO mural_comentarios (post_id, usuario_email, usuario_nome, conteudo)
       VALUES (?, ?, ?, ?)`,
      [post_id, req.user.email, req.user.name, conteudo]
    );
    await registrarPontos({ email: req.user.email, nome: req.user.name, acao: 'comentario', pontos: 5, refTable: 'mural_comentarios', refId: info.lastID });
    res.json({ ok: true, id: info.lastID });
  } catch (e) {
    console.error('POST /api/mural/comentarios', e);
    res.status(500).json({ ok: false, error: 'Erro ao comentar' });
  }
});

app.get('/api/mural/comentarios', async (req, res) => {
  try {
    const { post_id } = req.query;
    if (!post_id) return res.status(400).json({ ok: false, error: 'Informe post_id' });
    const rows = await all(`SELECT * FROM mural_comentarios WHERE post_id=? ORDER BY created_at ASC`, [post_id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/mural/reacoes', async (req, res) => {
  try {
    const { post_id, tipo = 'like' } = req.body;
    if (!post_id) return res.status(400).json({ ok: false, error: 'Campo: post_id' });
    const info = await run(
      `INSERT OR IGNORE INTO mural_reacoes (post_id, usuario_email, usuario_nome, tipo)
       VALUES (?, ?, ?, ?)`,
      [post_id, req.user.email, req.user.name, tipo]
    );
    if (info.changes > 0) {
      const row = await get(
        `SELECT id FROM mural_reacoes WHERE post_id=? AND usuario_email=? AND tipo=?`,
        [post_id, req.user.email, tipo]
      );
      if (row?.id) {
        await registrarPontos({ email: req.user.email, nome: req.user.name, acao: 'curtida', pontos: 5, refTable: 'mural_reacoes', refId: row.id });
      }
    }
    res.json({ ok: true, inserted: info.changes > 0 });
  } catch (e) {
    console.error('POST /api/mural/reacoes', e);
    res.status(500).json({ ok: false, error: 'Erro ao reagir' });
  }
});

app.get('/api/mural/reacoes', async (req, res) => {
  try {
    const { post_id } = req.query;
    if (!post_id) return res.status(400).json({ ok: false, error: 'Informe post_id' });
    const rows = await all(
      `SELECT tipo, COUNT(*) as total FROM mural_reacoes WHERE post_id=? GROUP BY tipo`,
      [post_id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// -------------------------------------------------------------
// Solicitações de TI (+10) + Painel TI
// -------------------------------------------------------------
app.post('/api/solicitacoes-ti', async (req, res) => {
  try {
    const { equipamento, descricao } = req.body;
    if (!equipamento) return res.status(400).json({ ok: false, error: 'Campo: equipamento' });
    const info = await run(
      `INSERT INTO solicitacoes_ti (usuario_email, usuario_nome, equipamento, descricao)
       VALUES (?, ?, ?, ?)`,
      [req.user.email, req.user.name, equipamento, descricao || null]
    );
    await registrarPontos({ email: req.user.email, nome: req.user.name, acao: 'sol_ti', pontos: 10, refTable: 'solicitacoes_ti', refId: info.lastID });
    res.json({ ok: true, id: info.lastID });
  } catch (e) {
    console.error('POST /api/solicitacoes-ti', e);
    res.status(500).json({ ok: false, error: 'Erro ao salvar solicitação' });
  }
});

app.get('/api/ti/solicitacoes', async (_req, res) => {
  try {
    const rows = await all(`SELECT * FROM solicitacoes_ti ORDER BY created_at DESC`);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.put('/api/ti/solicitacoes/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ ok: false, error: 'Informe status' });
    const info = await run(`UPDATE solicitacoes_ti SET status=? WHERE id=?`, [status, id]);
    res.json({ ok: true, changes: info.changes });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// -------------------------------------------------------------
// Gamificação: leaderboard e extrato
// -------------------------------------------------------------
app.get('/api/gamificacao/leaderboard', async (_req, res) => {
  try {
    const rows = await all(`SELECT * FROM v_leaderboard`);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/gamificacao/extrato', async (req, res) => {
  try {
    const { email } = req.query;
    const rows = await all(
      `SELECT acao, pontos, ref_table, ref_id, created_at
       FROM points_ledger
       WHERE (? IS NULL OR usuario_email = ?)
       ORDER BY created_at DESC`,
      [email || null, email || null]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// -------------------------------------------------------------
// Start
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
