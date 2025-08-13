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
  Star
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const API_BASE = '';

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

const ROLES = [
  { value: 'colaborador', label: 'Colaborador', icon: User, color: 'bg-gray-100 text-gray-800' },
  { value: 'ti', label: 'TI', icon: Settings, color: 'bg-blue-100 text-blue-800' },
  { value: 'rh', label: 'RH', icon: Briefcase, color: 'bg-green-100 text-green-800' },
  { value: 'admin', label: 'Administrador', icon: Crown, color: 'bg-purple-100 text-purple-800' },
];

const SETORES = [
  'Administração', 'Comercial', 'Financeiro', 'Geral', 'Logística', 
  'Marketing', 'Operações', 'RH', 'TI', 'Vendas'
];

// Mock users para fallback
const getMockUsers = (): Usuario[] => [
  {
    id: '1',
    nome: 'Administrador Sistema',
    email: 'admin@grupocropfield.com.br',
    setor: 'TI',
    role: 'admin',
    ativo: true,
    created_at: '2025-01-01T00:00:00Z',
    total_pontos_mensal: 1500
  },
  {
    id: '2',
    nome: 'Maria Santos',
    email: 'maria.santos@grupocropfield.com.br',
    setor: 'RH',
    role: 'rh',
    ativo: true,
    created_at: '2025-01-02T00:00:00Z',
    total_pontos_mensal: 980
  },
  {
    id: '3',
    nome: 'João Silva',
    email: 'joao.silva@grupocropfield.com.br',
    setor: 'TI',
    role: 'ti',
    ativo: true,
    created_at: '2025-01-03T00:00:00Z',
    total_pontos_mensal: 750
  },
  {
    id: '4',
    nome: 'Ana Costa',
    email: 'ana.costa@grupocropfield.com.br',
    setor: 'Vendas',
    role: 'colaborador',
    ativo: true,
    created_at: '2025-01-04T00:00:00Z',
    total_pontos_mensal: 420
  },
  {
    id: '5',
    nome: 'Carlos Oliveira',
    email: 'carlos.oliveira@grupocropfield.com.br',
    setor: 'Financeiro',
    role: 'colaborador',
    ativo: false,
    created_at: '2025-01-05T00:00:00Z',
    total_pontos_mensal: 0
  }
];

