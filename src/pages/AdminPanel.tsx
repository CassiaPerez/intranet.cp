import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import {
  Users,
  UserPlus,
  Search,
  Edit3,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  Save,
  X,
  Crown,
  Briefcase,
  User,
  Settings,
  Star,
  Download,
  Upload,
  BarChart3,
  UtensilsCrossed,
  Plus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const API_BASE = '';
const MURAL_BASE = '/api/rh/mural/posts';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  setor: string;
  role: 'admin' | 'rh' | 'ti' | 'colaborador';
  ativo: boolean;
  created_at: string;
  total_pontos_mensal: number;
}

interface SolicitacaoTI {
  id: string;
  titulo: string;
  descricao: string;
  status: 'pendente' | 'em_analise' | 'aprovada' | 'rejeitada' | 'concluida';
  solicitante_nome: string;
  solicitante_email: string;
  responsavel_nome?: string;
  created_at: string;
  updated_at: string;
}

interface PostMural {
  id: string;
  titulo: string;
  conteudo: string;
  author: string;
  pinned: boolean;
  created_at: string;
}

const ROLES = [
  { value: 'colaborador', label: 'Colaborador', icon: User, color: 'bg-gray-100 text-gray-800' },
  { value: 'ti',          label: 'TI',          icon: Settings, color: 'bg-blue-100 text-blue-800' },
  { value: 'rh',          label: 'RH',          icon: Briefcase, color: 'bg-green-100 text-green-800' },
  { value: 'admin',       label: 'Administrador', icon: Crown,  color: 'bg-purple-100 text-purple-800' },
];

const SETORES = [
  'Administração', 'Comercial', 'Financeiro', 'Geral', 'Logística',
  'Marketing', 'Operações', 'RH', 'TI', 'Vendas'
];

const STATUS_COLORS: Record<SolicitacaoTI['status'], string> = {
  pendente:   'bg-yellow-100 text-yellow-800',
  em_analise: 'bg-blue-100 text-blue-800',
  aprovada:   'bg-green-100 text-green-800',
  rejeitada:  'bg-red-100 text-red-800',
  concluida:  'bg-gray-100 text-gray-800',
};

