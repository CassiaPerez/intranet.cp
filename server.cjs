#!/usr/bin/env node
// server.cjs - Servidor Express robusto p/ Intranet Cropfield (Express 5 compat.)

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3005;
const isDev = process.env.NODE_ENV !== 'production';

console.log('🚀 [INIT] Iniciando servidor Intranet Cropfield...');
console.log('🌍 [ENV] Ambiente:', isDev ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');

// ==================== FS / DB PATHS ====================
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'database.sqlite');
let db;

// ==================== MIDDLEWARES ====================
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3005',
    'http://127.0.0.1:3005'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  secret: 'cropfield-intranet-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, _res, next) => {
  console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== HEALTH ====================
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ==================== DB HELPERS ====================
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});

// ==================== SCHEMA (CREATE) ====================
const createTables = async () => {
  console.log('🔨 [DB] Criando/verificando tabelas...');
  await dbRun(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    setor TEXT DEFAULT 'Geral',
    role TEXT DEFAULT 'colaborador',
    foto TEXT,
    ativo BOOLEAN DEFAULT 1,
    pontos INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('✅ [DB] usuarios');

  await dbRun(`CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    sala TEXT NOT NULL,
    data DATE NOT NULL,
    inicio TIME NOT NULL,
    fim TIME NOT NULL,
    assunto TEXT NOT NULL,
    descricao TEXT,
    status TEXT DEFAULT 'ativa',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
  )`);
  console.log('✅ [DB] reservas');

  await dbRun(`CREATE TABLE IF NOT EXISTS mural_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    pinned BOOLEAN DEFAULT 0,
    ativo BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
  )`);
  console.log('✅ [DB] mural_posts');

  await dbRun(`CREATE TABLE IF NOT EXISTS mural_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, usuario_id),
    FOREIGN KEY (post_id) REFERENCES mural_posts (id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
  )`);
  console.log('✅ [DB] mural_likes');

  await dbRun(`CREATE TABLE IF NOT EXISTS trocas_proteina (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    data DATE NOT NULL,
    proteina_original TEXT NOT NULL,
    proteina_nova TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
  )`);
  console.log('✅ [DB] trocas_proteina');

  await dbRun(`CREATE TABLE IF NOT EXISTS portaria_agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    visitante TEXT NOT NULL,
    documento TEXT,
    observacao TEXT,
    status TEXT DEFAULT 'agendado',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
  )`);
  console.log('✅ [DB] portaria_agendamentos');

  await dbRun(`CREATE TABLE IF NOT EXISTS ti_solicitacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    prioridade TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
  )`);
  console.log('✅ [DB] ti_solicitacoes');
};

// ==================== SCHEMA (MIGRATIONS) ====================
const ensureColumn = async (table, column, ddl) => {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const exists = info.some(c => c.name === column);
  if (!exists) {
    await dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    console.log(`🧩 [DB] Coluna adicionada: ${table}.${column}`);
  }
};

const upgradeSchema = async () => {
  console.log('🧰 [DB] Verificando migrações...');

  // reservas.status
  await ensureColumn('reservas', 'status', `TEXT DEFAULT 'ativa'`);

  // mural_posts.* (caso a tabela antiga não tivesse colunas)
  await ensureColumn('mural_posts', 'usuario_id', 'INTEGER');
  await ensureColumn('mural_posts', 'pinned', 'BOOLEAN DEFAULT 0');
  await ensureColumn('mural_posts', 'ativo', 'BOOLEAN DEFAULT 1');
  await ensureColumn('mural_posts', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

  // mural_likes.created_at
  await ensureColumn('mural_likes', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

  // ti_solicitacoes.*
  await ensureColumn('ti_solicitacoes', 'usuario_id', 'INTEGER');
  await ensureColumn('ti_solicitacoes', 'prioridade', `TEXT DEFAULT 'medium'`);
  await ensureColumn('ti_solicitacoes', 'status', `TEXT DEFAULT 'pending'`);
  await ensureColumn('ti_solicitacoes', 'created_at', `DATETIME DEFAULT CURRENT_TIMESTAMP`);

  // Backfill mínimo para não quebrar LEFT JOINs
  const anyUser = await dbGet('SELECT id FROM usuarios ORDER BY id LIMIT 1');
  if (anyUser?.id) {
    await dbRun(`UPDATE mural_posts SET usuario_id = ? WHERE usuario_id IS NULL`, [anyUser.id]);
    await dbRun(`UPDATE ti_solicitacoes SET usuario_id = ? WHERE usuario_id IS NULL`, [anyUser.id]);
  }
  await dbRun(`UPDATE reservas SET status = 'ativa' WHERE status IS NULL`);
  console.log('✅ [DB] Migrações aplicadas');
};

// ==================== DB INIT ====================
const createDefaultUsers = async () => {
  const ensure = async (nome, email, senha, setor, role) => {
    const exists = await dbGet('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (!exists) {
      const hash = await bcrypt.hash(senha, 10);
      await dbRun('INSERT INTO usuarios (nome, email, senha, setor, role) VALUES (?, ?, ?, ?, ?)', [nome, email, hash, setor, role]);
      console.log(`👤 [DB] Seed criado: ${email}`);
    }
  };
  await ensure('Administrador do Sistema', 'admin@grupocropfield.com.br', 'admin123', 'TI', 'admin');
  await ensure('RH Sistema', 'rh@grupocropfield.com.br', 'rh123', 'RH', 'rh');
  await ensure('Usuário Teste', 'user@grupocropfield.com.br', 'user123', 'Geral', 'colaborador');
};

const initDatabase = async () => new Promise((resolve, reject) => {
  console.log('🗄️ [DB] Conectando em', dbPath);
  db = new sqlite3.Database(dbPath, async (err) => {
    if (err) return reject(err);
    try {
      await createTables();     // cria se não existe
      await upgradeSchema();    // garante colunas novas
      await createDefaultUsers();
      console.log('✅ [DB] Pronto');
      resolve();
    } catch (e) {
      reject(e);
    }
  });
});

// ==================== AUTH ====================
const authenticate = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await dbGet('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [req.session.userId]);
      if (user) {
        req.user = {
          id: user.id,
          nome: user.nome,
          name: user.nome,
          email: user.email,
          setor: user.setor,
          sector: user.setor,
          role: user.role,
          foto: user.foto,
          avatar: user.foto
        };
        return next();
      }
    }
    return res.status(401).json({ ok: false, error: 'Não autenticado' });
  } catch (e) {
    console.error('❌ [AUTH] Middleware:', e.message);
    return res.status(500).json({ ok: false, error: 'Erro de autenticação' });
  }
};

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Email e senha são obrigatórios' });
    const user = await dbGet('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [email.toLowerCase()]);
    if (!user) return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(password, user.senha);
    if (!ok) return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    const payload = { id: user.id, name: user.nome, email: user.email, sector: user.setor, setor: user.setor, role: user.role, avatar: user.foto };
    res.json({ ok: true, user: payload });
  } catch (e) {
    console.error('❌ [AUTH] login:', e.message);
    res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true, message: 'Logout realizado' }));
});

