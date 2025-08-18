#!/usr/bin/env node
// server.cjs - Servidor Express robusto com tratamento de erros

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

// Configurações iniciais
const app = express();
const PORT = process.env.PORT || 3005;
const isDev = process.env.NODE_ENV !== 'production';

// Criar diretório de dados se não existir
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Configuração do banco SQLite
const dbPath = path.join(dataDir, 'database.sqlite');
let db;

// Função para inicializar banco com retry
const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ [DB] Erro ao conectar SQLite:', err.message);
        reject(err);
        return;
      }
      
      console.log('✅ [DB] SQLite conectado:', dbPath);
      
      // Criar tabelas se não existirem
      createTables()
        .then(() => {
          console.log('✅ [DB] Tabelas criadas/verificadas');
          resolve(db);
        })
        .catch(reject);
    });
  });
};

// Função para criar tabelas
const createTables = () => {
  return new Promise((resolve, reject) => {
    const queries = [
      `CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT,
        google_id TEXT,
        setor TEXT DEFAULT 'Geral',
        role TEXT DEFAULT 'colaborador',
        ativo BOOLEAN DEFAULT 1,
        foto TEXT,
        pontos INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS reservas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE,
        usuario_id INTEGER NOT NULL,
        sala TEXT NOT NULL,
        data DATE NOT NULL,
        inicio TIME NOT NULL,
        fim TIME NOT NULL,
        assunto TEXT NOT NULL,
        status TEXT DEFAULT 'ativa',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS mural_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE,
        usuario_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        pinned BOOLEAN DEFAULT 0,
        ativo BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS mural_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES mural_posts(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        UNIQUE(post_id, usuario_id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS mural_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        texto TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES mural_posts(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS trocas_proteina (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE,
        usuario_id INTEGER NOT NULL,
        data DATE NOT NULL,
        proteina_original TEXT NOT NULL,
        proteina_nova TEXT NOT NULL,
        status TEXT DEFAULT 'pendente',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS ti_solicitacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE,
        usuario_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        descricao TEXT NOT NULL,
        prioridade TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS portaria_agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE,
        usuario_id INTEGER NOT NULL,
        visitante TEXT NOT NULL,
        documento TEXT,
        data DATE NOT NULL,
        hora TIME NOT NULL,
        observacao TEXT,
        status TEXT DEFAULT 'agendado',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS pontos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        acao TEXT NOT NULL,
        pontos INTEGER NOT NULL,
        detalhes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )`
    ];

    let completed = 0;
    const total = queries.length;

    queries.forEach((query, index) => {
      db.run(query, (err) => {
        if (err) {
          console.error(`❌ [DB] Erro na query ${index + 1}:`, err.message);
          reject(err);
          return;
        }
        
        completed++;
        if (completed === total) {
          createDefaultUsers().then(resolve).catch(reject);
        }
      });
    });
  });
};

// Criar usuários padrão
const createDefaultUsers = async () => {
  return new Promise((resolve, reject) => {
    // Verificar se já existe usuário admin
    db.get('SELECT id FROM usuarios WHERE email = ?', ['admin@grupocropfield.com.br'], async (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        // Criar usuário admin padrão
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const uuid = generateUUID();
        
        db.run(
          'INSERT INTO usuarios (uuid, nome, email, senha, setor, role, ativo) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuid, 'Administrador', 'admin@grupocropfield.com.br', hashedPassword, 'TI', 'admin', 1],
          (err) => {
            if (err) {
              console.error('❌ [DB] Erro ao criar admin:', err.message);
              reject(err);
            } else {
              console.log('✅ [DB] Usuário admin criado');
              resolve();
            }
          }
        );
      } else {
        console.log('✅ [DB] Usuário admin já existe');
        resolve();
      }
    });
  });
};

// Utilitários
const generateUUID = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Configuração robusta de middleware
app.use(morgan(isDev ? 'dev' : 'combined'));
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://bolt.new'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Configuração de sessão
app.use(session({
  secret: process.env.SESSION_SECRET || 'cropfield-intranet-2025-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // HTTP em desenvolvimento
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    httpOnly: true
  }
}));

// Configuração do Passport
app.use(passport.initialize());
app.use(passport.session());