export const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('usuarios');
  const [loading, setLoading] = useState(false);

  // Usuários
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userModalMode, setUserModalMode] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userFormData, setUserFormData] = useState({
    nome: '',
    email: '',
    setor: 'Geral',
    role: 'colaborador' as Usuario['role'],
    senha: '',
    ativo: true,
  });

  // TI
  const [solicitacoesTI, setSolicitacoesTI] = useState<SolicitacaoTI[]>([]);
  const [showTIModal, setShowTIModal] = useState(false);
  const [tiFormData, setTiFormData] = useState({ titulo: '', descricao: '' });

  // RH / Mural
  const [postsMural, setPostsMural] = useState<PostMural[]>([]);
  const [showRHModal, setShowRHModal] = useState(false);
  const [rhModalMode, setRhModalMode] = useState<'create' | 'edit'>('create');
  const [selectedPost, setSelectedPost] = useState<PostMural | null>(null);
  const [rhFormData, setRhFormData] = useState({ titulo: '', conteudo: '', pinned: false });

  // Config
  const [systemConfig, setSystemConfig] = useState<Record<string, any>>({});
  const [configFormData, setConfigFormData] = useState<Record<string, string>>({});

  // Cardápio
  const [cardapioFile, setCardapioFile] = useState<File | null>(null);
  const [cardapioFormData, setCardapioFormData] = useState({ mes: '', tipo: 'padrao' as 'padrao' | 'light' });

  const role = (user?.role || 'colaborador') as Usuario['role'];
  const isAdmin = role === 'admin';
  const isRH    = role === 'rh' || isAdmin;
  const isTI    = role === 'ti' || isAdmin;

  const allTabs = [
    { id: 'usuarios',      label: 'Usuários',      icon: Users,        roles: ['admin', 'rh'] },
    { id: 'relatorios',    label: 'Relatórios',    icon: BarChart3,    roles: ['admin', 'rh', 'ti'] },
    { id: 'configuracoes', label: 'Configurações', icon: Settings,     roles: ['admin'] },
    { id: 'ti',            label: 'Painel TI',     icon: Settings,     roles: ['admin', 'ti'] },
    { id: 'rh',            label: 'Painel RH',     icon: Briefcase,    roles: ['admin', 'rh'] },
    { id: 'cardapio',      label: 'Cardápio',      icon: UtensilsCrossed, roles: ['admin', 'rh'] },
  ];
  const availableTabs = allTabs.filter(t => t.roles.includes(role));

  // Definir a primeira aba disponível ao carregar/alterar permissões
  useEffect(() => {
    if (availableTabs.length > 0) setActiveTab(prev => availableTabs.some(t => t.id === prev) ? prev : availableTabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTabs.length, role]);

  // Carregamentos por aba
  useEffect(() => {
    if (activeTab === 'usuarios' && (isAdmin || isRH)) loadUsuarios();
    if (activeTab === 'ti' && isTI) loadSolicitacoesTI();
    if (activeTab === 'rh' && isRH) loadPostsMural();
    if (activeTab === 'configuracoes' && isAdmin) loadSystemConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ===== Usuários =====
  const loadUsuarios = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setUsuarios(data.users || []);
      else toast.error(data.error || 'Erro ao carregar usuários');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const openUserModal = (mode: 'create' | 'edit', usuario?: Usuario) => {
    setUserModalMode(mode);
    setSelectedUser(usuario || null);
    setUserFormData(mode === 'edit' && usuario
      ? { nome: usuario.nome, email: usuario.email, setor: usuario.setor, role: usuario.role, senha: '', ativo: usuario.ativo }
      : { nome: '', email: '', setor: 'Geral', role: 'colaborador', senha: '', ativo: true }
    );
    setShowUserModal(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.nome || !userFormData.email || (userModalMode === 'create' && !userFormData.senha)) {
      toast.error('Preencha todos os campos obrigatórios!');
      return;
    }
    try {
      setLoading(true);
      if (userModalMode === 'create') {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(userFormData),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'Erro ao criar usuário');
        toast.success('Usuário criado!');
      } else if (selectedUser) {
        const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            nome: userFormData.nome,
            email: userFormData.email,
            setor: userFormData.setor,
            role: userFormData.role,
            ativo: userFormData.ativo,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'Erro ao atualizar usuário');
        toast.success('Usuário atualizado!');
      }
      setShowUserModal(false);
      loadUsuarios();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar usuário');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (userId: string) => {
    const novaSenha = prompt('Digite a nova senha:');
    if (!novaSenha) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ senha: novaSenha }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Erro ao alterar senha');
      toast.success('Senha alterada!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar senha');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ativo: !currentStatus }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Erro ao alterar status');
      toast.success(!currentStatus ? 'Usuário ativado!' : 'Usuário desativado!');
      loadUsuarios();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar status');
    }
  };

  // ===== TI =====
  const loadSolicitacoesTI = async () => {
    try {
      setLoading(true);
      console.log('[ADMIN-TI] Loading TI requests...');
      const res = await fetch('/api/ti/solicitacoes', { credentials: 'include' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Erro ao carregar solicitações TI');
      console.log('[ADMIN-TI] Loaded', j.solicitacoes?.length || 0, 'requests');
      setSolicitacoesTI(j.solicitacoes || []);
    } catch (e: any) {
      console.error('[ADMIN-TI] Error:', e);
      toast.error(e.message || 'Erro ao carregar solicitações TI');
    } finally {
      setLoading(false);
    }
  };

  const handleTISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tiFormData.titulo) return toast.error('Título é obrigatório!');
    try {
      setLoading(true);
      const res = await fetch('/api/ti/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(tiFormData),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Erro ao criar solicitação');
      toast.success('Solicitação criada!');
      setTiFormData({ titulo: '', descricao: '' });
      setShowTIModal(false);
      loadSolicitacoesTI();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar solicitação');
    } finally {
      setLoading(false);
    }
  };

  const handleTIStatusUpdate = async (solicitacaoId: string, novoStatus: SolicitacaoTI['status']) => {
    try {
      console.log('[ADMIN-TI] Updating status for request', solicitacaoId, 'to', novoStatus);
      const res = await fetch(`/api/ti/solicitacoes/${solicitacaoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: novoStatus }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Erro ao atualizar status');
      console.log('[ADMIN-TI] Status updated successfully');
      toast.success('Status atualizado!');
      loadSolicitacoesTI();
    } catch (e: any) {
      console.error('[ADMIN-TI] Error updating status:', e);
      toast.error(e.message || 'Erro ao atualizar status');
    }
  };

  // ===== RH / Mural =====
  const loadPostsMural = async () => {
    try {
      setLoading(true);
      console.log('[ADMIN-RH] Loading mural posts...');
      const res = await fetch('/api/mural/posts', { credentials: 'include' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Erro ao carregar posts do mural');
      console.log('[ADMIN-RH] Loaded', j.posts?.length || 0, 'posts');
      setPostsMural(j.posts || []);
    } catch (e: any) {
      console.error('[ADMIN-RH] Error:', e);
      toast.error(e.message || 'Erro ao carregar posts');
    } finally {
      setLoading(false);
    }
  };

  const openRHModal = (mode: 'create' | 'edit', post?: PostMural) => {
    setRhModalMode(mode);
    setSelectedPost(post || null);
    setRhFormData(mode === 'edit' && post
      ? { titulo: post.titulo, conteudo: post.conteudo, pinned: post.pinned }
      : { titulo: '', conteudo: '', pinned: false }
    );
    setShowRHModal(true);
  };

  const handleRHSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rhFormData.titulo || !rhFormData.conteudo) return toast.error('Título e conteúdo são obrigatórios!');
    try {
      setLoading(true);
      if (rhModalMode === 'create') {
        console.log('[ADMIN-RH] Creating post:', rhFormData);
        const res = await fetch('/api/mural/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(rhFormData),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'Erro ao criar post');
        console.log('[ADMIN-RH] Post created with ID:', j.id);
        toast.success('Post criado!');
      } else if (selectedPost) {
        console.log('[ADMIN-RH] Updating post:', selectedPost.id);
        const res = await fetch(`/api/mural/posts/${selectedPost.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(rhFormData),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'Erro ao atualizar post');
        console.log('[ADMIN-RH] Post updated successfully');
        toast.success('Post atualizado!');
      }
      setShowRHModal(false);
      loadPostsMural();
    } catch (e: any) {
      console.error('[ADMIN-RH] Error saving post:', e);
      toast.error(e.message || 'Erro ao salvar post');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Tem certeza que deseja deletar este post?')) return;
    try {
      console.log('[ADMIN-RH] Deleting post:', postId);
      const res = await fetch(`/api/mural/posts/${postId}`, { method: 'DELETE', credentials: 'include' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Erro ao deletar post');
      console.log('[ADMIN-RH] Post deleted successfully');
      toast.success('Post deletado!');
      loadPostsMural();
    } catch (e: any) {
      console.error('[ADMIN-RH] Error deleting post:', e);
      toast.error(e.message || 'Erro ao deletar post');
    }
  };

  // ===== Config =====
  const loadSystemConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/config`, { credentials: 'include' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Erro ao carregar configurações');
      const cfg = j.config || j.data || {};
      setSystemConfig(cfg);
      setConfigFormData(Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, String(v)])));
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(configFormData),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Erro ao salvar configurações');
      toast.success('Configurações salvas!');
      loadSystemConfig();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  // ===== Relatórios / CSV =====
  const handleExportCSV = (type: 'ranking' | 'trocas' | 'portaria' | 'reservas') => {
    const baseUrl = `${API_BASE}/api/admin/export`;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const start = `${yyyy}-${mm}-01`;
    const end = `${yyyy}-${mm}-${String(new Date(yyyy, parseInt(mm), 0).getDate()).padStart(2, '0')}`;

    const urls = {
      ranking:  `${baseUrl}/ranking.csv?month=${yyyy}-${mm}`,
      trocas:   `${baseUrl}/trocas.csv?from=${start}&to=${end}`,
      portaria: `${baseUrl}/portaria.csv`,
      reservas: `${baseUrl}/reservas.csv`,
    } as const;

    window.open(urls[type], '_blank');
  };

  // ===== Cardápio =====
  const handleCardapioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardapioFormData.mes) return toast.error('Selecione o mês!');
    try {
      setLoading(true);
      let dados: any[] = [];
      if (cardapioFile) {
        const text = await cardapioFile.text();
        dados = JSON.parse(text);
      }
      const res = await fetch(`${API_BASE}/api/admin/cardapio/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mes: cardapioFormData.mes, tipo: cardapioFormData.tipo, dados }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Erro ao importar cardápio');
      toast.success('Cardápio importado!');
      setCardapioFile(null);
      setCardapioFormData({ mes: '', tipo: 'padrao' });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao importar cardápio');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = usuarios.filter(u => {
    const q = searchTerm.toLowerCase();
    return (
      (u.nome || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.setor || '').toLowerCase().includes(q)
    );
  });

  const getRoleInfo = (r: string) => ROLES.find(x => x.value === r) || ROLES[0];

  if (availableTabs.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Restrito</h2>
            <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <nav className="flex space-x-1">
            {availableTabs.map(tab => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Conteúdo das abas */}
        <div className="space-y-6">
          {/* Usuários */}
          {activeTab === 'usuarios' && (isAdmin || isRH) && (
            <div className="space-y-6">
              {/* Quick Admin Access Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Crown className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Acesso Administrador</h3>
                </div>
                <div className="text-sm text-blue-800 space-y-1">
                  <p><strong>Super Admin:</strong> <code>admin</code> / <code>admin</code></p>
                  <p><strong>Admin Completo:</strong> <code>admin@grupocropfield.com.br</code> / <code>admin123</code></p>
                  <p><strong>Usuário RH:</strong> <code>rh@grupocropfield.com.br</code> / <code>rh123</code></p>
                  <p className="text-blue-600 mt-2">💡 Use o botão <Crown className="w-3 h-3 inline" /> para promover usuários a admin</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Gerenciamento de Usuários</h2>
                <button
                  onClick={() => openUserModal('create')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Novo Usuário</span>
                </button>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Buscar usuários..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Setor</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Função</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pontos</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map((u) => {
                          const roleInfo = getRoleInfo(u.role);
                          const IconComponent = roleInfo.icon;
                          return (
                            <tr key={u.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{u.nome}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.setor}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>
                                  <IconComponent className="w-3 h-3 mr-1" />
                                  {roleInfo.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  u.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {u.ativo ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex items-center">
                                  <Star className="w-4 h-4 text-yellow-500 mr-1" />
                                  {u.total_pontos_mensal || 0}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                <button onClick={() => openUserModal('edit', u)} className="text-blue-600 hover:text-blue-900 p-1" title="Editar">
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handlePasswordReset(u.id)} className="text-orange-600 hover:text-orange-900 p-1" title="Resetar Senha">
                                  <Shield className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleUserStatus(u.id, u.ativo)}
                                  className={`p-1 ${u.ativo ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                                  title={u.ativo ? 'Desativar' : 'Ativar'}
                                >
                                  {u.ativo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TI */}
          {activeTab === 'ti' && isTI && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Painel TI</h2>
                <button
                  onClick={() => setShowTIModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Solicitação</span>
                </button>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {solicitacoesTI.map((s) => (
                      <div key={s.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-gray-900">{s.titulo}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[s.status]}`}>
                            {s.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{s.descricao}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Solicitante: {s.solicitante_nome}</span>
                          <span>{new Date(s.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {isTI && s.status === 'pendente' && (
                          <div className="mt-3 flex space-x-2">
                            <button
                              onClick={() => handleTIStatusUpdate(s.id, 'aprovada')}
                              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => handleTIStatusUpdate(s.id, 'rejeitada')}
                              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Rejeitar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RH / Mural */}
          {activeTab === 'rh' && isRH && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Painel RH - Mural</h2>
                <button
                  onClick={() => openRHModal('create')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Post</span>
                </button>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {postsMural.map((post) => (
                      <div key={post.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-gray-900">{post.titulo}</h3>
                            {post.pinned && (
                              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Fixado</span>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <button onClick={() => openRHModal('edit', post)} className="text-blue-600 hover:text-blue-800 p-1">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeletePost(post.id)} className="text-red-600 hover:text-red-800 p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{post.conteudo}</p>
                        <div className="text-xs text-gray-500">
                          Por: {post.author} • {new Date(post.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Relatórios */}
          {activeTab === 'relatorios' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Relatórios</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(['ranking', 'trocas', 'portaria', 'reservas'] as const).map((t) => (
                  <div key={t} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-semibold text-gray-900 mb-4">
                      {t === 'ranking' ? 'Ranking Mensal'
                        : t === 'trocas' ? 'Trocas de Proteína'
                        : t === 'portaria' ? 'Portaria'
                        : 'Reservas de Salas'}
                    </h3>
                    <button
                      onClick={() => handleExportCSV(t)}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Exportar CSV</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Configurações */}
          {activeTab === 'configuracoes' && isAdmin && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Configurações do Sistema</h2>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <form onSubmit={handleConfigSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Sistema</label>
                    <input
                      type="text"
                      value={configFormData.sistema_nome || ''}
                      onChange={(e) => setConfigFormData({ ...configFormData, sistema_nome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Intranet Grupo Cropfield"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email de Suporte</label>
                    <input
                      type="email"
                      value={configFormData.suporte_email || ''}
                      onChange={(e) => setConfigFormData({ ...configFormData, suporte_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="suporte@grupocropfield.com.br"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Salvar Configurações'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Cardápio */}
          {activeTab === 'cardapio' && (isAdmin || isRH) && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Gerenciamento do Cardápio</h2>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <form onSubmit={handleCardapioSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Mês (YYYY-MM)</label>
                      <input
                        type="month"
                        value={cardapioFormData.mes}
                        onChange={(e) => setCardapioFormData({ ...cardapioFormData, mes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                      <select
                        value={cardapioFormData.tipo}
                        onChange={(e) => setCardapioFormData({ ...cardapioFormData, tipo: e.target.value as 'padrao' | 'light' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="padrao">Padrão</option>
                        <option value="light">Light</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo JSON do Cardápio</label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => setCardapioFile(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !cardapioFormData.mes}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{loading ? 'Importando...' : 'Importar Cardápio'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Modais */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {userModalMode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}
                  </h2>
                  <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleUserSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                    <input
                      type="text"
                      value={userFormData.nome}
                      onChange={(e) => setUserFormData({ ...userFormData, nome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">E-mail *</label>
                    <input
                      type="email"
                      value={userFormData.email}
                      onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Setor</label>
                    <select
                      value={userFormData.setor}
                      onChange={(e) => setUserFormData({ ...userFormData, setor: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {SETORES.map((setor) => <option key={setor} value={setor}>{setor}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Função</label>
                    <select
                      value={userFormData.role}
                      onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as Usuario['role'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {ROLES.filter(r => (isAdmin ? true : r.value !== 'admin')).map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  {userModalMode === 'create' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Senha *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={userFormData.senha}
                          onChange={(e) => setUserFormData({ ...userFormData, senha: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="ativo"
                      checked={userFormData.ativo}
                      onChange={(e) => setUserFormData({ ...userFormData, ativo: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="ativo" className="text-sm text-gray-700">Usuário ativo</label>
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2">
                      <Save className="w-4 h-4" />
                      <span>{loading ? 'Salvando...' : (userModalMode === 'create' ? 'Criar' : 'Salvar')}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {showTIModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Nova Solicitação TI</h2>
                  <button onClick={() => setShowTIModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleTISubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
                    <input
                      type="text"
                      value={tiFormData.titulo}
                      onChange={(e) => setTiFormData({ ...tiFormData, titulo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                    <textarea
                      value={tiFormData.descricao}
                      onChange={(e) => setTiFormData({ ...tiFormData, descricao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                    />
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <button type="button" onClick={() => setShowTIModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      {loading ? 'Criando...' : 'Criar Solicitação'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {showRHModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">{rhModalMode === 'create' ? 'Novo Post' : 'Editar Post'}</h2>
                  <button onClick={() => setShowRHModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleRHSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
                    <input
                      type="text"
                      value={rhFormData.titulo}
                      onChange={(e) => setRhFormData({ ...rhFormData, titulo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Conteúdo *</label>
                    <textarea
                      value={rhFormData.conteudo}
                      onChange={(e) => setRhFormData({ ...rhFormData, conteudo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={6}
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="pinned"
                      checked={rhFormData.pinned}
                      onChange={(e) => setRhFormData({ ...rhFormData, pinned: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="pinned" className="text-sm text-gray-700">Fixar post no topo</label>
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <button type="button" onClick={() => setShowRHModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      {loading ? 'Salvando...' : (rhModalMode === 'create' ? 'Criar Post' : 'Salvar')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default AdminPanel;
