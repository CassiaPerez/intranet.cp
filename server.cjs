#!/usr/bin/env node
// server.cjs - Servidor Express robusto para Intranet Cropfield

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

// ==================== CONFIGURAÇÃO ====================
const app = express();
const PORT = process.env.PORT || 3005;
const isDev = process.env.NODE_ENV !== 'production';

console.log('🚀 [INIT] Iniciando servidor Intranet Cropfield...');
console.log('🌍 [ENV] Ambiente:', isDev ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');

// Configurar diretório de dados
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('📁 [INIT] Diretório data/ criado');
}

// Banco de dados
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

// Sessões
app.use(session({
  secret: 'cropfield-intranet-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Para HTTP local
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Logs de requisições
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== FUNÇÕES DO BANCO ====================
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('❌ [DB] Erro run:', err.message);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('❌ [DB] Erro get:', err.message);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('❌ [DB] Erro all:', err.message);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// ==================== INICIALIZAÇÃO DB ====================
const initDatabase = async () => {
  return new Promise((resolve, reject) => {
    console.log('🗄️ [DB] Conectando ao banco:', dbPath);
    
    db = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('❌ [DB] Falha na conexão:', err.message);
        reject(err);
        return;
      }

      console.log('✅ [DB] Conectado com sucesso');

      try {
        // Criar tabelas
        await createTables();
        
        // Criar usuário admin
        await createDefaultUsers();
        
        console.log('✅ [DB] Inicialização completa');
        resolve();
      } catch (error) {
        console.error('❌ [DB] Erro na inicialização:', error.message);
        reject(error);
      }
    });
  });
};

const createTables = async () => {
  const tables = [
    {
      name: 'usuarios',
      sql: `CREATE TABLE IF NOT EXISTS usuarios (
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
      )`
    },
    {
      name: 'reservas',
      sql: `CREATE TABLE IF NOT EXISTS reservas (
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
      )`
    },
    {
      name: 'mural_posts',
      sql: `CREATE TABLE IF NOT EXISTS mural_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        pinned BOOLEAN DEFAULT 0,
        ativo BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      )`
    },
    {
      name: 'mural_likes',
      sql: `CREATE TABLE IF NOT EXISTS mural_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, usuario_id),
        FOREIGN KEY (post_id) REFERENCES mural_posts (id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      )`
    },
    {
      name: 'trocas_proteina',
      sql: `CREATE TABLE IF NOT EXISTS trocas_proteina (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        data DATE NOT NULL,
        proteina_original TEXT NOT NULL,
        proteina_nova TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      )`
    },
    {
      name: 'portaria_agendamentos',
      sql: `CREATE TABLE IF NOT EXISTS portaria_agendamentos (
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
      )`
    },
    {
      name: 'ti_solicitacoes',
      sql: `CREATE TABLE IF NOT EXISTS ti_solicitacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        descricao TEXT NOT NULL,
        prioridade TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      )`
    }
  ];

  console.log('🔨 [DB] Criando tabelas...');
  
  for (const table of tables) {
    try {
      await dbRun(table.sql);
      console.log(`✅ [DB] Tabela ${table.name} criada/verificada`);
    } catch (error) {
      console.error(`❌ [DB] Erro ao criar tabela ${table.name}:`, error.message);
      throw error;
    }
  }
};

