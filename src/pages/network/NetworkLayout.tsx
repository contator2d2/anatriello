import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useNetworkAuth } from '@/contexts/NetworkAuthContext';
import {
  Loader2, LayoutDashboard, Store, Users, Tag, Ban, ClipboardPlus, FileSearch, Settings, LogOut, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/rede/dashboard', label: 'Dashboard 360°', icon: LayoutDashboard },
  { path: '/rede/pdvs', label: 'PDVs', icon: Store },
  { path: '/rede/parceiros', label: 'Parceiros', icon: Users },
  { path: '/rede/marcas', label: 'Marcas', icon: Tag },
  { path: '/rede/bloqueios', label: 'Bloqueios', icon: Ban },
  { path: '/rede/solicitacoes', label: 'Solicitar PDV', icon: ClipboardPlus },
  { path: '/rede/auditoria', label: 'Auditoria', icon: FileSearch },
  { path: '/rede/configuracoes', label: 'Configurações', icon: Settings },
];

export default function NetworkLayout() {
  const { user, isLoading, isAuthenticated, logout } = useNetworkAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/rede/login" replace />;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.network_name || 'Rede'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
            onClick={() => { logout(); navigate('/rede/login'); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><Outlet /></main>
    </div>
  );
}
