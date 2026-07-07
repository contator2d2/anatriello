import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Truck, MapPin, CheckCircle2, Clock, Star, Phone, Package } from "lucide-react";
import { toast } from "sonner";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const statusLabels: Record<string, string> = {
  pendente: "Pedido recebido",
  em_rota: "A caminho",
  entregue: "Entregue",
  devolvido: "Não entregue",
};

export default function TrackingPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rated, setRated] = useState(false);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarker = useRef<L.CircleMarker | null>(null);
  const pdvMarker = useRef<L.Marker | null>(null);

  const load = () => fetch(`${API}/api/smartroute-public/track/${token}`)
    .then((r) => r.ok ? r.json() : Promise.reject(r))
    .then((d) => { setData(d); setLoading(false); })
    .catch(() => setLoading(false));

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [token]);

  useEffect(() => {
    if (!container.current || mapRef.current || !data) return;
    const center: [number, number] = data.pdv_lat && data.pdv_lng ? [data.pdv_lat, data.pdv_lng] : [-23.55, -46.63];
    const m = L.map(container.current).setView(center, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    mapRef.current = m;
  }, [data]);

  useEffect(() => {
    const m = mapRef.current; if (!m || !data) return;
    if (data.pdv_lat && data.pdv_lng && !pdvMarker.current) {
      pdvMarker.current = L.marker([data.pdv_lat, data.pdv_lng]).addTo(m).bindPopup(`<b>Destino</b><br/>${data.pdv_address || ""}`);
    }
    if (data.driver_lat && data.driver_lng) {
      if (!driverMarker.current) {
        driverMarker.current = L.circleMarker([data.driver_lat, data.driver_lng], { radius: 10, color: "#10b981", fillColor: "#10b981", fillOpacity: 1 }).addTo(m);
      } else {
        driverMarker.current.setLatLng([data.driver_lat, data.driver_lng]);
      }
      driverMarker.current.bindPopup(`<b>${data.driver_name}</b><br/>${data.vehicle_plate || ""}`);
      const pts: [number, number][] = [[data.driver_lat, data.driver_lng]];
      if (data.pdv_lat && data.pdv_lng) pts.push([data.pdv_lat, data.pdv_lng]);
      if (pts.length > 1) m.fitBounds(pts, { padding: [50, 50] });
    }
  }, [data]);

  const rate = async () => {
    if (!score) return toast.error("Escolha uma nota");
    const r = await fetch(`${API}/api/smartroute-public/track/${token}/rating`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, comment }),
    });
    if (r.ok) { setRated(true); toast.success("Obrigado pela avaliação!"); }
    else toast.error("Não foi possível avaliar");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Pedido não encontrado.</div>;

  const timeline = [
    { key: "created", label: "Pedido recebido", done: true, at: data.events?.[0]?.created_at },
    { key: "route_started", label: "Saiu para entrega", done: data.events?.some((e: any) => e.event_type === "route_started"), at: data.events?.find((e: any) => e.event_type === "route_started")?.created_at },
    { key: "stop_checkin", label: "Motorista chegou", done: !!data.arrived_at, at: data.arrived_at },
    { key: "stop_checkout", label: "Entregue", done: data.status === "entregue", at: data.departed_at },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs opacity-80">Rastreio Anatriello · SmartRoute</div>
          <div className="mt-1 flex items-center gap-2">
            <Package className="w-5 h-5" />
            <h1 className="text-xl font-bold">Pedido {data.order_number || "—"}</h1>
            <Badge className="ml-auto bg-white/20 border-white/30">{statusLabels[data.status] || data.status}</Badge>
          </div>
          {data.customer_name && <div className="text-sm mt-1 opacity-90">Para {data.customer_name}</div>}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {(data.driver_lat || data.pdv_lat) && (
          <Card><CardContent className="p-2">
            <div ref={container} style={{ height: 320 }} className="rounded" />
          </CardContent></Card>
        )}

        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center"><Truck className="w-5 h-5" /></div>
            <div className="flex-1">
              <div className="font-medium">{data.driver_name || "Motorista não atribuído"}</div>
              <div className="text-xs text-muted-foreground">{data.vehicle_plate || "—"} · Rota {data.route_code || "—"}</div>
            </div>
            {data.driver_phone && <a href={`tel:${data.driver_phone}`}><Button size="icon" variant="outline"><Phone className="w-4 h-4" /></Button></a>}
          </div>
          <div className="flex items-start gap-3 pt-2 border-t">
            <MapPin className="w-4 h-4 mt-1 text-slate-400" />
            <div className="text-sm">
              <div className="font-medium">{data.pdv_name}</div>
              <div className="text-xs text-muted-foreground">{data.pdv_address}</div>
            </div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div className="text-sm font-medium mb-3">Timeline</div>
          <div className="space-y-3">
            {timeline.map((t) => (
              <div key={t.key} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                  {t.done ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className={`text-sm ${t.done ? "font-medium" : "text-muted-foreground"}`}>{t.label}</div>
                  {t.at && <div className="text-xs text-muted-foreground">{new Date(t.at).toLocaleString()}</div>}
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>

        {data.status === "entregue" && data.signature_url && (
          <Card><CardContent className="p-4">
            <div className="text-sm font-medium mb-2">Comprovante</div>
            <div className="text-xs text-muted-foreground mb-2">Recebido por <b>{data.receiver_name || "—"}</b></div>
            <img src={data.signature_url} alt="Assinatura" className="max-h-32 border rounded bg-white" />
          </CardContent></Card>
        )}

        {data.status === "entregue" && !data.nps_score && !rated && (
          <Card><CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium">Como foi sua entrega?</div>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setScore(n)} className="p-1">
                  <Star className={`w-8 h-8 ${n <= score ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                </button>
              ))}
            </div>
            <Textarea placeholder="Comentário (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
            <Button className="w-full" onClick={rate}>Enviar avaliação</Button>
          </CardContent></Card>
        )}

        {(data.nps_score || rated) && (
          <Card><CardContent className="p-4 text-center text-sm text-emerald-700">
            Obrigado por avaliar! ⭐ {data.nps_score || score}/5
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