const createDefaultUsers = async () => {
  try {
    console.log('👤 [DB] Verificando usuários padrão...');
    
    const adminExists = await dbGet('SELECT id FROM usuarios WHERE email = ?', ['admin@grupocropfield.com.br']);
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await dbRun(
        'INSERT INTO usuarios (nome, email, senha, setor, role) VALUES (?, ?, ?, ?, ?)',
        ['Administrador do Sistema', 'admin@grupocropfield.com.br', hashedPassword, 'TI', 'admin']
      );
      console.log('✅ [DB] Usuário admin criado');
    } else {
      console.log('✅ [DB] Usuário admin já existe');
    }

    // Criar usuário RH se não existir
    const rhExists = await dbGet('SELECT id FROM usuarios WHERE email = ?', ['rh@grupocropfield.com.br']);
    
    if (!rhExists) {
      const hashedPassword = await bcrypt.hash('rh123', 10);
      await dbRun(
        'INSERT INTO usuarios (nome, email, senha, setor, role) VALUES (?, ?, ?, ?, ?)',
        ['RH Sistema', 'rh@grupocropfield.com.br', hashedPassword, 'RH', 'rh']
      );
      console.log('✅ [DB] Usuário RH criado');
    }

    // Criar usuário comum se não existir
    const userExists = await dbGet('SELECT id FROM usuarios WHERE email = ?', ['user@grupocropfield.com.br']);
    
    if (!userExists) {
      const hashedPassword = await bcrypt.hash('user123', 10);
      await dbRun(
        'INSERT INTO usuarios (nome, email, senha, setor, role) VALUES (?, ?, ?, ?, ?)',
        ['Usuário Teste', 'user@grupocropfield.com.br', hashedPassword, 'Geral', 'colaborador']
      );
      console.log('✅ [DB] Usuário teste criado');
    }

  } catch (error) {
    console.error('❌ [DB] Erro ao criar usuários padrão:', error.message);
    throw error;
  }
};

// ==================== MIDDLEWARE DE AUTH ====================
const authenticate = async (req, res, next) => {
  try {
    // Verificar sessão
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

    // Se não tem sessão, retornar erro 401
    res.status(401).json({ ok: false, error: 'Não autenticado' });
  } catch (error) {
    console.error('❌ [AUTH] Erro middleware:', error.message);
    res.status(500).json({ ok: false, error: 'Erro de autenticação' });
  }
};

// ==================== ROTAS DE AUTENTICAÇÃO ====================
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 [AUTH] Tentativa de login:', email);

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email e senha são obrigatórios' });
    }

    const user = await dbGet('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [email]);
    
    if (!user) {
      console.log('❌ [AUTH] Usuário não encontrado:', email);
      return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
    }

    const isValidPassword = await bcrypt.compare(password, user.senha);
    
    if (!isValidPassword) {
      console.log('❌ [AUTH] Senha incorreta para:', email);
      return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
    }

    // Criar sessão
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    const userData = {
      id: user.id,
      name: user.nome,
      email: user.email,
      sector: user.setor,
      setor: user.setor,
      role: user.role,
      avatar: user.foto
    };

    console.log('✅ [AUTH] Login bem-sucedido:', email);
    res.json({ ok: true, user: userData });

  } catch (error) {
    console.error('❌ [AUTH] Erro no login:', error.message);
    res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ [AUTH] Erro no logout:', err.message);
    } else {
      console.log('🚪 [AUTH] Logout realizado');
    }
    res.json({ ok: true, message: 'Logout realizado' });
  });
});

app.get('/api/me', authenticate, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ==================== ROTAS DE USUÁRIOS ====================
app.get('/api/admin/users', authenticate, async (req, res) => {
  try {
    console.log('👥 [ADMIN] Carregando usuários...');
    
    const users = await dbAll(`
      SELECT id, nome, email, setor, role, ativo, created_at
      FROM usuarios 
      ORDER BY created_at DESC
    `);

    console.log(`✅ [ADMIN] ${users.length} usuários carregados`);
    res.json({ ok: true, users });

  } catch (error) {
    console.error('❌ [ADMIN] Erro ao carregar usuários:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar usuários' });
  }
});

