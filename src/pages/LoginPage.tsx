import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Chrome } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const API_BASE = '';

export const LoginPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Preencha todos os campos!');
      return;
    }

    setLoading(true);
    
    // Check hardcoded credentials first (for demo purposes)
    const demoUsers = [
      { id: '1', email: 'admin@grupocropfield.com.br', password: 'admin123', name: 'Administrador', sector: 'TI', setor: 'TI', role: 'admin', avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?w=150', token: 'demo-token-admin' },
      { id: '2', email: 'rh@grupocropfield.com.br', password: 'rh123', name: 'RH Manager', sector: 'RH', setor: 'RH', role: 'rh', avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?w=150', token: 'demo-token-rh' },
      { id: '3', email: 'user@grupocropfield.com.br', password: 'user123', name: 'Usuário Teste', sector: 'Geral', setor: 'Geral', role: 'colaborador', avatar: 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?w=150', token: 'demo-token-user' },
      { id: '4', email: 'admin', password: 'admin', name: 'Admin', sector: 'TI', setor: 'TI', role: 'admin', avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?w=150', token: 'demo-token-admin2' },
      { id: '5', email: 'user', password: 'user', name: 'Usuário', sector: 'Geral', setor: 'Geral', role: 'colaborador', avatar: 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?w=150', token: 'demo-token-user2' },
    ];

    const demoUser = demoUsers.find(u => u.email === email && u.password === password);
    
    if (demoUser) {
      // Store user in localStorage for persistence
      localStorage.setItem('currentUser', JSON.stringify(demoUser));
      console.log('Demo user logged in:', demoUser);
      toast.success('Login realizado com sucesso!');
      setLoading(false);
      // Reload to trigger auth check
      window.location.href = '/';
      return;
    }

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        
        toast.success('Login realizado com sucesso!');
        // Reload to trigger auth check
        window.location.href = '/';
      } else {
        let errorMessage = 'Credenciais inválidas';
        toast.error('Credenciais inválidas');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">GC</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Bem-vindo!</h1>
            <p className="text-gray-600">Faça login para acessar a Intranet</p>
          </div>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            className="w-full mb-6 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-3"
          >
            <Chrome className="w-5 h-5" />
            <span className="font-medium">Entrar com Google</span>
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">ou</span>
            </div>
          </div>

          {/* Manual Login Form */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="seu.email@grupocropfield.com.br"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Digite sua senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              <strong>Credenciais de teste:</strong><br />
              admin / admin ou user / user<br />
              <span className="text-xs text-gray-500">
                Ou use: admin@grupocropfield.com.br / admin123
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};