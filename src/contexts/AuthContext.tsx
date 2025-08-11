import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE = '';

interface User {
  id: string;
  name: string;
  email: string;
  sector: string;
  avatar?: string;
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check if user is stored in localStorage first
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setIsAuthenticated(true);
          return;
        } catch (error) {
          localStorage.removeItem('currentUser');
        }
      }

      // Try API call as fallback
      try {
        const response = await fetch(`${API_BASE}/api/me`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const responseText = await response.text();
          if (responseText) {
            try {
              const data = JSON.parse(responseText);
              setUser(data.user);
              setIsAuthenticated(true);
              localStorage.setItem('currentUser', JSON.stringify(data.user));
              return;
            } catch (parseError) {
              console.error('Failed to parse auth response:', parseError);
            }
          }
        }
      } catch (apiError) {
        console.log('API not available, using local auth');
      }

      // If no stored user and API fails, user is not authenticated
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
      // Clear localStorage first
      localStorage.removeItem('currentUser');
      
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        logout,
        isAuthenticated,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