app.post('/api/admin/users', authenticate, async (req, res) => {
  try {
    const { nome, email, senha, setor = 'Geral', role = 'colaborador' } = req.body;
    
    console.log('👤 [ADMIN] Criando usuário:', { nome, email, setor, role });

    if (!nome || !email || !senha) {
      return res.status(400).json({ ok: false, error: 'Nome, email e senha são obrigatórios' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ ok: false, error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    // Verificar se email já existe
    const existingUser = await dbGet('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ ok: false, error: 'Este email já está em uso' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(senha, 10);

    // Inserir usuário
    const result = await dbRun(
      'INSERT INTO usuarios (nome, email, senha, setor, role, ativo) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, email, hashedPassword, setor, role, 1]
    );

    console.log('✅ [ADMIN] Usuário criado com ID:', result.lastID);
    res.json({ ok: true, id: result.lastID, message: 'Usuário criado com sucesso' });

  } catch (error) {
    console.error('❌ [ADMIN] Erro ao criar usuário:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao criar usuário' });
  }
});

app.patch('/api/admin/users/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    console.log('✏️ [ADMIN] Atualizando usuário:', userId, updates);

    const allowedFields = ['nome', 'email', 'setor', 'role', 'ativo'];
    const validUpdates = {};
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        validUpdates[field] = updates[field];
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ ok: false, error: 'Nenhum campo válido para atualizar' });
    }

    // Adicionar updated_at
    validUpdates.updated_at = new Date().toISOString();

    const setClause = Object.keys(validUpdates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(validUpdates);
    values.push(userId);

    const result = await dbRun(
      `UPDATE usuarios SET ${setClause} WHERE id = ?`,
      values
    );

    if (result.changes === 0) {
      return res.status(404).json({ ok: false, error: 'Usuário não encontrado' });
    }

    console.log('✅ [ADMIN] Usuário atualizado:', userId);
    res.json({ ok: true, message: 'Usuário atualizado com sucesso' });

  } catch (error) {
    console.error('❌ [ADMIN] Erro ao atualizar usuário:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao atualizar usuário' });
  }
});

app.patch('/api/admin/users/:userId/password', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { senha } = req.body;
    
    console.log('🔑 [ADMIN] Resetando senha do usuário:', userId);

    if (!senha || senha.length < 6) {
      return res.status(400).json({ ok: false, error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);
    
    const result = await dbRun(
      'UPDATE usuarios SET senha = ?, updated_at = ? WHERE id = ?',
      [hashedPassword, new Date().toISOString(), userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ ok: false, error: 'Usuário não encontrado' });
    }

    console.log('✅ [ADMIN] Senha alterada para usuário:', userId);
    res.json({ ok: true, message: 'Senha alterada com sucesso' });

  } catch (error) {
    console.error('❌ [ADMIN] Erro ao alterar senha:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao alterar senha' });
  }
});

// ==================== ROTAS DE RESERVAS ====================
app.get('/api/reservas', authenticate, async (req, res) => {
  try {
    console.log('📅 [RESERVAS] Carregando reservas...');
    
    const reservas = await dbAll(`
      SELECT 
        r.*,
        u.nome as responsavel
      FROM reservas r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.status = 'ativa'
      ORDER BY r.data, r.inicio
    `);

    console.log(`✅ [RESERVAS] ${reservas.length} reservas carregadas`);
    res.json({ ok: true, reservas });

  } catch (error) {
    console.error('❌ [RESERVAS] Erro ao carregar:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar reservas' });
  }
});

app.post('/api/reservas', authenticate, async (req, res) => {
  try {
    const { sala, data, inicio, fim, assunto, descricao = '' } = req.body;
    
    console.log('📅 [RESERVAS] Criando reserva:', { sala, data, inicio, fim, assunto });

    if (!sala || !data || !inicio || !fim || !assunto) {
      return res.status(400).json({ ok: false, error: 'Todos os campos são obrigatórios' });
    }

    // Verificar conflitos
    const conflitos = await dbAll(`
      SELECT id FROM reservas 
      WHERE sala = ? AND data = ? AND status = 'ativa'
      AND ((inicio <= ? AND fim > ?) OR (inicio < ? AND fim >= ?))
    `, [sala, data, inicio, inicio, fim, fim]);

    if (conflitos.length > 0) {
      return res.status(409).json({ ok: false, error: 'Horário já reservado para esta sala' });
    }

    const result = await dbRun(
      'INSERT INTO reservas (usuario_id, sala, data, inicio, fim, assunto, descricao) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, sala, data, inicio, fim, assunto, descricao]
    );

    console.log('✅ [RESERVAS] Reserva criada com ID:', result.lastID);
    res.json({ ok: true, id: result.lastID, points: 10 });

  } catch (error) {
    console.error('❌ [RESERVAS] Erro ao criar:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao criar reserva' });
  }
});

