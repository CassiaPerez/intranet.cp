import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const salas = [
  { id: 'aquario', name: 'Sala Aquário', capacity: 8, color: '#3B82F6' },
  { id: 'grande', name: 'Sala Grande', capacity: 20, color: '#10B981' },
  { id: 'pequena', name: 'Sala Pequena', capacity: 6, color: '#F59E0B' },
  { id: 'recepcao', name: 'Recepção', capacity: 4, color: '#EF4444' },
];
const SALAS_ALL = { id: 'all', name: 'Todas as salas', capacity: 0, color: '#6366F1' } as const;
const salasComTodas = [SALAS_ALL, ...salas];

const toTime = (s: string) => {
  const t = s.split('T')[1] || '';
  return t.length === 5 ? `${t}:00` : t;
};

type Evento = {
  id: string; title: string; start: string; end: string;
  extendedProps: { sala: string; salaName: string; motivo: string; responsavel: string; };
};

export function ReservaSalas() {
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [events, setEvents] = useState<Evento[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [reservationData, setReservationData] = useState({
    sala: '', motivo: '', inicio: '', fim: '', descricao: ''
  });
  const [portariaData, setPortariaData] = useState({
    data: '', hora: '', visitante: '', documento: '', observacao: ''
  });

  useEffect(() => { loadReservations(); loadAgendamentos(); }, []);

  async function loadReservations() {
    try {
      const res = await fetch(`${API_BASE}/api/reservas`, { credentials: 'include' });
      const data = await res.json();
      const formatted: Evento[] = (data.reservas || []).map((r: any) => {
        const sala = salas.find(s => s.id === r.sala);
        const norm = (t: string) => (t?.length === 5 ? `${t}:00` : t);
        return {
          id: String(r.id),
          title: `${r.assunto} - ${r.responsavel || 'Usuário'}`,
          start: `${r.data}T${norm(r.inicio)}`,
          end: `${r.data}T${norm(r.fim)}`,
          extendedProps: { sala: r.sala, salaName: sala?.name || r.sala, motivo: r.assunto, responsavel: r.responsavel || 'Usuário' }
        };
      });
      setEvents(formatted);
    } catch { setEvents([]); }
  }

  async function loadAgendamentos() {
    try {
      const res = await fetch(`${API_BASE}/api/portaria/agendamentos`, { credentials: 'include' });
      const data = await res.json();
      setAgendamentos(data.agendamentos || []);
    } catch { setAgendamentos([]); }
  }

  const roomEvents = selectedRoom === 'all' ? events : events.filter(e => e.extendedProps.sala === selectedRoom);

  function openModalComAgora() {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now); end.setHours(end.getHours() + 1);
    const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
    setReservationData({
      sala: selectedRoom === 'all' ? '' : selectedRoom,
      motivo: '',
      inicio: toLocal(start),
      fim: toLocal(end),
      descricao: ''
    });
    setShow(true);
  }

  async function handleReservation(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { sala, motivo, inicio, fim } = reservationData;
    if (!sala || !motivo || !inicio || !fim) { alert('Preencha todos os campos'); setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}/api/reservas`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sala, data: inicio.split('T')[0], inicio: toTime(inicio), fim: toTime(fim), assunto: motivo
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao criar reserva'); return;
      }
      setShow(false);
      setSelectedRoom(sala);
      await loadReservations();
      alert('Reserva criada com sucesso!');
    } finally { setLoading(false); }
  }

  async function handlePortaria(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, hora, visitante } = portariaData;
    if (!data || !hora || !visitante) { alert('Preencha data, hora e visitante'); setLoading(false); return; }
    const res = await fetch(`${API_BASE}/api/portaria/agendamentos`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(portariaData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Erro ao criar agendamento');
    } else {
      await loadAgendamentos();
      setPortariaData({ data: '', hora: '', visitante: '', documento: '', observacao: '' });
      alert('Agendamento criado!');
    }
    setLoading(false);
  }

  return (
    <div className="container" style={{ maxWidth: 960, margin: '0 auto' }}>
      <h1>Reserva de Espaços</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[SALAS_ALL, ...salas].map((s) => (
          <button key={s.id}
            onClick={() => setSelectedRoom(s.id)}
            style={{ padding: 8, borderRadius: 8, border: selectedRoom===s.id?'2px solid #2563EB':'1px solid #e5e7eb' }}>
            {s.name}
          </button>
        ))}
        <button onClick={openModalComAgora} style={{ marginLeft: 'auto' }}>Nova Reserva</button>
      </div>

      <h3 style={{ marginTop: 16 }}>Reservas ({selectedRoom==='all'?'todas as salas':salas.find(s=>s.id===selectedRoom)?.name})</h3>
      {roomEvents.length===0 ? <p>Nenhuma reserva.</p> : (
        <ul>
          {roomEvents.map(e => (
            <li key={e.id}>[{e.extendedProps.salaName}] {e.title} — {e.start.slice(0,16).replace('T',' ')} → {e.end.slice(0,16).replace('T',' ')}</li>
          ))}
        </ul>
      )}

      {show && (
        <form onSubmit={handleReservation} style={{ border:'1px solid #e5e7eb', padding:12, borderRadius:8, marginTop:12 }}>
          <h4>Nova Reserva</h4>
          <label>Sala:
            <select required value={reservationData.sala} onChange={e=>setReservationData({...reservationData, sala: e.target.value})}>
              <option value="">Selecione</option>
              {salas.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <br/>
          <label>Início:
            <input type="datetime-local" required value={reservationData.inicio} onChange={e=>setReservationData({...reservationData, inicio: e.target.value})}/>
          </label>
          <br/>
          <label>Fim:
            <input type="datetime-local" required value={reservationData.fim} onChange={e=>setReservationData({...reservationData, fim: e.target.value})}/>
          </label>
          <br/>
          <label>Motivo:
            <input type="text" required value={reservationData.motivo} onChange={e=>setReservationData({...reservationData, motivo: e.target.value})}/>
          </label>
          <br/>
          <button type="submit" disabled={loading}>{loading?'Salvando...':'Salvar'}</button>
          <button type="button" onClick={()=>setShow(false)} style={{ marginLeft:8 }}>Cancelar</button>
        </form>
      )}

      <h2 style={{ marginTop: 32 }}>Agendamentos da Portaria</h2>
      <form onSubmit={handlePortaria} style={{ border:'1px solid #e5e7eb', padding:12, borderRadius:8 }}>
        <label>Data: <input type="date" required value={portariaData.data} onChange={e=>setPortariaData({...portariaData, data: e.target.value})}/></label>
        <br/>
        <label>Hora: <input type="time" required value={portariaData.hora} onChange={e=>setPortariaData({...portariaData, hora: e.target.value})}/></label>
        <br/>
        <label>Visitante: <input type="text" required value={portariaData.visitante} onChange={e=>setPortariaData({...portariaData, visitante: e.target.value})}/></label>
        <br/>
        <label>Documento: <input type="text" value={portariaData.documento} onChange={e=>setPortariaData({...portariaData, documento: e.target.value})}/></label>
        <br/>
        <label>Observação: <input type="text" value={portariaData.observacao} onChange={e=>setPortariaData({...portariaData, observacao: e.target.value})}/></label>
        <br/>
        <button type="submit" disabled={loading}>{loading?'Enviando...':'Agendar'}</button>
      </form>

      <ul>
        {agendamentos.map((a:any)=>(
          <li key={a.id}>{a.visitante} — {a.data} {a.hora}</li>
        ))}
      </ul>
    </div>
  );
}