// Strategy local
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    console.log('🔐 [AUTH] Tentativa de login:', email);
    
    db.get('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [email], async (err, user) => {
      if (err) {
        console.error('❌ [AUTH] Erro na consulta:', err);
        return done(err);
      }
      
      if (!user) {
        console.log('❌ [AUTH] Usuário não encontrado:', email);
        return done(null, false, { message: 'Email não encontrado' });
      }
      
      if (!user.senha) {
        console.log('❌ [AUTH] Usuário sem senha (Google only):', email);
        return done(null, false, { message: 'Use login do Google' });
      }
      
      const isValidPassword = await bcrypt.compare(password, user.senha);
      if (!isValidPassword) {
        console.log('❌ [AUTH] Senha incorreta para:', email);
        return done(null, false, { message: 'Senha incorreta' });
      }
      
      console.log('✅ [AUTH] Login successful:', email);
      return done(null, user);
    });
  } catch (error) {
    console.error('❌ [AUTH] Erro no strategy:', error);
    return done(error);
  }
}));

// Serialização do usuário
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  db.get('SELECT * FROM usuarios WHERE id = ?', [id], (err, user) => {
    done(err, user);
  });
});

// Middleware de autenticação
const authenticateUser = (req, res, next) => {
  if (req.user) {
    return next();
  }
  
  res.status(401).json({ ok: false, error: 'Não autenticado' });
};

// Middleware de autorização admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'Não autenticado' });
  }
  
  const isAdmin = req.user.role === 'admin' || 
                  req.user.email === 'admin@grupocropfield.com.br' ||
                  req.user.setor === 'TI' ||
                  req.user.setor === 'RH';
  
  if (!isAdmin) {
    return res.status(403).json({ ok: false, error: 'Acesso negado' });
  }
  
  next();
};

// Função para adicionar pontos
const addUserPoints = (userId, acao, pontos, detalhes = null) => {
  return new Promise((resolve, reject) => {
    // Inserir na tabela de pontos
    db.run(
      'INSERT INTO pontos (usuario_id, acao, pontos, detalhes) VALUES (?, ?, ?, ?)',
      [userId, acao, pontos, detalhes],
      function(err) {
        if (err) {
          console.error('❌ [POINTS] Erro ao adicionar pontos:', err);
          reject(err);
          return;
        }
        
        // Atualizar total de pontos do usuário
        db.run(
          'UPDATE usuarios SET pontos = pontos + ? WHERE id = ?',
          [pontos, userId],
          (updateErr) => {
            if (updateErr) {
              console.error('❌ [POINTS] Erro ao atualizar total:', updateErr);
              reject(updateErr);
            } else {
              console.log(`✅ [POINTS] +${pontos} pontos para usuário ${userId} (${acao})`);
              resolve({ pontos, acao });
            }
          }
        );
      }
    );
  });
};

// ==================== ROTAS DE AUTENTICAÇÃO ====================

// Login manual
app.post('/auth/login', (req, res, next) => {
  console.log('🔐 [AUTH] POST /auth/login recebido');
  
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error('❌ [AUTH] Erro no authenticate:', err);
      return res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
    }
    
    if (!user) {
      console.log('❌ [AUTH] Falha na autenticação:', info?.message);
      return res.status(401).json({ ok: false, error: info?.message || 'Credenciais inválidas' });
    }
    
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('❌ [AUTH] Erro no login:', loginErr);
        return res.status(500).json({ ok: false, error: 'Erro ao realizar login' });
      }
      
      console.log('✅ [AUTH] Login successful para:', user.email);
      
      // Normalizar dados do usuário
      const userData = {
        id: user.uuid || user.id,
        name: user.nome,
        email: user.email,
        sector: user.setor,
        setor: user.setor,
        role: user.role,
        avatar: user.foto
      };
      
      res.json({ 
        ok: true, 
        user: userData,
        message: 'Login realizado com sucesso!' 
      });
    });
  })(req, res, next);
});

// Logout
app.post('/auth/logout', (req, res) => {
  console.log('🚪 [AUTH] Logout solicitado');
  
  req.logout((err) => {
    if (err) {
      console.error('❌ [AUTH] Erro no logout:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao fazer logout' });
    }
    
    req.session.destroy((sessionErr) => {
      if (sessionErr) {
        console.error('❌ [AUTH] Erro ao destruir sessão:', sessionErr);
      }
      
      res.clearCookie('connect.sid');
      res.json({ ok: true, message: 'Logout realizado com sucesso' });
    });
  });
});

