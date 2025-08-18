#!/usr/bin/env node
// server.cjs - Servidor Express simplificado e robusto (compatível com Express 5)

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

// ==================== CONFIG BÁSICA ====================
const app = express();
const PORT = process.env.PORT || 3005;
const isDev = process.env.NODE_ENV !== 'production';

console.log('🚀 [INIT] Iniciando servidor simplificado...');

// Diretório de dados
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ [INIT] Diretório data criado');
}

// Banco SQLite
const dbPath = path.join(dataDir, 'database.sqlite');
console.log('📁 [DB] Caminho do banco:', dbPath);
let db;

// ==================== MIDDLEWARES ====================
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logs simples
app.use((req, _res, next) => {
  console.log(`📡 [REQ] ${req.method} ${req.path}`);
  next();
});

// ==================== BANCO/TABELAS ====================
const initDB = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ [DB] Erro:', err.message);
        reject(err);
        return;
      }

      console.log('✅ [DB] Conectado');

      const createTables = [
        `CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          senha TEXT,
          foto TEXT,
          setor TEXT DEFAULT 'Geral',
          role TEXT DEFAULT 'colaborador',
          ativo BOOLEAN DEFAULT 1,
          pontos INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS reservas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER,
          sala TEXT,
          data DATE,
          inicio TIME,
          fim TIME,
          assunto TEXT,
          status TEXT DEFAULT 'ativa',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS mural_posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER,
          titulo TEXT,
          conteudo TEXT,
          pinned BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      let completed = 0;
      createTables.forEach(sql => {
        db.run(sql, (err2) => {
          if (err2) console.error('❌ [DB] Erro tabela:', err2.message);
          completed++;
          if (completed === createTables.length) {
            createAdminUser().then(resolve).catch(reject);
          }
        });
      });
    });
  });
};

// Usuário admin padrão
const createAdminUser = async () => {
  return new Promise((resolve) => {
    db.get('SELECT id FROM usuarios WHERE email = ?', ['admin@grupocropfield.com.br'], async (err, row) => {
      if (err) {
        console.error('❌ [DB] Erro ao checar admin:', err.message);
        resolve();
        return;
      }
      if (!row) {
        try {
          const hashedPassword = await bcrypt.hash('admin123', 10);
          db.run(
            'INSERT INTO usuarios (nome, email, senha, setor, role) VALUES (?, ?, ?, ?, ?)',
            ['Administrador', 'admin@grupocropfield.com.br', hashedPassword, 'TI', 'admin'],
            (err2) => {
              if (err2) console.error('❌ [DB] Erro admin:', err2.message);
              else console.log('✅ [DB] Admin criado');
              resolve();
            }
          );
        } catch (e) {
          console.error('❌ [DB] Erro hash:', e);
          resolve();
        }
      } else {
        console.log('✅ [DB] Admin existe');
        resolve();
      }
    });
  });
};

// ==================== AUTH SIMPLES ====================
const authenticate = (_req, _res, next) => {
  // Dev: finge usuário admin autenticado
  _req.user = {
    id: 1,
    nome: 'Administrador',
    email: 'admin@grupocropfield.com.br',
    setor: 'TI',
    role: 'admin'
  };
  next();
};

// ==================== ROTAS ====================

// ---- Login manual
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('🔐 [AUTH] Login tentativa:', email);

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email e senha obrigatórios' });
  }

  try {
    db.get('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [email], async (err, user) => {
      if (err) {
        console.error('❌ [AUTH] Erro DB:', err);
        return res.status(500).json({ ok: false, error: 'Erro interno' });
      }

      if (!user) {
        console.log('❌ [AUTH] Usuário não encontrado');
        return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
      }

      const isValid = await bcrypt.compare(password, user.senha || '');
      if (!isValid) {
        console.log('❌ [AUTH] Senha incorreta');
        return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
      }

      console.log('✅ [AUTH] Login sucesso');
      res.json({
        ok: true,
        user: {
          id: user.id,
          name: user.nome,
          email: user.email,
          sector: user.setor,
          setor: user.setor,
          role: user.role,
          avatar: user.foto || null
        }
      });
    });
  } catch (error) {
    console.error('❌ [AUTH] Erro geral:', error);
    res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

app.get('/auth/google', (_req, res) => {
  console.log('🔗 [GOOGLE] Redirecionamento solicitado');
  res.json({ ok: false, error: 'Google OAuth não configurado neste ambiente' });
});

app.post('/auth/logout', (_req, res) => {
  console.log('🚪 [AUTH] Logout');
  res.json({ ok: true, message: 'Logout realizado' });
});

app.get('/api/me', authenticate, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ---- Reservas
app.get('/api/reservas', authenticate, (_req, res) => {
  console.log('📅 [RESERVAS] Listando');

  db.all(`
    SELECT r.*, u.nome as responsavel 
    FROM reservas r 
    LEFT JOIN usuarios u ON r.usuario_id = u.id 
    WHERE r.status = 'ativa'
    ORDER BY r.data, r.inicio
  `, (err, rows) => {
    if (err) {
      console.error('❌ [RESERVAS] Erro:', err);
      return res.json({ ok: true, reservas: [] });
    }
    res.json({ ok: true, reservas: rows || [] });
  });
});

app.post('/api/reservas', authenticate, (req, res) => {
  const { sala, data, inicio, fim, assunto } = req.body;
  console.log('📅 [RESERVAS] Criando:', { sala, data, assunto });

  if (!sala || !data || !inicio || !fim || !assunto) {
    return res.status(400).json({ ok: false, error: 'Dados incompletos' });
  }

  db.run(
    'INSERT INTO reservas (usuario_id, sala, data, inicio, fim, assunto) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, sala, data, inicio, fim, assunto],
    function (err) {
      if (err) {
        console.error('❌ [RESERVAS] Erro:', err);
        return res.status(500).json({ ok: false, error: 'Erro ao criar reserva' });
      }

      console.log('✅ [RESERVAS] Criada ID:', this.lastID);
      res.json({ ok: true, id: this.lastID, points: 10 });
    }
  );
});

// ---- Mural
app.get('/api/mural/posts', authenticate, (_req, res) => {
  console.log('📢 [MURAL] Listando posts');

  db.all(`
    SELECT 
      p.*,
      u.nome as author,
      0 as likes_count,
      0 as comments_count
    FROM mural_posts p
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    ORDER BY p.pinned DESC, p.created_at DESC
  `, (err, rows) => {
    if (err) {
      console.error('❌ [MURAL] Erro:', err);
      return res.json({ ok: true, posts: [] });
    }
    res.json({ ok: true, posts: rows || [] });
  });
});

app.post('/api/mural/posts', authenticate, (req, res) => {
  const { titulo, conteudo, pinned = false } = req.body;
  console.log('📢 [MURAL] Criando post:', titulo);

  if (!titulo || !conteudo) {
    return res.status(400).json({ ok: false, error: 'Título e conteúdo obrigatórios' });
  }

  db.run(
    'INSERT INTO mural_posts (usuario_id, titulo, conteudo, pinned) VALUES (?, ?, ?, ?)',
    [req.user.id, titulo, conteudo, pinned ? 1 : 0],
    function (err) {
      if (err) {
        console.error('❌ [MURAL] Erro:', err);
        return res.status(500).json({ ok: false, error: 'Erro ao criar post' });
      }

      console.log('✅ [MURAL] Post criado ID:', this.lastID);
      res.json({ ok: true, id: this.lastID, points: 15 });
    }
  );
});

app.post('/api/mural/:postId/like', authenticate, (req, res) => {
  console.log('👍 [MURAL] Like no post:', req.params.postId);
  res.json({ ok: true, action: 'liked', points: 2 });
});

app.post('/api/mural/:postId/comments', authenticate, (req, res) => {
  console.log('💬 [MURAL] Comentário no post:', req.params.postId);
  res.json({ ok: true, id: Date.now(), points: 3 });
});

// ---- Trocas de proteína
app.get('/api/trocas-proteina', authenticate, (_req, res) => {
  console.log('🍽️ [TROCAS] Listando');
  res.json({ ok: true, trocas: [] });
});

app.post('/api/trocas-proteina/bulk', authenticate, (req, res) => {
  const { trocas } = req.body;
  console.log('🍽️ [TROCAS] Bulk save:', trocas?.length);
  res.json({ ok: true, inseridas: trocas?.length || 0, totalPoints: (trocas?.length || 0) * 5 });
});

// ---- TI
app.get('/api/ti/solicitacoes', authenticate, (_req, res) => {
  console.log('💻 [TI] Listando todas');
  res.json({ ok: true, solicitacoes: [] });
});

app.get('/api/ti/minhas', authenticate, (_req, res) => {
  console.log('💻 [TI] Minhas solicitações');
  res.json({ ok: true, solicitacoes: [] });
});

app.post('/api/ti/solicitacoes', authenticate, (req, res) => {
  const { titulo } = req.body;
  console.log('💻 [TI] Nova solicitação:', titulo);
  res.json({ ok: true, id: Date.now(), points: 5 });
});

// ---- Portaria
app.get('/api/portaria/agendamentos', authenticate, (_req, res) => {
  console.log('🚪 [PORTARIA] Listando');
  res.json({ ok: true, agendamentos: [] });
});

app.post('/api/portaria/agendamentos', authenticate, (req, res) => {
  const { visitante } = req.body;
  console.log('🚪 [PORTARIA] Agendando:', visitante);
  res.json({ ok: true, id: Date.now(), points: 8 });
});

// ---- Admin
app.get('/api/admin/dashboard', authenticate, (_req, res) => {
  console.log('📊 [ADMIN] Dashboard');
  res.json({
    ok: true,
    stats: {
      usuarios_ativos: 5,
      posts_mural: 12,
      reservas_salas: 8,
      solicitacoes_ti: 3,
      trocas_proteina: 15,
      agendamentos_portaria: 4
    },
    ranking: [],
    userPoints: 150,
    breakdown: []
  });
});

// Lista/criação de usuários (agora realmente no banco)
app.get('/api/admin/users', authenticate, (_req, res) => {
  console.log('👥 [ADMIN] Listando usuários');
  db.all(
    `SELECT id, nome, email, foto, setor, role, ativo, pontos, created_at 
     FROM usuarios ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) {
        console.error('❌ [ADMIN] Erro ao listar usuários:', err.message);
        return res.status(500).json({ ok: false, error: 'Erro ao listar usuários' });
      }
      res.json({ ok: true, users: rows || [] });
    }
  );
});

