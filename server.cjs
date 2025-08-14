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
const bcrypt = require('bcryptjs');
const multer = require('multer');
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

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

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
  if (err) {
    console.error('Erro ao abrir o banco:', err.message);
    // Handle EIO errors by deleting the corrupted database file
    if (err.code === 'EIO') {
      console.log('Detectado erro EIO - removendo arquivo de banco corrompido...');
      try {
        if (fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
          console.log('Arquivo de banco removido. Reinicie o servidor para criar um novo banco.');
        }
      } catch (deleteErr) {
        console.error('Erro ao remover arquivo de banco:', deleteErr.message);
      }
    }
  } else {
    console.log('Banco conectado:', dbPath);
  }
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

    // Add new columns to usuarios table (idempotent) - ADMIN PANEL REQUIREMENTS
    const usuariosInfo = await all("PRAGMA table_info(usuarios)");
    const hasRole = usuariosInfo.some(col => col.name === 'role');
    const hasAtivo = usuariosInfo.some(col => col.name === 'ativo');
    const hasSenhaHash = usuariosInfo.some(col => col.name === 'senha_hash');
    
    if (!hasRole) {
      await run("ALTER TABLE usuarios ADD COLUMN role TEXT DEFAULT 'colaborador'");
      console.log('Added role column to usuarios table');
    }
    if (!hasAtivo) {
      await run("ALTER TABLE usuarios ADD COLUMN ativo INTEGER DEFAULT 1");
      console.log('Added ativo column to usuarios table');
    }
    if (!hasSenhaHash) {
      await run("ALTER TABLE usuarios ADD COLUMN senha_hash TEXT");
      console.log('Added senha_hash column to usuarios table');
    }

    // Points ledger
    await run(`CREATE TABLE IF NOT EXISTS pontos(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      acao TEXT NOT NULL,
      pontos INTEGER NOT NULL,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // TI Requests table
    await run(`CREATE TABLE IF NOT EXISTS ti_solicitacoes(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descricao TEXT,
      status TEXT DEFAULT 'pendente',
      solicitante_id INTEGER NOT NULL,
      responsavel_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // System settings table
    await run(`CREATE TABLE IF NOT EXISTS system_settings(
      chave TEXT PRIMARY KEY,
      valor TEXT
    )`);

    // Cardapio table (optional)
    await run(`CREATE TABLE IF NOT EXISTS cardapio(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data DATE NOT NULL,
      tipo TEXT CHECK(tipo IN ('padrao','light')) NOT NULL,
      proteina TEXT, 
      prato TEXT, 
      descricao TEXT,
      acompanhamentos TEXT, 
      sobremesa TEXT,
      UNIQUE(data,tipo)
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
    throw e; // Re-throw to prevent server from starting with broken database
  }
}

// -------------------------------------------------------------
// Role-based middleware
// -------------------------------------------------------------
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Não autenticado' });
    }
    
    console.log('Role check - User:', req.user.email, 'Role:', req.user.role, 'Required:', roles);
    
    // Admin has access to everything
    if (req.user.role === 'admin' || req.user.email === 'admin@grupocropfield.com.br') {
      return next();
    }
    
    if (!roles.includes(req.user.role)) {
      console.log('Access denied - User role:', req.user.role, 'Required roles:', roles);
      return res.status(403).json({ ok: false, error: 'Acesso negado' });
    }
    next();
  };
}

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
    const user = await get("SELECT * FROM usuarios WHERE id = ? AND ativo = 1", [req.userId]);
    if (!user) {
      // Check for demo users
      const demoUser = req.userId === 1 ? 
        { id: 1, nome: 'Administrador', email: 'admin@grupocropfield.com.br', setor: 'TI', role: 'admin' } :
        { id: req.userId, nome: 'Usuário Demo', email: 'demo@grupocropfield.com.br', setor: 'Geral', role: 'colaborador' };
      req.user = demoUser;
      return next();
    }
    
    // Ensure role is set for database users
    if (!user.role) {
      if (user.email === 'admin@grupocropfield.com.br' || user.setor === 'TI') {
        user.role = 'admin';
      } else if (user.setor === 'RH') {
        user.role = 'rh';
      } else {
        user.role = 'colaborador';
      }
    }
    
    req.user = user;
    console.log('User middleware - User:', user.email, 'Role:', user.role);
    next();
  } catch {
    req.user = { id: 1, nome: 'Administrador', email: 'admin@grupocropfield.com.br', setor: 'TI', role: 'admin' };
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

    let dbUser = await get("SELECT * FROM usuarios WHERE email = ? AND ativo = 1", [email]);
    if (!dbUser) {
      // Demo users fallback
      const demoUsers = [
        { id: 1, email: 'admin@grupocropfield.com.br', password: 'admin123', nome: 'Administrador', setor: 'TI', role: 'admin' },
        { id: 2, email: 'rh@grupocropfield.com.br', password: 'rh123', nome: 'RH Manager', setor: 'RH', role: 'rh' },
        { id: 3, email: 'user@grupocropfield.com.br', password: 'user123', nome: 'Usuário Teste', setor: 'Geral', role: 'colaborador' },
      ];
      const demoUser = demoUsers.find(u => u.email === email && u.password === password);
      if (!demoUser) return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
      
      const result = await run(
        "INSERT INTO usuarios(email, nome, setor, role) VALUES(?, ?, ?, ?)",
        [demoUser.email, demoUser.nome, demoUser.setor, demoUser.role]
      );
      dbUser = { id: result.lastID, email: demoUser.email, nome: demoUser.nome, setor: demoUser.setor, role: demoUser.role };
    }
    
    // Check password hash if exists
    if (dbUser.senha_hash) {
      const isValid = await bcrypt.compare(password, dbUser.senha_hash);
      if (!isValid) return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
    } else {
      // Demo fallback
      const demoUsers = [
        { email: 'admin@grupocropfield.com.br', password: 'admin123' },
        { email: 'rh@grupocropfield.com.br', password: 'rh123' },
        { email: 'user@grupocropfield.com.br', password: 'user123' },
      ];
      const demoMatch = demoUsers.find(u => u.email === email && u.password === password);
      if (!demoMatch) return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ sub: dbUser.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('sid', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ ok: true, message: 'Login realizado com sucesso',
      user: { id: dbUser.id, email: dbUser.email, nome: dbUser.nome, setor: dbUser.setor, role: dbUser.role || 'colaborador' }});
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
    id: req.user.id, 
    name: req.user.nome, 
    email: req.user.email, 
    sector: req.user.setor, 
    avatar: req.user.foto, 
    role: req.user.role || 'colaborador',
    active: req.user.ativo !== 0
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
// ADMIN ROUTES
// -------------------------------------------------------------

// Users management
app.get('/api/admin/users', authMiddleware, getUserMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const users = await all(`
      SELECT u.id, u.nome, u.email, u.setor, u.role, u.ativo, u.created_at,
             COALESCE(SUM(p.pontos), 0) as total_pontos_mensal
      FROM usuarios u
      LEFT JOIN pontos p ON u.id = p.user_id 
        AND strftime('%Y-%m', p.created_at) = strftime('%Y-%m', 'now')
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json({ ok: true, users });
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ ok: false, error: 'Erro ao buscar usuários' });
  }
});