// Verificar usuário logado
app.get('/api/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'Não autenticado' });
  }
  
  const userData = {
    id: req.user.uuid || req.user.id,
    name: req.user.nome,
    email: req.user.email,
    sector: req.user.setor,
    setor: req.user.setor,
    role: req.user.role,
    avatar: req.user.foto
  };
  
  res.json({ ok: true, user: userData });
});

// ==================== ROTAS DA APLICAÇÃO ====================

// Reservas de salas
app.get('/api/reservas', authenticateUser, (req, res) => {
  console.log('📅 [RESERVAS] GET /api/reservas');
  
  db.all(`
    SELECT r.*, u.nome as responsavel 
    FROM reservas r 
    JOIN usuarios u ON r.usuario_id = u.id 
    WHERE r.status = 'ativa'
    ORDER BY r.data, r.inicio
  `, (err, rows) => {
    if (err) {
      console.error('❌ [RESERVAS] Erro ao carregar:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao carregar reservas' });
    }
    
    res.json({ ok: true, reservas: rows || [] });
  });
});

app.post('/api/reservas', authenticateUser, (req, res) => {
  const { sala, data, inicio, fim, assunto } = req.body;
  
  if (!sala || !data || !inicio || !fim || !assunto) {
    return res.status(400).json({ ok: false, error: 'Dados incompletos' });
  }
  
  const uuid = generateUUID();
  
  db.run(
    'INSERT INTO reservas (uuid, usuario_id, sala, data, inicio, fim, assunto) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuid, req.user.id, sala, data, inicio, fim, assunto],
    async function(err) {
      if (err) {
        console.error('❌ [RESERVAS] Erro ao criar:', err);
        return res.status(500).json({ ok: false, error: 'Erro ao criar reserva' });
      }
      
      try {
        await addUserPoints(req.user.id, 'RESERVA_CREATE', 10, `Reserva: ${sala} - ${assunto}`);
        res.json({ ok: true, id: uuid, points: 10 });
      } catch (pointsErr) {
        console.error('❌ [RESERVAS] Erro ao adicionar pontos:', pointsErr);
        res.json({ ok: true, id: uuid });
      }
    }
  );
});

// Mural
app.get('/api/mural/posts', authenticateUser, (req, res) => {
  console.log('📢 [MURAL] GET /api/mural/posts');
  
  db.all(`
    SELECT 
      p.*,
      u.nome as author,
      COUNT(DISTINCT l.id) as likes_count,
      COUNT(DISTINCT c.id) as comments_count
    FROM mural_posts p
    JOIN usuarios u ON p.usuario_id = u.id
    LEFT JOIN mural_likes l ON p.id = l.post_id
    LEFT JOIN mural_comments c ON p.id = c.post_id
    WHERE p.ativo = 1
    GROUP BY p.id
    ORDER BY p.pinned DESC, p.created_at DESC
  `, (err, rows) => {
    if (err) {
      console.error('❌ [MURAL] Erro ao carregar posts:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao carregar posts' });
    }
    
    res.json({ ok: true, posts: rows || [] });
  });
});

app.post('/api/mural/posts', authenticateUser, (req, res) => {
  const { titulo, conteudo, pinned = false } = req.body;
  
  // Verificar permissão para postar
  const canPost = req.user.setor === 'TI' || req.user.setor === 'RH' || req.user.role === 'admin';
  if (!canPost) {
    return res.status(403).json({ ok: false, error: 'Sem permissão para criar posts' });
  }
  
  if (!titulo || !conteudo) {
    return res.status(400).json({ ok: false, error: 'Título e conteúdo são obrigatórios' });
  }
  
  const uuid = generateUUID();
  
  db.run(
    'INSERT INTO mural_posts (uuid, usuario_id, titulo, conteudo, pinned) VALUES (?, ?, ?, ?, ?)',
    [uuid, req.user.id, titulo, conteudo, pinned ? 1 : 0],
    async function(err) {
      if (err) {
        console.error('❌ [MURAL] Erro ao criar post:', err);
        return res.status(500).json({ ok: false, error: 'Erro ao criar post' });
      }
      
      try {
        await addUserPoints(req.user.id, 'MURAL_POST', 15, `Post: ${titulo}`);
        res.json({ ok: true, id: uuid, points: 15 });
      } catch (pointsErr) {
        console.error('❌ [MURAL] Erro ao adicionar pontos:', pointsErr);
        res.json({ ok: true, id: uuid });
      }
    }
  );
});

