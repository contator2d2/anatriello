import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAgencyAuth } from '@/contexts/AgencyAuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DashboardWidget } from '@/components/dashboard/DashboardWidget';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PromoterScoreBadge } from '@/components/scores/PromoterScoreBadge';
import { IncidentDetailDialog } from '@/components/incidents/IncidentDetailDialog';
import { useIncidents, usePromoterScores } from '@/hooks/use-incidents';

import { Users, CheckCircle, XCircle, Building2, Clock, CalendarDays, AlertTriangle, Star, CreditCard, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export default function AgencyDashboard() {
  const { user, isLoading: isAuthLoading } = useAgencyAuth();
  const token = localStorage.getItem('agency_auth_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [scheduleTab, setScheduleTab] = useState('today');

  const { incidents, respondIncident } = useIncidents('agency');
  const { scores } = usePromoterScores('agency');

  const { data: stats } = useQuery({
    queryKey: ['agency-dashboard-stats'],
    queryFn: () => api<any>('/api/access-control/agency/stats', { headers }),
    enabled: !!user && !!headers && !isAuthLoading,
  });

  const { data: recentEntries } = useQuery({
    queryKey: ['agency-recent-entries'],
    queryFn: () => api<any[]>('/api/access-control/agency/recent-entries', { headers }),
    enabled: !!user && !!headers && !isAuthLoading,
  });

  const { data: schedule } = useQuery({
    queryKey: ['agency-schedule'],
    queryFn: () => api<any>('/api/access-control/agency/schedule', { headers }),
    enabled: !!user && !!headers && !isAuthLoading,
  });

  const s = stats || { total_promoters: 0, active_promoters: 0, blocked_promoters: 0, entries_today: 0, blocked_today: 0, units_authorized: 0, plan_limit: 0, plan_usage: 0 };
  const activeEntries = (recentEntries || []).filter((e: any) => e.status === 'authorized' && !e.exit_at);
  const todaySchedule = schedule?.today || [];
  const tomorrowSchedule = schedule?.tomorrow || [];
  const weekSchedule = schedule?.week || [];

  const openIncidents = incidents.filter((i: any) => i.status !== 'resolved');
  const topScores = [...scores].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).slice(0, 5);
  const alertScores = scores.filter((s: any) => (s.score || 0) < 50);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo, {user?.name} — {format(new Date(), 'dd/MM/yyyy')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatsCard title="Promotores" value={s.total_promoters} icon={<Users className="h-5 w-5 text-primary" />} description={`${s.active_promoters} ativos`} />
        <StatsCard title="Em Campo Hoje" value={activeEntries.length} icon={<CheckCircle className="h-5 w-5 text-primary" />} />
        <StatsCard title="Bloqueios" value={s.blocked_today} icon={<XCircle className="h-5 w-5 text-destructive" />} />
        <StatsCard title="Unidades" value={s.units_authorized} icon={<Building2 className="h-5 w-5 text-primary" />} />
        <StatsCard title="Ocorrências" value={openIncidents.length} icon={<AlertTriangle className="h-5 w-5 text-destructive" />} description="abertas" />
        <StatsCard title="Score Médio" value={scores.length > 0 ? (scores.reduce((a: number, b: any) => a + (b.score || 0), 0) / scores.length).toFixed(0) : '—'} icon={<Star className="h-5 w-5 text-primary" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BLOCO 1 – Promotores ativos hoje */}
        <DashboardWidget title="📊 Promotores em Campo" icon={<Users className="h-4 w-4 text-primary" />}
          description={`${activeEntries.length} ativo(s)`}>
          <div className="space-y-2 max-h-80 overflow-auto">
            {activeEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum promotor em campo</p>
            ) : activeEntries.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{p.promoter_name || p.cpf}</p>
                  <p className="text-xs text-muted-foreground">{p.unit_name}</p>
                  {p.brands_attending && (
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {(Array.isArray(p.brands_attending) ? p.brands_attending : []).map((b: string) => (
                        <Badge key={b} variant="outline" className="text-[10px] px-1 py-0">{b}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Entrada: {p.entry_at ? format(new Date(p.entry_at), 'HH:mm') : ''}</p>
                  <p className="text-xs font-medium text-primary">{p.duration_so_far || '—'} min</p>
                </div>
              </div>
            ))}
          </div>
        </DashboardWidget>

        {/* BLOCO 2 – Agenda */}
        <DashboardWidget title="📅 Agenda" icon={<CalendarDays className="h-4 w-4 text-primary" />}>
          <Tabs value={scheduleTab} onValueChange={setScheduleTab}>
            <TabsList className="grid w-full grid-cols-3 mb-3">
              <TabsTrigger value="today">Hoje ({todaySchedule.length})</TabsTrigger>
              <TabsTrigger value="tomorrow">Amanhã ({tomorrowSchedule.length})</TabsTrigger>
              <TabsTrigger value="week">Semana ({weekSchedule.length})</TabsTrigger>
            </TabsList>
            {['today', 'tomorrow', 'week'].map(tab => {
              const items = tab === 'today' ? todaySchedule : tab === 'tomorrow' ? tomorrowSchedule : weekSchedule;
              return (
                <TabsContent key={tab} value={tab}>
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma visita</p>
                    ) : items.map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{v.promoter_name}</p>
                          <p className="text-xs text-muted-foreground">{v.unit_name} • {v.brand_name}</p>
                        </div>
                        <p className="text-xs font-medium">{v.scheduled_time}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </DashboardWidget>

        {/* BLOCO 3 – Ocorrências */}
        <DashboardWidget title="⚠️ Ocorrências" icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          description={`${openIncidents.length} aberta(s)`}>
          <div className="space-y-2 max-h-80 overflow-auto">
            {incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma ocorrência</p>
            ) : incidents.slice(0, 10).map((inc: any) => {
              const severityColor = inc.severity === 'high' ? 'text-destructive' : inc.severity === 'medium' ? 'text-orange-500' : 'text-yellow-500';
              return (
                <div key={inc.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted"
                  onClick={() => setSelectedIncident(inc)}>
                  <div>
                    <p className="text-sm font-medium">{inc.promoter_name || 'Promotor'}</p>
                    <p className="text-xs text-muted-foreground">{inc.unit_name} • {inc.description?.slice(0, 40)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inc.status === 'open' ? 'destructive' : inc.status === 'resolved' ? 'default' : 'secondary'} className="text-xs">
                      {inc.status === 'open' ? 'Aberta' : inc.status === 'resolved' ? 'Resolvida' : 'Em análise'}
                    </Badge>
                    <span className={`text-xs font-bold ${severityColor}`}>
                      {inc.severity === 'high' ? '●●●' : inc.severity === 'medium' ? '●●' : '●'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardWidget>

        {/* BLOCO 4 – Score */}
        <DashboardWidget title="⭐ Score dos Promotores" icon={<Star className="h-4 w-4 text-primary" />}>
          <div className="space-y-3">
            <p className="text-sm font-semibold">Ranking</p>
            <div className="space-y-1.5 max-h-40 overflow-auto">
              {topScores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Sem dados</p>
              ) : topScores.map((ps: any, i: number) => (
                <div key={ps.id || i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                    <span>{ps.promoter_name}</span>
                  </div>
                  <PromoterScoreBadge score={ps.score} showLabel />
                </div>
              ))}
            </div>
            {alertScores.length > 0 && (
              <>
                <p className="text-sm font-semibold text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Atenção ({alertScores.length})
                </p>
                <div className="space-y-1">
                  {alertScores.map((ps: any) => (
                    <div key={ps.id} className="flex items-center justify-between text-sm text-destructive">
                      <span>{ps.promoter_name}</span>
                      <PromoterScoreBadge score={ps.score} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </DashboardWidget>
      </div>

      {/* BLOCO 5 – Uso / cobrança */}
      <DashboardWidget title="💰 Uso / Cobrança" icon={<CreditCard className="h-4 w-4 text-primary" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-3xl font-bold text-primary">{s.active_promoters}</p>
            <p className="text-xs text-muted-foreground">Promotores Ativos</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-3xl font-bold text-foreground">{s.plan_limit || '∞'}</p>
            <p className="text-xs text-muted-foreground">Limite do Plano</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-3xl font-bold">{s.plan_limit ? `${Math.round((s.active_promoters / s.plan_limit) * 100)}%` : '—'}</p>
            <p className="text-xs text-muted-foreground">Consumo Atual</p>
          </div>
        </div>
      </DashboardWidget>

      {/* Incident Detail Dialog */}
      <IncidentDetailDialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}
        incident={selectedIncident} canRespond responderType="agency"
        responderName={user?.name}
        onRespond={(data) => respondIncident.mutate(data)} />
    </div>
  );
}
