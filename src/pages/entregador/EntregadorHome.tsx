import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, LogOut, Route as RouteIcon, ChevronRight } from "lucide-react";
import { useDriverAuth, driverApi } from "@/contexts/DriverAuthContext";
import DriverBottomNav from "@/components/entregador/DriverBottomNav";


export default function EntregadorHome() {
  const { driver, logout, loading } = useDriverAuth();
  const nav = useNavigate();
  const [routes, setRoutes] = useState<any[]>([]);
  const [loadingR, setLoadingR] = useState(true);

  useEffect(() => {
    if (!driver) return;
    driverApi<any[]>("/api/smartroute/driver/my-routes").then(setRoutes).catch(() => setRoutes([])).finally(() => setLoadingR(false));
  }, [driver]);

  // Send location every 60s
  useEffect(() => {
    if (!driver) return;
    const send = () => navigator.geolocation?.getCurrentPosition(
      (p) => driverApi("/api/smartroute/driver/location", { method: "POST", body: { lat: p.coords.latitude, lng: p.coords.longitude } }).catch(() => {}),
      () => {},
      { enableHighAccuracy: false, timeout: 5000 }
    );
    send();
    const id = setInterval(send, 60000);
    return () => clearInterval(id);
  }, [driver]);

  if (loading) return null;
  if (!driver) return <Navigate to="/entregador/login" replace />;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center"><Truck className="w-6 h-6" /></div>
            <div>
              <div className="text-sm opacity-80">Olá,</div>
              <div className="font-bold">{driver.full_name}</div>
            </div>
          </div>
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => { logout(); nav("/entregador/login"); }}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
        {driver.plate && <div className="mt-3 text-sm opacity-90">{driver.plate} · {driver.model}</div>}
      </div>

      <div className="px-4 -mt-4 space-y-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <RouteIcon className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold">Minhas rotas de hoje</h2>
            </div>
            {loadingR && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!loadingR && !routes.length && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma rota atribuída hoje.</p>}
            <div className="space-y-2">
              {routes.map((r) => (
                <Link key={r.id} to={`/entregador/rota/${r.id}`} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center"><MapPin className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.code}</div>
                    <div className="text-xs text-muted-foreground">{r.completed_stops}/{r.total_stops} paradas · {r.vehicle_plate || "sem veículo"}</div>
                  </div>
                  <Badge variant="outline">{r.status}</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <DriverBottomNav />
    </div>
  );
}

