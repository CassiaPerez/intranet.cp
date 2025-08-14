// src/pages/AdminPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import {
  Users, CalendarDays, ClipboardList, Wrench, RefreshCw, Settings,
  FileText, Building2, ShieldCheck, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

// Opcional: se você usa proxy do Vite, pode deixar vazio.
const API_BASE = '';

type Stats = {
  reservas: number;
  agendamentos: number;
  solicitacoes: number;
  trocas: number;
  posts: number;
  usuarios: number;
};

type SystemConfig = {
  companyName?: string;
  mural?: { allowedPublishers?: string[] };
  gamificacao?: { pontos?: Record<string, number> };
  reservas?: { salas?: string[] };
};

const DEFAULT_CFG: SystemConfig = {
  companyName: 'Cropfield',
  mural: { allowedPublishers: ['TI', 'RH'] },
  gamificacao: { pontos: { muralPost: 1, reserva: 2, wifi: 1, trocaProteina: 2 } },
  reservas: { salas: ['Aquário', 'Sala Grande', 'Sala Pequena', 'Sala Recepção'] }
};

async function getJson<T = any>(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* ignora */ }
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || res.statusText || `Erro em ${url}`);
  }
  return (json?.data ?? json) as T;
}

function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  return { startISO: toISO(start), endISO: toISO(end) };
}

