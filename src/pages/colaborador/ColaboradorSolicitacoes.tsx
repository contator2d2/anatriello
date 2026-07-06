import { useState } from "react";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { useColabRequests, useColabAdjustmentRequests } from "@/hooks/use-promotor";
import { Umbrella, HeartPulse, Bus, FileText, Clock, Edit3, Loader2, Wallet, Smile, Bell } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  atestado: { label: "Atestado", icon: HeartPulse, color: "#ef4444" },
};
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
    <ColaboradorLayout bg="light" title="Informativos">
      <div className="px-4 pt-4">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 flex gap-2 mb-4">
          <Bell className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed">
            As solicitações são registradas e acompanhadas pelo RH. Aqui você visualiza o status dos processos em seu nome.
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
            <p className="text-center text-xs text-slate-400 py-8">Nenhum informativo</p>
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
    </ColaboradorLayout>
  );
}
