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
import { useSRDepots } from "@/hooks/use-smartroute-depots";
import { SimulationRunnerDialog } from "@/components/smartroute/SimulationRunnerDialog";
import { api } from "@/lib/api";
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

// km/min médios em cidade (fallback quando OSRM indisponível)
const AVG_SPEED_KMH = 30;
// tempo por item de checklist (min)
const CHECKLIST_ITEM_MIN = 0.5;

function todaySaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function parseClockToMin(value?: string | null) {
  if (!value) return null;
  const m = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return Math.max(0, Math.min(24 * 60, hh * 60 + mm));
}

function getWindowKey(order: any) {
  return (order?.effective_pdv_window || order?.pdv_window || order?.route_pdv_window || order?.pdv_default_window || order?.delivery_window || "qualquer") as string;
}

function getWindowBounds(order: any) {
  const key = getWindowKey(order);
  const preset = WIN_BOUNDS[key] || WIN_BOUNDS.qualquer;
  const explicitStart = parseClockToMin(order?.pdv_window_start || order?.delivery_window_start);
  const explicitEnd = parseClockToMin(order?.pdv_window_end || order?.delivery_window_end);
  const start = explicitStart ?? preset.start;
  const end = explicitEnd ?? preset.end;
  const sortStart = explicitStart ?? (key === "qualquer" ? 24 * 60 : preset.start);
  return { ...preset, start, end, key, sortStart, hasExactTime: explicitStart != null || explicitEnd != null };
}

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

// OSRM público — calcula rota real por ruas (como Uber/iFood).
// A consulta é feita por trecho para garantir CD → PDV1, PDV1 → PDV2 e retorno ao CD,
// evitando limite de waypoints/URL quando a rota tem muitas paradas.
type OsrmLeg = { km: number; min: number; fallback?: boolean; fromLabel?: string; toLabel?: string };
type OsrmResult = { legs: OsrmLeg[]; geometry: [number, number][]; fallbackLegs: number };
async function fetchOsrmSegment(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<{ leg: OsrmLeg; geometry: [number, number][]; ok: boolean }> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error("OSRM indisponível");
    const j = await r.json();
    const route = j?.routes?.[0];
    if (!route) throw new Error("Rota OSRM vazia");
    const rawLeg = route.legs?.[0] || {};
    const geometry: [number, number][] = (route.geometry?.coordinates || []).map((c: [number, number]) => [c[1], c[0]]);
    return { leg: { km: (rawLeg.distance || 0) / 1000, min: (rawLeg.duration || 0) / 60 }, geometry, ok: true };
  } catch {
    const km = haversineKm(from, to);
    return { leg: { km, min: (km / AVG_SPEED_KMH) * 60, fallback: true }, geometry: [[from.lat, from.lng], [to.lat, to.lng]], ok: false };
  }
}

async function fetchOsrmRoute(points: Array<{ lat: number; lng: number; label?: string }>): Promise<OsrmResult | null> {
  if (points.length < 2) return null;
  try {
    return await api<OsrmResult>("/api/smartroute/routes/street-route", {
      method: "POST",
      body: { points },
      silent: true,
    });
  } catch {
    // Fallback local para não travar o simulador caso o proxy de rotas esteja indisponível.
  }
  const legs: OsrmLeg[] = [];
  const geometry: [number, number][] = [];
  let fallbackLegs = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const res = await fetchOsrmSegment(from, to);
    if (!res.ok) fallbackLegs++;
    legs.push({ ...res.leg, fromLabel: from.label, toLabel: to.label });
    res.geometry.forEach((p, idx) => {
      if (i > 0 && idx === 0) return;
      geometry.push(p);
    });
  }
  return { legs, geometry, fallbackLegs };
}