app.get('/api/me', authenticate, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ==================== USUÁRIOS (ADMIN) ====================
app.get('/api/admin/users', authenticate, async (_req, res) => {
  try {
    const users = await dbAll('SELECT id, nome, email, setor, role, ativo, created_at FROM usuarios ORDER BY created_at DESC');
    res.json({ ok: true, users });
  } catch (e) {
    console.error('❌ [ADMIN] list:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar usuários' });
  }
});

app.post('/api/admin/users', authenticate, async (req, res) => {
  try {
    let { nome, email, senha, password, setor = 'Geral', role = 'colaborador' } = req.body || {};
    nome = (nome || '').trim();
    email = (email || '').trim().toLowerCase();
    const senhaRaw = (senha ?? password ?? '').toString();

    if (!nome || !email || !senhaRaw) {
      return res.status(400).json({ ok: false, error: 'Nome, email e senha são obrigatórios' });
    }
    if (senhaRaw.length < 6) {
      return res.status(400).json({ ok: false, error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    const dup = await dbGet('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (dup) return res.status(409).json({ ok: false, error: 'Este email já está em uso' });

    const hash = await bcrypt.hash(senhaRaw, 10);
    const result = await dbRun(
      'INSERT INTO usuarios (nome, email, senha, setor, role, ativo) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, email, hash, setor, role, 1]
    );
    res.json({ ok: true, id: result.lastID, message: 'Usuário criado com sucesso' });
  } catch (e) {
    console.error('❌ [ADMIN] create:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao criar usuário' });
  }
});

app.patch('/api/admin/users/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const allowed = ['nome', 'email', 'setor', 'role', 'ativo'];
    const vals = {};
    for (const k of allowed) if (req.body?.[k] !== undefined) vals[k] = req.body[k];
    if (Object.keys(vals).length === 0) return res.status(400).json({ ok: false, error: 'Nenhum campo válido para atualizar' });
    vals.updated_at = new Date().toISOString();
    const set = Object.keys(vals).map(k => `${k} = ?`).join(', ');
    const params = [...Object.values(vals), userId];
    const r = await dbRun(`UPDATE usuarios SET ${set} WHERE id = ?`, params);
    if (r.changes === 0) return res.status(404).json({ ok: false, error: 'Usuário não encontrado' });
    res.json({ ok: true, message: 'Usuário atualizado com sucesso' });
  } catch (e) {
    console.error('❌ [ADMIN] update:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao atualizar usuário' });
  }
});

