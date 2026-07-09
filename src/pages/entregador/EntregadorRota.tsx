import { useEffect, useRef, useState } from "react";
import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, MapPin, Phone, Camera, CheckCircle2, XCircle, Play, Flag, Navigation, Eraser } from "lucide-react";
import { toast } from "sonner";
import { useDriverAuth, driverApi } from "@/contexts/DriverAuthContext";
import SignatureCanvas from "react-signature-canvas";
import DriverBottomNav from "@/components/entregador/DriverBottomNav";



const statusColor: Record<string, string> = { pendente: "bg-slate-200", em_atendimento: "bg-amber-200", concluida: "bg-emerald-200", nao_entregue: "bg-red-200" };

const getPos = () => new Promise<{ lat?: number; lng?: number }>((resolve) => {
  if (!navigator.geolocation) return resolve({});
  navigator.geolocation.getCurrentPosition(
    (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => resolve({}),
    { enableHighAccuracy: true, timeout: 8000 }
  );
});

const pickPhoto = (): Promise<string | null> => new Promise((resolve) => {
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*"; (input as any).capture = "environment";
  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(f);
  };
  input.click();
});

export default function EntregadorRota() {
  const { id } = useParams<{ id: string }>();
  const { driver, loading } = useDriverAuth();
  const goTo = useNavigate();
  const [route, setRoute] = useState<any>(null);
  const [failOpen, setFailOpen] = useState<string | null>(null);
  const [failReason, setFailReason] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState<string | null>(null);
  const [receiver, setReceiver] = useState("");
  const [notes, setNotes] = useState("");
  const sigRef = useRef<SignatureCanvas>(null);


  const reload = () => id && driverApi(`/api/smartroute/driver/routes/${id}`).then(setRoute).catch((e) => toast.error(e.message));
  useEffect(() => { reload(); }, [id]);

  if (loading) return null;
  if (!driver) return <Navigate to="/entregador/login" replace />;
  if (!route) return <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>;

  const startRoute = async () => {
    const pos = await getPos();
    await driverApi(`/api/smartroute/driver/routes/${id}/start`, { method: "POST", body: pos });
    toast.success("Rota iniciada"); reload();
  };

  const finishRoute = async () => {
    await driverApi(`/api/smartroute/driver/routes/${id}/finish`, { method: "POST", body: {} });
    toast.success("Rota concluída"); reload();
  };

  const checkin = async (stopId: string) => {
    const pos = await getPos();
    const photo = await pickPhoto();
    if (!photo) return toast.error("Foto obrigatória");
    await driverApi(`/api/smartroute/driver/stops/${stopId}/checkin`, { method: "POST", body: { ...pos, photo } });
    toast.success("Check-in registrado"); reload();
  };

  const addPhoto = async (stopId: string) => {
    const pos = await getPos();
    const photo = await pickPhoto();
    if (!photo) return;
    await driverApi(`/api/smartroute/driver/stops/${stopId}/photo`, { method: "POST", body: { url: photo, kind: "entrega", ...pos } });
    toast.success("Foto anexada");
  };

  const doCheckout = async () => {
    if (!checkoutOpen) return;
    if (!receiver.trim()) return toast.error("Informe quem recebeu");
    const sig = sigRef.current;
    const signature_url = sig && !sig.isEmpty() ? sig.getCanvas().toDataURL("image/png") : null;
    if (!signature_url) return toast.error("Assinatura obrigatória");
    const pos = await getPos();
    await driverApi(`/api/smartroute/driver/stops/${checkoutOpen}/checkout`, {
      method: "POST",
      body: { ...pos, receiver_name: receiver, notes, signature_url },
    });
    toast.success("Entrega finalizada");
    setCheckoutOpen(null); setReceiver(""); setNotes(""); sig?.clear(); reload();
  };


  const doFail = async () => {
    if (!failOpen) return;
    const pos = await getPos();
    await driverApi(`/api/smartroute/driver/stops/${failOpen}/fail`, { method: "POST", body: { reason: failReason, ...pos } });
    toast.success("Ocorrência registrada");
    setFailOpen(null); setFailReason(""); reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4">
        <div className="flex items-center gap-3">
          <Link to="/entregador/home" className="p-2 -ml-2 rounded hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex-1">
            <div className="text-sm opacity-80">Rota</div>
            <div className="font-bold text-lg">{route.code}</div>
          </div>
          <Badge className="bg-white/20 text-white border-white/30">{route.status}</Badge>
        </div>
        <div className="mt-3 text-sm opacity-90">{route.completed_stops || 0}/{route.total_stops || 0} paradas concluídas</div>
      </div>

      <div className="p-4 space-y-3">
        {route.status === "planejada" && (
          <Button onClick={startRoute} className="w-full h-12" size="lg"><Play className="w-4 h-4 mr-2" /> Iniciar rota</Button>
        )}

        {route.stops?.map((s: any) => (
          <Card
            key={s.id}
            className="overflow-hidden cursor-pointer transition hover:shadow-md active:scale-[0.99]"
            onClick={() => route.status === "em_andamento" && goTo(`/entregador/entrega/${s.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">{s.sequence}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{s.pdv_name}</div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1"><MapPin className="w-3 h-3" />{s.pdv_address}</div>
                  {s.contact_phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{s.contact_phone}</div>}
                  <div className="mt-1 text-xs">Pedido <span className="font-mono">{s.order_number || "—"}</span> · {s.weight_kg || 0} kg</div>
                </div>
                <Badge className={statusColor[s.status] || ""}>{s.status}</Badge>
              </div>

              {route.status === "em_andamento" && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {s.pdv_lat && (
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.pdv_lat},${s.pdv_lng}`} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="w-full"><Navigation className="w-4 h-4 mr-1" /> Rotas</Button>
                    </a>
                  )}
                  {s.status === "pendente" && <Button size="sm" onClick={() => checkin(s.id)}><MapPin className="w-4 h-4 mr-1" /> Check-in</Button>}
                  {s.status === "em_atendimento" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => addPhoto(s.id)}><Camera className="w-4 h-4 mr-1" /> Foto</Button>
                      <Button size="sm" onClick={() => setCheckoutOpen(s.id)}><CheckCircle2 className="w-4 h-4 mr-1" /> Finalizar</Button>
                      <Button size="sm" variant="destructive" onClick={() => setFailOpen(s.id)}><XCircle className="w-4 h-4 mr-1" /> Não entregue</Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {route.status === "em_andamento" && route.completed_stops >= route.total_stops && (
          <Button onClick={finishRoute} className="w-full h-12" size="lg" variant="default"><Flag className="w-4 h-4 mr-2" /> Concluir rota</Button>
        )}
      </div>

      <Dialog open={!!checkoutOpen} onOpenChange={(v) => !v && setCheckoutOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Finalizar entrega</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm">Nome de quem recebeu*</label><Input value={receiver} onChange={(e) => setReceiver(e.target.value)} /></div>
            <div>
              <label className="text-sm flex items-center justify-between">Assinatura*
                <button type="button" className="text-xs text-blue-600 flex items-center gap-1" onClick={() => sigRef.current?.clear()}><Eraser className="w-3 h-3" />Limpar</button>
              </label>
              <div className="border rounded bg-white mt-1">
                <SignatureCanvas ref={sigRef} penColor="black" canvasProps={{ className: "w-full h-40" }} />
              </div>
            </div>
            <div><label className="text-sm">Observações</label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          </div>

          <DialogFooter><Button variant="outline" onClick={() => setCheckoutOpen(null)}>Cancelar</Button><Button onClick={doCheckout}>Confirmar entrega</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!failOpen} onOpenChange={(v) => !v && setFailOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar não entrega</DialogTitle></DialogHeader>
          <Textarea placeholder="Motivo (fechado, recusado, endereço inválido...)" value={failReason} onChange={(e) => setFailReason(e.target.value)} rows={3} />
          <DialogFooter><Button variant="outline" onClick={() => setFailOpen(null)}>Cancelar</Button><Button variant="destructive" onClick={doFail}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <DriverBottomNav />
    </div>

  );
}
