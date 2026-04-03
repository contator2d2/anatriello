import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSupermarketAuth } from '@/contexts/SupermarketAuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DashboardWidget } from '@/components/dashboard/DashboardWidget';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle, XCircle, Clock, Tag, Building2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

const getHeaders = () => {
  const t = localStorage.getItem('supermarket_auth_token');
  return t ? { Authorization: `Bearer ${t}` } : undefined;
};

export default function SupermarketDashboard() {
  const { user } = useSupermarketAuth();

  const { data: live } = useQuery({
    queryKey: ['sm-live'],
    queryFn: () => api<any>('/api/access-control/supermarket-portal/live', { headers: getHeaders() }),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: todayStats } = useQuery({
    queryKey: ['sm-today-stats'],
    queryFn: () => api<any>('/api/access-control/supermarket-portal/today-stats', { headers: getHeaders() }),
    enabled: !!user,
    refetchInterval: 60000,
  });

  const s = todayStats || { entries: 0, exits: 0, blocked: 0, avg_duration: 0, active_brands: 0, active_agencies: 0 };
  const promotersNow = live?.promoters_now || [];
  const brandsNow = live?.brands_now || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel em Tempo Real</h1>
        <p className="text-muted-foreground">{user?.unit_name} — {format(new Date(), 'dd/MM/yyyy')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Na Loja Agora" value={promotersNow.length} icon={<Users className="h-5 w-5 text-primary" />} />
        <StatsCard title="Entradas Hoje" value={s.entries} icon={<CheckCircle className="h-5 w-5 text-primary" />} />
        <StatsCard title="Bloqueios Hoje" value={s.blocked} icon={<XCircle className="h-5 w-5 text-destructive" />} />
        <StatsCard title="Tempo Médio" value={s.avg_duration ? `${s.avg_duration} min` : '—'} icon={<Clock className="h-5 w-5 text-primary" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Promotores na loja */}
        <DashboardWidget title="Promotores na Loja" icon={<Users className="h-4 w-4 text-primary" />}
          description={`${promotersNow.length} promotor(es) ativo(s)`}>
          <div className="space-y-3 max-h-96 overflow-auto">
            {promotersNow.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum promotor na loja no momento</p>
            ) : promotersNow.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {p.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.agency_name || 'Interno'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Entrada: {p.entry_time}</p>
                  <p className="text-xs font-medium text-primary">{p.duration_so_far} min</p>
                </div>
              </div>
            ))}
          </div>
        </DashboardWidget>

        {/* Marcas atendidas */}
        <DashboardWidget title="Marcas Atendidas Hoje" icon={<Tag className="h-4 w-4 text-primary" />}
          description={`${brandsNow.length} marca(s)`}>
          <div className="space-y-3 max-h-96 overflow-auto">
            {brandsNow.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma marca registrada hoje</p>
            ) : brandsNow.map((b: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{b.brand_name}</p>
                  <p className="text-xs text-muted-foreground">{b.agency_name || 'Interno'}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline">{b.promoter_count} promotor(es)</Badge>
                </div>
              </div>
            ))}
          </div>
        </DashboardWidget>
      </div>

      {/* Alertas de bloqueio */}
      {s.blocked > 0 && (
        <DashboardWidget title="Tentativas Bloqueadas Hoje" icon={<ShieldAlert className="h-4 w-4 text-destructive" />}>
          <div className="space-y-2">
            {(live?.blocked_today || []).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between p-2 rounded bg-destructive/5 border border-destructive/20">
                <div>
                  <p className="text-sm font-medium">{b.name || b.cpf}</p>
                  <p className="text-xs text-muted-foreground">{b.block_reason_label}</p>
                </div>
                <p className="text-xs text-muted-foreground">{b.time}</p>
              </div>
            ))}
          </div>
        </DashboardWidget>
      )}
    </div>
  );
}
