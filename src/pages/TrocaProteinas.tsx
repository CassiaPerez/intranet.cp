import React, { useMemo, useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Save, Repeat } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useGamification } from '../contexts/GamificationContext';

const PROTEIN_OPTIONS = ['Frango','Omelete','Ovo frito','Ovo cozido'] as const;
type ProteinLabel = typeof PROTEIN_OPTIONS[number];

const ORIGINAL_SENTINEL = '__ORIGINAL__';

/** Normaliza textos do cardápio para uma das 4 opções (ou '' se não reconhecer). */
const normalizeProtein = (v: string): ProteinLabel | '' => {
  const s = (v || '').trim().toLowerCase();
  if (!s) return '';
  if (s.includes('frango')) return 'Frango';
  if (s.includes('omelete')) return 'Omelete';
  if (s.includes('frito'))   return 'Ovo frito';
  if (s.includes('cozid'))   return 'Ovo cozido';
  return '';
};

const API_BASE = '';

type CardapioItem = {
  id?: string;
  dia?: string;
  data: string;        // dd/MM/yyyy
  prato?: string;
  descricao?: string;
  proteina: string;
  acompanhamentos?: string[];
  sobremesa?: string;
};

type Troca = {
  data: string;                 // ISO 'yyyy-MM-dd'
  proteina_original: string;    // do cardápio padrão (pode estar vazio se não houver cardápio no dia)
  proteina_nova?: string;
};