// Likes no mural
app.post('/api/mural/:postId/like', authenticateUser, (req, res) => {
  const { postId } = req.params;
  
  // Verificar se já curtiu
  db.get(
    'SELECT id FROM mural_likes WHERE post_id = (SELECT id FROM mural_posts WHERE uuid = ?) AND usuario_id = ?',
    [postId, req.user.id],
    (err, existingLike) => {
      if (err) {
        console.error('❌ [MURAL] Erro ao verificar like:', err);
        return res.status(500).json({ ok: false, error: 'Erro interno' });
      }
      
      if (existingLike) {
        // Remover like
        db.run(
          'DELETE FROM mural_likes WHERE post_id = (SELECT id FROM mural_posts WHERE uuid = ?) AND usuario_id = ?',
          [postId, req.user.id],
          (deleteErr) => {
            if (deleteErr) {
              console.error('❌ [MURAL] Erro ao remover like:', deleteErr);
              return res.status(500).json({ ok: false, error: 'Erro ao remover like' });
            }
            
            res.json({ ok: true, action: 'unliked' });
          }
        );
      } else {
        // Adicionar like
        db.get('SELECT id FROM mural_posts WHERE uuid = ?', [postId], (err, post) => {
          if (err || !post) {
            return res.status(404).json({ ok: false, error: 'Post não encontrado' });
          }
          
          db.run(
            'INSERT INTO mural_likes (post_id, usuario_id) VALUES (?, ?)',
            [post.id, req.user.id],
            async function(insertErr) {
              if (insertErr) {
                console.error('❌ [MURAL] Erro ao adicionar like:', insertErr);
                return res.status(500).json({ ok: false, error: 'Erro ao adicionar like' });
              }
              
              try {
                await addUserPoints(req.user.id, 'MURAL_LIKE', 2, `Like no post ${postId}`);
                res.json({ ok: true, action: 'liked', points: 2 });
              } catch (pointsErr) {
                res.json({ ok: true, action: 'liked' });
              }
            }
          );
        });
      }
    }
  );
});

// Comentários no mural
app.post('/api/mural/:postId/comments', authenticateUser, (req, res) => {
  const { postId } = req.params;
  const { texto } = req.body;
  
  if (!texto || !texto.trim()) {
    return res.status(400).json({ ok: false, error: 'Texto do comentário é obrigatório' });
  }
  
  // Buscar ID do post
  db.get('SELECT id FROM mural_posts WHERE uuid = ?', [postId], (err, post) => {
    if (err || !post) {
      return res.status(404).json({ ok: false, error: 'Post não encontrado' });
    }
    
    db.run(
      'INSERT INTO mural_comments (post_id, usuario_id, texto) VALUES (?, ?, ?)',
      [post.id, req.user.id, texto.trim()],
      async function(insertErr) {
        if (insertErr) {
          console.error('❌ [MURAL] Erro ao criar comentário:', insertErr);
          return res.status(500).json({ ok: false, error: 'Erro ao criar comentário' });
        }
        
        try {
          await addUserPoints(req.user.id, 'MURAL_COMMENT', 3, `Comentário no post ${postId}`);
          res.json({ ok: true, id: this.lastID, points: 3 });
        } catch (pointsErr) {
          res.json({ ok: true, id: this.lastID });
        }
      }
    );
  });
});

// Trocas de proteína
app.get('/api/trocas-proteina', authenticateUser, (req, res) => {
  const { from, to } = req.query;
  
  let query = `
    SELECT t.*, u.nome 
    FROM trocas_proteina t 
    JOIN usuarios u ON t.usuario_id = u.id 
    WHERE t.usuario_id = ?
  `;
  const params = [req.user.id];
  
  if (from && to) {
    query += ' AND t.data BETWEEN ? AND ?';
    params.push(from, to);
  }
  
  query += ' ORDER BY t.data DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('❌ [TROCAS] Erro ao carregar:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao carregar trocas' });
    }
    
    res.json({ ok: true, trocas: rows || [] });
  });
});

