import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSupermarketAuth } from '@/contexts/SupermarketAuthContext';
import { Loader2, LayoutDashboard, Clock, History, LogOut, Store, Users, CalendarDays, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/supermercado/dashboard', label: 'Tempo Real', icon: LayoutDashboard },
  { path: '/supermercado/ocorrencias', label: 'Ocorrências', icon: AlertTriangle },
  { path: '/supermercado/visitas', label: 'Solicitações', icon: CalendarDays },
  { path: '/supermercado/historico', label: 'Histórico', icon: History },
];

export default function SupermarketLayout() {
  const { user, isLoading, isAuthenticated, logout } = useSupermarketAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/supermercado/login" replace />;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.unit_name || 'Supermercado'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.network_name || user?.email}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                location.pathname === item.path ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}>
              <item.icon className="h-4 w-4" /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={() => { logout(); navigate('/supermercado/login'); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><Outlet /></main>
    </div>
  );
}
