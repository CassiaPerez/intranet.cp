diff --git a/src/components/Sidebar.tsx b/src/components/Sidebar.tsx
index 6cb1277154b4ef19364b3d5ca3206e6ad798a16b..754807c07b141b4db4c6b0ec6e951846d8180f2e 100644
--- a/src/components/Sidebar.tsx
+++ b/src/components/Sidebar.tsx
@@ -1,49 +1,51 @@
 import React from 'react';
 import { NavLink } from 'react-router-dom';
 import { 
-  Home, 
-  Calendar, 
-  UtensilsCrossed, 
-  Users, 
-  Monitor, 
+  Home,
+  Calendar,
+  UtensilsCrossed,
+  Drumstick,
+  Users,
+  Monitor,
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
+    { icon: Drumstick, label: 'Troca de Proteína', path: '/troca-proteina' },
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
