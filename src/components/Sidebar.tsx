import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type NavItem = { to: string; label: string; adminOnly?: boolean };

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/reservas', label: 'Reservas' },
  { to: '/cardapio', label: 'Cardápio' },
  { to: '/troca-proteina', label: 'Troca de Proteínas' },
  { to: '/diretorio', label: 'Diretório' },
  { to: '/equipamentos', label: 'Equipamentos', adminOnly: true },
  { to: '/mural', label: 'Mural' },
  { to: '/painel', label: 'Painel Admin' }, // Removido adminOnly porque vamos tratar especificamente
];

function SidebarImpl() {
  const { user, logout } = useAuth();
  
  // Debug user data
  console.log('Sidebar user data:', user);
  
  // Simplified admin check - if any admin indicator is true
  const isAdmin = !!user && (
    user.role === 'admin' ||
    user.email === 'admin@grupocropfield.com.br' ||
    user.sector === 'TI' || 
    user.sector === 'RH' ||
    user.setor === 'TI' ||
    user.setor === 'RH' ||
    user.role === 'rh' ||
    user.role === 'ti'
  );
  
  console.log('Is admin:', isAdmin, 'User role:', user?.role, 'User sector:', user?.sector, 'User setor:', user?.setor);

  return (
    <aside className="w-64 min-h-screen border-r bg-white p-4">
      <div className="mb-4">
        <div className="font-semibold">Intranet</div>
        <div className="text-xs text-slate-500 truncate">{user?.name || 'Visitante'}</div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.filter(item => {
          // Painel Admin: APENAS para role === 'admin'
          if (item.to === '/painel') {
            return isAdmin;
          }
          // Outros itens adminOnly: para admin/rh/ti
          if (item.adminOnly) {
            return isAdmin;
          }
          // Itens normais: para todos
          return true;
        }).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-4">
        <button onClick={logout} className="text-xs text-slate-600 hover:underline">Sair</button>
      </div>
    </aside>
  );
}

const Sidebar = SidebarImpl;
export { Sidebar };
export default Sidebar;