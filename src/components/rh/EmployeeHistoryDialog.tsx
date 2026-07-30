import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  useEmployeeHistory, useAddHistoryEvent, useDeleteHistoryEvent, useReadmitEmployee,
  type HistoryEvent, type EmploymentPeriod,
} from "@/hooks/use-rh-history";
import {
  History, TrendingUp, Briefcase, DollarSign, Building2, UserMinus, UserPlus,
  Plus, Trash2, RotateCcw, CalendarDays,
} from "lucide-react";

const EVENT_META: Record<string, { label: string; icon: any; color: string }> = {
  admissao: { label: "Admissão", icon: UserPlus, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  readmissao: { label: "Readmissão", icon: RotateCcw, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  desligamento: { label: "Desligamento", icon: UserMinus, color: "bg-red-100 text-red-700 border-red-200" },
  promocao: { label: "Promoção", icon: TrendingUp, color: "bg-violet-100 text-violet-700 border-violet-200" },
  cargo: { label: "Mudança de cargo", icon: Briefcase, color: "bg-blue-100 text-blue-700 border-blue-200" },
  salario: { label: "Alteração salarial", icon: DollarSign, color: "bg-amber-100 text-amber-700 border-amber-200" },
  contrato: { label: "Tipo de contrato", icon: Briefcase, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  transferencia: { label: "Transferência", icon: Building2, color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  afastamento: { label: "Afastamento", icon: CalendarDays, color: "bg-orange-100 text-orange-700 border-orange-200" },
  retorno: { label: "Retorno", icon: CalendarDays, color: "bg-teal-100 text-teal-700 border-teal-200" },
  outro: { label: "Outro", icon: History, color: "bg-slate-100 text-slate-700 border-slate-200" },
};

const CONTRACT_LABELS: Record<string, string> = {
  clt: "CLT", pj: "PJ", freelancer: "Freelancer",
  temporario: "Temporário", estagiario: "Estagiário", aprendiz: "Aprendiz",
};

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = String(v).slice(0, 10).split("-");
  if (d.length !== 3) return String(v);
  return `${d[2]}/${d[1]}/${d[0]}`;
}

function fmtValue(field: string | null, value: string | null) {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "salary") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (field === "employment_type") return CONTRACT_LABELS[value] || value;
  return value;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId?: string;
  employeeName?: string;
}

export function EmployeeHistoryDialog({ open, onOpenChange, employeeId, employeeName }: Props) {
  const { data, isLoading } = useEmployeeHistory(open ? employeeId : undefined);
  const addEvent = useAddHistoryEvent(employeeId);
  const delEvent = useDeleteHistoryEvent(employeeId);
  const readmit = useReadmitEmployee(employeeId);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ event_type: "outro", title: "", description: "", effective_date: "" });
  const [readmitForm, setReadmitForm] = useState({ admission_date: "", employment_type: "", position: "", salary: "", notes: "" });

  const isTerminated = data?.employee?.status === "desligado";

  const submitEvent = async () => {
    if (!form.title.trim()) return toast.error("Informe um título para o evento");
    try {
      await addEvent.mutateAsync({ ...form, effective_date: form.effective_date || undefined });
      toast.success("Evento registrado na trilha");
      setForm({ event_type: "outro", title: "", description: "", effective_date: "" });
      setShowForm(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao registrar evento");
    }
  };

  const submitReadmit = async () => {
    if (!readmitForm.admission_date) return toast.error("Informe a data de readmissão");
    try {
      await readmit.mutateAsync({
        ...readmitForm,
        employment_type: readmitForm.employment_type || undefined,
        position: readmitForm.position || undefined,
        salary: readmitForm.salary || undefined,
      });
      toast.success("Colaborador readmitido — novo vínculo aberto");
      setReadmitForm({ admission_date: "", employment_type: "", position: "", salary: "", notes: "" });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao readmitir");
    }
  };

  const renderEvent = (ev: HistoryEvent) => {
    const meta = EVENT_META[ev.event_type] || EVENT_META.outro;
    const Icon = meta.icon;
    return (
      <div key={ev.id} className="relative pl-10 pb-5 last:pb-0">
        <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border bg-background">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
            <span className="text-sm font-medium">{ev.title || meta.label}</span>
            <span className="text-xs text-muted-foreground ml-auto">{fmtDate(ev.effective_date)}</span>
            {ev.source === "manual" && (
              <Button
                variant="ghost" size="icon" className="h-6 w-6"
                onClick={() => delEvent.mutate(ev.id)}
                title="Remover evento"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
          {(ev.old_value || ev.new_value) && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="line-through">{fmtValue(ev.field_name, ev.old_value)}</span>
              {" → "}
              <span className="font-semibold text-foreground">{fmtValue(ev.field_name, ev.new_value)}</span>
            </p>
          )}
          {ev.description && <p className="mt-1 text-xs text-muted-foreground">{ev.description}</p>}
          {ev.created_by_name && (
            <p className="mt-1 text-[11px] text-muted-foreground">Por {ev.created_by_name}</p>
          )}
        </div>
      </div>
    );
  };

  const renderPeriod = (p: EmploymentPeriod) => (
    <div key={p.id} className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Vínculo #{p.sequence}</Badge>
        <Badge className={p.status === "ativo" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
          {p.status === "ativo" ? "Em vigor" : "Encerrado"}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {fmtDate(p.start_date)} — {p.end_date ? fmtDate(p.end_date) : "atual"}
        </span>
      </div>
      <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <span>Cargo: <span className="text-foreground">{p.position || "—"}</span></span>
        <span>Contrato: <span className="text-foreground">{CONTRACT_LABELS[p.employment_type || ""] || p.employment_type || "—"}</span></span>
        <span>Salário: <span className="text-foreground">{fmtValue("salary", p.salary != null ? String(p.salary) : null)}</span></span>
        <span>Departamento: <span className="text-foreground">{p.department_name || "—"}</span></span>
        {p.company_name && <span>Empresa: <span className="text-foreground">{p.company_name}</span></span>}
        {p.termination_reason && <span className="sm:col-span-2">Motivo do desligamento: <span className="text-foreground">{p.termination_reason}</span></span>}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Trilha do colaborador
            {employeeName && <span className="text-sm font-normal text-muted-foreground">— {employeeName}</span>}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
            <TabsTrigger value="periods">Vínculos</TabsTrigger>
            <TabsTrigger value="readmit" disabled={!isTerminated}>Readmissão</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-3">
            <div className="mb-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)}>
                <Plus className="mr-1 h-4 w-4" /> Registrar evento
              </Button>
            </div>
            {showForm && (
              <div className="mb-4 space-y-3 rounded-lg border p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(EVENT_META).map(([k, m]) => (
                          <SelectItem key={k} value={k}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Título</Label>
                    <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex.: Promoção a Supervisor" />
                  </div>
                  <div>
                    <Label className="text-xs">Data de vigência</Label>
                    <Input type="date" value={form.effective_date} onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Observações</Label>
                    <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button size="sm" onClick={submitEvent} disabled={addEvent.isPending}>Salvar evento</Button>
                </div>
              </div>
            )}
            <ScrollArea className="max-h-[52vh] pr-2">
              {isLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
              ) : !data?.events?.length ? (
                <p className="p-4 text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
              ) : (
                <div className="relative">
                  <span className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />
                  {data.events.map(renderEvent)}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="periods" className="mt-3">
            <ScrollArea className="max-h-[60vh] pr-2">
              {isLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
              ) : !data?.periods?.length ? (
                <p className="p-4 text-sm text-muted-foreground">Nenhum vínculo registrado.</p>
              ) : (
                <div className="space-y-3">{data.periods.map(renderPeriod)}</div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="readmit" className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              A readmissão encerra o vínculo anterior e abre um novo, preservando todo o histórico.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Data de readmissão *</Label>
                <Input type="date" value={readmitForm.admission_date} onChange={e => setReadmitForm(f => ({ ...f, admission_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Tipo de contrato</Label>
                <Select value={readmitForm.employment_type} onValueChange={v => setReadmitForm(f => ({ ...f, employment_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Manter anterior" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTRACT_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cargo</Label>
                <Input value={readmitForm.position} onChange={e => setReadmitForm(f => ({ ...f, position: e.target.value }))} placeholder="Manter anterior" />
              </div>
              <div>
                <Label className="text-xs">Salário</Label>
                <Input type="number" step="0.01" value={readmitForm.salary} onChange={e => setReadmitForm(f => ({ ...f, salary: e.target.value }))} placeholder="Manter anterior" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Observações</Label>
                <Textarea rows={2} value={readmitForm.notes} onChange={e => setReadmitForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={submitReadmit} disabled={readmit.isPending}>
                <RotateCcw className="mr-1 h-4 w-4" /> Confirmar readmissão
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