export const AdminPanel: React.FC = () => {
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState<Stats>({
    reservas: 0, agendamentos: 0, solicitacoes: 0, trocas: 0, posts: 0, usuarios: 0
  });

  const [showConfig, setShowConfig] = useState(false);
  const [cfg, setCfg] = useState<SystemConfig>(DEFAULT_CFG);
  const [savingCfg, setSavingCfg] = useState(false);
  const [configSupported, setConfigSupported] = useState<boolean | null>(null);

  // Carrega estatísticas
  useEffect(() => {
    (async () => {
      setLoadingStats(true);
      try {
        // 1) Tenta pegar de /api/admin/stats (se existir)
        const s = await getJson<Partial<Stats>>(`${API_BASE}/api/admin/stats`);
        setStats(prev => ({ ...prev, ...s as Stats }));
      } catch {
        // 2) Fallback: somar chamando endpoints existentes
        try {
          const todayISO = new Date().toISOString();
          const { startISO, endISO } = monthRange(new Date());

          const [usuarios, reservas, portaria, ti, trocas] = await Promise.all([
            getJson<any[]>(`${API_BASE}/api/usuarios`).catch(() => []),
            getJson<any[]>(`${API_BASE}/api/reservas-salas`).catch(() => []),
            getJson<any[]>(`${API_BASE}/api/portaria`).catch(() => []),
            getJson<any[]>(`${API_BASE}/api/equipamentos-ti`).catch(() => []),
            // se sua API suportar filtro ?from=&to=:
            getJson<any[]>(`${API_BASE}/api/trocas-proteina?from=${startISO}&to=${endISO}`).catch(() =>
              getJson<any[]>(`${API_BASE}/api/trocas-proteina`).catch(() => [])
            ),
          ]);

          // Regras básicas p/ contagem:
          const reservasAtivas = reservas.filter((r: any) => (r.end ?? r.fim ?? r.termino ?? todayISO) >= todayISO).length;
          const agMes = portaria.filter((p: any) => {
            const d = new Date(p.data_hora || p.data || p.start || p.inicio || todayISO).toISOString().slice(0, 10);
            return d >= startISO && d <= endISO;
          }).length;
          const solicitAbertas = ti.filter((s: any) => ['aberta', 'em_andamento', 'pendente'].includes((s.status || '').toLowerCase())).length;
          const trocasMes = trocas.filter((t: any) => {
            const d = new Date(t.data_iso || t.data || todayISO).toISOString().slice(0, 10);
            return d >= startISO && d <= endISO;
          }).length;

          setStats({
            reservas: reservasAtivas,
            agendamentos: agMes,
            solicitacoes: solicitAbertas,
            trocas: trocasMes,
            posts: 0, // ajuste se tiver endpoint do mural
            usuarios: usuarios.length || 0,
          });
        } catch (e) {
          toast.error('Falha ao carregar estatísticas.');
        }
      } finally {
        setLoadingStats(false);
      }
    })();
  }, []);

  // Configurações (modal)
  const loadConfig = async () => {
    try {
      const raw = await getJson<{ config?: SystemConfig } | SystemConfig>(`${API_BASE}/api/admin/config`);
      // Aceitar {config: {...}} ou {...} diretamente
      const cfgData: any = (raw as any)?.config ?? raw ?? {};
      setCfg({ ...DEFAULT_CFG, ...cfgData });
      setConfigSupported(true);
    } catch {
      // servidor ainda não implementou /api/admin/config
      setCfg(DEFAULT_CFG);
      setConfigSupported(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSavingCfg(true);
      const res = await fetch(`${API_BASE}/api/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error();
      toast.success('Configurações salvas!');
      setShowConfig(false);
    } catch {
      toast.error('Não foi possível salvar. Verifique se o endpoint /api/admin/config está implementado.');
    } finally {
      setSavingCfg(false);
    }
  };

  // Quando abrir o modal, tenta carregar config
  useEffect(() => {
    if (showConfig) loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showConfig]);

  const cards = useMemo(() => ([
    { label: 'Usuários', value: stats.usuarios, icon: Users, color: 'text-sky-600', bg: 'bg-sky-50', to: '/admin/usuarios' },
    { label: 'Reservas ativas', value: stats.reservas, icon: CalendarDays, color: 'text-green-600', bg: 'bg-green-50', to: '/reservas' },
    { label: 'Agendamentos (mês)', value: stats.agendamentos, icon: ClipboardList, color: 'text-purple-600', bg: 'bg-purple-50', to: '/portaria' },
    { label: 'Solicitações TI', value: stats.solicitacoes, icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50', to: '/admin/painel-ti' },
    { label: 'Trocas (mês)', value: stats.trocas, icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50', to: '/cardapio/trocas' },
  ]), [stats]);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">Painel Administrativo</h1>
            <p className="text-sm text-slate-600">
              Centralize operações: usuários, reservas de salas, portaria, TI e trocas de proteína.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              to="/admin/contatos"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50"
            >
              <Building2 className="w-4 h-4" />
              Contatos
            </Link>
            <button
              onClick={() => setShowConfig(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50"
            >
              <Settings className="w-4 h-4" />
              Configurar
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map(({ label, value, icon: Icon, color, bg, to }) => (
            <Link
              key={label}
              to={to}
              className="block"
              title={`Ir para ${label}`}
            >
              <div className="relative rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
                <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${bg} ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="mt-3 text-2xl font-semibold">{loadingStats ? '—' : value}</div>
                <div className="text-sm text-slate-600">{label}</div>
                <div className="absolute top-4 right-4 text-slate-400">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Ações rápidas */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Ações rápidas
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link to="/admin/usuarios" className="p-4 border rounded-lg hover:border-blue-300 transition-colors block">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-sky-600" />
                <div>
                  <div className="font-medium">Gerenciar Usuários</div>
                  <div className="text-xs text-slate-600">Criar, editar, remover</div>
                </div>
              </div>
            </Link>

            <Link to="/reservas" className="p-4 border rounded-lg hover:border-blue-300 transition-colors block">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-green-600" />
                <div>
                  <div className="font-medium">Reservas de Salas</div>
                  <div className="text-xs text-slate-600">Agendar e administrar</div>
                </div>
              </div>
            </Link>

            <Link to="/portaria" className="p-4 border rounded-lg hover:border-blue-300 transition-colors block">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="font-medium">Agendamentos da Portaria</div>
                  <div className="text-xs text-slate-600">Visitantes e recepção</div>
                </div>
              </div>
            </Link>

            <Link to="/admin/painel-ti" className="p-4 border rounded-lg hover:border-blue-300 transition-colors block">
              <div className="flex items-center gap-3">
                <Wrench className="w-5 h-5 text-amber-600" />
                <div>
                  <div className="font-medium">Solicitações de TI</div>
                  <div className="text-xs text-slate-600">Abrir e dar andamento</div>
                </div>
              </div>
            </Link>

            <Link to="/cardapio/trocas" className="p-4 border rounded-lg hover:border-blue-300 transition-colors block">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="font-medium">Troca de Proteínas</div>
                  <div className="text-xs text-slate-600">Solicitar/gerenciar trocas</div>
                </div>
              </div>
            </Link>

            <Link to="/mural" className="p-4 border rounded-lg hover:border-blue-300 transition-colors block">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-rose-600" />
                <div>
                  <div className="font-medium">Mural de Informações</div>
                  <div className="text-xs text-slate-600">Publicar e revisar posts</div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Modal de Configurações */}
        {showConfig && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurações do Sistema</h3>

              {configSupported === false && (
                <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  O endpoint <code>/api/admin/config</code> não está disponível. Salvar aqui não terá efeito
                  até que ele seja implementado no backend.
                </div>
              )}

              <div className="space-y-4">
                {/* Nome da Empresa */}
                <div>
                  <label className="block text-sm font-medium mb-1">Nome da empresa</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={cfg.companyName || ''}
                    onChange={e => setCfg({ ...cfg, companyName: e.target.value })}
                  />
                </div>

                {/* Salas (csv) */}
                <div>
                  <label className="block text-sm font-medium mb-1">Salas (separadas por vírgula)</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={(cfg.reservas?.salas || []).join(', ')}
                    onChange={e => setCfg({
                      ...cfg,
                      reservas: { ...(cfg.reservas || {}), salas: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                    })}
                  />
                </div>

                {/* Publicadores do Mural */}
                <div>
                  <label className="block text-sm font-medium mb-1">Pode publicar no Mural</label>
                  <div className="flex gap-4">
                    {['TI', 'RH', 'Admin'].map(opt => {
                      const allowed = new Set(cfg.mural?.allowedPublishers || []);
                      const checked = allowed.has(opt);
                      return (
                        <label key={opt} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(cfg.mural?.allowedPublishers || []);
                              e.target.checked ? next.add(opt) : next.delete(opt);
                              setCfg({ ...cfg, mural: { ...(cfg.mural || {}), allowedPublishers: Array.from(next) } });
                            }}
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Pontos de Gamificação */}
                <div>
                  <label className="block text-sm font-medium mb-1">Pontos de Gamificação</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ['muralPost','Post no Mural'],
                      ['reserva','Reserva de Sala'],
                      ['wifi','Wi-Fi'],
                      ['trocaProteina','Troca de Proteína'],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <span className="text-sm text-gray-700">{label}</span>
                        <input
                          type="number"
                          className="w-full border rounded-lg px-3 py-2 mt-1"
                          value={Number(cfg.gamificacao?.pontos?.[key as any] ?? 0)}
                          onChange={e => setCfg({
                            ...cfg,
                            gamificacao: {
                              ...(cfg.gamificacao || {}),
                              pontos: { ...(cfg.gamificacao?.pontos || {}), [key]: Number(e.target.value) }
                            }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowConfig(false)} className="px-4 py-2 rounded-lg border">Cancelar</button>
                <button
                  onClick={saveConfig}
                  disabled={savingCfg || configSupported === false}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
                >
                  {savingCfg ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminPanel;