// Create default admin user if none exists
async function ensureDefaultAdmin() {
  try {
    const adminExists = await get("SELECT id FROM usuarios WHERE role = 'admin' AND ativo = 1 LIMIT 1");
    if (!adminExists) {
      const defaultPassword = 'admin123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      await run(
        "INSERT OR IGNORE INTO usuarios(nome, email, setor, role, senha_hash, ativo) VALUES(?, ?, ?, ?, ?, 1)",
        ['Administrador', 'admin@grupocropfield.com.br', 'TI', 'admin', hashedPassword]
      );
      console.log('Default admin user created: admin@grupocropfield.com.br / admin123');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
    throw error; // Re-throw to prevent server from starting with broken admin setup
  }
}

// -------------------------------------------------------------
// Server initialization
// -------------------------------------------------------------
async function initializeServer() {
  try {
    console.log('Initializing database schema...');
    await createSchema();
    
    console.log('Setting up default admin user...');
    await ensureDefaultAdmin();
    
    console.log('Database initialization complete!');
    
    // Start the server only after successful database initialization
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`Frontend URL: ${FRONTEND_URL}`);
      console.log(`Google OAuth configurado: ${!!GOOGLE_CLIENT_ID}`);
    });
    
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1); // Exit with error code if initialization fails
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

app.post('/api/admin/users', authMiddleware, getUserMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { nome, email, setor, role, senha } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ ok: false, error: 'Nome, email e senha são obrigatórios' });
    }

    // Check if user exists
    const existing = await get("SELECT id FROM usuarios WHERE email = ?", [email]);
    if (existing) {
      return res.status(400).json({ ok: false, error: 'Email já está em uso' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const result = await run(
      "INSERT INTO usuarios(nome, email, setor, role, senha_hash, ativo) VALUES(?, ?, ?, ?, ?, 1)",
      [nome, email, setor || 'Geral', role || 'colaborador', senhaHash]
    );

    res.json({ ok: true, id: result.lastID });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ ok: false, error: 'Erro ao criar usuário' });
  }
});

