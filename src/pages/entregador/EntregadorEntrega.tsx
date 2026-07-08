import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";
import {
  ArrowLeft, MapPin, Phone, Navigation, Camera, CheckCircle2,
  AlertTriangle, FileText, PenLine, Eraser, Package, Clock, ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDriverAuth } from "@/contexts/DriverAuthContext";
import {
  useStopDetail, useStopNavigate, useStopCheckin, useStopMedia,
  useStopOccurrence, useStopSignature, useStopCheckout, useNextStop,
  getPos, pickPhoto, openNavLink,
} from "@/hooks/use-smartroute-journey";
import { ChecklistRunner } from "@/components/entregador/ChecklistRunner";

const OCCURRENCE_TYPES = [
  { value: "danificado", label: "Produto danificado" },
  { value: "vencido", label: "Produto vencido" },
  { value: "recusado", label: "Produto recusado" },
  { value: "cliente_ausente", label: "Cliente ausente" },
  { value: "cliente_fechado", label: "Cliente fechado" },
  { value: "garantia", label: "Troca em garantia" },
  { value: "devolucao", label: "Devolução" },
  { value: "descarte", label: "Descarte" },
  { value: "equipamento", label: "Equipamento danificado" },
  { value: "freezer", label: "Freezer sem funcionamento" },
  { value: "outro", label: "Outro" },
];