app.post('/api/trocas-proteina/bulk', authenticateUser, (req, res) => {
  const { trocas } = req.body;
  
  if (!Array.isArray(trocas) || trocas.length === 0) {
    return res.status(400).json({ ok: false, error: 'Dados inválidos' });
  }
  
  let inseridas = 0;
  let totalPoints = 0;
  const promises = [];
  
  for (const troca of trocas) {
    const { data, proteina_original, proteina_nova } = troca;
    
    if (!data || !proteina_original || !proteina_nova) {
      continue;
    }
    
    const uuid = generateUUID();
    
    const promise = new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO trocas_proteina (uuid, usuario_id, data, proteina_original, proteina_nova) VALUES (?, ?, ?, ?, ?)',
        [uuid, req.user.id, data, proteina_original, proteina_nova],
        async function(err) {
          if (err) {
            console.error('❌ [TROCAS] Erro ao inserir:', err);
            reject(err);
            return;
          }
          
          inseridas++;
          
          try {
            await addUserPoints(req.user.id, 'TROCA_PROTEINA', 5, `Troca ${data}: ${proteina_original} → ${proteina_nova}`);
            totalPoints += 5;
          } catch (pointsErr) {
            console.error('❌ [TROCAS] Erro ao adicionar pontos:', pointsErr);
          }
          
          resolve();
        }
      );
    });
    
    promises.push(promise);
  }
  
  Promise.allSettled(promises).then(() => {
    res.json({ ok: true, inseridas, totalPoints });
  });
});

// Solicitações de TI
app.get('/api/ti/solicitacoes', authenticateUser, requireAdmin, (req, res) => {
  console.log('💻 [TI] GET /api/ti/solicitacoes (admin)');
  
  db.all(`
    SELECT s.*, u.nome, u.email 
    FROM ti_solicitacoes s 
    JOIN usuarios u ON s.usuario_id = u.id 
    ORDER BY s.created_at DESC
  `, (err, rows) => {
    if (err) {
      console.error('❌ [TI] Erro ao carregar solicitações:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao carregar solicitações' });
    }
    
    res.json({ ok: true, solicitacoes: rows || [] });
  });
});

app.get('/api/ti/minhas', authenticateUser, (req, res) => {
  const { email } = req.query;
  const userEmail = email || req.user.email;
  
  console.log('💻 [TI] GET /api/ti/minhas para:', userEmail);
  
  db.all(`
    SELECT s.*, u.nome, u.email 
    FROM ti_solicitacoes s 
    JOIN usuarios u ON s.usuario_id = u.id 
    WHERE u.email = ?
    ORDER BY s.created_at DESC
  `, [userEmail], (err, rows) => {
    if (err) {
      console.error('❌ [TI] Erro ao carregar minhas solicitações:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao carregar solicitações' });
    }
    
    res.json({ ok: true, solicitacoes: rows || [] });
  });
});

app.post('/api/ti/solicitacoes', authenticateUser, (req, res) => {
  const { titulo, descricao, prioridade = 'medium', email, nome } = req.body;
  
  if (!titulo || !descricao) {
    return res.status(400).json({ ok: false, error: 'Título e descrição são obrigatórios' });
  }
  
  const uuid = generateUUID();
  
  db.run(
    'INSERT INTO ti_solicitacoes (uuid, usuario_id, titulo, descricao, prioridade) VALUES (?, ?, ?, ?, ?)',
    [uuid, req.user.id, titulo, descricao, prioridade],
    async function(err) {
      if (err) {
        console.error('❌ [TI] Erro ao criar solicitação:', err);
        return res.status(500).json({ ok: false, error: 'Erro ao criar solicitação' });
      }
      
      try {
        await addUserPoints(req.user.id, 'TI_SOLICITACAO', 5, `Solicitação TI: ${titulo}`);
        res.json({ ok: true, id: uuid, points: 5 });
      } catch (pointsErr) {
        res.json({ ok: true, id: uuid });
      }
    }
  );
});

