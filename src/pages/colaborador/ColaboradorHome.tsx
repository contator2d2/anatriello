import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, FileText, Umbrella, Gift, FolderOpen, Edit3, Clock, MessageSquare, ChevronRight, Megaphone, Loader2, Camera, MapPin, ShieldOff, ScanFace, FileSignature } from "lucide-react";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { usePromotorHome, usePromotorPunch, usePromotorNotifications, usePromotorMarkRead } from "@/hooks/use-promotor";
import { useColabAnnouncements, useColabMeFull } from "@/hooks/use-promotor";
import { useCaps } from "@/hooks/use-colab-capabilities";
import { FaceVerifyDialog } from "@/components/facial-recognition/FaceVerifyDialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const PUNCH_ORDER = ["entrada", "saida_intervalo", "retorno_intervalo", "saida"];
const PUNCH_LABEL: Record<string, string> = {
  entrada: "Entrada", saida_intervalo: "Início Almoço", retorno_intervalo: "Fim Almoço", saida: "Saída"
};

export default function ColaboradorHome() {
  const nav = useNavigate();
  const { toast } = useToast();
  const { data, isLoading } = usePromotorHome();
  const { data: meFull } = useColabMeFull();
  const { data: announcements } = useColabAnnouncements();
  const { data: notifications } = usePromotorNotifications();
  const markRead = usePromotorMarkRead();
  const punch = usePromotorPunch();
  const caps = useCaps();
  const can = (c: string) => caps.includes(c);
  const [now, setNow] = useState(new Date());
  const [showFace, setShowFace] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);

  const { data: faceStatus } = useQuery({
    queryKey: ["colab-face-status"],
    queryFn: async () => {
      const token = localStorage.getItem("promotor_token");
      const url = `${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}/api/promotor/face-enrollment`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      return r.json() as Promise<{ can_enroll: boolean; enrolled: boolean; collection_requested: boolean }>;
    },
    refetchInterval: 60000,
  });

  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setGps({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const employee = data?.employee || meFull?.employee;
  const punches = data?.today_punches || [];
  const nextIdx = Math.min(punches.length, PUNCH_ORDER.length - 1);
  const nextType = PUNCH_ORDER[punches.length] || "extraordinaria";
  const situacao = punches.length === 0 ? "Fora da jornada"
    : punches.length === 4 ? "Jornada encerrada"
    : (punches[punches.length - 1]?.punch_type === "saida_intervalo" ? "Em almoço" : "Em jornada");
  const entradaHora = punches.find((p: any) => p.punch_type === "entrada")?.punched_at;
  const almocoHora = punches.find((p: any) => p.punch_type === "saida_intervalo")?.punched_at;
  const unreadCount = (notifications || []).filter((n: any) => !n.read).length;
  const facialRequired = employee?.facial_required === true || can("punch.facial_required");
  const canPunch = can("punch.register");

  async function doPunch(facialVerified = false, selfieDataUrl?: string) {
    if (!gps) { toast({ title: "Aguardando GPS", variant: "destructive" }); return; }
    try {
      await punch.mutateAsync({
        punch_type: nextType,
        latitude: gps.lat, longitude: gps.lng, accuracy_meters: gps.acc,
        facial_verified: facialVerified,
        selfie_url: selfieDataUrl,
      });
      toast({ title: `${PUNCH_LABEL[nextType] || "Ponto"} registrada` });
    } catch (e: any) { toast({ title: e.message || "Erro ao registrar", variant: "destructive" }); }
  }

  function handlePunchClick() {
    if (punches.length >= 4) { toast({ title: "Jornada concluída" }); return; }
    if (facialRequired) setShowFace(true); else doPunch(false);
  }

  return (
    <ColaboradorLayout bg="light">
      {/* Header */}
      <div className="bg-[#0a1128] text-white px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-8 rounded-b-3xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-white/70">Olá,</p>
            <h1 className="text-xl font-bold flex items-center gap-2">{employee?.full_name?.split(" ")[0] || "Colaborador"} <span>👋</span></h1>
            <p className="text-xs text-white/60 mt-1">{saudacao()}! {format(now, "EEEE, dd/MM/yyyy", { locale: ptBR })}</p>
          </div>
          <button className="relative p-2 rounded-full bg-white/10">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-[#f97316] text-[10px] font-bold flex items-center justify-center">{unreadCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4">
        {/* Ponto card — só aparece com capability punch.register */}
        {canPunch ? (
          <div className="bg-gradient-to-br from-[#f97316] to-[#ea580c] rounded-2xl p-4 text-white shadow-lg shadow-orange-500/30">
            <div className="flex items-center justify-between text-xs uppercase font-bold mb-3">
              <span>Ponto</span>
              <span className="opacity-90">Situação</span>
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs opacity-90">Horário atual</p>
                <p className="text-3xl font-bold tracking-tight">{format(now, "HH:mm")}</p>
                <p className="text-xs opacity-80 mt-1">{format(now, "dd/MM/yyyy")}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{situacao}</p>
                <p className="text-xs opacity-90 mt-1">Entrada: {entradaHora ? format(new Date(entradaHora), "HH:mm") : "—:—"}</p>
                <p className="text-xs opacity-90">Almoço: {almocoHora ? format(new Date(almocoHora), "HH:mm") : "—:—"}</p>
              </div>
            </div>
            <button
              onClick={handlePunchClick}
              disabled={punch.isPending || punches.length >= 4}
              className="w-full bg-white text-[#ea580c] font-bold text-sm py-3 rounded-xl active:scale-[.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {punch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : facialRequired ? <Camera className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              {punches.length >= 4 ? "JORNADA ENCERRADA" : `REGISTRAR ${PUNCH_LABEL[nextType]?.toUpperCase() || "PONTO"}`}
            </button>
            {gps ? (
              <p className="text-[10px] opacity-80 mt-2 text-center">GPS ativo · precisão {Math.round(gps.acc)}m</p>
            ) : (
              <p className="text-[10px] opacity-80 mt-2 text-center">Aguardando GPS…</p>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <ShieldOff className="h-5 w-5 text-slate-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700">Seu perfil não bate ponto pelo app</p>
              <p className="text-xs text-slate-500 mt-0.5">Registre a entrada na portaria ou fale com seu gestor.</p>
            </div>
          </div>
        )}

        {/* Coleta de biometria facial pelo app — só aparece quando o RH habilita e o colaborador ainda pode cadastrar */}
        {faceStatus?.can_enroll && (
          <button
            onClick={() => nav("/colaborador/biometria")}
            className="w-full bg-gradient-to-br from-[#0ea5e9] to-[#0369a1] rounded-2xl p-4 text-left text-white shadow-lg shadow-sky-500/20 active:scale-[.99] transition"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <ScanFace className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase font-bold opacity-80">Biometria facial</p>
                <p className="text-sm font-bold truncate">
                  {faceStatus.collection_requested && faceStatus.enrolled
                    ? "RH pediu nova coleta"
                    : "Cadastre sua biometria facial"}
                </p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  2 capturas + teste rápido. Leva menos de 1 minuto.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 opacity-80" />
            </div>
          </button>
        )}


        {/* Acesso rápido — filtrado por capability */}
        <div>
          <p className="text-sm font-bold mb-3">Acesso rápido</p>
          <div className="grid grid-cols-4 gap-3">
            {can("payslip.view") && <QuickAction icon={FileText} label="Holerite" color="#3b82f6" onClick={() => nav("/colaborador/holerite")} />}
            {can("vacations.view") && <QuickAction icon={Umbrella} label="Férias" color="#06b6d4" onClick={() => nav("/colaborador/ferias")} />}
            {can("benefits.view") && <QuickAction icon={Gift} label="Benefícios" color="#f43f5e" onClick={() => nav("/colaborador/beneficios")} />}
            {can("documents.view") && <QuickAction icon={FolderOpen} label="Documentos" color="#8b5cf6" onClick={() => nav("/colaborador/documentos")} />}
            {can("requests.view") && <QuickAction icon={Edit3} label="Solicitações" color="#f59e0b" onClick={() => nav("/colaborador/solicitacoes")} />}
            {can("journey.view") && <QuickAction icon={Clock} label="Jornada" color="#10b981" onClick={() => nav("/colaborador/jornada")} />}
            {can("announcements.view") && <QuickAction icon={Bell} label="Comunicados" color="#ef4444" onClick={() => nav("/colaborador/perfil")} />}
          </div>
        </div>


        {can("announcements.view") && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold">Comunicados</p>
              <button className="text-xs text-[#f97316] font-semibold">Ver todos</button>
            </div>
            {(announcements || []).slice(0, 2).map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 py-2 border-t border-slate-100 first:border-0">
                <div className="h-10 w-10 rounded-full bg-orange-100 text-[#f97316] flex items-center justify-center flex-shrink-0">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.title}</p>
                  <p className="text-xs text-slate-500 truncate">{a.body}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{format(new Date(a.published_at), "dd/MM 'às' HH:mm")}</p>
                </div>
              </div>
            ))}
            {!announcements?.length && (
              <p className="text-xs text-slate-400 text-center py-6">Nenhum comunicado no momento</p>
            )}
          </div>
        )}

        {isLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />}
      </div>

      {showFace && employee?.face_descriptor && (
        <FaceVerifyDialog
          open={showFace}
          onOpenChange={setShowFace}
          storedDescriptor={employee.face_descriptor}
          onResult={(r) => { setShowFace(false); if (r.match) doPunch(true, r.imageDataUrl); else toast({ title: "Falha na validação facial", variant: "destructive" }); }}
        />
      )}
    </ColaboradorLayout>
  );
}

function QuickAction({ icon: Icon, label, color, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 active:scale-95 transition">
      <div className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: `${color}15`, color }}>
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-[10px] font-medium text-slate-600 text-center leading-tight">{label}</span>
    </button>
  );
}
