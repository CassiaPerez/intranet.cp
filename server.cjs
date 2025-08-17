// ==== server.cjs (completo e corrigido) ====
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3005;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Parsing (uma única vez)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Caminho do banco
const DB_PATH = path.join(__dirname, 'data', 'database.sqlite');
console.log('[SERVER] Database path:', DB_PATH);

// Garante diretório
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('[SERVER] Created data directory:', dataDir);
}

// Se arquivo vazio/corrompido, recria
if (fs.existsSync(DB_PATH)) {
  try {
    const stats = fs.statSync(DB_PATH);
    if (stats.size === 0) {
      console.log('[SERVER] ⚠️ Empty database file detected, removing for re-initialization...');
      fs.unlinkSync(DB_PATH);
    } else {
      console.log('[SERVER] Database file exists:', stats.size, 'bytes');
    }
  } catch (error) {
    console.log('[SERVER] ⚠️ Error checking database file:', error.message);
    // Don't delete on check error - could be temporary permission issue
    console.log('[SERVER] Will attempt to connect anyway...');
  }
} else {
  console.log('[SERVER] Database file does not exist, will be created');
}

// Conexão SQLite
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('[SERVER] ❌ Database connection error:', err.message);
    console.error('[SERVER] ⚠️ Server will continue but database features may not work');
  } else {
    console.log('[SERVER] ✅ Connected to SQLite database');
    // Set SQLite optimizations with error handling
    try {
      db.run('PRAGMA journal_mode=WAL;');
      db.run('PRAGMA foreign_keys = ON;');
      console.log('[DB] ✅ SQLite optimizations applied');
    } catch (e) {
      console.error('[DB] ⚠️ Error setting SQLite options:', e.message);
    }
  }
});

// Helpers Promises
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
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

// Demo users (corrigido: sem forçar id, grava senha e senha_hash)
const createDemoUsers = () => new Promise((resolve) => {
  console.log('[DEMO] 🔄 Creating demo users...');
  
  // Check if database is ready first
  if (!db || db.readyState === 'closed') {
    console.log('[DEMO] ⚠️ Database not ready, skipping demo users');
    return resolve(false);
  }
  
  const users = [
    { username: 'admin',         nome: 'Super Admin',  email: 'superadmin@grupocropfield.com.br', senha: 'admin',    setor: 'TI',    role: 'admin' },
    { username: 'administrador', nome: 'Administrador', email: 'admin@grupocropfield.com.br',     senha: 'admin123', setor: 'TI',    role: 'admin' },
    { username: 'rh',            nome: 'RH Manager',    email: 'rh@grupocropfield.com.br',        senha: 'rh123',    setor: 'RH',    role: 'rh' },
    { username: 'usuario',       nome: 'Usuário Teste', email: 'user@grupocropfield.com.br',      senha: 'user123',  setor: 'Geral', role: 'colaborador' },
    { username: 'user',          nome: 'Usuário',       email: 'user2@grupocropfield.com.br',     senha: 'user',     setor: 'Geral', role: 'colaborador' },
  ];

  let processed = 0;
  const checkAndCreate = (retries = 10) => {
    if (!db || db.readyState === 'closed') {
      console.log('[DEMO] ⚠️ Database closed during demo user creation');
      return resolve(false);
    }
    
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'", async (err, row) => {
      if (err) {
        console.error('[DEMO] ⚠️ Database error checking table:', err.message);
        if (retries > 0) {
          console.log(`[DEMO] 🔄 Retrying in 1s... (${retries} attempts left)`);
          return setTimeout(() => checkAndCreate(retries - 1), 1000);
        }
        console.log('[DEMO] ⚠️ Failed to check database after retries, continuing anyway...');
        return resolve(false);
      }
      if (!row) {
        if (retries > 0) {
          console.log(`[DEMO] ⏳ Table not ready, retrying... (${retries} attempts left)`);
          return setTimeout(() => checkAndCreate(retries - 1), 1000);
        }
        console.log('[DEMO] ⚠️ usuarios table not created after retries');
        return resolve(false);
      }

      console.log('[DEMO] ✅ Database is ready, creating users...');
      users.forEach(async (u) => {
        try {
          const hash = await bcrypt.hash(u.senha, 10);
          await dbRun(
            `INSERT INTO usuarios (username, nome, email, senha_hash, senha, setor, role, ativo)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)
             ON CONFLICT(email) DO UPDATE SET 
               username=excluded.username,
               nome=excluded.nome,
               senha_hash=excluded.senha_hash,
               senha=excluded.senha,
               setor=excluded.setor,
               role=excluded.role,
               ativo=1`,
            [u.username, u.nome, u.email.toLowerCase(), hash, hash, u.setor, u.role]
          );
          console.log(`[DEMO] ✅ User upserted: ${u.username} (${u.nome}) - Role: ${u.role}`);
        } catch (e) {
          console.log(`[DEMO] ⚠️ Error creating user ${u.username}:`, e.message, '(continuing...)');
        } finally {
          processed++;
          if (processed === users.length) {
            try {
              dbAll('SELECT username, nome, role FROM usuarios WHERE ativo = 1')
                .then(rows => { console.log(`[DEMO] ✅ Verification: ${rows.length} active users`); resolve(true); })
                .catch(() => resolve(true));
            } catch (e) {
              console.log('[DEMO] ⚠️ Error in verification, but demo users process complete');
              resolve(true);
            }
          }
        }
      });
    });
  };
  checkAndCreate();
});

