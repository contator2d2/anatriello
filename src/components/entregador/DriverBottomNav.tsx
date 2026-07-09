import { Link, useLocation } from "react-router-dom";
import { Home, Clock, PackageX, RotateCcw, History } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/entregador/home", label: "Início", icon: Home },
  { to: "/entregador/ponto", label: "Ponto", icon: Clock },
  { to: "/entregador/avaria", label: "Avaria", icon: PackageX },
  { to: "/entregador/devolucao", label: "Devolução", icon: RotateCcw },
  { to: "/entregador/historico", label: "Histórico", icon: History },
];

export default function DriverBottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5 max-w-md mx-auto">
        {items.map((it) => {
          const active = pathname === it.to || (it.to !== "/entregador/home" && pathname.startsWith(it.to));
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={cn(
                  "flex flex-col items-center justify-center py-2 text-[11px] gap-0.5 transition",
                  active ? "text-blue-700 font-semibold" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Icon className={cn("w-5 h-5", active && "text-blue-700")} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