app.patch('/api/admin/users/:id', authMiddleware, getUserMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { nome, email, setor, role, ativo } = req.body;
    const userId = req.params.id;

    const updates = [];
    const values = [];

    if (nome !== undefined) { updates.push('nome = ?'); values.push(nome); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (setor !== undefined) { updates.push('setor = ?'); values.push(setor); }
    if (role !== undefined) { updates.push('role = ?'); values.push(role); }
    if (ativo !== undefined) { updates.push('ativo = ?'); values.push(ativo); }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'Nenhum campo para atualizar' });
    }

    values.push(userId);
    await run(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ ok: false, error: 'Erro ao atualizar usuário' });
  }
});

app.patch('/api/admin/users/:id/password', authMiddleware, getUserMiddleware, async (req, res) => {
  try {
    const { senha } = req.body;
    const userId = req.params.id;

    if (!senha) {
      return res.status(400).json({ ok: false, error: 'Senha é obrigatória' });
    }

    // Admin can change anyone's password, users can change their own
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ ok: false, error: 'Acesso negado' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    await run("UPDATE usuarios SET senha_hash = ? WHERE id = ?", [senhaHash, userId]);

    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    res.status(500).json({ ok: false, error: 'Erro ao atualizar senha' });
  }
});

app.delete('/api/admin/users/:id', authMiddleware, getUserMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    await run("UPDATE usuarios SET ativo = 0 WHERE id = ?", [userId]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao desativar usuário:', error);
    res.status(500).json({ ok: false, error: 'Erro ao desativar usuário' });
  }
});

// System settings
app.get('/api/admin/config', authMiddleware, getUserMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const settings = await all("SELECT chave, valor FROM system_settings");
    const config = {};
    settings.forEach(s => {
      try {
        config[s.chave] = JSON.parse(s.valor);
      } catch {
        config[s.chave] = s.valor;
      }
    });
    res.json({ ok: true, config });
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ ok: false, error: 'Erro ao buscar configurações' });
  }
});

app.put('/api/admin/config', authMiddleware, getUserMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const config = req.body;
    for (const [chave, valor] of Object.entries(config)) {
      await run(
        "INSERT OR REPLACE INTO system_settings(chave, valor) VALUES(?, ?)",
        [chave, JSON.stringify(valor)]
      );
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    res.status(500).json({ ok: false, error: 'Erro ao salvar configurações' });
  }
});

// Reports/Export endpoints
app.get('/api/admin/export/trocas.csv', authMiddleware, getUserMiddleware, requireRole('admin', 'rh'), async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT t.*, u.nome as usuario_nome, u.email as usuario_email, u.setor as usuario_setor
      FROM trocas_proteina t
      JOIN usuarios u ON t.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (from) { sql += " AND date(t.data) >= date(?)"; params.push(from); }
    if (to) { sql += " AND date(t.data) <= date(?)"; params.push(to); }
    
    sql += " ORDER BY t.data ASC";
    
    const trocas = await all(sql, params);
    
    let csv = 'Data,Dia,Proteina Original,Proteina Nova,Usuario,Email,Setor,Data Criacao\n';
    trocas.forEach(t => {
      csv += `"${t.data}","${t.dia}","${t.proteina_original}","${t.proteina_nova}","${t.usuario_nome}","${t.usuario_email}","${t.usuario_setor}","${t.created_at}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=trocas-${from || 'all'}-${to || 'all'}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar trocas:', error);
    res.status(500).json({ ok: false, error: 'Erro ao exportar trocas' });
  }
});

app.get('/api/admin/export/ranking.csv', authMiddleware, getUserMiddleware, requireRole('admin', 'rh'), async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM
    const yearMonth = month || format(new Date(), 'yyyy-MM');
    
    const ranking = await all(`
      SELECT u.nome, u.email, u.setor, SUM(p.pontos) as total_pontos,
             COUNT(p.id) as total_atividades
      FROM pontos p
      JOIN usuarios u ON p.user_id = u.id
      WHERE strftime('%Y-%m', p.created_at) = ?
      GROUP BY u.id, u.nome, u.email, u.setor
      ORDER BY total_pontos DESC
    `, [yearMonth]);
    
    let csv = 'Posicao,Nome,Email,Setor,Total Pontos,Total Atividades\n';
    ranking.forEach((r, index) => {
      csv += `${index + 1},"${r.nome}","${r.email}","${r.setor}",${r.total_pontos},${r.total_atividades}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=ranking-${yearMonth}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar ranking:', error);
    res.status(500).json({ ok: false, error: 'Erro ao exportar ranking' });
  }
});

