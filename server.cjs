// server.cjs
// -------------------------------------------------------------
// Backend Express + SQLite + Google OAuth + Points System
// Funcionalidades: OAuth, Pontos, Ranking Mensal, Reservas, Portaria, Trocas, Mural
// -------------------------------------------------------------
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { format, parseISO } = require('date-fns');
const { ptBR } = require('date-fns/locale');

const app = express();
const PORT = process.env.PORT || 3005; // << porta da API

// Load environment variables
require('dotenv').config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const OAUTH_CALLBACK_URL =
  process.env.OAUTH_CALLBACK_URL || 'http://localhost:3005/auth/google/callback'; // << callback na 3005

// Points system configuration
const POINTS = {
  MURAL_LIKE: 5,
  MURAL_COMMENT: 10,
  RESERVA_CREATE: 10,
  PORTARIA_CREATE: 10,
  TROCA_PROTEINA: 5
};

// -------------------------------------------------------------
// Middleware setup
// -------------------------------------------------------------
const allowed = new Set([
  FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(cors({
  // em dev, libera qualquer origin; em prod, exige estar na whitelist
  origin: (origin, cb) => cb(null, !origin || allowed.has(origin) || process.env.NODE_ENV !== 'production'),
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(passport.initialize());

// -------------------------------------------------------------
// Database setup
// -------------------------------------------------------------
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Erro ao abrir o banco:', err.message);
  else console.log('Banco conectado:', dbPath);
});

// -------------------------------------------------------------
// Database helpers
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
// Database schema migration
// -------------------------------------------------------------
async function createSchema() {
  try {
    // Users table
    await run(`CREATE TABLE IF NOT EXISTS usuarios(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT,
      email TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      foto TEXT,
      setor TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Points ledger
    await run(`CREATE TABLE IF NOT EXISTS pontos(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      acao TEXT NOT NULL,
      pontos INTEGER NOT NULL,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Mural tables
    await run(`CREATE TABLE IF NOT EXISTS mural_posts(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT,
      conteudo TEXT,
      author TEXT,
      pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await run(`CREATE TABLE IF NOT EXISTS mural_likes(
      post_id INTEGER,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS mural_comments(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER,
      user_id INTEGER,
      texto TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Reservations table
    await run(`CREATE TABLE IF NOT EXISTS reservas(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sala TEXT,
      data DATE,
      inicio TEXT,
      fim TEXT,
      assunto TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Reception appointments
    await run(`CREATE TABLE IF NOT EXISTS portaria_agendamentos(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data DATE,
      hora TEXT,
      visitante TEXT,
      documento TEXT,
      observacao TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Protein exchanges
    await run(`CREATE TABLE IF NOT EXISTS trocas_proteina(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data DATE,
      dia TEXT,
      proteina_original TEXT,
      proteina_nova TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migration: Check and add user_id/data columns to trocas_proteina if missing
    const tableInfo = await all("PRAGMA table_info(trocas_proteina)");
    const hasUserId = tableInfo.some(column => column.name === 'user_id');
    const hasData = tableInfo.some(column => column.name === 'data');
    if (!hasUserId) await run("ALTER TABLE trocas_proteina ADD COLUMN user_id INTEGER");
    if (!hasData) await run("ALTER TABLE trocas_proteina ADD COLUMN data DATE");

    console.log('Schema criado/verificado com sucesso');
  } catch (e) {
    console.error('Erro ao criar schema:', e);
  }
}

createSchema();

// -------------------------------------------------------------
// Points system helper
// -------------------------------------------------------------
async function registrarPontos(user_id, acao, pontos, meta = null) {
  try {
    await run(
      "INSERT INTO pontos(user_id, acao, pontos, meta) VALUES(?, ?, ?, ?)",
      [user_id, acao, pontos, meta ? JSON.stringify(meta) : null]
    );
    console.log(`Pontos registrados: ${acao} = +${pontos} para user ${user_id}`);
  } catch (e) {
    console.error('Erro ao registrar pontos:', e);
  }
}

// -------------------------------------------------------------
// Google OAuth setup
// -------------------------------------------------------------
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: OAUTH_CALLBACK_URL
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const { id: google_id, emails, displayName, photos } = profile;
      const email = emails[0].value;
      const nome = displayName;
      const foto = photos[0]?.value;

      // Upsert user
      let user = await get("SELECT * FROM usuarios WHERE google_id = ? OR email = ?", [google_id, email]);
      if (user) {
        await run("UPDATE usuarios SET google_id = ?, nome = ?, foto = ? WHERE id = ?",
          [google_id, nome, foto, user.id]);
        user = { ...user, google_id, nome, foto };
      } else {
        const result = await run(
          "INSERT INTO usuarios(google_id, email, nome, foto, setor) VALUES(?, ?, ?, ?, ?)",
          [google_id, email, nome, foto, 'Geral']
        );
        user = { id: result.lastID, google_id, email, nome, foto, setor: 'Geral' };
      }
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
}

// -------------------------------------------------------------
// Authentication middleware
// -------------------------------------------------------------
function authMiddleware(req, res, next) {
  const token = req.cookies.sid;
  if (!token) { req.userId = 1; return next(); } // demo user

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.sub;
    next();
  } catch {
    req.userId = 1; // demo user
    next();
  }
}

async function getUserMiddleware(req, res, next) {
  if (!req.userId) req.userId = 1;
  try {
    const user = await get("SELECT * FROM usuarios WHERE id = ?", [req.userId]);
    if (!user) {
      req.user = { id: 1, nome: 'Usuário Demo', email: 'demo@grupocropfield.com.br', setor: 'Geral' };
      return next();
    }
    req.user = user;
    next();
  } catch {
    req.user = { id: 1, nome: 'Usuário Demo', email: 'demo@grupocropfield.com.br', setor: 'Geral' };
    next();
  }
}

// -------------------------------------------------------------
// Auth routes
// -------------------------------------------------------------
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    try {
      const token = jwt.sign({ sub: req.user.id }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('sid', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      res.redirect(`${FRONTEND_URL}/`);
    } catch (error) {
      console.error('Erro no callback OAuth:', error);
      res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
    }
  }
);

app.post('/auth/logout', (req, res) => {
  res.clearCookie('sid');
  res.json({ ok: true, message: 'Logout realizado com sucesso' });
});

// Manual login endpoint
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Email e senha são obrigatórios' });

    const users = [
      { id: 1, email: 'admin@grupocropfield.com.br', password: 'admin123', nome: 'Administrador', setor: 'TI' },
      { id: 2, email: 'rh@grupocropfield.com.br', password: 'rh123', nome: 'RH Manager', setor: 'RH' },
      { id: 3, email: 'user@grupocropfield.com.br', password: 'user123', nome: 'Usuário Teste', setor: 'Geral' },
    ];
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });

    let dbUser = await get("SELECT * FROM usuarios WHERE email = ?", [email]);
    if (!dbUser) {
      const result = await run(
        "INSERT INTO usuarios(email, nome, setor) VALUES(?, ?, ?)",
        [user.email, user.nome, user.setor]
      );
      dbUser = { id: result.lastID, email: user.email, nome: user.nome, setor: user.setor };
    }

    const token = jwt.sign({ sub: dbUser.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('sid', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ ok: true, message: 'Login realizado com sucesso',
      user: { id: dbUser.id, email: dbUser.email, nome: dbUser.nome, setor: dbUser.setor }});
  } catch (error) {
    console.error('Erro no login manual:', error);
    res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  }
});

// -------------------------------------------------------------
// API routes
// -------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true, message: 'Server running' }));

// Get current user
app.get('/api/me', authMiddleware, getUserMiddleware, (req, res) => {
  res.json({ ok: true, user: {
    id: req.user.id, name: req.user.nome, email: req.user.email, sector: req.user.setor, avatar: req.user.foto
  }});
});

// Get contacts from JSON
app.get('/api/contatos', (req, res) => {
  try {
    const { q } = req.query;
    const contatosPath = path.join(__dirname, 'public', 'dados', 'contatos.json');
    if (!fs.existsSync(contatosPath)) return res.json([]);
    const data = JSON.parse(fs.readFileSync(contatosPath, 'utf8'));
    
    // Flatten the structure to a single array
    const contatos = [
      ...(data.representantes || []),
      ...(data.equipe_apucarana_pr || [])
    ];
    
    if (!q) return res.json(contatos);
    const query = String(q).toLowerCase();
    const filtered = contatos.filter(c =>
      c.nome.toLowerCase().includes(query) ||
      (c.email || '').toLowerCase().includes(query) ||
      (c.ramal || '').toLowerCase().includes(query) ||
      c.setor.toLowerCase().includes(query)
    );
    res.json(filtered);
  } catch (error) {
    console.error('Erro ao buscar contatos:', error);
    res.json([]);
  }
});

// Get user points for current month
app.get('/api/pontos/minha-conta', authMiddleware, async (req, res) => {
  try {
    const pontos = await all(`
      SELECT acao, SUM(pontos) as total, COUNT(*) as count
      FROM pontos 
      WHERE user_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
      GROUP BY acao
    `, [req.userId]);
    const totalPontos = pontos.reduce((sum, p) => sum + p.total, 0);
    res.json({ ok: true, totalPontos, breakdown: pontos });
  } catch (error) {
    console.error('Erro ao buscar pontos:', error);
    res.status(500).json({ ok: false, error: 'Erro ao buscar pontos' });
  }
});

// Get monthly ranking
app.get('/api/pontos/ranking', async (_req, res) => {
  try {
    const ranking = await all(`
      SELECT u.nome, u.foto, SUM(p.pontos) as total_pontos
      FROM pontos p
      JOIN usuarios u ON p.user_id = u.id
      WHERE strftime('%Y-%m', p.created_at) = strftime('%Y-%m', 'now')
      GROUP BY u.id, u.nome, u.foto
      ORDER BY total_pontos DESC
      LIMIT 10
    `);
    res.json({ ok: true, ranking });
  } catch (error) {
    console.error('Erro ao buscar ranking:', error);
    res.status(500).json({ ok: false, error: 'Erro ao buscar ranking' });
  }
});

// -------------------------------------------------------------
// Mural routes
// -------------------------------------------------------------
app.get('/api/mural/posts', async (_req, res) => {
  try {
    const posts = await all(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM mural_likes l WHERE l.post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM mural_comments c WHERE c.post_id = p.id) as comments_count
      FROM mural_posts p
      ORDER BY p.pinned DESC, p.created_at DESC
    `);
    res.json({ ok: true, posts });
  } catch {
    res.status(500).json({ ok: false, error: 'Erro ao buscar posts' });
  }
});

app.post('/api/mural/:id/like', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.id;
    const existing = await get("SELECT * FROM mural_likes WHERE post_id = ? AND user_id = ?", [postId, req.userId]);
    if (existing) {
      await run("DELETE FROM mural_likes WHERE post_id = ? AND user_id = ?", [postId, req.userId]);
      res.json({ ok: true, action: 'unliked' });
    } else {
      await run("INSERT INTO mural_likes(post_id, user_id) VALUES(?, ?)", [postId, req.userId]);
      await registrarPontos(req.userId, 'MURAL_LIKE', POINTS.MURAL_LIKE, { post_id: postId });
      res.json({ ok: true, action: 'liked', points: POINTS.MURAL_LIKE });
    }
  } catch (error) {
    console.error('Erro ao processar like:', error);
    res.status(500).json({ ok: false, error: 'Erro ao processar like' });
  }
});

app.post('/api/mural/:id/comments', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.id;
    const { texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ ok: false, error: 'Texto do comentário é obrigatório' });

    const result = await run(
      "INSERT INTO mural_comments(post_id, user_id, texto) VALUES(?, ?, ?)",
      [postId, req.userId, texto.trim()]
    );
    await registrarPontos(req.userId, 'MURAL_COMMENT', POINTS.MURAL_COMMENT, { post_id: postId });
    res.json({ ok: true, id: result.lastID, points: POINTS.MURAL_COMMENT });
  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    res.status(500).json({ ok: false, error: 'Erro ao criar comentário' });
  }
});

// -------------------------------------------------------------
// Reservations routes
// -------------------------------------------------------------
app.post('/api/reservas', authMiddleware, async (req, res) => {
  try {
    const { sala, data, inicio, fim, assunto } = req.body;
    if (!sala || !data || !inicio || !fim || !assunto) {
      return res.status(400).json({ ok: false, error: 'Todos os campos são obrigatórios' });
    }

    // Check for conflicts
    const conflict = await get(`
      SELECT * FROM reservas 
      WHERE sala = ? AND data = ? 
      AND ((inicio <= ? AND fim > ?) OR (inicio < ? AND fim >= ?))
    `, [sala, data, inicio, inicio, fim, fim]);
    if (conflict) {
      return res.status(400).json({ ok: false, error: 'Conflito de horário para esta sala' });
    }

    const result = await run(
      "INSERT INTO reservas(sala, data, inicio, fim, assunto, user_id) VALUES(?, ?, ?, ?, ?, ?)",
      [sala, data, inicio, fim, assunto, req.userId]
    );

    await registrarPontos(req.userId, 'RESERVA_CREATE', POINTS.RESERVA_CREATE, { sala, data });
    res.json({ ok: true, id: result.lastID, points: POINTS.RESERVA_CREATE });
  } catch (error) {
    console.error('Erro ao criar reserva:', error);
    res.status(500).json({ ok: false, error: 'Erro ao criar reserva' });
  }
});

app.get('/api/reservas', async (_req, res) => {
  try {
    const reservas = await all(`
      SELECT r.*, u.nome as responsavel
      FROM reservas r
      LEFT JOIN usuarios u ON r.user_id = u.id
      ORDER BY r.data ASC, r.inicio ASC
    `);
    res.json({ ok: true, reservas });
  } catch (error) {
    console.error('Erro ao buscar reservas:', error);
    res.status(500).json({ ok: false, error: 'Erro ao buscar reservas' });
  }
});

// -------------------------------------------------------------
// Reception appointments routes
// -------------------------------------------------------------
app.post('/api/portaria/agendamentos', authMiddleware, async (req, res) => {
  try {
    const { data, hora, visitante, documento, observacao } = req.body;
    if (!data || !hora || !visitante) {
      return res.status(400).json({ ok: false, error: 'Data, hora e visitante são obrigatórios' });
    }

    const result = await run(
      "INSERT INTO portaria_agendamentos(data, hora, visitante, documento, observacao, user_id) VALUES(?, ?, ?, ?, ?, ?)",
      [data, hora, visitante, documento, observacao, req.userId]
    );

    await registrarPontos(req.userId, 'PORTARIA_CREATE', POINTS.PORTARIA_CREATE, { data, visitante });
    res.json({ ok: true, id: result.lastID, points: POINTS.PORTARIA_CREATE });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ ok: false, error: 'Erro ao criar agendamento' });
  }
});

app.get('/api/portaria/agendamentos', async (_req, res) => {
  try {
    const agendamentos = await all(`
      SELECT p.*, u.nome as responsavel
      FROM portaria_agendamentos p
      LEFT JOIN usuarios u ON p.user_id = u.id
      ORDER BY p.data DESC, p.hora DESC
    `);
    res.json({ ok: true, agendamentos });
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    res.status(500).json({ ok: false, error: 'Erro ao buscar agendamentos' });
  }
});

// -------------------------------------------------------------
// Protein exchange routes
// -------------------------------------------------------------
app.post('/api/trocas-proteina/bulk', authMiddleware, async (req, res) => {
  try {
    const { trocas } = req.body;
    if (!Array.isArray(trocas) || trocas.length === 0) {
      return res.status(400).json({ ok: false, error: 'Lista de trocas é obrigatória' });
    }

    let inseridas = 0;
    for (const troca of trocas) {
      const { data, proteina_original, proteina_nova } = troca;
      if (!data || !proteina_nova || proteina_nova === proteina_original) continue;

      const existing = await get(
        "SELECT * FROM trocas_proteina WHERE user_id = ? AND data = ?",
        [req.userId, data]
      );

      if (!existing) {
        const dia = format(parseISO(data), 'EEEE', { locale: ptBR });
        await run(
          "INSERT INTO trocas_proteina(data, dia, proteina_original, proteina_nova, user_id) VALUES(?, ?, ?, ?, ?)",
          [data, dia, proteina_original, proteina_nova, req.userId]
        );
        await registrarPontos(req.userId, 'TROCA_PROTEINA', POINTS.TROCA_PROTEINA, { data });
        inseridas++;
      }
    }

    const totalPoints = inseridas * POINTS.TROCA_PROTEINA;
    res.json({ ok: true, inseridas, totalPoints });
  } catch (error) {
    console.error('Erro ao processar trocas:', error);
    res.status(500).json({ ok: false, error: 'Erro ao processar trocas' });
  }
});

app.get('/api/trocas-proteina', authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = "SELECT * FROM trocas_proteina WHERE user_id = ?";
    const params = [req.userId];

    if (from && to) {
      sql += " AND date(data) BETWEEN date(?) AND date(?)";
      params.push(from, to);
    }

    sql += " ORDER BY date(data) ASC";
    const trocas = await all(sql, params);
    res.json({ ok: true, trocas });
  } catch (error) {
    console.error('Erro ao buscar trocas:', error);
    res.status(500).json({ ok: false, error: 'Erro ao buscar trocas' });
  }
});

// -------------------------------------------------------------
// Server startup
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`Google OAuth configurado: ${!!GOOGLE_CLIENT_ID}`);
});
