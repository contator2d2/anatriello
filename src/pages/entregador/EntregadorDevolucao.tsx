import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, Camera, X, Send, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDriverAuth, driverApi } from "@/contexts/DriverAuthContext";
import { getPos, pickPhoto } from "@/lib/driver-utils";
import DriverBottomNav from "@/components/entregador/DriverBottomNav";

const REASONS = [
  "Cliente recusou",
  "Endereço não localizado",
  "Estabelecimento fechado",
  "Produto trocado",
  "Pedido divergente",
  "Avaria constatada pelo cliente",
  "Outro",
];

type Item = { descricao: string; quantidade: number };

export default function EntregadorDevolucao() {
  const { driver, loading } = useDriverAuth();
  const [routes, setRoutes] = useState<any[]>([]);
  const [routeId, setRouteId] = useState<string>("");
  const [stops, setStops] = useState<any[]>([]);
  const [stopId, setStopId] = useState<string>("");
  const [reason, setReason] = useState(REASONS[0]);
  const [receiver, setReceiver] = useState("");
  const [items, setItems] = useState<Item[]>([{ descricao: "", quantidade: 1 }]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [mine, setMine] = useState<any[]>([]);

  const loadMine = () => driverApi<any[]>("/api/smartroute/driver/returns/mine").then(setMine).catch(() => {});
  useEffect(() => {
    if (!driver) return;
    driverApi<any[]>("/api/smartroute/driver/my-routes").then(setRoutes).catch(() => {});
    loadMine();
  }, [driver]);

  useEffect(() => {
    if (!routeId) { setStops([]); setStopId(""); return; }
    driverApi<any>(`/api/smartroute/driver/routes/${routeId}`).then((r) => setStops(r.stops || [])).catch(() => setStops([]));
  }, [routeId]);

  if (loading) return null;
  if (!driver) return <Navigate to="/entregador/login" replace />;

  const addPhoto = async () => { const p = await pickPhoto(); if (p) setPhotos((prev) => [...prev, p]); };
  const updItem = (i: number, patch: Partial<Item>) => setItems((prev) => prev.map((x, j) => j === i ? { ...x, ...patch } : x));

  const submit = async () => {
    if (!reason) return toast.error("Motivo obrigatório");
    setSaving(true);
    try {
      const pos = await getPos();
      const cleanItems = items.filter((i) => i.descricao.trim());
      await driverApi("/api/smartroute/driver/returns", {
        method: "POST",
        body: {
          route_id: routeId || null, stop_id: stopId || null,
          reason, receiver_name: receiver || null,
          items: cleanItems, photos, ...pos,
        },
      });
      toast.success("Devolução registrada");
      setItems([{ descricao: "", quantidade: 1 }]); setPhotos([]); setReceiver(""); loadMine();
    } catch (e: any) { toast.error(e.message || "Erro"); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-br from-purple-600 to-fuchsia-700 text-white p-4">
        <div className="flex items-center gap-3">
          <RotateCcw className="w-6 h-6" />
          <div><div className="text-sm opacity-80">Registrar</div><div className="font-bold">Devolução</div></div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <Card><CardContent className="p-4 space-y-3">
          {routes.length > 0 && (
            <div>
              <label className="text-xs font-semibold">Rota (opcional)</label>
              <Select value={routeId} onValueChange={setRouteId}>
                <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                <SelectContent>{routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {stops.length > 0 && (
            <div>
              <label className="text-xs font-semibold">Parada</label>
              <Select value={stopId} onValueChange={setStopId}>
                <SelectTrigger><SelectValue placeholder="Selecionar parada" /></SelectTrigger>
                <SelectContent>{stops.map((s) => <SelectItem key={s.id} value={s.id}>{s.sequence}. {s.pdv_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold">Motivo</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold">Nome de quem recebeu (opcional)</label>
            <Input value={receiver} onChange={(e) => setReceiver(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex items-center justify-between">
              Itens devolvidos
              <Button size="sm" variant="ghost" onClick={() => setItems((p) => [...p, { descricao: "", quantidade: 1 }])}>
                <Plus className="w-3 h-3 mr-1" />Item
              </Button>
            </label>
            <div className="space-y-2 mt-1">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="flex-1" placeholder="Descrição" value={it.descricao} onChange={(e) => updItem(i, { descricao: e.target.value })} />
                  <Input type="number" min={1} className="w-16" value={it.quantidade} onChange={(e) => updItem(i, { quantidade: Number(e.target.value) })} />
                  {items.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
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
          <Button onClick={submit} disabled={saving} className="w-full h-11"><Send className="w-4 h-4 mr-2" />Registrar devolução</Button>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <p className="text-sm font-semibold mb-2">Minhas últimas devoluções</p>
          {!mine.length && <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro.</p>}
          <div className="space-y-2">
            {mine.slice(0, 10).map((m) => (
              <div key={m.id} className="p-2 border rounded text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.reason}</span>
                  <Badge variant="outline" className="text-[10px]">{(m.items?.length || 0)} itens</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </div>

      <DriverBottomNav />
    </div>
  );
}