// ==================== ROTAS DO MURAL ====================
app.get('/api/mural/posts', authenticate, async (req, res) => {
  try {
    console.log('📢 [MURAL] Carregando posts...');
    
    const posts = await dbAll(`
      SELECT 
        p.*,
        u.nome as author,
        (SELECT COUNT(*) FROM mural_likes l WHERE l.post_id = p.id) as likes_count,
        0 as comments_count
      FROM mural_posts p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.ativo = 1
      ORDER BY p.pinned DESC, p.created_at DESC
    `);

    console.log(`✅ [MURAL] ${posts.length} posts carregados`);
    res.json({ ok: true, posts });

  } catch (error) {
    console.error('❌ [MURAL] Erro ao carregar posts:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar posts' });
  }
});

app.post('/api/mural/posts', authenticate, async (req, res) => {
  try {
    const { titulo, conteudo, pinned = false } = req.body;
    
    console.log('📢 [MURAL] Criando post:', titulo);

    if (!titulo || !conteudo) {
      return res.status(400).json({ ok: false, error: 'Título e conteúdo são obrigatórios' });
    }

    const result = await dbRun(
      'INSERT INTO mural_posts (usuario_id, titulo, conteudo, pinned) VALUES (?, ?, ?, ?)',
      [req.user.id, titulo, conteudo, pinned ? 1 : 0]
    );

    console.log('✅ [MURAL] Post criado com ID:', result.lastID);
    res.json({ ok: true, id: result.lastID, points: 15 });

  } catch (error) {
    console.error('❌ [MURAL] Erro ao criar post:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao criar post' });
  }
});

app.post('/api/mural/:postId/like', authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    console.log('👍 [MURAL] Processando like:', postId);

    // Verificar se já curtiu
    const existingLike = await dbGet(
      'SELECT id FROM mural_likes WHERE post_id = ? AND usuario_id = ?',
      [postId, req.user.id]
    );

    if (existingLike) {
      // Remover like
      await dbRun('DELETE FROM mural_likes WHERE id = ?', [existingLike.id]);
      res.json({ ok: true, action: 'unliked' });
    } else {
      // Adicionar like
      await dbRun(
        'INSERT INTO mural_likes (post_id, usuario_id) VALUES (?, ?)',
        [postId, req.user.id]
      );
      res.json({ ok: true, action: 'liked', points: 2 });
    }

  } catch (error) {
    console.error('❌ [MURAL] Erro no like:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao processar like' });
  }
});

app.post('/api/mural/:postId/comments', authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    const { texto } = req.body;
    
    console.log('💬 [MURAL] Criando comentário:', postId);

    if (!texto || !texto.trim()) {
      return res.status(400).json({ ok: false, error: 'Texto do comentário é obrigatório' });
    }

    // Simular criação de comentário (você pode criar tabela específica depois)
    const commentId = Date.now();

    console.log('✅ [MURAL] Comentário criado:', commentId);
    res.json({ ok: true, id: commentId, points: 3 });

  } catch (error) {
    console.error('❌ [MURAL] Erro no comentário:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao criar comentário' });
  }
});

// ==================== ROTAS DE TROCAS ====================
app.get('/api/trocas-proteina', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;
    console.log('🍽️ [TROCAS] Carregando período:', from, 'até', to);
    
    let sql = 'SELECT * FROM trocas_proteina WHERE usuario_id = ?';
    let params = [req.user.id];
    
    if (from && to) {
      sql += ' AND data BETWEEN ? AND ?';
      params.push(from, to);
    }
    
    sql += ' ORDER BY data';
    
    const trocas = await dbAll(sql, params);

    console.log(`✅ [TROCAS] ${trocas.length} trocas carregadas`);
    res.json({ ok: true, trocas });

  } catch (error) {
    console.error('❌ [TROCAS] Erro ao carregar:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar trocas' });
  }
});

