import { useState, useMemo } from "react";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { usePromotorPunches, useDownloadPunchReceipt, useDownloadMirror } from "@/hooks/use-promotor";
import { format, subDays, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, Download, FileText, MapPin, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Tab = "dia" | "semana" | "mes";

const PUNCH_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida_intervalo: "Início Almoço",
  retorno_intervalo: "Fim Almoço",
  saida: "Saída",
  extraordinaria: "Extra",
};

const PUNCH_COLOR: Record<string, string> = {
  entrada: "bg-emerald-100 text-emerald-700",
  saida_intervalo: "bg-orange-100 text-orange-700",
  retorno_intervalo: "bg-orange-100 text-orange-700",
  saida: "bg-red-100 text-red-700",
  extraordinaria: "bg-slate-100 text-slate-700",
};

function fmtTime(v: any) {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  return isNaN(d.getTime()) ? "—" : format(d, "HH:mm:ss");
}
function fmtDate(v: any) {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  return isNaN(d.getTime()) ? "—" : format(d, "dd/MM/yyyy");
}

export default function ColaboradorJornada() {
  const [tab, setTab] = useState<Tab>("dia");
  const [date, setDate] = useState(new Date());
  const dlReceipt = useDownloadPunchReceipt();
  const dlMirror = useDownloadMirror();
  const { toast } = useToast();

  const range = useMemo(() => {
    if (tab === "dia") return { start: date, end: date };
    if (tab === "semana") return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
    return { start: startOfMonth(date), end: endOfMonth(date) };
  }, [tab, date]);

  const { data: punches, isLoading } = usePromotorPunches({
    start_date: format(range.start, "yyyy-MM-dd"),
    end_date: format(range.end, "yyyy-MM-dd"),
  });

  const rows = useMemo(() => {
    return (punches || []).slice().sort((a: any, b: any) => {
      const da = new Date(a.punched_at || a.offline_local_time || 0).getTime();
      const db = new Date(b.punched_at || b.offline_local_time || 0).getTime();
      return db - da;
    });
  }, [punches]);

  const stepDate = (dir: 1 | -1) => {
    if (tab === "dia") setDate(dir > 0 ? addDays(date, 1) : subDays(date, 1));
    else if (tab === "semana") setDate(dir > 0 ? addDays(date, 7) : subDays(date, 7));
    else setDate(dir > 0 ? addDays(endOfMonth(date), 1) : subDays(startOfMonth(date), 1));
  };

  const handleReceipt = async (id: string, isLocal: boolean) => {
    if (isLocal) {
      toast({ title: "Sincronize primeiro", description: "Este ponto ainda não foi enviado ao servidor.", variant: "destructive" });
      return;
    }
    try {
      await dlReceipt.mutateAsync(id);
      toast({ title: "Comprovante baixado" });
    } catch (e: any) {
      toast({ title: "Falha ao baixar", description: e.message || "Tente novamente", variant: "destructive" });
    }
  };

  const handleMirror = async () => {
    try {
      await dlMirror.mutateAsync({
        start: format(startOfMonth(date), "yyyy-MM-dd"),
        end: format(endOfMonth(date), "yyyy-MM-dd"),
      });
      toast({ title: "Espelho baixado" });
    } catch (e: any) {
      toast({ title: "Falha ao baixar espelho", description: e.message, variant: "destructive" });
    }
  };

  const rangeLabel = tab === "dia"
    ? format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })
    : tab === "semana"
      ? `${format(range.start, "dd/MM")} — ${format(range.end, "dd/MM/yyyy")}`
      : format(date, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <ColaboradorLayout bg="light" title="Meus Pontos" showBack>
      <div className="px-4 pt-4 space-y-3">
        {/* Tabs */}
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

        {/* Date nav */}
        <div className="bg-white rounded-2xl shadow-sm p-3 flex items-center justify-between">
          <button onClick={() => stepDate(-1)} className="p-2 rounded-full hover:bg-slate-100"><ChevronLeft className="h-5 w-5 text-slate-500" /></button>
          <p className="text-sm font-semibold capitalize text-center flex-1">{rangeLabel}</p>
          <button onClick={() => stepDate(1)} className="p-2 rounded-full hover:bg-slate-100"><ChevronRight className="h-5 w-5 text-slate-500" /></button>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Total de registros</p>
            <p className="text-2xl font-bold text-slate-800 tabular-nums">{rows.length}</p>
          </div>
          <button
            onClick={handleMirror}
            disabled={dlMirror.isPending}
            className="bg-[#0a1128] hover:bg-[#0d1a3d] text-white rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs font-semibold disabled:opacity-60"
          >
            {dlMirror.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Espelho do mês
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Data</th>
                  <th className="text-left px-3 py-2 font-semibold">Hora</th>
                  <th className="text-left px-3 py-2 font-semibold">Tipo</th>
                  <th className="text-left px-3 py-2 font-semibold hidden sm:table-cell">Local</th>
                  <th className="text-right px-3 py-2 font-semibold">Comprovante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && (
                  <tr><td colSpan={5} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" /></td></tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-sm text-slate-400">Nenhum ponto registrado nesse período.</td></tr>
                )}
                {rows.map((p: any) => {
                  const ts = p.punched_at || p.offline_local_time;
                  const isLocal = !!(p.pending_local || String(p.id || '').startsWith('punch_') || String(p.id || '').startsWith('local'));
                  const geo = p.geo_status === 'dentro_area' ? 'Dentro' : p.geo_status === 'fora_area' ? 'Fora' : (p.geo_status || '—');
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{fmtDate(ts)}</td>
                      <td className="px-3 py-2 tabular-nums font-semibold text-slate-800 whitespace-nowrap">{fmtTime(ts)}</td>
                      <td className="px-3 py-2">
                        <span className={cn("inline-block text-[10px] font-bold px-2 py-1 rounded-full", PUNCH_COLOR[p.punch_type] || "bg-slate-100 text-slate-700")}>
                          {PUNCH_LABEL[p.punch_type] || p.punch_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1">
                          {p.is_offline || isLocal ? <WifiOff className="h-3 w-3 text-amber-500" /> : <MapPin className="h-3 w-3 text-slate-400" />}
                          {p.pdv_name || geo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleReceipt(p.id, isLocal)}
                          disabled={dlReceipt.isPending && dlReceipt.variables === p.id}
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg",
                            isLocal ? "bg-slate-100 text-slate-400" : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                          )}
                          title={isLocal ? "Aguardando sincronização" : "Baixar comprovante"}
                        >
                          {dlReceipt.isPending && dlReceipt.variables === p.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />}
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ColaboradorLayout>
  );
}
