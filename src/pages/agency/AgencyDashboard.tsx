import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAgencyAuth } from '@/contexts/AgencyAuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DashboardWidget } from '@/components/dashboard/DashboardWidget';
import { Users, CheckCircle, XCircle, Clock, Building2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function AgencyDashboard() {
  const { user } = useAgencyAuth();
  const token = localStorage.getItem('agency_auth_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const { data: stats } = useQuery({
    queryKey: ['agency-dashboard-stats'],
    queryFn: () => api<any>('/api/access-control/agency/stats', { headers }),
    enabled: !!user,
  });

  const { data: recentEntries } = useQuery({
    queryKey: ['agency-recent-entries'],
    queryFn: () => api<any[]>('/api/access-control/agency/recent-entries', { headers }),
    enabled: !!user,
  });

  const s = stats || { total_promoters: 0, active_promoters: 0, blocked_promoters: 0, entries_today: 0, blocked_today: 0, units_authorized: 0 };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo, {user?.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Promotores" value={s.total_promoters} icon={<Users className="h-5 w-5 text-primary" />} description={`${s.active_promoters} ativos`} />
        <StatsCard title="Entradas Hoje" value={s.entries_today} icon={<CheckCircle className="h-5 w-5 text-primary" />} />
        <StatsCard title="Bloqueios Hoje" value={s.blocked_today} icon={<XCircle className="h-5 w-5 text-destructive" />} />
        <StatsCard title="Unidades Autorizadas" value={s.units_authorized} icon={<Building2 className="h-5 w-5 text-primary" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardWidget title="Últimas Entradas" icon={<Clock className="h-4 w-4 text-primary" />}>
          <div className="space-y-3 max-h-80 overflow-auto">
            {(recentEntries || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma entrada registrada</p>
            ) : (
              (recentEntries || []).map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{entry.promoter_name || entry.cpf}</p>
                    <p className="text-xs text-muted-foreground">{entry.unit_name}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={entry.status === 'authorized' ? 'default' : 'destructive'} className="text-xs">
                      {entry.status === 'authorized' ? 'Autorizado' : 'Bloqueado'}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {entry.entry_at ? format(new Date(entry.entry_at), 'dd/MM HH:mm') : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DashboardWidget>

        <DashboardWidget title="Status dos Promotores" icon={<ShieldCheck className="h-4 w-4 text-primary" />}>
          <div className="flex items-center justify-center py-8">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-3xl font-bold text-primary">{s.active_promoters}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-destructive">{s.blocked_promoters}</p>
                <p className="text-xs text-muted-foreground">Bloqueados</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-muted-foreground">{s.total_promoters - s.active_promoters - (s.blocked_promoters || 0)}</p>
                <p className="text-xs text-muted-foreground">Inativos</p>
              </div>
            </div>
          </div>
        </DashboardWidget>
      </div>
    </div>
  );
}
