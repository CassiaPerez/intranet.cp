// server.cjs (corrigido)
// -------------------------------------------------------------
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

// Database path setup
const DB_PATH = path.join(__dirname, 'data', 'database.sqlite');
console.log('[SERVER] Database path:', DB_PATH);

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('[SERVER] Created data directory:', dataDir);
}

// Check if database file exists but is empty/corrupted - force re-initialization
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
    console.log('[SERVER] ⚠️ Error checking database file, removing for re-initialization...', error.message);
    try {
      fs.unlinkSync(DB_PATH);
    } catch (deleteError) {
      console.error('[SERVER] ❌ Failed to delete corrupted database:', deleteError.message);
    }
  }
} else {
  console.log('[SERVER] Database file does not exist, will be created');
}

// Add process error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('[SERVER] ❌ Uncaught Exception:', error.message);
  console.error('[SERVER] Stack:', error.stack);
  // IMPORTANTE: não encerrar o processo automaticamente
  // (em produção, um process manager como pm2/systemd reinicia se necessário)
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] ❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // IMPORTANTE: não encerrar o processo automaticamente
});

// Database setup
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('[SERVER] ❌ Database connection error:', err.message);
    console.error('[SERVER] Database path:', DB_PATH);
    console.error('[SERVER] ❌ Database connection failed, exiting...');
    process.exit(1);
  } else {
    console.log('[SERVER] ✅ Connected to SQLite database');
  }
});

