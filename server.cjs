const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
const PORT = process.env.PORT || 3005;

// Load environment variables
require('dotenv').config();

// Simple in-memory database for demo
let users = [
  {
    id: '1',
    nome: 'Administrador',
    email: 'admin@grupocropfield.com.br',
    senha: bcrypt.hashSync('admin123', 10),
    setor: 'TI',
    role: 'admin',
    ativo: true,
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    nome: 'Usuário RH',
    email: 'rh@grupocropfield.com.br',
    senha: bcrypt.hashSync('rh123', 10),
    setor: 'RH',
    role: 'rh',
    ativo: true,
    created_at: new Date().toISOString()
  },
  {
    id: '3',
    nome: 'Colaborador Teste',
    email: 'user@grupocropfield.com.br',
    senha: bcrypt.hashSync('user123', 10),
    setor: 'Geral',
    role: 'colaborador',
    ativo: true,
    created_at: new Date().toISOString()
  }
];

let reservas = [];
let muralPosts = [];
let muralLikes = [];
let muralComments = [];
let trocasProteina = [];
let agendamentosPortaria = [];
let solicitacoesTI = [];
let pontos = [];
let accessLogs = [];

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Middleware
app.use(morgan('combined'));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session setup for Passport
app.use(require('express-session')({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.find(u => u.id === id);
  done(null, user);
});

// Google OAuth Strategy
console.log('🔧 [AUTH] Configuring Google OAuth...');
console.log('🔐 [GOOGLE] Client ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('🔐 [GOOGLE] Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('🔐 [GOOGLE] Callback URL:', process.env.GOOGLE_CALLBACK_URL || 'NOT SET');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('🔐 [GOOGLE] OAuth callback received for:', profile.emails?.[0]?.value);
      
      // Check if user already exists
      let user = users.find(u => u.email === profile.emails?.[0]?.value);
      
      if (!user) {
        // Create new user from Google profile
        user = {
          id: Date.now().toString(),
          nome: profile.displayName || profile.name?.givenName || 'Usuário Google',
          email: profile.emails?.[0]?.value || '',
          setor: 'Geral',
          role: 'colaborador',
          ativo: true,
          avatar_url: profile.photos?.[0]?.value,
          created_at: new Date().toISOString(),
          google_id: profile.id
        };
        
        users.push(user);
        console.log('🔐 [GOOGLE] Created new user:', user.email);
      } else {
        // Update existing user with Google info
        user.avatar_url = profile.photos?.[0]?.value;
        user.google_id = profile.id;
        console.log('🔐 [GOOGLE] Updated existing user:', user.email);
      }
      
      return done(null, user);
    } catch (error) {
      console.error('🔐 [GOOGLE] OAuth error:', error);
      return done(error, null);
    }
  }));
} else {
  console.log('⚠️ [GOOGLE] OAuth not configured - missing environment variables');
}

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user || !user.ativo) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('🔧 [AUTH] Token verification failed:', error);
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Helper functions
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
};

const normalizeUser = (user) => ({
  id: user.id,
  name: user.nome,
  email: user.email,
  sector: user.setor,
  setor: user.setor,
  role: user.role,
  avatar: user.avatar_url,
  token: generateToken(user.id)
});

// Add points helper
const addPoints = (userId, action, points, details = {}) => {
  const pointEntry = {
    id: Date.now().toString(),
    usuario_id: userId,
    acao: action,
    pontos: points,
    detalhes: JSON.stringify(details),
    created_at: new Date().toISOString()
  };
  
  pontos.push(pointEntry);
  
  // Update user total points
  const user = users.find(u => u.id === userId);
  if (user) {
    user.pontos_gamificacao = (user.pontos_gamificacao || 0) + points;
  }
  
  return points;
};

// ===============================
// AUTH ROUTES
// ===============================

