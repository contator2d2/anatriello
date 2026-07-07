import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSRLive } from "@/hooks/use-smartroute";
import { useEffect, useRef } from "react";

// Simple Leaflet-free canvas map fallback (Fase 1). Uses a lightweight OSM tile via <img>? No.
// For Fase 1 we render a schematic map showing pins by lat/lng normalized. Real map lib arrives Fase 2.

const statusColor: Record<string, string> = {
  em_rota: "#10b981",
  em_pdv: "#f59e0b",
  disponivel: "#3b82f6",
  offline: "#94a3b8",
};

export default function SmartRouteMapa() {
  const { data, refetch } = useSRLive();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath(); ctx.moveTo(0, (H / 10) * i); ctx.lineTo(W, (H / 10) * i); ctx.stroke();
      ctx.beginPath(); ctx.moveTo((W / 10) * i, 0); ctx.lineTo((W / 10) * i, H); ctx.stroke();
    }
    const drivers = (data?.drivers || []).filter((d: any) => d.current_lat != null && d.current_lng != null);
    if (!drivers.length) return;
    const lats = drivers.map((d: any) => d.current_lat);
    const lngs = drivers.map((d: any) => d.current_lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 0.01);
    const spanLng = Math.max(maxLng - minLng, 0.01);
    drivers.forEach((d: any) => {
      const x = ((d.current_lng - minLng) / spanLng) * (W - 40) + 20;
      const y = H - (((d.current_lat - minLat) / spanLat) * (H - 40) + 20);
      ctx.fillStyle = statusColor[d.current_status] || "#94a3b8";
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#0f172a"; ctx.font = "11px sans-serif";
      ctx.fillText(d.full_name?.split(" ")[0] || "", x + 12, y + 4);
    });
  }, [data]);

  useEffect(() => { const id = setInterval(refetch, 15000); return () => clearInterval(id); }, [refetch]);

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Mapa ao Vivo</h1>
          <p className="text-sm text-muted-foreground">Posição dos motoristas atualizando a cada 15s.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardContent className="p-2">
              <canvas ref={canvasRef} width={800} height={520} className="w-full h-auto rounded border bg-slate-50" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Motoristas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(data?.drivers || []).map((d: any) => (
                <div key={d.id} className="flex items-center gap-2 p-2 rounded border">
                  <span className="w-2 h-2 rounded-full" style={{ background: statusColor[d.current_status] || "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {d.plate || "sem veículo"} {d.route_code && `· ${d.route_code}`}
                    </div>
                  </div>
                  <Badge variant="outline">{d.completed_stops || 0}/{d.total_stops || 0}</Badge>
                </div>
              ))}
              {!data?.drivers?.length && <p className="text-sm text-muted-foreground">Nenhum motorista ativo.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