// Criação de tabelas + migração defensiva
const initializeDatabase = () => {
  console.log('[DB] Creating tables...');
  
  if (!db || db.readyState === 'closed') {
    console.log('[DB] ⚠️ Database not ready for initialization');
    return;
  }
  
  const tables = [];
  const expectedTables = 8;

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      -- coluna legado 'senha' pode existir em bancos antigos:
      senha TEXT,
      setor TEXT NOT NULL DEFAULT 'Colaborador',
      role TEXT NOT NULL DEFAULT 'colaborador',
      ativo INTEGER DEFAULT 1,
      ativo INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `, (err) => {
    if (err) {
      console.error('[DB] ⚠️ Error creating usuarios table:', err.message);
    }
    else {
      console.log('[DB] ✅ usuarios table ready');
      tables.push('usuarios');
      // Skip migration for now to avoid complexity
      checkAllReady();
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS mural_posts (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      author TEXT NOT NULL,
      user_id TEXT,
      pinned BOOLEAN DEFAULT 0,
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES usuarios(id)
    )
  `, (err) => { if (err) console.error('[DB] ❌ mural_posts:', err.message); else { tables.push('mural_posts'); console.log('[DB] ✅ mural_posts table ready'); checkAllReady(); } });

  db.run(`
    CREATE TABLE IF NOT EXISTS mural_likes (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES mural_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `, (err) => { if (err) console.error('[DB] ❌ mural_likes:', err.message); else { tables.push('mural_likes'); console.log('[DB] ✅ mural_likes table ready'); checkAllReady(); } });

  db.run(`
    CREATE TABLE IF NOT EXISTS mural_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      texto TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES mural_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `, (err) => { if (err) console.error('[DB] ❌ mural_comments:', err.message); else { tables.push('mural_comments'); console.log('[DB] ✅ mural_comments table ready'); checkAllReady(); } });

  db.run(`
    CREATE TABLE IF NOT EXISTS reservas (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sala TEXT NOT NULL,
      data DATE NOT NULL,
      inicio TIME NOT NULL,
      fim TIME NOT NULL,
      assunto TEXT NOT NULL,
      responsavel TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `, (err) => { if (err) console.error('[DB] ❌ reservas:', err.message); else { tables.push('reservas'); console.log('[DB] ✅ reservas table ready'); checkAllReady(); } });

  db.run(`
    CREATE TABLE IF NOT EXISTS ti_solicitacoes (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      descricao TEXT,
      prioridade TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pendente',
      user_email TEXT NOT NULL,
      user_nome TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => { if (err) console.error('[DB] ❌ ti_solicitacoes:', err.message); else { tables.push('ti_solicitacoes'); console.log('[DB] ✅ ti_solicitacoes table ready'); checkAllReady(); } });

  db.run(`
    CREATE TABLE IF NOT EXISTS trocas_proteina (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      data TEXT NOT NULL,
      proteina_original TEXT,
      proteina_nova TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_email, data)
    )
  `, (err) => { if (err) console.error('[DB] ❌ trocas_proteina:', err.message); else { tables.push('trocas_proteina'); console.log('[DB] ✅ trocas_proteina table ready'); checkAllReady(); } });

  db.run(`
    CREATE TABLE IF NOT EXISTS portaria_agendamentos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data DATE NOT NULL,
      hora TIME NOT NULL,
      visitante TEXT NOT NULL,
      documento TEXT,
      observacao TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES usuarios(id)
    )
  `, (err) => { if (err) console.error('[DB] ❌ portaria_agendamentos:', err.message); else { tables.push('portaria_agendamentos'); console.log('[DB] ✅ portaria_agendamentos table ready'); checkAllReady(); } });

  const checkAllReady = () => {
    if (tables.length === expectedTables) {
      console.log('[DB] ✅ All tables created, initializing demo users...');
      // Use setTimeout to avoid blocking the main thread
      setTimeout(() => {
        createDemoUsers().then((ok) => {
          if (ok) console.log('[DB] ✅ Database initialization complete');
          else console.log('[DB] ⚠️ Demo users creation had issues (non-critical)');
        }).catch((e) => {
          console.log('[DB] ⚠️ Demo users creation failed (non-critical):', e.message);
        });
      }, 2000);
    }
  };

  console.log('[SERVER] Database tables setup initiated');
};

// Initialize database with timeout to prevent blocking
setTimeout(() => {
  try { 
    initializeDatabase(); 
  } catch (error) { 
    console.error('[DB] ⚠️ Error during database initialization:', error.message); 
  }
}, 1000);

// Middleware
app.use(morgan('combined'));
app.use(cookieParser());

// CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

/* ===== Auth ===== */
const requireAuth = (req, res, next) => {
  console.log('[AUTH] 🔐 Checking authentication...');
  const token = req.cookies.sid || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ ok: false, error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[AUTH] ✅ Token valid for user:', decoded.email);
    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    console.log('[AUTH] ❌ Token verification failed:', error.message);
    res.clearCookie('sid');
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  console.log('[RBAC] 🔑 Checking roles:', roles, 'User:', req.user?.email, 'Role:', req.user?.role, 'Sector:', req.user?.setor);
  if (!req.user) return res.status(401).json({ ok: false, error: 'Authentication required' });

  const userRole = req.user.role || 'colaborador';
  const userSetor = (req.user.setor || req.user.sector || '').toUpperCase();
  const userEmail = req.user.email || '';

  if (userRole === 'admin') return next();
  if (roles.includes(userRole)) return next();
  if (roles.includes('rh') && userSetor === 'RH') return next();
  if (roles.includes('ti') && userSetor === 'TI') return next();
  if (userEmail === 'admin@grupocropfield.com.br' || userEmail === 'superadmin@grupocropfield.com.br') return next();

  return res.status(403).json({ ok: false, error: 'Insufficient permissions' });
};

// LOGIN (usa senha_hash; fallback pra 'senha' legado)
app.post('/auth/login', (req, res) => {
  console.log('[LOGIN] Login attempt:', req.body.username || req.body.email);
  const { username, email, password } = req.body;
  const loginField = username || email;
  if (!loginField || !password) return res.status(400).json({ ok: false, error: 'Username e senha são obrigatórios' });

  db.get('SELECT * FROM usuarios WHERE (username = ? OR email = ?) AND ativo = 1',
    [loginField, loginField],
    (err, user) => {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      if (!user) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

      const hash = user.senha_hash || user.senha; // compat com bancos antigos
      if (!hash) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

      bcrypt.compare(password, hash, (bcryptErr, isValid) => {
        if (bcryptErr) return res.status(500).json({ ok: false, error: 'Password verification error' });
        if (!isValid) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

        const token = jwt.sign(
          {
            id: user.id,
            username: user.username,
            name: user.nome,
            email: user.email,
            setor: user.setor,
            sector: user.setor,
            role: user.role
          },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.cookie('sid', token, {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
          ok: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.nome,
            email: user.email,
            sector: user.setor,
            setor: user.setor,
            role: user.role,
            avatar: user.avatar_url
          },
          token
        });
      });
    });
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('sid');
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user, token: req.token });
});

// Debug env (sem auth)
app.get('/api/mural/debug/env', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM mural_posts WHERE ativo = 1', (err, result) => {
    res.json({
      port: PORT,
      database_path: DB_PATH,
      total_posts: result?.count || 0,
      demo_mode: true,
      user_id: req.user?.id || null,
      timestamp: new Date().toISOString()
    });
  });
});

app.get('/api/debug/auth', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user, timestamp: new Date().toISOString() });
});

/* ===== Mural ===== */
app.get('/api/mural/posts', (req, res) => {
  db.all(
    `SELECT 
      id, titulo, conteudo, author, pinned, created_at,
      (SELECT COUNT(*) FROM mural_likes WHERE post_id = mural_posts.id) as likes_count,
      (SELECT COUNT(*) FROM mural_comments WHERE post_id = mural_posts.id) as comments_count
     FROM mural_posts 
     WHERE ativo = 1 
     ORDER BY pinned DESC, created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      res.json({ ok: true, posts: rows || [] });
    }
  );
});

