import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PlayCircle, ArrowUp, ArrowDown, RotateCcw, Save, Clock, MapPin,
  Package, Sun, Sunset, Moon, ClipboardCheck, TrendingUp, Timer, Route as RouteIcon, Sparkles,
  AlertTriangle, Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { useSRTemplates, useSRRouteDay, useSRSaveDaySequence } from "@/hooks/use-smartroute-daily";
import { SimulationRunnerDialog } from "@/components/smartroute/SimulationRunnerDialog";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const WIN_META: Record<string, { label: string; icon: any; color: string; hex: string }> = {
  manha: { label: "Manhã", icon: Sun, color: "bg-amber-100 text-amber-700", hex: "#f59e0b" },
  tarde: { label: "Tarde", icon: Sunset, color: "bg-orange-100 text-orange-700", hex: "#fb923c" },
  noite: { label: "Noite", icon: Moon, color: "bg-indigo-100 text-indigo-700", hex: "#6366f1" },
  qualquer: { label: "—", icon: Clock, color: "bg-slate-100 text-slate-700", hex: "#64748b" },
};

// Faixas horárias por janela (minutos desde 00:00)
const WIN_BOUNDS: Record<string, { start: number; end: number; order: number }> = {
  manha:    { start: 8 * 60,  end: 12 * 60, order: 1 },
  tarde:    { start: 13 * 60, end: 18 * 60, order: 2 },
  noite:    { start: 18 * 60, end: 22 * 60, order: 3 },
  qualquer: { start: 0,       end: 24 * 60, order: 4 },
};

// km/min médios em cidade
const AVG_SPEED_KMH = 30;
// tempo por item de checklist (min)
const CHECKLIST_ITEM_MIN = 0.5;