export default function EntregadorEntrega() {
  const { id = "" } = useParams<{ id: string }>();
  const { driver, loading } = useDriverAuth();
  const nav = useNavigate();
  const { data: stop, refetch, isLoading } = useStopDetail(id);
  const nextStop = useNextStop(id);
  const doNavigate = useStopNavigate(id);
  const doCheckin = useStopCheckin(id);
  const doMedia = useStopMedia(id);
  const doOccurrence = useStopOccurrence(id);
  const doSignature = useStopSignature(id);
  const doCheckout = useStopCheckout(id);

  const [tab, setTab] = useState("navigate");
  const [occOpen, setOccOpen] = useState(false);
  const [occType, setOccType] = useState("cliente_ausente");
  const [occSeverity, setOccSeverity] = useState<"low" | "medium" | "high">("medium");
  const [occDesc, setOccDesc] = useState("");
  const [receiver, setReceiver] = useState("");
  const [notes, setNotes] = useState("");
  const [nextDialogOpen, setNextDialogOpen] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);

  // Muda de aba conforme o estado avança
  useEffect(() => {
    if (!stop) return;
    if (stop.state === "PENDING" || stop.state === "NAVIGATING") setTab("navigate");
    else if (stop.state === "CHECKED_IN" || stop.state === "CHECKLIST_IN_PROGRESS") setTab("proof");
    else if (stop.state === "PROOF_CAPTURED" || stop.state === "CHECKLIST_DONE") setTab("sign");
    else if (stop.state === "SIGNED") setTab("finish");
    else if (stop.state === "COMPLETED") setTab("finish");
  }, [stop?.state]);

  if (loading) return null;
  if (!driver) return <Navigate to="/entregador/login" replace />;
  if (isLoading || !stop) return <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>;

  const media = (stop.media || []) as Array<{ id: string; kind: string; url: string }>;
  const has = (k: string) => media.some((m) => m.kind === k);
  const settings = stop.operation || {};

  const handleNavigate = async () => {
    const pos = await getPos();
    const res = await doNavigate.mutateAsync(pos);
    openNavLink(res.link);
    refetch();
  };

  const handleCheckin = async () => {
    const pos = await getPos();
    let photo: string | null = null;
    if (settings.require_facade_photo) {
      photo = await pickPhoto();
      if (!photo) return toast.error("Foto da fachada é obrigatória");
    }
    try {
      const res = await doCheckin.mutateAsync({ ...pos, photo: photo || undefined });
      toast.success(res?.distance_m != null ? `Check-in a ${res.distance_m} m do PDV` : "Check-in realizado");
    } catch (e: any) {
      const msg = e?.data?.error || e?.message || "Falha no check-in";
      const dist = e?.data?.distance_m;
      const max = e?.data?.max_distance_m;
      toast.error(dist ? `${msg} (${dist} m / limite ${max} m)` : msg);
    }
  };

  const addPhoto = async (kind: "invoice" | "photo" | "product") => {
    const pos = await getPos();
    const url = await pickPhoto();
    if (!url) return;
    await doMedia.mutateAsync({ kind, url, ...pos });
    toast.success("Anexado");
  };

  const handleSign = async () => {
    const sig = sigRef.current;
    if (!sig || sig.isEmpty()) return toast.error("Assinatura obrigatória");
    const signature_url = sig.getCanvas().toDataURL("image/png");
    const pos = await getPos();
    await doSignature.mutateAsync({ signature_url, receiver_name: receiver || undefined, ...pos });
    toast.success("Assinatura registrada");
  };

  const handleCheckout = async () => {
    const pos = await getPos();
    try {
      await doCheckout.mutateAsync({ ...pos, receiver_name: receiver || undefined, notes: notes || undefined });
      toast.success("Entrega finalizada");
      const nxt = await nextStop.refetch();
      if (nxt.data?.done) {
        toast.message("Todas as entregas concluídas! 🎉");
        nav("/entregador/home");
      } else {
        setNextDialogOpen(true);
      }
    } catch (e: any) {
      const blockers: string[] = e?.data?.blockers || [];
      if (blockers.length) toast.error(`Pendências: ${blockers.join(" · ")}`);
      else toast.error(e?.message || "Falha no check-out");
    }
  };

  const registerOccurrence = async () => {
    const pos = await getPos();
    await doOccurrence.mutateAsync({
      type: occType, severity: occSeverity, description: occDesc || undefined, ...pos,
    });
    setOccOpen(false); setOccDesc("");
    toast.success("Ocorrência registrada");
  };

  const goToNext = () => {
    const nxt = nextStop.data;
    setNextDialogOpen(false);
    if (nxt?.link) openNavLink(nxt.link);
    if (nxt?.stop?.id) setTimeout(() => nav(`/entregador/entrega/${nxt.stop.id}`), 400);
  };

  const stateBadge = ({
    PENDING: "Pendente", NAVIGATING: "Em rota", ARRIVED: "No local",
    CHECKED_IN: "Check-in feito", CHECKLIST_IN_PROGRESS: "Checklist",
    CHECKLIST_DONE: "Checklist ok", PROOF_CAPTURED: "Comprovante",
    SIGNED: "Assinado", COMPLETED: "Concluído", EXCEPTION: "Ocorrência",
  } as Record<string, string>)[stop.state || "PENDING"] || stop.state;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4">
        <div className="flex items-center gap-3">
          <Link to={`/entregador/rota/${stop.route_id}`} className="p-2 -ml-2 rounded hover:bg-white/10">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-xs opacity-80">Entrega #{stop.sequence}</div>
            <div className="font-bold truncate">{stop.pdv_name}</div>
          </div>
          <Badge className="bg-white/20 text-white border-white/30">{stateBadge}</Badge>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs opacity-90">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{stop.pdv_city || "—"}</span>
          {stop.order_number && <span className="flex items-center gap-1"><Package className="w-3 h-3" />{stop.order_number}</span>}
          {stop.weight_kg > 0 && <span>{stop.weight_kg} kg</span>}
        </div>
      </div>

      {/* Info do PDV */}
      <div className="p-4 space-y-3">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-sm font-medium">{stop.pdv_address}</div>
            {stop.contact_phone && (
              <a href={`tel:${stop.contact_phone}`} className="text-xs text-blue-600 flex items-center gap-1">
                <Phone className="w-3 h-3" />{stop.contact_name || "Contato"}: {stop.contact_phone}
              </a>
            )}
            {stop.order_notes && <div className="text-xs text-muted-foreground">{stop.order_notes}</div>}
          </CardContent>
        </Card>

        {/* Fluxo em abas */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="navigate">Navegar</TabsTrigger>
            <TabsTrigger value="proof">Comprovante</TabsTrigger>
            <TabsTrigger value="sign">Assinar</TabsTrigger>
            <TabsTrigger value="finish">Finalizar</TabsTrigger>
          </TabsList>

          {/* NAVEGAR + CHECK-IN */}
          <TabsContent value="navigate">
            <Card>
              <CardContent className="p-4 space-y-3">
                <Button size="lg" className="w-full h-12" onClick={handleNavigate} disabled={!stop.pdv_lat}>
                  <Navigation className="w-4 h-4 mr-2" /> Abrir navegação
                </Button>
                <div className="text-xs text-muted-foreground text-center">
                  Distância máxima de check-in: <b>{settings.max_checkin_distance_m ?? 30} m</b>
                </div>
                <Button
                  size="lg" variant="default" className="w-full h-12"
                  onClick={handleCheckin}
                  disabled={!!stop.checkin_at || doCheckin.isPending}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {stop.checkin_at ? "Check-in concluído" : "Fazer check-in"}
                </Button>
                {stop.checkin_distance_m != null && (
                  <div className="text-xs text-center text-emerald-700">
                    Check-in a {Math.round(stop.checkin_distance_m)} m do PDV
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPROVANTE — foto de nota fiscal + mídias */}
          <TabsContent value="proof">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-medium">Anexe o comprovante da entrega</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={has("invoice") ? "secondary" : "default"} onClick={() => addPhoto("invoice")}>
                    <FileText className="w-4 h-4 mr-1" /> {has("invoice") ? "NF anexada ✓" : "Foto da NF"}
                  </Button>
                  <Button variant="outline" onClick={() => addPhoto("photo")}>
                    <Camera className="w-4 h-4 mr-1" /> Foto extra
                  </Button>
                </div>

                {media.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {media.map((m) => (
                      <img
                        key={m.id} src={m.url} alt={m.kind}
                        className="w-full h-20 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}

                <Button variant="ghost" className="w-full text-amber-700" onClick={() => setOccOpen(true)}>
                  <AlertTriangle className="w-4 h-4 mr-1" /> Registrar ocorrência
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ASSINATURA */}
          <TabsContent value="sign">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-sm">Nome de quem recebeu</label>
                  <Input value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="Ex.: João Silva" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm">Assinatura do cliente*</label>
                    <button type="button" className="text-xs text-blue-600 flex items-center gap-1"
                      onClick={() => sigRef.current?.clear()}>
                      <Eraser className="w-3 h-3" /> Limpar
                    </button>
                  </div>
                  <div className="border rounded bg-white">
                    <SignatureCanvas ref={sigRef} penColor="black" canvasProps={{ className: "w-full h-40" }} />
                  </div>
                </div>
                <Button className="w-full h-11" onClick={handleSign} disabled={doSignature.isPending || has("signature")}>
                  <PenLine className="w-4 h-4 mr-1" />
                  {has("signature") ? "Assinatura registrada ✓" : "Salvar assinatura"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FINALIZAR */}
          <TabsContent value="finish">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="text-sm">Requisitos:</div>
                <ul className="text-xs space-y-1">
                  <Requisito ok={!!stop.checkin_at} label="Check-in realizado" />
                  {settings.require_facade_photo && <Requisito ok={has("facade")} label="Foto da fachada" />}
                  {settings.require_invoice_photo && <Requisito ok={has("invoice")} label="Foto da nota fiscal" />}
                  {settings.require_signature && <Requisito ok={has("signature")} label="Assinatura do cliente" />}
                </ul>
                <div>
                  <label className="text-sm">Observações finais</label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button
                  className="w-full h-12" size="lg" onClick={handleCheckout}
                  disabled={doCheckout.isPending || stop.state === "COMPLETED"}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  {stop.state === "COMPLETED" ? "Entrega concluída" : "Concluir entrega e liberar próxima"}
                </Button>
                {stop.duration_ms && (
                  <div className="text-xs text-center text-muted-foreground flex items-center gap-1 justify-center">
                    <Clock className="w-3 h-3" /> Duração: {Math.round(stop.duration_ms / 60000)} min
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Ocorrência */}
      <Dialog open={occOpen} onOpenChange={setOccOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar ocorrência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Tipo</label>
              <Select value={occType} onValueChange={setOccType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OCCURRENCE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm">Severidade</label>
              <Select value={occSeverity} onValueChange={(v) => setOccSeverity(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm">Descrição</label>
              <Textarea rows={3} value={occDesc} onChange={(e) => setOccDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOccOpen(false)}>Cancelar</Button>
            <Button onClick={registerOccurrence}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Próxima entrega */}
      <Dialog open={nextDialogOpen} onOpenChange={setNextDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Próxima entrega liberada</DialogTitle></DialogHeader>
          {nextStop.data?.stop && (
            <div className="space-y-1">
              <div className="text-sm font-medium">#{nextStop.data.stop.sequence} · {nextStop.data.stop.pdv_name}</div>
              <div className="text-xs text-muted-foreground">{nextStop.data.stop.pdv_address}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNextDialogOpen(false)}>Depois</Button>
            <Button onClick={goToNext}><Navigation className="w-4 h-4 mr-1" /> Navegar até lá</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Requisito({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-emerald-700" : "text-muted-foreground"}`}>
      <CheckCircle2 className={`w-3 h-3 ${ok ? "opacity-100" : "opacity-40"}`} />
      {label}
    </li>
  );
}
