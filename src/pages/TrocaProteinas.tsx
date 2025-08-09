import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Drumstick, Fish, Egg, Beef, Leaf } from 'lucide-react';

interface MenuItem {
  data: string; // dd/MM/yyyy
  proteina: string;
}

interface SwapRow {
  data: string;
  proteina_original: string;
  proteina_nova: string;
}

export const TrocaProteinas: React.FC = () => {
  const { user } = useAuth();
  const tokenHeader = user ? `Bearer ${btoa(JSON.stringify(user))}` : '';
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [trocas, setTrocas] = useState<Record<string, string>>({});
  const [existentes, setExistentes] = useState<Record<string, SwapRow>>({});

  const currentMonth = useMemo(() => new Date(), []);
  const diasUteis = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      }).filter(d => d.getDay() !== 0 && d.getDay() !== 6),
    [currentMonth]
  );

  const monthSlug = format(currentMonth, 'MMMM', { locale: ptBR })
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const res = await fetch(`/cardapio/cardapio-${monthSlug}-padrao.json`);
        const json = await res.json();
        setMenu(json || []);
      } catch {
        toast.error('Erro ao carregar cardápio');
      }
    };
    loadMenu();
  }, [monthSlug]);

  const carregarTrocas = useCallback(async () => {
    const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    try {
      const res = await fetch(`/api/trocas-proteina?from=${from}&to=${to}`, {
        headers: { Authorization: tokenHeader },
      });
      const rows = await res.json();
      const map: Record<string, SwapRow> = {};
      rows.forEach((r: SwapRow) => {
        map[r.data] = r;
      });
      setExistentes(map);
    } catch {
      /* ignore */
    }
  }, [tokenHeader, currentMonth]);

  useEffect(() => {
    if (user) carregarTrocas();
  }, [user, carregarTrocas]);

  const handleChange = (date: string, value: string) => {
    setTrocas(prev => ({ ...prev, [date]: value }));
  };

  const proteinOptions = useMemo(
    () => Array.from(new Set(menu.map(m => m.proteina))).sort(),
    [menu]
  );

  const contagemProteinas = useMemo(() => {
    const mapa = new Map<string, number>();
    menu.forEach(m => {
      mapa.set(m.proteina, (mapa.get(m.proteina) || 0) + 1);
    });
    return Array.from(mapa.entries());
  }, [menu]);

  const getIcon = (p: string) => {
    const prot = p.toLowerCase();
    if (prot.includes('frango')) return <Drumstick className="w-5 h-5 text-orange-500" />;
    if (prot.includes('peixe')) return <Fish className="w-5 h-5 text-blue-500" />;
    if (prot.includes('carne') || prot.includes('bovina') || prot.includes('porco'))
      return <Beef className="w-5 h-5 text-red-500" />;
    if (prot.includes('ovo')) return <Egg className="w-5 h-5 text-yellow-500" />;
    if (prot.includes('veg')) return <Leaf className="w-5 h-5 text-green-500" />;
    return null;
  };

  const enviar = async () => {
    const payload = Object.entries(trocas)
      .filter(([d, v]) => v && !existentes[d])
      .map(([data, proteina_nova]) => {
        const item = menu.find(m => {
          const [dd, mm, yyyy] = m.data.split('/');
          return `${yyyy}-${mm}-${dd}` === data;
        });
        return { data, proteina_original: item?.proteina || '', proteina_nova };
      });
    if (!payload.length) {
      toast.error('Nenhuma troca selecionada');
      return;
    }
    try {
      const res = await fetch('/api/trocas-proteina', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: tokenHeader,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success('Trocas enviadas!');
      setTrocas({});
      await carregarTrocas();
    } catch {
      toast.error('Erro ao enviar trocas');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Troca de Proteína</h1>
        {contagemProteinas.length > 0 && (
          <div className="flex flex-wrap gap-4 text-sm text-gray-700">
            {contagemProteinas.map(([p, c]) => (
              <span key={p} className="flex items-center gap-1">
                {getIcon(p)}
                {p} ({c})
              </span>
            ))}
          </div>
        )}
        <div className="bg-white rounded-lg shadow divide-y">
          {diasUteis.map(date => {
            const key = format(date, 'yyyy-MM-dd');
            const item = menu.find(m => {
              const [dd, mm, yyyy] = m.data.split('/');
              return `${yyyy}-${mm}-${dd}` === key;
            });
            const original = item?.proteina || '—';
            const ja = existentes[key];
            return (
              <div key={key} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-gray-900">
                    {format(date, 'dd/MM EEEE', { locale: ptBR })}
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    {getIcon(original)}
                    <span>{original}</span>
                  </div>
                </div>
                <select
                  disabled={!!ja}
                  value={ja ? ja.proteina_nova : trocas[key] || ''}
                  onChange={e => handleChange(key, e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="">
                    {ja ? ja.proteina_nova : 'Manter'}
                  </option>
                  {proteinOptions.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        <button
          onClick={enviar}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Enviar Trocas
        </button>
      </div>
    </Layout>
  );
};

export default TrocaProteinas;