app.get('/api/admin/export/portaria.csv', authMiddleware, getUserMiddleware, requireRole('admin', 'rh'), async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT p.*, u.nome as responsavel_nome, u.email as responsavel_email
      FROM portaria_agendamentos p
      LEFT JOIN usuarios u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (from) { sql += " AND date(p.data) >= date(?)"; params.push(from); }
    if (to) { sql += " AND date(p.data) <= date(?)"; params.push(to); }
    
    sql += " ORDER BY p.data DESC";
    
    const agendamentos = await all(sql, params);
    
    let csv = 'Data,Hora,Visitante,Documento,Responsavel,Email Responsavel,Observacao,Data Criacao\n';
    agendamentos.forEach(a => {
      csv += `"${a.data}","${a.hora}","${a.visitante}","${a.documento || ''}","${a.responsavel_nome || ''}","${a.responsavel_email || ''}","${a.observacao || ''}","${a.created_at}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=portaria-${from || 'all'}-${to || 'all'}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar portaria:', error);
    res.status(500).json({ ok: false, error: 'Erro ao exportar portaria' });
  }
});

app.get('/api/admin/export/reservas.csv', authMiddleware, getUserMiddleware, requireRole('admin', 'rh'), async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT r.*, u.nome as responsavel_nome, u.email as responsavel_email
      FROM reservas r
      LEFT JOIN usuarios u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (from) { sql += " AND date(r.data) >= date(?)"; params.push(from); }
    if (to) { sql += " AND date(r.data) <= date(?)"; params.push(to); }
    
    sql += " ORDER BY r.data ASC";
    
    const reservas = await all(sql, params);
    
    let csv = 'Data,Sala,Horario Inicio,Horario Fim,Assunto,Responsavel,Email Responsavel,Data Criacao\n';
    reservas.forEach(r => {
      csv += `"${r.data}","${r.sala}","${r.inicio}","${r.fim}","${r.assunto}","${r.responsavel_nome || ''}","${r.responsavel_email || ''}","${r.created_at}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=reservas-${from || 'all'}-${to || 'all'}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar reservas:', error);
    res.status(500).json({ ok: false, error: 'Erro ao exportar reservas' });
  }
});

// -------------------------------------------------------------
// TI PANEL ROUTES
// -------------------------------------------------------------
app.post('/api/ti/solicitacoes', authMiddleware, getUserMiddleware, async (req, res) => {
  try {
    const { titulo, descricao } = req.body;
    if (!titulo) {
      return res.status(400).json({ ok: false, error: 'Título é obrigatório' });
    }

    const result = await run(
      "INSERT INTO ti_solicitacoes(titulo, descricao, solicitante_id) VALUES(?, ?, ?)",
      [titulo, descricao, req.userId]
    );

    res.json({ ok: true, id: result.lastID });
  } catch (error) {
    console.error('Erro ao criar solicitação TI:', error);
    res.status(500).json({ ok: false, error: 'Erro ao criar solicitação TI' });
  }
});

app.get('/api/ti/solicitacoes', authMiddleware, getUserMiddleware, requireRole('ti', 'admin'), async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT s.*, 
             us.nome as solicitante_nome, us.email as solicitante_email,
             ur.nome as responsavel_nome, ur.email as responsavel_email
      FROM ti_solicitacoes s
      JOIN usuarios us ON s.solicitante_id = us.id
      LEFT JOIN usuarios ur ON s.responsavel_id = ur.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) { sql += " AND s.status = ?"; params.push(status); }
    
    sql += " ORDER BY s.created_at DESC";
    
    const solicitacoes = await all(sql, params);
    res.json({ ok: true, solicitacoes });
  } catch (error) {
    console.error('Erro ao buscar solicitações TI:', error);
    res.status(500).json({ ok: false, error: 'Erro ao buscar solicitações TI' });
  }
});

app.patch('/api/ti/solicitacoes/:id', authMiddleware, getUserMiddleware, requireRole('ti', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const solicitacaoId = req.params.id;

    if (!['pendente', 'aprovado', 'reprovado'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'Status inválido' });
    }

    await run(
      "UPDATE ti_solicitacoes SET status = ?, responsavel_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [status, req.userId, solicitacaoId]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao atualizar solicitação TI:', error);
    res.status(500).json({ ok: false, error: 'Erro ao atualizar solicitação TI' });
  }
});

