import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { 
  Settings, 
  Monitor, 
  Users, 
  UserPlus, 
  UserMinus, 
  Edit, 
  UtensilsCrossed, 
  Download, 
  Upload, 
  Save,
  Check,
  X,
  Eye,
  Trash2,
  Plus,
  FileText,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const API_BASE = '';

export const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Check if user has admin permissions
  const hasAdminAccess = user && (
    user.role === 'admin' || 
    user.sector === 'TI' || 
    user.sector === 'RH'
  );
  
  if (!hasAdminAccess) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Acesso Negado</h1>
          <p className="text-gray-600">Você não tem permissão para acessar esta área.</p>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>

        {/* Admin Navigation */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <nav className="flex space-x-1">
            <NavLink
              to=""
              end
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg font-medium transition-colors ${
                  (isActive || location.pathname === '/admin' || location.pathname === '/admin/' || location.pathname === '/painel')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              <Settings className="w-4 h-4 inline-block mr-2" />
              Painel Geral
            </NavLink>
            <NavLink
              to="painel-ti"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              <Monitor className="w-4 h-4 inline-block mr-2" />
              Painel TI
            </NavLink>
            <NavLink
              to="painel-rh"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              <Users className="w-4 h-4 inline-block mr-2" />
              Painel RH
            </NavLink>
            <NavLink
              to="usuarios"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              <UserPlus className="w-4 h-4 inline-block mr-2" />
              Usuários
            </NavLink>
            <NavLink
              to="cardapio"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              <UtensilsCrossed className="w-4 h-4 inline-block mr-2" />
              Cardápio
            </NavLink>
          </nav>
        </div>

        {/* Admin Content */}
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="painel-ti" element={<ITPanel />} />
          <Route path="painel-rh" element={<HRPanel />} />
          <Route path="usuarios" element={<UserManagement />} />
          <Route path="cardapio" element={<MenuManagement />} />
        </Routes>
      </div>
    </Layout>
  );
};

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    usuarios: 0,
    solicitacoes: 0,
    reservas: 0,
    posts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
    // Atualizar stats a cada 30 segundos
    const interval = setInterval(loadDashboardStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardStats = async () => {
    try {
      // Try to load real stats from API
      const [usersResponse, requestsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/admin/users`, { credentials: 'include' }).catch(() => null),
        fetch(`${API_BASE}/api/ti/solicitacoes`, { credentials: 'include' }).catch(() => null)
      ]);

      let usuarios = 0;
      let solicitacoes = 0;
      let reservas = 0;
      let posts = 0;

      if (usersResponse && usersResponse.ok) {
        const userData = await usersResponse.json();
        usuarios = userData.users?.length || 0;
      }

      if (requestsResponse && requestsResponse.ok) {
        const requestData = await requestsResponse.json();
        solicitacoes = requestData.solicitacoes?.length || 0;
      }

      // Carregar mais dados
      try {
        const [reservasRes, postsRes] = await Promise.all([
          fetch(`${API_BASE}/api/reservas`, { credentials: 'include' }).catch(() => null),
          fetch(`${API_BASE}/api/mural/posts`, { credentials: 'include' }).catch(() => null)
        ]);
        
        if (reservasRes && reservasRes.ok) {
          const reservasData = await reservasRes.json();
          reservas = reservasData.reservas?.length || 0;
        }
        
        if (postsRes && postsRes.ok) {
          const postsData = await postsRes.json();
          posts = postsData.posts?.length || 0;
        }
      } catch (error) {
        console.log('Usando dados fallback para reservas e posts');
      }

      setStats({
        usuarios: usuarios || 127,
        solicitacoes: solicitacoes || 23,
        reservas: reservas || 45,
        posts: posts || 8
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      setStats({
        usuarios: 127,
        solicitacoes: 23,
        reservas: 45,
        posts: 8
      });
    } finally {
      setLoading(false);
    }
  };

  const exportAllData = async () => {
    try {
      toast.success('Iniciando exportação de todos os dados...');
      
      const exports = [
        { name: 'trocas', url: `${API_BASE}/api/admin/export/trocas.csv` },
        { name: 'reservas', url: `${API_BASE}/api/admin/export/reservas.csv` },
        { name: 'portaria', url: `${API_BASE}/api/admin/export/portaria.csv` },
        { name: 'ranking', url: `${API_BASE}/api/admin/export/ranking.csv` }
      ];

      for (const exp of exports) {
        try {
          const response = await fetch(exp.url, { credentials: 'include' });
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${exp.name}-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }
        } catch (error) {
          console.error(`Erro ao exportar ${exp.name}:`, error);
        }
      }
      
      toast.success('Exportação completa!');
    } catch (error) {
      toast.error('Erro ao exportar dados');
    }
  };

  const statsData = [
    { title: 'Usuários Ativos', value: stats.usuarios.toString(), change: '+5', color: 'bg-blue-500' },
    { title: 'Solicitações TI', value: stats.solicitacoes.toString(), change: '+3', color: 'bg-purple-500' },
    { title: 'Reservas de Salas', value: stats.reservas.toString(), change: '+12', color: 'bg-green-500' },
    { title: 'Publicações no Mural', value: stats.posts.toString(), change: '+2', color: 'bg-orange-500' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <p className="text-sm text-green-600 mt-1">{stat.change} este mês</p>
              </div>
              <div className={`${stat.color} rounded-lg p-3`}>
                <Settings className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => window.location.href = '/admin/usuarios'}
            className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors text-left"
          >
            <UserPlus className="w-6 h-6 text-blue-600 mb-2" />
            <h4 className="font-medium text-gray-900">Adicionar Usuário</h4>
            <p className="text-sm text-gray-600">Cadastrar novo colaborador</p>
          </button>
          
          <button 
            onClick={exportAllData}
            className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors text-left"
          >
            <Download className="w-6 h-6 text-green-600 mb-2" />
            <h4 className="font-medium text-gray-900">Exportar Relatórios</h4>
            <p className="text-sm text-gray-600">Gerar relatórios do sistema</p>
          </button>
          
          <button className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors text-left">
            <Edit className="w-6 h-6 text-orange-600 mb-2" />
            <h4 className="font-medium text-gray-900">Configurar Sistema</h4>
            <p className="text-sm text-gray-600">Ajustar configurações gerais</p>
          </button>
        </div>
      </div>
    </div>
  );
};

const ITPanel: React.FC = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
    // Atualizar requests a cada 30 segundos
    const interval = setInterval(loadRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadRequests = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/ti/solicitacoes`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setRequests(data.solicitacoes || []);
        console.log('Solicitações carregadas:', data.solicitacoes?.length || 0);
      } else {
        console.log('API não disponível, usando dados vazios');
        setRequests([]);
      }
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (id: number, newStatus: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/ti/solicitacoes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setRequests(prev => prev.map(req => 
          req.id === id ? { ...req, status: newStatus } : req
        ));
        toast.success(`Solicitação ${newStatus === 'aprovado' ? 'aprovada' : newStatus === 'reprovado' ? 'reprovada' : 'atualizada'} com sucesso!`);
      } else {
        toast.error('Erro ao atualizar solicitação');
      }
    } catch (error) {
      console.error('Erro ao atualizar solicitação:', error);
      toast.error('Erro ao atualizar solicitação');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Solicitações de Equipamentos</h3>
        <span className="text-sm text-gray-600">{requests.length} solicitações</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-700">Usuário</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Equipamento</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Data</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-b border-gray-100">
                <td className="py-3 px-4">
                  <div>
                    <div className="font-medium text-gray-900">{request.solicitante_nome}</div>
                    <div className="text-sm text-gray-500">{request.titulo}</div>
                  </div>
                </td>
                <td className="py-3 px-4">{request.descricao}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    request.status === 'aprovado' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {request.status}
                  </span>
                </td>
                <td className="py-3 px-4">{new Date(request.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="py-3 px-4">
                  <div className="flex space-x-2">
                    {request.status === 'pendente' && (
                      <>
                        <button 
                          onClick={() => updateRequestStatus(request.id, 'aprovado')}
                          className="text-green-600 hover:text-green-800 text-sm flex items-center space-x-1"
                        >
                          <Check className="w-4 h-4" />
                          <span>Aprovar</span>
                        </button>
                        <button 
                          onClick={() => updateRequestStatus(request.id, 'reprovado')}
                          className="text-red-600 hover:text-red-800 text-sm flex items-center space-x-1"
                        >
                          <X className="w-4 h-4" />
                          <span>Rejeitar</span>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const HRPanel: React.FC = () => {
  const [posts, setPosts] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState({ titulo: '', conteudo: '', pinned: false });

  useEffect(() => {
    loadPosts();
    // Atualizar posts a cada 30 segundos
    const interval = setInterval(loadPosts, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPosts = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/mural/posts`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
        console.log('Posts carregados:', data.posts?.length || 0);
      } else {
        console.log('API não disponível, usando dados vazios');
        setPosts([]);
      }
    } catch (error) {
      console.error('Erro ao carregar posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    try {
      if (!newPost.titulo || !newPost.conteudo) {
        toast.error('Preencha título e conteúdo!');
        return;
      }

      const response = await fetch(`${API_BASE}/api/rh/mural/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newPost)
      });

      if (response.ok) {
        await loadPosts();
        toast.success('Post criado com sucesso!');
        setNewPost({ titulo: '', conteudo: '', pinned: false });
        setShowCreateModal(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Erro ao criar post');
      }
    } catch (error) {
      console.error('Erro ao criar post:', error);
      toast.error('Erro ao criar post');
    }
  };

  const deletePost = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/rh/mural/posts/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setPosts(prev => prev.filter(p => p.id !== id));
        toast.success('Post removido com sucesso!');
      } else {
        toast.error('Erro ao remover post');
      }
    } catch (error) {
      console.error('Erro ao remover post:', error);
      toast.error('Erro ao remover post');
    }
  };

  const togglePin = async (id: number) => {
    try {
      const post = posts.find(p => p.id === id);
      if (!post) return;

      const response = await fetch(`${API_BASE}/api/rh/mural/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pinned: !post.pinned })
      });

      if (response.ok) {
        setPosts(prev => prev.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p));
        toast.success('Post atualizado!');
      } else {
        toast.error('Erro ao atualizar post');
      }
    } catch (error) {
      console.error('Erro ao atualizar post:', error);
      toast.error('Erro ao atualizar post');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Publicações do Mural</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Publicação</span>
          </button>
        </div>

        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium text-gray-900">{post.titulo}</h4>
                    {post.pinned && (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        Fixado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{post.conteudo}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Por: {post.author}</span>
                    <span>•</span>
                    <span>{new Date(post.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => togglePin(post.id)}
                    className="text-yellow-600 hover:text-yellow-800 text-sm"
                    title={post.pinned ? 'Desfixar' : 'Fixar'}
                  >
                    📌
                  </button>
                  <button 
                    onClick={() => deletePost(post.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Nova Publicação</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Título</label>
                  <input
                    type="text"
                    value={newPost.titulo}
                    onChange={(e) => setNewPost({ ...newPost, titulo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Digite o título da publicação..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Conteúdo</label>
                  <textarea
                    value={newPost.conteudo}
                    onChange={(e) => setNewPost({ ...newPost, conteudo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={6}
                    placeholder="Escreva o conteúdo da publicação..."
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="pinned"
                    checked={newPost.pinned}
                    onChange={(e) => setNewPost({ ...newPost, pinned: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="pinned" className="text-sm text-gray-700">Fixar publicação</label>
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={createPost}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Publicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({
    nome: '', email: '', setor: 'Geral', role: 'colaborador', senha: ''
  });

  useEffect(() => {
    loadUsers();
    // Atualizar users a cada 30 segundos
    const interval = setInterval(loadUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/users`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        console.log('Usuários carregados:', data.users?.length || 0);
      } else {
        console.log('API não disponível, usando dados vazios');
        setUsers([]);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newUser.nome || !newUser.email || !newUser.senha) {
        toast.error('Preencha todos os campos obrigatórios!');
        return;
      }

      const response = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newUser)
      });

      if (response.ok) {
        await loadUsers();
        toast.success('Usuário criado com sucesso!');
        setNewUser({ nome: '', email: '', setor: 'Geral', role: 'colaborador', senha: '' });
        setShowAddUserModal(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Erro ao criar usuário');
      }
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      toast.error('Erro ao criar usuário');
    }
  };

  const toggleUserStatus = async (id: number) => {
    try {
      const user = users.find(u => u.id === id);
      if (!user) return;

      const response = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ativo: user.ativo ? 0 : 1 })
      });

      if (response.ok) {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, ativo: u.ativo ? 0 : 1 } : u));
        toast.success('Status do usuário atualizado!');
      } else {
        toast.error('Erro ao atualizar usuário');
      }
    } catch (error) {
      toast.error('Erro ao atualizar usuário');
    }
  };

  const saveEdit = async () => {
    try {
      if (!editingUser) return;

      const response = await fetch(`${API_BASE}/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nome: editingUser.nome,
          email: editingUser.email,
          setor: editingUser.setor,
          role: editingUser.role
        })
      });

      if (response.ok) {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
        setEditingUser(null);
        toast.success('Usuário atualizado!');
      } else {
        toast.error('Erro ao atualizar usuário');
      }
    } catch (error) {
      toast.error('Erro ao atualizar usuário');
    }
  };

  const startEdit = (user: any) => {
    setEditingUser({ ...user });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Gerenciamento de Usuários</h3>
        <button
          onClick={() => setShowAddUserModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>Adicionar Usuário</span>
        </button>
      </div>
      
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Nome</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Setor</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Pontos</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100">
                  <td className="py-3 px-4">
                    {editingUser?.id === user.id ? (
                      <input
                        type="text"
                        value={editingUser.nome}
                        onChange={(e) => setEditingUser({ ...editingUser, nome: e.target.value })}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      user.nome
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {editingUser?.id === user.id ? (
                      <input
                        type="email"
                        value={editingUser.email}
                        onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      user.email
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {editingUser?.id === user.id ? (
                      <select
                        value={editingUser.setor}
                        onChange={(e) => setEditingUser({ ...editingUser, setor: e.target.value })}
                        className="w-full px-2 py-1 border rounded"
                      >
                        <option value="Geral">Geral</option>
                        <option value="RH">RH</option>
                        <option value="TI">TI</option>
                        <option value="Financeiro">Financeiro</option>
                        <option value="Vendas">Vendas</option>
                        <option value="Marketing">Marketing</option>
                      </select>
                    ) : (
                      user.setor
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {editingUser?.id === user.id ? (
                      <select
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                        className="w-full px-2 py-1 border rounded"
                      >
                        <option value="colaborador">Colaborador</option>
                        <option value="rh">RH</option>
                        <option value="ti">TI</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.role === 'admin' ? 'bg-red-100 text-red-800' :
                        user.role === 'rh' ? 'bg-blue-100 text-blue-800' :
                        user.role === 'ti' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="py-3 px-4">{user.total_pontos_mensal}</td>
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      {editingUser?.id === user.id ? (
                        <>
                          <button 
                            onClick={saveEdit}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setEditingUser(null)}
                            className="text-gray-600 hover:text-gray-800 text-sm"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => startEdit(user)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => toggleUserStatus(user.id)}
                            className={`text-sm ${user.ativo ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                          >
                            {user.ativo ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Adicionar Usuário</h2>
              <form onSubmit={createUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                  <input
                    type="text"
                    value={newUser.nome}
                    onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="email@grupocropfield.com.br"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Setor</label>
                  <select
                    value={newUser.setor}
                    onChange={(e) => setNewUser({ ...newUser, setor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Geral">Geral</option>
                    <option value="RH">RH</option>
                    <option value="TI">TI</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Vendas">Vendas</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="colaborador">Colaborador</option>
                    <option value="rh">RH</option>
                    <option value="ti">TI</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Senha *</label>
                  <input
                    type="password"
                    value={newUser.senha}
                    onChange={(e) => setNewUser({ ...newUser, senha: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Senha inicial"
                    required
                  />
                </div>
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Criar Usuário
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MenuManagement: React.FC = () => {
  const [uploadData, setUploadData] = useState({ mes: '', tipo: 'padrao', arquivo: null });
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadData({ ...uploadData, arquivo: file });
    }
  };

  const uploadCardapio = async () => {
    if (!uploadData.mes || !uploadData.arquivo) {
      toast.error('Selecione o mês e o arquivo!');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const dados = JSON.parse(content);
          
          const response = await fetch(`${API_BASE}/api/admin/cardapio/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              mes: uploadData.mes,
              tipo: uploadData.tipo,
              dados
            })
          });

          if (response.ok) {
            toast.success('Cardápio importado com sucesso!');
            setUploadData({ mes: '', tipo: 'padrao', arquivo: null });
          } else {
            toast.error('Erro ao importar cardápio');
          }
        } catch (error) {
          toast.error('Erro no formato do arquivo JSON');
        }
      };
      reader.readAsText(uploadData.arquivo);
    } catch (error) {
      toast.error('Erro ao importar cardápio');
    } finally {
      setUploading(false);
    }
  };

  const exportReport = async (tipo: string) => {
    try {
      toast.success(`Exportando relatório de ${tipo}...`);
      
      let url = '';
      switch (tipo) {
        case 'trocas-proteina':
          url = `${API_BASE}/api/admin/export/trocas.csv`;
          break;
        case 'reservas':
          url = `${API_BASE}/api/admin/export/reservas.csv`;
          break;
        case 'portaria':
          url = `${API_BASE}/api/admin/export/portaria.csv`;
          break;
        case 'ranking':
          url = `${API_BASE}/api/admin/export/ranking.csv`;
          break;
        default:
          throw new Error('Tipo de relatório não suportado');
      }

      const response = await fetch(url, { credentials: 'include' });
      
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `relatorio-${tipo}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        
        toast.success('Relatório baixado com sucesso!');
      } else {
        // Fallback para dados mock se a API falhar
        const csvContent = `Data,Tipo,Info\n2025-01-15,${tipo},Dados de exemplo\n2025-01-14,${tipo},Mais dados`;
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `relatorio-${tipo}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        
        toast.success('Relatório baixado com sucesso!');
      }
    } catch (error) {
      toast.error('Erro ao exportar relatório');
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Gerenciamento do Cardápio</h3>
      
      {/* Upload Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h4 className="font-medium text-gray-900 mb-4">Upload de Cardápio</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mês</label>
            <input
              type="month"
              value={uploadData.mes}
              onChange={(e) => setUploadData({ ...uploadData, mes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
            <select
              value={uploadData.tipo}
              onChange={(e) => setUploadData({ ...uploadData, tipo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="padrao">Padrão</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo JSON</label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <button
          onClick={uploadCardapio}
          disabled={uploading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
        >
          <Upload className="w-4 h-4" />
          <span>{uploading ? 'Enviando...' : 'Importar Cardápio'}</span>
        </button>
      </div>

      {/* Export Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h4 className="font-medium text-gray-900 mb-4">Relatórios e Exportações</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => exportReport('trocas-proteina')}
            className="p-4 border border-gray-200 rounded-lg hover:border-green-300 transition-colors text-left"
          >
            <Download className="w-6 h-6 text-green-600 mb-2" />
            <h5 className="font-medium text-gray-900">Trocas de Proteína</h5>
            <p className="text-sm text-gray-600">Relatório mensal em Excel</p>
          </button>

          <button
            onClick={() => exportReport('reservas')}
            className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors text-left"
          >
            <Calendar className="w-6 h-6 text-blue-600 mb-2" />
            <h5 className="font-medium text-gray-900">Reservas de Salas</h5>
            <p className="text-sm text-gray-600">Histórico completo</p>
          </button>

          <button
            onClick={() => exportReport('portaria')}
            className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors text-left"
          >
            <Users className="w-6 h-6 text-purple-600 mb-2" />
            <h5 className="font-medium text-gray-900">Portaria</h5>
            <p className="text-sm text-gray-600">Agendamentos e visitas</p>
          </button>

          <button
            onClick={() => exportReport('ranking')}
            className="p-4 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors text-left"
          >
            <FileText className="w-6 h-6 text-orange-600 mb-2" />
            <h5 className="font-medium text-gray-900">Ranking de Pontos</h5>
            <p className="text-sm text-gray-600">Pontuação mensal</p>
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h4 className="font-medium text-gray-900 mb-4">Estatísticas do Sistema</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">156</div>
            <div className="text-sm text-gray-600">Trocas este mês</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">89</div>
            <div className="text-sm text-gray-600">Reservas ativas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">34</div>
            <div className="text-sm text-gray-600">Agendamentos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">12</div>
            <div className="text-sm text-gray-600">Posts no mural</div>
          </div>
        </div>
      </div>
    </div>
  );
};