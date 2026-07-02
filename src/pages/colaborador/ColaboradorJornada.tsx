import { useState, useMemo } from "react";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { usePromotorPunches, useDownloadPunchReceipt, useDownloadMirror } from "@/hooks/use-promotor";
import { format, subDays, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "dia" | "semana" | "mes";

const STAGES: { key: string; label: string; color: string }[] = [
  { key: "entrada", label: "Entrada", color: "#10b981" },
  { key: "saida_intervalo", label: "Início Almoço", color: "#f97316" },
  { key: "retorno_intervalo", label: "Fim Almoço", color: "#f97316" },
  { key: "saida", label: "Saída", color: "#ef4444" },
];

export default function ColaboradorJornada() {
  const [tab, setTab] = useState<Tab>("dia");
  const [date, setDate] = useState(new Date());
  const dlReceipt = useDownloadPunchReceipt();
  const dlMirror = useDownloadMirror();

  const range = useMemo(() => {
    if (tab === "dia") return { start: date, end: date };
    if (tab === "semana") return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
    return { start: startOfMonth(date), end: endOfMonth(date) };
  }, [tab, date]);

  const { data: punches, isLoading } = usePromotorPunches({
    start_date: format(range.start, "yyyy-MM-dd"),
    end_date: format(range.end, "yyyy-MM-dd"),
  });

  const dayPunches = (punches || []).filter((p: any) => {
    const ts = new Date(p.punched_at || p.offline_local_time);
    return format(ts, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
  }).sort((a: any, b: any) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime());

  const punchMap: Record<string, any> = {};
  dayPunches.forEach((p: any) => { punchMap[p.punch_type] = p; });

  const entrada = punchMap.entrada?.punched_at ? new Date(punchMap.entrada.punched_at) : null;
  const almocoIni = punchMap.saida_intervalo?.punched_at ? new Date(punchMap.saida_intervalo.punched_at) : null;
  const almocoFim = punchMap.retorno_intervalo?.punched_at ? new Date(punchMap.retorno_intervalo.punched_at) : null;
  const saida = punchMap.saida?.punched_at ? new Date(punchMap.saida.punched_at) : null;

  const minutos = (a: Date | null, b: Date | null) => (a && b) ? Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000)) : 0;
  const fmtDur = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  const almocoMin = minutos(almocoIni, almocoFim);
  const trabalhadoMin = (minutos(entrada, almocoIni) + minutos(almocoFim, saida)) || minutos(entrada, saida) - almocoMin;
  const totalMin = trabalhadoMin + almocoMin;
  const previstoMin = 8 * 60;
  const saldoMin = trabalhadoMin - previstoMin;

  return (
    <ColaboradorLayout bg="light" title="Minha Jornada" showBack>
      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-full p-1 flex shadow-sm">
          {(["dia", "semana", "mes"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2 rounded-full text-xs font-semibold capitalize transition",
                tab === t ? "bg-[#f97316] text-white shadow" : "text-slate-500"
              )}
            >
              {t === "dia" ? "Dia" : t === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {/* Date nav */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setDate(subDays(date, 1))} className="p-1"><ChevronLeft className="h-5 w-5 text-slate-400" /></button>
            <p className="text-sm font-semibold capitalize">{format(date, "EEEE, dd/MM/yyyy", { locale: ptBR })}</p>
            <button onClick={() => setDate(addDays(date, 1))} className="p-1"><ChevronRight className="h-5 w-5 text-slate-400" /></button>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            {STAGES.map((s, i) => {
              const p = punchMap[s.key];
              const time = p?.punched_at ? format(new Date(p.punched_at), "HH:mm") : "--:--";
              const done = !!p;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn("h-3 w-3 rounded-full", done ? "" : "bg-slate-200")} style={done ? { background: s.color } : {}} />
                    {i < STAGES.length - 1 && <div className="h-6 w-px bg-slate-200" />}
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <p className={cn("text-sm font-semibold", done ? "text-slate-800" : "text-slate-400")}>{time}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {done && (
                        <button
                          onClick={() => dlReceipt.mutate(p.id)}
                          className="text-[10px] px-2 py-1 rounded-full bg-orange-50 text-orange-600 font-medium flex items-center gap-1 hover:bg-orange-100"
                          title="Baixar comprovante"
                        >
                          <Download className="h-3 w-3" /> Comprovante
                        </button>
                      )}
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", done ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-400")}>
                        {done ? "No horário" : "Pendente"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resumo */}
        <div className="bg-white rounded-2xl shadow-sm mt-4 p-4">
          <p className="text-sm font-bold mb-3">Resumo do dia</p>
          <SummaryRow label="Trabalhado" value={fmtDur(trabalhadoMin)} />
          <SummaryRow label="Almoço" value={fmtDur(almocoMin)} />
          <SummaryRow label="Total do dia" value={fmtDur(totalMin)} />
          <SummaryRow label="Saldo do dia" value={`${saldoMin >= 0 ? "+" : "-"}${fmtDur(Math.abs(saldoMin))}`} valueClass={saldoMin >= 0 ? "text-green-600" : "text-red-500"} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm mt-4 p-4 flex items-center justify-between">
          <p className="text-sm font-bold">Banco de horas</p>
          <p className="text-green-600 font-bold">+10:30</p>
        </div>

        <button
          onClick={() => dlMirror.mutate({ start: format(startOfMonth(date), "yyyy-MM-dd"), end: format(endOfMonth(date), "yyyy-MM-dd") })}
          disabled={dlMirror.isPending}
          className="w-full mt-4 bg-[#f97316] hover:bg-[#ea6a0a] text-white rounded-2xl py-3 flex items-center justify-center gap-2 font-semibold shadow-sm disabled:opacity-60"
        >
          {dlMirror.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Espelho de ponto do mês
        </button>

        {isLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400 mt-4" />}
      </div>
    </ColaboradorLayout>
  );
}

function SummaryRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between py-2 border-t border-slate-100 first:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={cn("text-sm font-bold", valueClass || "text-slate-800")}>{value}</span>
    </div>
  );
}
