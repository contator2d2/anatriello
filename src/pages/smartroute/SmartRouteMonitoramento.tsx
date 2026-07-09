import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSRMonitor, useSRStopSummary } from "@/hooks/use-smartroute-checklists";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity, AlertTriangle, Clock, MapPin, Radio, Truck, CheckCircle2,
  PackageX, Signal, RefreshCw, Timer,
} from "lucide-react";
import { Link } from "react-router-dom";

const STATUS_COLOR: Record<string, string> = {
  em_rota: "#10b981", em_pdv: "#f59e0b", disponivel: "#3b82f6", offline: "#94a3b8",
};

function fmtDuration(sec?: number) {
  if (!sec || sec < 0) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h${(m % 60).toString().padStart(2, "0")}`;
}

const KPI = ({ icon: Icon, label, value, tone = "default" }: any) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        tone === "green" ? "bg-emerald-100 text-emerald-700"
        : tone === "amber" ? "bg-amber-100 text-amber-700"
        : tone === "red" ? "bg-red-100 text-red-700"
        : "bg-blue-100 text-blue-700"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value ?? 0}</div>
      </div>
    </CardContent>
  </Card>
);

const EVENT_LABELS: Record<string, string> = {
  journey_started: "Jornada iniciada",
  stop_navigate: "Navegando para PDV",
  stop_checkin: "Check-in",
  stop_checkin_denied: "Check-in negado",
  checklist_item_answered: "Item de checklist",
  occurrence_added: "Ocorrência",
  stop_signed: "Assinatura",
  stop_checkout: "Check-out",
  journey_finished: "Jornada finalizada",
};

export default function SmartRouteMonitoramento() {
  const { data, isLoading, refetch, isFetching } = useSRMonitor();
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const { data: stopDetail } = useSRStopSummary(selectedStop || undefined);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([-23.55, -46.63], 11);
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
    const drivers = (data?.drivers || []).filter((d: any) => d.current_lat != null && d.current_lng != null);
    const bounds: [number, number][] = [];
    drivers.forEach((d: any) => {
      const color = STATUS_COLOR[d.current_status] || "#94a3b8";
      const stale = d.gps_age_sec != null && d.gps_age_sec > 300;
      const marker = L.circleMarker([d.current_lat, d.current_lng], {
        radius: 10, color, fillColor: color, fillOpacity: 0.85, weight: stale ? 3 : 1,
        dashArray: stale ? "3 3" : undefined,
      }).addTo(layer);
      marker.bindTooltip(
        `<b>${d.full_name}</b><br/>${d.plate || "—"} · ${d.route_code || "sem rota"}<br/>GPS: ${fmtDuration(d.gps_age_sec)} atrás`,
        { direction: "top" }
      );
      bounds.push([d.current_lat, d.current_lng]);
    });
    if (bounds.length) map.fitBounds(bounds as any, { padding: [40, 40], maxZoom: 13 });
  }, [data]);

  const k = data?.kpis || {};
  const alerts = data?.alerts || [];
  const activeStops = data?.active_stops || [];
  const events = data?.recent_events || [];

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white">
            <Radio className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Torre de Controle</h1>
            <p className="text-sm text-muted-foreground">
              Monitoramento ao vivo · atualiza a cada 15s
              {data?.generated_at && ` · última: ${new Date(data.generated_at).toLocaleTimeString("pt-BR")}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI icon={Truck} label="Em rota" value={k.drivers_em_rota} tone="green" />
          <KPI icon={Clock} label="Em atendimento" value={k.stops_em_atendimento} tone="amber" />
          <KPI icon={CheckCircle2} label="Concluídas hoje" value={k.stops_concluidas_hoje} tone="green" />
          <KPI icon={PackageX} label="Não entregues" value={k.stops_nao_entregues_hoje} tone="red" />
          <KPI icon={AlertTriangle} label="Alertas ativos" value={alerts.length} tone={alerts.length ? "red" : "default"} />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> Mapa ao vivo</CardTitle>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Em rota</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Em PDV</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Disponível</span>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <div ref={containerRef} style={{ height: 380 }} className="rounded" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" /> Alertas ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[380px]">
                <div className="p-3 space-y-2">
                  {!alerts.length && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum alerta ativo. Tudo tranquilo. ✅
                    </p>
                  )}
                  {alerts.map((a: any, i: number) => (
                    <div key={i} className={`p-3 rounded-lg border text-sm ${
                      a.severity === "high" ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={a.severity === "high" ? "destructive" : "secondary"} className="text-[10px]">
                          {a.type === "stale_gps" ? "GPS" : a.type === "route_overtime" ? "JORNADA" : "PARADA"}
                        </Badge>
                        <span className="font-medium">{a.driver_name}</span>
                        {a.route_code && <span className="text-xs text-muted-foreground">· {a.route_code}</span>}
                      </div>
                      <div className="text-xs">{a.message}</div>
                      {a.pdv_name && <div className="text-xs text-muted-foreground mt-1">{a.pdv_name}</div>}
                      {a.stop_id && (
                        <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs" onClick={() => setSelectedStop(a.stop_id)}>
                          Ver detalhes da parada →
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="w-4 h-4" /> Paradas em atendimento ({activeStops.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[360px]">
                <div className="divide-y">
                  {!activeStops.length && (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma parada em atendimento.</p>
                  )}
                  {activeStops.map((s: any) => {
                    const slow = (s.elapsed_sec || 0) > 30 * 60;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStop(s.id)}
                        className="w-full text-left p-3 hover:bg-muted/40 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">#{s.sequence} · {s.pdv_name || "—"}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {s.driver_name} · {s.route_code} · {s.pdv_city || "—"}
                            </div>
                          </div>
                          <Badge variant={slow ? "destructive" : "outline"} className="ml-2 shrink-0">
                            <Clock className="w-3 h-3 mr-1" /> {fmtDuration(s.elapsed_sec)}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4" /> Feed de eventos (6h)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[360px]">
                <div className="divide-y">
                  {!events.length && (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem eventos recentes.</p>
                  )}
                  {events.map((e: any) => (
                    <div key={e.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{EVENT_LABELS[e.event_type] || e.event_type}</Badge>
                          {e.route_code && (
                            <Link to={`/smartroute/replay/${e.payload?.route_id || ""}`} className="text-xs text-primary hover:underline">
                              {e.route_code}
                            </Link>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.driver_name || "—"}
                        {e.stop_seq != null && ` · Parada #${e.stop_seq}`}
                        {e.pdv_name && ` · ${e.pdv_name}`}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Signal className="w-4 h-4" /> Motoristas ({data?.drivers?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(data?.drivers || []).map((d: any) => {
                const stale = d.current_status === "em_rota" && d.gps_age_sec && d.gps_age_sec > 300;
                return (
                  <div key={d.id} className="p-3 flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLOR[d.current_status] || "#94a3b8" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {d.plate ? `${d.plate} · ${d.model || ""}` : "Sem veículo"}
                        {d.route_code && ` · ${d.route_code}`}
                      </div>
                    </div>
                    {d.route_id && <Badge variant="outline">{d.completed_stops || 0}/{d.total_stops || 0}</Badge>}
                    {stale && <Badge variant="destructive" className="text-[10px]">GPS {fmtDuration(d.gps_age_sec)}</Badge>}
                    <Badge variant="secondary">{d.current_status || "offline"}</Badge>
                  </div>
                );
              })}
              {!data?.drivers?.length && !isLoading && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum motorista ativo.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedStop} onOpenChange={(o) => !o && setSelectedStop(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da parada</DialogTitle>
          </DialogHeader>
          {stopDetail?.stop ? (
            <div className="space-y-4 text-sm">
              <div>
                <div className="font-medium">#{stopDetail.stop.sequence} · {stopDetail.stop.pdv_name}</div>
                <div className="text-xs text-muted-foreground">
                  {stopDetail.stop.pdv_address} · {stopDetail.stop.pdv_city}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stopDetail.stop.driver_name} · {stopDetail.stop.route_code} ·
                  <Badge variant="outline" className="ml-1">{stopDetail.stop.state || stopDetail.stop.status}</Badge>
                </div>
              </div>

              {stopDetail.checklist?.length > 0 && (
                <div>
                  <div className="font-medium text-xs uppercase text-muted-foreground mb-2">Checklist ({stopDetail.checklist.length})</div>
                  <div className="space-y-1">
                    {stopDetail.checklist.map((c: any) => (
                      <div key={c.id} className="flex items-start gap-2 text-xs border rounded p-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium">{c.label}</div>
                          <div className="text-muted-foreground">{JSON.stringify(c.value)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stopDetail.occurrences?.length > 0 && (
                <div>
                  <div className="font-medium text-xs uppercase text-muted-foreground mb-2">Ocorrências</div>
                  {stopDetail.occurrences.map((o: any) => (
                    <div key={o.id} className="text-xs border-l-2 border-red-500 pl-2 mb-1">
                      <b>{o.type}</b> — {o.reason}
                    </div>
                  ))}
                </div>
              )}

              {stopDetail.media?.length > 0 && (
                <div>
                  <div className="font-medium text-xs uppercase text-muted-foreground mb-2">Mídias ({stopDetail.media.length})</div>
                  <div className="grid grid-cols-4 gap-2">
                    {stopDetail.media.map((m: any) => (
                      <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block">
                        {m.kind?.startsWith("image") || m.kind === "photo" ? (
                          <img src={m.url} alt="" className="w-full h-20 object-cover rounded" />
                        ) : (
                          <div className="w-full h-20 flex items-center justify-center border rounded text-xs">{m.kind}</div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {stopDetail.ocr?.length > 0 && (
                <div>
                  <div className="font-medium text-xs uppercase text-muted-foreground mb-2">OCR</div>
                  {stopDetail.ocr.map((o: any) => (
                    <div key={o.id} className="text-xs border rounded p-2 mb-1">
                      <b>{o.product}</b> {o.brand && `· ${o.brand}`} · Lote {o.batch || "—"} · Val {o.expires_at || "—"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