function haversineKm(a: any, b: any) {
  if (!a?.lat || !b?.lat) return 0;
  const R = 6371, toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function fmtHM(minsFromMidnight: number) {
  const m = Math.max(0, Math.round(minsFromMidnight));
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function fmtDur(min: number) {
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m}min`;
}

export default function SmartRouteSimulador() {
  const [params, setParams] = useSearchParams();
  const { data: templates = [] } = useSRTemplates();
  const routeId = params.get("route") || "";
  const date = params.get("date") || new Date().toISOString().slice(0, 10);
  const setP = (k: string, v: string) => { const p = new URLSearchParams(params); p.set(k, v); setParams(p, { replace: true }); };

  const { data, isLoading, refetch } = useSRRouteDay(routeId, date);
  const saveSeq = useSRSaveDaySequence();

  const [startHour, setStartHour] = useState("08:00");
  const [order, setOrder] = useState<any[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (data?.orders) { setOrder(data.orders); setDirty(false); }
  }, [data?.orders]);

  const runSimulation = async () => {
    setShowResult(false);
    setSimOpen(true);
    try { await refetch(); } catch {}
  };

  const route = data?.route;
  const upsellMin = Number(route?.upsell_time_min || 0);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= order.length) return;
    const next = order.slice(); [next[i], next[j]] = [next[j], next[i]];
    setOrder(next); setDirty(true);
  };
  const reset = () => { if (data?.orders) { setOrder(data.orders); setDirty(false); } };

  // Cálculo de ETAs / durações
  const computed = useMemo(() => {
    const [hh, mm] = (startHour || "08:00").split(":").map(Number);
    let cursor = { lat: route?.depot_lat, lng: route?.depot_lng };
    let t = (hh || 8) * 60 + (mm || 0);
    let totalKm = 0, totalTravel = 0, totalService = 0, totalUpsell = 0, totalChecklist = 0;
    const stops = order.map((o) => {
      const dest = { lat: o.pdv_lat, lng: o.pdv_lng };
      const km = cursor.lat && dest.lat ? haversineKm(cursor, dest) : 0;
      const travel = (km / AVG_SPEED_KMH) * 60;
      const service = Number(o.pdv_service_time_min || 15);
      const checklist = Number(o.checklist_items_count || 0) * CHECKLIST_ITEM_MIN;
      const upsell = upsellMin;
      const arrival = t + travel;
      const departure = arrival + service + checklist + upsell;
      t = departure;
      if (dest.lat) cursor = dest;
      totalKm += km; totalTravel += travel; totalService += service; totalChecklist += checklist; totalUpsell += upsell;
      return {
        order: o, km, travel, service, checklist, upsell,
        arrival, departure, stopMin: service + checklist + upsell + travel,
      };
    });
    const totalMin = totalTravel + totalService + totalChecklist + totalUpsell;
    return { stops, totals: { km: totalKm, travel: totalTravel, service: totalService, checklist: totalChecklist, upsell: totalUpsell, totalMin } };
  }, [order, startHour, route?.depot_lat, route?.depot_lng, upsellMin]);

  const maxStop = Math.max(1, ...computed.stops.map((s) => s.stopMin));

  const doSave = async () => {
    try {
      await saveSeq.mutateAsync({ routeId, date, order_ids: order.map((o) => o.id) });
      toast.success("Sequência registrada como oficial");
      setDirty(false); setConfirmOpen(false); refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const status = data?.day?.status;
  const locked = ["publicada", "em_andamento", "concluida"].includes(status || "");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PlayCircle className="w-6 h-6 text-primary" /> Simulador de Rota
          </h1>
          <p className="text-sm text-muted-foreground">
            Ajuste a ordem das paradas, veja tempo estimado por PDV e total da rota. Salve como oficial ou descarte a simulação.
          </p>
        </div>
        <div className="flex gap-2">
          {routeId && (
            <Button size="sm" onClick={runSimulation} className="bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white">
              <Sparkles className="w-4 h-4 mr-1" /> Rodar Simulação
            </Button>
          )}
          {routeId && date && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/smartroute/rota-do-dia?route=${routeId}&date=${date}`}>
                <RouteIcon className="w-4 h-4 mr-1" /> Ver Rota do Dia
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-muted-foreground">Rota</label>
            <Select value={routeId} onValueChange={(v) => setP("route", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione uma rota" /></SelectTrigger>
              <SelectContent>{templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Data</label>
            <Input type="date" value={date} onChange={(e) => setP("date", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Início da jornada</label>
            <Input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} className="w-32" />
          </div>
          <div className="text-xs text-muted-foreground pb-2">
            Upsell/PDV: <b>{upsellMin} min</b> · Velocidade média: <b>{AVG_SPEED_KMH} km/h</b>
          </div>
        </CardContent>
      </Card>

      {!routeId ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Escolha uma rota acima para simular.</div>
      ) : isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando…</div>
      ) : !order.length ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Nenhum pedido lançado para esta data.</div>
      ) : !showResult ? (
        <Card>
          <CardContent className="p-10 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="font-semibold text-lg">Pronto para simular</div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {order.length} pedido(s) prontos. Rode a simulação para ver a sequência otimizada, ETAs por PDV e tempo total da rota.
              </p>
            </div>
            <Button onClick={runSimulation} className="bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white">
              <Sparkles className="w-4 h-4 mr-2" /> Rodar Simulação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Totais */}
          <div className="grid md:grid-cols-5 gap-3">
            <StatCard icon={Package} label="Paradas" value={String(order.length)} />
            <StatCard icon={MapPin} label="Distância" value={`${computed.totals.km.toFixed(1)} km`} />
            <StatCard icon={Timer} label="Deslocamento" value={fmtDur(computed.totals.travel)} />
            <StatCard icon={ClipboardCheck} label="Serviço + Checklist" value={fmtDur(computed.totals.service + computed.totals.checklist)} />
            <StatCard icon={TrendingUp} label="Upsell" value={fmtDur(computed.totals.upsell)} highlight />
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Sequência simulada</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Início {startHour} · Fim previsto <b>{fmtHM((parseInt(startHour.slice(0,2))||8)*60 + (parseInt(startHour.slice(3,5))||0) + computed.totals.totalMin)}</b>
                  {" "}· Duração total <b>{fmtDur(computed.totals.totalMin)}</b>
                  {dirty && <Badge className="ml-2 bg-amber-100 text-amber-700">Alterações não salvas</Badge>}
                  {locked && <Badge className="ml-2 bg-blue-100 text-blue-700">Rota publicada · edição bloqueada</Badge>}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={reset} disabled={!dirty}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Descartar simulação
                </Button>
                <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!dirty || locked || saveSeq.isPending}>
                  <Save className="w-4 h-4 mr-1" /> Salvar como oficial
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {computed.stops.map((s, i) => {
                const o = s.order;
                const w = WIN_META[o.pdv_window || "qualquer"] || WIN_META.qualquer;
                const WIcon = w.icon;
                const pct = (s.stopMin / maxStop) * 100;
                return (
                  <div key={o.id} className="border rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{o.pdv_name}</span>
                          <Badge className={w.color + " gap-1"}><WIcon className="w-3 h-3" /> {w.label}</Badge>
                          <span className="text-xs text-muted-foreground">{o.order_number || "—"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {o.pdv_address}
                        </div>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-x-3 gap-y-1 text-xs">
                          <span>🚚 {s.km.toFixed(1)} km · {fmtDur(s.travel)}</span>
                          <span>⏱ Serviço {fmtDur(s.service)}</span>
                          <span>📋 Checklist {fmtDur(s.checklist)} <span className="text-muted-foreground">({o.checklist_items_count || 0} itens)</span></span>
                          <span>💰 Upsell {fmtDur(s.upsell)}</span>
                          <span className="font-mono">
                            <b>{fmtHM(s.arrival)}</b> → {fmtHM(s.departure)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded bg-slate-100 overflow-hidden flex">
                          <div className="bg-sky-400" style={{ width: `${(s.travel / s.stopMin) * pct}%` }} title="Deslocamento" />
                          <div className="bg-emerald-400" style={{ width: `${(s.service / s.stopMin) * pct}%` }} title="Serviço" />
                          <div className="bg-violet-400" style={{ width: `${(s.checklist / s.stopMin) * pct}%` }} title="Checklist" />
                          <div className="bg-amber-400" style={{ width: `${(s.upsell / s.stopMin) * pct}%` }} title="Upsell" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button size="icon" variant="outline" className="h-7 w-7" disabled={i === 0 || locked} onClick={() => move(i, -1)}>
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-7 w-7" disabled={i === order.length - 1 || locked} onClick={() => move(i, 1)}>
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-2 items-center pt-2 text-xs text-muted-foreground">
                <span className="inline-block w-3 h-2 bg-sky-400 rounded-sm" /> Deslocamento
                <span className="inline-block w-3 h-2 bg-emerald-400 rounded-sm ml-3" /> Serviço
                <span className="inline-block w-3 h-2 bg-violet-400 rounded-sm ml-3" /> Checklist
                <span className="inline-block w-3 h-2 bg-amber-400 rounded-sm ml-3" /> Upsell
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar sequência oficial?</AlertDialogTitle>
            <AlertDialogDescription>
              A nova ordem substituirá a sequência atual e será considerada pelo app do entregador ao publicar.
              Se preferir apenas explorar, escolha <b>Manter como simulação</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter como simulação</AlertDialogCancel>
            <AlertDialogAction onClick={doSave}>Registrar como oficial</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SimulationRunnerDialog
        open={simOpen}
        onDone={() => { setSimOpen(false); setShowResult(true); }}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: any) {
  return (
    <Card className={highlight ? "border-amber-300" : ""}>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</div>
        <div className="text-lg font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