app.get('/api/mural', (req, res) => {
  req.url = '/api/mural/posts';
  app._router.handle(req, res);
});

app.post('/api/rh/mural/posts', requireAuth, requireRole('rh', 'admin'), (req, res) => {
  const { titulo, conteudo, pinned } = req.body;
  if (!titulo?.trim() || !conteudo?.trim()) return res.status(400).json({ ok: false, error: 'Título e conteúdo são obrigatórios' });

  const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.run(
    `INSERT INTO mural_posts (id, titulo, conteudo, author, user_id, pinned) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [postId, titulo.trim(), conteudo.trim(), req.user.name, req.user.id, pinned ? 1 : 0],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      res.json({ ok: true, id: postId, points: 15, message: 'Post criado com sucesso' });
    }
  );
});

app.post('/api/mural/posts', requireAuth, requireRole('rh', 'admin', 'ti'), (req, res) => {
  const { titulo, conteudo, pinned } = req.body;
  if (!titulo?.trim() || !conteudo?.trim()) return res.status(400).json({ ok: false, error: 'Título e conteúdo são obrigatórios' });

  const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.run(
    `INSERT INTO mural_posts (id, titulo, conteudo, author, user_id, pinned) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [postId, titulo.trim(), conteudo.trim(), req.user.name, req.user.id, pinned ? 1 : 0],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      res.json({ ok: true, id: postId, points: 15, message: 'Post criado com sucesso' });
    }
  );
});

