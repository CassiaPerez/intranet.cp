// src/components/Sidebar.tsx
import React, { useMemo, useState } from "react";
import {
  NavLink,
  useLocation,
  useInRouterContext,
} from "react-router-dom";
import {
  Home,
  CalendarDays,
  DoorOpen,
  Utensils,
  Repeat2,
  Users2,
  Wrench,
  Megaphone,
  Settings,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

type MenuItem = {
  label: string;
  to: string;
  icon: React.ElementType;
  section?: string;
  adminOnly?: boolean; // só TI/RH
};

const baseItems: MenuItem[] = [
  { label: "Início", to: "/", icon: Home, section: "Principal" },
  { label: "Reservas de Salas", to: "/reservas", icon: CalendarDays, section: "Reservas" },
  { label: "Agendamentos Portaria", to: "/portaria", icon: DoorOpen, section: "Reservas" },
  { label: "Cardápio do Mês", to: "/cardapio", icon: Utensils, section: "Refeitório" },
  { label: "Troca de Proteínas", to: "/trocas-proteina", icon: Repeat2, section: "Refeitório" },
  { label: "Mural de Informações", to: "/mural", icon: Megaphone, section: "Comunicação" },
  { label: "Diretório de Contatos", to: "/contatos", icon: Users2, section: "Pessoas" },
  { label: "Equipamentos de TI", to: "/admin/equipamentos-ti", icon: Wrench, section: "Administrativo", adminOnly: true },
  { label: "Painel Admin", to: "/admin", icon: Settings, section: "Administrativo", adminOnly: true },
];

function SectionHeader({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  return (
    <div className={`mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 ${collapsed ? "px-2" : "px-4"}`}>
      {collapsed ? "•" : children}
    </div>
  );
}

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const inRouter = useInRouterContext();
  const location = inRouter ? useLocation() : (null as any);

  const setor = (user as any)?.setor || (user as any)?.role || (user as any)?.department;
  const isAdmin = setor === "TI" || setor === "RH";

  const items = useMemo(
    () => baseItems.filter((it) => (it.adminOnly ? isAdmin : true)),
    [isAdmin]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items) {
      const section = it.section ?? "Outros";
      if (!map.has(section)) map.set(section, []);
      map.get(section)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  const Wrapper: React.FC<{ to: string; title?: string; className?: string }> = ({ to, title, className, children }) => {
    if (!inRouter) {
      return (
        <div className={[ "mx-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-700",
          collapsed ? "justify-center" : "", "cursor-default select-none"].join(" ")} title={title}>
          {children}
        </div>
      );
    }
    const active = location.pathname === to || location.pathname.startsWith(to + "/");
    const cls = [
      "mx-2 flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
      active ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100",
      collapsed ? "justify-center" : "",
      className || "",
    ].join(" ");
    return (
      <NavLink to={to} title={title} className={cls}>
        {children}
      </NavLink>
    );
  };

  return (
    <aside
      className={`h-screen sticky top-0 border-r border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60
      ${collapsed ? "w-20" : "w-72"} transition-all duration-300 flex flex-col`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200">
        <div className="flex items-center gap-2 overflow-hidden">
          <img
            src="/logo.svg"
            alt="Logo"
            className="h-8 w-8 rounded-lg shadow-sm"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold leading-5 truncate">Intranet Cropfield</div>
              <div className="text-xs text-slate-500">{inRouter ? "Bem-vindo(a)" : "Carregando..."}</div>
            </div>
          )}
        </div>

        <button
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-95 transition"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir" : "Recolher"}
        >
          <ChevronLeft className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* User */}
      <div className={`flex items-center gap-3 ${collapsed ? "px-2" : "px-4"} py-4 border-b border-slate-200`}>
        <img
          src={(user as any)?.photo || (user as any)?.picture || "/avatar-placeholder.png"}
          alt="Usuário"
          className="h-10 w-10 rounded-full object-cover border border-slate-200"
          onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/avatar-placeholder.png")}
        />
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-medium truncate">
              {(user as any)?.name || (user as any)?.displayName || "Usuário"}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {(user as any)?.email || ""}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {grouped.map(([section, links]) => (
          <div key={section}>
            <SectionHeader collapsed={collapsed}>{section}</SectionHeader>
            <ul className="space-y-1">
              {links.map(({ label, to, icon: Icon }) => (
                <li key={to}>
                  <Wrapper to={to} title={collapsed ? label : undefined}>
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Wrapper>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200">
        <button
          onClick={() => {
            try {
              logout?.();
            } catch {
              localStorage.clear();
              sessionStorage.clear();
              if (inRouter) {
                window.location.href = "/login";
              }
            }
          }}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium
           hover:bg-slate-50 active:scale-[0.98] transition ${collapsed ? "px-2" : ""}`}
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </button>
        {!collapsed && (
          <p className="mt-2 text-[10px] text-slate-400 text-center">
            v1.0 · Sessão segura
          </p>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