app.patch('/api/admin/users/:userId/password', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { senha } = req.body || {};
    if (!senha || String(senha).length < 6) return res.status(400).json({ ok: false, error: 'Senha deve ter pelo menos 6 caracteres' });
    const hash = await bcrypt.hash(String(senha), 10);
    const r = await dbRun('UPDATE usuarios SET senha = ?, updated_at = ? WHERE id = ?', [hash, new Date().toISOString(), userId]);
    if (r.changes === 0) return res.status(404).json({ ok: false, error: 'Usuário não encontrado' });
    res.json({ ok: true, message: 'Senha alterada com sucesso' });
  } catch (e) {
    console.error('❌ [ADMIN] pwd:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao alterar senha' });
  }
});

// ==================== RESERVAS ====================
app.get('/api/reservas', authenticate, async (_req, res) => {
  try {
    const reservas = await dbAll(`
      SELECT r.*, u.nome as responsavel
      FROM reservas r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      WHERE COALESCE(r.status,'ativa') = 'ativa'
      ORDER BY r.data, r.inicio
    `);
    res.json({ ok: true, reservas });
  } catch (e) {
    console.error('❌ [RESERVAS] list:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar reservas' });
  }
});

app.post('/api/reservas', authenticate, async (req, res) => {
  try {
    const { sala, data, inicio, fim, assunto, descricao = '' } = req.body || {};
    if (!sala || !data || !inicio || !fim || !assunto) return res.status(400).json({ ok: false, error: 'Todos os campos são obrigatórios' });
    const conflitos = await dbAll(`
      SELECT id FROM reservas 
      WHERE sala = ? AND data = ? AND COALESCE(status,'ativa') = 'ativa'
      AND ((inicio <= ? AND fim > ?) OR (inicio < ? AND fim >= ?))
    `, [sala, data, inicio, inicio, fim, fim]);
    if (conflitos.length) return res.status(409).json({ ok: false, error: 'Horário já reservado para esta sala' });
    const r = await dbRun('INSERT INTO reservas (usuario_id, sala, data, inicio, fim, assunto, descricao, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [req.user.id, sala, data, inicio, fim, assunto, descricao, 'ativa']);
    res.json({ ok: true, id: r.lastID, points: 10 });
  } catch (e) {
    console.error('❌ [RESERVAS] create:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao criar reserva' });
  }
});

// ==================== MURAL ====================
app.get('/api/mural/posts', authenticate, async (_req, res) => {
  try {
    const posts = await dbAll(`
      SELECT p.*, u.nome as author,
        (SELECT COUNT(*) FROM mural_likes l WHERE l.post_id = p.id) as likes_count,
        0 as comments_count
      FROM mural_posts p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      WHERE COALESCE(p.ativo,1) = 1
      ORDER BY COALESCE(p.pinned,0) DESC, p.created_at DESC
    `);
    res.json({ ok: true, posts });
  } catch (e) {
    console.error('❌ [MURAL] list:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar posts' });
  }
});

app.post('/api/mural/posts', authenticate, async (req, res) => {
  try {
    const { titulo, conteudo, pinned = false } = req.body || {};
    if (!titulo || !conteudo) return res.status(400).json({ ok: false, error: 'Título e conteúdo são obrigatórios' });
    const r = await dbRun('INSERT INTO mural_posts (usuario_id, titulo, conteudo, pinned, ativo) VALUES (?, ?, ?, ?, ?)', [req.user.id, titulo, conteudo, pinned ? 1 : 0, 1]);
    res.json({ ok: true, id: r.lastID, points: 15 });
  } catch (e) {
    console.error('❌ [MURAL] create:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao criar post' });
  }
});