export default function SmartRouteSimulador() {
  const [params, setParams] = useSearchParams();
  const { data: templates = [] } = useSRTemplates();
  const { data: depots = [] } = useSRDepots();
  const routeId = params.get("route") || "";
  const date = params.get("date") || todaySaoPaulo();
  const setP = (k: string, v: string) => { const p = new URLSearchParams(params); p.set(k, v); setParams(p, { replace: true }); };

  const { data, isLoading, refetch } = useSRRouteDay(routeId, date);
  const saveSeq = useSRSaveDaySequence();

  const [startHour, setStartHour] = useState("08:00");
  const [autoDeparture, setAutoDeparture] = useState(true);
  const [order, setOrder] = useState<any[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [osrm, setOsrm] = useState<OsrmResult | null>(null);
  const [osrmLoading, setOsrmLoading] = useState(false);

  const route = data?.route;
  const upsellMin = Number(route?.upsell_time_min || 0);
  const fallbackDepot = depots.find((d: any) => d.id === route?.depot_id) || depots.find((d: any) => d.is_default) || depots[0];
  const depot = {
    lat: route?.depot_lat ?? fallbackDepot?.lat,
    lng: route?.depot_lng ?? fallbackDepot?.lng,
    name: route?.depot_name || fallbackDepot?.name || "Centro de Distribuição",
  };

  // Reordena automaticamente respeitando a janela de entrega do PDV.
  // Agrupa por janela (manhã → tarde → noite → qualquer) e, dentro de cada grupo,
  // aplica nearest-neighbor partindo do último ponto (ou do CD).
  const autoSortByWindow = (list: any[], depot: { lat?: number; lng?: number }) => {
    let cursor = { lat: depot.lat, lng: depot.lng };
    const out: any[] = [];
    const byExactWindow = new Map<string, any[]>();
    list.forEach((o) => {
      const b = getWindowBounds(o);
      const key = `${b.sortStart}:${b.end}:${b.order}`;
      byExactWindow.set(key, [...(byExactWindow.get(key) || []), o]);
    });
    const buckets = Array.from(byExactWindow.entries())
      .map(([key, items]) => ({ key, items, sort: key.split(":").map(Number) }))
      .sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1] || a.sort[2] - b.sort[2]);
    for (const group of buckets) {
      const bucket = group.items.slice();
      while (bucket.length) {
        let bestI = 0, bestD = Infinity;
        bucket.forEach((o, i) => {
          const d = cursor.lat && o.pdv_lat ? haversineKm(cursor, { lat: o.pdv_lat, lng: o.pdv_lng }) : 0;
          if (d < bestD) { bestD = d; bestI = i; }
        });
        const chosen = bucket.splice(bestI, 1)[0];
        out.push(chosen);
        if (chosen.pdv_lat) cursor = { lat: chosen.pdv_lat, lng: chosen.pdv_lng };
      }
    }
    return out;
  };

  useEffect(() => {
    if (data?.orders) {
      const sorted = autoSortByWindow(data.orders, depot);
      setOrder(sorted);
      setDirty(false);
    }
  }, [data?.orders, depot.lat, depot.lng]);

  const runSimulation = async () => {
    setShowResult(false);
    setSimOpen(true);
    try { await refetch(); } catch {}
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= order.length) return;
    const next = order.slice(); [next[i], next[j]] = [next[j], next[i]];
    setOrder(next); setDirty(true);
  };
  const reset = () => {
    if (data?.orders) {
      const sorted = autoSortByWindow(data.orders, depot);
      setOrder(sorted); setDirty(false);
    }
  };
  const applyAutoSort = () => {
    const sorted = autoSortByWindow(order, depot);
    setOrder(sorted); setDirty(true);
    toast.success("Sequência reorganizada respeitando as janelas de cada PDV");
  };

  // Busca a rota real por ruas (OSRM) — CD → PDVs → CD
  useEffect(() => {
    const hasFullCoordinates = !!depot.lat && !!depot.lng && order.every((o) => !!o.pdv_lat && !!o.pdv_lng);
    if (!hasFullCoordinates) { setOsrm(null); return; }
    const points: Array<{ lat: number; lng: number; label?: string }> = [
      { lat: depot.lat, lng: depot.lng, label: "CD" },
      ...order.map((o, idx) => ({ lat: o.pdv_lat, lng: o.pdv_lng, label: `${idx + 1}. ${o.pdv_name || "PDV"}` })),
      { lat: depot.lat, lng: depot.lng, label: "Retorno ao CD" },
    ];
    let cancelled = false;
    setOsrm(null);
    setOsrmLoading(true);
    fetchOsrmRoute(points).then((res) => {
      if (cancelled) return;
      setOsrm(res);
      setOsrmLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depot.lat, depot.lng, order.map((o) => `${o.id}:${o.pdv_lat},${o.pdv_lng}`).join("|")]);

  // Cálculo de ETAs / durações — usa distância real (OSRM) quando disponível, respeitando janela do PDV.
  // Duas passadas: 1) calcula assumindo início em startHour para obter a espera do 1º stop;
  // 2) se autoDeparture, atrasa a saída do CD para chegar exatamente na abertura do 1º stop.
  const computed = useMemo(() => {
    const [hh, mm] = (startHour || "08:00").split(":").map(Number);
    const startMin = (hh || 8) * 60 + (mm || 0);

    const legKm = (i: number, from: any, to: any) => {
      const real = osrm?.legs?.length === order.length + 1 ? osrm?.legs?.[i]?.km : undefined;
      if (real != null) return real;
      return from?.lat && to?.lat ? haversineKm(from, to) : 0;
    };
    const legMin = (i: number, from: any, to: any) => {
      const real = osrm?.legs?.length === order.length + 1 ? osrm?.legs?.[i]?.min : undefined;
      if (real != null) return real;
      return ((from?.lat && to?.lat ? haversineKm(from, to) : 0) / AVG_SPEED_KMH) * 60;
    };

    const simulate = (departure: number) => {
      let cursor = { lat: depot.lat, lng: depot.lng };
      let t = departure;
      let totalKm = 0, totalTravel = 0, totalService = 0, totalUpsell = 0, totalChecklist = 0, totalWait = 0;
      const stops = order.map((o, idx) => {
        const dest = { lat: o.pdv_lat, lng: o.pdv_lng };
        const km = legKm(idx, cursor, dest);
        const travel = legMin(idx, cursor, dest);
        const service = Number(o.pdv_service_time_min || 15);
        const checklist = Number(o.checklist_items_count || 0) * CHECKLIST_ITEM_MIN;
        const upsell = upsellMin;
        const rawArrival = t + travel;
        const bounds = getWindowBounds(o);
        const win = bounds.key;
        const wait = Math.max(0, bounds.start - rawArrival);
        const arrival = rawArrival + wait;
        const violation = arrival > bounds.end ? Math.round(arrival - bounds.end) : 0;
        const departureStop = arrival + service + checklist + upsell;
        t = departureStop;
        if (dest.lat) cursor = dest;
        totalKm += km; totalTravel += travel; totalService += service;
        totalChecklist += checklist; totalUpsell += upsell; totalWait += wait;
        return {
          order: o, km, travel, service, checklist, upsell, wait, violation,
          arrival, departure: departureStop, window: win,
          stopMin: service + checklist + upsell + travel + wait,
        };
      });
      // Retorno ao CD (última leg do OSRM)
      const returnKm = legKm(order.length, cursor, { lat: depot.lat, lng: depot.lng });
      const returnTravel = legMin(order.length, cursor, { lat: depot.lat, lng: depot.lng });
      totalKm += returnKm; totalTravel += returnTravel;
      const totalMin = totalTravel + totalService + totalChecklist + totalUpsell + totalWait;
      return {
        stops,
        returnLeg: { km: returnKm, travel: returnTravel, arrival: t + returnTravel },
        totals: { km: totalKm, travel: totalTravel, service: totalService, checklist: totalChecklist, upsell: totalUpsell, wait: totalWait, totalMin },
        departureFromCD: departure,
      };
    };

    // Passada 1
    const first = simulate(startMin);
    // Ajuste automático de saída: se o 1º PDV tem espera, atrasa a saída do CD para chegar na abertura real da janela.
    // Usa o trecho CD → PDV1; nunca sai antes do início da jornada informado.
    let adjustedDeparture = startMin;
    if (autoDeparture && first.stops.length && first.stops[0].wait > 0) {
      adjustedDeparture = Math.max(startMin, first.stops[0].arrival - first.stops[0].travel);
    }
    // Se ajustou, roda passada 2
    return adjustedDeparture !== startMin ? simulate(adjustedDeparture) : first;
  }, [order, startHour, autoDeparture, osrm, depot.lat, depot.lng, upsellMin]);

  const departureShifted = computed.departureFromCD - ((parseInt(startHour.slice(0,2))||8)*60 + (parseInt(startHour.slice(3,5))||0));


  const violations = computed.stops.filter((s) => s.violation > 0).length;

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
  const hasDepotCoordinates = !!depot.lat && !!depot.lng;

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
          <label className="flex items-center gap-2 text-xs text-muted-foreground pb-2 cursor-pointer select-none">
            <input type="checkbox" checked={autoDeparture} onChange={(e) => setAutoDeparture(e.target.checked)} />
            Ajustar saída do CD automaticamente para chegar na janela do 1º PDV
          </label>
          <div className="text-xs text-muted-foreground pb-2">
            Upsell/PDV: <b>{upsellMin} min</b> · Rota real: <b>{osrmLoading ? "calculando ruas…" : osrm ? (osrm.fallbackLegs ? `OSRM + fallback em ${osrm.fallbackLegs} trecho(s)` : "por ruas (OSRM)") : "aguardando coordenadas"}</b>
          </div>

        </CardContent>
      </Card>

      {!routeId ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Escolha uma rota acima para simular.</div>
      ) : isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando…</div>
      ) : !order.length ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Nenhum pedido lançado para esta data.</div>
      ) : !hasDepotCoordinates ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Warehouse className="w-6 h-6" />
            </div>
            <div className="font-semibold">CD sem coordenadas</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Cadastre ou atualize a geolocalização do Centro de Distribuição para a simulação calcular CD → PDVs → retorno ao CD.
            </p>
          </CardContent>
        </Card>
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
      ) : osrmLoading ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <RouteIcon className="w-6 h-6 animate-pulse" />
            </div>
            <div className="font-semibold">Calculando trajeto real por ruas</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Buscando cada trecho: CD → primeiro PDV, paradas intermediárias e retorno ao CD.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Totais */}
          <div className="grid md:grid-cols-6 gap-3">
            <StatCard icon={Package} label="Paradas" value={String(order.length)} />
            <StatCard icon={MapPin} label="Distância (c/ retorno)" value={`${computed.totals.km.toFixed(1)} km`} />
            <StatCard icon={Timer} label="Deslocamento" value={fmtDur(computed.totals.travel)} />
            <StatCard icon={ClipboardCheck} label="Serviço + Checklist" value={fmtDur(computed.totals.service + computed.totals.checklist)} />
            <StatCard icon={TrendingUp} label="Upsell" value={fmtDur(computed.totals.upsell)} highlight />
            <StatCard
              icon={AlertTriangle}
              label={violations > 0 ? `${violations} fora da janela` : "Janelas OK"}
              value={computed.totals.wait > 0 ? `Espera ${fmtDur(computed.totals.wait)}` : "—"}
              highlight={violations > 0}
            />
          </div>

          {/* Mapa do trajeto */}
          <TrajectoryMap depot={depot} stops={computed.stops} geometry={osrm?.geometry || null} />

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Sequência simulada</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Saída do CD <b>{fmtHM(computed.departureFromCD)}</b>
                  {" "}· Fim previsto <b>{fmtHM(computed.departureFromCD + computed.totals.totalMin)}</b>
                  {" "}· Duração total <b>{fmtDur(computed.totals.totalMin)}</b>
                  {" "}· Retorno ao CD <b>{computed.returnLeg.km.toFixed(1)} km</b> ({fmtHM(computed.returnLeg.arrival)})
                  {departureShifted > 0 && (
                    <Badge className="ml-2 bg-sky-100 text-sky-700 gap-1">
                      <Clock className="w-3 h-3" /> Saída adiada +{fmtDur(departureShifted)} p/ chegar na janela
                    </Badge>
                  )}
                  {dirty && <Badge className="ml-2 bg-amber-100 text-amber-700">Alterações não salvas</Badge>}
                  {locked && <Badge className="ml-2 bg-blue-100 text-blue-700">Rota publicada · edição bloqueada</Badge>}
                  {violations > 0 && <Badge className="ml-2 bg-red-100 text-red-700 gap-1"><AlertTriangle className="w-3 h-3" /> {violations} PDV(s) fora da janela</Badge>}
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={applyAutoSort} disabled={locked}>
                  <Sparkles className="w-4 h-4 mr-1" /> Reorganizar por janela
                </Button>
                <Button variant="ghost" size="sm" onClick={reset} disabled={!dirty}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Descartar simulação
                </Button>
                <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!dirty || locked || saveSeq.isPending}>
                  <Save className="w-4 h-4 mr-1" /> Salvar como oficial
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Saída do CD */}
              <div className="border rounded-lg p-3 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Warehouse className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-sm">
                    <b>Saída do CD</b> — {depot.name}
                    <div className="text-xs text-muted-foreground">
                      Início real da rota <span className="font-mono font-semibold">{fmtHM(computed.departureFromCD)}</span>
                      {computed.stops[0] && (
                        <> · 1º trecho até <b>{computed.stops[0].order.pdv_name}</b>: {computed.stops[0].km.toFixed(1)} km · {fmtDur(computed.stops[0].travel)}</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {computed.stops.map((s, i) => {
                const o = s.order;
                const bounds = getWindowBounds(o);
                const w = WIN_META[bounds.key] || WIN_META.qualquer;
                const WIcon = w.icon;
                const pct = (s.stopMin / maxStop) * 100;
                return (
                  <div key={o.id} className={"border rounded-lg p-3 " + (s.violation > 0 ? "border-red-300 bg-red-50/40" : "")}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white" style={{ background: w.hex }}>{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{o.pdv_name}</span>
                          <Badge className={w.color + " gap-1"}><WIcon className="w-3 h-3" /> {w.label} {bounds.hasExactTime ? `${fmtHM(bounds.start)}-${fmtHM(bounds.end)}` : ""}</Badge>
                          <span className="text-xs text-muted-foreground">{o.order_number || "—"}</span>
                          {s.wait > 0 && (
                            <Badge className="bg-sky-100 text-sky-700 gap-1"><Clock className="w-3 h-3" /> Espera {fmtDur(s.wait)}</Badge>
                          )}
                          {s.violation > 0 && (
                            <Badge className="bg-red-100 text-red-700 gap-1"><AlertTriangle className="w-3 h-3" /> Fora da janela (+{fmtDur(s.violation)})</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {o.pdv_address}
                        </div>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-x-3 gap-y-1 text-xs">
                          <span>🚚 {i === 0 ? "CD" : `PDV ${i}`} → PDV {i + 1}: {s.km.toFixed(1)} km · {fmtDur(s.travel)}</span>
                          <span>⏱ Serviço {fmtDur(s.service)}</span>
                          <span>📋 Checklist {fmtDur(s.checklist)} <span className="text-muted-foreground">({o.checklist_items_count || 0} itens)</span></span>
                          <span>💰 Upsell {fmtDur(s.upsell)}</span>
                          <span className="font-mono">
                            <b>{fmtHM(s.arrival)}</b> → {fmtHM(s.departure)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded bg-slate-100 overflow-hidden flex">
                          <div className="bg-sky-400" style={{ width: `${(s.travel / s.stopMin) * pct}%` }} title="Deslocamento" />
                          {s.wait > 0 && <div className="bg-sky-200" style={{ width: `${(s.wait / s.stopMin) * pct}%` }} title="Espera" />}
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
              {/* Retorno ao CD */}
              <div className="border rounded-lg p-3 border-dashed bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0">
                    <Warehouse className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-sm">
                    <b>Retorno ao CD</b> — {depot.name}
                    <div className="text-xs text-muted-foreground">
                      🚚 {computed.returnLeg.km.toFixed(1)} km · {fmtDur(computed.returnLeg.travel)} · Chegada prevista <span className="font-mono font-semibold">{fmtHM(computed.returnLeg.arrival)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center pt-2 text-xs text-muted-foreground flex-wrap">
                <span className="inline-block w-3 h-2 bg-sky-400 rounded-sm" /> Deslocamento
                <span className="inline-block w-3 h-2 bg-sky-200 rounded-sm ml-3" /> Espera janela
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

function TrajectoryMap({ depot, stops, geometry }: { depot: { lat?: number; lng?: number; name?: string }; stops: any[]; geometry: [number, number][] | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([-23.5505, -46.6333], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "© OpenStreetMap",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const layer = layerRef.current, map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    const path: [number, number][] = [];
    const bounds: [number, number][] = [];

    if (depot.lat && depot.lng) {
      const depotIcon = L.divIcon({
        className: "",
        html: `<div style="background:#111827;color:#fff;width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:11px;font-weight:700">CD</div>`,
        iconSize: [34, 34], iconAnchor: [17, 17],
      });
      L.marker([depot.lat, depot.lng], { icon: depotIcon })
        .bindPopup(`<b>${depot.name || "Centro de Distribuição"}</b>`)
        .addTo(layer);
      path.push([depot.lat, depot.lng]);
      bounds.push([depot.lat, depot.lng]);
    }

    stops.forEach((s, i) => {
      const o = s.order;
      if (!o.pdv_lat || !o.pdv_lng) return;
      const boundsMeta = getWindowBounds(o);
      const meta = WIN_META[boundsMeta.key] || WIN_META.qualquer;
      const isViolation = s.violation > 0;
      const bg = isViolation ? "#dc2626" : meta.hex;
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${bg};color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:12px;font-weight:700">${i + 1}</div>`,
        iconSize: [30, 30], iconAnchor: [15, 15],
      });
      L.marker([o.pdv_lat, o.pdv_lng], { icon })
        .bindPopup(
          `<b>${i + 1}. ${o.pdv_name}</b><br/>` +
          `Janela: <b>${meta.label}${boundsMeta.hasExactTime ? ` ${fmtHM(boundsMeta.start)}-${fmtHM(boundsMeta.end)}` : ""}</b><br/>` +
          `ETA: <b>${String(Math.floor(s.arrival / 60) % 24).padStart(2, "0")}:${String(Math.round(s.arrival) % 60).padStart(2, "0")}</b><br/>` +
          `Trecho: ${s.km.toFixed(1)} km` +
          (isViolation ? `<br/><span style="color:#dc2626"><b>⚠ Fora da janela</b></span>` : "") +
          (s.wait > 0 ? `<br/><span style="color:#0284c7">⏳ Espera até abertura</span>` : "")
        )
        .addTo(layer);
      path.push([o.pdv_lat, o.pdv_lng]);
      bounds.push([o.pdv_lat, o.pdv_lng]);
    });

    // Retorno ao CD (fallback straight-line)
    if (depot.lat && depot.lng && path.length > 1) {
      path.push([depot.lat, depot.lng]);
    }

    // Se temos geometria real do OSRM, desenha o trajeto por ruas; senão, linha reta pontilhada.
    if (geometry && geometry.length >= 2) {
      L.polyline(geometry, { color: "#6366f1", weight: 5, opacity: 0.85 }).addTo(layer);
      geometry.forEach((p) => bounds.push(p));
    } else if (path.length >= 2) {
      L.polyline(path, { color: "#6366f1", weight: 4, opacity: 0.6, dashArray: "6,6" }).addTo(layer);
    }

    if (bounds.length) {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [depot.lat, depot.lng, stops, geometry]);


  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Trajeto no mapa
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Saída do CD → paradas na ordem simulada → retorno ao CD. Pinos coloridos por janela; vermelho = fora da janela.
        </p>
      </CardHeader>
      <CardContent className="p-2">
        <div ref={containerRef} style={{ height: 420, width: "100%" }} className="rounded" />
      </CardContent>
    </Card>
  );
}
