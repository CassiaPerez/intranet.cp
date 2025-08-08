import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { ChefHat, Wheat, Milk, Egg, Fish, Leaf, CheckCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface MenuItem {
  id: string;
  dia: string;
  data: string; // dd/MM/yyyy
  prato: string;
  descricao: string;
  proteina: string;
  acompanhamentos: string[];
  sobremesa: string;
  alergenos?: string[];
}

export const Cardapio: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const tokenHeader = user ? `Bearer ${btoa(JSON.stringify(user))}` : '';
  const [activeTab, setActiveTab] = useState<'padrao' | 'light'>('padrao');
  const [cardapioPadrao, setCardapioPadrao] = useState<MenuItem[]>([]);
  const [cardapioLight, setCardapioLight] = useState<MenuItem[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');

  const currentMonth = new Date();
  const diasUteis = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  }).filter(date => {
    const day = date.getDay();
    return day !== 0 && day !== 6;
  });

  const alergenos: Record<string, { icon: React.ComponentType<{ className?: string; title?: string }>; name: string; color: string }> = {
    gluten: { icon: Wheat, name: 'Glúten', color: 'text-yellow-600' },
    lactose: { icon: Milk, name: 'Lactose', color: 'text-blue-600' },
    ovo: { icon: Egg, name: 'Ovo', color: 'text-orange-600' },
    peixe: { icon: Fish, name: 'Peixe', color: 'text-cyan-600' },
    vegetariano: { icon: Leaf, name: 'Vegetariano', color: 'text-green-600' },
  };

  const monthSlug = format(currentMonth, 'MMMM', { locale: ptBR })
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  useEffect(() => {
    const fetchCardapio = async () => {
      try {
        const resPadrao = await fetch(`/cardapio/cardapio-${monthSlug}-padrao.json`);
        const jsonPadrao = await resPadrao.json();
        setCardapioPadrao(jsonPadrao || []);

        const resLight = await fetch(`/cardapio/cardapio-${monthSlug}-light.json`);
        const jsonLight = await resLight.json();
        setCardapioLight(jsonLight || []);
      } catch (err) {
        console.error('Erro ao carregar cardápio:', err);
        toast.error('Erro ao carregar cardápio.');
      }
    };

    fetchCardapio();
  }, [monthSlug]);

  const getCardapioAtual = () => (activeTab === 'light' ? cardapioLight : cardapioPadrao);

  const handleExport = async (formato: string) => {
    try {
      const params = new URLSearchParams({ formato });
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (q) params.append('q', q);
      const res = await fetch(`/admin/exportar-trocas?${params.toString()}`, {
        headers: { Authorization: tokenHeader },
      });
      if (!res.ok) throw new Error('erro');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trocas_proteina.${formato}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Exportação gerada.');
    } catch {
      toast.error('Erro ao exportar.');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Cardápio Inteligente</h1>
          <div className="flex items-center space-x-2">
            <ChefHat className="w-6 h-6 text-orange-500" />
            <span className="text-sm text-gray-600">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
          </div>
        </div>

        {isAdmin && (
          <div className="space-y-2 mt-4">
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <input
                type="text"
                placeholder="Nome ou e-mail"
                value={q}
                onChange={e => setQ(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex gap-2">
              {['xlsx', 'csv', 'pdf'].map(fmt => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            {['padrao', 'light'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as 'padrao' | 'light')}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {tab === 'padrao' ? 'Cardápio Padrão' : 'Cardápio Light'}
              </button>
            ))}
          </div>

        {(activeTab === 'padrao' || activeTab === 'light') && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {diasUteis.map(date => {
              const dataStr = format(date, 'dd/MM/yyyy');
              const item = getCardapioAtual().find(c => c.data === dataStr);
              if (!item) return (
                <div key={dataStr} className="bg-white border rounded-xl p-4 text-gray-500 italic">
                  <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold w-fit mb-2">{dataStr}</div>
                  Cardápio não disponível para este dia.
                </div>
              );

                return (
                  <div key={item.data} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition p-4">
                    <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold w-fit mb-2">{item.data}</div>
                    <h3 className="font-semibold text-gray-900">{item.prato}</h3>
                    <p className="text-sm text-gray-700"><strong>Proteína:</strong> {item.proteina}</p>
                    <ul className="text-sm text-gray-700 mt-1 space-y-1">
                      {item.acompanhamentos?.map(acc => (
                        <li key={acc} className="flex items-center">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                          {acc}
                        </li>
                      )) || <li className="italic">--</li>}
                    </ul>
                    <p className="text-sm text-gray-700 mt-1"><strong>Sobremesa:</strong> {item.sobremesa}</p>
                    {item.alergenos && (
                      <div className="flex space-x-1 mt-2">
                        {item.alergenos.map(al => {
                        const info = alergenos[al];
                        const AIcon = info?.icon;
                        return AIcon ? (
                          <AIcon key={al} className={`w-4 h-4 ${info.color}`} title={info.name} />
                        ) : null;
                      })}
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </Layout>
  );
};
