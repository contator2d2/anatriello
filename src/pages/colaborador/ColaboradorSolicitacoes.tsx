import { useState } from "react";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { useColabRequests, useColabCreateRequest, useColabAdjustmentRequests, useColabCreateAdjustmentRequest } from "@/hooks/use-promotor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Umbrella, HeartPulse, Bus, FileText, Clock, Edit3, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const KIND_META: Record<string, { label: string; icon: any; color: string }> = {
  ferias: { label: "Férias", icon: Umbrella, color: "#06b6d4" },
  afastamento: { label: "Afastamento", icon: HeartPulse, color: "#f43f5e" },
  vale_transporte: { label: "Vale-transporte", icon: Bus, color: "#8b5cf6" },
  segunda_via_holerite: { label: "2ª via de holerite", icon: FileText, color: "#3b82f6" },
  horas_extras: { label: "Horas Extras", icon: Clock, color: "#f59e0b" },
  ajuste_ponto: { label: "Ajuste de Ponto", icon: Edit3, color: "#10b981" },
  atestado: { label: "Atestado", icon: HeartPulse, color: "#ef4444" },
};
const STATUS_STYLE: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700",
  aprovado: "bg-green-100 text-green-700",
  concluido: "bg-blue-100 text-blue-700",
  recusado: "bg-red-100 text-red-700",
};

export default function ColaboradorSolicitacoes() {
  const [tab, setTab] = useState<"minhas" | "historico">("minhas");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("ferias");
  const [form, setForm] = useState<any>({});
  const { data: requests, isLoading } = useColabRequests();
  const { data: adjRequests = [] } = useColabAdjustmentRequests();
  const create = useColabCreateRequest();
  const createAdj = useColabCreateAdjustmentRequest();
  const { toast } = useToast();

  const mergedRequests = [
    ...(requests || []),
    ...adjRequests.map((r: any) => ({
      id: `adj_${r.id}`,
      kind: 'ajuste_ponto',
      status: r.status === 'approved' ? 'concluido' : r.status === 'rejected' ? 'recusado' : 'pendente',
      created_at: r.created_at,
      payload: { start_date: r.punch_date, reason: `${r.requested_times || ''} — ${r.justification}` },
    })),
  ];
  const list = mergedRequests.filter((r: any) =>
    tab === "minhas" ? ["pendente", "aprovado"].includes(r.status) : ["concluido", "recusado"].includes(r.status)
  );

  async function submit() {
    try {
      if (kind === 'ajuste_ponto') {
        const times = (form.times || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        await createAdj.mutateAsync({
          punch_date: form.start_date,
          requested_times: times,
          justification: form.reason || 'Ajuste solicitado',
        });
      } else {
        await create.mutateAsync({ kind, payload: form });
      }
      toast({ title: "Solicitação enviada" });
      setOpen(false); setForm({});
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  }

  return (
    <ColaboradorLayout bg="light" title="Solicitações" rightSlot={
      <button onClick={() => setOpen(true)} className="h-8 w-8 rounded-full bg-[#f97316] text-white flex items-center justify-center">
        <Plus className="h-4 w-4" />
      </button>
    }>
      <div className="px-4 pt-4">
        <div className="flex gap-6 border-b border-slate-200">
          {(["minhas", "historico"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "pb-2 text-sm font-semibold border-b-2 -mb-px transition",
                tab === t ? "border-[#f97316] text-[#f97316]" : "border-transparent text-slate-400"
              )}
            >
              {t === "minhas" ? "Minhas solicitações" : "Histórico"}
            </button>
          ))}
        </div>

        <div className="space-y-3 mt-4">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />}
          {list.length === 0 && !isLoading && (
            <p className="text-center text-xs text-slate-400 py-8">Nenhuma solicitação</p>
          )}
          {list.map((r: any) => {
            const m = KIND_META[r.kind] || { label: r.kind, icon: FileText, color: "#64748b" };
            const p = r.payload || {};
            return (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm flex gap-3">
                <div className="h-12 w-12 rounded-2xl flex-shrink-0 flex items-center justify-center" style={{ background: `${m.color}15`, color: m.color }}>
                  <m.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{m.label}</p>
                  {(p.start_date || p.end_date) && (
                    <p className="text-xs text-slate-500 mt-0.5">Período: {p.start_date} a {p.end_date}</p>
                  )}
                  {p.reason && <p className="text-xs text-slate-500 mt-0.5 truncate">{p.reason}</p>}
                  <p className="text-[10px] text-slate-400 mt-1">Solicitado em {format(new Date(r.created_at), "dd/MM/yyyy")}</p>
                </div>
                <span className={cn("h-fit text-[10px] px-2 py-1 rounded-full font-semibold capitalize", STATUS_STYLE[r.status] || "bg-slate-100 text-slate-500")}>
                  {r.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova solicitação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {["ferias", "afastamento", "atestado", "horas_extras"].includes(kind) && (
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Data início</Label><Input type="date" value={form.start_date || ""} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>Data fim</Label><Input type="date" value={form.end_date || ""} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
            )}
            {kind === "ajuste_ponto" && (
              <>
                <div>
                  <Label>Data do ponto</Label>
                  <Input type="date" value={form.start_date || ""} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>Horários corretos (separe por vírgula)</Label>
                  <Input placeholder="08:00, 12:00, 13:00, 17:00" value={form.times || ""} onChange={e => setForm({ ...form, times: e.target.value })} />
                  <p className="text-[10px] text-slate-400 mt-1">Ex: entrada, saída almoço, retorno, saída</p>
                </div>
              </>
            )}
            <div>
              <Label>Motivo / observações</Label>
              <Textarea rows={3} value={form.reason || ""} onChange={e => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending} className="bg-[#f97316] hover:bg-[#ea580c]">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ColaboradorLayout>
  );
}