app.get('/api/ti/minhas', authMiddleware, getUserMiddleware, async (req, res) => {
  try {
    const solicitacoes = await all(`
      SELECT s.*, ur.nome as responsavel_nome
      FROM ti_solicitacoes s
      LEFT JOIN usuarios ur ON s.responsavel_id = ur.id
      WHERE s.solicitante_id = ?
      ORDER BY s.created_at DESC
    `, [req.userId]);
    
    res.json({ ok: true, solicitacoes });
  } catch (error) {
    console.error('Erro ao buscar minhas solicitações:', error);
    res.status(500).json({ ok: false, error: 'Erro ao buscar minhas solicitações' });
  }
});

// -------------------------------------------------------------
// RH PANEL ROUTES (Mural management)
// -------------------------------------------------------------
app.post('/api/rh/mural/posts', authMiddleware, getUserMiddleware, requireRole('rh', 'admin'), async (req, res) => {
  try {
    const { titulo, conteudo, pinned } = req.body;
    if (!titulo || !conteudo) {
      return res.status(400).json({ ok: false, error: 'Título e conteúdo são obrigatórios' });
    }

    const result = await run(
      "INSERT INTO mural_posts(titulo, conteudo, author, pinned) VALUES(?, ?, ?, ?)",
      [titulo, conteudo, req.user.nome, pinned ? 1 : 0]
    );

    res.json({ ok: true, id: result.lastID });
  } catch (error) {
    console.error('Erro ao criar post:', error);
    res.status(500).json({ ok: false, error: 'Erro ao criar post' });
  }
});

app.patch('/api/rh/mural/posts/:id', authMiddleware, getUserMiddleware, requireRole('rh', 'admin'), async (req, res) => {
  try {
    const { titulo, conteudo, pinned } = req.body;
    const postId = req.params.id;

    const updates = [];
    const values = [];

    if (titulo !== undefined) { updates.push('titulo = ?'); values.push(titulo); }
    if (conteudo !== undefined) { updates.push('conteudo = ?'); values.push(conteudo); }
    if (pinned !== undefined) { updates.push('pinned = ?'); values.push(pinned ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'Nenhum campo para atualizar' });
    }

    values.push(postId);
    await run(`UPDATE mural_posts SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao atualizar post:', error);
    res.status(500).json({ ok: false, error: 'Erro ao atualizar post' });
  }
});

app.delete('/api/rh/mural/posts/:id', authMiddleware, getUserMiddleware, requireRole('rh', 'admin'), async (req, res) => {
  try {
    const postId = req.params.id;
    await run("DELETE FROM mural_posts WHERE id = ?", [postId]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao deletar post:', error);
    res.status(500).json({ ok: false, error: 'Erro ao deletar post' });
  }
});

// -------------------------------------------------------------
// CARDAPIO ROUTES
// -------------------------------------------------------------
app.post('/api/admin/cardapio/import', authMiddleware, getUserMiddleware, requireRole('admin', 'rh'), async (req, res) => {
  try {
    const { mes, tipo, dados } = req.body; // mes: 'YYYY-MM', tipo: 'padrao'|'light', dados: CardapioItem[]
    
    if (!mes || !tipo || !dados) {
      return res.status(400).json({ ok: false, error: 'Mês, tipo e dados são obrigatórios' });
    }
    
    if (!['padrao', 'light'].includes(tipo)) {
      return res.status(400).json({ ok: false, error: 'Tipo deve ser padrao ou light' });
    }
    
    // Save to file
    const fileName = `cardapio-${mes.replace('-', '')}-${tipo}.json`;
    const filePath = path.join(__dirname, 'public', 'cardapio', fileName);
    
    // Ensure directory exists
    const cardapioDir = path.join(__dirname, 'public', 'cardapio');
    if (!fs.existsSync(cardapioDir)) {
      fs.mkdirSync(cardapioDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(dados, null, 2), 'utf8');
    
    res.json({ ok: true, message: `Cardápio ${tipo} de ${mes} importado com sucesso`, fileName });
  } catch (error) {
    console.error('Erro ao importar cardápio:', error);
    res.status(500).json({ ok: false, error: 'Erro ao importar cardápio' });
  }
});

app.get('/api/cardapio/:mes/:tipo', async (req, res) => {
  try {
    const { mes, tipo } = req.params;
    const fileName = `cardapio-${mes}-${tipo}.json`;
    const filePath = path.join(__dirname, 'public', 'cardapio', fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'Cardápio não encontrado' });
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json({ ok: true, cardapio: data });
  } catch (error) {
    console.error('Erro ao buscar cardápio:', error);
    res.status(500).json({ ok: false, error: 'Erro ao buscar cardápio' });
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
// Start server initialization
// -------------------------------------------------------------
initializeServer();