app.post('/api/trocas-proteina/bulk', authenticate, async (req, res) => {
  try {
    const { trocas } = req.body;
    
    console.log('🍽️ [TROCAS] Salvamento em lote:', trocas?.length);

    if (!Array.isArray(trocas) || trocas.length === 0) {
      return res.status(400).json({ ok: false, error: 'Lista de trocas inválida' });
    }

    let inseridas = 0;

    for (const troca of trocas) {
      try {
        await dbRun(
          'INSERT OR REPLACE INTO trocas_proteina (usuario_id, data, proteina_original, proteina_nova) VALUES (?, ?, ?, ?)',
          [req.user.id, troca.data, troca.proteina_original, troca.proteina_nova]
        );
        inseridas++;
      } catch (error) {
        console.error('❌ [TROCAS] Erro em troca individual:', error.message);
      }
    }

    const totalPoints = inseridas * 5;
    console.log(`✅ [TROCAS] ${inseridas} trocas salvas, ${totalPoints} pontos`);
    res.json({ ok: true, inseridas, totalPoints });

  } catch (error) {
    console.error('❌ [TROCAS] Erro no salvamento:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao salvar trocas' });
  }
});

// ==================== ROTAS DE TI ====================
app.get('/api/ti/solicitacoes', authenticate, async (req, res) => {
  try {
    console.log('💻 [TI] Carregando todas as solicitações...');
    
    const solicitacoes = await dbAll(`
      SELECT 
        s.*,
        u.nome,
        u.email
      FROM ti_solicitacoes s
      LEFT JOIN usuarios u ON s.usuario_id = u.id
      ORDER BY s.created_at DESC
    `);

    console.log(`✅ [TI] ${solicitacoes.length} solicitações carregadas`);
    res.json({ ok: true, solicitacoes });

  } catch (error) {
    console.error('❌ [TI] Erro ao carregar solicitações:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar solicitações' });
  }
});

app.get('/api/ti/minhas', authenticate, async (req, res) => {
  try {
    console.log('💻 [TI] Carregando minhas solicitações...');
    
    const solicitacoes = await dbAll(`
      SELECT * FROM ti_solicitacoes 
      WHERE usuario_id = ?
      ORDER BY created_at DESC
    `, [req.user.id]);

    console.log(`✅ [TI] ${solicitacoes.length} solicitações do usuário carregadas`);
    res.json({ ok: true, solicitacoes });

  } catch (error) {
    console.error('❌ [TI] Erro ao carregar solicitações do usuário:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar suas solicitações' });
  }
});

app.post('/api/ti/solicitacoes', authenticate, async (req, res) => {
  try {
    const { titulo, descricao, prioridade = 'medium' } = req.body;
    
    console.log('💻 [TI] Nova solicitação:', titulo);

    if (!titulo || !descricao) {
      return res.status(400).json({ ok: false, error: 'Título e descrição são obrigatórios' });
    }

    const result = await dbRun(
      'INSERT INTO ti_solicitacoes (usuario_id, titulo, descricao, prioridade) VALUES (?, ?, ?, ?)',
      [req.user.id, titulo, descricao, prioridade]
    );

    console.log('✅ [TI] Solicitação criada com ID:', result.lastID);
    res.json({ ok: true, id: result.lastID, points: 5 });

  } catch (error) {
    console.error('❌ [TI] Erro ao criar solicitação:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao criar solicitação' });
  }
});

// ==================== ROTAS DA PORTARIA ====================
app.get('/api/portaria/agendamentos', authenticate, async (req, res) => {
  try {
    console.log('🚪 [PORTARIA] Carregando agendamentos...');
    
    const agendamentos = await dbAll(`
      SELECT 
        p.*,
        u.nome as responsavel
      FROM portaria_agendamentos p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      ORDER BY p.data DESC, p.hora DESC
      LIMIT 50
    `);

    console.log(`✅ [PORTARIA] ${agendamentos.length} agendamentos carregados`);
    res.json({ ok: true, agendamentos });

  } catch (error) {
    console.error('❌ [PORTARIA] Erro ao carregar:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar agendamentos' });
  }
});