app.patch('/api/mural/posts/:id', requireAuth, requireRole('rh', 'admin'), (req, res) => {
  const { titulo, conteudo, pinned } = req.body;
  const postId = req.params.id;
  if (!titulo?.trim() || !conteudo?.trim()) return res.status(400).json({ ok: false, error: 'Título e conteúdo são obrigatórios' });

  db.run(
    `UPDATE mural_posts 
     SET titulo = ?, conteudo = ?, pinned = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND ativo = 1`,
    [titulo.trim(), conteudo.trim(), pinned ? 1 : 0, postId],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Post not found' });
      res.json({ ok: true, message: 'Post atualizado com sucesso' });
    }
  );
});

app.delete('/api/mural/posts/:id', requireAuth, requireRole('rh', 'admin'), (req, res) => {
  const postId = req.params.id;
  db.run(
    'UPDATE mural_posts SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [postId],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Post not found' });
      res.json({ ok: true, message: 'Post deletado com sucesso' });
    }
  );
});

app.post('/api/mural/:id/like', requireAuth, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const likeId = `like_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  db.get('SELECT id FROM mural_likes WHERE post_id = ? AND user_id = ?', [postId, userId],
    (err, existingLike) => {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });

      if (existingLike) {
        db.run('DELETE FROM mural_likes WHERE post_id = ? AND user_id = ?', [postId, userId],
          function (err) {
            if (err) return res.status(500).json({ ok: false, error: 'Database error' });
            res.json({ ok: true, action: 'unliked', message: 'Like removido' });
          });
      } else {
        db.run('INSERT INTO mural_likes (id, post_id, user_id) VALUES (?, ?, ?)',
          [likeId, postId, userId],
          function (err) {
            if (err) return res.status(500).json({ ok: false, error: 'Database error' });
            res.json({ ok: true, action: 'liked', points: 2, message: 'Like adicionado' });
          });
      }
    });
});

app.post('/api/mural/:id/comments', requireAuth, (req, res) => {
  const { texto } = req.body;
  const postId = req.params.id;
  const userId = req.user.id;
  const commentId = `comment_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  if (!texto?.trim()) return res.status(400).json({ ok: false, error: 'Texto do comentário é obrigatório' });

  db.run('INSERT INTO mural_comments (id, post_id, user_id, texto) VALUES (?, ?, ?, ?)',
    [commentId, postId, userId, texto.trim()],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      res.json({ ok: true, id: commentId, points: 3, message: 'Comentário adicionado com sucesso' });
    });
});

