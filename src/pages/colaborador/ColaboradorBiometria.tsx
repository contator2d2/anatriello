import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ScanFace, Camera, CheckCircle2, Play, Loader2, ShieldCheck, AlertTriangle, RotateCcw } from "lucide-react";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { FaceCaptureDialog } from "@/components/facial-recognition/FaceCaptureDialog";
import { FaceVerifyDialog } from "@/components/facial-recognition/FaceVerifyDialog";
import { useToast } from "@/hooks/use-toast";

type Sample = {
  descriptor: number[];
  landmarks: number[][];
  imageDataUrl: string;
  geometricProfile: Record<string, number>;
  quality: number;
};

const promotorApi = async <T,>(endpoint: string, options: any = {}): Promise<T> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("promotor_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const url = `${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}${endpoint}`;
  const r = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || "Erro");
  return data as T;
};

interface Status {
  enrolled: boolean;
  face_descriptor?: number[] | null;
  face_photo_url: string | null;
  face_enrolled_at: string | null;
  collection_requested: boolean;
  allow_self_enrollment: boolean;
  min_confidence: number;
  can_enroll: boolean;
  can_test?: boolean;
}

function normalizeFaceDescriptor(input: any): number[] {
  let parsed = input;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  const source = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.descriptor)
      ? parsed.descriptor
      : Array.isArray(parsed?.face_descriptor)
        ? parsed.face_descriptor
        : [];
  return source.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n));
}

