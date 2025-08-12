import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { 
  Users, 
  Download, 
  Settings, 
  Monitor, 
  MessageSquare, 
  UtensilsCrossed,
  Plus,
  Edit,
  Trash2,
  Save,
  Upload,
  Eye,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const API_BASE = '';

interface User {
  id: number;
  nome: string;
  email: string;
  setor: string;
  role: string;
  ativo: number;
  created_at: string;
  total_pontos_mensal: number;
}

interface TISolicitacao {
  id: number;
  titulo: string;
  descricao: string;
  status: 'pendente' | 'aprovado' | 'reprovado';
  solicitante_nome: string;
  solicitante_email: string;
  responsavel_nome?: string;
  created_at: string;
  updated_at: string;
}

interface MuralPost {
  id: number;
  titulo: string;
  conteudo: string;
  author: string;
  pinned: number;
  created_at: string;
}

export const Painel: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('usuarios');
  const [loading, setLoading] = useState(false);

  // Check user role and redirect if not authorized
  const isAdmin = user?.role === 'admin';
  const isRH = user?.role === 'rh' || user?.role === 'admin';
  const isTI = user?.role === 'ti' || user?.role === 'admin';
  const hasAccess = isAdmin || isRH || isTI;

  // Users management state
  const [users, setUsers] = useState<User[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    nome: '',
    email: '',
    setor: '',
    role: 'colaborador',
    senha: ''
  });

  // TI requests state
  const [tiSolicitacoes, setTiSolicitacoes] = useState<TISolicitacao[]>([]);
  const [minhasSolicitacoes, setMinhasSolicitacoes] = useState<TISolicitacao[]>([]);
  const [showMinhasSolicitacoes, setShowMinhasSolicitacoes] = useState(false);
  const [showNewSolicitacao, setShowNewSolicitacao] = useState(false);
  const [newSolicitacao, setNewSolicitacao] = useState({ titulo: '', descricao: '' });

  // Mural posts state (for RH)
  const [muralPosts, setMuralPosts] = useState<MuralPost[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ titulo: '', conteudo: '', pinned: false });
  const [editingPost, setEditingPost] = useState<MuralPost | null>(null);

  // Config state
  const [config, setConfig] = useState<Record<string, any>>({});
  const [newConfigKey, setNewConfigKey] = useState('');
  const [newConfigValue, setNewConfigValue] = useState('');

  // Cardapio import state
  const [cardapioData, setCardapioData] = useState({
    mes: '',
    tipo: 'padrao' as 'padrao' | 'light',
    dados: ''
  });

  useEffect(() => {
    if (hasAccess) {
      if (activeTab === 'usuarios' && isAdmin) loadUsers();
      if (activeTab === 'ti' && isTI) loadTISolicitacoes();
      if (activeTab === 'mural' && isRH) loadMuralPosts();
      if (activeTab === 'config' && isAdmin) loadConfig();
    }
  }, [activeTab, hasAccess, isAdmin, isTI, isRH]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/users`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        toast.error('Erro ao carregar usuários');
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const loadTISolicitacoes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/ti/solicitacoes`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTiSolicitacoes(data.solicitacoes || []);
      } else {
        toast.error('Erro ao carregar solicitações TI');
      }
    } catch (error) {
      console.error('Erro ao carregar solicitações TI:', error);
      toast.error('Erro ao carregar solicitações TI');
    } finally {
      setLoading(false);
    }
  };

  const loadMinhasSolicitacoes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/ti/minhas`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMinhasSolicitacoes(data.solicitacoes || []);
      } else {
        toast.error('Erro ao carregar minhas solicitações');
      }
    } catch (error) {
      console.error('Erro ao carregar minhas solicitações:', error);
      toast.error('Erro ao carregar minhas solicitações');
    } finally {
      setLoading(false);
    }
  };

  const loadMuralPosts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/mural/posts`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMuralPosts(data.posts || []);
      } else {
        toast.error('Erro ao carregar posts do mural');
      }
    } catch (error) {
      console.error('Erro ao carregar posts do mural:', error);
      toast.error('Erro ao carregar posts do mural');
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/config`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config || {});
      } else {
        toast.error('Erro ao carregar configurações');
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newUser)
      });

      if (response.ok) {
        toast.success('Usuário criado com sucesso!');
        setShowAddUserModal(false);
        setNewUser({ nome: '', email: '', setor: '', role: 'colaborador', senha: '' });
        loadUsers();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao criar usuário');
      }
    } catch (error) {
      toast.error('Erro ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserStatus = async (userId: number, ativo: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ativo })
      });

      if (response.ok) {
        toast.success(ativo ? 'Usuário ativado!' : 'Usuário desativado!');
        loadUsers();
      } else {
        toast.error('Erro ao atualizar usuário');
      }
    } catch (error) {
      toast.error('Erro ao atualizar usuário');
    }
  };

  const handleUpdateTISolicitacao = async (id: number, status: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/ti/solicitacoes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        toast.success('Status atualizado!');
        loadTISolicitacoes();
      } else {
        toast.error('Erro ao atualizar status');
      }
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleCreateTISolicitacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/ti/solicitacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newSolicitacao)
      });

      if (response.ok) {
        toast.success('Solicitação criada com sucesso!');
        setShowNewSolicitacao(false);
        setNewSolicitacao({ titulo: '', descricao: '' });
        loadMinhasSolicitacoes();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao criar solicitação');
      }
    } catch (error) {
      toast.error('Erro ao criar solicitação');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/rh/mural/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newPost)
      });

      if (response.ok) {
        toast.success('Post criado com sucesso!');
        setShowNewPost(false);
        setNewPost({ titulo: '', conteudo: '', pinned: false });
        loadMuralPosts();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao criar post');
      }
    } catch (error) {
      toast.error('Erro ao criar post');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/rh/mural/posts/${editingPost.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          titulo: editingPost.titulo,
          conteudo: editingPost.conteudo,
          pinned: editingPost.pinned
        })
      });

      if (response.ok) {
        toast.success('Post atualizado com sucesso!');
        setEditingPost(null);
        loadMuralPosts();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao atualizar post');
      }
    } catch (error) {
      toast.error('Erro ao atualizar post');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm('Tem certeza que deseja excluir este post?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/rh/mural/posts/${postId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Post excluído com sucesso!');
        loadMuralPosts();
      } else {
        toast.error('Erro ao excluir post');
      }
    } catch (error) {
      toast.error('Erro ao excluir post');
    }
  };

  const handleSaveConfig = async () => {
    if (!newConfigKey || !newConfigValue) {
      toast.error('Preencha chave e valor');
      return;
    }

    try {
      let parsedValue = newConfigValue;
      try {
        parsedValue = JSON.parse(newConfigValue);
      } catch {
        // Keep as string if not valid JSON
      }

      const newConfig = { ...config, [newConfigKey]: parsedValue };
      
      const response = await fetch(`${API_BASE}/api/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newConfig)
      });

      if (response.ok) {
        toast.success('Configuração salva!');
        setConfig(newConfig);
        setNewConfigKey('');
        setNewConfigValue('');
      } else {
        toast.error('Erro ao salvar configuração');
      }
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  const handleCardapioImport = async () => {
    if (!cardapioData.mes || !cardapioData.dados) {
      toast.error('Preencha mês e dados JSON');
      return;
    }

    try {
      const dados = JSON.parse(cardapioData.dados);
      
      const response = await fetch(`${API_BASE}/api/admin/cardapio/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mes: cardapioData.mes,
          tipo: cardapioData.tipo,
          dados
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Cardápio importado: ${result.fileName}`);
        setCardapioData({ mes: '', tipo: 'padrao', dados: '' });
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao importar cardápio');
      }
    } catch (error) {
      toast.error('JSON inválido ou erro na importação');
    }
  };

  const exportReport = (type: string) => {
    const baseUrl = `${API_BASE}/api/admin/export/${type}.csv`;
    const today = new Date();
    const thisMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    
    let url = baseUrl;
    if (type === 'ranking') {
      url += `?month=${thisMonth}`;
    } else {
      const fromDate = `${thisMonth}-01`;
      const toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      url += `?from=${fromDate}&to=${toDate}`;
    }
    
    window.open(url, '_blank');
  };

  if (!hasAccess) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Restrito</h2>
            <p className="text-gray-600">Você não tem permissão para acessar este painel.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const tabs = [
    { id: 'usuarios', label: 'Usuários', icon: Users, show: isAdmin },
    { id: 'relatorios', label: 'Relatórios', icon: Download, show: isAdmin || isRH },
    { id: 'config', label: 'Configurações', icon: Settings, show: isAdmin },
    { id: 'ti', label: 'Painel TI', icon: Monitor, show: isTI },
    { id: 'mural', label: 'Painel RH', icon: MessageSquare, show: isRH },
    { id: 'cardapio', label: 'Cardápio', icon: UtensilsCrossed, show: isRH }
  ].filter(tab => tab.show);

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>

        {/* Tabs */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <nav className="flex space-x-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          {/* Users Tab */}
          {activeTab === 'usuarios' && isAdmin && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Gerenciamento de Usuários</h2>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Usuário</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Nome</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Setor</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Pontos</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-b border-gray-100">
                        <td className="py-3 px-4">{user.nome}</td>
                        <td className="py-3 px-4">{user.email}</td>
                        <td className="py-3 px-4">{user.setor}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.role === 'admin' ? 'bg-red-100 text-red-800' :
                            user.role === 'rh' ? 'bg-blue-100 text-blue-800' :
                            user.role === 'ti' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">{user.total_pontos_mensal}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {user.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleUpdateUserStatus(user.id, user.ativo ? 0 : 1)}
                            className={`text-sm px-3 py-1 rounded ${
                              user.ativo ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {user.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'relatorios' && (isAdmin || isRH) && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Relatórios e Exportações</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Trocas de Proteína</h3>
                  <p className="text-sm text-gray-600 mb-3">Exportar trocas de proteína do mês atual</p>
                  <button
                    onClick={() => exportReport('trocas')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar CSV</span>
                  </button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Ranking Mensal</h3>
                  <p className="text-sm text-gray-600 mb-3">Exportar ranking de pontos do mês</p>
                  <button
                    onClick={() => exportReport('ranking')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar CSV</span>
                  </button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Agendamentos Portaria</h3>
                  <p className="text-sm text-gray-600 mb-3">Exportar agendamentos da portaria</p>
                  <button
                    onClick={() => exportReport('portaria')}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar CSV</span>
                  </button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Reservas de Salas</h3>
                  <p className="text-sm text-gray-600 mb-3">Exportar reservas de salas</p>
                  <button
                    onClick={() => exportReport('reservas')}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar CSV</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Config Tab */}
          {activeTab === 'config' && isAdmin && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Configurações do Sistema</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Adicionar/Editar Configuração</h3>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={newConfigKey}
                      onChange={(e) => setNewConfigKey(e.target.value)}
                      placeholder="Chave da configuração"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <textarea
                      value={newConfigValue}
                      onChange={(e) => setNewConfigValue(e.target.value)}
                      placeholder="Valor (pode ser JSON)"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSaveConfig}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>Salvar</span>
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Configurações Existentes</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(config).map(([key, value]) => (
                      <div key={key} className="p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium text-sm text-gray-900">{key}</div>
                        <div className="text-xs text-gray-600 mt-1 break-all">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TI Panel Tab */}
          {activeTab === 'ti' && isTI && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Painel TI</h2>
                <div className="space-x-2">
                  <button
                    onClick={() => {
                      setShowMinhasSolicitacoes(true);
                      loadMinhasSolicitacoes();
                    }}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Minhas Solicitações</span>
                  </button>
                  <button
                    onClick={() => setShowNewSolicitacao(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nova Solicitação</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Título</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Solicitante</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Data</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiSolicitacoes.map(solicitacao => (
                      <tr key={solicitacao.id} className="border-b border-gray-100">
                        <td className="py-3 px-4">{solicitacao.titulo}</td>
                        <td className="py-3 px-4">{solicitacao.solicitante_nome}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            solicitacao.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                            solicitacao.status === 'aprovado' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {solicitacao.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">{new Date(solicitacao.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleUpdateTISolicitacao(solicitacao.id, 'aprovado')}
                              className="text-green-600 hover:bg-green-50 px-2 py-1 rounded text-sm"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleUpdateTISolicitacao(solicitacao.id, 'reprovado')}
                              className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-sm"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RH Mural Panel Tab */}
          {activeTab === 'mural' && isRH && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Gerenciar Posts do Mural</h2>
                <button
                  onClick={() => setShowNewPost(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Post</span>
                </button>
              </div>

              <div className="space-y-4">
                {muralPosts.map(post => (
                  <div key={post.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{post.titulo}</h3>
                        <p className="text-sm text-gray-600">Por {post.author} • {new Date(post.created_at).toLocaleDateString('pt-BR')}</p>
                        {post.pinned === 1 && (
                          <span className="inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full mt-1">Fixado</span>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingPost(post)}
                          className="text-blue-600 hover:bg-blue-50 p-1 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-red-600 hover:bg-red-50 p-1 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-700">{post.conteudo}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cardapio Tab */}
          {activeTab === 'cardapio' && isRH && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Gerenciar Cardápio</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Importar Cardápio</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Mês (YYYY-MM)</label>
                        <input
                          type="month"
                          value={cardapioData.mes}
                          onChange={(e) => setCardapioData({...cardapioData, mes: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                        <select
                          value={cardapioData.tipo}
                          onChange={(e) => setCardapioData({...cardapioData, tipo: e.target.value as 'padrao' | 'light'})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="padrao">Padrão</option>
                          <option value="light">Light</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Dados JSON</label>
                      <textarea
                        value={cardapioData.dados}
                        onChange={(e) => setCardapioData({...cardapioData, dados: e.target.value})}
                        placeholder='[{"data": "01/08/2025", "proteina": "Frango", ...}]'
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                    <button
                      onClick={handleCardapioImport}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Importar Cardápio</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Exportar Dados</h3>
                  <div className="space-y-4">
                    <button
                      onClick={() => exportReport('trocas')}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Exportar Trocas de Proteína (CSV)</span>
                    </button>
                    
                    <p className="text-sm text-gray-600">
                      O relatório incluirá todas as trocas de proteína solicitadas pelos funcionários no período atual.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        
        {/* Add User Modal */}
        {showAddUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Adicionar Usuário</h2>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <input
                    type="text"
                    value={newUser.nome}
                    onChange={(e) => setNewUser({...newUser, nome: e.target.value})}
                    placeholder="Nome completo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    placeholder="Email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="text"
                    value={newUser.setor}
                    onChange={(e) => setNewUser({...newUser, setor: e.target.value})}
                    placeholder="Setor"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="colaborador">Colaborador</option>
                    <option value="rh">RH</option>
                    <option value="ti">TI</option>
                    <option value="admin">Admin</option>
                  </select>
                  <input
                    type="password"
                    value={newUser.senha}
                    onChange={(e) => setNewUser({...newUser, senha: e.target.value})}
                    placeholder="Senha"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
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
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Criando...' : 'Criar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Other modals follow similar patterns... */}
        {/* For brevity, I'll include a few key ones */}

        {/* New TI Request Modal */}
        {showNewSolicitacao && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Nova Solicitação TI</h2>
                <form onSubmit={handleCreateTISolicitacao} className="space-y-4">
                  <input
                    type="text"
                    value={newSolicitacao.titulo}
                    onChange={(e) => setNewSolicitacao({...newSolicitacao, titulo: e.target.value})}
                    placeholder="Título da solicitação"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <textarea
                    value={newSolicitacao.descricao}
                    onChange={(e) => setNewSolicitacao({...newSolicitacao, descricao: e.target.value})}
                    placeholder="Descrição detalhada"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowNewSolicitacao(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Criando...' : 'Criar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* New Post Modal */}
        {showNewPost && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Novo Post no Mural</h2>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <input
                    type="text"
                    value={newPost.titulo}
                    onChange={(e) => setNewPost({...newPost, titulo: e.target.value})}
                    placeholder="Título do post"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <textarea
                    value={newPost.conteudo}
                    onChange={(e) => setNewPost({...newPost, conteudo: e.target.value})}
                    placeholder="Conteúdo do post"
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newPost.pinned}
                      onChange={(e) => setNewPost({...newPost, pinned: e.target.checked})}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Fixar post</span>
                  </label>
                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowNewPost(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Criando...' : 'Criar Post'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Post Modal */}
        {editingPost && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Editar Post</h2>
                <form onSubmit={handleUpdatePost} className="space-y-4">
                  <input
                    type="text"
                    value={editingPost.titulo}
                    onChange={(e) => setEditingPost({...editingPost, titulo: e.target.value})}
                    placeholder="Título do post"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <textarea
                    value={editingPost.conteudo}
                    onChange={(e) => setEditingPost({...editingPost, conteudo: e.target.value})}
                    placeholder="Conteúdo do post"
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editingPost.pinned === 1}
                      onChange={(e) => setEditingPost({...editingPost, pinned: e.target.checked ? 1 : 0})}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Fixar post</span>
                  </label>
                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditingPost(null)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* My Requests Modal */}
        {showMinhasSolicitacoes && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Minhas Solicitações</h2>
                  <button
                    onClick={() => setShowMinhasSolicitacoes(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  {minhasSolicitacoes.map(solicitacao => (
                    <div key={solicitacao.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{solicitacao.titulo}</h3>
                          <p className="text-sm text-gray-600">{new Date(solicitacao.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          solicitacao.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                          solicitacao.status === 'aprovado' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {solicitacao.status}
                        </span>
                      </div>
                      <p className="text-gray-700">{solicitacao.descricao}</p>
                      {solicitacao.responsavel_nome && (
                        <p className="text-sm text-gray-500 mt-2">Responsável: {solicitacao.responsavel_nome}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};