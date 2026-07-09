import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PackageX, Camera, X, Send } from "lucide-react";
import { toast } from "sonner";
import { useDriverAuth, driverApi } from "@/contexts/DriverAuthContext";
import { getPos, pickPhoto } from "@/lib/driver-utils";
import DriverBottomNav from "@/components/entregador/DriverBottomNav";

const TYPES = ["Embalagem violada", "Produto quebrado", "Vazamento", "Molhado", "Amassado", "Etiqueta ilegível", "Outro"];
const SEVERITIES = [
  { v: "baixa", label: "Baixa" },
  { v: "media", label: "Média" },
  { v: "alta", label: "Alta" },
  { v: "critica", label: "Crítica" },
];

export default function EntregadorAvaria() {
  const { driver, loading } = useDriverAuth();
  const [routes, setRoutes] = useState<any[]>([]);
  const [routeId, setRouteId] = useState<string>("");
  const [type, setType] = useState(TYPES[0]);
  const [severity, setSeverity] = useState("media");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [mine, setMine] = useState<any[]>([]);

  const load = () => {
    driverApi<any[]>("/api/smartroute/driver/my-routes").then(setRoutes).catch(() => {});
    driverApi<any[]>("/api/smartroute/driver/damages/mine").then(setMine).catch(() => {});
  };
  useEffect(() => { if (driver) load(); }, [driver]);

  if (loading) return null;
  if (!driver) return <Navigate to="/entregador/login" replace />;

  const addPhoto = async () => {
    const p = await pickPhoto();
    if (p) setPhotos((prev) => [...prev, p]);
  };

  const submit = async () => {
    if (!photos.length) return toast.error("Ao menos 1 foto é obrigatória");
    setSaving(true);
    try {
      const pos = await getPos();
      await driverApi("/api/smartroute/driver/damages", {
        method: "POST",
        body: { route_id: routeId || null, damage_type: type, severity, description, photos, ...pos },
      });
      toast.success("Avaria registrada");
      setPhotos([]); setDescription(""); load();
    } catch (e: any) { toast.error(e.message || "Erro"); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-br from-orange-600 to-red-600 text-white p-4">
        <div className="flex items-center gap-3">
          <PackageX className="w-6 h-6" />
          <div><div className="text-sm opacity-80">Registrar avaria</div><div className="font-bold">Carga / embalagem</div></div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <Card>
          <CardContent className="p-4 space-y-3">
            {routes.length > 0 && (
              <div>
                <label className="text-xs font-semibold">Rota (opcional)</label>
                <Select value={routeId} onValueChange={setRouteId}>
                  <SelectTrigger><SelectValue placeholder="Sem vínculo com rota" /></SelectTrigger>
                  <SelectContent>{routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold">Tipo de avaria</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">Severidade</label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">Descrição</label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhe o problema…" />
            </div>
            <div>
              <label className="text-xs font-semibold">Fotos ({photos.length})</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {photos.map((p, i) => (
                  <div key={i} className="relative aspect-square rounded overflow-hidden border">
                    <img src={p} className="w-full h-full object-cover" />
                    <button onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                <button onClick={addPhoto} className="aspect-square border-2 border-dashed rounded flex flex-col items-center justify-center text-xs text-slate-500 hover:bg-slate-50">
                  <Camera className="w-5 h-5 mb-1" />Adicionar
                </button>
              </div>
            </div>
            <Button onClick={submit} disabled={saving} className="w-full h-11"><Send className="w-4 h-4 mr-2" />Registrar avaria</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-2">Minhas últimas avarias</p>
            {!mine.length && <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro.</p>}
            <div className="space-y-2">
              {mine.slice(0, 10).map((m) => (
                <div key={m.id} className="p-2 border rounded text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{m.damage_type}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{m.severity}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <DriverBottomNav />
    </div>
  );
}