export const TrocaProteinas: React.FC = () => {
  const { user } = useAuth();
  const { addActivity } = useGamification();
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const hoje = new Date();

  const [cardapioPadrao, setCardapioPadrao] = useState<CardapioItem[]>([]);
  const [cardapioLight, setCardapioLight] = useState<CardapioItem[]>([]);
  const [trocas, setTrocas] = useState<Record<string, Troca>>({}); // key=data ISO
  const [trocasExistentes, setTrocasExistentes] = useState<Record<string, Troca>>({});
  const [applyAllProtein, setApplyAllProtein] = useState<string>("");

  // Carrega cardápio (padrão + light) do mês e trocas já salvas
  useEffect(() => {
    (async () => {
      try {
        console.log('[TROCAS] Loading cardapio and existing exchanges...');
        // Load from static JSON files (ajuste os caminhos conforme seu projeto)
        const [padrao, light] = await Promise.all([
          fetch('/cardapio/cardapio-agosto-padrao.json').then(r => r.json()),
          fetch('/cardapio/cardapio-agosto-light.json').then(r => r.json()),
        ]);
        setCardapioPadrao(Array.isArray(padrao) ? padrao : []);
        setCardapioLight(Array.isArray(light) ? light : []);
        console.log('[TROCAS] Cardapio loaded - Padrao:', padrao?.length, 'Light:', light?.length);

        // Carregar trocas existentes no mês (seu backend já expõe esse GET)
        const from = format(startOfMonth(hoje), 'yyyy-MM-01');
        const to   = format(endOfMonth(hoje),   'yyyy-MM-dd');
        console.log('[TROCAS] Loading existing exchanges from API...');
        const prevRes = await fetch(`${API_BASE}/api/trocas-proteina?from=${from}&to=${to}`, { 
          credentials: 'include' 
        });
        
        if (prevRes.ok) {
          const prev = await prevRes.json();
          const trocasData = Array.isArray(prev.trocas) ? prev.trocas : [];
          const map: Record<string, Troca> = {};
          console.log('[TROCAS] Processing', trocasData.length, 'existing exchanges');
          
          for (const t of trocasData) {
            try {
              const dataISO = t.data; // Assume já está em formato ISO
              map[dataISO] = { 
                data: dataISO, 
                proteina_original: t.proteina_original || "", 
                proteina_nova: t.proteina_nova 
              };
            } catch (e) {
              console.error('[TROCAS] Error processing exchange:', t, e);
            }
          }
          setTrocasExistentes(map);
          console.log('[TROCAS] Loaded', Object.keys(map).length, 'existing exchanges');
        } else {
          console.error('[TROCAS] Failed to load existing exchanges:', prevRes.status);
        }
      } catch (e) {
        console.error('[TROCAS] Error loading data:', e);
        toast.error('Falha ao carregar dados do cardápio.');
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [hoje]);

  // Todos os dias do mês (sempre)
  const diasDoMes = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(hoje), end: endOfMonth(hoje) });
  }, [hoje]);

  // Mapa dataISO -> proteína original (vinda do cardápio padrão)
  const originalByDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const it of cardapioPadrao) {
      const [dd, mm, yyyy] = (it.data || '').split('/');
      if (dd && mm && yyyy) {
        const iso = `${yyyy}-${mm}-${dd}`;
        map[iso] = it.proteina || '';
      }
    }
    console.log('[TROCAS] Original proteins by date:', Object.keys(map).length, 'days');
    return map;
  }, [cardapioPadrao]);

  // Opções = união das proteínas que aparecem no mês (padrão + light)
  const opcoesProteina = useMemo(() => {
    // Limita às opções fixas de troca de proteína apenas
    return [...PROTEIN_OPTIONS];
  }, [cardapioPadrao, cardapioLight]);

  // Get current value for a date (existing exchange or new selection)
  const getCurrentValue = (dataISO: string): string => {
    // Priority: new selection > existing exchange > original
    if (trocas[dataISO]?.proteina_nova) {
      return trocas[dataISO].proteina_nova;
    }
    if (trocasExistentes[dataISO]?.proteina_nova) {
      return trocasExistentes[dataISO].proteina_nova;
    }
    return "";
  };

  // Alterar uma linha
  const handleChange = (dataISO: string, nova: string) => {
    const original = originalByDate[dataISO] || ''; // vazio se não houver cardápio naquele dia
    
    console.log('[TROCAS] Handling change for', dataISO, 'from', original, 'to', nova);
    
    // Se o usuário escolheu vazio (manter original), removemos a troca
    if (!nova || nova === ORIGINAL_SENTINEL) {
      setTrocas(prev => {
        const copy = { ...prev };
        delete copy[dataISO];
        console.log('[TROCAS] Removed exchange for', dataISO);
        return copy;
      });
      return;
    }
    
    // Garantir que a nova proteína está nas opções válidas
    if (!PROTEIN_OPTIONS.includes(nova as ProteinLabel)) {
      console.log('[TROCAS] Invalid protein option:', nova);
      return; // Ignorar valores inválidos
    }
    
    // Se igual à original, não precisamos da troca
    const normalizedOriginal = normalizeProtein(original);
    if (nova === normalizedOriginal) {
      setTrocas(prev => {
        const copy = { ...prev };
        delete copy[dataISO];
        console.log('[TROCAS] No change needed for', dataISO, '- same as original');
        return copy;
      });
      return;
    }
    
    console.log('[TROCAS] Setting exchange for', dataISO, ':', { original, nova });
    setTrocas(prev => ({ ...prev, [dataISO]: { data: dataISO, proteina_original: original, proteina_nova: nova } }));
  };

  // Aplicar para todos os dias disponíveis (com cardápio)
  const aplicarParaTodos = () => {
    const target = applyAllProtein.trim();
    if (!target) {
      toast('Escolha a proteína para aplicar em todos os dias.');
      return;
    }
    if (opcoesProteina.length && !opcoesProteina.includes(target)) {
      toast.error('Proteína inválida para este mês.');
      return;
    }
    
    console.log('[TROCAS] Applying protein to all days:', target);
    setTrocas(prev => {
      const copy = { ...prev };
      let applied = 0;
      for (const d of diasDoMes) {
        const iso = format(d, 'yyyy-MM-dd');
        const original = originalByDate[iso] || '';
        // Só aplicamos nos dias que têm cardápio (original não vazio) e quando a troca muda algo
        const normalizedOriginal = normalizeProtein(original);
        if (original && target !== normalizedOriginal) {
          copy[iso] = { data: iso, proteina_original: original, proteina_nova: target };
          applied++;
        } else {
          // se não houver cardápio neste dia ou não muda nada, não mantemos troca
          delete copy[iso];
        }
      }
      console.log('[TROCAS] Applied to', applied, 'days');
      return copy;
    });
    toast.success(`Aplicado a todos os dias disponíveis do mês.`);
  };

  // Salvar em lote via API
  const salvar = async () => {
    const payload = Object.values(trocas).filter(t => 
      t.proteina_nova && 
      t.proteina_nova !== t.proteina_original && 
      t.proteina_original
    );
    
    if (payload.length === 0) {
      toast('Nenhuma troca para salvar.');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('[TROCAS] Saving', payload.length, 'exchanges to API...');
      
      const response = await fetch(`${API_BASE}/api/trocas-proteina/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ trocas: payload }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[TROCAS] Bulk save result:', data);
      
      // Gamificação local para as trocas inseridas
      if (data.inseridas > 0) {
        payload.slice(0, data.inseridas).forEach(troca => {
          addActivity('protein_exchange', `Trocou proteína do dia ${format(parseISO(troca.data), 'dd/MM')}`, {
            data: troca.data,
            proteinaOriginal: troca.proteina_original,
            proteinaNova: troca.proteina_nova,
          });
        });
      }
      
      toast.success(`${data.inseridas || 0} trocas salvas! +${data.totalPoints || 0} pontos`);
      
      // Limpa seleções temporárias e recarrega dados existentes
      setTrocas({});
      
      // Reload existing exchanges
      const from = format(startOfMonth(hoje), 'yyyy-MM-01');
      const to   = format(endOfMonth(hoje),   'yyyy-MM-dd');
      const reloadRes = await fetch(`${API_BASE}/api/trocas-proteina?from=${from}&to=${to}`, { 
        credentials: 'include' 
      });
      
      if (reloadRes.ok) {
        const reloadData = await reloadRes.json();
        const trocasData = Array.isArray(reloadData.trocas) ? reloadData.trocas : [];
        const map: Record<string, Troca> = {};
        
        for (const t of trocasData) {
          try {
            const dataISO = t.data;
            map[dataISO] = { 
              data: dataISO, 
              proteina_original: t.proteina_original || "", 
              proteina_nova: t.proteina_nova 
            };
          } catch (e) {
            console.error('[TROCAS] Error reloading exchange:', t, e);
          }
        }
        setTrocasExistentes(map);
        console.log('[TROCAS] Reloaded', Object.keys(map).length, 'existing exchanges');
      }
      
    } catch (error) {
      console.error('[TROCAS] Error saving exchanges:', error);
      toast.error(error.message || 'Falha ao salvar trocas.');
    } finally {
      setLoading(false);
    }
  };

  // Resumo simples
  const novasSelecionadas = Object.values(trocas).filter(t => t.proteina_nova && t.proteina_nova !== t.proteina_original && t.proteina_original).length;
  const jaExistentes = Object.values(trocasExistentes).filter(t => t.proteina_nova && t.proteina_nova !== t.proteina_original && t.proteina_original).length;
  const totalSelecionadas = novasSelecionadas + jaExistentes;
  const totalDiasComCardapio = diasDoMes.filter(d => originalByDate[format(d, 'yyyy-MM-dd')]).length;
  const faltantes = Math.max(totalDiasComCardapio - totalSelecionadas, 0);

  if (loadingExisting) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">Troca de Proteínas</h1>
            <p className="text-sm text-slate-600">
              Defina trocas usando as proteínas disponíveis no cardápio do mês. Você pode aplicar a mesma proteína para todos os dias disponíveis.
            </p>
            <div className="mt-2 text-xs text-slate-500">
              Já salvas: <strong>{jaExistentes}</strong> · Novas: <strong>{novasSelecionadas}</strong> · Restantes: <strong>{faltantes}</strong> (dias com cardápio)
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="border rounded-lg px-3 py-2"
              value={applyAllProtein}
              onChange={(e) => setApplyAllProtein(e.target.value)}
            >
              <option value="">Trocar todos os dias para…</option>
              {opcoesProteina.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button
              onClick={aplicarParaTodos}
              disabled={!applyAllProtein}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-slate-50"
            >
              <Repeat className="w-4 h-4" /> Aplicar em todos
            </button>
            <button
              onClick={salvar}
              disabled={loading || novasSelecionadas === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white"
            >
              <Save className="w-4 h-4" /> {loading ? 'Salvando...' : `Salvar ${novasSelecionadas} seleções`}
            </button>
          </div>
        </div>

        <div className="overflow-auto rounded-xl border bg-white">
          <table className="min-w-[860px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Proteína do Cardápio</th>
                <th className="px-3 py-2 text-left">Trocar para</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {diasDoMes.filter(d => originalByDate[format(d, 'yyyy-MM-dd')]).map((d) => {
                const dataISO = format(d, 'yyyy-MM-dd');
                const original = originalByDate[dataISO] || ''; // vazio quando não há cardápio
                const currentValue = getCurrentValue(dataISO);
                const isExisting = !!trocasExistentes[dataISO]?.proteina_nova;
                const isNewSelection = !!trocas[dataISO]?.proteina_nova;

                return (
                  <tr key={dataISO} className="border-t">
                    <td className="px-3 py-2">{format(d, 'dd/MM/yyyy (EEE)', { locale: ptBR })}</td>
                    <td className="px-3 py-2">{original}</td>
                    <td className="px-3 py-2 relative z-10 pointer-events-auto">
                      <select
                        className="border rounded-lg px-2 py-1 w-full"
                        value={currentValue}
                        onChange={(e) => handleChange(dataISO, e.target.value)}
                        onMouseDown={(e)=>e.stopPropagation()}
                        onClick={(e)=>e.stopPropagation()}
                        onKeyDown={(e)=>e.stopPropagation()}
                        disabled={loading}
                      >
                        <option value="">— Manter original —</option>
                        {PROTEIN_OPTIONS.map((p) => (
                          <option key={p} value={p} disabled={normalizeProtein(original) === p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {isExisting && !isNewSelection && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          Salvo
                        </span>
                      )}
                      {isNewSelection && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          Novo
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};

// ✅ export nomeado e default
export default TrocaProteinas;