/* ===== Reservas ===== */
app.get('/api/reservas', requireAuth, (req, res) => {
  db.all('SELECT * FROM reservas ORDER BY data, inicio', (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: 'Database error' });
    res.json({ ok: true, reservas: rows || [] });
  });
});

app.post('/api/reservas', requireAuth, (req, res) => {
  const { sala, data, inicio, fim, assunto } = req.body;
  const userId = req.user.id;
  const userName = req.user.name;
  if (!sala || !data || !inicio || !fim || !assunto) return res.status(400).json({ ok: false, error: 'Todos os campos são obrigatórios' });

  const reservaId = `reserva_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.run(
    `INSERT INTO reservas (id, user_id, sala, data, inicio, fim, assunto, responsavel) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [reservaId, userId, sala, data, inicio, fim, assunto, userName],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      res.json({ ok: true, id: reservaId, points: 10, message: 'Reserva criada com sucesso' });
    }
  );
});

/* ===== TI - Equipamentos ===== */
app.get('/api/ti/solicitacoes', requireAuth, (req, res) => {
  const userEmail = req.user.email;
  const userSetor = req.user.setor || req.user.sector || '';
  const userRole = req.user.role || 'colaborador';
  const canSeeAll = userRole === 'admin' || (userSetor || '').toUpperCase() === 'TI';

  let query = 'SELECT * FROM ti_solicitacoes ORDER BY created_at DESC';
  let params = [];
  if (!canSeeAll) { query = 'SELECT * FROM ti_solicitacoes WHERE user_email = ? ORDER BY created_at DESC'; params = [userEmail]; }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: 'Database error' });
    res.json({ ok: true, solicitacoes: rows || [] });
  });
});

app.get('/api/ti/minhas', requireAuth, (req, res) => {
  const userEmail = req.user?.email;
  if (!userEmail) return res.status(400).json({ ok: false, error: 'User email not available' });

  db.all('SELECT * FROM ti_solicitacoes WHERE user_email = ? ORDER BY created_at DESC',
    [userEmail],
    (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      res.json({ ok: true, solicitacoes: rows || [] });
    });
});

app.post('/api/ti/solicitacoes', requireAuth, (req, res) => {
  const { titulo, descricao, prioridade } = req.body;
  const userEmail = req.user.email;
  const userName = req.user.name;
  if (!titulo?.trim()) return res.status(400).json({ ok: false, error: 'Título é obrigatório' });

  const requestId = `ti_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.run(
    `INSERT INTO ti_solicitacoes (id, titulo, descricao, prioridade, user_email, user_nome) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [requestId, titulo.trim(), descricao || '', prioridade || 'medium', userEmail, userName],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      res.json({ ok: true, id: requestId, points: 4, message: 'Solicitação criada com sucesso' });
    }
  );
});

app.patch('/api/ti/solicitacoes/:id', requireAuth, requireRole('ti', 'admin'), (req, res) => {
  const { status } = req.body;
  const requestId = req.params.id;
  if (!status) return res.status(400).json({ ok: false, error: 'Status é obrigatório' });

  db.run('UPDATE ti_solicitacoes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, requestId],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Solicitação não encontrada' });
      res.json({ ok: true, message: 'Status atualizado com sucesso' });
    });
});