app.post('/api/admin/users', authenticate, async (req, res) => {
  console.log('👥 [ADMIN] Criando usuário');
  const { nome, email, senha, setor = 'Geral', role = 'colaborador', ativo = 1, foto = null } = req.body || {};
  if (!nome || !email || !senha) {
    return res.status(400).json({ ok: false, error: 'nome, email e senha são obrigatórios' });
  }
  try {
    const hashed = await bcrypt.hash(senha, 10);
    db.run(
      `INSERT INTO usuarios (nome, email, senha, setor, role, ativo, foto) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nome, email, hashed, setor, role, ativo ? 1 : 0, foto],
      function (err) {
        if (err) {
          console.error('❌ [ADMIN] Erro ao criar usuário:', err.message);
          const isUnique = /UNIQUE constraint failed/i.test(err.message);
          return res.status(isUnique ? 409 : 500).json({ ok: false, error: isUnique ? 'Email já cadastrado' : 'Erro ao criar usuário' });
        }
        res.json({ ok: true, id: this.lastID });
      }
    );
  } catch (e) {
    console.error('❌ [ADMIN] Erro hash/criação:', e.message);
    res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

// Atualizar usuário
app.patch('/api/admin/users/:userId', authenticate, (req, res) => {
  const { userId } = req.params;
  const { nome, email, setor, role, ativo } = req.body;
  
  console.log('👥 [ADMIN] Atualizando usuário:', userId);
  
  if (!userId) {
    return res.status(400).json({ ok: false, error: 'ID do usuário é obrigatório' });
  }
  
  const updates = [];
  const values = [];
  
  if (nome !== undefined) {
    updates.push('nome = ?');
    values.push(nome);
  }
  if (email !== undefined) {
    updates.push('email = ?');
    values.push(email);
  }
  if (setor !== undefined) {
    updates.push('setor = ?');
    values.push(setor);
  }
  if (role !== undefined) {
    updates.push('role = ?');
    values.push(role);
  }
  if (ativo !== undefined) {
    updates.push('ativo = ?');
    values.push(ativo ? 1 : 0);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nenhum campo para atualizar' });
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(userId);
  
  const sql = `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`;
  
  db.run(sql, values, function (err) {
    if (err) {
      console.error('❌ [ADMIN] Erro ao atualizar usuário:', err.message);
      const isUnique = /UNIQUE constraint failed/i.test(err.message);
      return res.status(isUnique ? 409 : 500).json({ 
        ok: false, 
        error: isUnique ? 'Email já está em uso' : 'Erro ao atualizar usuário' 
      });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ ok: false, error: 'Usuário não encontrado' });
    }
    
    console.log('✅ [ADMIN] Usuário atualizado:', userId);
    res.json({ ok: true, changes: this.changes });
  });
});

// Resetar senha do usuário
app.patch('/api/admin/users/:userId/password', authenticate, async (req, res) => {
  const { userId } = req.params;
  const { senha } = req.body;
  
  console.log('🔑 [ADMIN] Resetando senha do usuário:', userId);
  
  if (!userId || !senha) {
    return res.status(400).json({ ok: false, error: 'ID do usuário e nova senha são obrigatórios' });
  }
  
  if (senha.length < 6) {
    return res.status(400).json({ ok: false, error: 'Senha deve ter pelo menos 6 caracteres' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(senha, 10);
    
    db.run(
      'UPDATE usuarios SET senha = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, userId],
      function (err) {
        if (err) {
          console.error('❌ [ADMIN] Erro ao resetar senha:', err.message);
          return res.status(500).json({ ok: false, error: 'Erro ao resetar senha' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ ok: false, error: 'Usuário não encontrado' });
        }
        
        console.log('✅ [ADMIN] Senha resetada para usuário:', userId);
        res.json({ ok: true, message: 'Senha alterada com sucesso' });
      }
    );
  } catch (error) {
    console.error('❌ [ADMIN] Erro ao fazer hash da senha:', error.message);
    res.status(500).json({ ok: false, error: 'Erro interno ao processar senha' });
  }
});

// Export (corrigido para Express 5: sem "/*")
app.get('/api/admin/export/:filename', authenticate, (req, res) => {
  console.log('📊 [EXPORT] Export solicitado:', req.params.filename || '');
  res.json({ ok: true, data: [], message: 'Export simulado' });
});

// ==================== ERROS / 404 ====================

// Middleware de erro
app.use((error, _req, res, _next) => {
  console.error('💥 [ERROR]', error && error.message ? error.message : error);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

// 404 para APIs (corrigido para Express 5: sem "/api/*")
app.use('/api', (req, res) => {
  console.log('❌ [404] API não encontrada:', req.path);
  res.status(404).json({
    ok: false,
    error: 'Route not found',
    path: req.path
  });
});

// ==================== STATIC / SPA ====================
app.use(express.static('dist'));

// SPA fallback (Express 5: '(.*)' em vez de '*')
app.get('(.*)', (_req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('App não construído. Execute: npm run build');
  }
});

// ==================== START / SHUTDOWN ====================
const startServer = async () => {
  try {
    console.log('🗄️ [INIT] Inicializando banco...');
    await initDB();

    console.log('🌐 [INIT] Iniciando servidor HTTP...');
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('🎉 ====================================');
      console.log('✅ [SUCCESS] Servidor ONLINE!');
      console.log(`🌐 Local:    http://localhost:${PORT}`);
      console.log(`🌐 Network:  http://0.0.0.0:${PORT}`);
      console.log('🎉 ====================================');
      console.log('');
      console.log('📱 [INFO] Acesse a aplicação no navegador');
      console.log('🔑 [INFO] Login: admin@grupocropfield.com.br / admin123');
      console.log('');
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ [SERVER] Porta ${PORT} em uso`);
        console.log('💡 [TIP] Tente: killall node && npm run dev');
      } else {
        console.error('❌ [SERVER] Erro:', error.message);
      }
    });

  } catch (error) {
    console.error('💥 [FATAL] Falha na inicialização:', error.message);
    console.log('🔄 [RETRY] Tentando novamente em 3s...');
    setTimeout(startServer, 3000);
  }
};

// Tratamento global
process.on('uncaughtException', (error) => {
  console.error('💥 [UNCAUGHT]', error.message || error);
  console.log('🔄 [RECOVERY] Processo mantido ativo');
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 [REJECTION]', reason);
  console.log('🔄 [RECOVERY] Processo mantido ativo');
});

// Encerramento gracioso
process.on('SIGTERM', () => {
  console.log('📡 [SIGNAL] SIGTERM - Encerrando...');
  if (db) db.close();
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('📡 [SIGNAL] SIGINT - Encerrando...');
  if (db) db.close();
  process.exit(0);
});

// Iniciar
if (require.main === module) {
  startServer();
}

module.exports = app;
