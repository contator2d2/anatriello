import { useState } from "react";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { useColabRequests, useColabAdjustmentRequests, useColabCreateRequest } from "@/hooks/use-promotor";
import { promotorApi } from "@/hooks/use-promotor";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import {
  Umbrella, HeartPulse, Bus, FileText, Clock, Edit3, Loader2, Wallet, Smile, Bell,
  Plus, Paperclip, Camera, X, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const KIND_META: Record<string, { label: string; icon: any; color: string }> = {
  ferias: { label: "Férias", icon: Umbrella, color: "#06b6d4" },
  afastamento: { label: "Afastamento", icon: HeartPulse, color: "#f43f5e" },
  vale_transporte: { label: "Vale-transporte", icon: Bus, color: "#8b5cf6" },
  adiantamento_salarial: { label: "Adiantamento salarial", icon: Wallet, color: "#eab308" },
  plano_saude: { label: "Plano de saúde", icon: HeartPulse, color: "#ef4444" },
  plano_odontologico: { label: "Plano odontológico", icon: Smile, color: "#a855f7" },
  segunda_via_holerite: { label: "2ª via de holerite", icon: FileText, color: "#3b82f6" },
  horas_extras: { label: "Horas Extras", icon: Clock, color: "#f59e0b" },
  ajuste_ponto: { label: "Ajuste de Ponto", icon: Edit3, color: "#10b981" },
  atestado: { label: "Atestado médico", icon: HeartPulse, color: "#ef4444" },
  outros: { label: "Outros", icon: FileText, color: "#64748b" },
};

// Tipos disponíveis para criação (mais comuns na vida do colaborador)
const CREATABLE_KINDS: Array<{ kind: string; needsPeriod?: boolean; needsAttachment?: boolean; description: string }> = [
  { kind: "atestado", needsPeriod: true, needsAttachment: true, description: "Envie o atestado médico" },
  { kind: "afastamento", needsPeriod: true, needsAttachment: true, description: "Solicitar afastamento" },
  { kind: "vale_transporte", description: "Ativar/atualizar VT" },
  { kind: "adiantamento_salarial", description: "Solicitar adiantamento" },
  { kind: "plano_saude", description: "Solicitar/atualizar plano" },
  { kind: "plano_odontologico", description: "Solicitar plano odonto" },
  { kind: "segunda_via_holerite", description: "Pedir 2ª via" },
  { kind: "outros", description: "Outra solicitação" },
];

const STATUS_STYLE: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700",
  aprovado: "bg-green-100 text-green-700",
  concluido: "bg-blue-100 text-blue-700",
  recusado: "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  pendente: "Em análise",
  aprovado: "Aprovado",
  concluido: "Concluído",
  recusado: "Recusado",
};

export default function ColaboradorSolicitacoes() {
  const [tab, setTab] = useState<"ativos" | "historico">("ativos");
  const [openNew, setOpenNew] = useState(false);
  const { data: requests, isLoading } = useColabRequests();
  const { data: adjRequests = [] } = useColabAdjustmentRequests();

  const merged = [
    ...(requests || []),
    ...adjRequests.map((r: any) => ({
      id: `adj_${r.id}`,
      kind: 'ajuste_ponto',
      status: r.status === 'approved' ? 'concluido' : r.status === 'rejected' ? 'recusado' : 'pendente',
      created_at: r.created_at,
      payload: { start_date: r.punch_date, reason: `${r.requested_times || ''} — ${r.justification}` },
    })),
  ];
  const list = merged.filter((r: any) =>
    tab === "ativos" ? ["pendente", "aprovado"].includes(r.status) : ["concluido", "recusado"].includes(r.status)
  );

  return (
    <ColaboradorLayout bg="light" title="Solicitações">
      <div className="px-4 pt-4 pb-24">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 flex gap-2 mb-4">
          <Bell className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed">
            Envie suas solicitações e anexe documentos (atestados, comprovantes). O RH acompanha e responde por aqui.
          </p>
        </div>

        <div className="flex gap-6 border-b border-slate-200">
          {(["ativos", "historico"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "pb-2 text-sm font-semibold border-b-2 -mb-px transition",
                tab === t ? "border-[#f97316] text-[#f97316]" : "border-transparent text-slate-400"
              )}
            >
              {t === "ativos" ? "Em andamento" : "Histórico"}
            </button>
          ))}
        </div>

        <div className="space-y-3 mt-4">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />}
          {list.length === 0 && !isLoading && (
            <p className="text-center text-xs text-slate-400 py-8">Nenhuma solicitação por aqui</p>
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
                    <p className="text-xs text-slate-500 mt-0.5">Período: {p.start_date} {p.end_date ? `a ${p.end_date}` : ''}</p>
                  )}
                  {p.reason && <p className="text-xs text-slate-500 mt-0.5 truncate">{p.reason}</p>}
                  {p.attachment_url && (
                    <a href={p.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#f97316] mt-1 font-semibold">
                      <Paperclip className="h-3 w-3" /> Ver anexo
                    </a>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">Registrado em {format(new Date(r.created_at), "dd/MM/yyyy")}</p>
                </div>
                <span className={cn("h-fit text-[10px] px-2 py-1 rounded-full font-semibold", STATUS_STYLE[r.status] || "bg-slate-100 text-slate-500")}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAB Nova solicitação */}
      <button
        onClick={() => setOpenNew(true)}
        className="fixed bottom-24 right-4 h-14 px-5 rounded-full bg-[#f97316] text-white shadow-lg flex items-center gap-2 font-semibold z-40 active:scale-95 transition"
      >
        <Plus className="h-5 w-5" /> Nova
      </button>

      <NewRequestDialog open={openNew} onOpenChange={setOpenNew} />
    </ColaboradorLayout>
  );
}

