import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, FileText, Clock, Upload, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromotorLayoutProps { children: ReactNode; }

export function PromotorLayout({ children }: PromotorLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('promotor_token');
    if (!token && !location.pathname.includes('/promotor/login')) {
      navigate('/promotor/login');
    }
  }, [location, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('promotor_token');
    localStorage.removeItem('promotor_employee');
    navigate('/promotor/login');
  };

  const navItems = [
    { path: '/promotor/home', icon: Home, label: 'Início' },
    { path: '/promotor/documentos', icon: FileText, label: 'Docs' },
    { path: '/promotor/ponto', icon: Clock, label: 'Ponto' },
    { path: '/promotor/enviar', icon: Upload, label: 'Enviar' },
    { path: '/promotor/configuracoes', icon: Settings, label: 'Config' },
  ];

  const isLoginPage = location.pathname.includes('/login') || location.pathname.includes('/trocar-senha');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 pb-16 overflow-y-auto">{children}</main>

      {!isLoginPage && (
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
          <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
            <button onClick={handleLogout} className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-muted-foreground hover:text-destructive transition-colors">
              <LogOut className="h-5 w-5" />
              <span className="text-[10px] font-medium">Sair</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
