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

// Database setup
const DB_PATH = path.join(__dirname, 'data', 'database.sqlite');
console.log('[SERVER] Database path:', DB_PATH);

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('[SERVER] Created data directory:', dataDir);
}

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[SERVER] Database connection error:', err);
  } else {
    console.log('[SERVER] Connected to SQLite database');
  }
});

// Create tables if they don't exist
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      setor TEXT DEFAULT 'Geral',
      role TEXT DEFAULT 'colaborador',
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Mural posts table
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
  `);

  // Mural likes table
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
  `);

  // Mural comments table
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
  `);

  // Reservas table
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
  `);

  // TI Solicitações table
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
  `);

  // Trocas proteina table
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
  `);

  // Portaria agendamentos table
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
  `);

  // Insert demo admin user
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.run(`
    INSERT OR IGNORE INTO usuarios (id, nome, email, senha, setor, role)
    VALUES ('admin-1', 'Administrador', 'admin@grupocropfield.com.br', ?, 'TI', 'admin')
  `, [hashedPassword]);

  console.log('[SERVER] Database tables initialized');
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

// Authentication middleware
const requireAuth = (req, res, next) => {
  console.log('[AUTH] Checking authentication...');
  console.log('[AUTH] Cookies:', req.cookies);
  
  const token = req.cookies.sid || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    console.log('[AUTH] No token found');
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[AUTH] Token decoded:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('[AUTH] Token verification failed:', error.message);
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
};

// Role-based middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    console.log('[RBAC] Checking roles:', roles, 'User role:', req.user?.role, 'User sector:', req.user?.setor);
    
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    
    const userRole = req.user.role || 'colaborador';
    const userSetor = req.user.setor || req.user.sector || '';
    
    // Admin always has access
    if (userRole === 'admin') {
      console.log('[RBAC] Admin access granted');
      return next();
    }
    
    // Check if user role is in allowed roles
    if (roles.includes(userRole)) {
      console.log('[RBAC] Role access granted:', userRole);
      return next();
    }
    
    // Check if user sector is in allowed roles (for RH/TI)
    if (roles.includes('rh') && userSetor.toUpperCase() === 'RH') {
      console.log('[RBAC] RH sector access granted');
      return next();
    }
    
    if (roles.includes('ti') && userSetor.toUpperCase() === 'TI') {
      console.log('[RBAC] TI sector access granted');
      return next();
    }
    
    console.log('[RBAC] Access denied for user:', req.user);
    return res.status(403).json({ ok: false, error: 'Insufficient permissions' });
  };
};

// Auth routes
app.post('/auth/login', async (req, res) => {
  console.log('[LOGIN] Login attempt:', req.body.email);
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password required' });
  }

  try {
    // Query user from database
    db.get(
      'SELECT * FROM usuarios WHERE email = ? AND ativo = 1',
      [email],
      async (err, user) => {
        if (err) {
          console.error('[LOGIN] Database error:', err);
          return res.status(500).json({ ok: false, error: 'Database error' });
        }

        if (!user) {
          console.log('[LOGIN] User not found:', email);
          return res.status(401).json({ ok: false, error: 'Invalid credentials' });
        }

        // Check password
        const isValid = await bcrypt.compare(password, user.senha);
        if (!isValid) {
          console.log('[LOGIN] Invalid password for:', email);
          return res.status(401).json({ ok: false, error: 'Invalid credentials' });
        }

        // Create JWT token
        const token = jwt.sign(
          { 
            id: user.id,
            name: user.nome,
            email: user.email,
            setor: user.setor,
            sector: user.setor,
            role: user.role
          },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Set cookie
        res.cookie('sid', token, {
          httpOnly: true,
          secure: false, // Set to true in production with HTTPS
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        console.log('[LOGIN] Login successful for:', email);
        
        res.json({
          ok: true,
          user: {
            id: user.id,
            name: user.nome,
            email: user.email,
            sector: user.setor,
            setor: user.setor,
            role: user.role,
            avatar: user.avatar_url
          },
          token
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
  res.json({
    ok: true,
    user: req.user
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
  res.json({
    ok: true,
    user: req.user,
    timestamp: new Date().toISOString()
  });
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

// Alias for GET (optional)
app.get('/api/mural', (req, res) => {
  console.log('[MURAL-ALIAS] Redirecting to posts...');
  req.url = '/api/mural/posts';
  app._router.handle(req, res);
});

// Original RH routes
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
      res.json({ 
        ok: true, 
        id: postId,
        points: 15,
        message: 'Post criado com sucesso'
      });
    }
  );
});

// Aliases for compatibility
app.post('/api/mural/posts', requireAuth, requireRole('rh', 'admin'), (req, res) => {
  console.log('[MURAL-POST-ALIAS] Creating post via alias...');
  req.url = '/api/rh/mural/posts';
  app._router.handle(req, res);
});

app.patch('/api/mural/posts/:id', requireAuth, requireRole('rh', 'admin'), (req, res) => {
  console.log('[MURAL-PATCH-ALIAS] Updating post:', req.params.id);
  
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
        console.error('[MURAL-PATCH-ALIAS] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ ok: false, error: 'Post not found' });
      }
      
      console.log('[MURAL-PATCH-ALIAS] Post updated:', postId);
      res.json({ ok: true, message: 'Post atualizado com sucesso' });
    }
  );
});

app.delete('/api/mural/posts/:id', requireAuth, requireRole('rh', 'admin'), (req, res) => {
  console.log('[MURAL-DELETE-ALIAS] Soft deleting post:', req.params.id);
  
  const postId = req.params.id;
  
  db.run(
    'UPDATE mural_posts SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [postId],
    function(err) {
      if (err) {
        console.error('[MURAL-DELETE-ALIAS] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ ok: false, error: 'Post not found' });
      }
      
      console.log('[MURAL-DELETE-ALIAS] Post deleted:', postId);
      res.json({ ok: true, message: 'Post deletado com sucesso' });
    }
  );
});

// Mural reactions routes
app.post('/api/mural/:id/like', requireAuth, (req, res) => {
  console.log('[MURAL-LIKE] Processing like for post:', req.params.id);
  
  const postId = req.params.id;
  const userId = req.user.id;
  const likeId = `like_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  // Check if user already liked this post
  db.get(
    'SELECT id FROM mural_likes WHERE post_id = ? AND user_id = ?',
    [postId, userId],
    (err, existingLike) => {
      if (err) {
        console.error('[MURAL-LIKE] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      
      if (existingLike) {
        // Unlike
        db.run(
          'DELETE FROM mural_likes WHERE post_id = ? AND user_id = ?',
          [postId, userId],
          function(err) {
            if (err) {
              console.error('[MURAL-LIKE] Error removing like:', err);
              return res.status(500).json({ ok: false, error: 'Database error' });
            }
            
            console.log('[MURAL-LIKE] Like removed');
            res.json({ ok: true, action: 'unliked', message: 'Like removido' });
          }
        );
      } else {
        // Like
        db.run(
          'INSERT INTO mural_likes (id, post_id, user_id) VALUES (?, ?, ?)',
          [likeId, postId, userId],
          function(err) {
            if (err) {
              console.error('[MURAL-LIKE] Error adding like:', err);
              return res.status(500).json({ ok: false, error: 'Database error' });
            }
            
            console.log('[MURAL-LIKE] Like added');
            res.json({ ok: true, action: 'liked', points: 2, message: 'Like adicionado' });
          }
        );
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
  
  if (!texto?.trim()) {
    return res.status(400).json({ ok: false, error: 'Texto do comentário é obrigatório' });
  }

  db.run(
    'INSERT INTO mural_comments (id, post_id, user_id, texto) VALUES (?, ?, ?, ?)',
    [commentId, postId, userId, texto.trim()],
    function(err) {
      if (err) {
        console.error('[MURAL-COMMENT] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      
      console.log('[MURAL-COMMENT] Comment created with ID:', commentId);
      res.json({ 
        ok: true, 
        id: commentId,
        points: 3,
        message: 'Comentário adicionado com sucesso'
      });
    }
  );
});

// Reservas routes
app.get('/api/reservas', requireAuth, (req, res) => {
  console.log('[RESERVAS-GET] Loading reservations...');
  
  db.all(
    'SELECT * FROM reservas ORDER BY data, inicio',
    (err, rows) => {
      if (err) {
        console.error('[RESERVAS-GET] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      
      console.log('[RESERVAS-GET] Found', rows.length, 'reservations');
      res.json({ ok: true, reservas: rows || [] });
    }
  );
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
      res.json({ 
        ok: true, 
        id: reservaId,
        points: 10,
        message: 'Reserva criada com sucesso'
      });
    }
  );
});

// TI Equipamentos routes
app.get('/api/ti/solicitacoes', requireAuth, (req, res) => {
  console.log('[TI-GET] Loading equipment requests...');
  
  const userEmail = req.user.email;
  const userSetor = req.user.setor || req.user.sector || '';
  const userRole = req.user.role || 'colaborador';
  
  // TI and Admin can see all requests
  const canSeeAll = userRole === 'admin' || userSetor.toUpperCase() === 'TI';
  
  let query = 'SELECT * FROM ti_solicitacoes ORDER BY created_at DESC';
  let params = [];
  
  if (!canSeeAll) {
    query = 'SELECT * FROM ti_solicitacoes WHERE user_email = ? ORDER BY created_at DESC';
    params = [userEmail];
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('[TI-GET] Database error:', err);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
    
    console.log('[TI-GET] Found', rows.length, 'requests');
    res.json({ ok: true, solicitacoes: rows || [] });
  });
});

app.post('/api/ti/solicitacoes', requireAuth, (req, res) => {
  console.log('[TI-POST] Creating equipment request:', req.body);
  
  const { titulo, descricao, prioridade } = req.body;
  const userEmail = req.user.email;
  const userName = req.user.name;
  
  if (!titulo?.trim()) {
    return res.status(400).json({ ok: false, error: 'Título é obrigatório' });
  }

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
      res.json({ 
        ok: true, 
        id: requestId,
        points: 4,
        message: 'Solicitação criada com sucesso'
      });
    }
  );
});

app.patch('/api/ti/solicitacoes/:id', requireAuth, requireRole('ti', 'admin'), (req, res) => {
  console.log('[TI-PATCH] Updating TI request:', req.params.id);
  
  const { status } = req.body;
  const requestId = req.params.id;
  
  if (!status) {
    return res.status(400).json({ ok: false, error: 'Status é obrigatório' });
  }

  db.run(
    'UPDATE ti_solicitacoes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, requestId],
    function(err) {
      if (err) {
        console.error('[TI-PATCH] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ ok: false, error: 'Solicitação não encontrada' });
      }
      
      console.log('[TI-PATCH] Request updated:', requestId);
      res.json({ ok: true, message: 'Status atualizado com sucesso' });
    }
  );
});

// Trocas proteina routes
app.get('/api/trocas-proteina', requireAuth, (req, res) => {
  console.log('[TROCAS-GET] Loading protein exchanges...');
  
  const { from, to } = req.query;
  const userEmail = req.user.email;
  
  let query = 'SELECT * FROM trocas_proteina WHERE user_email = ?';
  let params = [userEmail];
  
  if (from && to) {
    query += ' AND data BETWEEN ? AND ?';
    params.push(from, to);
  }
  
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

app.post('/api/trocas-proteina/bulk', requireAuth, (req, res) => {
  console.log('[TROCAS-BULK] Saving bulk protein exchanges...');
  
  const { trocas } = req.body;
  const userEmail = req.user.email;
  
  if (!Array.isArray(trocas) || trocas.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nenhuma troca fornecida' });
  }

  let inseridas = 0;
  let processed = 0;
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO trocas_proteina (id, user_email, data, proteina_original, proteina_nova)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  trocas.forEach((troca) => {
    const trocaId = `troca_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    stmt.run(
      [trocaId, userEmail, troca.data, troca.proteina_original, troca.proteina_nova],
      function(err) {
        if (err) {
          console.error('[TROCAS-BULK] Error inserting exchange:', err);
        } else {
          inseridas++;
          console.log('[TROCAS-BULK] Exchange saved:', troca.data, troca.proteina_nova);
        }
        
        processed++;
        
        if (processed === trocas.length) {
          stmt.finalize();
          
          const totalPoints = inseridas * 5;
          console.log('[TROCAS-BULK] Bulk operation completed:', inseridas, 'inserted,', totalPoints, 'points');
          
          res.json({
            ok: true,
            inseridas,
            totalPoints,
            message: `${inseridas} trocas salvas com sucesso`
          });
        }
      }
    );
  });
});

// Portaria routes
app.get('/api/portaria/agendamentos', requireAuth, (req, res) => {
  console.log('[PORTARIA-GET] Loading appointments...');
  
  db.all(
    'SELECT * FROM portaria_agendamentos ORDER BY data, hora',
    (err, rows) => {
      if (err) {
        console.error('[PORTARIA-GET] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      
      console.log('[PORTARIA-GET] Found', rows.length, 'appointments');
      res.json({ ok: true, agendamentos: rows || [] });
    }
  );
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
      res.json({ 
        ok: true, 
        id: agendamentoId,
        points: 6,
        message: 'Agendamento criado com sucesso'
      });
    }
  );
});

// Admin routes
app.get('/api/admin/users', requireAuth, requireRole('admin', 'rh'), (req, res) => {
  console.log('[ADMIN-GET-USERS] Loading users...');
  
  db.all(
    'SELECT id, nome, email, setor, role, ativo, created_at FROM usuarios ORDER BY nome',
    (err, rows) => {
      if (err) {
        console.error('[ADMIN-GET-USERS] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      
      console.log('[ADMIN-GET-USERS] Found', rows.length, 'users');
      res.json({ ok: true, users: rows || [] });
    }
  );
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
        console.error('[ADMIN-POST-USER] Database error:', err);
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ ok: false, error: 'Email já existe' });
        }
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      
      console.log('[ADMIN-POST-USER] User created with ID:', userId);
      res.json({ 
        ok: true, 
        id: userId,
        message: 'Usuário criado com sucesso'
      });
    }
  );
});

app.patch('/api/admin/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  console.log('[ADMIN-PATCH-USER] Updating user:', req.params.id);
  
  const { nome, email, setor, role, ativo } = req.body;
  const userId = req.params.id;
  
  const updates = [];
  const values = [];
  
  if (nome !== undefined) { updates.push('nome = ?'); values.push(nome); }
  if (email !== undefined) { updates.push('email = ?'); values.push(email); }
  if (setor !== undefined) { updates.push('setor = ?'); values.push(setor); }
  if (role !== undefined) { updates.push('role = ?'); values.push(role); }
  if (ativo !== undefined) { updates.push('ativo = ?'); values.push(ativo ? 1 : 0); }
  
  if (updates.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nenhum campo para atualizar' });
  }
  
  values.push(userId);
  
  db.run(
    `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        console.error('[ADMIN-PATCH-USER] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ ok: false, error: 'Usuário não encontrado' });
      }
      
      console.log('[ADMIN-PATCH-USER] User updated:', userId);
      res.json({ ok: true, message: 'Usuário atualizado com sucesso' });
    }
  );
});

app.patch('/api/admin/users/:id/password', requireAuth, requireRole('admin'), (req, res) => {
  console.log('[ADMIN-RESET-PASSWORD] Resetting password for user:', req.params.id);
  
  const { senha } = req.body;
  const userId = req.params.id;
  
  if (!senha) {
    return res.status(400).json({ ok: false, error: 'Nova senha é obrigatória' });
  }

  const hashedPassword = bcrypt.hashSync(senha, 10);
  
  db.run(
    'UPDATE usuarios SET senha = ? WHERE id = ?',
    [hashedPassword, userId],
    function(err) {
      if (err) {
        console.error('[ADMIN-RESET-PASSWORD] Database error:', err);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ ok: false, error: 'Usuário não encontrado' });
      }
      
      console.log('[ADMIN-RESET-PASSWORD] Password reset for user:', userId);
      res.json({ ok: true, message: 'Senha alterada com sucesso' });
    }
  );
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[SERVER] Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  console.log('[SERVER] 404 - Route not found:', req.method, req.url);
  res.status(404).json({ ok: false, error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[SERVER] Server running on http://localhost:${PORT}`);
  console.log(`[SERVER] Database: ${DB_PATH}`);
  console.log(`[SERVER] Demo mode: ${!!process.env.DEMO_MODE || true}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SERVER] Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('[SERVER] Error closing database:', err);
    } else {
      console.log('[SERVER] Database connection closed');
    }
    process.exit(0);
  });
});