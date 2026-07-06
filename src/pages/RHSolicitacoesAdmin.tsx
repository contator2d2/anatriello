import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Check, X, Clock, Eye } from "lucide-react";
import { toast } from "sonner";
import { useEmployeeRequestsAdmin, useUpdateEmployeeRequest, useChangeAlerts, useAckChangeAlert } from "@/hooks/use-rh-management";

const KIND_LABELS: Record<string, string> = {
  ferias: 'Férias',
  afastamento: 'Afastamento',
  vale_transporte: 'Vale-transporte',
  segunda_via_holerite: '2ª via de holerite',
  horas_extras: 'Horas extras',
  ajuste_ponto: 'Ajuste de ponto',
  atestado: 'Atestado',
  adiantamento_salarial: 'Adiantamento salarial',
  plano_saude: 'Plano de saúde',
  plano_odontologico: 'Plano odontológico',
};

const STATUS_STYLE: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-green-100 text-green-700',
  concluido: 'bg-blue-100 text-blue-700',
  recusado: 'bg-red-100 text-red-700',
};

export default function RHSolicitacoesAdmin() {
  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Solicitações e Alertas</h1>
          <p className="text-sm text-muted-foreground">Aprovar solicitações dos colaboradores e revisar alterações críticas.</p>
        </div>
        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">Solicitações</TabsTrigger>
            <TabsTrigger value="alerts">Alertas de alteração</TabsTrigger>
          </TabsList>
          <TabsContent value="requests"><RequestsPanel /></TabsContent>
          <TabsContent value="alerts"><AlertsPanel /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function RequestsPanel() {
  const [status, setStatus] = useState('pendente');
  const [kind, setKind] = useState<string>('');
  const { data: requests = [], isLoading } = useEmployeeRequestsAdmin({
    status: status || undefined, kind: kind || undefined
  });
  const update = useUpdateEmployeeRequest();
  const [viewing, setViewing] = useState<any>(null);
  const [notes, setNotes] = useState('');

  const act = async (id: string, newStatus: string, reviewer_notes?: string) => {
    try {
      await update.mutateAsync({ id, status: newStatus, reviewer_notes });
      toast.success('Atualizado');
      setViewing(null); setNotes('');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Select value={status || '__all__'} onValueChange={v => setStatus(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="aprovado">Aprovadas</SelectItem>
            <SelectItem value="concluido">Concluídas</SelectItem>
            <SelectItem value="recusado">Recusadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kind || '__all__'} onValueChange={v => setKind(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos tipos</SelectItem>
            {Object.entries(KIND_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && requests.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma solicitação</CardContent></Card>
        )}
        {requests.map((r: any) => {
          const p = r.payload || {};
          return (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{r.employee_name}</p>
                    <Badge variant="outline">{KIND_LABELS[r.kind] || r.kind}</Badge>
                    <Badge className={STATUS_STYLE[r.status] || ''}>{r.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.start_date && `Período: ${p.start_date}${p.end_date ? ` a ${p.end_date}` : ''} · `}
                    {p.amount && `Valor: R$ ${p.amount} · `}
                    {p.reason && `${String(p.reason).slice(0, 80)}${String(p.reason).length > 80 ? '…' : ''}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Criada em {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => { setViewing(r); setNotes(r.reviewer_notes || ''); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {r.status === 'pendente' && (
                    <>
                      <Button size="sm" onClick={() => act(r.id, 'aprovado')}>
                        <Check className="h-4 w-4 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => act(r.id, 'recusado')}>
                        <X className="h-4 w-4 mr-1" /> Recusar
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!viewing} onOpenChange={o => !o && setViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Detalhes da solicitação</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-2 text-sm">
              <p><b>Colaborador:</b> {viewing.employee_name}</p>
              <p><b>Tipo:</b> {KIND_LABELS[viewing.kind] || viewing.kind}</p>
              <p><b>Status:</b> {viewing.status}</p>
              <div className="p-2 bg-muted rounded text-xs">
                <b>Payload:</b>
                <pre className="whitespace-pre-wrap break-words">{JSON.stringify(viewing.payload, null, 2)}</pre>
              </div>
              <div>
                <label className="text-xs font-semibold">Notas do revisor</label>
                <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button>
            {viewing?.status === 'pendente' && (
              <>
                <Button variant="destructive" onClick={() => act(viewing.id, 'recusado', notes)}>Recusar</Button>
                <Button onClick={() => act(viewing.id, 'aprovado', notes)}>Aprovar</Button>
              </>
            )}
            {viewing?.status === 'aprovado' && (
              <Button onClick={() => act(viewing.id, 'concluido', notes)}>Marcar concluída</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlertsPanel() {
  const [ackFilter, setAckFilter] = useState<'false' | 'true' | 'all'>('false');
  const { data: alerts = [], isLoading } = useChangeAlerts(
    ackFilter === 'all' ? {} : { acknowledged: ackFilter === 'true' }
  );
  const ack = useAckChangeAlert();

  return (
    <div className="space-y-3">
      <Select value={ackFilter} onValueChange={v => setAckFilter(v as any)}>
        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="false">Pendentes</SelectItem>
          <SelectItem value="true">Revisados</SelectItem>
          <SelectItem value="all">Todos</SelectItem>
        </SelectContent>
      </Select>

      <div className="grid gap-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && alerts.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum alerta</CardContent></Card>
        )}
        {alerts.map((a: any) => (
          <Card key={a.id} className={a.acknowledged ? 'opacity-60' : 'border-amber-300'}>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{a.employee_name}</p>
                <p className="text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize mr-1">{a.alert_type.replace('_', ' ')}</Badge>
                  {a.field}: <s>{a.old_value || '—'}</s> → <b>{a.new_value || '—'}</b>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(a.created_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
              {!a.acknowledged && (
                <Button size="sm" onClick={async () => { await ack.mutateAsync(a.id); toast.success('Marcado como ciente'); }}>
                  <Check className="h-4 w-4 mr-1" /> Ciente
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
