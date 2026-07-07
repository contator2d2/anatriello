import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSRLive, useSRAlerts, useSRResolveAlert } from "@/hooks/use-smartroute";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const statusColor: Record<string, string> = {
  em_rota: "#10b981", em_pdv: "#f59e0b", disponivel: "#3b82f6", offline: "#94a3b8",
};

export default function SmartRouteMapa() {
  const { data } = useSRLive();
  const { data: alerts = [] } = useSRAlerts();
  const resolve = useSRResolveAlert();
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    const drivers = (data?.drivers || []).filter((d: any) => d.current_lat != null && d.current_lng != null);
    if (!drivers.length) return;
    const bounds: [number, number][] = [];
    drivers.forEach((d: any) => {
      const color = statusColor[d.current_status] || "#94a3b8";
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      });
      L.marker([d.current_lat, d.current_lng], { icon })
        .bindPopup(`<b>${d.full_name}</b><br/>${d.plate || "sem veículo"}<br/>${d.route_code || ""}<br/>Status: ${d.current_status || "offline"}`)
        .addTo(layer);
      bounds.push([d.current_lat, d.current_lng]);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [data]);

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Mapa ao Vivo</h1>
            <p className="text-sm text-muted-foreground">Motoristas em campo · atualiza a cada 15s</p>
          </div>
          {alerts.length > 0 && (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> {alerts.length} alerta(s)</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardContent className="p-2">
              <div ref={containerRef} style={{ height: 560, width: "100%" }} className="rounded" />
            </CardContent>
          </Card>
          <div className="space-y-3">
            <Card>
              <CardHeader><CardTitle className="text-base">Motoristas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(data?.drivers || []).map((d: any) => (
                  <div key={d.id} className="flex items-center gap-2 p-2 rounded border">
                    <span className="w-2 h-2 rounded-full" style={{ background: statusColor[d.current_status] || "#94a3b8" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{d.plate || "sem veículo"} {d.route_code && `· ${d.route_code}`}</div>
                    </div>
                    <Badge variant="outline">{d.completed_stops || 0}/{d.total_stops || 0}</Badge>
                  </div>
                ))}
                {!data?.drivers?.length && <p className="text-sm text-muted-foreground">Nenhum motorista ativo.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {alerts.map((a: any) => (
                  <div key={a.id} className="p-2 rounded border bg-amber-50">
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.message}</div>
                    <Button size="sm" variant="ghost" className="h-6 mt-1" onClick={() => resolve.mutate(a.id)}><Check className="w-3 h-3 mr-1" />Resolver</Button>
                  </div>
                ))}
                {!alerts.length && <p className="text-xs text-muted-foreground">Sem alertas ativos.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