app.post('/api/mural/:postId/like', authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    const like = await dbGet('SELECT id FROM mural_likes WHERE post_id = ? AND usuario_id = ?', [postId, req.user.id]);
    if (like) {
      await dbRun('DELETE FROM mural_likes WHERE id = ?', [like.id]);
      return res.json({ ok: true, action: 'unliked' });
    }
    await dbRun('INSERT INTO mural_likes (post_id, usuario_id) VALUES (?, ?)', [postId, req.user.id]);
    return res.json({ ok: true, action: 'liked', points: 2 });
  } catch (e) {
    console.error('❌ [MURAL] like:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao processar like' });
  }
});

app.post('/api/mural/:postId/comments', authenticate, async (req, res) => {
  try {
    const { texto } = req.body || {};
    if (!texto || !String(texto).trim()) return res.status(400).json({ ok: false, error: 'Texto do comentário é obrigatório' });
    const commentId = Date.now(); // sem tabela de comentários, apenas simula
    res.json({ ok: true, id: commentId, points: 3 });
  } catch (e) {
    console.error('❌ [MURAL] comment:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao criar comentário' });
  }
});

// ==================== TROCAS DE PROTEÍNA ====================
app.get('/api/trocas-proteina', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query || {};
    let sql = 'SELECT * FROM trocas_proteina WHERE usuario_id = ?';
    const params = [req.user.id];
    if (from && to) { sql += ' AND data BETWEEN ? AND ?'; params.push(from, to); }
    sql += ' ORDER BY data';
    const trocas = await dbAll(sql, params);
    res.json({ ok: true, trocas });
  } catch (e) {
    console.error('❌ [TROCAS] list:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar trocas' });
  }
});

app.post('/api/trocas-proteina/bulk', authenticate, async (req, res) => {
  try {
    const { trocas } = req.body || {};
    if (!Array.isArray(trocas) || !trocas.length) return res.status(400).json({ ok: false, error: 'Lista de trocas inválida' });
    let inseridas = 0;
    for (const t of trocas) {
      try {
        await dbRun('INSERT OR REPLACE INTO trocas_proteina (usuario_id, data, proteina_original, proteina_nova) VALUES (?, ?, ?, ?)', [req.user.id, t.data, t.proteina_original, t.proteina_nova]);
        inseridas++;
      } catch (e) {
        console.error('❌ [TROCAS] item:', e.message);
      }
    }
    res.json({ ok: true, inseridas, totalPoints: inseridas * 5 });
  } catch (e) {
    console.error('❌ [TROCAS] bulk:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao salvar trocas' });
  }
});

// ==================== TI ====================
app.get('/api/ti/solicitacoes', authenticate, async (_req, res) => {
  try {
    const solicitacoes = await dbAll(`
      SELECT s.*, u.nome, u.email
      FROM ti_solicitacoes s
      LEFT JOIN usuarios u ON s.usuario_id = u.id
      ORDER BY s.created_at DESC
    `);
    res.json({ ok: true, solicitacoes });
  } catch (e) {
    console.error('❌ [TI] list:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar solicitações' });
  }
});

app.get('/api/ti/minhas', authenticate, async (req, res) => {
  try {
    const solicitacoes = await dbAll('SELECT * FROM ti_solicitacoes WHERE usuario_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ ok: true, solicitacoes });
  } catch (e) {
    console.error('❌ [TI] minhas:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar suas solicitações' });
  }
});

app.post('/api/ti/solicitacoes', authenticate, async (req, res) => {
  try {
    const { titulo, descricao, prioridade = 'medium' } = req.body || {};
    if (!titulo || !descricao) return res.status(400).json({ ok: false, error: 'Título e descrição são obrigatórios' });
    const r = await dbRun('INSERT INTO ti_solicitacoes (usuario_id, titulo, descricao, prioridade, status) VALUES (?, ?, ?, ?, ?)', [req.user.id, titulo, descricao, prioridade, 'pending']);
    res.json({ ok: true, id: r.lastID, points: 5 });
  } catch (e) {
    console.error('❌ [TI] create:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao criar solicitação' });
  }
});