// Agendamentos da portaria
app.get('/api/portaria/agendamentos', authenticateUser, (req, res) => {
  console.log('🚪 [PORTARIA] GET /api/portaria/agendamentos');
  
  db.all(`
    SELECT p.*, u.nome as responsavel 
    FROM portaria_agendamentos p 
    JOIN usuarios u ON p.usuario_id = u.id 
    ORDER BY p.data DESC, p.hora DESC 
    LIMIT 20
  `, (err, rows) => {
    if (err) {
      console.error('❌ [PORTARIA] Erro ao carregar agendamentos:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao carregar agendamentos' });
    }
    
    res.json({ ok: true, agendamentos: rows || [] });
  });
});

app.post('/api/portaria/agendamentos', authenticateUser, (req, res) => {
  const { data, hora, visitante, documento, observacao } = req.body;
  
  if (!data || !hora || !visitante) {
    return res.status(400).json({ ok: false, error: 'Data, hora e nome do visitante são obrigatórios' });
  }
  
  const uuid = generateUUID();
  
  db.run(
    'INSERT INTO portaria_agendamentos (uuid, usuario_id, visitante, documento, data, hora, observacao) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuid, req.user.id, visitante, documento || '', data, hora, observacao || ''],
    async function(err) {
      if (err) {
        console.error('❌ [PORTARIA] Erro ao criar agendamento:', err);
        return res.status(500).json({ ok: false, error: 'Erro ao criar agendamento' });
      }
      
      try {
        await addUserPoints(req.user.id, 'PORTARIA_CREATE', 8, `Agendamento: ${visitante} - ${data}`);
        res.json({ ok: true, id: uuid, points: 8 });
      } catch (pointsErr) {
        res.json({ ok: true, id: uuid });
      }
    }
  );
});

// Dashboard administrativo
app.get('/api/admin/dashboard', authenticateUser, requireAdmin, (req, res) => {
  console.log('📊 [ADMIN] GET /api/admin/dashboard');
  
  // Consultar estatísticas do sistema
  const queries = {
    usuarios_ativos: 'SELECT COUNT(*) as count FROM usuarios WHERE ativo = 1',
    posts_mural: 'SELECT COUNT(*) as count FROM mural_posts WHERE ativo = 1',
    reservas_salas: 'SELECT COUNT(*) as count FROM reservas WHERE status = "ativa"',
    solicitacoes_ti: 'SELECT COUNT(*) as count FROM ti_solicitacoes',
    trocas_proteina: 'SELECT COUNT(*) as count FROM trocas_proteina',
    agendamentos_portaria: 'SELECT COUNT(*) as count FROM portaria_agendamentos'
  };
  
  const stats = {};
  const promises = Object.entries(queries).map(([key, query]) => {
    return new Promise((resolve) => {
      db.get(query, (err, row) => {
        stats[key] = err ? 0 : (row?.count || 0);
        resolve();
      });
    });
  });
  
  Promise.all(promises).then(() => {
    // Buscar ranking de usuários
    db.all(`
      SELECT 
        u.nome,
        u.email,
        u.setor,
        u.foto,
        COALESCE(SUM(p.pontos), 0) as total_pontos
      FROM usuarios u
      LEFT JOIN pontos p ON u.id = p.usuario_id
      WHERE u.ativo = 1
      GROUP BY u.id
      ORDER BY total_pontos DESC
      LIMIT 10
    `, (err, ranking) => {
      if (err) {
        console.error('❌ [ADMIN] Erro ao carregar ranking:', err);
        ranking = [];
      }
      
      // Pontos do usuário atual
      db.get(`
        SELECT 
          COALESCE(SUM(p.pontos), 0) as total_pontos,
          JSON_GROUP_ARRAY(
            JSON_OBJECT('acao', p.acao, 'total', COALESCE(SUM(p.pontos), 0), 'count', COUNT(*))
          ) as breakdown
        FROM pontos p
        WHERE p.usuario_id = ?
      `, [req.user.id], (pointsErr, userPoints) => {
        const breakdown = [];
        if (!pointsErr && userPoints?.breakdown) {
          try {
            const parsed = JSON.parse(userPoints.breakdown);
            breakdown.push(...(Array.isArray(parsed) ? parsed : []));
          } catch (e) {
            console.error('❌ [ADMIN] Erro ao parse breakdown:', e);
          }
        }
        
        res.json({
          ok: true,
          stats,
          ranking: ranking || [],
          userPoints: userPoints?.total_pontos || 0,
          breakdown
        });
      });
    });
  });
});

