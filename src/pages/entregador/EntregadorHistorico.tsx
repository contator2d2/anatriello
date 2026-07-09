import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, PackageX, RotateCcw, History as HistoryIcon } from "lucide-react";
import { useDriverAuth, driverApi } from "@/contexts/DriverAuthContext";
import DriverBottomNav from "@/components/entregador/DriverBottomNav";

type Row = { id: string; kind: "ponto" | "avaria" | "devolucao"; subtype: string; at: string; description?: string };

const meta: Record<string, { Icon: any; color: string; label: string }> = {
  ponto:     { Icon: Clock,     color: "text-blue-600 bg-blue-50",     label: "Ponto" },
  avaria:    { Icon: PackageX,  color: "text-orange-600 bg-orange-50", label: "Avaria" },
  devolucao: { Icon: RotateCcw, color: "text-purple-600 bg-purple-50", label: "Devolução" },
};

export default function EntregadorHistorico() {
  const { driver, loading } = useDriverAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!driver) return;
    driverApi<Row[]>("/api/smartroute/driver/history").then(setRows).catch(() => setRows([])).finally(() => setBusy(false));
  }, [driver]);

  if (loading) return null;
  if (!driver) return <Navigate to="/entregador/login" replace />;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-br from-slate-700 to-slate-900 text-white p-4">
        <div className="flex items-center gap-3">
          <HistoryIcon className="w-6 h-6" />
          <div><div className="text-sm opacity-80">Meu</div><div className="font-bold">Histórico de eventos</div></div>
        </div>
      </div>

      <div className="p-4">
        <Card><CardContent className="p-4">
          {busy && <p className="text-sm text-muted-foreground text-center py-6">Carregando…</p>}
          {!busy && !rows.length && <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento registrado.</p>}
          <div className="space-y-2">
            {rows.map((r) => {
              const m = meta[r.kind];
              const I = m.Icon;
              return (
                <div key={`${r.kind}-${r.id}`} className="flex items-start gap-3 p-3 border rounded">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${m.color}`}><I className="w-4 h-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{m.label}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{r.subtype}</Badge>
                    </div>
                    {r.description && <div className="text-xs text-muted-foreground truncate">{r.description}</div>}
                    <div className="text-[11px] text-slate-500 mt-0.5">{new Date(r.at).toLocaleString("pt-BR")}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent></Card>
      </div>

      <DriverBottomNav />
    </div>
  );
}
