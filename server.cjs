#!/usr/bin/env node
// server.cjs - Servidor Express simplificado e robusto

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

// Configurações básicas
const app = express();
const PORT = process.env.PORT || 3005;
const isDev = process.env.NODE_ENV !== 'production';

console.log('🚀 [INIT] Iniciando servidor simplificado...');

// Criar diretório de dados
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ [INIT] Diretório data criado');
}

// Banco SQLite
const dbPath = path.join(dataDir, 'database.sqlite');
console.log('📁 [DB] Caminho do banco:', dbPath);

let db;

// Middleware básico
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logs simples
app.use((req, res, next) => {
  console.log(`📡 [REQ] ${req.method} ${req.path}`);
  next();
});

// Inicializar banco
const initDB = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ [DB] Erro:', err.message);
        reject(err);
        return;
      }
      
      console.log('✅ [DB] Conectado');
      
      // Criar tabelas básicas
      const createTables = [
        `CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          senha TEXT,
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
        db.run(sql, (err) => {
          if (err) console.error('❌ [DB] Erro tabela:', err.message);
          completed++;
          if (completed === createTables.length) {
            createAdminUser().then(resolve).catch(reject);
          }
        });
      });
    });
  });
};

// Criar usuário admin
const createAdminUser = async () => {
  return new Promise((resolve) => {
    db.get('SELECT id FROM usuarios WHERE email = ?', ['admin@grupocropfield.com.br'], async (err, row) => {
      if (!row) {
        try {
          const hashedPassword = await bcrypt.hash('admin123', 10);
          db.run(
            'INSERT INTO usuarios (nome, email, senha, setor, role) VALUES (?, ?, ?, ?, ?)',
            ['Administrador', 'admin@grupocropfield.com.br', hashedPassword, 'TI', 'admin'],
            (err) => {
              if (err) console.error('❌ [DB] Erro admin:', err.message);
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

// Middleware de auth simples
const authenticate = (req, res, next) => {
  // Para desenvolvimento, sempre autenticar como admin
  req.user = { 
    id: 1, 
    nome: 'Administrador', 
    email: 'admin@grupocropfield.com.br', 
    setor: 'TI', 
    role: 'admin' 
  };
  next();
};

// ==================== ROTAS BÁSICAS ====================

// Auth
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
      
      const isValid = await bcrypt.compare(password, user.senha);
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
          avatar: user.foto
        }
      });
    });
  } catch (error) {
    console.error('❌ [AUTH] Erro geral:', error);
    res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

app.get('/auth/google', (req, res) => {
  console.log('🔗 [GOOGLE] Redirecionamento solicitado');
  res.json({ ok: false, error: 'Google OAuth não configurado neste ambiente' });
});

app.post('/auth/logout', (req, res) => {
  console.log('🚪 [AUTH] Logout');
  res.json({ ok: true, message: 'Logout realizado' });
});

app.get('/api/me', authenticate, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// Reservas
app.get('/api/reservas', authenticate, (req, res) => {
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
    function(err) {
      if (err) {
        console.error('❌ [RESERVAS] Erro:', err);
        return res.status(500).json({ ok: false, error: 'Erro ao criar reserva' });
      }
      
      console.log('✅ [RESERVAS] Criada ID:', this.lastID);
      res.json({ ok: true, id: this.lastID, points: 10 });
    }
  );
});

// Mural
app.get('/api/mural/posts', authenticate, (req, res) => {
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
    function(err) {
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

// Trocas de proteína
app.get('/api/trocas-proteina', authenticate, (req, res) => {
  console.log('🍽️ [TROCAS] Listando');
  res.json({ ok: true, trocas: [] });
});

app.post('/api/trocas-proteina/bulk', authenticate, (req, res) => {
  const { trocas } = req.body;
  console.log('🍽️ [TROCAS] Bulk save:', trocas?.length);
  res.json({ ok: true, inseridas: trocas?.length || 0, totalPoints: (trocas?.length || 0) * 5 });
});

// TI
app.get('/api/ti/solicitacoes', authenticate, (req, res) => {
  console.log('💻 [TI] Listando todas');
  res.json({ ok: true, solicitacoes: [] });
});

app.get('/api/ti/minhas', authenticate, (req, res) => {
  console.log('💻 [TI] Minhas solicitações');
  res.json({ ok: true, solicitacoes: [] });
});

app.post('/api/ti/solicitacoes', authenticate, (req, res) => {
  const { titulo } = req.body;
  console.log('💻 [TI] Nova solicitação:', titulo);
  res.json({ ok: true, id: Date.now(), points: 5 });
});

// Portaria
app.get('/api/portaria/agendamentos', authenticate, (req, res) => {
  console.log('🚪 [PORTARIA] Listando');
  res.json({ ok: true, agendamentos: [] });
});

app.post('/api/portaria/agendamentos', authenticate, (req, res) => {
  const { visitante } = req.body;
  console.log('🚪 [PORTARIA] Agendando:', visitante);
  res.json({ ok: true, id: Date.now(), points: 8 });
});

// Admin
app.get('/api/admin/dashboard', authenticate, (req, res) => {
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

app.get('/api/admin/users', authenticate, (req, res) => {
  console.log('👥 [ADMIN] Listando usuários');
  res.json({ ok: true, users: [] });
});

app.post('/api/admin/users', authenticate, (req, res) => {
  console.log('👥 [ADMIN] Criando usuário');
  res.json({ ok: true, id: Date.now() });
});

app.get('/api/admin/export/*', authenticate, (req, res) => {
  console.log('📊 [EXPORT] Export solicitado:', req.path);
  res.json({ ok: true, data: [], message: 'Export simulado' });
});

// Middleware de erro
app.use((error, req, res, next) => {
  console.error('💥 [ERROR]', error.message);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

// 404 para APIs
app.use('/api/*', (req, res) => {
  console.log('❌ [404] API não encontrada:', req.path);
  res.status(404).json({ 
    ok: false, 
    error: 'Route not found',
    path: req.path 
  });
});

// Servir arquivos estáticos se existirem
app.use(express.static('dist'));

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('App não construído. Execute: npm run build');
  }
});

// Inicializar servidor
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

// Tratamento de erros globais sem encerrar processo
process.on('uncaughtException', (error) => {
  console.error('💥 [UNCAUGHT]', error.message);
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