import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';

type Contato = {
  id?: string | number;
  nome: string;
  cargo?: string;
  setor?: string;   // apenas setores reais (Comercial, Financeiro, etc.)
  cidade?: string;  // ex.: "Apucarana - PR"
  ramal?: string | number | null;
  telefone?: string;
  email?: string;
};

const JSON_PATH = '/diretorio/diretorio.json'; // lido da pasta public

const Diretorio: React.FC = () => {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string>('');

  // filtros
  const [q, setQ] = useState('');
  const [setor, setSetor] = useState<string>('');   // apenas setores reais
  const [cidade, setCidade] = useState<string>(''); // cidade/UF

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${JSON_PATH}?v=${Date.now()}`, { cache: 'no-store' as RequestCache });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const clean = text.replace(/^\uFEFF/, ''); // remove BOM se houver
        const data = JSON.parse(clean);

        // Aceita objeto com múltiplos arrays (representantes, equipe_apucarana_pr, etc.)
        const lista: any[] = Array.isArray(data)
          ? data
          : Object.values(data).reduce((acc: any[], v: any) => {
              if (Array.isArray(v)) acc.push(...v);
              return acc;
            }, []);

        setContatos(normalize(lista));
      } catch (e: any) {
        console.error('Falha ao carregar diretório:', e);
        setErro('Não foi possível carregar o diretório.');
        setContatos([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // SETORES (só valores que NÃO parecem cidade/UF)
  const setores = useMemo(() => {
    const s = new Set<string>();
    contatos.forEach(c => {
      const v = (c.setor || '').trim();
      if (v && !isLocationLike(v)) s.add(v);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [contatos]);

  // CIDADES
  const cidades = useMemo(() => {
    const s = new Set<string>();
    contatos.forEach(c => c.cidade && s.add(c.cidade));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [contatos]);

  // FILTRO
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
        <h1 className="text-2xl font-bold">Diretório</h1>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por nome, cargo, setor, cidade, e-mail…"
            className="border rounded-lg px-3 py-2 flex-1 min-w-[220px]"
          />
          <select
            value={setor}
            onChange={e => setSetor(e.target.value)}
            className="border rounded-lg px-3 py-2"
            aria-label="Filtrar por setor"
          >
            <option value="">Todos os setores</option>
            {setores.map(s => (<option key={s} value={s}>{s}</option>))}
          </select>
          <select
            value={cidade}
            onChange={e => setCidade(e.target.value)}
            className="border rounded-lg px-3 py-2"
            aria-label="Filtrar por cidade"
          >
            <option value="">Todas as cidades</option>
            {cidades.map(c => (<option key={c} value={c}>{c}</option>))}
          </select>
          {(setor || cidade || q) && (
            <button
              onClick={() => { setSetor(''); setCidade(''); setQ(''); }}
              className="border rounded-lg px-3 py-2 hover:bg-gray-50"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl p-4 border">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Carregando diretório…</div>
          ) : erro ? (
            <div className="text-center py-12 text-red-600">{erro}</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Nenhum contato encontrado.</div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtrados.map((c) => (
                <li key={String(c.id ?? `${c.nome}-${c.email ?? ''}`)} className="p-4 border rounded-lg">
                  <div className="text-lg font-semibold">{c.nome}</div>
                  <div className="text-sm text-gray-600">{c.cargo}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {[c.setor, c.cidade].filter(Boolean).join(' • ')}
                  </div>
                  <div className="mt-2 text-sm space-y-1">
                    {c.telefone && <div>📞 {c.telefone}</div>}
                    {c.email && <div>✉️ {c.email}</div>}
                    {c.ramal && <div>Ramal {c.ramal}</div>}
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

export default Diretorio;

/* ===================== helpers ===================== */

function normalize(lista: any[]): Contato[] {
  return lista.map((r: any, i: number) => {
    const rawSetor  = r.setor ?? r.sector ?? r.departamento ?? '';
    const cidadeRaw = r.cidade ?? r.city ?? r.localizacao ?? '';

    // Se "setor" parece cidade/UF, move para cidade e zera setor
    const setorFinal  = isLocationLike(rawSetor) ? '' : String(rawSetor || '');
    const cidadeFinal = cidadeRaw ? String(cidadeRaw) : (isLocationLike(rawSetor) ? String(rawSetor) : '');

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

// Detecta strings do tipo "Cidade - UF" ou "Cidade/UF"
function isLocationLike(v?: string) {
  if (!v) return false;
  const t = String(v).trim();
  const ufSlash = /\/[A-Z]{2}$/.test(t);     // "Apucarana/PR"
  const ufDash  = /-\s*[A-Z]{2}$/.test(t);   // "Apucarana - PR"
  return ufSlash || ufDash;
}