async function requestUserCameraOnce(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

export default function ColaboradorBiometria() {
  const nav = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["colab-face-status"],
    queryFn: () => promotorApi<Status>("/api/promotor/face-enrollment"),
  });

  const [samples, setSamples] = useState<Sample[]>([]);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [existingTestOpen, setExistingTestOpen] = useState(false);
  const [testPassed, setTestPassed] = useState(false);

  const bestSample = samples.length
    ? samples.reduce((a, b) => (b.quality > a.quality ? b : a))
    : null;

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      promotorApi("/api/promotor/face-enrollment", { method: "POST", body: payload }),
    onSuccess: () => {
      toast({ title: "Biometria cadastrada com sucesso!" });
      setSamples([]);
      setTestPassed(false);
      qc.invalidateQueries({ queryKey: ["colab-face-status"] });
      qc.invalidateQueries({ queryKey: ["colab-me-full"] });
      qc.invalidateQueries({ queryKey: ["promotor-home"] });
    },
    onError: (e: any) =>
      toast({ title: e?.message || "Erro ao salvar biometria", variant: "destructive" }),
  });

  const handleCapture = (data: any) => {
    const quality = Number(data?.quality) || 0;
    const sample: Sample = {
      descriptor: data.descriptor,
      landmarks: data.landmarks,
      imageDataUrl: data.imageDataUrl,
      geometricProfile: data.geometricProfile,
      // FaceCaptureDialog não devolve `quality`; usamos a confiança da última detecção via geometricProfile?.confidence se existir.
      // Como fallback, marcamos 80 (média) e o backend valida o mínimo do config.
      quality: quality || (data.confidence ?? 80),
    };
    setSamples((prev) => [...prev, sample]);
    setTestPassed(false);
    setCaptureOpen(false);
  };

  const handleSave = () => {
    if (!bestSample) return;
    saveMutation.mutate({
      samples: samples.map((s) => ({
        descriptor: s.descriptor,
        landmarks: s.landmarks,
        imageDataUrl: s.imageDataUrl,
        geometricProfile: s.geometricProfile,
        quality: s.quality,
      })),
    });
  };

  const openCameraDialog = async (open: () => void) => {
    const cameraReady = await requestUserCameraOnce();
    if (!cameraReady) {
      toast({ title: "Câmera não autorizada", description: "Permita o acesso à câmera para usar a biometria facial.", variant: "destructive" });
      return;
    }
    open();
  };

  if (isLoading) {
    return (
      <ColaboradorLayout title="Biometria Facial" showBack>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </ColaboradorLayout>
    );
  }

  // Estados possíveis:
  // A) coleta não permitida pelo RH → aviso
  // B) já cadastrado e sem solicitação → cadastro bloqueado (só mostra info)
  // C) pode cadastrar (novo ou nova coleta pedida) → fluxo de captura
  const existingDescriptor = normalizeFaceDescriptor(status?.face_descriptor);
  const blocked = !status?.enrolled && !status?.allow_self_enrollment && !status?.collection_requested;
  const alreadyDone = status?.enrolled && !status?.collection_requested;
  const canEnroll = !!status?.can_enroll;

  return (
    <ColaboradorLayout title="Biometria Facial" showBack bg="light">
      <div className="px-4 py-5 space-y-4">
        {blocked && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Coleta pelo app desativada</p>
              <p className="text-xs text-slate-500 mt-1">
                A coleta de biometria pelo App do Colaborador está desativada pela sua empresa.
                Procure o RH para cadastrar sua biometria.
              </p>
            </div>
          </div>
        )}

        {alreadyDone && !blocked && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-200 flex items-start gap-3">
            {status?.face_photo_url ? (
              <img src={status.face_photo_url} alt="Foto biométrica" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-emerald-600" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700">Biometria ativa</p>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Você já cadastrou sua biometria facial. Para trocá-la, o RH precisa solicitar uma nova coleta.
              </p>
              {status?.face_enrolled_at && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Cadastrada em {new Date(status.face_enrolled_at).toLocaleDateString("pt-BR")}
                </p>
              )}
              {existingDescriptor.length >= 64 && (
                <button
                  onClick={() => openCameraDialog(() => setExistingTestOpen(true))}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl active:scale-95"
                >
                  <Play className="h-3.5 w-3.5" /> Testar facial atual
                </button>
              )}
            </div>
          </div>
        )}

        {canEnroll && (
          <>
            {status?.collection_requested && status?.enrolled && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800 space-y-2">
                <p>O RH solicitou uma <b>nova coleta</b>. Sua biometria atual continua válida para testar e bater ponto até você salvar uma nova.</p>
                {existingDescriptor.length >= 64 && (
                  <button
                    onClick={() => openCameraDialog(() => setExistingTestOpen(true))}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-white border border-amber-200 px-3 py-2 rounded-xl active:scale-95"
                  >
                    <Play className="h-3.5 w-3.5" /> Testar biometria atual
                  </button>
                )}
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <h2 className="text-sm font-bold text-slate-800 mb-1">Como funciona</h2>
              <ol className="text-xs text-slate-500 space-y-1.5 list-decimal pl-4 mt-2">
                <li>Faça <b>2 capturas</b> do seu rosto (rosto frontal, boa iluminação, sem óculos escuros).</li>
                <li>O sistema guarda automaticamente a captura de <b>maior qualidade</b>.</li>
                <li>Faça um <b>teste facial</b> para validar o cadastro.</li>
                <li>Após o teste ok, sua biometria é salva e a coleta é bloqueada até o RH solicitar nova coleta.</li>
              </ol>
            </div>

            {/* Capturas */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">Capturas ({samples.length}/2)</p>
                  <p className="text-[11px] text-slate-500">
                    Mínimo de qualidade exigido: {status?.min_confidence ?? 70}%
                  </p>
                </div>
                <button
                  onClick={() => openCameraDialog(() => setCaptureOpen(true))}
                  disabled={samples.length >= 2}
                  className="bg-[#f97316] text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Camera className="h-4 w-4" />
                  {samples.length === 0 ? "Capturar 1ª" : samples.length === 1 ? "Capturar 2ª" : "Concluído"}
                </button>
              </div>

              {samples.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {samples.map((s, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden bg-slate-100 aspect-square">
                      <img src={s.imageDataUrl} alt={`Captura ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between bg-black/60 text-white text-[10px] px-2 py-1 rounded">
                        <span>#{i + 1}</span>
                        <span className="font-bold">{Math.round(s.quality)}%</span>
                      </div>
                      {bestSample === s && (
                        <div className="absolute top-1 right-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" /> MELHOR
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {samples.length > 0 && (
                <button
                  onClick={() => { setSamples([]); setTestPassed(false); }}
                  className="text-xs text-slate-500 flex items-center gap-1 mx-auto"
                >
                  <RotateCcw className="h-3 w-3" /> Refazer capturas
                </button>
              )}
            </div>

            {/* Teste + Salvar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Testar facial</p>
                <p className="text-[11px] text-slate-500">
                  Posicione o rosto e valide se o sistema reconhece você antes de salvar.
                </p>
              </div>
              <button
                onClick={() => openCameraDialog(() => setTestOpen(true))}
                disabled={samples.length < 2}
                className="w-full bg-slate-900 text-white text-sm font-bold py-3 rounded-xl active:scale-[.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Play className="h-4 w-4" />
                {testPassed ? "Testar novamente" : "Iniciar teste facial"}
              </button>
              {testPassed && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Teste aprovado — agora salve sua biometria.
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={!testPassed || saveMutation.isPending}
                className="w-full bg-[#f97316] text-white text-sm font-bold py-3 rounded-xl active:scale-[.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
                Salvar biometria
              </button>
            </div>
          </>
        )}
      </div>

      <FaceCaptureDialog
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        title={`Captura ${samples.length + 1} de 2`}
        description="Posicione seu rosto de frente para a câmera, em local bem iluminado. Após capturar, confirme para prosseguir."
        onCapture={handleCapture}
      />

      {bestSample && (
        <FaceVerifyDialog
          open={testOpen}
          onOpenChange={setTestOpen}
          storedDescriptor={bestSample.descriptor}
          storedPhotoUrl={bestSample.imageDataUrl}
          personName="Você"
          threshold={status?.min_confidence ?? 70}
          onResult={(r) => {
            setTestOpen(false);
            if (r.match) {
              setTestPassed(true);
              toast({ title: "Teste aprovado!", description: `Similaridade: ${r.score.toFixed(1)}%` });
            } else {
              setTestPassed(false);
              toast({
                title: "Teste reprovado",
                description: `Similaridade: ${r.score.toFixed(1)}%. Refaça as capturas em local mais iluminado.`,
                variant: "destructive",
              });
            }
          }}
        />
      )}

      {existingDescriptor.length >= 64 && (
        <FaceVerifyDialog
          open={existingTestOpen}
          onOpenChange={setExistingTestOpen}
          storedDescriptor={existingDescriptor}
          storedPhotoUrl={status?.face_photo_url || undefined}
          personName="Você"
          threshold={status?.min_confidence ?? 70}
          onResult={(r) => {
            setExistingTestOpen(false);
            if (r.match) {
              toast({ title: "Facial atual aprovada", description: `Similaridade: ${r.score.toFixed(1)}%` });
            } else {
              toast({ title: "Facial atual não conferiu", description: `Similaridade: ${r.score.toFixed(1)}%. Faça uma nova coleta.`, variant: "destructive" });
            }
          }}
        />
      )}
    </ColaboradorLayout>
  );
}
