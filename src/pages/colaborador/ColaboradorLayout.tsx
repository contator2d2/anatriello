import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Home, Clock, FileText, User, ChevronLeft, WifiOff, CloudUpload, Megaphone, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { useColabCapabilitiesSync, useCaps } from "@/hooks/use-colab-capabilities";
import { useColabAutoSync } from "@/hooks/use-colab-auto-sync";
import anatrielloLogo from "@/assets/anatriello-logo.png.asset.json";

interface Props {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  rightSlot?: ReactNode;
  bg?: "navy" | "light";
  hideTopBar?: boolean;
}

// tab.cap = capability necessária para mostrar a aba (undefined = sempre visível)
const tabs: { to: string; label: string; icon: any; cap?: string }[] = [
  { to: "/colaborador/home", label: "Início", icon: Home },
  { to: "/colaborador/jornada", label: "Agenda", icon: Calendar, cap: "journey.view" },
  { to: "/colaborador/perfil?tab=comunicados", label: "Comunicados", icon: Megaphone },
  { to: "/colaborador/documentos", label: "Documentos", icon: FileText, cap: "documents.view" },
  { to: "/colaborador/perfil", label: "Perfil", icon: User, cap: "profile.view" },
];

export function ColaboradorLayout({ children, title, showBack, rightSlot, bg = "light", hideTopBar }: Props) {
  const nav = useNavigate();
  const { branding } = useBranding() as any;
  const { isOnline, isSyncing } = useOfflineSync();
  const logo = branding?.logo_topbar || branding?.logo || anatrielloLogo.url;
  useColabCapabilitiesSync();
  useColabAutoSync();
  const caps = useCaps();
  const visibleTabs = tabs.filter(t => !t.cap || caps.includes(t.cap));
  const cols = visibleTabs.length || 1;

  return (
    <div className={cn("min-h-screen flex flex-col", bg === "navy" ? "bg-[#0a1128] text-white" : "bg-[#f4f6fb] text-[#0f172a]")}>
      {!hideTopBar && (
      <div className={cn(
        "sticky top-0 z-30 px-3 pt-[env(safe-area-inset-top)] pb-2 flex items-center gap-2 border-b",
        bg === "navy" ? "bg-[#0a1128] border-white/10" : "bg-white border-slate-100"
      )}>
        <img src={logo} alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
        <span className={cn("text-sm font-semibold flex-1 truncate", bg === "navy" ? "text-white" : "text-[#0f172a]")}>
          {branding?.company_name || "Anatriello"}
        </span>
        {!isOnline && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-red-100 text-red-600">
            <WifiOff className="h-3 w-3" /> Offline
          </span>
        )}
        {isOnline && isSyncing && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-600">
            <CloudUpload className="h-3 w-3 animate-pulse" /> Sincronizando
          </span>
        )}
      </div>
      )}

      {title && (
        <header className={cn(
          "sticky top-[calc(env(safe-area-inset-top)+3rem)] z-20 px-4 py-3 flex items-center gap-3 border-b",
          bg === "navy" ? "bg-[#0a1128] border-white/10" : "bg-white border-slate-100"
        )}>
          {showBack && (
            <button onClick={() => nav(-1)} className="p-1 -ml-1 rounded-full hover:bg-black/5">
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <h1 className="flex-1 text-center text-[15px] font-semibold">{title}</h1>
          <div className="w-6">{rightSlot}</div>
        </header>
      )}
      <main className="flex-1 pb-24 overflow-y-auto">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(15,23,42,0.05)] pb-[env(safe-area-inset-bottom)]">
        <div
          className="max-w-lg mx-auto grid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {visibleTabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                isActive ? "text-[#f97316]" : "text-slate-400"
              )}
            >
              {({ isActive }) => (
                <>
                  <t.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                  <span>{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
