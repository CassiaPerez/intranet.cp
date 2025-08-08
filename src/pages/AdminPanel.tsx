import React, { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Settings, Monitor, Users, UserPlus, UserMinus, Edit, UtensilsCrossed, Download } from 'lucide-react';

export const AdminPanel: React.FC = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>

        {/* Admin Navigation */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <nav className="flex space-x-1">
            <NavLink
              to="/admin"
              end
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              <Settings className="w-4 h-4 inline-block mr-2" />
              Painel Geral
            </NavLink>
            <NavLink
              to="/admin/painel-ti"
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
              to="/admin/painel-rh"
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
              to="/admin/usuarios"
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
              to="/admin/cardapio"
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
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/painel-ti" element={<ITPanel />} />
          <Route path="/painel-rh" element={<HRPanel />} />
          <Route path="/usuarios" element={<UserManagement />} />
          <Route path="/cardapio" element={<MenuManagement />} />
        </Routes>
      </div>
    </Layout>
  );
};

const AdminDashboard: React.FC = () => {
  const stats = [
    { title: 'Usuários Ativos', value: '127', change: '+5', color: 'bg-blue-500' },
    { title: 'Solicitações TI', value: '23', change: '+3', color: 'bg-purple-500' },
    { title: 'Reservas de Salas', value: '45', change: '+12', color: 'bg-green-500' },
    { title: 'Publicações no Mural', value: '8', change: '+2', color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <p className="text-sm text-green-600 mt-1">+{stat.change} este mês</p>
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
          <button className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors text-left">
            <UserPlus className="w-6 h-6 text-blue-600 mb-2" />
            <h4 className="font-medium text-gray-900">Adicionar Usuário</h4>
            <p className="text-sm text-gray-600">Cadastrar novo colaborador</p>
          </button>
          
          <button className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors text-left">
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
  const requests = [
    { id: 1, user: 'João Silva', equipment: 'Notebook', priority: 'Alta', status: 'Pendente', date: '15/01/2025' },
    { id: 2, user: 'Maria Santos', equipment: 'Mouse', priority: 'Média', status: 'Aprovado', date: '14/01/2025' },
    { id: 3, user: 'Carlos Oliveira', equipment: 'Headset', priority: 'Baixa', status: 'Entregue', date: '13/01/2025' },
  ];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Solicitações de Equipamentos</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-700">Usuário</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Equipamento</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Prioridade</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Data</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-b border-gray-100">
                <td className="py-3 px-4">{request.user}</td>
                <td className="py-3 px-4">{request.equipment}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    request.priority === 'Alta' ? 'bg-red-100 text-red-800' :
                    request.priority === 'Média' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {request.priority}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    request.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800' :
                    request.status === 'Aprovado' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {request.status}
                  </span>
                </td>
                <td className="py-3 px-4">{request.date}</td>
                <td className="py-3 px-4">
                  <div className="flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">Aprovar</button>
                    <button className="text-green-600 hover:text-green-800 text-sm">Entregar</button>
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
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Painel de RH</h3>
      <div className="space-y-4">
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Publicações Recentes</h4>
          <p className="text-sm text-gray-600">Gerencie as publicações do mural de informações</p>
        </div>
        
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Avaliações de Desempenho</h4>
          <p className="text-sm text-gray-600">Acompanhe o progresso dos colaboradores</p>
        </div>
      </div>
    </div>
  );
};

const UserManagement: React.FC = () => {
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  
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
        <div className="space-y-4">
          <div className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">João Silva</h4>
              <p className="text-sm text-gray-600">joao.silva@grupocropfield.com.br</p>
            </div>
            <div className="flex space-x-2">
              <button className="text-blue-600 hover:text-blue-800 text-sm">Editar</button>
              <button className="text-red-600 hover:text-red-800 text-sm">Remover</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MenuManagement: React.FC = () => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Gerenciamento do Cardápio</h3>
      <div className="space-y-4">
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Upload de Cardápio</h4>
          <p className="text-sm text-gray-600 mb-3">Envie o arquivo JSON do cardápio mensal</p>
          <input
            type="file"
            accept=".json"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Relatório de Trocas</h4>
          <p className="text-sm text-gray-600 mb-3">Exporte relatório de trocas de proteínas</p>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>
    </div>
  );
};