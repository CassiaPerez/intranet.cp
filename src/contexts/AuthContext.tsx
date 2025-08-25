import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiGet } from '../lib/api';

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
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void checkAuth(); }, []);

  const normalizeUser = (u: any): User => {
    const sector = u.sector ?? u.setor ?? 'Geral';
    const setor = u.setor ?? sector;
    let role = u.role;
    if (!role) {
      if (u.email === 'admin@grupocropfield.com.br' || sector === 'TI' || setor === 'TI') role = 'admin';
      else if (sector === 'RH' || setor === 'RH') role = 'rh';
      else role = 'colaborador';
    }
    return { id: String(u.id), name: u.name ?? u.nome, email: u.email, sector, setor, role, avatar: u.avatar ?? u.foto, token: u.token };
  };

  const checkAuth = async () => {
    setLoading(true);
    try {
      // 1) back é a verdade
      const data = await apiGet<{ok: boolean; user: any}>('/api/me');
      if (data?.ok && data.user) {
        const nu = normalizeUser(data.user);
        setUser(nu);
        setIsAuthenticated(true);
        localStorage.setItem('currentUser', JSON.stringify(nu));
        setLoading(false);
        return;
      }
    } catch {
      // 2) fallback localStorage
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        try {
          const nu = normalizeUser(JSON.parse(stored));
          setUser(nu);
          setIsAuthenticated(true);
          setLoading(false);
          return;
        } catch { localStorage.removeItem('currentUser'); }
      }
    }
    setUser(null);
    setIsAuthenticated(false);
    setLoading(false);
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    localStorage.removeItem('currentUser');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, logout, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
