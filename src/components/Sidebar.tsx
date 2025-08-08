import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home,
  Calendar,
  UtensilsCrossed,
  Drumstick,
  Users,
  Monitor,
  MessageSquare,
  Settings,
  Star,
  Trophy
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGamification } from '../contexts/GamificationContext';

export const Sidebar: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { userStats } = useGamification();

  const menuItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Calendar, label: 'Reservas', path: '/reservas' },
    { icon: UtensilsCrossed, label: 'Cardápio', path: '/cardapio' },
    { icon: Drumstick, label: 'Troca de Proteína', path: '/troca-proteina' },
    { icon: Users, label: 'Diretório', path: '/diretorio' },
    { icon: Monitor, label: 'Equipamentos', path: '/equipamentos' },
    { icon: MessageSquare, label: 'Mural', path: '/mural' },
  ];

  if (isAdmin) {
    menuItems.push({ icon: Settings, label: 'Admin', path: '/admin' });
  }

  return (
    <div className="w-64 bg-white shadow-lg h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">GC</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Intranet</h1>
            <p className="text-sm text-gray-500">Grupo Cropfield</p>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <img
            src={user?.avatar || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?w=150'}
            alt={user?.name}
            className="w-12 h-12 rounded-full object-cover"
          />
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.sector}</p>
            <div className="flex items-center space-x-1 mt-1">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span className="text-xs text-gray-600">{userStats?.totalPoints || 0} pts</span>
              <Trophy className="w-4 h-4 text-blue-500 ml-2" />
              <span className="text-xs text-gray-600">Nível {userStats?.level || 1}</span>
            </div>
            {userStats && userStats.streak > 0 && (
              <div className="flex items-center space-x-1 mt-1">
                <span className="text-xs text-orange-600">🔥 {userStats.streak} dias</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          © 2025 Grupo Cropfield
        </p>
      </div>
    </div>
  );
};