// Manual login
app.post('/auth/login', async (req, res) => {
  try {
    console.log('🔧 [AUTH] Login attempt for:', req.body.email);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      console.log('🔧 [AUTH] User not found:', email);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (!user.ativo) {
      return res.status(401).json({ error: 'Usuário inativo' });
    }

    const isValidPassword = await bcrypt.compare(password, user.senha);
    if (!isValidPassword) {
      console.log('🔧 [AUTH] Invalid password for:', email);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = generateToken(user.id);
    const normalizedUser = normalizeUser(user);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000
    });

    console.log('🔧 [AUTH] Login successful for:', user.email);
    
    // Log access
    accessLogs.push({
      id: Date.now().toString(),
      usuario_id: user.id,
      acao: 'LOGIN',
      modulo: 'AUTH',
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      created_at: new Date().toISOString()
    });

    res.json({
      success: true,
      user: normalizedUser,
      token: token
    });
  } catch (error) {
    console.error('🔧 [AUTH] Login error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Google OAuth routes
app.get('/auth/google', (req, res, next) => {
  console.log('🔐 [GOOGLE] OAuth initiation requested');
  
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.log('⚠️ [GOOGLE] OAuth not configured');
    return res.status(500).json({ error: 'Google OAuth não configurado' });
  }
  
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=google_auth_failed' }),
  (req, res) => {
    try {
      console.log('🔐 [GOOGLE] OAuth callback success for:', req.user?.email);
      
      const token = generateToken(req.user.id);
      const normalizedUser = normalizeUser(req.user);

      // Set cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
      });

      // Log access
      accessLogs.push({
        id: Date.now().toString(),
        usuario_id: req.user.id,
        acao: 'GOOGLE_LOGIN',
        modulo: 'AUTH',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        created_at: new Date().toISOString()
      });

      // Redirect to frontend with success
      res.redirect('/?login=success');
    } catch (error) {
      console.error('🔐 [GOOGLE] Callback error:', error);
      res.redirect('/login?error=callback_failed');
    }
  }
);

// Check authentication status
app.get('/api/me', authMiddleware, (req, res) => {
  console.log('🔧 [AUTH] Auth check for:', req.user.email);
  res.json({ 
    success: true, 
    user: normalizeUser(req.user) 
  });
});

// Logout
app.post('/auth/logout', (req, res) => {
  console.log('🔧 [AUTH] Logout requested');
  
  res.clearCookie('token');
  
  req.logout((err) => {
    if (err) {
      console.error('🔧 [AUTH] Logout error:', err);
      return res.status(500).json({ error: 'Erro ao fazer logout' });
    }
    
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  });
});

// ===============================
// API ROUTES
// ===============================

// Dashboard data
app.get('/api/admin/dashboard', authMiddleware, (req, res) => {
  try {
    const stats = {
      usuarios_ativos: users.filter(u => u.ativo).length,
      posts_mural: muralPosts.length,
      reservas_salas: reservas.length,
      solicitacoes_ti: solicitacoesTI.length,
      trocas_proteina: trocasProteina.length,
      agendamentos_portaria: agendamentosPortaria.length
    };

    // Calculate user points for current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const userPoints = pontos
      .filter(p => p.usuario_id === req.user.id && p.created_at.startsWith(currentMonth))
      .reduce((sum, p) => sum + p.pontos, 0);

    // Calculate breakdown
    const breakdown = pontos
      .filter(p => p.usuario_id === req.user.id && p.created_at.startsWith(currentMonth))
      .reduce((acc, p) => {
        const existing = acc.find(item => item.acao === p.acao);
        if (existing) {
          existing.total += p.pontos;
          existing.count += 1;
        } else {
          acc.push({ acao: p.acao, total: p.pontos, count: 1 });
        }
        return acc;
      }, []);

    // Calculate ranking
    const userPointsMap = {};
    pontos
      .filter(p => p.created_at.startsWith(currentMonth))
      .forEach(p => {
        userPointsMap[p.usuario_id] = (userPointsMap[p.usuario_id] || 0) + p.pontos;
      });

    const ranking = users
      .filter(u => u.ativo)
      .map(u => ({
        nome: u.nome,
        total_pontos: userPointsMap[u.id] || 0,
        foto: u.avatar_url
      }))
      .sort((a, b) => b.total_pontos - a.total_pontos);

    res.json({
      stats,
      userPoints,
      breakdown,
      ranking
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// Reservas routes
app.get('/api/reservas', (req, res) => {
  res.json({ reservas: reservas || [] });
});

app.post('/api/reservas', authMiddleware, (req, res) => {
  try {
    const { sala, data, inicio, fim, assunto } = req.body;

    if (!sala || !data || !inicio || !fim || !assunto) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    const reserva = {
      id: Date.now().toString(),
      usuario_id: req.user.id,
      sala,
      data,
      inicio,
      fim,
      assunto,
      responsavel: req.user.nome,
      status: 'ativa',
      created_at: new Date().toISOString()
    };

    reservas.push(reserva);

    // Add points
    const points = addPoints(req.user.id, 'RESERVA_CREATE', 8, { sala, data, assunto });

    res.json({ 
      success: true, 
      id: reserva.id, 
      message: 'Reserva criada com sucesso!',
      points 
    });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: 'Erro ao criar reserva' });
  }
});

// Portaria routes
app.get('/api/portaria/agendamentos', (req, res) => {
  res.json({ agendamentos: agendamentosPortaria || [] });
});

app.post('/api/portaria/agendamentos', authMiddleware, (req, res) => {
  try {
    const { data, hora, visitante, documento, observacao } = req.body;

    if (!data || !hora || !visitante) {
      return res.status(400).json({ error: 'Data, hora e nome do visitante são obrigatórios' });
    }

    const agendamento = {
      id: Date.now().toString(),
      usuario_id: req.user.id,
      data,
      hora,
      visitante,
      documento: documento || '',
      observacao: observacao || '',
      responsavel: req.user.nome,
      status: 'agendado',
      created_at: new Date().toISOString()
    };

    agendamentosPortaria.push(agendamento);

    // Add points
    const points = addPoints(req.user.id, 'PORTARIA_CREATE', 6, { visitante, data });

    res.json({ 
      success: true, 
      id: agendamento.id,
      points 
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

// Mural routes
app.get('/api/mural/posts', (req, res) => {
  try {
    const postsWithDetails = muralPosts.map(post => {
      const likes_count = muralLikes.filter(like => like.post_id === post.id).length;
      const comments_count = muralComments.filter(comment => comment.post_id === post.id).length;
      
      return {
        ...post,
        likes_count,
        comments_count
      };
    }).sort((a, b) => {
      // Pinned posts first, then by date
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    res.json({ posts: postsWithDetails });
  } catch (error) {
    console.error('Error loading posts:', error);
    res.status(500).json({ error: 'Erro ao carregar posts' });
  }
});

app.post('/api/mural/posts', authMiddleware, (req, res) => {
  try {
    const { titulo, conteudo, pinned } = req.body;

    // Check if user can post (RH, TI, or admin)
    const canPost = req.user.setor === 'RH' || req.user.setor === 'TI' || req.user.role === 'admin';
    if (!canPost) {
      return res.status(403).json({ error: 'Apenas RH e TI podem criar posts' });
    }

    if (!titulo || !conteudo) {
      return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    }

    const post = {
      id: Date.now().toString(),
      usuario_id: req.user.id,
      titulo,
      conteudo,
      author: req.user.nome,
      pinned: pinned || false,
      created_at: new Date().toISOString()
    };

    muralPosts.push(post);

    // Add points
    const points = addPoints(req.user.id, 'MURAL_POST', 15, { titulo });

    res.json({ 
      success: true, 
      id: post.id,
      points 
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Erro ao criar post' });
  }
});

app.post('/api/mural/:postId/like', authMiddleware, (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Check if user already liked this post
    const existingLike = muralLikes.find(like => 
      like.post_id === postId && like.usuario_id === userId
    );

    let action;
    let points = 0;

    if (existingLike) {
      // Unlike
      muralLikes = muralLikes.filter(like => like.id !== existingLike.id);
      action = 'unliked';
    } else {
      // Like
      const like = {
        id: Date.now().toString(),
        post_id: postId,
        usuario_id: userId,
        created_at: new Date().toISOString()
      };
      muralLikes.push(like);
      action = 'liked';
      
      // Add points for liking
      points = addPoints(userId, 'MURAL_LIKE', 2, { post_id: postId });
    }

    res.json({ 
      success: true, 
      action,
      points: action === 'liked' ? points : 0
    });
  } catch (error) {
    console.error('Error processing like:', error);
    res.status(500).json({ error: 'Erro ao processar curtida' });
  }
});

app.post('/api/mural/:postId/comments', authMiddleware, (req, res) => {
  try {
    const { postId } = req.params;
    const { texto } = req.body;

    if (!texto || !texto.trim()) {
      return res.status(400).json({ error: 'Texto do comentário é obrigatório' });
    }

    const comment = {
      id: Date.now().toString(),
      post_id: postId,
      usuario_id: req.user.id,
      texto: texto.trim(),
      author: req.user.nome,
      created_at: new Date().toISOString()
    };

    muralComments.push(comment);

    // Add points for commenting
    const points = addPoints(req.user.id, 'MURAL_COMMENT', 3, { post_id: postId });

    res.json({ 
      success: true, 
      id: comment.id,
      points 
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Erro ao criar comentário' });
  }
});

// Trocas de proteína routes
app.get('/api/trocas-proteina', authMiddleware, (req, res) => {
  try {
    const { from, to } = req.query;
    
    let filteredTrocas = trocasProteina.filter(t => t.usuario_id === req.user.id);
    
    if (from && to) {
      filteredTrocas = filteredTrocas.filter(t => 
        t.data >= from && t.data <= to
      );
    }
    
    res.json({ trocas: filteredTrocas });
  } catch (error) {
    console.error('Error loading protein exchanges:', error);
    res.status(500).json({ error: 'Erro ao carregar trocas' });
  }
});

app.post('/api/trocas-proteina/bulk', authMiddleware, (req, res) => {
  try {
    const { trocas } = req.body;

    if (!Array.isArray(trocas) || trocas.length === 0) {
      return res.status(400).json({ error: 'Lista de trocas inválida' });
    }

    let inseridas = 0;
    let totalPoints = 0;

    trocas.forEach(troca => {
      if (!troca.data || !troca.proteina_nova || !troca.proteina_original) return;

      // Check if exchange already exists for this date
      const existing = trocasProteina.find(t => 
        t.usuario_id === req.user.id && t.data === troca.data
      );

      if (!existing) {
        const newTroca = {
          id: Date.now().toString() + Math.random(),
          usuario_id: req.user.id,
          data: troca.data,
          proteina_original: troca.proteina_original,
          proteina_nova: troca.proteina_nova,
          status: 'ativa',
          created_at: new Date().toISOString()
        };

        trocasProteina.push(newTroca);
        inseridas++;

        // Add points for each exchange
        const points = addPoints(req.user.id, 'TROCA_PROTEINA', 5, { 
          data: troca.data, 
          proteina_nova: troca.proteina_nova 
        });
        totalPoints += points;
      }
    });

    res.json({ 
      success: true, 
      inseridas,
      totalPoints,
      message: `${inseridas} trocas salvas com sucesso!` 
    });
  } catch (error) {
    console.error('Error saving protein exchanges:', error);
    res.status(500).json({ error: 'Erro ao salvar trocas' });
  }
});

// TI/Equipment routes
app.get('/api/ti/solicitacoes', authMiddleware, (req, res) => {
  try {
    // Only TI sector can see all requests
    if (req.user.setor !== 'TI' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const solicitacoesWithUser = solicitacoesTI.map(sol => {
      const user = users.find(u => u.id === sol.usuario_id);
      return {
        ...sol,
        nome: user?.nome || 'Usuário',
        email: user?.email || ''
      };
    });

    res.json(solicitacoesWithUser);
  } catch (error) {
    console.error('Error loading IT requests:', error);
    res.status(500).json({ error: 'Erro ao carregar solicitações' });
  }
});

app.get('/api/ti/minhas', authMiddleware, (req, res) => {
  try {
    const userRequests = solicitacoesTI.filter(sol => sol.usuario_id === req.user.id);
    res.json(userRequests);
  } catch (error) {
    console.error('Error loading user requests:', error);
    res.status(500).json({ error: 'Erro ao carregar suas solicitações' });
  }
});

app.post('/api/ti/solicitacoes', authMiddleware, (req, res) => {
  try {
    const { titulo, descricao, prioridade } = req.body;

    if (!titulo || !descricao) {
      return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
    }

    const solicitacao = {
      id: Date.now().toString(),
      usuario_id: req.user.id,
      titulo,
      descricao,
      prioridade: prioridade || 'medium',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    solicitacoesTI.push(solicitacao);

    // Add points for equipment request
    const points = addPoints(req.user.id, 'EQUIPMENT_REQUEST', 4, { titulo });

    res.json({ 
      success: true, 
      id: solicitacao.id,
      points 
    });
  } catch (error) {
    console.error('Error creating IT request:', error);
    res.status(500).json({ error: 'Erro ao criar solicitação' });
  }
});

// Admin routes
app.get('/api/admin/users', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const usersWithoutPassword = users.map(u => {
      const { senha, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });

    res.json({ users: usersWithoutPassword });
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).json({ error: 'Erro ao carregar usuários' });
  }
});

app.post('/api/admin/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { nome, email, senha, setor, role } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    // Check if user already exists
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);

    const newUser = {
      id: Date.now().toString(),
      nome,
      email,
      senha: hashedPassword,
      setor: setor || 'Geral',
      role: role || 'colaborador',
      ativo: true,
      created_at: new Date().toISOString()
    };

    users.push(newUser);

    res.json({ success: true, id: newUser.id });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

app.patch('/api/admin/users/:userId', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { userId } = req.params;
    const updates = req.body;

    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    users[userIndex] = { ...users[userIndex], ...updates, updated_at: new Date().toISOString() };

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

app.patch('/api/admin/users/:userId/password', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { userId } = req.params;
    const { senha } = req.body;

    if (!senha || senha.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);
    users[userIndex].senha = hashedPassword;
    users[userIndex].updated_at = new Date().toISOString();

    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// Export routes
app.get('/api/admin/export/ranking.csv', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const currentMonth = req.query.month || new Date().toISOString().slice(0, 7);
    
    // Calculate user points for the month
    const userPointsMap = {};
    pontos
      .filter(p => p.created_at.startsWith(currentMonth))
      .forEach(p => {
        userPointsMap[p.usuario_id] = (userPointsMap[p.usuario_id] || 0) + p.pontos;
      });

    // Create ranking
    const ranking = users
      .filter(u => u.ativo)
      .map(u => ({
        nome: u.nome,
        email: u.email,
        setor: u.setor,
        pontos: userPointsMap[u.id] || 0
      }))
      .sort((a, b) => b.pontos - a.pontos);

    // Generate CSV
    let csv = 'Posição,Nome,Email,Setor,Pontos\n';
    ranking.forEach((user, index) => {
      csv += `${index + 1},"${user.nome}","${user.email}","${user.setor}",${user.pontos}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ranking-${currentMonth}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting ranking:', error);
    res.status(500).json({ error: 'Erro ao exportar ranking' });
  }
});

app.get('/api/admin/export/ranking.:format', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { format } = req.params;
    const currentMonth = req.query.month || new Date().toISOString().slice(0, 7);
    
    // Calculate ranking data
    const userPointsMap = {};
    pontos
      .filter(p => p.created_at.startsWith(currentMonth))
      .forEach(p => {
        userPointsMap[p.usuario_id] = (userPointsMap[p.usuario_id] || 0) + p.pontos;
      });

    const ranking = users
      .filter(u => u.ativo)
      .map(u => ({
        nome: u.nome,
        email: u.email,
        setor: u.setor,
        pontos: userPointsMap[u.id] || 0
      }))
      .sort((a, b) => b.pontos - a.pontos);

    if (format === 'csv') {
      let csv = 'Posição,Nome,Email,Setor,Pontos\n';
      ranking.forEach((user, index) => {
        csv += `${index + 1},"${user.nome}","${user.email}","${user.setor}",${user.pontos}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="ranking-${currentMonth}.csv"`);
      res.send(csv);
    } else {
      res.json({ 
        success: true, 
        data: ranking,
        format,
        month: currentMonth 
      });
    }
  } catch (error) {
    console.error('Error exporting ranking:', error);
    res.status(500).json({ error: 'Erro ao exportar ranking' });
  }
});

app.get('/api/admin/export/activities.:format', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { format } = req.params;
    const currentMonth = req.query.month || new Date().toISOString().slice(0, 7);
    
    const activities = pontos
      .filter(p => p.created_at.startsWith(currentMonth))
      .map(p => {
        const user = users.find(u => u.id === p.usuario_id);
        return {
          usuario: user?.nome || 'Usuário desconhecido',
          email: user?.email || '',
          setor: user?.setor || '',
          acao: p.acao,
          pontos: p.pontos,
          data: p.created_at
        };
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    if (format === 'csv') {
      let csv = 'Usuário,Email,Setor,Ação,Pontos,Data\n';
      activities.forEach(activity => {
        csv += `"${activity.usuario}","${activity.email}","${activity.setor}","${activity.acao}",${activity.pontos},"${activity.data}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="atividades-${currentMonth}.csv"`);
      res.send(csv);
    } else {
      res.json({ 
        success: true, 
        data: activities,
        format,
        month: currentMonth 
      });
    }
  } catch (error) {
    console.error('Error exporting activities:', error);
    res.status(500).json({ error: 'Erro ao exportar atividades' });
  }
});

app.get('/api/admin/export/backup.:format', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { format } = req.params;
    
    const backupData = {
      users: users.map(u => { const { senha, ...userSafe } = u; return userSafe; }),
      reservas,
      muralPosts,
      muralLikes,
      muralComments,
      trocasProteina,
      agendamentosPortaria,
      solicitacoesTI,
      pontos,
      accessLogs: accessLogs.slice(-100), // Only last 100 logs
      exported_at: new Date().toISOString()
    };

    if (format === 'json') {
      res.json({ 
        success: true, 
        data: backupData,
        message: 'Backup JSON gerado com sucesso' 
      });
    } else {
      res.json({ 
        success: true, 
        message: `Backup ${format.toUpperCase()} processado`,
        tables: Object.keys(backupData).length
      });
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Erro ao gerar backup' });
  }
});

// ===============================
// ERROR HANDLING & 404
// ===============================

// Catch all undefined routes
app.use('/api/*', (req, res) => {
  console.log(`❌ [API] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    ok: false, 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

app.use('/auth/*', (req, res) => {
  console.log(`❌ [AUTH] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    ok: false, 
    error: 'Auth route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('🔥 [SERVER] Unhandled error:', error);
  res.status(500).json({ 
    ok: false, 
    error: 'Internal server error',
    message: error.message 
  });
});

// ===============================
// SERVER STARTUP
// ===============================

app.listen(PORT, () => {
  console.log('\n🚀 ===============================');
  console.log(`🌟 Server running on port ${PORT}`);
  console.log(`🔗 API available at: http://localhost:${PORT}`);
  console.log('🔧 [AUTH] Available routes:');
  console.log('   POST /auth/login');
  console.log('   GET  /auth/google');
  console.log('   GET  /auth/google/callback');
  console.log('   POST /auth/logout');
  console.log('   GET  /api/me');
  console.log('🛠️ [API] Available endpoints:');
  console.log('   GET/POST /api/reservas');
  console.log('   GET/POST /api/portaria/agendamentos');
  console.log('   GET/POST /api/mural/posts');
  console.log('   GET/POST /api/trocas-proteina');
  console.log('   GET/POST /api/ti/solicitacoes');
  console.log('   GET/POST /api/admin/*');
  console.log(`🔐 [GOOGLE] OAuth Status: ${process.env.GOOGLE_CLIENT_ID ? '✅ Configured' : '❌ Not configured'}`);
  console.log('🚀 ===============================\n');
});

module.exports = app;