// ==================== DASHBOARD ====================
app.get('/api/admin/dashboard', authenticate, async (req, res) => {
  try {
    const stats = {
      usuarios_ativos: (await dbGet('SELECT COUNT(*) as count FROM usuarios WHERE ativo = 1')).count,
      posts_mural: (await dbGet('SELECT COUNT(*) as count FROM mural_posts WHERE COALESCE(ativo,1) = 1')).count,
      reservas_salas: (await dbGet(`SELECT COUNT(*) as count FROM reservas WHERE COALESCE(status,'ativa') = 'ativa'`)).count,
      solicitacoes_ti: (await dbGet('SELECT COUNT(*) as count FROM ti_solicitacoes')).count,
      trocas_proteina: (await dbGet('SELECT COUNT(*) as count FROM trocas_proteina')).count,
      agendamentos_portaria: (await dbGet('SELECT COUNT(*) as count FROM portaria_agendamentos')).count
    };
    const ranking = await dbAll('SELECT nome, pontos as total_pontos, foto FROM usuarios WHERE ativo = 1 ORDER BY pontos DESC LIMIT 10');
    res.json({ ok: true, stats, ranking, userPoints: req.user.pontos || 0, breakdown: [] });
  } catch (e) {
    console.error('❌ [ADMIN] dashboard:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar dashboard' });
  }
});

// ==================== EXPORTS CSV ====================
app.get('/api/admin/export/:filename', authenticate, async (req, res) => {
  try {
    const { filename } = req.params;
    if (filename.includes('ranking.csv')) {
      const rows = await dbAll('SELECT nome, email, setor, pontos, created_at FROM usuarios WHERE ativo = 1 ORDER BY pontos DESC');
      const header = 'Nome,Email,Setor,Pontos,Data Cadastro\n';
      const csv = rows.map(r => `"${r.nome}","${r.email}","${r.setor}",${r.pontos},"${r.created_at}"`).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=ranking.csv');
      return res.send(header + csv);
    }
    if (filename.includes('trocas-proteina.csv')) {
      const rows = await dbAll(`
        SELECT t.*, u.nome as usuario_nome, u.email as usuario_email, u.setor as usuario_setor
        FROM trocas_proteina t LEFT JOIN usuarios u ON t.usuario_id = u.id
        ORDER BY t.created_at DESC
      `);
      const header = 'Data,Usuario,Email,Setor,Proteina Original,Proteina Nova,Data Solicitacao\n';
      const csv = rows.map(t => `"${t.data}","${t.usuario_nome||''}","${t.usuario_email||''}","${t.usuario_setor||''}","${t.proteina_original}","${t.proteina_nova}","${t.created_at}"`).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=trocas-proteina.csv');
      return res.send(header + csv);
    }
    if (filename.includes('equipamentos.csv')) {
      const rows = await dbAll(`
        SELECT s.*, u.nome as usuario_nome, u.email as usuario_email, u.setor as usuario_setor
        FROM ti_solicitacoes s LEFT JOIN usuarios u ON s.usuario_id = u.id
        ORDER BY s.created_at DESC
      `);
      const header = 'ID,Usuario,Email,Setor,Equipamento,Descricao,Prioridade,Status,Data Solicitacao\n';
      const csv = rows.map(eq => `"${eq.id}","${eq.usuario_nome||''}","${eq.usuario_email||''}","${eq.usuario_setor||''}","${eq.titulo}","${eq.descricao}","${eq.prioridade}","${eq.status}","${eq.created_at}"`).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=equipamentos.csv');
      return res.send(header + csv);
    }
    if (filename.includes('reservas.csv')) {
      const rows = await dbAll(`
        SELECT r.*, u.nome as usuario_nome, u.email as usuario_email, u.setor as usuario_setor
        FROM reservas r LEFT JOIN usuarios u ON r.usuario_id = u.id
        ORDER BY r.created_at DESC
      `);
      const header = 'ID,Usuario,Email,Setor,Sala,Data,Inicio,Fim,Assunto,Status,Data Criacao\n';
      const csv = rows.map(x => `"${x.id}","${x.usuario_nome||''}","${x.usuario_email||''}","${x.usuario_setor||''}","${x.sala}","${x.data}","${x.inicio}","${x.fim}","${x.assunto}","${x.status}","${x.created_at}"`).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=reservas.csv');
      return res.send(header + csv);
    }
    if (filename.includes('portaria.csv')) {
      const rows = await dbAll(`
        SELECT p.*, u.nome as responsavel_nome, u.email as responsavel_email, u.setor as responsavel_setor
        FROM portaria_agendamentos p LEFT JOIN usuarios u ON p.usuario_id = u.id
        ORDER BY p.created_at DESC
      `);
      const header = 'ID,Visitante,Documento,Data Visita,Hora,Responsavel,Email,Setor,Observacao,Status,Data Agendamento\n';
      const csv = rows.map(ag => `"${ag.id}","${ag.visitante}","${ag.documento||''}","${ag.data}","${ag.hora}","${ag.responsavel_nome||''}","${ag.responsavel_email||''}","${ag.responsavel_setor||''}","${ag.observacao||''}","${ag.status}","${ag.created_at}"`).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=portaria.csv');
      return res.send(header + csv);
    }
    if (filename.includes('mural.csv')) {
      const rows = await dbAll(`
        SELECT p.*, u.nome as autor_nome, u.email as autor_email, u.setor as autor_setor,
          (SELECT COUNT(*) FROM mural_likes l WHERE l.post_id = p.id) as total_likes
        FROM mural_posts p LEFT JOIN usuarios u ON p.usuario_id = u.id
        ORDER BY p.created_at DESC
      `);
      const header = 'ID,Titulo,Autor,Email,Setor,Conteudo,Likes,Fixado,Ativo,Data Criacao\n';
      const csv = rows.map(post => `"${post.id}","${post.titulo}","${post.autor_nome||''}","${post.autor_email||''}","${post.autor_setor||''}","${(post.conteudo||'').replace(/"/g,'""')}","${post.total_likes}","${post.pinned?'Sim':'Não'}","${post.ativo?'Sim':'Não'}","${post.created_at}"`).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=mural.csv');
      return res.send(header + csv);
    }
    return res.json({ ok: true, data: [], message: `Export ${filename} simulado` });
  } catch (e) {
    console.error('❌ [EXPORT] erro:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao gerar export' });
  }
});

