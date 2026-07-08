import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Route as RouteIcon, Truck, Users2, Package, Store, MapPin, CheckCircle2, Clock, AlertTriangle, Timer, ClipboardX } from "lucide-react";
import { useSRDashboard, useSRLive } from "@/hooks/use-smartroute";
import { useOpsMetrics } from "@/hooks/use-smartroute-checklists";
import { Link } from "react-router-dom";

const KPI = ({ icon: Icon, label, value, tone = "default" }: any) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone === "green" ? "bg-emerald-100 text-emerald-700" : tone === "amber" ? "bg-amber-100 text-amber-700" : tone === "red" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value ?? 0}</div>
      </div>
    </CardContent>
  </Card>
);

const statusColor: Record<string, string> = {
  em_rota: "bg-emerald-500",
  em_pdv: "bg-amber-500",
  disponivel: "bg-blue-500",
  offline: "bg-slate-400",
};

export default function SmartRouteDashboard() {
  const { data } = useSRDashboard();
  const { data: live } = useSRLive();
  const { data: ops } = useOpsMetrics();
  const d = data || {};
  const sum = (m: any = {}) => Object.values(m).reduce((a: any, b: any) => a + b, 0);
  const avgMin = ops?.avg_stop_ms ? Math.round(ops.avg_stop_ms / 60000) : 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white">
            <RouteIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">SmartRoute AI</h1>
            <p className="text-sm text-muted-foreground">Torre de controle logística · Anatriello</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI icon={RouteIcon} label="Rotas hoje" value={sum(d.routes)} />
          <KPI icon={CheckCircle2} label="Paradas concluídas" value={d.stops?.concluida || 0} tone="green" />
          <KPI icon={Clock} label="Em atendimento" value={d.stops?.em_atendimento || 0} tone="amber" />
          <KPI icon={AlertTriangle} label="Não entregues" value={d.stops?.nao_entregue || 0} tone="red" />
          <KPI icon={Package} label="Pedidos pendentes" value={d.orders?.pendente || 0} />
          <KPI icon={Truck} label="Veículos ativos" value={d.vehicles?.ativo || 0} />
          <KPI icon={Users2} label="Motoristas em rota" value={d.drivers?.em_rota || 0} tone="green" />
          <KPI icon={Users2} label="Disponíveis" value={d.drivers?.disponivel || 0} />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> Motoristas em campo</CardTitle>
            <Link to="/smartroute/mapa" className="text-xs text-primary hover:underline">Abrir mapa →</Link>
          </CardHeader>
          <CardContent>
            {(!live?.drivers || live.drivers.length === 0) && <p className="text-sm text-muted-foreground">Nenhum motorista logado no momento.</p>}
            <div className="grid gap-2">
              {live?.drivers?.map((dr: any) => (
                <div key={dr.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <span className={`w-2.5 h-2.5 rounded-full ${statusColor[dr.current_status] || "bg-slate-300"}`} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{dr.full_name}</div>
                    <div className="text-xs text-muted-foreground">{dr.plate ? `${dr.plate} · ${dr.model || ""}` : "Sem veículo"} {dr.route_code ? `· Rota ${dr.route_code}` : ""}</div>
                  </div>
                  {dr.route_id && <Badge variant="outline">{dr.completed_stops || 0}/{dr.total_stops || 0} paradas</Badge>}
                  <Badge variant="secondary">{dr.current_status || "offline"}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
