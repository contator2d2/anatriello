import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Lock, Unlock, Users, Truck, Package, Sun, Sunset, Moon, Clock, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  useSRTemplates,
  useSRRouteDay, useSRSetDayDrivers, useSRCloseDay, useSRReopenDay,
} from "@/hooks/use-smartroute-daily";
import { useSRDrivers, useSRVehicles } from "@/hooks/use-smartroute";

const WIN_META: Record<string, { label: string; icon: any; color: string }> = {
  manha: { label: "Manhã", icon: Sun, color: "bg-amber-100 text-amber-700" },
  tarde: { label: "Tarde", icon: Sunset, color: "bg-orange-100 text-orange-700" },
  noite: { label: "Noite", icon: Moon, color: "bg-indigo-100 text-indigo-700" },
  qualquer: { label: "—", icon: Clock, color: "bg-slate-100 text-slate-700" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  aberta: { label: "Aberta", color: "bg-emerald-100 text-emerald-700" },
  fechada: { label: "Fechada", color: "bg-amber-100 text-amber-700" },
  em_andamento: { label: "Em rota", color: "bg-blue-100 text-blue-700" },
  concluida: { label: "Concluída", color: "bg-slate-100 text-slate-700" },
};

export default function RotaDoDia() {
  const [params, setParams] = useSearchParams();
  const { data: templates = [] } = useSRTemplates();
  const routeId = params.get("route") || "";
  const date = params.get("date") || new Date().toISOString().slice(0, 10);

  const set = (k: string, v: string) => { const p = new URLSearchParams(params); p.set(k, v); setParams(p, { replace: true }); };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="w-6 h-6" /> Rota do Dia</h1>
        <p className="text-sm text-muted-foreground">Prepare a rota do dia, atribua entregadores e feche para liberar no app.</p>
      </div>

      <Card>
        <CardContent className="p-4 flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs text-muted-foreground">Rota fixa</label>
            <Select value={routeId} onValueChange={(v) => set("route", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione uma rota" /></SelectTrigger>
              <SelectContent>{templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Data</label>
            <Input type="date" value={date} onChange={(e) => set("date", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {routeId ? <DayDetails routeId={routeId} date={date} /> : (
        <div className="text-center py-12 text-sm text-muted-foreground">Escolha uma rota acima.</div>
      )}
    </div>
  );
}

function DayDetails({ routeId, date }: { routeId: string; date: string }) {
  const { data, isLoading, refetch } = useSRRouteDay(routeId, date);
  const { data: drivers = [] } = useSRDrivers();
  const { data: vehicles = [] } = useSRVehicles();
  const setDrivers = useSRSetDayDrivers();
  const closeDay = useSRCloseDay();
  const reopenDay = useSRReopenDay();

  const [driverIds, setDriverIds] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");

  useMemo(() => {
    if (data?.day) {
      setDriverIds(data.day.driver_ids || []);
      setVehicleId(data.day.vehicle_id || "");
    }
  }, [data?.day?.id]);

  if (isLoading || !data) return <div className="text-center py-8 text-muted-foreground">Carregando…</div>;

  const { day, orders = [], vehicle } = data;
  const status = STATUS_META[day.status] || STATUS_META.aberta;
  const locked = day.status !== "aberta";

  const toggleDriver = (id: string) => {
    setDriverIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const saveDrivers = async () => {
    await setDrivers.mutateAsync({ routeId, date, driver_ids: driverIds, vehicle_id: vehicleId || null });
    toast.success("Entregadores atualizados"); refetch();
  };
  const doClose = async () => {
    try {
      await closeDay.mutateAsync({ routeId, date });
      toast.success("Rota do dia fechada — liberada no app do entregador"); refetch();
    } catch (e: any) { toast.error(e.message); }
  };
  const doReopen = async () => {
    if (!confirm("Reabrir a rota devolve os pedidos ao pool e apaga as rotas do app. Continuar?")) return;
    await reopenDay.mutateAsync({ routeId, date });
    toast.success("Rota reaberta"); refetch();
  };

  return (
    <>
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader>
          <CardContent><Badge className={status.color + " text-base px-3 py-1"}>{status.label}</Badge></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pedidos do dia</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold flex items-center gap-2"><Package className="w-5 h-5" /> {orders.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Peso total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{orders.reduce((s: number, o: any) => s + Number(o.weight_kg || 0), 0).toFixed(1)} kg</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Entregadores atribuídos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {drivers.map((d: any) => {
              const on = driverIds.includes(d.id);
              return (
                <Button key={d.id} type="button" size="sm" variant={on ? "default" : "outline"} onClick={() => toggleDriver(d.id)} disabled={locked}>
                  {d.full_name}
                </Button>
              );
            })}
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1 max-w-xs">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="w-3 h-3" /> Veículo</label>
              <Select value={vehicleId} onValueChange={setVehicleId} disabled={locked}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} — {v.model}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={saveDrivers} disabled={locked}>Salvar</Button>
          </div>
          {vehicle && locked && <div className="text-xs text-muted-foreground">Veículo em uso: {vehicle.plate}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Sequência de entregas</CardTitle>
          {day.status === "aberta" ? (
            <Button onClick={doClose} disabled={!driverIds.length || !orders.length}><Lock className="w-4 h-4 mr-1" /> Fechar rota do dia</Button>
          ) : (
            <Button variant="outline" onClick={doReopen}><Unlock className="w-4 h-4 mr-1" /> Reabrir</Button>
          )}
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Nenhum pedido lançado para esta data. Vá em Pedidos e associe pedidos a esta rota + data.</div>
          ) : (
            <div className="space-y-2">
              {orders.map((o: any, i: number) => {
                const w = WIN_META[o.pdv_window || "qualquer"] || WIN_META.qualquer;
                const WIcon = w.icon;
                return (
                  <div key={o.id} className="flex items-center gap-3 border rounded p-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{o.pdv_name}</div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1"><MapPin className="w-3 h-3" /> {o.pdv_address}</div>
                      <div className="text-xs mt-1">Pedido <span className="font-mono">{o.order_number || "—"}</span> · {o.weight_kg || 0} kg</div>
                    </div>
                    <Badge className={w.color + " gap-1"}><WIcon className="w-3 h-3" /> {w.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
