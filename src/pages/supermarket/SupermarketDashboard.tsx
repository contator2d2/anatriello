import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSupermarketAuth } from '@/contexts/SupermarketAuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DashboardWidget } from '@/components/dashboard/DashboardWidget';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PromoterScoreBadge } from '@/components/scores/PromoterScoreBadge';
import { IncidentCreateDialog } from '@/components/incidents/IncidentCreateDialog';
import { IncidentDetailDialog } from '@/components/incidents/IncidentDetailDialog';
import { useIncidents, usePromoterScores } from '@/hooks/use-incidents';
import DailySummaryWidget from '@/components/access-control/DailySummaryWidget';
import { Users, CheckCircle, XCircle, Clock, Tag, ShieldAlert, CalendarDays, CalendarPlus, Star, AlertTriangle, Plus, ScanFace, QrCode, Fingerprint, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

const getHeaders = () => {
  const t = localStorage.getItem('supermarket_auth_token');
  return t ? { Authorization: `Bearer ${t}` } : undefined;
};

const VALIDATION_ICONS: Record<string, any> = {
  cpf: CreditCard,
  qr: QrCode,
  selfie: ScanFace,
  facial: Fingerprint,
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500',
  en_route: 'bg-blue-500',
  waiting: 'bg-yellow-500',
};

export default function SupermarketDashboard() {
  const { user } = useSupermarketAuth();
  const [showCreateIncident, setShowCreateIncident] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const { incidents, createIncident, respondIncident, analyzeIncident } = useIncidents('supermarket');
  const { scores } = usePromoterScores('supermarket');

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

  const { data: schedule } = useQuery({
    queryKey: ['sm-schedule'],
    queryFn: () => api<any>('/api/access-control/supermarket-portal/schedule', { headers: getHeaders() }),
    enabled: !!user,
    refetchInterval: 120000,
  });

  const s = todayStats || { entries: 0, exits: 0, blocked: 0, avg_duration: 0, active_brands: 0, active_agencies: 0 };
  const promotersNow = live?.promoters_now || [];
  const brandsNow = live?.brands_now || [];
  const todaySchedule = schedule?.today || [];
  const tomorrowSchedule = schedule?.tomorrow || [];
  const alerts = live?.alerts || [];

  const topScores = [...scores].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).slice(0, 5);
  const avgScore = scores.length > 0 ? scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / scores.length : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* AI Daily Summary */}
      <DailySummaryWidget portal="supermarket" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel em Tempo Real</h1>
          <p className="text-muted-foreground">{user?.unit_name} — {format(new Date(), 'dd/MM/yyyy')}</p>
        </div>
        <Button onClick={() => setShowCreateIncident(true)} variant="destructive" size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Ocorrência
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatsCard title="Na Loja Agora" value={promotersNow.length} icon={<Users className="h-5 w-5 text-primary" />} />
        <StatsCard title="Entradas Hoje" value={s.entries} icon={<CheckCircle className="h-5 w-5 text-primary" />} />
        <StatsCard title="Bloqueios" value={s.blocked} icon={<XCircle className="h-5 w-5 text-destructive" />} />
        <StatsCard title="Tempo Médio" value={s.avg_duration ? `${s.avg_duration}m` : '—'} icon={<Clock className="h-5 w-5 text-primary" />} />
        <StatsCard title="Marcas Hoje" value={s.active_brands || brandsNow.length} icon={<Tag className="h-5 w-5 text-primary" />} />
        <StatsCard title="Score Médio" value={avgScore > 0 ? avgScore.toFixed(0) : '—'} icon={<Star className="h-5 w-5 text-primary" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BLOCO 1 – Quem está na loja AGORA */}
        <DashboardWidget title="🔴 Quem está na loja AGORA" icon={<Users className="h-4 w-4 text-primary" />}
          description={`${promotersNow.length} promotor(es) ativo(s)`}>
          <div className="space-y-2 max-h-80 overflow-auto">
            {promotersNow.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum promotor na loja</p>
            ) : promotersNow.map((p: any) => {
              const ValIcon = VALIDATION_ICONS[p.validation_method] || CreditCard;
              return (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {p.photo_url ? (
                        <img src={p.photo_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {p.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${STATUS_COLORS[p.status] || 'bg-gray-400'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.agency_name || 'Interno'}</p>
                      {p.brands_attending && (
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {(Array.isArray(p.brands_attending) ? p.brands_attending : []).map((b: string) => (
                            <Badge key={b} variant="outline" className="text-[10px] px-1 py-0">{b}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="text-xs text-muted-foreground">Entrada: {p.entry_time}</p>
                    <p className="text-xs font-medium text-primary">{p.duration_so_far} min</p>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <ValIcon className="h-3 w-3" /> {p.validation_method?.toUpperCase() || 'CPF'}
                    </Badge>
                    {p.score != null && <PromoterScoreBadge score={p.score} />}
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardWidget>

        {/* BLOCO 2 – Marcas sendo atendidas hoje */}
        <DashboardWidget title="🟡 Marcas Atendidas Hoje" icon={<Tag className="h-4 w-4 text-primary" />}
          description={`${brandsNow.length} marca(s)`}>
          <div className="space-y-2 max-h-80 overflow-auto">
            {brandsNow.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma marca hoje</p>
            ) : brandsNow.map((b: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{b.brand_name}</p>
                  <p className="text-xs text-muted-foreground">{b.agency_name || 'Interno'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{b.promoter_count} promotor(es)</Badge>
                  <Badge variant={b.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                    {b.status === 'completed' ? 'Finalizado' : b.status === 'in_progress' ? 'Em andamento' : 'Iniciado'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DashboardWidget>

        {/* BLOCO 3 – Agenda do dia */}
        <DashboardWidget title="🔵 Agenda de Hoje" icon={<CalendarDays className="h-4 w-4 text-primary" />}
          description={`${todaySchedule.length} visita(s) prevista(s)`}>
          <div className="space-y-2 max-h-80 overflow-auto">
            {todaySchedule.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma visita agendada</p>
            ) : todaySchedule.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{v.promoter_name}</p>
                  <p className="text-xs text-muted-foreground">{v.agency_name} • {v.brand_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium">{v.scheduled_time}</p>
                  <Badge variant={v.arrival_status === 'arrived' ? 'default' : v.arrival_status === 'late' ? 'destructive' : 'secondary'} className="text-xs">
                    {v.arrival_status === 'arrived' ? 'Chegou' : v.arrival_status === 'late' ? 'Atrasado' : 'Não chegou'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DashboardWidget>

        {/* BLOCO 4 – Agenda de amanhã */}
        <DashboardWidget title="🟣 Agenda de Amanhã" icon={<CalendarPlus className="h-4 w-4 text-primary" />}
          description={`${tomorrowSchedule.length} visita(s)`}>
          <div className="space-y-2 max-h-80 overflow-auto">
            {tomorrowSchedule.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma visita agendada</p>
            ) : tomorrowSchedule.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{v.promoter_name}</p>
                  <p className="text-xs text-muted-foreground">{v.agency_name} • {v.brand_name}</p>
                </div>
                <p className="text-xs font-medium">{v.scheduled_time}</p>
              </div>
            ))}
          </div>
        </DashboardWidget>
      </div>

      {/* BLOCO 5 – Alertas */}
      <DashboardWidget title="⚠️ Alertas" icon={<ShieldAlert className="h-4 w-4 text-destructive" />}
        description={`${alerts.length + (s.blocked || 0)} alerta(s)`}>
        <div className="space-y-2 max-h-64 overflow-auto">
          {alerts.length === 0 && !s.blocked ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta no momento ✓</p>
          ) : (
            <>
              {alerts.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded bg-destructive/5 border border-destructive/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{a.promoter_name || a.cpf}</p>
                      <p className="text-xs text-muted-foreground">{a.alert_type_label || a.reason}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.time}</p>
                </div>
              ))}
              {(live?.blocked_today || []).map((b: any) => (
                <div key={b.id} className="flex items-center justify-between p-2 rounded bg-destructive/5 border border-destructive/20">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{b.name || b.cpf}</p>
                      <p className="text-xs text-muted-foreground">{b.block_reason_label}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{b.time}</p>
                </div>
              ))}
            </>
          )}
        </div>
      </DashboardWidget>

      {/* BLOCO 6 – Score geral */}
      <DashboardWidget title="⭐ Score Geral" icon={<Star className="h-4 w-4 text-primary" />}
        description="Ranking e desempenho">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <p className="text-3xl font-bold text-primary">{avgScore > 0 ? avgScore.toFixed(0) : '—'}</p>
            <p className="text-xs text-muted-foreground">Score médio do dia</p>
          </div>
          <div className="col-span-2">
            <p className="text-sm font-semibold mb-2">Top 5 Promotores</p>
            <div className="space-y-1.5">
              {topScores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Sem dados</p>
              ) : topScores.map((ps: any, i: number) => (
                <div key={ps.id || i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                    <span>{ps.promoter_name}</span>
                    <span className="text-xs text-muted-foreground">({ps.agency_name})</span>
                  </div>
                  <PromoterScoreBadge score={ps.score} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardWidget>

      {/* Ocorrências recentes */}
      {incidents.length > 0 && (
        <DashboardWidget title="Ocorrências Recentes" icon={<AlertTriangle className="h-4 w-4 text-destructive" />}>
          <div className="space-y-2 max-h-64 overflow-auto">
            {incidents.slice(0, 5).map((inc: any) => (
              <div key={inc.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted"
                onClick={() => setSelectedIncident(inc)}>
                <div>
                  <p className="text-sm font-medium">{inc.promoter_name || 'Promotor'}</p>
                  <p className="text-xs text-muted-foreground">{inc.description?.slice(0, 60)}</p>
                </div>
                <Badge variant={inc.status === 'open' ? 'destructive' : inc.status === 'resolved' ? 'default' : 'secondary'} className="text-xs">
                  {inc.status === 'open' ? 'Aberta' : inc.status === 'resolved' ? 'Resolvida' : 'Em análise'}
                </Badge>
              </div>
            ))}
          </div>
        </DashboardWidget>
      )}

      {/* Dialogs */}
      <IncidentCreateDialog open={showCreateIncident} onOpenChange={setShowCreateIncident}
        promoters={promotersNow.map((p: any) => ({ id: p.promoter_id || p.id, name: p.name, agency_name: p.agency_name }))}
        onSubmit={(data) => { createIncident.mutate(data); setShowCreateIncident(false); }}
        isSubmitting={createIncident.isPending} />

      <IncidentDetailDialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}
        incident={selectedIncident} canRespond responderType="supermarket"
        responderName={user?.unit_name}
        onRespond={(data) => respondIncident.mutate(data)}
        onAnalyze={(id) => analyzeIncident.mutate(id)}
        isAnalyzing={analyzeIncident.isPending} />
    </div>
  );
}