// Gerenciamento de usuários (admin)
app.get('/api/admin/users', authenticateUser, requireAdmin, (req, res) => {
  console.log('👥 [ADMIN] GET /api/admin/users');
  
  db.all(`
    SELECT 
      id,
      uuid,
      nome,
      email,
      setor,
      role,
      ativo,
      pontos,
      created_at
    FROM usuarios 
    ORDER BY created_at DESC
  `, (err, rows) => {
    if (err) {
      console.error('❌ [ADMIN] Erro ao carregar usuários:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao carregar usuários' });
    }
    
    res.json({ ok: true, users: rows || [] });
  });
});

app.post('/api/admin/users', authenticateUser, requireAdmin, async (req, res) => {
  const { nome, email, senha, setor, role } = req.body;
  
  if (!nome || !email || !senha) {
    return res.status(400).json({ ok: false, error: 'Nome, email e senha são obrigatórios' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(senha, 10);
    const uuid = generateUUID();
    
    db.run(
      'INSERT INTO usuarios (uuid, nome, email, senha, setor, role) VALUES (?, ?, ?, ?, ?, ?)',
      [uuid, nome, email, hashedPassword, setor || 'Geral', role || 'colaborador'],
      function(err) {
        if (err) {
          console.error('❌ [ADMIN] Erro ao criar usuário:', err);
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ ok: false, error: 'Email já cadastrado' });
          }
          return res.status(500).json({ ok: false, error: 'Erro ao criar usuário' });
        }
        
        res.json({ ok: true, id: uuid });
      }
    );
  } catch (hashErr) {
    console.error('❌ [ADMIN] Erro ao hash senha:', hashErr);
    res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

// Exportações (admin)
app.get('/api/admin/export/ranking.:formato', authenticateUser, requireAdmin, (req, res) => {
  const { formato } = req.params;
  const { month } = req.query;
  
  console.log(`📊 [EXPORT] Exporting ranking as ${formato} for month ${month}`);
  
  if (!['csv', 'excel', 'pdf'].includes(formato)) {
    return res.status(400).json({ ok: false, error: 'Formato inválido' });
  }
  
  // Buscar dados do ranking
  db.all(`
    SELECT 
      u.nome,
      u.email,
      u.setor,
      COALESCE(SUM(p.pontos), 0) as total_pontos,
      COUNT(p.id) as total_atividades
    FROM usuarios u
    LEFT JOIN pontos p ON u.id = p.usuario_id
    WHERE u.ativo = 1
    GROUP BY u.id
    ORDER BY total_pontos DESC
  `, (err, ranking) => {
    if (err) {
      console.error('❌ [EXPORT] Erro ao buscar ranking:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao gerar ranking' });
    }
    
    if (formato === 'csv') {
      // Gerar CSV
      const csvHeader = 'Posição,Nome,Email,Setor,Pontos,Atividades\n';
      const csvRows = ranking.map((user, index) => 
        `${index + 1},"${user.nome}","${user.email}","${user.setor}",${user.total_pontos},${user.total_atividades}`
      ).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="ranking-${month || 'atual'}.csv"`);
      res.send('\ufeff' + csvContent); // BOM para UTF-8
    } else {
      // Para Excel e PDF, retornar dados estruturados
      res.json({
        ok: true,
        formato,
        data: ranking,
        message: `Dados preparados para export ${formato.toUpperCase()}`
      });
    }
  });
});

// Rota catch-all para SPAs (deve ser a última)
app.get('*', (req, res) => {
  // Para rotas de API que não existem
  if (req.path.startsWith('/api/')) {
    console.log('❌ [API] Rota não encontrada:', req.path);
    return res.status(404).json({ 
      ok: false, 
      error: 'Route not found',
      path: req.path,
      method: req.method
    });
  }
  
  // Para outras rotas, servir o index.html (SPA)
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ ok: false, error: 'Application not built' });
  }
});

// ==================== TRATAMENTO DE ERROS ROBUSTO ====================

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('💥 [FATAL] Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  
  // Não encerrar o processo, apenas logar
  console.log('🔄 [RECOVERY] Processo mantido ativo após erro não capturado');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [FATAL] Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  
  // Não encerrar o processo, apenas logar
  console.log('🔄 [RECOVERY] Processo mantido ativo após promise rejeitada');
});

// Tratamento de sinais do sistema
process.on('SIGTERM', () => {
  console.log('📡 [SIGNAL] SIGTERM recebido, encerrando graciosamente...');
  
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('❌ [DB] Erro ao fechar banco:', err);
      } else {
        console.log('✅ [DB] Banco fechado com sucesso');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('📡 [SIGNAL] SIGINT (Ctrl+C) recebido, encerrando graciosamente...');
  
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('❌ [DB] Erro ao fechar banco:', err);
      } else {
        console.log('✅ [DB] Banco fechado com sucesso');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Middleware global de erro
app.use((error, req, res, next) => {
  console.error('💥 [ERROR] Middleware de erro capturou:', error);
  
  // Não deixar o erro derrubar o servidor
  if (!res.headersSent) {
    res.status(500).json({ 
      ok: false, 
      error: isDev ? error.message : 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== INICIALIZAÇÃO DO SERVIDOR ====================

const startServer = async () => {
  try {
    console.log('🚀 [INIT] Iniciando servidor...');
    console.log('🌍 [INIT] Ambiente:', process.env.NODE_ENV || 'development');
    
    // Inicializar banco de dados
    await initializeDatabase();
    
    // Iniciar servidor HTTP
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('✅ [SERVER] Servidor rodando em:');
      console.log(`   🌐 Local:    http://localhost:${PORT}`);
      console.log(`   🌐 Network:  http://0.0.0.0:${PORT}`);
      console.log('');
      console.log('📚 [INFO] Rotas disponíveis:');
      console.log('   🔐 POST /auth/login');
      console.log('   🚪 POST /auth/logout');
      console.log('   👤 GET  /api/me');
      console.log('   📅 GET  /api/reservas');
      console.log('   📢 GET  /api/mural/posts');
      console.log('   🍽️ GET  /api/trocas-proteina');
      console.log('   💻 GET  /api/ti/solicitacoes');
      console.log('   🚪 GET  /api/portaria/agendamentos');
      console.log('   📊 GET  /api/admin/dashboard');
      console.log('');
      console.log('🎯 [READY] Sistema pronto para uso!');
    });
    
    // Configurar timeout do servidor
    server.timeout = 30000; // 30 segundos
    
    // Tratamento de erro do servidor HTTP
    server.on('error', (error) => {
      console.error('💥 [SERVER] Erro no servidor HTTP:', error);
      
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ [SERVER] Porta ${PORT} já está em uso`);
        console.log('💡 [TIP] Tente mudar a porta ou encerrar outros processos');
      }
    });
    
    // Configurar keep-alive
    server.keepAliveTimeout = 65000; // 65 segundos
    server.headersTimeout = 66000; // 66 segundos (deve ser > keep-alive)
    
  } catch (error) {
    console.error('💥 [FATAL] Erro ao inicializar servidor:', error);
    console.error('Stack:', error.stack);
    
    // Tentar novamente em 3 segundos
    console.log('🔄 [RETRY] Tentando novamente em 3 segundos...');
    setTimeout(startServer, 3000);
  }
};

// Verificar dependências antes de iniciar
const checkDependencies = () => {
  const required = [
    'express', 'cors', 'cookie-parser', 'express-session', 
    'morgan', 'bcryptjs', 'jsonwebtoken', 'sqlite3', 
    'passport', 'passport-local'
  ];
  
  const missing = [];
  
  for (const dep of required) {
    try {
      require(dep);
    } catch (e) {
      missing.push(dep);
    }
  }
  
  if (missing.length > 0) {
    console.error('❌ [DEPS] Dependências faltantes:', missing.join(', '));
    console.log('💡 [TIP] Execute: npm install');
    process.exit(1);
  }
  
  console.log('✅ [DEPS] Todas as dependências estão disponíveis');
};

// Iniciar aplicação
if (require.main === module) {
  console.log('🎬 [START] Iniciando Intranet Cropfield...');
  console.log('📅 [START] Timestamp:', new Date().toISOString());
  
  checkDependencies();
  startServer();
}

module.exports = app;