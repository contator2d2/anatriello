import { useState } from "react";
import { ColaboradorLayout } from "./ColaboradorLayout";
import {
  useColabMirrors, useColabMirror, useColabAcceptMirror, useColabRejectMirror,
} from "@/hooks/use-promotor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileSignature, CheckCircle2, XCircle, Clock, ShieldCheck, Loader2, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmtHM = (min: number) => {
  const n = Math.abs(min || 0);
  const sign = (min || 0) < 0 ? "-" : "";
  return `${sign}${Math.floor(n / 60)}h${String(n % 60).padStart(2, "0")}`;
};

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export default function ColaboradorEspelho() {
  const { toast } = useToast();
  const { data: mirrors = [], isLoading } = useColabMirrors();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: detail } = useColabMirror(selectedId || undefined);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [comments, setComments] = useState("");
  const accept = useColabAcceptMirror();
  const reject = useColabRejectMirror();

  const handleAccept = async () => {
    if (!selectedId) return;
    if (!confirm("Confirma o aceite do espelho de ponto? Sua assinatura será registrada.")) return;
    try {
      await accept.mutateAsync({ id: selectedId, comments: comments.trim() || undefined });
      toast({ title: "Espelho aceito!", description: "Assinatura registrada com sucesso." });
      setSelectedId(null);
      setComments("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!selectedId || !reason.trim()) {
      toast({ title: "Informe o motivo", variant: "destructive" });
      return;
    }
    try {
      await reject.mutateAsync({ id: selectedId, reason: reason.trim() });
      toast({ title: "Espelho rejeitado", description: "O RH será notificado." });
      setRejectOpen(false);
      setSelectedId(null);
      setReason("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  // Detalhe
  if (selectedId && detail) {
    return (
      <ColaboradorLayout bg="light" title="Espelho de Ponto" showBack>
        <div className="px-4 pt-4 pb-24">
          <button onClick={() => { setSelectedId(null); setComments(""); }}
            className="flex items-center gap-1 text-sm text-slate-500 mb-3">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>

          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Competência</p>
                <p className="text-lg font-bold">{detail.reference_month}</p>
              </div>
              <StatusPill status={detail.status} />
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-slate-500 mb-2">Resumo do mês</p>
              <div className="grid grid-cols-2 gap-2">
                <MobileMetric label="Horas Trab." value={fmtHM(detail.totals_json?.worked_min)} />
                <MobileMetric label="Previsto" value={fmtHM(detail.totals_json?.expected_min)} />
                <MobileMetric label="Saldo"
                  value={fmtHM(detail.totals_json?.balance_min)}
                  color={(detail.totals_json?.balance_min || 0) >= 0 ? "emerald" : "rose"} />
                <MobileMetric label="Extras" value={fmtHM(detail.totals_json?.overtime_min)} />
                <MobileMetric label="Faltas" value={detail.totals_json?.absences || 0} />
                <MobileMetric label="Atrasos" value={detail.totals_json?.lates || 0} />
              </div>
            </div>

            {detail.status === "accepted" && (
              <div className="border-t pt-3 bg-emerald-50 -mx-4 -mb-4 p-4 rounded-b-2xl">
                <div className="flex items-center gap-2 text-emerald-700 mb-2">
                  <ShieldCheck className="w-5 h-5" />
                  <p className="font-semibold">Espelho aceito</p>
                </div>
                <p className="text-xs text-emerald-800">
                  Assinado em {new Date(detail.accepted_at).toLocaleString("pt-BR")}
                </p>
                <p className="text-[10px] text-emerald-700 mt-1 break-all">
                  Hash: {detail.signature_hash?.slice(0, 32)}…
                </p>
              </div>
            )}

            {detail.status === "rejected" && (
              <div className="border-t pt-3 bg-rose-50 -mx-4 -mb-4 p-4 rounded-b-2xl">
                <p className="font-semibold text-rose-700 mb-1">Espelho rejeitado</p>
                <p className="text-sm text-rose-800">{detail.rejection_reason}</p>
              </div>
            )}
          </div>

          {detail.status === "pending" && (
            <>
              <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-medium mb-2">Observações (opcional)</p>
                <Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)}
                  placeholder="Ex: batidas de 15/03 estão corretas..." />
              </div>

              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900">
                <p className="font-semibold mb-1">📋 Antes de aceitar</p>
                <p>
                  Confirme se as horas, faltas e saldo estão corretos. Após o aceite,
                  o espelho será assinado digitalmente com data, IP e dispositivo.
                </p>
              </div>

              <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setRejectOpen(true)}
                  disabled={accept.isPending}>
                  <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleAccept}
                  disabled={accept.isPending}>
                  {accept.isPending
                    ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    : <CheckCircle2 className="w-4 h-4 mr-1" />}
                  Aceitar
                </Button>
              </div>
            </>
          )}
        </div>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Rejeitar Espelho</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Descreva o que está incorreto. O RH será notificado e poderá gerar novo espelho.
              </p>
              <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Falta batida no dia 12/03..." />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleReject} disabled={reject.isPending || !reason.trim()}>
                {reject.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Confirmar Rejeição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ColaboradorLayout>
    );
  }

  // Lista
  return (
    <ColaboradorLayout bg="light" title="Espelho de Ponto" showBack>
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-3 shadow-sm mb-3">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <FileSignature className="w-3 h-3" /> Assinatura mensal auditável
          </p>
          <p className="text-sm text-slate-700 mt-1">
            Confira e assine seu espelho todo mês. Sua assinatura é registrada com data,
            IP e hash SHA-256 para conformidade legal.
          </p>
        </div>

        {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />}

        <div className="space-y-2">
          {(mirrors as any[]).map((m) => {
            const [y, month] = String(m.reference_month || "").split("-");
            const mesLabel = MESES[Number(month) - 1] || "—";
            return (
              <button key={m.id} onClick={() => setSelectedId(m.id)}
                className={cn(
                  "w-full bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3 text-left transition",
                  m.status === "pending" && "ring-2 ring-amber-300",
                )}>
                <div className={cn(
                  "h-14 w-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0",
                  m.status === "accepted" ? "bg-emerald-50 text-emerald-600"
                    : m.status === "rejected" ? "bg-rose-50 text-rose-600"
                    : "bg-amber-50 text-amber-600"
                )}>
                  <span className="text-xs font-bold">{mesLabel}</span>
                  <span className="text-[10px] font-semibold">{y}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">Espelho {m.reference_month}</p>
                    <StatusPill status={m.status} compact />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {fmtHM(m.totals_json?.worked_min || 0)} trabalhadas
                    • Saldo {fmtHM(m.totals_json?.balance_min || 0)}
                  </p>
                  {m.status === "pending" && (
                    <p className="text-xs text-amber-600 font-medium mt-1">Aguardando seu aceite</p>
                  )}
                </div>
              </button>
            );
          })}
          {!mirrors.length && !isLoading && (
            <p className="text-center text-sm text-slate-400 py-8">Nenhum espelho disponível</p>
          )}
        </div>
      </div>
    </ColaboradorLayout>
  );
}

function StatusPill({ status, compact = false }: { status: string; compact?: boolean }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    pending: { label: "Pendente", cls: "bg-amber-100 text-amber-700", icon: Clock },
    accepted: { label: "Aceito", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    rejected: { label: "Rejeitado", cls: "bg-rose-100 text-rose-700", icon: XCircle },
  };
  const s = map[status] || { label: status, cls: "bg-slate-100 text-slate-700", icon: Clock };
  const Icon = s.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full font-medium",
      compact ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
      s.cls,
    )}>
      <Icon className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} /> {s.label}
    </span>
  );
}

function MobileMetric({ label, value, color }: { label: string; value: any; color?: string }) {
  const cls = color === "emerald" ? "text-emerald-600" : color === "rose" ? "text-rose-600" : "text-slate-800";
  return (
    <div className="p-2 rounded-lg bg-slate-50">
      <p className="text-[10px] text-slate-500 uppercase">{label}</p>
      <p className={cn("text-sm font-bold", cls)}>{value}</p>
    </div>
  );
}