// ============================
// NEW REQUEST DIALOG
// ============================
function NewRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState<"pick" | "form">("pick");
  const [kind, setKind] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string>("");

  const { uploadFile, isUploading, progress } = useUpload(() => localStorage.getItem('promotor_token'));
  const { toast } = useToast();
  const qc = useQueryClient();

  const createReq = useMutation({
    mutationFn: (data: { kind: string; payload: any }) =>
      promotorApi<any>('/api/promotor/requests', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['colab-requests'] });
      toast({ title: "Solicitação enviada", description: "O RH foi notificado." });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro ao enviar", description: e.message || "Tente novamente.", variant: "destructive" }),
  });

  const createMedCert = useMutation({
    mutationFn: (data: any) => promotorApi<any>('/api/promotor/medical-certificates', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colab-medical-certificates'] }),
  });

  const reset = () => {
    setStep("pick");
    setKind("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setAttachmentUrl(null);
    setAttachmentName("");
  };

  const cfg = CREATABLE_KINDS.find(c => c.kind === kind);

  const handleFile = async (file: File) => {
    try {
      const url = await uploadFile(file);
      if (url) {
        setAttachmentUrl(url);
        setAttachmentName(file.name);
      }
    } catch (e: any) {
      toast({ title: "Falha ao enviar arquivo", description: e.message, variant: "destructive" });
    }
  };

  const submit = async () => {
    if (!kind) return;
    if (cfg?.needsPeriod && !startDate) {
      toast({ title: "Informe a data inicial", variant: "destructive" });
      return;
    }
    if (cfg?.needsAttachment && !attachmentUrl) {
      toast({ title: "Anexe o documento", description: "É obrigatório enviar o comprovante.", variant: "destructive" });
      return;
    }
    const payload: any = { reason };
    if (startDate) payload.start_date = startDate;
    if (endDate) payload.end_date = endDate;
    if (attachmentUrl) { payload.attachment_url = attachmentUrl; payload.attachment_name = attachmentName; }

    // Para atestados, também salvamos no registro de atestados médicos
    if (kind === "atestado" && startDate) {
      try {
        await createMedCert.mutateAsync({
          absence_start: startDate,
          absence_end: endDate || startDate,
          document_url: attachmentUrl,
          notes: reason,
        });
      } catch { /* segue mesmo se falhar */ }
    }

    createReq.mutate({ kind, payload });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="p-5 border-b">
          <DialogTitle className="text-base">
            {step === "pick" ? "Nova solicitação" : (KIND_META[kind]?.label || "Solicitação")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {step === "pick" && (
            <div className="space-y-2">
              {CREATABLE_KINDS.map(item => {
                const m = KIND_META[item.kind];
                if (!m) return null;
                return (
                  <button
                    key={item.kind}
                    onClick={() => { setKind(item.kind); setStep("form"); }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:border-[#f97316]/40 hover:bg-orange-50/50 transition text-left"
                  >
                    <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: `${m.color}15`, color: m.color }}>
                      <m.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                      <p className="text-[11px] text-slate-500 truncate">{item.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                );
              })}
            </div>
          )}

          {step === "form" && (
            <>
              {cfg?.needsPeriod && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Data inicial</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Data final</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Observações {cfg?.needsAttachment ? "" : "(opcional)"}</Label>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Descreva sua solicitação"
                  rows={3}
                  className="mt-1"
                />
              </div>

              {(cfg?.needsAttachment || kind === "outros") && (
                <div>
                  <Label className="text-xs">
                    {cfg?.needsAttachment ? "Anexar documento (obrigatório)" : "Anexar (opcional)"}
                  </Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <label className="flex flex-col items-center justify-center gap-1 p-4 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-[#f97316]/50">
                      <Camera className="h-5 w-5 text-slate-400" />
                      <span className="text-[11px] text-slate-500">Tirar foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                      />
                    </label>
                    <label className="flex flex-col items-center justify-center gap-1 p-4 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-[#f97316]/50">
                      <Paperclip className="h-5 w-5 text-slate-400" />
                      <span className="text-[11px] text-slate-500">Da galeria</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                      />
                    </label>
                  </div>

                  {isUploading && (
                    <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Enviando... {progress}%
                    </div>
                  )}

                  {attachmentUrl && (
                    <div className="mt-2 flex items-center gap-2 p-2 bg-green-50 border border-green-100 rounded-xl">
                      <Paperclip className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-green-700 flex-1 truncate">{attachmentName}</span>
                      <button onClick={() => { setAttachmentUrl(null); setAttachmentName(""); }}>
                        <X className="h-4 w-4 text-green-600" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="p-4 border-t flex-row gap-2">
          {step === "form" && (
            <Button variant="outline" onClick={() => setStep("pick")} className="flex-1">Voltar</Button>
          )}
          {step === "form" && (
            <Button
              onClick={submit}
              disabled={createReq.isPending || isUploading}
              className="flex-1 bg-[#f97316] hover:bg-[#ea580c]"
            >
              {createReq.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
            </Button>
          )}
          {step === "pick" && (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