// ==================== 404 APIs (Express 5) ====================
app.use('/api', (req, res) => {
  console.log('❌ [404] Rota API não encontrada:', req.path);
  res.status(404).json({ ok: false, error: 'Rota não encontrada', path: req.path });
});

// ==================== STATIC / SPA (prod) ====================
if (!isDev && fs.existsSync(path.join(__dirname, 'dist'))) {
  app.use(express.static(path.join(__dirname, 'dist')));
  console.log('📁 [STATIC] Servindo dist/');
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  console.log('⚠️ [STATIC] dist/ não encontrado ou ambiente de desenvolvimento');
}

// ==================== ERRORS ====================
app.use((error, _req, res, _next) => {
  console.error('💥 [ERROR] Middleware:', error?.message || error);
  if (!res.headersSent) res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
});

// ==================== START ====================
const startServer = async () => {
  try {
    console.log('🗄️ [INIT] Inicializando banco de dados...');
    await initDatabase();
    console.log('🌐 [INIT] Iniciando servidor HTTP...');

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🎉 =======================================');
      console.log('✅ [SUCCESS] SERVIDOR INTRANET ONLINE!');
      console.log(`🌐 Frontend: http://localhost:5173`);
      console.log(`🔗 Backend:  http://localhost:${PORT}`);
      console.log('🎉 =======================================\n');
      console.log('🔑 [CREDENCIAIS]');
      console.log('   👨‍💼 Admin:  admin@grupocropfield.com.br / admin123');
      console.log('   👥 RH:     rh@grupocropfield.com.br / rh123');
      console.log('   👤 User:   user@grupocropfield.com.br / user123');
    });

    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    server.requestTimeout = 30000;

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ [SERVER] Porta ${PORT} em uso`);
        console.log('💡 [DICA] killall node && npm run dev');
        process.exit(1);
      } else {
        console.error('❌ [SERVER] Erro:', error.message);
      }
    });
  } catch (e) {
    console.error('💥 [FATAL] Falha na inicialização:', e.message);
    process.exit(1);
  }
};

process.on('uncaughtException', (e) => console.error('💥 [UNCAUGHT]', e?.message || e));
process.on('unhandledRejection', (r) => console.error('💥 [REJECTION]', r));
process.on('SIGTERM', () => { console.log('📡 SIGTERM'); if (db) db.close(() => process.exit(0)); else process.exit(0); });
process.on('SIGINT', () => { console.log('📡 SIGINT'); if (db) db.close(() => process.exit(0)); else process.exit(0); });

if (require.main === module) startServer();
module.exports = app;