export const GerenciamentoUsuarios: React.FC = () => {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    setor: 'Geral',
    role: 'colaborador' as Usuario['role'],
    senha: '',
    ativo: true
  });

  // Check if user has permission to manage users
  const canManage = user && ['admin', 'rh', 'ti'].includes(user.role || '');
  const isAdmin = user?.role === 'admin';
  const isRH = user?.role === 'rh' || user?.role === 'admin';

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    try {
      setLoading(true);
      
      try {
        const response = await fetch(`${API_BASE}/api/admin/users`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setUsuarios(data.users || []);
        } else {
          // Fallback para dados mock se o backend falhar
          console.log('Backend não disponível, usando dados mock');
          setUsuarios(getMockUsers());
        }
      } catch (apiError) {
        console.log('API não disponível, usando dados mock');
        setUsuarios(getMockUsers());
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      setUsuarios(getMockUsers());
    } finally {
      setLoading(false);
    }
  };

  const openModal = (mode: 'create' | 'edit', usuario?: Usuario) => {
    setModalMode(mode);
    setSelectedUser(usuario || null);
    
    if (mode === 'edit' && usuario) {
      setFormData({
        nome: usuario.nome,
        email: usuario.email,
        setor: usuario.setor,
        role: usuario.role,
        senha: '',
        ativo: usuario.ativo
      });
    } else {
      setFormData({
        nome: '',
        email: '',
        setor: 'Geral',
        role: 'colaborador',
        senha: '',
        ativo: true
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setShowPassword(false);
    setFormData({
      nome: '',
      email: '',
      setor: 'Geral',
      role: 'colaborador',
      senha: '',
      ativo: true
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.email || (modalMode === 'create' && !formData.senha)) {
      toast.error('Preencha todos os campos obrigatórios!');
      return;
    }

    try {
      if (modalMode === 'create') {
        try {
          const response = await fetch(`${API_BASE}/api/admin/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(formData)
          });

          if (response.ok) {
            toast.success('Usuário criado com sucesso!');
            loadUsuarios();
            closeModal();
          } else {
            const error = await response.json().catch(() => ({}));
            toast.error(error.error || 'Erro ao criar usuário');
          }
        } catch (apiError) {
          // Simular criação local se backend não disponível
          const novoUsuario: Usuario = {
            id: Date.now().toString(),
            nome: formData.nome,
            email: formData.email,
            setor: formData.setor,
            role: formData.role,
            ativo: formData.ativo,
            created_at: new Date().toISOString(),
            total_pontos_mensal: 0
          };
          
          setUsuarios(prev => [novoUsuario, ...prev]);
          toast.success('Usuário criado com sucesso! (modo local)');
          closeModal();
        }
      } else if (selectedUser) {
        try {
          const response = await fetch(`${API_BASE}/api/admin/users/${selectedUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              nome: formData.nome,
              email: formData.email,
              setor: formData.setor,
              role: formData.role,
              ativo: formData.ativo
            })
          });

          if (response.ok) {
            toast.success('Usuário atualizado com sucesso!');
            loadUsuarios();
            closeModal();
          } else {
            const error = await response.json().catch(() => ({}));
            toast.error(error.error || 'Erro ao atualizar usuário');
          }
        } catch (apiError) {
          // Simular edição local se backend não disponível
          setUsuarios(prev => 
            prev.map(usuario => 
              usuario.id === selectedUser.id 
                ? { ...usuario, ...formData }
                : usuario
            )
          );
          toast.success('Usuário atualizado com sucesso! (modo local)');
          closeModal();
        }
      }
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast.error('Erro ao salvar usuário');
    }
  };

  const handlePasswordReset = async (userId: string) => {
    const novaSenha = prompt('Digite a nova senha:');
    if (!novaSenha) return;

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ senha: novaSenha })
      });

      if (response.ok) {
        toast.success('Senha alterada com sucesso!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao alterar senha');
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      toast.error('Erro ao alterar senha');
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ativo: !currentStatus })
      });

      if (response.ok) {
        toast.success(`Usuário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
        loadUsuarios();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao alterar status');
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja desativar este usuário?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Usuário desativado com sucesso!');
        loadUsuarios();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao desativar usuário');
      }
    } catch (error) {
      console.error('Erro ao desativar usuário:', error);
      toast.error('Erro ao desativar usuário');
    }
  };

  // Filter users based on search term
  const filteredUsers = usuarios.filter(usuario => 
    usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.setor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleInfo = (role: string) => {
    return ROLES.find(r => r.value === role) || ROLES[0];
  };

  const canEditUser = (usuario: Usuario) => {
    if (isAdmin) return true;
    if (isRH && usuario.role !== 'admin') return true;
    return false;
  };

  if (!canManage) {
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
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Users className="w-7 h-7 mr-3 text-blue-600" />
              Gerenciamento de Usuários
            </h1>
            <p className="text-gray-600 mt-1">
              {filteredUsers.length} usuários • {filteredUsers.filter(u => u.ativo).length} ativos
            </p>
          </div>
          
          {(isAdmin || isRH) && (
            <button
              onClick={() => openModal('create')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Novo Usuário</span>
            </button>
          )}
        </div>

        {/* Search and Stats */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por nome, email, setor ou função..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {filteredUsers.filter(u => u.ativo).length}
                </div>
                <div className="text-sm text-green-700">Ativos</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {filteredUsers.filter(u => !u.ativo).length}
                </div>
                <div className="text-sm text-red-700">Inativos</div>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Carregando usuários...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Setor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Função
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pontos/Mês
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((usuario) => {
                    const roleInfo = getRoleInfo(usuario.role);
                    const IconComponent = roleInfo.icon;
                    
                    return (
                      <tr key={usuario.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-medium text-gray-900">{usuario.nome}</div>
                            <div className="text-sm text-gray-500">{usuario.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {usuario.setor}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>
                            <IconComponent className="w-3 h-3 mr-1" />
                            {roleInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Star className="w-4 h-4 text-yellow-500 mr-1" />
                            {usuario.total_pontos_mensal || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            usuario.ativo 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {usuario.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          {canEditUser(usuario) && (
                            <>
                              <button
                                onClick={() => openModal('edit', usuario)}
                                className="text-blue-600 hover:text-blue-900 p-1"
                                title="Editar usuário"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handlePasswordReset(usuario.id)}
                                className="text-orange-600 hover:text-orange-900 p-1"
                                title="Resetar senha"
                              >
                                <Shield className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleToggleStatus(usuario.id, usuario.ativo)}
                                className={`p-1 ${usuario.ativo ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                                title={usuario.ativo ? 'Desativar' : 'Ativar'}
                              >
                                {usuario.ativo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                              
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(usuario.id)}
                                  className="text-red-600 hover:text-red-900 p-1"
                                  title="Desativar permanentemente"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {filteredUsers.length === 0 && (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum usuário encontrado</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {modalMode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Setor
                    </label>
                    <select
                      value={formData.setor}
                      onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {SETORES.map(setor => (
                        <option key={setor} value={setor}>{setor}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Função
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as Usuario['role'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {ROLES.filter(role => {
                        if (isAdmin) return true;
                        return role.value !== 'admin';
                      }).map(role => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {modalMode === 'create' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Senha *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.senha}
                          onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="ativo" className="text-sm text-gray-700">
                      Usuário ativo
                    </label>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>{modalMode === 'create' ? 'Criar' : 'Salvar'}</span>
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