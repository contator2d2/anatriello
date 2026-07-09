import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, Coffee, LogOut, Play } from "lucide-react";
import { toast } from "sonner";
import { useDriverAuth, driverApi } from "@/contexts/DriverAuthContext";
import { getPos } from "@/lib/driver-utils";
import DriverBottomNav from "@/components/entregador/DriverBottomNav";

type Punch = { id: string; kind: "entrada" | "pausa" | "retorno" | "saida"; punched_at: string; lat?: number; lng?: number };

const cfg: Record<string, { label: string; Icon: any; color: string }> = {
  entrada: { label: "Entrada", Icon: LogIn, color: "bg-emerald-600 hover:bg-emerald-700" },
  pausa:   { label: "Pausa",   Icon: Coffee, color: "bg-amber-600 hover:bg-amber-700" },
  retorno: { label: "Retorno", Icon: Play,   color: "bg-blue-600 hover:bg-blue-700" },
  saida:   { label: "Saída",   Icon: LogOut, color: "bg-slate-700 hover:bg-slate-800" },
};

export default function EntregadorPonto() {
  const { driver, loading } = useDriverAuth();
  const [punches, setPunches] = useState<Punch[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  const reload = () => driverApi<Punch[]>("/api/smartroute/driver/timeclock/today").then(setPunches).catch(() => setPunches([]));
  useEffect(() => { if (driver) reload(); }, [driver]);

  if (loading) return null;
  if (!driver) return <Navigate to="/entregador/login" replace />;

  const punch = async (kind: string) => {
    setSending(kind);
    try {
      const pos = await getPos();
      await driverApi("/api/smartroute/driver/timeclock/punch", { method: "POST", body: { kind, ...pos } });
      toast.success(`${cfg[kind].label} registrada`);
      reload();
    } catch (e: any) { toast.error(e.message || "Erro"); }
    finally { setSending(null); }
  };

  const last = punches[punches.length - 1]?.kind;
  const nextKind =
    !last ? "entrada" :
    last === "entrada" || last === "retorno" ? "pausa" :
    last === "pausa" ? "retorno" : "saida";

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6" />
          <div>
            <div className="text-sm opacity-80">Ponto do dia</div>
            <div className="font-bold">{driver.full_name}</div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3">Próximo registro sugerido</p>
            <Button
              size="lg"
              className={`w-full h-16 text-base text-white ${cfg[nextKind].color}`}
              onClick={() => punch(nextKind)}
              disabled={!!sending}
            >
              {(() => { const I = cfg[nextKind].Icon; return <I className="w-5 h-5 mr-2" />; })()}
              Bater {cfg[nextKind].label}
            </Button>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {Object.entries(cfg).map(([k, c]) => (
                <Button key={k} variant="outline" size="sm" onClick={() => punch(k)} disabled={!!sending}>
                  <c.Icon className="w-3 h-3 mr-1" />{c.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-2">Registros de hoje</p>
            {!punches.length && <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro ainda.</p>}
            <div className="space-y-2">
              {punches.map((p) => {
                const c = cfg[p.kind];
                const I = c.Icon;
                return (
                  <div key={p.id} className="flex items-center gap-3 p-2 border rounded">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><I className="w-4 h-4 text-slate-600" /></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{c.label}</div>
                      <div className="text-xs text-muted-foreground">{new Date(p.punched_at).toLocaleTimeString("pt-BR")}</div>
                    </div>
                    {p.lat != null && <Badge variant="outline" className="text-[10px]">GPS</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <DriverBottomNav />
    </div>
  );
}
