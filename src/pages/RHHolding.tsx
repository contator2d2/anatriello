import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, Building2, AlertTriangle, FileCheck2, Check, X, Clock, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface DashboardData {
  date: string;
  totals: {
    active_employees: number;
    pending_adjustments: number;
    pending_deliveries: number;
    active_companies: number;
  };
  companies: Array<{
    id: string; name: string; color?: string; is_active: boolean;
    active_employees: number; pending_adjustments: number; pending_deliveries: number;
    punch_facial_required: boolean;
  }>;
  alerts: Array<{
    kind: string; id: string; employee_name: string; company_name: string;
    detail: string; created_at: string;
  }>;
}

interface Adjustment {
  id: string; employee_name: string; company_name: string; type: string;
  punch_date: string; justification: string; status: string; created_at: string;
  review_note?: string;
}

interface Delivery {
  id: string; employee_name: string; company_name: string;
  title: string; status: string; sent_at: string; read_at?: string; signed_at?: string;
}

export default function RHHolding() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [d, a, dl] = await Promise.all([
        api<DashboardData>('/api/holding/dashboard'),
        api<Adjustment[]>('/api/holding/adjustments?status=pending'),
        api<Delivery[]>('/api/holding/deliveries'),
      ]);
      setData(d); setAdjustments(a); setDeliveries(dl);
    } catch (err: any) { toast.error(err.message || 'Erro ao carregar'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const review = async (id: string, status: 'approved' | 'rejected') => {
    setBusyId(id);
    try {
      await api(`/api/holding/adjustments/${id}`, { method: 'PATCH', body: { status } });
      toast.success(status === 'approved' ? 'Ajuste aprovado' : 'Ajuste rejeitado');
      await load();
    } catch (err: any) { toast.error(err.message); }
    finally { setBusyId(null); }
  };

  if (loading) return <MainLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div></MainLayout>;

  const t = data?.totals || { active_employees: 0, pending_adjustments: 0, pending_deliveries: 0, active_companies: 0 };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Dashboard da Holding
          </h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de todas as empresas do grupo.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI icon={<Building2 />} label="Empresas ativas" value={t.active_companies} />
          <KPI icon={<Users />} label="Colaboradores" value={t.active_employees} />
          <KPI icon={<AlertTriangle className="text-amber-500" />} label="Ajustes pendentes" value={t.pending_adjustments} />
          <KPI icon={<FileCheck2 />} label="Docs. não lidos" value={t.pending_deliveries} />
        </div>

        {/* Por empresa */}
        <Card>
          <CardHeader><CardTitle>Por empresa</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data?.companies.map(c => (
                <div key={c.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: c.color || '#3B82F6' }} />
                    <h3 className="font-semibold flex-1">{c.name}</h3>
                    {c.is_active ? <Badge variant="outline" className="text-xs">Ativa</Badge> : <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div><div className="text-lg font-bold">{c.active_employees}</div><div className="text-xs text-muted-foreground">Ativos</div></div>
                    <div><div className="text-lg font-bold text-amber-600">{c.pending_adjustments}</div><div className="text-xs text-muted-foreground">Ajustes</div></div>
                    <div><div className="text-lg font-bold text-blue-600">{c.pending_deliveries}</div><div className="text-xs text-muted-foreground">Docs</div></div>
                  </div>
                  {c.punch_facial_required && <Badge className="text-[10px]" variant="outline">Facial obrigatória</Badge>}
                </div>
              ))}
              {!data?.companies.length && <p className="col-span-full text-center text-sm text-muted-foreground py-6">Nenhuma empresa cadastrada</p>}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="adjustments">
          <TabsList>
            <TabsTrigger value="adjustments">Ajustes de ponto ({adjustments.length})</TabsTrigger>
            <TabsTrigger value="deliveries">Entregas de documentos</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
          </TabsList>

          <TabsContent value="adjustments" className="space-y-2">
            {adjustments.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Nenhum ajuste pendente 🎉</p>}
            {adjustments.map(a => (
              <Card key={a.id}>
                <CardContent className="pt-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{a.employee_name}</span>
                      <Badge variant="outline" className="text-xs">{a.company_name}</Badge>
                      <Badge variant="secondary" className="text-xs">{a.type}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />{new Date(a.punch_date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{a.justification}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => review(a.id, 'rejected')} disabled={busyId === a.id}>
                      <X className="h-4 w-4 mr-1" /> Rejeitar
                    </Button>
                    <Button size="sm" onClick={() => review(a.id, 'approved')} disabled={busyId === a.id}>
                      <Check className="h-4 w-4 mr-1" /> Aprovar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="deliveries" className="space-y-2">
            {deliveries.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Nenhuma entrega registrada</p>}
            {deliveries.map(d => (
              <Card key={d.id}>
                <CardContent className="pt-4 flex items-center gap-3">
                  <FileCheck2 className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{d.title}</span>
                      <Badge variant="outline" className="text-xs">{d.company_name}</Badge>
                      <span className="text-xs text-muted-foreground">→ {d.employee_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Enviado {new Date(d.sent_at).toLocaleString('pt-BR')}
                      {d.read_at && ` · lido ${new Date(d.read_at).toLocaleString('pt-BR')}`}
                      {d.signed_at && ` · assinado ${new Date(d.signed_at).toLocaleString('pt-BR')}`}
                    </div>
                  </div>
                  <Badge variant={d.status === 'signed' ? 'default' : d.status === 'read' ? 'secondary' : 'outline'}>{d.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="alerts" className="space-y-2">
            {(!data?.alerts.length) && <p className="text-center text-sm text-muted-foreground py-6">Sem alertas no momento</p>}
            {data?.alerts.map(a => (
              <Card key={a.id}>
                <CardContent className="pt-4 flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{a.employee_name}</span>
                    <span className="text-muted-foreground"> · {a.company_name} · {a.detail}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString('pt-BR')}</span>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