app.post('/api/portaria/agendamentos', authenticate, async (req, res) => {
  try {
    const { data, hora, visitante, documento = '', observacao = '' } = req.body;
    
    console.log('🚪 [PORTARIA] Novo agendamento:', visitante);

    if (!data || !hora || !visitante) {
      return res.status(400).json({ ok: false, error: 'Data, hora e visitante são obrigatórios' });
    }

    const result = await dbRun(
      'INSERT INTO portaria_agendamentos (usuario_id, data, hora, visitante, documento, observacao) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, data, hora, visitante, documento, observacao]
    );

    console.log('✅ [PORTARIA] Agendamento criado com ID:', result.lastID);
    res.json({ ok: true, id: result.lastID, points: 6 });

  } catch (error) {
    console.error('❌ [PORTARIA] Erro ao criar agendamento:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao criar agendamento' });
  }
});

// ==================== ROTAS ADMINISTRATIVAS ====================
app.get('/api/admin/dashboard', authenticate, async (req, res) => {
  try {
    console.log('📊 [ADMIN] Carregando dashboard...');
    
    const stats = {
      usuarios_ativos: await dbGet('SELECT COUNT(*) as count FROM usuarios WHERE ativo = 1').then(r => r.count),
      posts_mural: await dbGet('SELECT COUNT(*) as count FROM mural_posts WHERE ativo = 1').then(r => r.count),
      reservas_salas: await dbGet('SELECT COUNT(*) as count FROM reservas WHERE status = "ativa"').then(r => r.count),
      solicitacoes_ti: await dbGet('SELECT COUNT(*) as count FROM ti_solicitacoes').then(r => r.count),
      trocas_proteina: await dbGet('SELECT COUNT(*) as count FROM trocas_proteina').then(r => r.count),
      agendamentos_portaria: await dbGet('SELECT COUNT(*) as count FROM portaria_agendamentos').then(r => r.count)
    };

    const ranking = await dbAll(`
      SELECT nome, pontos as total_pontos, foto
      FROM usuarios 
      WHERE ativo = 1 
      ORDER BY pontos DESC 
      LIMIT 10
    `);

    console.log('✅ [ADMIN] Dashboard carregado');
    res.json({ 
      ok: true, 
      stats, 
      ranking,
      userPoints: req.user.pontos || 0,
      breakdown: []
    });

  } catch (error) {
    console.error('❌ [ADMIN] Erro no dashboard:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao carregar dashboard' });
  }
});

