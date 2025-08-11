import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Search, Phone, Mail, MapPin, Building, BadgeCheck } from 'lucide-react';

type Representante = {
  id: string;
  nome: string;
  cargo?: string;
  setor?: string;        // região (ex.: Erechim - RS)
  email?: string;
  telefone?: string;
  localizacao?: string;  // às vezes igual ao setor
  razaoSocial?: string;
  ramal?: string | null;
  foto?: string;
};

type MembroEquipe = {
  id: string;
  nome: string;
  cargo?: string;
  setor?: string;
  email?: string;
  telefone?: string;
  ramal?: string | null;
  localizacao?: string;
  foto?: string;
};

type FuncionariosJSON = {
  representantes?: Representante[];
  equipe_apucarana_pr?: MembroEquipe[];
};

type Employee = {
  id: string;
  nome: string;
  cargo: string;
  setor: string;         // usado para agrupar
  email?: string;
  telefone?: string;
  ramal?: string | null;
  cidade?: string;       // mapeamos de localizacao quando fizer sentido
  razaoSocial?: string;
  foto?: string;
  origem: 'representante' | 'equipe';
};

export const Diretorio: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [origem, setOrigem] = useState<'todos' | 'representante' | 'equipe'>('todos');

  // Carrega UMA vez de public/dados/funcionarios.json
  useEffect(() => {
    const load = async () => {
      try {
        const url = `/api/contatos`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Falha ao carregar funcionarios.json');
        const text = await res.text();
        const json: FuncionariosJSON = text ? JSON.parse(text) : {};

        const reps = (json.representantes || []).map<Employee>((r) => ({
          id: r.id,
          nome: r.nome,
          cargo: r.cargo && r.cargo.trim() ? r.cargo : 'Representante Comercial',
          setor: r.setor || r.localizacao || '—',
          email: r.email || undefined,
          telefone: r.telefone || undefined,
          ramal: r.ramal ?? undefined,
          cidade: r.localizacao || undefined,
          razaoSocial: r.razaoSocial || undefined,
          foto: r.foto,
          origem: 'representante',
        }));

        const equipe = (json.equipe_apucarana_pr || []).map<Employee>((e) => ({
          id: e.id,
          nome: e.nome,
          cargo: e.cargo || 'Colaborador',
          setor: e.setor || e.localizacao || '—',
          email: e.email || undefined,
          telefone: e.telefone || undefined,
          ramal: e.ramal ?? undefined,
          cidade: e.localizacao || undefined,
          razaoSocial: undefined,
          foto: e.foto,
          origem: 'equipe',
        }));

        setAllEmployees([...reps, ...equipe]);
      } catch (err) {
        console.error('Erro ao carregar funcionários:', err);
        setAllEmployees([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = allEmployees;
    if (origem !== 'todos') list = list.filter((p) => p.origem === origem);

    if (!searchTerm) return list;

    const q = searchTerm.toLowerCase();
    const s = (v?: string | null) => (typeof v === 'string' ? v.toLowerCase() : '');

    return list.filter((c) =>
      s(c.nome).includes(q) ||
      s(c.email).includes(q) ||
      s(c.telefone).includes(q) ||
      s(c.ramal || '').includes(q) ||
      s(c.setor).includes(q) ||
      s(c.cargo).includes(q) ||
      s(c.cidade).includes(q) ||
      s(c.razaoSocial).includes(q)
    );
  }, [allEmployees, origem, searchTerm]);

  const grouped = useMemo(() => {
    return filtered.reduce((acc, emp) => {
      const key = emp.setor || 'Sem setor';
      (acc[key] ||= []).push(emp);
      return acc;
    }, {} as Record<string, Employee[]>);
  }, [filtered]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Diretório Corporativo</h1>
          <div className="text-sm text-gray-600">
            {filtered.length} pessoas encontradas
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Pesquisar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nome, cargo, email, setor, cidade, razão social…"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Origem</label>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['todos', 'representante', 'equipe'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setOrigem(opt)}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition
                      ${origem === opt ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                    title={
                      opt === 'representante'
                        ? 'Mostrar apenas representantes'
                        : opt === 'equipe'
                        ? 'Mostrar apenas equipe interna'
                        : 'Mostrar todos'
                    }
                  >
                    {opt === 'todos' ? 'Todos' : opt === 'representante' ? 'Representantes' : 'Equipe'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Listagem */}
        {!loading && (
          <div className="space-y-8">
            {Object.entries(grouped).map(([setor, pessoas]) => (
              <div key={setor} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                  <Building className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900">{setor}</h2>
                  <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                    {pessoas.length} {pessoas.length === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pessoas.map((p) => (
                    <div key={p.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                      <div className="flex items-start gap-4">
                        <img
                          src={p.foto || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?w=150'}
                          alt={p.nome}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 truncate">{p.nome}</h3>
                            {p.origem === 'representante' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                Representante
                              </span>
                            )}
                            {p.origem === 'equipe' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                Equipe
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate">{p.cargo}</p>

                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-gray-400" />
                              {p.email ? (
                                <a href={`mailto:${p.email}`} className="text-sm text-blue-600 hover:underline truncate">{p.email}</a>
                              ) : (
                                <span className="text-sm text-gray-400">sem e-mail</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">{p.telefone || '—'}</span>
                              {p.ramal && <span className="text-xs text-gray-500">(ramal {p.ramal})</span>}
                            </div>

                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">{p.cidade || '—'}</span>
                            </div>

                            {p.razaoSocial && (
                              <div className="flex items-center gap-2">
                                <BadgeCheck className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600 truncate">{p.razaoSocial}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* vazio */}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum registro encontrado</h3>
                <p className="text-gray-600">Tente ajustar a busca ou a origem.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};
