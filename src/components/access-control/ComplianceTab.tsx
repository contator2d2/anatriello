import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, AlertTriangle, Brain, CheckCircle2, XCircle, Activity } from 'lucide-react';

interface ComplianceMetrics {
  totals: {
    total: number; approved: number; rejected: number; divergent: number;
    pre_approved: number; failed: number; auto_applied: number; overridden: number;
    avg_score: string | number | null;
  };
  agreement: {
    reviewed_after_ai: number; agreed_approve: number; agreed_reject: number;
    false_positive: number; false_negative: number;
  };
  top_divergences: { field: string; count: number }[];
}

export default function ComplianceTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useQuery<ComplianceMetrics>({
    queryKey: ['compliance-metrics', from, to],
    queryFn: () => {
      const p = new URLSearchParams();
      if (from) p.append('from', from);
      if (to) p.append('to', to);
      const qs = p.toString();
      return api(`/api/promoter-validations/compliance/metrics${qs ? '?' + qs : ''}`);
    },
  });

  if (isLoading) {
    return <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const t = data?.totals;
  const a = data?.agreement;
  const reviewed = a?.reviewed_after_ai || 0;
  const agreed = (a?.agreed_approve || 0) + (a?.agreed_reject || 0);
  const accuracy = reviewed > 0 ? Math.round((agreed / reviewed) * 100) : null;
  const autoRate = t && t.total > 0 ? Math.round(((t.auto_applied || 0) / t.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" /> Compliance & Auditoria da IA
          </CardTitle>
          <p className="text-xs text-muted-foreground">Acompanhe a performance e a precisão da análise automática de documentos.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard icon={<Activity className="h-4 w-4 text-primary" />} label="Total de análises" value={t?.total ?? 0} />
            <MetricCard icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} label="Aprovadas" value={t?.approved ?? 0} />
            <MetricCard icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} label="Divergentes" value={t?.divergent ?? 0} />
            <MetricCard icon={<XCircle className="h-4 w-4 text-destructive" />} label="Rejeitadas" value={t?.rejected ?? 0} />
            <MetricCard icon={<Brain className="h-4 w-4 text-primary" />} label="Auto-aprovação IA" value={`${autoRate}%`} hint={`${t?.auto_applied ?? 0} de ${t?.total ?? 0}`} />
            <MetricCard icon={<ShieldCheck className="h-4 w-4 text-primary" />} label="Score médio" value={t?.avg_score != null ? Number(t.avg_score).toFixed(1) : '—'} />
            <MetricCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Concordância humano" value={accuracy != null ? `${accuracy}%` : '—'} hint={`${agreed}/${reviewed} revisões`} />
            <MetricCard icon={<XCircle className="h-4 w-4 text-orange-600" />} label="Falsos positivos" value={a?.false_positive ?? 0} hint="IA aprovou, humano rejeitou" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Concordância IA × Humano</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Revisões manuais após IA" value={reviewed} />
                <Row label="Concordou em aprovar" value={a?.agreed_approve ?? 0} good />
                <Row label="Concordou em rejeitar" value={a?.agreed_reject ?? 0} good />
                <Row label="IA aprovou, humano rejeitou (falso +)" value={a?.false_positive ?? 0} bad />
                <Row label="IA rejeitou, humano aprovou (falso −)" value={a?.false_negative ?? 0} bad />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top divergências detectadas</CardTitle></CardHeader>
              <CardContent>
                {(!data?.top_divergences || data.top_divergences.length === 0) ? (
                  <p className="text-xs text-muted-foreground">Nenhuma divergência registrada no período.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.top_divergences.map(d => (
                      <li key={d.field} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{d.field.replace(/_/g, ' ')}</span>
                        <Badge variant="secondary">{d.count}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: any; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function Row({ label, value, good, bad }: { label: string; value: number; good?: boolean; bad?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={bad ? 'destructive' : good ? 'default' : 'secondary'}>{value}</Badge>
    </div>
  );
}