/* ===== Trocas de proteína ===== */
app.get('/api/trocas-proteina', requireAuth, (req, res) => {
  const { from, to } = req.query;
  const userEmail = req.user.email;

  let query = 'SELECT * FROM trocas_proteina WHERE user_email = ?';
  const params = [userEmail];
  if (from && to) { query += ' AND data BETWEEN ? AND ?'; params.push(from, to); }
  query += ' ORDER BY data';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: 'Database error' });
    res.json({ ok: true, trocas: rows || [] });
  });
});

const isWithinExchangeDeadline = (exchangeDate) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoffTime = new Date(today);
  cutoffTime.setHours(16, 0, 0, 0);

  const targetDate = new Date(exchangeDate);
  const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  const minExchangeDate = new Date(today);
  if (now >= cutoffTime) minExchangeDate.setDate(today.getDate() + 2);
  else minExchangeDate.setDate(today.getDate() + 1);

  return targetDateOnly >= minExchangeDate;
};

app.post('/api/trocas-proteina/bulk', requireAuth, (req, res) => {
  const { trocas } = req.body;
  const userEmail = req.user.email;
  if (!Array.isArray(trocas) || trocas.length === 0) return res.status(400).json({ ok: false, error: 'Nenhuma troca fornecida' });

  const invalidExchanges = trocas.filter(t => !isWithinExchangeDeadline(t.data));
  if (invalidExchanges.length > 0) {
    const now = new Date();
    const cutoffTime = new Date(); cutoffTime.setHours(16, 0, 0, 0);
    const isPastCutoff = now >= cutoffTime;
    const invalidDates = invalidExchanges.map(t => new Date(t.data).toLocaleDateString('pt-BR')).join(', ');
    const deadline = isPastCutoff
      ? 'após 16h - só é possível trocar proteínas para depois de amanhã'
      : 'antes das 16h - só é possível trocar proteínas para amanhã em diante';
    return res.status(400).json({
      ok: false,
      error: `Prazo expirado para as datas: ${invalidDates}. Hoje é ${deadline}.`,
      invalidDates: invalidExchanges.map(t => t.data)
    });
  }

  let inseridas = 0;
  let processed = 0;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO trocas_proteina (id, user_email, data, proteina_original, proteina_nova)
    VALUES (?, ?, ?, ?, ?)
  `);

  trocas.forEach((troca) => {
    const trocaId = `troca_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    stmt.run([trocaId, userEmail, troca.data, troca.proteina_original, troca.proteina_nova], function (err) {
      if (!err) inseridas++;
      processed++;
      if (processed === trocas.length) {
        stmt.finalize();
        const totalPoints = inseridas * 5;
        res.json({ ok: true, inseridas, totalPoints, message: `${inseridas} trocas salvas com sucesso` });
      }
    });
  });
});

/* ===== Portaria ===== */
app.get('/api/portaria/agendamentos', requireAuth, (req, res) => {
  db.all('SELECT * FROM portaria_agendamentos ORDER BY data, hora', (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: 'Database error' });
    res.json({ ok: true, agendamentos: rows || [] });
  });
});

app.post('/api/portaria/agendamentos', requireAuth, (req, res) => {
  const { data, hora, visitante, documento, observacao } = req.body;
  const userId = req.user.id;
  if (!data || !hora || !visitante) return res.status(400).json({ ok: false, error: 'Data, hora e visitante são obrigatórios' });

  const agendamentoId = `agenda_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.run(
    `INSERT INTO portaria_agendamentos (id, user_id, data, hora, visitante, documento, observacao) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [agendamentoId, userId, data, hora, visitante, documento || '', observacao || ''],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      res.json({ ok: true, id: agendamentoId, points: 6, message: 'Agendamento criado com sucesso' });
    }
  );
});

/* ===== Admin ===== */
app.get('/api/admin/users', requireAuth, requireRole('admin', 'rh'), (req, res) => {
  db.all('SELECT id, nome, email, setor, role, ativo, created_at FROM usuarios ORDER BY nome',
    (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      res.json({ ok: true, users: rows || [] });
    });
});

