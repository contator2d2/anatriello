import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ClipboardList, Lock, LockOpen, Plus, Trash2, AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  usePayrollChecklists, usePayrollChecklist, useCreatePayrollChecklist,
  useUpdateChecklistItem, useAddChecklistItem, useDeleteChecklistItem,
  useClosePayrollChecklist, useReopenPayrollChecklist,
  useChangeAlerts, useAckChangeAlert,
} from "@/hooks/use-rh-management";

const CAT_COLORS: Record<string, string> = {
  cargo: '#3b82f6', salario: '#10b981', vale: '#f59e0b',
  plano_saude: '#ef4444', plano_odonto: '#a855f7',
  horas_extras: '#0ea5e9', faltas: '#f97316', ferias: '#06b6d4',
  vale_transporte: '#8b5cf6', adiantamento: '#eab308',
  uniformes: '#64748b', fechamento: '#22c55e',
};

const monthLabel = (iso: string) => {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  const names = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${names[parseInt(m,10)-1]}/${y}`;
};

export default function RHChecklistFolha() {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <MainLayout>
      {openId ? <ChecklistDetail id={openId} onBack={() => setOpenId(null)} /> : <ChecklistList onOpen={setOpenId} />}
    </MainLayout>
  );
}

function ChecklistList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: checklists = [], isLoading } = usePayrollChecklists();
  const { data: unackAlerts = [] } = useChangeAlerts({ acknowledged: false });
  const create = useCreatePayrollChecklist();
  const [openNew, setOpenNew] = useState(false);
  const [ref, setRef] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });

  const submit = async () => {
    try {
      const c = await create.mutateAsync({ reference_month: `${ref}-01` });
      toast.success('Checklist criado');
      setOpenNew(false);
      onOpen(c.id);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Checklist e Fechamento de Folha</h1>
          <p className="text-sm text-muted-foreground">Checklist mensal de conferência antes do fechamento.</p>
        </div>
        <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo mês</Button>
      </div>

      {unackAlerts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">{unackAlerts.length} alerta(s) de alteração pendente(s)</p>
              <p className="text-xs text-amber-700">Cargo, salário, vales ou plano de saúde alterados que ainda não foram revisados.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && checklists.length === 0 && (
          <Card className="col-span-full"><CardContent className="py-10 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-40" />
            Nenhum checklist criado. Clique em "Novo mês" para começar.
          </CardContent></Card>
        )}
        {checklists.map((c: any) => {
          const total = Number(c.total_items) || 0;
          const done = Number(c.done_items) || 0;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <Card key={c.id} className="cursor-pointer hover:border-primary/40 transition" onClick={() => onOpen(c.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize">{monthLabel(c.reference_month)}</CardTitle>
                  <Badge variant={c.status === 'fechado' ? 'secondary' : 'default'} className="gap-1">
                    {c.status === 'fechado' ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                    {c.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{done} / {total} concluídos</span>
                  <span>{pct}%</span>
                </div>
                <Progress value={pct} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo checklist mensal</DialogTitle></DialogHeader>
          <div>
            <Label>Mês de referência</Label>
            <Input type="month" value={ref} onChange={e => setRef(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChecklistDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading } = usePayrollChecklist(id);
  const upd = useUpdateChecklistItem();
  const add = useAddChecklistItem();
  const del = useDeleteChecklistItem();
  const close = useClosePayrollChecklist();
  const reopen = useReopenPayrollChecklist();
  const ackAlert = useAckChangeAlert();
  const [newLabel, setNewLabel] = useState('');

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const items = data.items || [];
  const alerts = data.alerts || [];
  const done = items.filter((i: any) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const isClosed = data.status === 'fechado';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold capitalize">{monthLabel(data.reference_month)}</h1>
          <p className="text-xs text-muted-foreground">{done} / {items.length} concluídos ({pct}%)</p>
        </div>
        {isClosed ? (
          <Button variant="outline" onClick={async () => { await reopen.mutateAsync(id); toast.success('Reaberto'); }}>
            <LockOpen className="h-4 w-4 mr-1" /> Reabrir
          </Button>
        ) : (
          <Button onClick={async () => {
            if (!confirm('Fechar folha deste mês? Você pode reabrir depois.')) return;
            await close.mutateAsync(id); toast.success('Folha fechada');
          }}>
            <Lock className="h-4 w-4 mr-1" /> Fechar folha
          </Button>
        )}
      </div>

      <Progress value={pct} />

      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Alterações do mês ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a: any) => (
              <div key={a.id} className={`p-3 rounded-lg border flex items-center gap-3 text-sm ${a.acknowledged ? 'opacity-60' : ''}`}>
                <div className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[a.alert_type] || '#64748b' }} />
                <div className="flex-1">
                  <p className="font-medium">{a.employee_name}</p>
                  <p className="text-xs text-muted-foreground">
                    <b className="capitalize">{a.alert_type.replace('_',' ')}</b> — {a.field}: {a.old_value || '—'} → {a.new_value || '—'}
                  </p>
                </div>
                {!a.acknowledged && (
                  <Button size="sm" variant="outline" onClick={async () => {
                    await ackAlert.mutateAsync(a.id); toast.success('Ciente');
                  }}>Ciente</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Checklist</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.map((it: any) => (
            <div key={it.id} className="flex items-start gap-3 p-3 rounded-lg border">
              <Checkbox
                checked={it.done}
                disabled={isClosed}
                onCheckedChange={async (v) => {
                  await upd.mutateAsync({ checklistId: id, itemId: it.id, done: !!v });
                }}
              />
              <div className="flex-1">
                <p className={`text-sm ${it.done ? 'line-through text-muted-foreground' : ''}`}>{it.label}</p>
                {it.category && (
                  <Badge variant="outline" className="text-[10px] mt-1" style={{ color: CAT_COLORS[it.category] || '#64748b' }}>
                    {it.category}
                  </Badge>
                )}
                <Textarea
                  placeholder="Notas…"
                  rows={1}
                  className="mt-2 text-xs"
                  defaultValue={it.notes || ''}
                  disabled={isClosed}
                  onBlur={e => {
                    if (e.target.value !== (it.notes || '')) {
                      upd.mutate({ checklistId: id, itemId: it.id, notes: e.target.value });
                    }
                  }}
                />
              </div>
              {!isClosed && (
                <Button variant="ghost" size="icon" onClick={async () => {
                  if (!confirm('Remover item?')) return;
                  await del.mutateAsync({ checklistId: id, itemId: it.id });
                }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          {!isClosed && (
            <div className="flex gap-2 pt-2">
              <Input placeholder="Adicionar item ao checklist…" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
              <Button onClick={async () => {
                if (!newLabel.trim()) return;
                await add.mutateAsync({ checklistId: id, label: newLabel });
                setNewLabel('');
              }}><Plus className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
