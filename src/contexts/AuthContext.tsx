import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  sector: string;
  role: 'user' | 'admin';
  avatar?: string;
  points: number;
  level: number;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for saved session
    const savedUser = localStorage.getItem('intranet_user');
    const token = localStorage.getItem('intranet_token');
    
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Basic credential check for mock authentication
      if (!email || email.trim().length === 0) {
        console.error('Email is required');
        return false;
      }

      if (!password || password.trim().length === 0) {
        console.error('Password is required');
        return false;
      }

      // Mock authentication - replace with actual API call
      const mockUser: User = {
        id: '1',
        name: 'Admin User',
        email,
        sector: 'TI',
        role: 'admin',
        avatar: 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?w=150',
        points: 1250,
        level: 5,
      };

      setUser(mockUser);
      setIsAuthenticated(true);
      localStorage.setItem('intranet_user', JSON.stringify(mockUser));
      localStorage.setItem('intranet_token', 'mock-token-123');
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    try {
      // Mock Google OAuth - replace with actual implementation
      const mockUser: User = {
        id: '2',
        name: 'João Silva',
        email: 'joao.silva@grupocropfield.com.br',
        sector: 'Financeiro',
        role: 'user',
        avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?w=150',
        points: 850,
        level: 3
      };

      setUser(mockUser);
      setIsAuthenticated(true);
      localStorage.setItem('intranet_user', JSON.stringify(mockUser));
      localStorage.setItem('intranet_token', 'google-token-456');
      return true;
    } catch (error) {
      console.error('Google login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('intranet_user');
    localStorage.removeItem('intranet_token');
  };

  const isAdmin = user?.role === 'admin' && (user?.sector === 'TI' || user?.sector === 'RH');

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithGoogle,
        logout,
        isAuthenticated,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
