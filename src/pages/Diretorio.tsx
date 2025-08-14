import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Search } from 'lucide-react';
import diretorioData from '../data/diretorio.json';

function isLocationLike(v?: string) {
  if (!v) return false;
  const t = v.trim();
  const ufSlash = /\/[A-Z]{2}$/.test(t);
  const ufDash  = /-\s*[A-Z]{2}$/.test(t);
  return ufSlash || ufDash;
}

function normalize(lista: any[]) {
  return lista.map((r, i) => {
    const rawSetor = r.setor ?? r.sector ?? r.departamento ?? '';
    const cidadeRaw = r.cidade ?? r.city ?? r.localizacao ?? '';

    const setorFinal  = isLocationLike(rawSetor) ? '' : rawSetor;
    const cidadeFinal = cidadeRaw || (isLocationLike(rawSetor) ? rawSetor : '');

    return {
      id: r.id ?? i,
      nome: r.nome ?? r.name ?? '',
      cargo: r.cargo ?? r.role ?? r.funcao ?? '',
      setor: setorFinal,
      cidade: cidadeFinal,
      ramal: r.ramal ?? r.extension ?? null,
      telefone: r.telefone ?? r.phone ?? '',
      email: r.email ?? r.mail ?? '',
    };
  });
}

export const Diretorio: React.FC = () => {
  const [filtroSetor, setFiltroSetor] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [busca, setBusca] = useState('');

  const contatos = useMemo(() => {
    return [
      ...normalize(diretorioData.representantes || []),
      ...normalize(diretorioData.equipe_apucarana_pr || []),
    ];
  }, []);

  const setores = useMemo(() => {
    const s = new Set<string>();
    contatos.forEach(c => {
      const v = (c.setor || '').trim();
      if (v && !isLocationLike(v)) s.add(v);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [contatos]);

  const cidades = useMemo(() => {
    const s = new Set<string>();
    contatos.forEach(c => {
      if (c.cidade) s.add(c.cidade);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [contatos]);

  const filtrados = contatos.filter(c => {
    const buscaMatch =
      busca === '' ||
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      c.cargo.toLowerCase().includes(busca.toLowerCase());

    const setorMatch = !filtroSetor || c.setor === filtroSetor;
    const cidadeMatch = !filtroCidade || c.cidade === filtroCidade;

    return buscaMatch && setorMatch && cidadeMatch;
  });

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Diretório</h1>

        {/* Filtros */}
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Buscar por nome ou cargo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="border rounded-lg px-3 py-2 flex-1"
          />

          <select
            value={filtroSetor}
            onChange={(e) => setFiltroSetor(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">Todos os setores</option>
            {setores.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={filtroCidade}
            onChange={(e) => setFiltroCidade(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">Todas as cidades</option>
            {cidades.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Lista */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(c => (
            <div key={c.id} className="border rounded-lg p-4 shadow-sm">
              <h2 className="font-bold">{c.nome}</h2>
              <p className="text-sm text-gray-600">{c.cargo}</p>
              {c.setor && <p className="text-sm">{c.setor}</p>}
              {c.cidade && <p className="text-sm">{c.cidade}</p>}
              {c.telefone && <p className="text-sm">{c.telefone}</p>}
              {c.email && <p className="text-sm">{c.email}</p>}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};
