import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useParams, Link } from "react-router-dom";
import { useSRReplay } from "@/hooks/use-smartroute";
import { useRouteJourneyEvents } from "@/hooks/use-smartroute-checklists";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, Play, Pause, RotateCcw } from "lucide-react";

export default function SmartRouteReplay() {
  const { id } = useParams<{ id: string }>();
  const { data } = useSRReplay(id);
  const { data: journeyEvents = [] } = useRouteJourneyEvents(id);
  const mapRef = useRef<L.Map | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const cursorRef = useRef<L.CircleMarker | null>(null);
  const [idx, setIdx] = useState(0);

  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const m = L.map(container.current).setView([-23.55, -46.63], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  const geoEvents = (data?.events || []).filter((e: any) => e.lat != null && e.lng != null);

  useEffect(() => {
    const m = mapRef.current; if (!m || !data) return;
    // Stops markers
    (data.stops || []).forEach((s: any) => {
      if (s.pdv_lat && s.pdv_lng) {
        L.circleMarker([s.pdv_lat, s.pdv_lng], { radius: 8, color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.8 })
          .bindTooltip(`#${s.sequence} · ${s.pdv_name}`).addTo(m);
      }
    });
    const pts = geoEvents.map((e: any) => [e.lat, e.lng] as [number, number]);
    if (pts.length) {
      trailRef.current = L.polyline([], { color: "#10b981", weight: 4, opacity: 0.7 }).addTo(m);
      cursorRef.current = L.circleMarker(pts[0], { radius: 8, color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1 }).addTo(m);
      m.fitBounds(pts as any, { padding: [40, 40] });
    }
  }, [data]);

  useEffect(() => {
    if (!trailRef.current || !cursorRef.current) return;
    const pts = geoEvents.slice(0, idx + 1).map((e: any) => [e.lat, e.lng] as [number, number]);
    trailRef.current.setLatLngs(pts);
    const last = pts[pts.length - 1];
    if (last) cursorRef.current.setLatLng(last);
  }, [idx, data]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIdx((i) => (i + 1 >= geoEvents.length ? (setPlaying(false), i) : i + 1)), 500);
    return () => clearInterval(t);
  }, [playing, geoEvents.length]);

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/smartroute/rotas"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Replay · {data?.route?.code || "..."}</h1>
            <p className="text-sm text-muted-foreground">{data?.route?.driver_name} · {data?.route?.vehicle_plate}</p>
          </div>
          <Badge>{geoEvents.length} pontos</Badge>
        </div>
        <Card>
          <CardContent className="p-2">
            <div ref={container} style={{ height: 500 }} className="rounded" />
            <div className="flex items-center gap-3 p-3">
              <Button size="icon" onClick={() => setPlaying((p) => !p)}>{playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</Button>
              <Button size="icon" variant="outline" onClick={() => { setIdx(0); setPlaying(false); }}><RotateCcw className="w-4 h-4" /></Button>
              <input type="range" min={0} max={Math.max(0, geoEvents.length - 1)} value={idx} onChange={(e) => setIdx(+e.target.value)} className="flex-1" />
              <div className="text-xs text-muted-foreground w-24 text-right">
                {geoEvents[idx] ? new Date(geoEvents[idx].created_at).toLocaleTimeString() : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Linha do tempo da jornada</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1 max-h-96 overflow-auto">
            {journeyEvents.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between border-b py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{e.event_type}</Badge>
                  {e.stop_seq != null && <span className="text-muted-foreground">#{e.stop_seq}</span>}
                  {e.pdv_name && <span>{e.pdv_name}</span>}
                </div>
                <span className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
              </div>
            ))}
            {!journeyEvents.length && (data?.events || []).map((e: any, i: number) => (
              <div key={i} className="flex justify-between border-b py-1">
                <span>{e.event_type}</span>
                <span className="text-muted-foreground text-xs">{new Date(e.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
