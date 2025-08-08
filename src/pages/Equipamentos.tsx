import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Monitor, Smartphone, Mouse, Keyboard, Headphones, Printer, Send, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { useGamification } from '../contexts/GamificationContext';

interface EquipmentRequest {
  id: string;
  equipment: string;
  justification: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'delivered';
  requestDate: Date;
  user: string;
  userEmail: string;
}

export const Equipamentos: React.FC = () => {
  const { user } = useAuth();
  const { addActivity } = useGamification();
  const [formData, setFormData] = useState({
    equipment: '',
    customEquipment: '',
    justification: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
  });
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<EquipmentRequest[]>([
    {
      id: '1',
      equipment: 'Notebook',
      justification: 'Para trabalho remoto',
      priority: 'high',
      status: 'approved',
      requestDate: new Date('2025-01-10'),
      user: 'João Silva',
      userEmail: 'joao.silva@grupocropfield.com.br',
    },
    {
      id: '2',
      equipment: 'Mouse sem fio',
      justification: 'Mouse atual com defeito',
      priority: 'medium',
      status: 'pending',
      requestDate: new Date('2025-01-12'),
      user: 'Maria Santos',
      userEmail: 'maria.santos@grupocropfield.com.br',
    },
  ]);

  const equipmentTypes = [
    { id: 'notebook', name: 'Notebook', icon: Monitor },
    { id: 'desktop', name: 'Computador Desktop', icon: Monitor },
    { id: 'smartphone', name: 'Smartphone', icon: Smartphone },
    { id: 'mouse', name: 'Mouse', icon: Mouse },
    { id: 'keyboard', name: 'Teclado', icon: Keyboard },
    { id: 'headset', name: 'Headset', icon: Headphones },
    { id: 'printer', name: 'Impressora', icon: Printer },
    { id: 'other', name: 'Outro', icon: Monitor },
  ];

  const priorityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800',
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    delivered: 'bg-green-100 text-green-800',
  };

  const priorityLabels = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
  };

  const statusLabels = {
    pending: 'Pendente',
    approved: 'Aprovado',
    delivered: 'Entregue',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const equipmentName = formData.equipment === 'other' ? formData.customEquipment : formData.equipment;
      
      if (!equipmentName || !formData.justification) {
        toast.error('Preencha todos os campos obrigatórios!');
        return;
      }

      const newRequest: EquipmentRequest = {
        id: Date.now().toString(),
        equipment: equipmentName,
        justification: formData.justification,
        priority: formData.priority,
        status: 'pending',
        requestDate: new Date(),
        user: user?.name || 'Usuário',
        userEmail: user?.email || '',
      };

      setRequests(prev => [newRequest, ...prev]);

      // Simular envio de email para TI
      
      // Add gamification activity
      addActivity('equipment_request', `Solicitou equipamento: ${equipmentName}`, {
        equipment: equipmentName,
        priority: formData.priority,
        justification: formData.justification,
      });
      
      toast.success('Solicitação enviada com sucesso! O setor de TI foi notificado por email.');

      // Reset form
      setFormData({
        equipment: '',
        customEquipment: '',
        justification: '',
        priority: 'medium',
      });
    } catch (error) {
      toast.error('Erro ao enviar solicitação!');
    } finally {
      setLoading(false);
    }
  };

  const userRequests = requests.filter(req => req.userEmail === user?.email);
  const allRequests = user?.sector === 'TI' ? requests : userRequests;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Equipamentos de TI</h1>
          {user?.sector === 'TI' && (
            <div className="text-sm text-gray-600">
              {requests.length} solicitações totais
            </div>
          )}
        </div>

        {/* Request Form */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Nova Solicitação</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Equipamento
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {equipmentTypes.map((equipment) => (
                  <button
                    key={equipment.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, equipment: equipment.id })}
                    className={`p-4 border rounded-lg text-center transition-colors ${
                      formData.equipment === equipment.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <equipment.icon className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm font-medium">{equipment.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {formData.equipment === 'other' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Especificar Equipamento
                </label>
                <input
                  type="text"
                  value={formData.customEquipment}
                  onChange={(e) => setFormData({ ...formData, customEquipment: e.target.value })}
                  placeholder="Descreva o equipamento necessário"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prioridade
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'low' | 'medium' | 'high' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Justificativa
              </label>
              <textarea
                value={formData.justification}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                placeholder="Explique por que você precisa deste equipamento..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !formData.equipment || !formData.justification}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Enviando...' : 'Enviar Solicitação'}</span>
            </button>
          </form>
        </div>

        {/* Requests List */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {user?.sector === 'TI' ? 'Todas as Solicitações' : 'Minhas Solicitações'}
          </h2>

          {allRequests.length === 0 ? (
            <div className="text-center py-8">
              <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allRequests.map((request) => (
                <div key={request.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{request.equipment}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColors[request.priority]}`}>
                          {priorityLabels[request.priority]}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[request.status]}`}>
                          {statusLabels[request.status]}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{request.justification}</p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Solicitado por: {request.user}</span>
                        <span>•</span>
                        <span>{request.requestDate.toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    
                    {request.status === 'delivered' && (
                      <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};