// Function to create demo users
const createDemoUsers = () => {
  return new Promise((resolve) => {
    console.log('[DEMO] 🔄 Creating demo users...');
    
    const users = [
      { id: 'super-admin', username: 'admin', nome: 'Super Admin', email: 'superadmin@grupocropfield.com.br', senha: 'admin', setor: 'TI', role: 'admin' },
      { id: 'admin-1', username: 'administrador', nome: 'Administrador', email: 'admin@grupocropfield.com.br', senha: 'admin123', setor: 'TI', role: 'admin' },
      { id: 'rh-1', username: 'rh', nome: 'RH Manager', email: 'rh@grupocropfield.com.br', senha: 'rh123', setor: 'RH', role: 'rh' },
      { id: 'user-1', username: 'usuario', nome: 'Usuário Teste', email: 'user@grupocropfield.com.br', senha: 'user123', setor: 'Geral', role: 'colaborador' },
      { id: 'user-2', username: 'user', nome: 'Usuário', email: 'user2@grupocropfield.com.br', senha: 'user', setor: 'Geral', role: 'colaborador' },
    ];
    
    let processed = 0;
    
    const checkAndCreateUsers = (retries = 10) => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'", (err, row) => {
        if (err) {
          console.error('[DEMO] ❌ Database error:', err.message);
          if (retries > 0) {
            console.log(`[DEMO] ⏳ Retrying in 1 second... (${retries} retries left)`);
            setTimeout(() => checkAndCreateUsers(retries - 1), 1000);
          } else {
            console.error('[DEMO] ❌ Failed to initialize users after retries');
            resolve(false);
          }
          return;
        }
        
        if (!row) {
          if (retries > 0) {
            console.log(`[DEMO] ⏳ Table not ready, waiting... (${retries} retries left)`);
            setTimeout(() => checkAndCreateUsers(retries - 1), 1000);
          } else {
            console.error('[DEMO] ❌ usuarios table not created after retries');
            resolve(false);
          }
          return;
        }
        
        console.log('[DEMO] ✅ Database is ready, creating users...');
        
        users.forEach((user) => {
          const hashedPassword = bcrypt.hashSync(user.senha, 10);
          
          db.run(
            `INSERT OR REPLACE INTO usuarios (id, username, nome, email, senha, setor, role, ativo)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [user.id, user.username, user.nome, user.email, hashedPassword, user.setor, user.role],
            function(err) {
              if (err) {
                console.error(`[DEMO] ❌ Error creating user ${user.username}:`, err.message);
              } else {
                console.log(`[DEMO] ✅ User created: ${user.username} (${user.nome}) - Role: ${user.role}`);
              }
              
              processed++;
              if (processed === users.length) {
                console.log('[DEMO] All demo users processed');
                
                db.all('SELECT username, nome, role FROM usuarios WHERE ativo = 1', (verifyErr, rows) => {
                  if (!verifyErr && rows) {
                    console.log(`[DEMO] ✅ Verification: ${rows.length} active users in database`);
                  }
                  resolve(true);
                });
              }
            }
          );
        });
      });
    };
    
    checkAndCreateUsers();
  });
};

// Create tables if they don't exist
const initializeDatabase = () => {
  console.log('[DB] Creating tables...');
  
  const tables = [];
  let expectedTables = 8; // Total number of tables
  
  const checkAllTablesReady = () => {
    if (tables.length === expectedTables) {
      console.log('[DB] ✅ All tables created, initializing demo users...');
      createDemoUsers().then((success) => {
        if (success) {
          console.log('[DB] ✅ Database initialization complete');
        } else {
          console.error('[DB] ❌ Failed to initialize demo users');
        }
      });
    }
  };

  // Users
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      email TEXT UNIQUE,
      senha TEXT NOT NULL,
      setor TEXT DEFAULT 'Geral',
      role TEXT DEFAULT 'colaborador',
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('[DB] ❌ Error creating usuarios table:', err.message);
    else { console.log('[DB] ✅ usuarios table ready'); tables.push('usuarios'); checkAllTablesReady(); }
  });

  // Mural posts
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
  `, (err) => {
    if (err) console.error('[DB] ❌ Error creating mural_posts table:', err.message);
    else { console.log('[DB] ✅ mural_posts table ready'); tables.push('mural_posts'); checkAllTablesReady(); }
  });

  // Mural likes
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
  `, (err) => {
    if (err) console.error('[DB] ❌ Error creating mural_likes table:', err.message);
    else { console.log('[DB] ✅ mural_likes table ready'); tables.push('mural_likes'); checkAllTablesReady(); }
  });

  // Mural comments
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
  `, (err) => {
    if (err) console.error('[DB] ❌ Error creating mural_comments table:', err.message);
    else { console.log('[DB] ✅ mural_comments table ready'); tables.push('mural_comments'); checkAllTablesReady(); }
  });

  // Reservas
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
  `, (err) => {
    if (err) console.error('[DB] ❌ Error creating reservas table:', err.message);
    else { console.log('[DB] ✅ reservas table ready'); tables.push('reservas'); checkAllTablesReady(); }
  });

  // TI Solicitações
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
  `, (err) => {
    if (err) console.error('[DB] ❌ Error creating ti_solicitacoes table:', err.message);
    else { console.log('[DB] ✅ ti_solicitacoes table ready'); tables.push('ti_solicitacoes'); checkAllTablesReady(); }
  });

  // Trocas proteína
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
  `, (err) => {
    if (err) console.error('[DB] ❌ Error creating trocas_proteina table:', err.message);
    else { console.log('[DB] ✅ trocas_proteina table ready'); tables.push('trocas_proteina'); checkAllTablesReady(); }
  });

  // Portaria agendamentos
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
  `, (err) => {
    if (err) console.error('[DB] ❌ Error creating portaria_agendamentos table:', err.message);
    else { console.log('[DB] ✅ portaria_agendamentos table ready'); tables.push('portaria_agendamentos'); checkAllTablesReady(); }
  });
  
  console.log('[SERVER] Database tables setup initiated');
};

// Initialize database in a safe way
db.serialize(() => {
  try {
    initializeDatabase();
  } catch (error) {
    console.error('[DB] ❌ Error during database initialization:', error.message);
  }
});

// Middleware
app.use(morgan('combined'));
app.use(express.json());
app.use(cookieParser());

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Auth middleware
const requireAuth = (req, res, next) => {
  console.log('[AUTH] 🔐 Checking authentication...');
  const token = req.cookies.sid || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    console.log('[AUTH] ❌ No token found');
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[AUTH] ✅ Token valid for user:', decoded.email);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('[AUTH] ❌ Token verification failed:', error.message);
    res.clearCookie('sid');
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
};

// RBAC
const requireRole = (...roles) => {
  return (req, res, next) => {
    console.log('[RBAC] 🔑 Checking roles:', roles, 'User:', req.user?.email, 'Role:', req.user?.role, 'Sector:', req.user?.setor);
    if (!req.user) return res.status(401).json({ ok: false, error: 'Authentication required' });
    const userRole = req.user.role || 'colaborador';
    const userSetor = req.user.setor || req.user.sector || '';
    const userEmail = req.user.email || '';
    if (userRole === 'admin') return next();
    if (roles.includes(userRole)) return next();
    if (roles.includes('rh') && userSetor.toUpperCase() === 'RH') return next();
    if (roles.includes('ti') && userSetor.toUpperCase() === 'TI') return next();
    if (userEmail === 'admin@grupocropfield.com.br' || userEmail === 'superadmin@grupocropfield.com.br') return next();
    return res.status(403).json({ ok: false, error: 'Insufficient permissions' });
  };
};

// Auth routes
app.post('/auth/login', (req, res) => {
  console.log('[LOGIN] Login attempt:', req.body.username || req.body.email);
  const { username, email, password } = req.body;
  const loginField = username || email; // username tem prioridade
  if (!loginField || !password) {
    console.log('[LOGIN] Missing username/email or password');
    return res.status(400).json({ ok: false, error: 'Username e senha são obrigatórios' });
  }
  try {
    console.log('[LOGIN] Querying database for user:', loginField);
    db.get(
      'SELECT * FROM usuarios WHERE (username = ? OR email = ?) AND ativo = 1',
      [loginField, loginField],
      (err, user) => {
        if (err) {
          console.error('[LOGIN] Database error:', err);
          return res.status(500).json({ ok: false, error: 'Database error' });
        }
        if (!user) {
          console.log('[LOGIN] User not found:', loginField);
          db.all('SELECT username, email, nome, role FROM usuarios WHERE ativo = 1', (debugErr, debugUsers) => {
            if (!debugErr) console.log('[LOGIN] Available users:', debugUsers);
          });
          return res.status(401).json({ ok: false, error: 'Invalid credentials' });
        }
        console.log('[LOGIN] User found:', user.username, 'Email:', user.email, 'Role:', user.role, 'Setor:', user.setor);
        console.log('[LOGIN] Checking password...');
        bcrypt.compare(password, user.senha, (bcryptErr, isValid) => {
          if (bcryptErr) {
            console.error('[LOGIN] Bcrypt error:', bcryptErr);
            return res.status(500).json({ ok: false, error: 'Password verification error' });
          }
          console.log('[LOGIN] Password valid:', isValid);
          if (!isValid) {
            console.log('[LOGIN] Invalid password for:', loginField);
            return res.status(401).json({ ok: false, error: 'Invalid credentials' });
          }
          console.log('[LOGIN] Creating JWT token...');
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
          console.log('[LOGIN] Setting cookie...');
          res.cookie('sid', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
          });
          console.log('[LOGIN] Login successful for:', loginField);
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
      }
    );
  } catch (error) {
    console.error('[LOGIN] Login error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('sid');
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  console.log('[ME] User info request:', req.user);
  res.json({ ok: true, user: req.user });
});

// Health endpoint
app.get('/api/healthz', (req, res) => {
  db.get('SELECT 1 as ok', (err, row) => {
    if (err) return res.status(500).json({ ok: false, db: 'error', error: err.message });
    res.json({ ok: true, db: 'ok', pid: process.pid, now: new Date().toISOString() });
  });
});

// Debug endpoints
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

// Mural routes
app.get('/api/mural/posts', (req, res) => {
  console.log('[MURAL-GET] Loading posts...');
  db.all(
    `SELECT 
      id, titulo, conteudo, author, pinned, created_at,
      (SELECT COUNT(*) FROM mural_likes WHERE post_id = mural_posts.id) as likes_count,
      (SELECT COUNT(*) FROM mural_comments WHERE post_id = mural_posts.id) as comments_count
     FROM mural_posts 
     WHERE ativo = 1 
     ORDER BY pinned DESC, created_at DESC`,
    (err, rows) => {
      if (err) {
        console.error('[MURAL-GET] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      console.log('[MURAL-GET] Found', rows.length, 'posts');
      res.json({ ok: true, posts: rows || [] });
    }
  );
});

// Alias for GET (compat)
app.get('/api/mural', (req, res) => {
  console.log('[MURAL-ALIAS] Redirecting to posts...');
  req.url = '/api/mural/posts';
  app._router.handle(req, res);
});

// RH create post
app.post('/api/rh/mural/posts', requireAuth, requireRole('rh', 'admin'), (req, res) => {
  console.log('[MURAL-RH-POST] Creating post:', req.body);
  const { titulo, conteudo, pinned } = req.body;
  if (!titulo?.trim() || !conteudo?.trim()) {
    return res.status(400).json({ ok: false, error: 'Título e conteúdo são obrigatórios' });
  }
  const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.run(
    `INSERT INTO mural_posts (id, titulo, conteudo, author, user_id, pinned) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [postId, titulo.trim(), conteudo.trim(), req.user.name, req.user.id, pinned ? 1 : 0],
    function(err) {
      if (err) {
        console.error('[MURAL-RH-POST] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      console.log('[MURAL-RH-POST] Post created with ID:', postId);
      res.json({ ok: true, id: postId, points: 15, message: 'Post criado com sucesso' });
    }
  );
});

// TI/RH/Admin create post (compat)
app.post('/api/mural/posts', requireAuth, requireRole('rh', 'admin', 'ti'), (req, res) => {
  console.log('[MURAL-POST] 📝 Creating post:', req.body);
  const { titulo, conteudo, pinned } = req.body;
  if (!titulo?.trim() || !conteudo?.trim()) {
    return res.status(400).json({ ok: false, error: 'Título e conteúdo são obrigatórios' });
  }
  const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.run(
    `INSERT INTO mural_posts (id, titulo, conteudo, author, user_id, pinned) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [postId, titulo.trim(), conteudo.trim(), req.user.name, req.user.id, pinned ? 1 : 0],
    function(err) {
      if (err) {
        console.error('[MURAL-POST] ❌ Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      console.log('[MURAL-POST] ✅ Post created with ID:', postId);
      res.json({ ok: true, id: postId, points: 15, message: 'Post criado com sucesso' });
    }
  );
});

app.patch('/api/mural/posts/:id', requireAuth, requireRole('rh', 'admin'), (req, res) => {
  console.log('[MURAL-PATCH] 📝 Updating post:', req.params.id);
  const { titulo, conteudo, pinned } = req.body;
  const postId = req.params.id;
  if (!titulo?.trim() || !conteudo?.trim()) {
    return res.status(400).json({ ok: false, error: 'Título e conteúdo são obrigatórios' });
  }
  db.run(
    `UPDATE mural_posts 
     SET titulo = ?, conteudo = ?, pinned = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND ativo = 1`,
    [titulo.trim(), conteudo.trim(), pinned ? 1 : 0, postId],
    function(err) {
      if (err) {
        console.error('[MURAL-PATCH] ❌ Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ ok: false, error: 'Post not found' });
      }
      console.log('[MURAL-PATCH] ✅ Post updated:', postId);
      res.json({ ok: true, message: 'Post atualizado com sucesso' });
    }
  );
});

app.delete('/api/mural/posts/:id', requireAuth, requireRole('rh', 'admin'), (req, res) => {
  console.log('[MURAL-DELETE] 🗑️ Soft deleting post:', req.params.id);
  const postId = req.params.id;
  db.run(
    'UPDATE mural_posts SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [postId],
    function(err) {
      if (err) {
        console.error('[MURAL-DELETE] ❌ Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ ok: false, error: 'Post not found' });
      }
      console.log('[MURAL-DELETE] ✅ Post deleted:', postId);
      res.json({ ok: true, message: 'Post deletado com sucesso' });
    }
  );
});

// Reactions
app.post('/api/mural/:id/like', requireAuth, (req, res) => {
  console.log('[MURAL-LIKE] Processing like for post:', req.params.id);
  const postId = req.params.id;
  const userId = req.user.id;
  const likeId = `like_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.get(
    'SELECT id FROM mural_likes WHERE post_id = ? AND user_id = ?',
    [postId, userId],
    (err, existingLike) => {
      if (err) {
        console.error('[MURAL-LIKE] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      if (existingLike) {
        db.run('DELETE FROM mural_likes WHERE post_id = ? AND user_id = ?', [postId, userId], function(err) {
          if (err) {
            console.error('[MURAL-LIKE] Error removing like:', err);
            return res.status(500).json({ ok: false, error: 'Database error' });
          }
          console.log('[MURAL-LIKE] Like removed');
          res.json({ ok: true, action: 'unliked', message: 'Like removido' });
        });
      } else {
        db.run('INSERT INTO mural_likes (id, post_id, user_id) VALUES (?, ?, ?)', [likeId, postId, userId], function(err) {
          if (err) {
            console.error('[MURAL-LIKE] Error adding like:', err);
            return res.status(500).json({ ok: false, error: 'Database error' });
          }
          console.log('[MURAL-LIKE] Like added');
          res.json({ ok: true, action: 'liked', points: 2, message: 'Like adicionado' });
        });
      }
    }
  );
});

app.post('/api/mural/:id/comments', requireAuth, (req, res) => {
  console.log('[MURAL-COMMENT] Creating comment for post:', req.params.id);
  const { texto } = req.body;
  const postId = req.params.id;
  const userId = req.user.id;
  const commentId = `comment_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  if (!texto?.trim()) return res.status(400).json({ ok: false, error: 'Texto do comentário é obrigatório' });
  db.run('INSERT INTO mural_comments (id, post_id, user_id, texto) VALUES (?, ?, ?, ?)', [commentId, postId, userId, texto.trim()], function(err) {
    if (err) {
      console.error('[MURAL-COMMENT] Database error:', err);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
    console.log('[MURAL-COMMENT] Comment created with ID:', commentId);
    res.json({ ok: true, id: commentId, points: 3, message: 'Comentário adicionado com sucesso' });
  });
});

// Reservas
app.get('/api/reservas', requireAuth, (req, res) => {
  console.log('[RESERVAS-GET] Loading reservations...');
  db.all('SELECT * FROM reservas ORDER BY data, inicio', (err, rows) => {
    if (err) {
      console.error('[RESERVAS-GET] Database error:', err);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
    console.log('[RESERVAS-GET] Found', rows.length, 'reservations');
    res.json({ ok: true, reservas: rows || [] });
  });
});

app.post('/api/reservas', requireAuth, (req, res) => {
  console.log('[RESERVAS-POST] Creating reservation:', req.body);
  const { sala, data, inicio, fim, assunto } = req.body;
  const userId = req.user.id;
  const userName = req.user.name;
  if (!sala || !data || !inicio || !fim || !assunto) {
    return res.status(400).json({ ok: false, error: 'Todos os campos são obrigatórios' });
  }
  const reservaId = `reserva_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.run(
    `INSERT INTO reservas (id, user_id, sala, data, inicio, fim, assunto, responsavel) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [reservaId, userId, sala, data, inicio, fim, assunto, userName],
    function(err) {
      if (err) {
        console.error('[RESERVAS-POST] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      console.log('[RESERVAS-POST] Reservation created with ID:', reservaId);
      res.json({ ok: true, id: reservaId, points: 10, message: 'Reserva criada com sucesso' });
    }
  );
});

// TI
app.get('/api/ti/solicitacoes', requireAuth, (req, res) => {
  console.log('[TI-GET] Loading equipment requests...');
  const userEmail = req.user.email;
  const userSetor = req.user.setor || req.user.sector || '';
  const userRole = req.user.role || 'colaborador';
  const canSeeAll = userRole === 'admin' || userSetor.toUpperCase() === 'TI';
  let query = 'SELECT * FROM ti_solicitacoes ORDER BY created_at DESC';
  let params = [];
  if (!canSeeAll) { query = 'SELECT * FROM ti_solicitacoes WHERE user_email = ? ORDER BY created_at DESC'; params = [userEmail]; }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('[TI-GET] Database error:', err);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
    console.log('[TI-GET] Found', rows.length, 'requests');
    res.json({ ok: true, solicitacoes: rows || [] });
  });
});

app.get('/api/ti/minhas', requireAuth, (req, res) => {
  console.log('[TI-MINHAS] 💻 Loading user equipment requests for:', req.user?.email);
  const userEmail = req.user?.email;
  if (!userEmail) return res.status(400).json({ ok: false, error: 'User email not available' });
  db.all('SELECT * FROM ti_solicitacoes WHERE user_email = ? ORDER BY created_at DESC', [userEmail], (err, rows) => {
    if (err) {
      console.error('[TI-MINHAS] ❌ Database error:', err);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
    console.log('[TI-MINHAS] ✅ Found', rows.length, 'requests for user:', userEmail);
    res.json({ ok: true, solicitacoes: rows || [] });
  });
});

app.post('/api/ti/solicitacoes', requireAuth, (req, res) => {
  console.log('[TI-POST] Creating equipment request:', req.body);
  const { titulo, descricao, prioridade } = req.body;
  const userEmail = req.user.email;
  const userName = req.user.name;
  if (!titulo?.trim()) return res.status(400).json({ ok: false, error: 'Título é obrigatório' });
  const requestId = `ti_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.run(
    `INSERT INTO ti_solicitacoes (id, titulo, descricao, prioridade, user_email, user_nome) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [requestId, titulo.trim(), descricao || '', prioridade || 'medium', userEmail, userName],
    function(err) {
      if (err) {
        console.error('[TI-POST] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      console.log('[TI-POST] Request created with ID:', requestId);
      res.json({ ok: true, id: requestId, points: 4, message: 'Solicitação criada com sucesso' });
    }
  );
});

app.patch('/api/ti/solicitacoes/:id', requireAuth, requireRole('ti', 'admin'), (req, res) => {
  console.log('[TI-PATCH] Updating TI request:', req.params.id);
  const { status } = req.body;
  const requestId = req.params.id;
  if (!status) return res.status(400).json({ ok: false, error: 'Status é obrigatório' });
  db.run('UPDATE ti_solicitacoes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, requestId], function(err) {
    if (err) {
      console.error('[TI-PATCH] Database error:', err);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
    if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Solicitação não encontrada' });
    console.log('[TI-PATCH] Request updated:', requestId);
    res.json({ ok: true, message: 'Status atualizado com sucesso' });
  });
});

// Trocas de proteína
app.get('/api/trocas-proteina', requireAuth, (req, res) => {
  console.log('[TROCAS-GET] Loading protein exchanges...');
  const { from, to } = req.query;
  const userEmail = req.user.email;
  let query = 'SELECT * FROM trocas_proteina WHERE user_email = ?';
  let params = [userEmail];
  if (from && to) { query += ' AND data BETWEEN ? AND ?'; params.push(from, to); }
  query += ' ORDER BY data';
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('[TROCAS-GET] Database error:', err);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
    console.log('[TROCAS-GET] Found', rows.length, 'exchanges');
    res.json({ ok: true, trocas: rows || [] });
  });
});

const isWithinExchangeDeadline = (exchangeDate) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoffTime = new Date(today);
  cutoffTime.setHours(16, 0, 0, 0); // 16:00
  const targetDate = new Date(exchangeDate);
  const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const minExchangeDate = new Date(today);
  if (now >= cutoffTime) minExchangeDate.setDate(today.getDate() + 2);
  else minExchangeDate.setDate(today.getDate() + 1);
  return targetDateOnly >= minExchangeDate;
};

app.post('/api/trocas-proteina/bulk', requireAuth, (req, res) => {
  console.log('[TROCAS-BULK] Saving bulk protein exchanges...');
  const { trocas } = req.body;
  const userEmail = req.user.email;
  if (!Array.isArray(trocas) || trocas.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nenhuma troca fornecida' });
  }
  const invalidExchanges = trocas.filter(troca => !isWithinExchangeDeadline(troca.data));
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
    stmt.run([trocaId, userEmail, troca.data, troca.proteina_original, troca.proteina_nova], function(err) {
      if (err) console.error('[TROCAS-BULK] Error inserting exchange:', err);
      else { inseridas++; console.log('[TROCAS-BULK] Exchange saved:', troca.data, troca.proteina_nova); }
      processed++;
      if (processed === trocas.length) {
        stmt.finalize();
        const totalPoints = inseridas * 5;
        console.log('[TROCAS-BULK] Bulk operation completed:', inseridas, 'inserted,', totalPoints, 'points');
        res.json({ ok: true, inseridas, totalPoints, message: `${inseridas} trocas salvas com sucesso` });
      }
    });
  });
});

// Portaria
app.get('/api/portaria/agendamentos', requireAuth, (req, res) => {
  console.log('[PORTARIA-GET] Loading appointments...');
  db.all('SELECT * FROM portaria_agendamentos ORDER BY data, hora', (err, rows) => {
    if (err) {
      console.error('[PORTARIA-GET] Database error:', err);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
    console.log('[PORTARIA-GET] Found', rows.length, 'appointments');
    res.json({ ok: true, agendamentos: rows || [] });
  });
});

app.post('/api/portaria/agendamentos', requireAuth, (req, res) => {
  console.log('[PORTARIA-POST] Creating appointment:', req.body);
  const { data, hora, visitante, documento, observacao } = req.body;
  const userId = req.user.id;
  if (!data || !hora || !visitante) {
    return res.status(400).json({ ok: false, error: 'Data, hora e visitante são obrigatórios' });
  }
  const agendamentoId = `agenda_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.run(
    `INSERT INTO portaria_agendamentos (id, user_id, data, hora, visitante, documento, observacao) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [agendamentoId, userId, data, hora, visitante, documento || '', observacao || ''],
    function(err) {
      if (err) {
        console.error('[PORTARIA-POST] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      console.log('[PORTARIA-POST] Appointment created with ID:', agendamentoId);
      res.json({ ok: true, id: agendamentoId, points: 6, message: 'Agendamento criado com sucesso' });
    }
  );
});

// Admin users
app.get('/api/admin/users', requireAuth, requireRole('admin', 'rh'), (req, res) => {
  console.log('[ADMIN-GET-USERS] Loading users...');
  db.all('SELECT id, nome, email, setor, role, ativo, created_at FROM usuarios ORDER BY nome', (err, rows) => {
    if (err) {
      console.error('[ADMIN-GET-USERS] Database error:', err);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
    console.log('[ADMIN-GET-USERS] Found', rows.length, 'users');
    res.json({ ok: true, users: rows || [] });
  });
});

app.post('/api/admin/users', requireAuth, requireRole('admin'), (req, res) => {
  console.log('[ADMIN-POST-USER] Creating user:', req.body.email);
  const { nome, email, senha, setor, role } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ ok: false, error: 'Nome, email e senha são obrigatórios' });
  }
  const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const hashedPassword = bcrypt.hashSync(senha, 10);
  db.run(
    `INSERT INTO usuarios (id, nome, email, senha, setor, role) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, nome, email, hashedPassword, setor || 'Geral', role || 'colaborador'],
    function(err) {
      if (err) {
        console.error('[ADMIN-POST-USER] Database error