// ==================== ROTAS DE EXPORT ====================
app.get('/api/admin/export/:filename', authenticate, async (req, res) => {
  try {
    const { filename } = req.params;
    console.log('📊 [EXPORT] Solicitação de export:', filename);

    if (filename.includes('ranking.csv')) {
      const ranking = await dbAll(`
        SELECT nome, email, setor, pontos, created_at
        FROM usuarios 
        WHERE ativo = 1 
        ORDER BY pontos DESC
      `);

      const csvHeader = 'Nome,Email,Setor,Pontos,Data Cadastro\n';
      const csvData = ranking.map(user => 
        `"${user.nome}","${user.email}","${user.setor}",${user.pontos},"${user.created_at}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=ranking.csv');
      res.send(csvHeader + csvData);
    } else if (filename.includes('trocas-proteina.csv')) {
      const trocas = await dbAll(`
        SELECT 
          t.*,
          u.nome as usuario_nome,
          u.email as usuario_email,
          u.setor as usuario_setor
        FROM trocas_proteina t
        LEFT JOIN usuarios u ON t.usuario_id = u.id
        ORDER BY t.created_at DESC
      `);

      const csvHeader = 'Data,Usuario,Email,Setor,Proteina Original,Proteina Nova,Data Solicitacao\n';
      const csvData = trocas.map(troca => 
        `"${troca.data}","${troca.usuario_nome || ''}","${troca.usuario_email || ''}","${troca.usuario_setor || ''}","${troca.proteina_original}","${troca.proteina_nova}","${troca.created_at}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=trocas-proteina.csv');
      res.send(csvHeader + csvData);
    } else if (filename.includes('equipamentos.csv')) {
      const equipamentos = await dbAll(`
        SELECT 
          s.*,
          u.nome as usuario_nome,
          u.email as usuario_email,
          u.setor as usuario_setor
        FROM ti_solicitacoes s
        LEFT JOIN usuarios u ON s.usuario_id = u.id
        ORDER BY s.created_at DESC
      `);

      const csvHeader = 'ID,Usuario,Email,Setor,Equipamento,Descricao,Prioridade,Status,Data Solicitacao\n';
      const csvData = equipamentos.map(eq => 
        `"${eq.id}","${eq.usuario_nome || ''}","${eq.usuario_email || ''}","${eq.usuario_setor || ''}","${eq.titulo}","${eq.descricao}","${eq.prioridade}","${eq.status}","${eq.created_at}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=equipamentos.csv');
      res.send(csvHeader + csvData);
    } else if (filename.includes('reservas.csv')) {
      const reservas = await dbAll(`
        SELECT 
          r.*,
          u.nome as usuario_nome,
          u.email as usuario_email,
          u.setor as usuario_setor
        FROM reservas r
        LEFT JOIN usuarios u ON r.usuario_id = u.id
        ORDER BY r.created_at DESC
      `);

      const csvHeader = 'ID,Usuario,Email,Setor,Sala,Data,Inicio,Fim,Assunto,Status,Data Criacao\n';
      const csvData = reservas.map(res => 
        `"${res.id}","${res.usuario_nome || ''}","${res.usuario_email || ''}","${res.usuario_setor || ''}","${res.sala}","${res.data}","${res.inicio}","${res.fim}","${res.assunto}","${res.status}","${res.created_at}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=reservas.csv');
      res.send(csvHeader + csvData);
    } else if (filename.includes('portaria.csv')) {
      const agendamentos = await dbAll(`
        SELECT 
          p.*,
          u.nome as responsavel_nome,
          u.email as responsavel_email,
          u.setor as responsavel_setor
        FROM portaria_agendamentos p
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        ORDER BY p.created_at DESC
      `);

      const csvHeader = 'ID,Visitante,Documento,Data Visita,Hora,Responsavel,Email,Setor,Observacao,Status,Data Agendamento\n';
      const csvData = agendamentos.map(ag => 
        `"${ag.id}","${ag.visitante}","${ag.documento || ''}","${ag.data}","${ag.hora}","${ag.responsavel_nome || ''}","${ag.responsavel_email || ''}","${ag.responsavel_setor || ''}","${ag.observacao || ''}","${ag.status}","${ag.created_at}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=portaria.csv');
      res.send(csvHeader + csvData);
    } else if (filename.includes('mural.csv')) {
      const posts = await dbAll(`
        SELECT 
          p.*,
          u.nome as autor_nome,
          u.email as autor_email,
          u.setor as autor_setor,
          (SELECT COUNT(*) FROM mural_likes l WHERE l.post_id = p.id) as total_likes
        FROM mural_posts p
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        ORDER BY p.created_at DESC
      `);

      const csvHeader = 'ID,Titulo,Autor,Email,Setor,Conteudo,Likes,Fixado,Ativo,Data Criacao\n';
      const csvData = posts.map(post => 
        `"${post.id}","${post.titulo}","${post.autor_nome || ''}","${post.autor_email || ''}","${post.autor_setor || ''}","${post.conteudo?.replace(/"/g, '""') || ''}","${post.total_likes}","${post.pinned ? 'Sim' : 'Não'}","${post.ativo ? 'Sim' : 'Não'}","${post.created_at}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=mural.csv');
      res.send(csvHeader + csvData);
    } else {
      res.json({ ok: true, data: [], message: `Export ${filename} simulado` });
    }

  } catch (error) {
    console.error('❌ [EXPORT] Erro:', error.message);
    res.status(500).json({ ok: false, error: 'Erro ao gerar export' });
  }
});

// ==================== MIDDLEWARE DE ERRO ====================
app.use((error, req, res, next) => {
  console.error('💥 [ERROR] Middleware:', error.message || error);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
  }
});

