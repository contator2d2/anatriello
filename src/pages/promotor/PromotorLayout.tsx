import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, FileText, Clock, Upload, Settings, LogOut, Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePromotorNotifications, usePromotorMarkRead, useLocationTracking } from "@/hooks/use-promotor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PromotorLayoutProps { children: ReactNode; }

const TYPE_ICONS: Record<string, string> = {
  info: 'ℹ️',
  alert: '⚠️',
  document: '📄',
  payslip: '💰',
  timesheet: '📋',
  punch: '⏰',
};

function parseSafe(val: unknown, mask: string) {
  if (!val) return '';
  try {
    const d = new Date(String(val));
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    if (mask === 'dd/MM HH:mm') {
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return d.toLocaleDateString('pt-BR');
  } catch { return ''; }
}

export function PromotorLayout({ children }: PromotorLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: notifications = [] } = usePromotorNotifications();
  const markRead = usePromotorMarkRead();

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  // Track location every 60s during work hours
  useLocationTracking();

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

  const handleMarkRead = (id: string) => {
    markRead.mutate(id);
  };

  const navItems = [
    { path: '/promotor/home', icon: Home, label: 'Início' },
    { path: '/promotor/agenda', icon: Clock, label: 'Agenda' },
    { path: '/promotor/avarias', icon: FileText, label: 'Avarias' },
    { path: '/promotor/ponto', icon: Clock, label: 'Ponto' },
    { path: '/promotor/configuracoes', icon: Settings, label: 'Config' },
  ];

  const isLoginPage = location.pathname.includes('/login') || location.pathname.includes('/trocar-senha');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar with notifications */}
      {!isLoginPage && (
        <header className="sticky top-0 z-50 bg-card border-b border-border">
          <div className="flex items-center justify-between h-12 px-4 max-w-lg mx-auto">
            <h2 className="text-sm font-bold text-foreground truncate">
              {navItems.find(i => location.pathname === i.path)?.label || 'Promotor'}
            </h2>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Bell className="h-5 w-5 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Notifications panel */}
          {showNotifications && (
            <div className="absolute top-12 left-0 right-0 z-50 bg-card border-b border-border shadow-lg max-w-lg mx-auto">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <span className="text-sm font-semibold">Notificações</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowNotifications(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="max-h-80">
                {notifications.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhuma notificação</p>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((n: any) => (
                      <button
                        key={n.id}
                        onClick={() => { if (!n.read) handleMarkRead(n.id); }}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                          !n.read && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-base flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] || 'ℹ️'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-sm font-medium truncate", !n.read && "text-foreground", n.read && "text-muted-foreground")}>
                                {n.title}
                              </span>
                              {!n.read && <Badge variant="default" className="text-[9px] h-4 px-1">Nova</Badge>}
                            </div>
                            {n.message && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            )}
                            <span className="text-[10px] text-muted-foreground">{parseSafe(n.created_at, 'dd/MM HH:mm')}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </header>
      )}

      <main className="flex-1 pb-16 overflow-y-auto">{children}</main>

      {!isLoginPage && (
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
          <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setShowNotifications(false); }}
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
