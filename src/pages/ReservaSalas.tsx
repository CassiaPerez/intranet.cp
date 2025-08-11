import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Calendar, Clock, MapPin, Users, Plus, User } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useGamification } from '../contexts/GamificationContext';

const API_BASE = '';

const salas = [
  { id: 'aquario', name: 'Sala Aquário', capacity: 8, color: '#3B82F6' },
  { id: 'grande', name: 'Sala Grande', capacity: 20, color: '#10B981' },
  { id: 'pequena', name: 'Sala Pequena', capacity: 6, color: '#F59E0B' },
  { id: 'recepcao', name: 'Recepção', capacity: 4, color: '#EF4444' },
];

export const ReservaSalas: React.FC = () => {
  const { user } = useAuth();
  const { addActivity } = useGamification();
  const [activeTab, setActiveTab] = useState<'salas' | 'portaria'>('salas');
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [reservationData, setReservationData] = useState({
    sala: '',
    motivo: '',
    descricao: '',
    inicio: '',
    fim: '',
  });

  const [portariaData, setPortariaData] = useState({
    data: '',
    hora: '',
    visitante: '',
    documento: '',
    observacao: '',
  });

  const [events] = useState([
    {
      id: '1',
      title: 'Reunião de Vendas - João Silva',
      start: '2025-01-15T09:00:00',
      end: '2025-01-15T11:00:00',
      backgroundColor: '#3B82F6',
      extendedProps: {
        sala: 'Sala Aquário',
        motivo: 'Reunião de vendas',
        responsavel: 'João Silva',
      },
    },
    {
      id: '2',
      title: 'Treinamento - Maria Santos',
      start: '2025-01-16T14:00:00',
      end: '2025-01-16T17:00:00',
      backgroundColor: '#10B981',
      extendedProps: {
        sala: 'Sala Grande',
        motivo: 'Treinamento',
        responsavel: 'Maria Santos',
      },
    },
  ]);

  const handleDateClick = (selectInfo: any) => {
    setSelectedDate(selectInfo.date);
    setReservationData({
      ...reservationData,
      inicio: selectInfo.date.toISOString().slice(0, 16),
    });
    setShowReservationModal(true);
  };

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!reservationData.sala || !reservationData.inicio || !reservationData.fim || !reservationData.motivo) {
      toast.error('Preencha todos os campos obrigatórios!');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          sala: reservationData.sala,
          data: reservationData.inicio.split('T')[0],
          inicio: reservationData.inicio.split('T')[1],
          fim: reservationData.fim.split('T')[1],
          assunto: reservationData.motivo
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        addActivity('room_reservation', `Reservou ${reservationData.sala} para ${reservationData.motivo}`, {
          sala: reservationData.sala,
          data: reservationData.inicio.split('T')[0],
          motivo: reservationData.motivo,
        });
        if (data.points) {
          toast.success(`Reserva realizada com sucesso! +${data.points} pontos`);
        } else {
          toast.success('Reserva realizada com sucesso!');
        }
        setShowReservationModal(false);
        setReservationData({
          sala: '',
          motivo: '',
          descricao: '',
          inicio: '',
          fim: '',
        });
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao criar reserva');
      }
    } catch (error) {
      console.error('Erro ao criar reserva:', error);
      toast.error('Erro ao criar reserva');
    } finally {
      setLoading(false);
    }
  };

  const handlePortariaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!portariaData.data || !portariaData.hora || !portariaData.visitante) {
      toast.error('Preencha todos os campos obrigatórios!');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/portaria/agendamentos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(portariaData)
      });
      
      if (response.ok) {
        const data = await response.json();
        addActivity('reception_appointment', `Agendou visita de ${portariaData.visitante}`, {
          visitante: portariaData.visitante,
          data: portariaData.data,
        });
        if (data.points) {
          toast.success(`Agendamento realizado com sucesso! +${data.points} pontos`);
        } else {
          toast.success('Agendamento realizado com sucesso!');
        }
        setPortariaData({
          data: '',
          hora: '',
          visitante: '',
          documento: '',
          observacao: '',
        });
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao criar agendamento');
      }
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast.error('Erro ao criar agendamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Reserva de Espaços</h1>
          <button
            onClick={() => setShowReservationModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Reserva</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('salas')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'salas'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Salas de Reunião
          </button>
          <button
            onClick={() => setActiveTab('portaria')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'portaria'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Agendamentos da Portaria
          </button>
        </div>

        {activeTab === 'salas' && (
          <>
            {/* Salas Info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {salas.map((sala) => (
                <div key={sala.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: sala.color }}
                    ></div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{sala.name}</h3>
                      <div className="flex items-center space-x-1 mt-1">
                        <Users className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{sala.capacity} pessoas</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }}
                initialView="timeGridWeek"
                editable={true}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={true}
                weekends={true}
                events={events}
                select={handleDateClick}
                locale="pt-br"
                height="600px"
                slotMinTime="07:00:00"
                slotMaxTime="19:00:00"
                businessHours={{
                  daysOfWeek: [1, 2, 3, 4, 5],
                  startTime: '08:00',
                  endTime: '18:00',
                }}
              />
            </div>
          </>
        )}

        {activeTab === 'portaria' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Agendamentos da Portaria</h2>
            
            {/* Formulário de Agendamento */}
            <form onSubmit={handlePortariaSubmit} className="mb-8 p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Novo Agendamento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data
                  </label>
                  <input
                    type="date"
                    value={portariaData.data}
                    onChange={(e) => setPortariaData({ ...portariaData, data: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={portariaData.hora}
                    onChange={(e) => setPortariaData({ ...portariaData, hora: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Visitante
                  </label>
                  <input
                    type="text"
                    value={portariaData.visitante}
                    onChange={(e) => setPortariaData({ ...portariaData, visitante: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nome completo do visitante"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Documento
                  </label>
                  <input
                    type="text"
                    value={portariaData.documento}
                    onChange={(e) => setPortariaData({ ...portariaData, documento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="RG, CPF ou outro documento"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={portariaData.observacao}
                    onChange={(e) => setPortariaData({ ...portariaData, observacao: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Informações adicionais sobre a visita..."
                  />
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {loading ? 'Agendando...' : 'Agendar Visita'}
                </button>
              </div>
            </form>

            {/* Lista de Agendamentos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-100 rounded-lg p-3">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Visita - Cliente ABC Corp</h3>
                    <p className="text-sm text-gray-600">Recepcionado por: Maria Santos</p>
                    <div className="flex items-center space-x-4 mt-1">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">15/01/2025</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">14:00 - 16:00</span>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  Confirmado
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Reservation Modal */}
        {showReservationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Nova Reserva</h2>
                <form onSubmit={handleReservation} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sala
                    </label>
                    <select
                      value={reservationData.sala}
                      onChange={(e) => setReservationData({ ...reservationData, sala: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecione uma sala</option>
                      {salas.map((sala) => (
                        <option key={sala.id} value={sala.id}>
                          {sala.name} ({sala.capacity} pessoas)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data/Hora Início
                      </label>
                      <input
                        type="datetime-local"
                        value={reservationData.inicio}
                        onChange={(e) => setReservationData({ ...reservationData, inicio: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data/Hora Fim
                      </label>
                      <input
                        type="datetime-local"
                        value={reservationData.fim}
                        onChange={(e) => setReservationData({ ...reservationData, fim: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motivo
                    </label>
                    <input
                      type="text"
                      value={reservationData.motivo}
                      onChange={(e) => setReservationData({ ...reservationData, motivo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Reunião de vendas"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descrição (opcional)
                    </label>
                    <textarea
                      value={reservationData.descricao}
                      onChange={(e) => setReservationData({ ...reservationData, descricao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Detalhes adicionais sobre a reunião..."
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowReservationModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {loading ? 'Reservando...' : 'Reservar'}
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