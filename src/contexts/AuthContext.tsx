import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Se definir no .env do frontend: VITE_API_URL=http://localhost:3006
// o client vai falar direto com o backend; senão, usa rotas relativas (exigem proxy no Vite).
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

interface User {
  id: string;
  name: string;
  email: string;
  sector: string;
  setor: string;
  role: string;
  avatar?: string;
  token?: string;
}

interface AuthContextType {
  user: User | null;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

/** Helpers de rede **/
function buildUrl(path: string) {
  if (!path.startsWith('/')) path = '/' + path;
  return API_BASE ? `${API_BASE}${path}` : path;
}

async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(buildUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  });

  const ct = res.headers.get('content-type') || '';
  const text = await res.text();

  // evita "Unexpected token <" ao tentar parsear HTML
  if (!ct.includes('application/json')) {
    const snippet = text.slice(0, 160).replace(/\s+/g, ' ');
    throw new Error(`Resposta não-JSON (${res.status}) em ${path}. CT="${ct}". Trecho: ${snippet}`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e: any) {
    throw new Error(`Falha ao parsear JSON de ${path}: ${e.message}`);
  }

  if (!res.ok) {
    throw new Error(json?.error || `Erro ${res.status}`);
  }
  return json as T;
}

function normalizeUser(u: any): User {
  const user: User = {
    id: u.id,
    name: u.name || u.nome || '',
    email: u.email,
    setor: u.setor || u.sector || '',
    sector: u.sector || u.setor || '',
    role: u.role || '',
    avatar: u.avatar,
    token: u.token,
  };
  if (!user.role) {
    if (user.email === 'admin@grupocropfield.com.br' || user.sector === 'TI' || user.setor === 'TI') {
      user.role = 'admin';
    } else if (user.sector === 'RH' || user.setor === 'RH') {
      user.role = 'rh';
    } else {
      user.role = 'colaborador';
    }
  }
  return user;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { checkAuth(); /* eslint-disable-next-line */ }, []);

  const checkAuth = async () => {
    setLoading(true);
    try {
      console.log('[AUTH] Starting auth check...');

      // 1) tenta localStorage pra UX rápida
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed && parsed.email) {
            const normalized = normalizeUser(parsed);
            console.log('[AUTH] Found stored user:', normalized.email);
            setUser(normalized);
            setIsAuthenticated(true);

            // verifica no backend em background
            apiFetch<{ user: any }>('/api/me')
              .then((me) => {
                if (me?.user) {
                  const apiUser = normalizeUser(me.user);
                  setUser(apiUser);
                  setIsAuthenticated(true);
                  localStorage.setItem('currentUser', JSON.stringify(apiUser));
                } else {
                  console.warn('[AUTH] /api/me sem user; limpando sessão local');
                  localStorage.removeItem('currentUser');
                  setUser(null);
                  setIsAuthenticated(false);
                }
              })
              .catch((err) => {
                console.warn('[AUTH] verificação /api/me falhou (mantendo local):', err?.message || err);
              })
              .finally(() => setLoading(false));

            return; // encerra aqui: loading será atualizado no finally acima
          }
        } catch {
          console.warn('[AUTH] currentUser inválido; limpando');
          localStorage.removeItem('currentUser');
        }
      }

      // 2) sem localStorage, tenta sessão no backend (cookie)
      try {
        const me = await apiFetch<{ user: any }>('/api/me');
        if (me?.user) {
          const apiUser = normalizeUser(me.user);
          setUser(apiUser);
          setIsAuthenticated(true);
          localStorage.setItem('currentUser', JSON.stringify(apiUser));
          return;
        }
      } catch (e: any) {
        console.warn('[AUTH] /api/me falhou:', e.message);
      }

      // 3) não autenticado
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('currentUser');
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
      // mesmo se falhar, limpa lado cliente
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, logout, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
