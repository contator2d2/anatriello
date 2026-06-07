import { useNetworkDashboard, useNetworkUnits } from '@/hooks/use-network-portal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Store, Users, Tag, Ban, UserCheck, ClipboardPlus, Activity, Loader2 } from 'lucide-react';

const PARTNER_LABELS: Record<string, string> = {
  agency: 'Agências',
  installer: 'Instaladores',
  maintenance: 'Manutenção',
  other: 'Outros',
};

export default function NetworkDashboard() {
  const { data: d, isLoading } = useNetworkDashboard();
  const { data: units = [] } = useNetworkUnits();

  if (isLoading || !d) {
    return <div className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const partnersTotal = d.partners_by_type.reduce((s, p) => s + p.c, 0);
  const topUnits = [...units].sort((a, b) => b.entries_today - a.entries_today).slice(0, 6);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard 360°</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada de todos os PDVs da rede.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Store} label="PDVs ativos" value={`${d.units.active}/${d.units.total}`} hint={`${d.units.inactive} inativos`} />
        <KpiCard icon={UserCheck} label="Promotores ativos" value={d.total_active_promoters} />
        <KpiCard icon={Tag} label="Marcas atendidas" value={d.total_brands} />
        <KpiCard icon={Users} label="Parceiros" value={partnersTotal} />
        <KpiCard icon={Activity} label="Entradas hoje" value={d.entries.today} hint={`${d.entries.week} na semana`} />
        <KpiCard icon={Ban} label="Bloqueios ativos" value={d.active_blocks} variant={d.active_blocks > 0 ? 'destructive' : undefined} />
        <KpiCard icon={ClipboardPlus} label="Solicitações de PDV" value={d.pending_inauguration_requests} hint="pendentes" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Parceiros por tipo</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {d.partners_by_type.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem parceiros cadastrados.</p>
            ) : d.partners_by_type.map(p => (
              <div key={p.partner_type} className="flex justify-between items-center">
                <span className="text-sm">{PARTNER_LABELS[p.partner_type] || p.partner_type}</span>
                <Badge variant="secondary">{p.c}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">PDVs com mais entradas hoje</CardTitle></CardHeader>
          <CardContent>
            {topUnits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="space-y-2">
                {topUnits.map(u => (
                  <div key={u.id} className="flex justify-between items-center text-sm">
                    <span className="truncate">{u.name}</span>
                    <Badge variant="outline">{u.entries_today}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint, variant }: any) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-semibold ${variant === 'destructive' ? 'text-destructive' : ''}`}>{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
          </div>
          <Icon className={`h-5 w-5 ${variant === 'destructive' ? 'text-destructive' : 'text-primary'}`} />
        </div>
      </CardContent>
    </Card>
  );
}
