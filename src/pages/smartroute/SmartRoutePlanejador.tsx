import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, Wand2, CheckCircle2, Route as RouteIcon, Truck, Package, MapPin, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useSROrders, useSRVehicles, useSRDrivers } from "@/hooks/use-smartroute";
import { useSRDepots } from "@/hooks/use-smartroute-depots";
import { useSRAutoPlan, useSRCommitPlan } from "@/hooks/use-smartroute-planner";

export default function SmartRoutePlanejador() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [depotId, setDepotId] = useState<string>("");
  const [startHour, setStartHour] = useState(8);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [preview, setPreview] = useState<any | null>(null);

  const { data: orders = [] } = useSROrders({ status: "pendente" });
  const { data: vehicles = [] } = useSRVehicles();
  const { data: drivers = [] } = useSRDrivers();
  const { data: depots = [] } = useSRDepots();

  const autoPlan = useSRAutoPlan();
  const commit = useSRCommitPlan();

  const eligibleOrders = useMemo(
    () => orders.filter((o: any) => o.pdv_lat != null && o.pdv_lng != null || o.lat != null),
    [orders]
  );

  const runPlan = async () => {
    if (!depotId && !depots.find((d: any) => d.is_default)) {
      toast.error("Selecione um centro de distribuição.");
      return;
    }
    try {
      const res = await autoPlan.mutateAsync({
        date,
        depot_id: depotId || depots.find((d: any) => d.is_default)?.id,
        start_hour: startHour,
        order_ids: selectedOrders.length ? selectedOrders : undefined,
        vehicle_ids: selectedVehicles.length ? selectedVehicles : undefined,
        driver_ids: selectedDrivers.length ? selectedDrivers : undefined,
      });
      setPreview(res);
      toast.success(`${res.plans.length} rota(s) geradas · ${res.summary.total_stops} paradas`);
    } catch (e: any) { toast.error(e.message); }
  };

  const runCommit = async () => {
    if (!preview) return;
    try {
      const res: any = await commit.mutateAsync({
        date,
        depot_id: depotId || preview.depot?.id,
        plans: preview.plans,
      });
      toast.success(`${res.created.length} rota(s) publicadas`);
      setPreview(null);
      setSelectedOrders([]);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> Planejador Inteligente
          </h1>
          <p className="text-sm text-muted-foreground">
            Otimização automática: clusteriza pedidos por região, respeita capacidade dos veículos, janelas de entrega e prioridades.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">1. Parâmetros</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Centro de Distribuição</Label>
              <Select value={depotId || (depots.find((d: any) => d.is_default)?.id ?? "")} onValueChange={setDepotId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {depots.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}{d.is_default ? " ⭐" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Início da jornada</Label>
              <Input type="number" min={0} max={23} value={startHour} onChange={(e) => setStartHour(Number(e.target.value) || 8)} />
            </div>
            <div className="flex items-end">
              <Button onClick={runPlan} disabled={autoPlan.isPending} className="w-full">
                <Wand2 className="w-4 h-4 mr-1" /> {autoPlan.isPending ? "Otimizando..." : "Planejar Rotas"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4" /> Pedidos ({selectedOrders.length || eligibleOrders.length}/{eligibleOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2">
                Vazio = considerar todos os pendentes elegíveis.
              </p>
              <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-1">
                {eligibleOrders.map((o: any) => (
                  <label key={o.id} className="flex items-center gap-2 text-xs p-1 hover:bg-muted rounded cursor-pointer">
                    <Checkbox
                      checked={selectedOrders.includes(o.id)}
                      onCheckedChange={(v) =>
                        setSelectedOrders((s) => v ? [...s, o.id] : s.filter((x) => x !== o.id))
                      }
                    />
                    <span className="flex-1 truncate">{o.pdv_name} · {o.order_number || o.id.slice(0, 6)}</span>
                    <span className="text-muted-foreground">{o.weight_kg}kg</span>
                  </label>
                ))}
                {!eligibleOrders.length && <p className="text-xs text-muted-foreground text-center py-2">Sem pedidos elegíveis.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="w-4 h-4" /> Veículos ({selectedVehicles.length || vehicles.length}/{vehicles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-1">
                {vehicles.map((v: any) => (
                  <label key={v.id} className="flex items-center gap-2 text-xs p-1 hover:bg-muted rounded cursor-pointer">
                    <Checkbox
                      checked={selectedVehicles.includes(v.id)}
                      onCheckedChange={(c) =>
                        setSelectedVehicles((s) => c ? [...s, v.id] : s.filter((x) => x !== v.id))
                      }
                    />
                    <span className="flex-1">{v.plate} · {v.model}</span>
                    <span className="text-muted-foreground">{v.capacity_kg}kg</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Motoristas ({selectedDrivers.length || drivers.length}/{drivers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-1">
                {drivers.map((d: any) => (
                  <label key={d.id} className="flex items-center gap-2 text-xs p-1 hover:bg-muted rounded cursor-pointer">
                    <Checkbox
                      checked={selectedDrivers.includes(d.id)}
                      onCheckedChange={(c) =>
                        setSelectedDrivers((s) => c ? [...s, d.id] : s.filter((x) => x !== d.id))
                      }
                    />
                    <span className="flex-1">{d.full_name}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {preview && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <RouteIcon className="w-5 h-5" /> 2. Preview do Plano
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {preview.summary.routes} rotas · {preview.summary.total_stops} paradas · {preview.summary.total_km} km
                  {preview.summary.total_cost_brl ? ` · R$ ${preview.summary.total_cost_brl.toFixed(2)}` : ""}
                  {preview.unassigned > 0 && (
                    <span className="text-amber-600 ml-2">
                      <AlertTriangle className="inline w-3 h-3" /> {preview.unassigned} não alocado(s)
                    </span>
                  )}
                </p>
              </div>
              <Button onClick={runCommit} disabled={commit.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> {commit.isPending ? "Publicando..." : "Confirmar e Publicar"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {preview.plans.map((p: any, i: number) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Rota {i + 1}</Badge>
                      <span className="text-sm font-medium">
                        <Truck className="inline w-4 h-4 mr-1" />
                        {p.vehicle.plate} · {p.vehicle.model}
                      </span>
                      {p.driver && <span className="text-sm text-muted-foreground">👤 {p.driver.full_name}</span>}
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span><MapPin className="inline w-3 h-3" /> {p.totals.total_km} km</span>
                      <span>⏱ {Math.floor(p.totals.duration_min / 60)}h{String(p.totals.duration_min % 60).padStart(2, "0")}</span>
                      <span>📦 {p.totals.weight_kg}kg ({p.totals.capacity_used_kg_pct}%)</span>
                      {p.totals.cost_brl != null && <span className="font-medium">R$ {p.totals.cost_brl.toFixed(2)}</span>}
                    </div>
                  </div>
                  {p.warnings?.length > 0 && (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-2">
                      {p.warnings.map((w: string, idx: number) => <div key={idx}>⚠ {w}</div>)}
                    </div>
                  )}
                  <div className="max-h-56 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>PDV</TableHead>
                          <TableHead>Pedido</TableHead>
                          <TableHead>ETA</TableHead>
                          <TableHead>Peso</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.stops.map((s: any) => (
                          <TableRow key={s.order_id}>
                            <TableCell>{s.sequence}</TableCell>
                            <TableCell className="text-xs">{s.pdv_name}</TableCell>
                            <TableCell className="text-xs font-mono">{s.order_number}</TableCell>
                            <TableCell className="text-xs font-mono">{s.eta_hhmm}</TableCell>
                            <TableCell className="text-xs">{s.weight_kg} kg</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Separator />
        <div className="text-xs text-muted-foreground">
          <b>Algoritmo:</b> Sweep (clusterização angular a partir do CD) + Bin-packing por capacidade (kg/m³) + Nearest-Neighbor com janelas de entrega e prioridade. Após publicar, use <b>Re-otimizar</b> em cada rota para reordenar paradas pendentes em tempo real.
        </div>
      </div>
    </MainLayout>
  );
}
