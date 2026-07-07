import { useState } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Route as RouteIcon, Wand2, Eye, Sparkles, FileText, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useSRRoutes, useSRSaveRoute, useSRDeleteRoute, useSRDrivers, useSRVehicles, useSROrders, useSROptimizeRoute, useSRRoute } from "@/hooks/use-smartroute";
import { useSROptimizeAdvanced } from "@/hooks/use-smartroute-ai";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


const statusColor: Record<string, string> = { planejada: "bg-slate-200", em_andamento: "bg-blue-200", concluida: "bg-emerald-200", cancelada: "bg-red-200" };

export default function SmartRouteRotas() {
  const [filter, setFilter] = useState<any>({});
  const { data = [] } = useSRRoutes(filter);
  const { data: drivers = [] } = useSRDrivers();
  const { data: vehicles = [] } = useSRVehicles();
  const { data: pendingOrders = [] } = useSROrders({ status: "pendente" });
  const save = useSRSaveRoute();
  const del = useSRDeleteRoute();
  const optimize = useSROptimizeRoute();
  const optimizeAdv = useSROptimizeAdvanced();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [viewId, setViewId] = useState<string | null>(null);
  const { data: viewRoute } = useSRRoute(viewId || undefined);

  const onSave = async () => {
    try {
      await save.mutateAsync({ ...form, order_ids: selectedOrders });
      toast.success("Rota criada");
      setOpen(false); setForm({}); setSelectedOrders([]);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><RouteIcon className="w-6 h-6" /> Rotas</h1>
            <p className="text-sm text-muted-foreground">Planejamento e execução de rotas de entrega.</p>
          </div>
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={filter.date || ""} onChange={(e) => setFilter({ ...filter, date: e.target.value || undefined })} className="w-44" />
            </div>
            <Button onClick={() => { setForm({ planned_date: new Date().toISOString().slice(0, 10) }); setSelectedOrders([]); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Nova rota</Button>
          </div>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Código</TableHead><TableHead>Data</TableHead><TableHead>Motorista</TableHead>
              <TableHead>Veículo</TableHead><TableHead>Paradas</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.code}</TableCell>
                  <TableCell>{r.planned_date?.slice(0, 10)}</TableCell>
                  <TableCell>{r.driver_name || "—"}</TableCell>
                  <TableCell>{r.vehicle_plate || "—"}</TableCell>
                  <TableCell>{r.completed_stops}/{r.total_stops}</TableCell>
                  <TableCell><Badge className={statusColor[r.status] || ""}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => setViewId(r.id)}><Eye className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" title="Otimizar (rápido)" onClick={() => optimize.mutate(r.id, { onSuccess: () => toast.success("Sequência otimizada") })}><Wand2 className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" title="Otimizar IA (peso, volume, janela)" onClick={() => optimizeAdv.mutate(r.id, { onSuccess: (d: any) => toast.success(`IA: ${d.sequenced} paradas · ${d.total_km}km`, { description: d.warnings?.length ? d.warnings.join(" | ") : undefined }) })}><Sparkles className="w-4 h-4 text-primary" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(r.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!data.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma rota.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>

        {/* Create dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nova rota</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={form.planned_date || ""} onChange={(e) => setForm({ ...form, planned_date: e.target.value })} /></div>
              <div><Label>Código (opcional)</Label><Input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div>
                <Label>Motorista</Label>
                <Select value={form.driver_id || "none"} onValueChange={(v) => setForm({ ...form, driver_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não atribuído</SelectItem>
                    {drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Veículo</Label>
                <Select value={form.vehicle_id || "none"} onValueChange={(v) => setForm({ ...form, vehicle_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não atribuído</SelectItem>
                    {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} — {v.model}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Depot latitude</Label><Input type="number" step="any" value={form.depot_lat || ""} onChange={(e) => setForm({ ...form, depot_lat: +e.target.value })} /></div>
              <div><Label>Depot longitude</Label><Input type="number" step="any" value={form.depot_lng || ""} onChange={(e) => setForm({ ...form, depot_lng: +e.target.value })} /></div>
            </div>
            <div>
              <Label className="mb-2 block">Pedidos pendentes ({selectedOrders.length} selecionados)</Label>
              <div className="max-h-56 overflow-y-auto border rounded p-2 space-y-1">
                {pendingOrders.map((o: any) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm p-1 hover:bg-muted rounded cursor-pointer">
                    <Checkbox checked={selectedOrders.includes(o.id)} onCheckedChange={(v) => setSelectedOrders((s) => v ? [...s, o.id] : s.filter((x) => x !== o.id))} />
                    <span className="flex-1">{o.pdv_name || "?"} · {o.order_number || o.id.slice(0, 6)}</span>
                    <span className="text-xs text-muted-foreground">{o.weight_kg} kg · {o.volume_m3} m³</span>
                  </label>
                ))}
                {!pendingOrders.length && <p className="text-xs text-muted-foreground text-center py-2">Nenhum pedido pendente.</p>}
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={onSave} disabled={save.isPending}>Criar rota</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View dialog */}
        <Dialog open={!!viewId} onOpenChange={(v) => !v && setViewId(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Rota {viewRoute?.code}</DialogTitle></DialogHeader>
            {viewRoute && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Motorista:</span> {viewRoute.driver_name || "—"}</div>
                  <div><span className="text-muted-foreground">Veículo:</span> {viewRoute.vehicle_plate || "—"}</div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColor[viewRoute.status] || ""}>{viewRoute.status}</Badge></div>
                </div>
                <div className="border rounded max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="w-12">#</TableHead><TableHead>PDV</TableHead><TableHead>Pedido</TableHead><TableHead>Peso</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {viewRoute.stops?.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.sequence}</TableCell>
                          <TableCell>{s.pdv_name}</TableCell>
                          <TableCell className="font-mono text-xs">{s.order_number}</TableCell>
                          <TableCell>{s.weight_kg} kg</TableCell>
                          <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