// ==================== 404 PARA APIS ====================
app.use('/api/*', (req, res) => {
  console.log('❌ [404] Rota API não encontrada:', req.path);
  res.status(404).json({ ok: false, error: 'Rota não encontrada', path: req.path });
});

// ==================== ARQUIVOS ESTÁTICOS ====================
if (fs.existsSync(path.join(__dirname, 'dist'))) {
  app.use(express.static(path.join(__dirname, 'dist')));
  console.log('📁 [STATIC] Servindo arquivos do dist/');
} else {
  console.log('⚠️ [STATIC] Diretório dist/ não encontrado');
}

// SPA Fallback
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <h1>Aplicação não construída</h1>
      <p>Execute: <code>npm run build</code></p>
    `);
  }
});

// ==================== INICIALIZAÇÃO ====================
const startServer = async () => {
  try {
    console.log('🗄️ [INIT] Inicializando banco de dados...');
    await initDatabase();

    console.log('🌐 [INIT] Iniciando servidor HTTP...');
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('🎉 =======================================');
      console.log('✅ [SUCCESS] SERVIDOR INTRANET ONLINE!');
      console.log(`🌐 Frontend: http://localhost:5173`);
      console.log(`🔗 Backend:  http://localhost:${PORT}`);
      console.log('🎉 =======================================');
      console.log('');
      console.log('🔑 [CREDENCIAIS] Logins disponíveis:');
      console.log('   👨‍💼 Admin:  admin@grupocropfield.com.br / admin123');
      console.log('   👥 RH:     rh@grupocropfield.com.br / rh123');
      console.log('   👤 User:   user@grupocropfield.com.br / user123');
      console.log('');
    });

    // Configurações do servidor
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    server.requestTimeout = 30000;

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ [SERVER] Porta ${PORT} já está em uso`);
        console.log('💡 [DICA] Tente: killall node && npm run dev');
        process.exit(1);
      } else {
        console.error('❌ [SERVER] Erro do servidor:', error.message);
      }
    });

    server.on('clientError', (err, socket) => {
      console.error('❌ [CLIENT] Erro do cliente:', err.message);
      if (!socket.destroyed) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      }
    });

  } catch (error) {
    console.error('💥 [FATAL] Falha crítica na inicialização:', error.message);
    console.log('🔄 [RETRY] Tentando novamente em 3 segundos...');
    setTimeout(() => {
      startServer().catch(() => {
        console.error('💥 [FATAL] Falha definitiva - encerrando processo');
        process.exit(1);
      });
    }, 3000);
  }
};

// ==================== TRATAMENTO DE PROCESSO ====================
process.on('uncaughtException', (error) => {
  console.error('💥 [UNCAUGHT] Exceção não tratada:', error.message);
  console.log('🛡️ [RECOVERY] Mantendo processo ativo...');
  // NÃO encerrar o processo - apenas logar
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [REJECTION] Promise rejeitada:', reason);
  console.log('🛡️ [RECOVERY] Mantendo processo ativo...');
  // NÃO encerrar o processo - apenas logar
});

process.on('SIGTERM', () => {
  console.log('📡 [SIGNAL] SIGTERM recebido - encerrando graciosamente...');
  if (db) {
    db.close((err) => {
      if (err) console.error('❌ [DB] Erro ao fechar:', err.message);
      else console.log('✅ [DB] Fechado com sucesso');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('📡 [SIGNAL] SIGINT recebido - encerrando graciosamente...');
  if (db) {
    db.close((err) => {
      if (err) console.error('❌ [DB] Erro ao fechar:', err.message);
      else console.log('✅ [DB] Fechado com sucesso');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// ==================== INICIAR APLICAÇÃO ====================
if (require.main === module) {
  console.log('🚀 [START] Iniciando aplicação...');
  startServer().catch((error) => {
    console.error('💥 [FATAL] Erro fatal na inicialização:', error.message);
    process.exit(1);
  });
}

module.exports = app;