import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { Calendar, Clock, Users, Plus, User } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventInput, DateSelectArg, EventClickArg } from '@fullcalendar/core';
import toast from 'react-hot-toast';
import { useGamification } from '../contexts/GamificationContext';
import { useAuth } from '../contexts/AuthContext';

const salas = [
  { id: 'aquario', name: 'Sala Aquário', capacity: 8, color: '#3B82F6' },
  { id: 'grande', name: 'Sala Grande', capacity: 20, color: '#10B981' },
  { id: 'pequena', name: 'Sala Pequena', capacity: 6, color: '#F59E0B' },
  { id: 'recepcao', name: 'Recepção', capacity: 4, color: '#EF4444' },
];

interface ReservaRow {
  id: number;
  sala: string;
  title: string;
  start: string;
  end: string;
  created_by_name: string;
  created_by_email: string;
  google_event_id?: string;
}

export const ReservaSalas: React.FC = () => {
    const { addActivity } = useGamification();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'salas' | 'portaria'>('salas');
    const [showReservationModal, setShowReservationModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [reservationData, setReservationData] = useState({
    id: '',
    sala: '',
    motivo: '',
    descricao: '',
    inicio: '',
    fim: '',
  });

const [events, setEvents] = useState<EventInput[]>([]);

    const tokenHeader = useCallback(
      () => ({
        Authorization: `Bearer ${btoa(JSON.stringify(user))}`,
        'Content-Type': 'application/json',
        'x-gapi-token': localStorage.getItem('intranet_token') || '',
      }),
      [user]
    );

  const hasConflict = (sala: string, inicio: string, fim: string, ignoreId?: string) => {
    return events.some(ev =>
      ev.extendedProps.sala === sala &&
      ev.id !== ignoreId &&
      !(new Date(fim) <= new Date(ev.start) || new Date(inicio) >= new Date(ev.end))
    );
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/reservas-salas', {
          headers: { Authorization: `Bearer ${btoa(JSON.stringify(user))}` },
        });
        const data: ReservaRow[] = await res.json();
        const mapped = data.map(ev => ({
          id: String(ev.id),
          title: `${ev.title} - ${ev.created_by_name}`,
          start: ev.start,
          end: ev.end,
          backgroundColor: salas.find(s => s.id === ev.sala)?.color,
          extendedProps: {
            sala: ev.sala,
            motivo: ev.title,
            responsavel: ev.created_by_name,
            created_by_email: ev.created_by_email,
            google_event_id: ev.google_event_id,
          },
        }));
        setEvents(mapped);
        localStorage.setItem('reservas_salas_cache', JSON.stringify(mapped));
        } catch {
          const cache = localStorage.getItem('reservas_salas_cache');
          if (cache) setEvents(JSON.parse(cache) as EventInput[]);
        }
      syncPending();
    };

    const syncPending = async () => {
      const pending: EventInput[] = JSON.parse(localStorage.getItem('reservas_salas_pending') || '[]');
      if (!pending.length) return;
      const remaining: EventInput[] = [];
      for (const evt of pending) {
        try {
          const res = await fetch('/api/reservas-salas', {
            method: 'POST',
            headers: tokenHeader(),
            body: JSON.stringify({
              sala: evt.extendedProps.sala,
              title: evt.extendedProps.motivo,
              start: evt.start,
              end: evt.end,
            }),
          });
          if (res.ok) {
            const { id } = await res.json();
            evt.id = String(id);
            setEvents(prev => [...prev, evt]);
          } else {
            remaining.push(evt);
          }
        } catch {
          remaining.push(evt);
        }
      }
      localStorage.setItem('reservas_salas_pending', JSON.stringify(remaining));
    };

    fetchEvents();
  }, [user, tokenHeader]);

  const handleDateClick = (selectInfo: DateSelectArg) => {
    setIsEditing(false);
    setReservationData({
      id: '',
      sala: '',
      motivo: '',
      descricao: '',
      inicio: (selectInfo.startStr || selectInfo.dateStr || selectInfo.date.toISOString()).slice(0, 16),
      fim: (selectInfo.endStr || selectInfo.startStr || selectInfo.date.toISOString()).slice(0, 16),
    });
    setShowReservationModal(true);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const ev = clickInfo.event;
    setIsEditing(true);
    setReservationData({
      id: ev.id,
      sala: ev.extendedProps.sala,
      motivo: ev.extendedProps.motivo,
      descricao: '',
      inicio: ev.startStr.slice(0, 16),
      fim: ev.endStr.slice(0, 16),
    });
    setShowReservationModal(true);
  };

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasConflict(reservationData.sala, reservationData.inicio, reservationData.fim, reservationData.id)) {
      toast.error('Já existe reserva para este horário.');
      return;
    }

    const salaName = salas.find(s => s.id === reservationData.sala)?.name || reservationData.sala;

    try {
      if (isEditing && reservationData.id) {
        const res = await fetch(`/api/reservas-salas/${reservationData.id}`, {
          method: 'PUT',
          headers: tokenHeader(),
          body: JSON.stringify({
            sala: reservationData.sala,
            title: reservationData.motivo,
            start: reservationData.inicio,
            end: reservationData.fim,
          }),
        });
        if (!res.ok) throw new Error();
        setEvents(prev => prev.map(ev =>
          ev.id === reservationData.id
            ? {
                ...ev,
                title: `${reservationData.motivo} - ${user?.name}`,
                start: reservationData.inicio,
                end: reservationData.fim,
                backgroundColor: salas.find(s => s.id === reservationData.sala)?.color,
                extendedProps: { ...ev.extendedProps, sala: reservationData.sala, motivo: reservationData.motivo },
              }
            : ev
        ));
        toast.success('Reserva atualizada!');
      } else {
        const res = await fetch('/api/reservas-salas', {
          method: 'POST',
          headers: tokenHeader(),
          body: JSON.stringify({
            sala: reservationData.sala,
            title: reservationData.motivo,
            start: reservationData.inicio,
            end: reservationData.fim,
          }),
        });
        let newId = '';
        if (res.ok) {
          const data = await res.json();
          newId = String(data.id);
        } else {
          throw new Error();
        }
        const newEvent = {
          id: newId,
          title: `${reservationData.motivo} - ${user?.name}`,
          start: reservationData.inicio,
          end: reservationData.fim,
          backgroundColor: salas.find(s => s.id === reservationData.sala)?.color,
          extendedProps: {
            sala: reservationData.sala,
            motivo: reservationData.motivo,
            responsavel: user?.name,
            created_by_email: user?.email,
          },
        };
        setEvents(prev => [...prev, newEvent]);
        addActivity('room_reservation', `Reservou ${salaName} - ${reservationData.motivo}`, {
          sala: reservationData.sala,
          motivo: reservationData.motivo,
          inicio: reservationData.inicio,
          fim: reservationData.fim,
        });
        toast.success('Reserva realizada com sucesso!');
      }
      } catch {
      const localId = `local-${Date.now()}`;
      const newEvent = {
        id: localId,
        title: `${reservationData.motivo} - ${user?.name}`,
        start: reservationData.inicio,
        end: reservationData.fim,
        backgroundColor: salas.find(s => s.id === reservationData.sala)?.color,
        extendedProps: {
          sala: reservationData.sala,
          motivo: reservationData.motivo,
          responsavel: user?.name,
          created_by_email: user?.email,
        },
      };
      setEvents(prev => [...prev, newEvent]);
      const pending = JSON.parse(localStorage.getItem('reservas_salas_pending') || '[]');
      pending.push(newEvent);
      localStorage.setItem('reservas_salas_pending', JSON.stringify(pending));
      toast.success('Reserva salva offline e será sincronizada.');
    }

    setShowReservationModal(false);
    setIsEditing(false);
    setReservationData({ id: '', sala: '', motivo: '', descricao: '', inicio: '', fim: '' });
  };

  const handleDelete = async () => {
    if (!reservationData.id) return;
    const event = events.find(e => e.id === reservationData.id);
    if (event?.extendedProps.created_by_email && event.extendedProps.created_by_email !== user?.email) {
      toast.error('Você só pode excluir suas reservas.');
      return;
    }
    try {
      const res = await fetch(`/api/reservas-salas/${reservationData.id}`, {
        method: 'DELETE',
        headers: tokenHeader(),
      });
      if (!res.ok) throw new Error();
      setEvents(prev => prev.filter(e => e.id !== reservationData.id));
      toast.success('Reserva removida');
    } catch {
      toast.error('Erro ao remover reserva');
    }
    setShowReservationModal(false);
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
                  eventClick={handleEventClick}
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
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">{isEditing ? 'Editar Reserva' : 'Nova Reserva'}</h2>
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
                      {isEditing && (
                        <button
                          type="button"
                          onClick={handleDelete}
                          className="px-4 py-2 text-red-600 border border-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Excluir
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowReservationModal(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {isEditing ? 'Salvar' : 'Reservar'}
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