app.post('/api/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  console.log('[ADMIN-POST-USER] 👤 Creating user:', req.body?.email || 'no email');
  const { nome, email, senha, password, setor, role } = req.body;
  const senhaFinal = senha || password;
  
  // Normalize and validate input
  const emailNormalizado = email?.trim().toLowerCase() || '';
  const nomeNormalizado = nome?.trim() || '';
  const setorNormalizado = setor?.trim() || 'Colaborador';
  const roleNormalizado = role?.trim() || 'colaborador';

  // Validation
  const setoresValidos = ['TI', 'RH', 'Colaborador', 'Geral'];
  const rolesValidos = ['admin', 'rh', 'colaborador'];

  if (!nomeNormalizado || !emailNormalizado || !senhaFinal) {
    console.log('[ADMIN-POST-USER] ❌ Missing required fields');
    return res.status(400).json({ ok: false, error: 'Nome, email e senha são obrigatórios' });
  }
  if (senhaFinal.length < 6) {
    console.log('[ADMIN-POST-USER] ❌ Password too short');
    return res.status(400).json({ ok: false, error: 'Senha deve ter pelo menos 6 caracteres' });
  }
  if (!setoresValidos.includes(setorNormalizado)) {
    console.log('[ADMIN-POST-USER] ❌ Invalid sector:', setorNormalizado);
    return res.status(400).json({ ok: false, error: 'Setor inválido' });
  }
  if (!rolesValidos.includes(roleNormalizado)) {
    console.log('[ADMIN-POST-USER] ❌ Invalid role:', roleNormalizado);
    return res.status(400).json({ ok: false, error: 'Role inválido' });
  }

  (async () => {
    try {
      console.log('[ADMIN-POST-USER] 🔍 Checking if email exists:', emailNormalizado);
      const exists = await dbGet('SELECT id FROM usuarios WHERE email=?', [emailNormalizado]);
      if (exists) {
        console.log('[ADMIN-POST-USER] ❌ Email already exists');
        return res.status(409).json({ ok: false, error: 'E-mail já cadastrado' });
      }

      console.log('[ADMIN-POST-USER] 🔐 Hashing password...');
      const hashed = await bcrypt.hash(senhaFinal, 10);
      
      console.log('[ADMIN-POST-USER] 💾 Inserting user into database...');
      const result = await dbRun(
        `INSERT INTO usuarios (nome, email, senha_hash, setor, role, ativo)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [nomeNormalizado, emailNormalizado, hashed, setorNormalizado, roleNormalizado]
      );

      console.log('[ADMIN-POST-USER] ✅ User created successfully with ID:', result.lastID);
      
      res.status(201).json({
        ok: true,
        id: result.lastID,
        nome: nomeNormalizado,
        email: emailNormalizado,
        setor: setorNormalizado,
        role: roleNormalizado,
        ativo: true,
        created_at: new Date().toISOString(),
        message: 'Usuário criado com sucesso'
      });
    } catch (error) {
      console.error('[ADMIN-POST-USER] ❌ Error:', error.message);
      console.error('[ADMIN-POST-USER] ❌ Stack:', error.stack);
      
      if (String(error.message).includes('UNIQUE constraint failed')) {
        return res.status(409).json({ ok: false, error: 'E-mail já cadastrado' });
      }
      
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Erro interno ao criar usuário' });
      }
    }
  })();
});

app.patch('/api/admin/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const { nome, email, setor, role, ativo } = req.body;
  const userId = req.params.id;

  const updates = [];
  const values = [];
  if (nome !== undefined) { updates.push('nome = ?'); values.push(nome); }
  if (email !== undefined) { updates.push('email = ?'); values.push(email); }
  if (setor !== undefined) { updates.push('setor = ?'); values.push(setor); }
  if (role !== undefined) { updates.push('role = ?'); values.push(role); }
  if (ativo !== undefined) { updates.push('ativo = ?'); values.push(ativo ? 1 : 0); }

  if (updates.length === 0) return res.status(400).json({ ok: false, error: 'Nenhum campo para atualizar' });

  values.push(userId);
  db.run(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, values, function (err) {
    if (err) return res.status(500).json({ ok: false, error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Usuário não encontrado' });
    res.json({ ok: true, message: 'Usuário atualizado com sucesso' });
  });
});

app.patch('/api/admin/users/:id/password', requireAuth, requireRole('admin'), (req, res) => {
  console.log('[ADMIN-RESET-PASSWORD] Resetting password for user:', req.params.id);
  const { senha } = req.body;
  const userId = req.params.id;
  if (!senha || String(senha).length < 6)
    return res.status(400).json({ ok: false, error: 'Nova senha é obrigatória (mín. 6 caracteres)' });

  const hashedPassword = bcrypt.hashSync(senha, 10);
  db.run('UPDATE usuarios SET senha_hash = ?, senha = ? WHERE id = ?', [hashedPassword, hashedPassword, userId],
    function (err) {
      if (err) return res.status(500).json({ ok: false, error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Usuário não encontrado' });
      res.json({ ok: true, message: 'Senha alterada com sucesso' });
    });
});

/* ===== Relatórios ===== */
app.get('/api/relatorios', requireAuth, requireRole('admin', 'rh'), (req, res) => {
  const queries = [
    { name: 'usuarios', sql: 'SELECT COUNT(*) as count FROM usuarios WHERE ativo = 1' },
    { name: 'mural_posts', sql: 'SELECT COUNT(*) as count FROM mural_posts WHERE ativo = 1' },
    { name: 'reservas', sql: 'SELECT COUNT(*) as count FROM reservas' },
    { name: 'ti_solicitacoes', sql: 'SELECT COUNT(*) as count FROM ti_solicitacoes' },
    { name: 'trocas_proteina', sql: 'SELECT COUNT(*) as count FROM trocas_proteina' },
    { name: 'portaria_agendamentos', sql: 'SELECT COUNT(*) as count FROM portaria_agendamentos' },
  ];
  const results = {};
  let completed = 0;

  queries.forEach(q => {
    db.get(q.sql, (err, row) => {
      results[q.name] = err ? 0 : (row?.count || 0);
      completed++;
      if (completed === queries.length) {
        res.json({
          ok: true,
          relatorios: {
            usuarios_ativos: results.usuarios,
            posts_mural: results.mural_posts,
            reservas_salas: results.reservas,
            solicitacoes_ti: results.ti_solicitacoes,
            trocas_proteina: results.trocas_proteina,
            agendamentos_portaria: results.portaria_agendamentos,
            timestamp: new Date().toISOString()
          }
        });
      }
    });
  });
});

app.get('/api/admin/reports', requireAuth, requireRole('admin', 'rh'), (req, res) => {
  req.url = '/api/relatorios';
  app._router.handle(req, res);
});

/* ===== Debug helpers ===== */
app.post('/api/debug/recreate-users', (req, res) => {
  console.log('[DEBUG] Force recreating demo users...');
  createDemoUsers().then(() => {
    db.all('SELECT email, nome, role, setor FROM usuarios WHERE ativo = 1', (err, users) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ message: 'Demo users recreated', users: users || [], count: users?.length || 0 });
    });
  }).catch((error) => {
    console.error('[DEBUG] Error recreating users:', error);
    res.status(500).json({ error: 'Failed to recreate users' });
  });
});

app.get('/api/debug/users', (req, res) => {
  db.all('SELECT id, nome, email, setor, role, ativo, created_at FROM usuarios', (err, users) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({
      users: users || [],
      count: users?.length || 0,
      database_path: DB_PATH,
      recreate_url: '/api/debug/recreate-users'
    });
  });
});

/* ===== 404 e erro global ===== */
app.use((req, res) => {
  console.log('[SERVER] 404 - Route not found:', req.method, req.url);
  res.status(404).json({ ok: false, error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('[ERROR] ❌ Unhandled error in route:', err.message);
  console.error('[ERROR] Stack:', err.stack);
  if (!res.headersSent) res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
});

/* ===== Start ===== */
const server = app.listen(PORT, () => {
  console.log(`[SERVER] 🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`[SERVER] 🎯 Ready to receive API requests`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[SERVER] ❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('[SERVER] ⚠️ Server error:', error.message);
  }
});

server.on('close', () => console.log('[SERVER] Server closed'));

// Process error handlers (log only, don't crash)
process.on('unhandledRejection', (reason, promise) => {
  console.log('[unhandledRejection] ⚠️ Promise rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.log('[uncaughtException] ⚠️ Exception:', error.message);
});

