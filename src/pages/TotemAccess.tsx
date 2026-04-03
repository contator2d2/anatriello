import { useState, useRef, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Clock, Store, Delete, Settings, UserCheck, LogOut, LogIn, Lock, Unplug, QrCode, Camera, ScanFace, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface ValidationResult {
  status: "authorized" | "blocked";
  promoter_name?: string;
  promoter_photo?: string;
  agency_name?: string;
  brands?: string[];
  entry_id?: string;
  block_reason?: string;
}

interface LookupResult {
  name: string;
  photo_url?: string;
  agency_name?: string;
  brands: string[];
  has_open_entry: boolean;
  open_entry_id?: string;
  entry_at?: string;
  agency_promoter_id?: string;
  employee_id?: string;
}

interface TotemConfig {
  token: string;
  unitName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  buttonColor: string;
  buttonTextColor: string;
  headerText: string;
}

interface TotemSession {
  token: string;
  unitName: string;
  unitLogo: string;
  unitCity: string;
  unitState: string;
  userName: string;
  userEmail: string;
}

interface AuthConfig {
  cpf_entry_enabled: boolean;
  qr_entry_enabled: boolean;
  selfie_entry_required: boolean;
  selfie_exit_required: boolean;
  facial_recognition_enabled: boolean;
  combined_validation: string;
  security_level: string;
  require_lgpd_consent: boolean;
  consent_text: string | null;
}

const DEFAULT_CONFIG: TotemConfig = {
  token: "", unitName: "PDV", logoUrl: "", primaryColor: "#3b82f6",
  secondaryColor: "#1e293b", bgColor: "#0f172a", buttonColor: "#3b82f6",
  buttonTextColor: "#ffffff", headerText: "Controle de Acesso",
};

const DEFAULT_AUTH: AuthConfig = {
  cpf_entry_enabled: true, qr_entry_enabled: false, selfie_entry_required: false,
  selfie_exit_required: false, facial_recognition_enabled: false,
  combined_validation: "cpf_only", security_level: "basic",
  require_lgpd_consent: false, consent_text: null,
};

function loadSession(): TotemSession | null {
  try { const s = localStorage.getItem("totem_session"); if (s) return JSON.parse(s); } catch {} return null;
}
function saveSession(s: TotemSession) { localStorage.setItem("totem_session", JSON.stringify(s)); }
function clearSession() { localStorage.removeItem("totem_session"); }
function loadConfig(): TotemConfig {
  try { const s = localStorage.getItem("totem_config"); if (s) return { ...DEFAULT_CONFIG, ...JSON.parse(s) }; } catch {}
  return DEFAULT_CONFIG;
}
function saveConfig(c: TotemConfig) { localStorage.setItem("totem_config", JSON.stringify(c)); }

const NUMPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

const TotemAccess = () => {
  const [session, setSession] = useState<TotemSession | null>(loadSession);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [authConfig, setAuthConfig] = useState<AuthConfig>(DEFAULT_AUTH);
  const [authMode, setAuthMode] = useState<"select" | "cpf" | "qr">("select");
  const [cpfDigits, setCpfDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [config, setConfig] = useState<TotemConfig>(() => {
    const c = loadConfig(); const s = loadSession();
    if (s) return { ...c, token: s.token, unitName: s.unitName, logoUrl: s.unitLogo || c.logoUrl };
    return c;
  });
  const [configOpen, setConfigOpen] = useState(false);
  const [configForm, setConfigForm] = useState<TotemConfig>(config);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);

  // Selfie state
  const [selfieRequired, setSelfieRequired] = useState(false);
  const [selfieCapture, setSelfieCapture] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // LGPD
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [showLgpd, setShowLgpd] = useState(false);

  const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (result) { const t = setTimeout(handleReset, 8000); return () => clearTimeout(t); }
  }, [result]);

  // Load auth config when session is ready
  useEffect(() => {
    if (!session?.token) return;
    fetch(`${API_URL}/api/access-control/totem/auth-config`, {
      headers: { "x-totem-token": session.token },
    }).then(r => r.json()).then(data => {
      setAuthConfig(data);
      // Auto-select mode if only one is enabled
      if (data.cpf_entry_enabled && !data.qr_entry_enabled) setAuthMode("cpf");
      else if (!data.cpf_entry_enabled && data.qr_entry_enabled) setAuthMode("qr");
      else setAuthMode("select");
    }).catch(() => {});
  }, [session?.token]);

  const formatCpf = (digits: string) => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  // ═══ Camera ═══
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setShowCamera(true);
    } catch { setLookupError("Não foi possível acessar a câmera"); }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setSelfieCapture(dataUrl);
    stopCamera();
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  };

  // ═══ Login ═══
  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) return;
    setLoginLoading(true); setLoginError("");
    try {
      const res = await fetch(`${API_URL}/api/access-control/totem/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim().toLowerCase(), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "Erro no login"); return; }
      const newSession: TotemSession = {
        token: data.totem_token, unitName: data.unit?.name || "PDV",
        unitLogo: data.unit?.logo_url || "", unitCity: data.unit?.city || "",
        unitState: data.unit?.state || "", userName: data.user?.name || "", userEmail: data.user?.email || "",
      };
      saveSession(newSession); setSession(newSession);
      const newConfig = { ...config, token: newSession.token, unitName: newSession.unitName, logoUrl: newSession.unitLogo || config.logoUrl };
      setConfig(newConfig); saveConfig(newConfig);
    } catch { setLoginError("Erro de conexão com o servidor"); }
    finally { setLoginLoading(false); }
  };

  const handleDisconnect = () => {
    clearSession(); setSession(null); setConfig(prev => ({ ...prev, token: "" }));
    setDisconnectConfirm(false); setLoginEmail(""); setLoginPassword("");
  };

  // ═══ CPF flow ═══
  const handleNumpadPress = (key: string) => {
    if (lookupResult || lookupError) return;
    if (key === "⌫") { setCpfDigits(prev => prev.slice(0, -1)); }
    else if (key && cpfDigits.length < 11) {
      const newDigits = cpfDigits + key;
      setCpfDigits(newDigits);
      if (newDigits.length === 11) setTimeout(() => handleLookup(newDigits), 300);
    }
  };

  const handleLookup = async (digits: string) => {
    setLookupLoading(true); setLookupError(null);
    try {
      const res = await fetch(`${API_URL}/api/access-control/totem/lookup`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-totem-token": config.token },
        body: JSON.stringify({ cpf: digits }),
      });
      const data = await res.json();
      if (res.ok && data.found) {
        const lr: LookupResult = {
          name: data.promoter.name, photo_url: data.promoter.photo_url,
          agency_name: data.promoter.agency_name,
          brands: (data.brands || []).map((b: any) => b.name || b),
          has_open_entry: !!data.has_open_entry, open_entry_id: data.open_entry_id, entry_at: data.entry_at,
        };
        setLookupResult(lr);
        // Check if selfie is required for this step
        if (!lr.has_open_entry && authConfig.selfie_entry_required) setSelfieRequired(true);
        if (lr.has_open_entry && authConfig.selfie_exit_required) setSelfieRequired(true);
        // Check LGPD consent
        if (authConfig.require_lgpd_consent && (authConfig.selfie_entry_required || authConfig.facial_recognition_enabled)) {
          setShowLgpd(true);
        }
      } else {
        setLookupError(data.reason || "Cadastro não encontrado");
      }
    } catch { setLookupError("Erro de conexão com o servidor"); }
    finally { setLookupLoading(false); }
  };

  const handleConfirmCheckin = async () => {
    // If selfie required and not captured yet, open camera
    if (selfieRequired && !selfieCapture) { startCamera(); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/access-control/totem/validate`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-totem-token": config.token },
        body: JSON.stringify({ cpf: cpfDigits }),
      });
      const data = await res.json();
      if (res.ok && data.authorized) {
        // Log selfie if captured
        if (selfieCapture) {
          fetch(`${API_URL}/api/access-control/totem/selfie`, {
            method: "POST", headers: { "Content-Type": "application/json", "x-totem-token": config.token },
            body: JSON.stringify({
              entry_log_id: data.entry_id, capture_type: "entry", image_url: selfieCapture,
              agency_promoter_id: lookupResult?.agency_promoter_id, employee_id: lookupResult?.employee_id,
            }),
          }).catch(() => {});
        }
        // Log auth attempt
        fetch(`${API_URL}/api/access-control/totem/auth-attempt`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-totem-token": config.token },
          body: JSON.stringify({
            cpf: cpfDigits, method: authMode === "qr" ? "qr" : selfieCapture ? "combined" : "cpf",
            auth_steps: [
              { step: authMode, result: "ok" },
              ...(selfieCapture ? [{ step: "selfie", result: "ok" }] : []),
            ],
            overall_result: "approved", entry_log_id: data.entry_id,
          }),
        }).catch(() => {});

        setResult({
          status: "authorized", promoter_name: data.promoter?.name, promoter_photo: data.promoter?.photo_url,
          agency_name: data.promoter?.agency, brands: data.brands?.map((b: any) => b.name || b) || [],
          entry_id: data.entry_id,
        });
      } else {
        setResult({ status: "blocked", block_reason: data.reason || data.error || "Acesso não autorizado" });
      }
    } catch { setResult({ status: "blocked", block_reason: "Erro de conexão com o servidor" }); }
    finally { setLoading(false); setLookupResult(null); setLookupError(null); setSelfieRequired(false); setSelfieCapture(null); }
  };

  const handleConfirmCheckout = async () => {
    if (!lookupResult?.open_entry_id) return;
    if (selfieRequired && !selfieCapture) { startCamera(); return; }
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/access-control/totem/checkout`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-totem-token": config.token },
        body: JSON.stringify({ entry_id: lookupResult.open_entry_id }),
      });
      if (selfieCapture) {
        fetch(`${API_URL}/api/access-control/totem/selfie`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-totem-token": config.token },
          body: JSON.stringify({
            entry_log_id: lookupResult.open_entry_id, capture_type: "exit", image_url: selfieCapture,
          }),
        }).catch(() => {});
      }
      setResult({
        status: "authorized", promoter_name: lookupResult.name, promoter_photo: lookupResult.photo_url,
        agency_name: lookupResult.agency_name, block_reason: "SAÍDA REGISTRADA",
      });
    } catch { setResult({ status: "blocked", block_reason: "Erro ao registrar saída" }); }
    finally { setLoading(false); setLookupResult(null); setSelfieRequired(false); setSelfieCapture(null); }
  };

  const handleCheckout = async () => {
    if (!result?.entry_id) return;
    try {
      await fetch(`${API_URL}/api/access-control/totem/checkout`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-totem-token": config.token },
        body: JSON.stringify({ entry_id: result.entry_id }),
      });
    } catch {} handleReset();
  };

  const handleReset = () => {
    setResult(null); setLookupResult(null); setLookupError(null); setCpfDigits("");
    setSelfieRequired(false); setSelfieCapture(null); setShowCamera(false); setLgpdAccepted(false); setShowLgpd(false);
    stopCamera();
    // Reset to mode selection if multiple modes available
    if (authConfig.cpf_entry_enabled && authConfig.qr_entry_enabled) setAuthMode("select");
  };

  const handleSaveConfig = () => {
    saveConfig(configForm); setConfig(configForm);
    if (session) {
      const us = { ...session, token: configForm.token, unitName: configForm.unitName, unitLogo: configForm.logoUrl };
      saveSession(us); setSession(us);
    }
    setConfigOpen(false);
  };

  const bgStyle = { background: `linear-gradient(135deg, ${config.bgColor} 0%, ${config.secondaryColor} 50%, ${config.bgColor} 100%)` };
  const btnStyle = { backgroundColor: config.buttonColor, color: config.buttonTextColor };
  const numpadBtnStyle = { backgroundColor: `${config.primaryColor}22`, borderColor: `${config.primaryColor}44`, color: "#fff" };

  // ═══ LOGIN SCREEN ═══
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 select-none" style={bgStyle}>
        <div className="text-center max-w-sm w-full space-y-6">
          <ShieldCheck className="h-20 w-20 mx-auto drop-shadow-lg" style={{ color: config.primaryColor }} />
          <h1 className="text-3xl font-bold text-white">Totem de Acesso</h1>
          <p className="text-white/60">Faça login com as credenciais do PDV para ativar o totem</p>
          <Card className="bg-white/10 border-white/20 p-6 backdrop-blur space-y-4">
            <div className="text-left">
              <Label className="text-white/80">E-mail</Label>
              <Input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                placeholder="email@pdv.com" className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
            <div className="text-left">
              <Label className="text-white/80">Senha</Label>
              <Input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••" className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <Button onClick={handleLogin} disabled={loginLoading || !loginEmail || !loginPassword}
              className="w-full h-12 text-lg font-bold" style={btnStyle}>
              {loginLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Lock className="h-5 w-5 mr-2" />}
              {loginLoading ? "Conectando..." : "Conectar Totem"}
            </Button>
          </Card>
          <p className="text-white/30 text-xs">As credenciais são fornecidas pelo administrador do sistema</p>
        </div>
      </div>
    );
  }

  // ═══ Result screen ═══
  if (result) {
    const isAuthorized = result.status === "authorized";
    const isCheckout = result.block_reason === "SAÍDA REGISTRADA";
    const bgColor = isCheckout ? "#2563eb" : isAuthorized ? "#16a34a" : "#dc2626";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 transition-colors duration-500" style={{ background: bgColor }}>
        <div className="text-center text-white max-w-lg w-full">
          {config.logoUrl && <img src={config.logoUrl} alt="Logo" className="h-16 mx-auto mb-6 object-contain" />}
          {isCheckout ? <LogOut className="h-32 w-32 mx-auto mb-6 animate-in zoom-in duration-500" /> :
           isAuthorized ? <CheckCircle2 className="h-32 w-32 mx-auto mb-6 animate-in zoom-in duration-500" /> :
           <XCircle className="h-32 w-32 mx-auto mb-6 animate-in zoom-in duration-500" />}
          <h1 className="text-5xl font-bold mb-4">
            {isCheckout ? "SAÍDA REGISTRADA" : isAuthorized ? "ACESSO LIBERADO" : "ACESSO BLOQUEADO"}
          </h1>
          {isAuthorized && !isCheckout && (
            <Card className="bg-white/20 backdrop-blur border-white/30 p-6 mt-6 text-white">
              {result.promoter_photo && <img src={result.promoter_photo} alt="Foto" className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white object-cover" />}
              <p className="text-3xl font-semibold mb-2">{result.promoter_name}</p>
              {result.agency_name && <p className="text-xl opacity-90 mb-4">Agência: {result.agency_name}</p>}
              {result.brands && result.brands.length > 0 && (
                <div className="mt-4">
                  <p className="text-lg mb-2 opacity-80">Marcas autorizadas hoje:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {result.brands.map((brand) => <Badge key={brand} className="bg-white/30 text-white text-lg px-4 py-1">{brand}</Badge>)}
                  </div>
                </div>
              )}
            </Card>
          )}
          {isCheckout && (
            <Card className="bg-white/20 backdrop-blur border-white/30 p-6 mt-6 text-white">
              {result.promoter_photo && <img src={result.promoter_photo} alt="Foto" className="w-20 h-20 rounded-full mx-auto mb-3 border-4 border-white object-cover" />}
              <p className="text-2xl font-semibold">{result.promoter_name}</p>
              {result.agency_name && <p className="text-lg opacity-80">Agência: {result.agency_name}</p>}
            </Card>
          )}
          {!isAuthorized && !isCheckout && <p className="text-2xl mt-4 opacity-90">{result.block_reason}</p>}
          <div className="mt-8 flex gap-4 justify-center">
            {isAuthorized && result.entry_id && (
              <Button size="lg" onClick={handleCheckout} className="bg-white text-green-700 hover:bg-white/90 text-xl px-8 py-6">Registrar Saída</Button>
            )}
            <Button size="lg" variant="outline" onClick={handleReset} className="border-white text-white hover:bg-white/20 text-xl px-8 py-6">Nova Consulta</Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ Camera / Selfie screen ═══
  if (showCamera) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 select-none" style={bgStyle}>
        <div className="text-center max-w-md w-full space-y-4">
          <Camera className="h-12 w-12 mx-auto text-white/70" />
          <h2 className="text-2xl font-bold text-white">Capture sua Selfie</h2>
          <p className="text-white/60 text-sm">Posicione seu rosto no centro da câmera</p>
          <div className="relative rounded-2xl overflow-hidden border-4" style={{ borderColor: config.primaryColor }}>
            <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-[4/3] object-cover" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 rounded-full border-4 border-dashed border-white/50" />
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-3">
            <Button onClick={() => { stopCamera(); setSelfieRequired(false); }} variant="outline" className="flex-1 h-14 text-lg border-white/30 text-white hover:bg-white/10">
              Cancelar
            </Button>
            <Button onClick={capturePhoto} className="flex-1 h-14 text-lg font-bold" style={btnStyle}>
              <Camera className="h-5 w-5 mr-2" /> Capturar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ Selfie preview & confirm ═══
  if (selfieCapture) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 select-none" style={bgStyle}>
        <div className="text-center max-w-md w-full space-y-4">
          <CheckCircle2 className="h-12 w-12 mx-auto" style={{ color: config.primaryColor }} />
          <h2 className="text-2xl font-bold text-white">Selfie Capturada</h2>
          <div className="rounded-2xl overflow-hidden border-4" style={{ borderColor: config.primaryColor }}>
            <img src={selfieCapture} alt="Selfie" className="w-full aspect-[4/3] object-cover" />
          </div>
          <div className="flex gap-3">
            <Button onClick={() => { setSelfieCapture(null); startCamera(); }} variant="outline" className="flex-1 h-14 text-lg border-white/30 text-white hover:bg-white/10">
              Repetir
            </Button>
            <Button onClick={() => {
              if (lookupResult?.has_open_entry) handleConfirmCheckout();
              else handleConfirmCheckin();
            }} disabled={loading} className="flex-1 h-14 text-lg font-bold" style={btnStyle}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
              {loading ? "Processando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ LGPD Consent ═══
  if (showLgpd && !lgpdAccepted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 select-none" style={bgStyle}>
        <div className="text-center max-w-md w-full space-y-4">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-400" />
          <h2 className="text-2xl font-bold text-white">Consentimento LGPD</h2>
          <Card className="bg-white/10 border-white/20 p-6 backdrop-blur text-left">
            <p className="text-white/80 text-sm leading-relaxed">
              {authConfig.consent_text || "Ao utilizar este sistema, você consente com a captura e armazenamento temporário de sua imagem para fins de controle de acesso, conforme a Lei Geral de Proteção de Dados (LGPD)."}
            </p>
          </Card>
          <div className="flex gap-3">
            <Button onClick={handleReset} variant="outline" className="flex-1 h-14 text-lg border-white/30 text-white hover:bg-white/10">
              Recusar
            </Button>
            <Button onClick={() => { setLgpdAccepted(true); setShowLgpd(false); }} className="flex-1 h-14 text-lg font-bold" style={btnStyle}>
              Aceitar e Continuar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ Mode selection screen ═══
  if (authMode === "select" && !lookupResult && !lookupError && !lookupLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 select-none" style={bgStyle}>
        <button onClick={() => { setConfigForm(config); setConfigOpen(true); }}
          className="absolute top-4 right-4 p-2 rounded-full transition-all hover:bg-white/10" title="Configurações">
          <Settings className="h-6 w-6 text-white/40 hover:text-white/70" />
        </button>
        <div className="text-center max-w-md w-full space-y-6">
          <div className="space-y-3">
            {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="h-20 mx-auto object-contain drop-shadow-lg" />
              : <ShieldCheck className="h-20 w-20 mx-auto drop-shadow-lg" style={{ color: config.primaryColor }} />}
            <h1 className="text-3xl md:text-4xl font-bold text-white">{config.headerText}</h1>
            <div className="flex items-center justify-center gap-2 text-white/60">
              <Store className="h-5 w-5" /><span className="text-lg">{config.unitName}</span>
              {session.unitCity && <span className="text-sm">• {session.unitCity}/{session.unitState}</span>}
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-white/60">
            <Clock className="h-5 w-5" />
            <span className="text-2xl font-mono">{currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </div>
          <p className="text-white/60 text-lg">Selecione o modo de identificação</p>
          <div className="grid grid-cols-1 gap-4">
            {authConfig.cpf_entry_enabled && (
              <button onClick={() => setAuthMode("cpf")}
                className="p-8 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95 flex flex-col items-center gap-3"
                style={{ backgroundColor: `${config.primaryColor}15`, borderColor: `${config.primaryColor}44` }}>
                <Lock className="h-12 w-12 text-white" />
                <span className="text-2xl font-bold text-white">Digitar CPF</span>
                <span className="text-white/50 text-sm">Use o teclado numérico</span>
              </button>
            )}
            {authConfig.qr_entry_enabled && (
              <button onClick={() => setAuthMode("qr")}
                className="p-8 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95 flex flex-col items-center gap-3"
                style={{ backgroundColor: `${config.primaryColor}15`, borderColor: `${config.primaryColor}44` }}>
                <QrCode className="h-12 w-12 text-white" />
                <span className="text-2xl font-bold text-white">Escanear QR Code</span>
                <span className="text-white/50 text-sm">Apresente seu QR Code à câmera</span>
              </button>
            )}
          </div>
          <Badge className="bg-white/10 text-white/50 border-white/20">
            Segurança: {authConfig.security_level === "basic" ? "Básico" : authConfig.security_level === "intermediate" ? "Intermediário" : authConfig.security_level === "high" ? "Alto" : "Máximo"}
          </Badge>
        </div>
        {renderConfigDialog()}
      </div>
    );
  }

  // ═══ Main CPF Input screen ═══
  function renderConfigDialog() {
    return (
      <>
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Configuração do Totem</DialogTitle>
            </DialogHeader>
            {session && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">PDV:</span><span className="font-medium">{session.unitName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Usuário:</span><span className="font-medium">{session.userName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Nível segurança:</span>
                  <Badge variant="outline">{authConfig.security_level}</Badge></div>
              </div>
            )}
            <div className="space-y-4">
              <div><Label>Texto do Cabeçalho</Label><Input value={configForm.headerText} onChange={e => setConfigForm(f => ({ ...f, headerText: e.target.value }))} /></div>
              <div>
                <Label>URL do Logo (opcional)</Label>
                <Input value={configForm.logoUrl} onChange={e => setConfigForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." />
                {configForm.logoUrl && <div className="mt-2 p-3 bg-muted rounded-lg flex justify-center"><img src={configForm.logoUrl} alt="Preview" className="h-12 object-contain" /></div>}
              </div>
              <div className="border-t pt-4">
                <p className="font-medium text-sm mb-3">Personalização de Cores</p>
                <div className="grid grid-cols-2 gap-3">
                  {([["primaryColor", "Cor Principal"], ["bgColor", "Cor de Fundo"], ["secondaryColor", "Cor Secundária"], ["buttonColor", "Cor do Botão"]] as const).map(([key, label]) => (
                    <div key={key}>
                      <Label className="text-xs">{label}</Label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={configForm[key]} onChange={e => setConfigForm(f => ({ ...f, [key]: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0" />
                        <Input value={configForm[key]} onChange={e => setConfigForm(f => ({ ...f, [key]: e.target.value }))} className="font-mono text-xs" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Separator />
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="destructive" onClick={() => setDisconnectConfirm(true)} className="gap-2"><Unplug className="h-4 w-4" /> Desconectar</Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveConfig}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={disconnectConfirm} onOpenChange={setDisconnectConfirm}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Desconectar Totem?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">O totem será desconectado. Será necessário login novamente.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDisconnectConfirm(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDisconnect}>Desconectar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 select-none" style={bgStyle}>
      <button onClick={() => { setConfigForm(config); setConfigOpen(true); }}
        className="absolute top-4 right-4 p-2 rounded-full transition-all hover:bg-white/10" title="Configurações">
        <Settings className="h-6 w-6 text-white/40 hover:text-white/70" />
      </button>

      {/* Back to mode selection */}
      {authConfig.cpf_entry_enabled && authConfig.qr_entry_enabled && (
        <button onClick={() => { handleReset(); setAuthMode("select"); }}
          className="absolute top-4 left-4 px-3 py-2 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/10 text-sm transition-all">
          ← Voltar
        </button>
      )}

      <div className="text-center max-w-md w-full space-y-6">
        <div className="space-y-3">
          {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="h-20 mx-auto object-contain drop-shadow-lg" />
            : <ShieldCheck className="h-20 w-20 mx-auto drop-shadow-lg" style={{ color: config.primaryColor }} />}
          <h1 className="text-3xl md:text-4xl font-bold text-white">{config.headerText}</h1>
          <div className="flex items-center justify-center gap-2 text-white/60">
            <Store className="h-5 w-5" /><span className="text-lg">{config.unitName}</span>
            {session.unitCity && <span className="text-sm">• {session.unitCity}/{session.unitState}</span>}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-white/60">
          <Clock className="h-5 w-5" />
          <span className="text-2xl font-mono">{currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        </div>

        {/* Active method indicators */}
        <div className="flex justify-center gap-2">
          {authMode === "cpf" && <Badge className="bg-white/10 text-white/70 border-white/20 gap-1"><Lock className="h-3 w-3" /> CPF</Badge>}
          {authMode === "qr" && <Badge className="bg-white/10 text-white/70 border-white/20 gap-1"><QrCode className="h-3 w-3" /> QR Code</Badge>}
          {authConfig.selfie_entry_required && <Badge className="bg-white/10 text-white/70 border-white/20 gap-1"><Camera className="h-3 w-3" /> Selfie</Badge>}
          {authConfig.facial_recognition_enabled && <Badge className="bg-white/10 text-white/70 border-white/20 gap-1"><ScanFace className="h-3 w-3" /> Facial</Badge>}
        </div>

        {/* QR Mode placeholder */}
        {authMode === "qr" && !lookupResult && !lookupError && !lookupLoading && (
          <div className="space-y-4">
            <div className="rounded-2xl p-8 backdrop-blur text-center" style={{ backgroundColor: `${config.primaryColor}15`, border: `2px solid ${config.primaryColor}33` }}>
              <QrCode className="h-20 w-20 mx-auto text-white/60 mb-4" />
              <p className="text-white text-xl mb-2">Apresente o QR Code</p>
              <p className="text-white/50 text-sm">Posicione o QR Code em frente à câmera do totem</p>
              <p className="text-white/30 text-xs mt-4">Ou use o CPF para identificação</p>
              <Button onClick={() => setAuthMode("cpf")} variant="outline" className="mt-3 border-white/30 text-white hover:bg-white/10" size="sm">
                Usar CPF
              </Button>
            </div>
          </div>
        )}

        {/* CPF Mode */}
        {authMode === "cpf" && !lookupResult && !lookupError && !lookupLoading && (
          <>
            <div className="rounded-2xl p-6 backdrop-blur" style={{ backgroundColor: `${config.primaryColor}15`, border: `2px solid ${config.primaryColor}33` }}>
              <p className="text-white/80 text-lg mb-3">Digite seu CPF</p>
              <div className="text-4xl md:text-5xl font-mono tracking-[0.2em] h-16 flex items-center justify-center text-white" style={{ minHeight: 64 }}>
                {cpfDigits.length > 0 ? formatCpf(cpfDigits) : <span className="text-white/30">000.000.000-00</span>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {NUMPAD_KEYS.map((key, i) => {
                if (key === "") return <div key={i} />;
                if (key === "⌫") {
                  return (
                    <button key={i} onClick={() => handleNumpadPress(key)}
                      className="h-16 md:h-20 rounded-xl text-2xl font-bold flex items-center justify-center transition-all active:scale-95 border"
                      style={{ ...numpadBtnStyle, backgroundColor: `${config.primaryColor}33` }}>
                      <Delete className="h-7 w-7" />
                    </button>
                  );
                }
                return (
                  <button key={i} onClick={() => handleNumpadPress(key)}
                    className="h-16 md:h-20 rounded-xl text-3xl font-bold transition-all active:scale-95 border" style={numpadBtnStyle}>
                    {key}
                  </button>
                );
              })}
            </div>
            <Button onClick={() => { if (cpfDigits.length === 11) handleLookup(cpfDigits); }}
              disabled={cpfDigits.length !== 11 || lookupLoading}
              className="w-full h-16 text-xl font-bold rounded-xl transition-all"
              style={cpfDigits.length === 11 && !lookupLoading ? btnStyle : undefined} size="lg">
              {lookupLoading ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : <ShieldCheck className="h-6 w-6 mr-2" />}
              {lookupLoading ? "Buscando..." : "Confirmar"}
            </Button>
          </>
        )}

        {/* Lookup loading */}
        {lookupLoading && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-12 w-12 animate-spin text-white/70" />
            <p className="text-white/70 text-lg">Buscando cadastro...</p>
          </div>
        )}

        {/* Lookup error */}
        {lookupError && (
          <div className="rounded-2xl p-6 backdrop-blur text-center" style={{ backgroundColor: "#dc262644", border: "2px solid #dc262666" }}>
            <XCircle className="h-16 w-16 mx-auto mb-3 text-red-300" />
            <p className="text-white text-xl font-semibold mb-1">Não encontrado</p>
            <p className="text-white/80">{lookupError}</p>
            <Button onClick={handleReset} variant="outline" className="mt-4 border-white/40 text-white hover:bg-white/10">Tentar novamente</Button>
          </div>
        )}

        {/* Confirmation step */}
        {lookupResult && (
          <div className="rounded-2xl p-6 backdrop-blur animate-in fade-in zoom-in-95 duration-300"
            style={{ backgroundColor: lookupResult.has_open_entry ? "#f59e0b22" : `${config.primaryColor}22`, border: `2px solid ${lookupResult.has_open_entry ? "#f59e0b55" : `${config.primaryColor}55`}` }}>
            {lookupResult.has_open_entry ? (
              <p className="text-amber-300 text-sm mb-4 uppercase tracking-wider font-semibold">⏱ Você já está no PDV — Registrar saída?</p>
            ) : (
              <p className="text-white/70 text-sm mb-4 uppercase tracking-wider">Confirme sua identidade</p>
            )}
            {lookupResult.photo_url ? (
              <img src={lookupResult.photo_url} alt="Foto" className="w-32 h-32 rounded-full mx-auto mb-4 border-4 object-cover shadow-xl"
                style={{ borderColor: lookupResult.has_open_entry ? "#f59e0b" : config.primaryColor }} />
            ) : (
              <div className="w-32 h-32 rounded-full mx-auto mb-4 border-4 flex items-center justify-center"
                style={{ borderColor: lookupResult.has_open_entry ? "#f59e0b" : config.primaryColor, backgroundColor: `${config.primaryColor}33` }}>
                <UserCheck className="h-16 w-16 text-white/60" />
              </div>
            )}
            <p className="text-white text-2xl font-bold mb-1">{lookupResult.name}</p>
            {lookupResult.agency_name && <p className="text-white/70 text-lg mb-2">Agência: {lookupResult.agency_name}</p>}
            {lookupResult.brands.length > 0 && (
              <div className="mt-2 mb-2">
                <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Marcas de hoje</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {lookupResult.brands.map((brand) => (
                    <Badge key={brand} className="text-white text-sm px-3 py-1" style={{ backgroundColor: `${config.primaryColor}55` }}>{brand}</Badge>
                  ))}
                </div>
              </div>
            )}
            {lookupResult.has_open_entry && lookupResult.entry_at && (
              <p className="text-amber-300/80 text-sm mt-2">
                Entrada: {new Date(lookupResult.entry_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}

            {/* Selfie step indicator */}
            {selfieRequired && (
              <div className="mt-3 flex items-center justify-center gap-2 text-white/60 text-sm">
                <Camera className="h-4 w-4" />
                <span>Selfie será solicitada na próxima etapa</span>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button onClick={handleReset} variant="outline" className="flex-1 h-14 text-lg border-white/30 text-white hover:bg-white/10">Não sou eu</Button>
              {lookupResult.has_open_entry ? (
                <Button onClick={handleConfirmCheckout} disabled={loading}
                  className="flex-1 h-14 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <LogOut className="h-5 w-5 mr-2" />}
                  {loading ? "Saindo..." : selfieRequired ? "Selfie + Check-out" : "Check-out"}
                </Button>
              ) : (
                <Button onClick={handleConfirmCheckin} disabled={loading} className="flex-1 h-14 text-lg font-bold" style={btnStyle}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <LogIn className="h-5 w-5 mr-2" />}
                  {loading ? "Validando..." : selfieRequired ? "Selfie + Check-in" : "Check-in"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {renderConfigDialog()}
    </div>
  );
};

export default TotemAccess;
