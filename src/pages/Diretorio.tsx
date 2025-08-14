import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Phone, Mail, Building2, Search } from 'lucide-react';
import toast from 'react-hot-toast';

type Contato = {
  id?: string | number;
  nome: string;
  cargo?: string;
  setor?: string;
  cidade?: string;
  ramal?: string | number | null;
  telefone?: string;
  email?: string;
};

const JSON_PATH = `${import.meta.env.BASE_URL || '/'}diretorio/diretorio.json`;

export const Diretorio: React.FC = () => {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [q, setQ] = useState('');
  const [setor, setSetor] = useState<string>('');   // filtro por setor
  const [cidade, setCidade] = useState<string>(''); // filtro por cidade

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${JSON_PATH}?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const clean = text.replace(/^\uFEFF/, '');
        const data = JSON.parse(clean);

        const lista: Contato[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.contatos)
          ? data.contatos
          : Array.isArray(data?.colaboradores)
          ? data.colaboradores
          : [];

        setContatos(normalize(lista));
      } catch (e1) {
        console.warn('Falhou JSON estático; tentando /api/contatos', e1);
        try {
          const res = await fetch('/api/contatos', { credentials: 'include' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const lista: Contato[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.contatos)
            ? data.contatos
            : [];
          setContatos(normalize(lista));
        } catch (e2) {
          console.error('Falhou também /api/contatos:', e2);
          toast.error('Não foi possível carregar o diretório.');
          setContatos([]);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const setores = useMemo(() => {
    const s = new Set<string>();
    contatos.forEach(c => c.setor && s.add(c.setor));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [contatos]);

  const cidades = useMemo(() => {
    const s = new Set<string>();
    contatos.forEach(c => c.cidade && s.add(c.cidade));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [contatos]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return contatos.filter(c => {
      const matchTexto =
        !term ||
        [c.nome, c.cargo, c.setor, c.cidade, c.telefone, c.email]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(term));

      const matchSetor = !setor || (c.setor || '') === setor;
      const matchCidade = !cidade || (c.cidade || '') === cidade;

      return matchTexto && matchSetor && matchCidade;
    });
  }, [contatos, q, setor, cidade]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">Diretório Corporativo</h1>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {/* Busca */}
            <div className="relative flex-1 md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar por nome, cargo, cidade, e-mail…"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filtro Setor */}
            <select
              value={setor}
              onChange={e => setSetor(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Filtrar por setor"
            >
              <option value="">Todos os setores</option>
              {setores.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Filtro Cidade */}
            <select
              value={cidade}
              onChange={e => setCidade(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Filtrar por cidade"
            >
              <option value="">Todas as cidades</option>
              {cidades.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Limpar filtros */}
            {(setor || cidade || q) && (
              <button
                onClick={() => { setSetor(''); setCidade(''); setQ(''); }}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Carregando diretório…</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Nenhum contato encontrado.</div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtrados.map((c) => (
                <li key={c.id ?? `${c.nome}-${c.email}`} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{c.nome}</div>
                      <div className="text-sm text-gray-600">{c.cargo}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Building2 className="w-3 h-3" />
                        <span>{[c.setor, c.cidade].filter(Boolean).join(' • ')}</span>
                      </div>

                      <div className="mt-3 space-y-1 text-sm">
                        {c.telefone && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Phone className="w-4 h-4" />
                            <a href={`tel:${cleanTel(c.telefone)}`} className="hover:underline">{c.telefone}</a>
                            {c.ramal ? <span className="text-gray-400">• Ramal {c.ramal}</span> : null}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Mail className="w-4 h-4" />
                            <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
};

// --- helpers ---

function normalize(lista: any[]): Contato[] {
  return lista.map((r, i) => ({
    id: r.id ?? i,
    nome: r.nome ?? r.name ?? '',
    cargo: r.cargo ?? r.role ?? r.funcao ?? '',
    setor: r.setor ?? r.sector ?? r.departamento ?? '',
    cidade: r.cidade ?? r.city ?? '',
    ramal: r.ramal ?? r.extension ?? null,
    telefone: r.telefone ?? r.phone ?? '',
    email: r.email ?? r.mail ?? '',
  }));
}

function cleanTel(t?: string) {
  if (!t) return '';
  return t.replace(/[^\d+]/g, '');
}

export default Diretorio;
