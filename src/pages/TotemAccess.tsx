import { useState, useRef, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Clock, Store, Delete, Settings, UserCheck, LogOut, LogIn, Lock, Unplug, QrCode, Camera, ScanFace, AlertTriangle, KeyRound, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FaceVerifyDialog } from "@/components/facial-recognition/FaceVerifyDialog";

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
  face_descriptor?: number[];
  face_photo_url?: string;
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
  slogan: string;
  pdvName: string;
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
  facial_min_confidence: number;
  allow_low_confidence_entry: boolean;
}

const DEFAULT_CONFIG: TotemConfig = {
  token: "", unitName: "PDV", logoUrl: "", primaryColor: "#3b82f6",
  secondaryColor: "#1e293b", bgColor: "#0f172a", buttonColor: "#3b82f6",
  buttonTextColor: "#ffffff", headerText: "Controle de Acesso", slogan: "", pdvName: "PDV",
};

const DEFAULT_AUTH: AuthConfig = {
  cpf_entry_enabled: true, qr_entry_enabled: false, selfie_entry_required: false,
  selfie_exit_required: false, facial_recognition_enabled: false,
  combined_validation: "cpf_only", security_level: "basic",
  require_lgpd_consent: false, consent_text: null,
  facial_min_confidence: 70, allow_low_confidence_entry: false,
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
  const [showNumpad, setShowNumpad] = useState(false);
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

  // Freelance registration
  const [showFreelanceRegister, setShowFreelanceRegister] = useState(false);
  const [regKeyInput, setRegKeyInput] = useState('');
  const [regKeyValid, setRegKeyValid] = useState<any>(null);
  const [regForm, setRegForm] = useState({ name: '', cpf: '', phone: '' });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // Facial verification
  const [showFacialVerify, setShowFacialVerify] = useState(false);
  const [facialVerified, setFacialVerified] = useState(false);
  const [facialPendingAction, setFacialPendingAction] = useState<"checkin" | "checkout" | null>(null);

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
      const syncedConfig = {
        ...config,
        token: session.token,
        unitName: data.unit_name || session.unitName || config.unitName,
        logoUrl: data.logo_url || session.unitLogo || config.logoUrl,
        primaryColor: data.totem_primary_color || config.primaryColor,
        secondaryColor: data.totem_secondary_color || config.secondaryColor,
        bgColor: data.totem_bg_color || config.bgColor,
        buttonColor: data.totem_button_color || config.buttonColor,
        buttonTextColor: data.totem_button_text_color || config.buttonTextColor,
        headerText: data.totem_header_text || config.headerText,
        slogan: data.totem_slogan || config.slogan,
        pdvName: data.totem_pdv_name || data.unit_name || session.unitName || config.pdvName,
      };
      setConfig(syncedConfig);
      setConfigForm(syncedConfig);
      saveConfig(syncedConfig);
      setShowNumpad(false);
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

  const combinedValidation = authConfig.combined_validation || "cpf_only";
  const displayUnitName = config.pdvName || config.unitName;
  const entryRequiresSelfie = authMode === "cpf"
    ? authConfig.selfie_entry_required || combinedValidation === "cpf_selfie" || combinedValidation === "cpf_selfie_facial"
    : authMode === "qr"
      ? authConfig.selfie_entry_required || combinedValidation === "qr_selfie"
      : authConfig.selfie_entry_required;
  const entryRequiresFacial = authMode === "cpf"
    ? authConfig.facial_recognition_enabled || combinedValidation === "cpf_selfie_facial"
    : authMode === "qr"
      ? authConfig.facial_recognition_enabled || combinedValidation === "qr_facial"
      : authConfig.facial_recognition_enabled;

  const getSelfieRequirement = (hasOpenEntry: boolean) => hasOpenEntry ? authConfig.selfie_exit_required : entryRequiresSelfie;
  const getFacialRequirement = (hasOpenEntry: boolean, lookup?: LookupResult | null) => {
    if (!lookup?.face_descriptor?.length) return false;
    return hasOpenEntry ? authConfig.facial_recognition_enabled : entryRequiresFacial;
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
      const newConfig = {
        ...config,
        token: newSession.token,
        unitName: newSession.unitName,
        logoUrl: data.unit?.logo_url || newSession.unitLogo || config.logoUrl,
        primaryColor: data.unit?.totem_primary_color || config.primaryColor,
        secondaryColor: data.unit?.totem_secondary_color || config.secondaryColor,
        bgColor: data.unit?.totem_bg_color || config.bgColor,
        buttonColor: data.unit?.totem_button_color || config.buttonColor,
        buttonTextColor: data.unit?.totem_button_text_color || config.buttonTextColor,
        headerText: data.unit?.totem_header_text || config.headerText,
        slogan: data.unit?.totem_slogan || config.slogan,
        pdvName: data.unit?.totem_pdv_name || data.unit?.name || config.pdvName,
      };
      setConfig(newConfig); setConfigForm(newConfig); saveConfig(newConfig); setShowNumpad(false);
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
          agency_promoter_id: data.promoter.agency_promoter_id,
          employee_id: data.promoter.employee_id,
          face_descriptor: data.promoter.face_descriptor || undefined,
          face_photo_url: data.promoter.face_photo_url || undefined,
        };
        setLookupResult(lr);
        const requiresSelfie = getSelfieRequirement(lr.has_open_entry);
        const requiresFacial = getFacialRequirement(lr.has_open_entry, lr);
        setSelfieRequired(requiresSelfie);
        if (authConfig.require_lgpd_consent && (requiresSelfie || requiresFacial)) {
          setShowLgpd(true);
        }
      } else {
        setLookupError(data.reason || "Cadastro não encontrado");
      }
    } catch { setLookupError("Erro de conexão com o servidor"); }
    finally { setLookupLoading(false); }
  };

  const handleConfirmCheckin = async () => {
    const requiresFacialCheckin = getFacialRequirement(false, lookupResult);
    const requiresSelfieCheckin = getSelfieRequirement(false);
    if (requiresFacialCheckin && !facialVerified) {
      setFacialPendingAction("checkin");
      setShowFacialVerify(true);
      return;
    }
    if (requiresSelfieCheckin && !selfieCapture) { setSelfieRequired(true); startCamera(); return; }
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

          // If facial recognition is enabled, run comparison
          if (authConfig.facial_recognition_enabled) {
            try {
              const facialRes = await fetch(`${API_URL}/api/access-control/totem/facial-compare`, {
                method: "POST", headers: { "Content-Type": "application/json", "x-totem-token": config.token },
                body: JSON.stringify({
                  agency_promoter_id: lookupResult?.agency_promoter_id,
                  employee_id: lookupResult?.employee_id,
                  entry_log_id: data.entry_id,
                  captured_image_url: selfieCapture,
                  comparison_type: "entry_vs_base",
                }),
              });
              const facialData = await facialRes.json();
              if (facialData.result === "divergent") {
                // Block if divergent
                setResult({ status: "blocked", block_reason: `Identidade não confirmada (confiança: ${facialData.confidence}%)` });
                setLoading(false); setLookupResult(null); setSelfieRequired(false); setSelfieCapture(null);
                return;
              }
              // If suspect but allowed, continue with warning
              if (facialData.result === "suspect" && !authConfig.allow_low_confidence_entry) {
                setResult({ status: "blocked", block_reason: `Confiança facial abaixo do mínimo (${facialData.confidence}% < ${facialData.threshold}%)` });
                setLoading(false); setLookupResult(null); setSelfieRequired(false); setSelfieCapture(null);
                return;
              }
            } catch { /* facial comparison failed, continue */ }
          }
        }
        // Log auth attempt
        fetch(`${API_URL}/api/access-control/totem/auth-attempt`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-totem-token": config.token },
          body: JSON.stringify({
            cpf: cpfDigits, method: authMode === "qr" ? "qr" : selfieCapture ? "combined" : "cpf",
            auth_steps: [
              { step: authMode, result: "ok" },
              ...(selfieCapture ? [{ step: "selfie", result: "ok" }] : []),
              ...(selfieCapture && authConfig.facial_recognition_enabled ? [{ step: "facial", result: "ok" }] : []),
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
    const requiresFacialCheckout = getFacialRequirement(true, lookupResult);
    const requiresSelfieCheckout = getSelfieRequirement(true);
    if (requiresFacialCheckout && !facialVerified) {
      setFacialPendingAction("checkout");
      setShowFacialVerify(true);
      return;
    }
    if (requiresSelfieCheckout && !selfieCapture) { setSelfieRequired(true); startCamera(); return; }
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

  const handleFacialResult = useCallback((result: { match: boolean; score: number; imageDataUrl: string }) => {
    setShowFacialVerify(false);
    if (result.match) {
      setFacialVerified(true);
      // Continue the pending action
      if (facialPendingAction === "checkin") {
        setTimeout(() => handleConfirmCheckin(), 100);
      } else if (facialPendingAction === "checkout") {
        setTimeout(() => handleConfirmCheckout(), 100);
      }
    } else {
      setResult({ status: "blocked", block_reason: `Identidade facial não confirmada (${result.score.toFixed(1)}%)` });
      setLookupResult(null);
    }
    setFacialPendingAction(null);
  }, [facialPendingAction]);

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
    setFacialVerified(false); setFacialPendingAction(null); setShowFacialVerify(false);
    setShowNumpad(false);
    setShowFreelanceRegister(false); setRegKeyInput(''); setRegKeyValid(null); setRegForm({ name: '', cpf: '', phone: '' }); setRegError('');
    stopCamera();
    if (authConfig.cpf_entry_enabled && authConfig.qr_entry_enabled) setAuthMode("select");
  };

  // ═══ Freelance registration ═══
  const handleValidateRegKey = async () => {
    if (regKeyInput.length !== 6) return;
    setRegLoading(true); setRegError('');
    try {
      const res = await fetch(`${API_URL}/api/access-control/totem/validate-registration-key`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-totem-token": config.token },
        body: JSON.stringify({ key_code: regKeyInput }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setRegKeyValid(data.key);
        setRegForm(f => ({ ...f, name: data.key.promoter_name || '' }));
      } else {
        setRegError(data.error || 'Chave inválida ou expirada');
      }
    } catch { setRegError('Erro de conexão'); }
    finally { setRegLoading(false); }
  };

  const handleRegisterFreelance = async () => {
    if (!regForm.name || !regForm.cpf || regForm.cpf.length < 11) {
      setRegError('Nome e CPF são obrigatórios'); return;
    }
    setRegLoading(true); setRegError('');
    try {
      const res = await fetch(`${API_URL}/api/access-control/totem/register-freelance`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-totem-token": config.token },
        body: JSON.stringify({ key_code: regKeyInput, name: regForm.name, cpf: regForm.cpf, phone: regForm.phone || null }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({ status: "authorized", promoter_name: data.promoter.name, block_reason: "CADASTRO REALIZADO" });
        setShowFreelanceRegister(false); setRegKeyInput(''); setRegKeyValid(null); setRegForm({ name: '', cpf: '', phone: '' });
      } else {
        setRegError(data.error || 'Erro ao cadastrar');
      }
    } catch { setRegError('Erro de conexão'); }
    finally { setRegLoading(false); }
  };

  const resetFreelanceRegister = () => {
    setShowFreelanceRegister(false); setRegKeyInput(''); setRegKeyValid(null);
    setRegForm({ name: '', cpf: '', phone: '' }); setRegError('');
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
    const isRegistration = result.block_reason === "CADASTRO REALIZADO";
    const bgColor = isRegistration ? "#7c3aed" : isCheckout ? "#2563eb" : isAuthorized ? "#16a34a" : "#dc2626";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 transition-colors duration-500" style={{ background: bgColor }}>
        <div className="text-center text-white max-w-lg w-full">
          {config.logoUrl && <img src={config.logoUrl} alt="Logo" className="h-16 mx-auto mb-6 object-contain" />}
          {isRegistration ? <UserPlus className="h-32 w-32 mx-auto mb-6 animate-in zoom-in duration-500" /> :
           isCheckout ? <LogOut className="h-32 w-32 mx-auto mb-6 animate-in zoom-in duration-500" /> :
           isAuthorized ? <CheckCircle2 className="h-32 w-32 mx-auto mb-6 animate-in zoom-in duration-500" /> :
           <XCircle className="h-32 w-32 mx-auto mb-6 animate-in zoom-in duration-500" />}
          <h1 className="text-5xl font-bold mb-4">
            {isRegistration ? "CADASTRO REALIZADO" : isCheckout ? "SAÍDA REGISTRADA" : isAuthorized ? "ACESSO LIBERADO" : "ACESSO BLOQUEADO"}
          </h1>
          {isRegistration && (
            <Card className="bg-white/20 backdrop-blur border-white/30 p-6 mt-6 text-white">
              <p className="text-2xl font-semibold mb-2">{result.promoter_name}</p>
              <p className="text-lg opacity-80">Cadastro efetuado com sucesso!</p>
              <p className="text-sm opacity-60 mt-2">Sua agência foi notificada. Agora você pode fazer o check-in normalmente.</p>
            </Card>
          )}
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
              <Store className="h-5 w-5" /><span className="text-lg">{displayUnitName}</span>
              {session.unitCity && <span className="text-sm">• {session.unitCity}/{session.unitState}</span>}
            </div>
            {config.slogan && <p className="text-white/70 text-base">{config.slogan}</p>}
          </div>
          <div className="flex items-center justify-center gap-2 text-white/60">
            <Clock className="h-5 w-5" />
            <span className="text-2xl font-mono">{currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </div>
          <p className="text-white/60 text-lg">Selecione o modo de identificação</p>
          <div className="grid grid-cols-1 gap-4">
            {authConfig.cpf_entry_enabled && (
              <button onClick={() => { setAuthMode("cpf"); setShowNumpad(false); }}
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
          {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="max-h-28 w-auto mx-auto object-contain drop-shadow-lg" />
            : <ShieldCheck className="h-24 w-24 mx-auto drop-shadow-lg" style={{ color: config.primaryColor }} />}
          <h1 className="text-3xl md:text-4xl font-bold text-white">{config.headerText}</h1>
          <div className="flex items-center justify-center gap-2 text-white/60">
            <Store className="h-5 w-5" /><span className="text-lg">{displayUnitName}</span>
            {session.unitCity && <span className="text-sm">• {session.unitCity}/{session.unitState}</span>}
          </div>
          {config.slogan && <p className="text-white/70 text-base">{config.slogan}</p>}
        </div>

        <div className="flex items-center justify-center gap-2 text-white/60">
          <Clock className="h-5 w-5" />
          <span className="text-2xl font-mono">{currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        </div>

        {/* Active method indicators */}
        <div className="flex justify-center gap-2">
          {authMode === "cpf" && <Badge className="bg-white/10 text-white/70 border-white/20 gap-1"><Lock className="h-3 w-3" /> CPF</Badge>}
          {authMode === "qr" && <Badge className="bg-white/10 text-white/70 border-white/20 gap-1"><QrCode className="h-3 w-3" /> QR Code</Badge>}
          {entryRequiresSelfie && authMode !== "select" && <Badge className="bg-white/10 text-white/70 border-white/20 gap-1"><Camera className="h-3 w-3" /> Selfie na próxima etapa</Badge>}
        </div>

        {/* QR Mode placeholder */}
        {authMode === "qr" && !lookupResult && !lookupError && !lookupLoading && (
          <div className="space-y-4">
            <div className="rounded-2xl p-8 backdrop-blur text-center" style={{ backgroundColor: `${config.primaryColor}15`, border: `2px solid ${config.primaryColor}33` }}>
              <QrCode className="h-20 w-20 mx-auto text-white/60 mb-4" />
              <p className="text-white text-xl mb-2">Apresente o QR Code</p>
              <p className="text-white/50 text-sm">Posicione o QR Code em frente à câmera do totem</p>
              <p className="text-white/30 text-xs mt-4">Ou use o CPF para identificação</p>
              <Button onClick={() => { setAuthMode("cpf"); setShowNumpad(false); }} variant="outline" className="mt-3 border-white/30 text-white hover:bg-white/10" size="sm">
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
              <button
                type="button"
                onClick={() => setShowNumpad(true)}
                className="w-full rounded-xl border px-3 py-4 transition-all"
                style={{ backgroundColor: `${config.bgColor}66`, borderColor: `${config.primaryColor}55` }}
              >
                <div className="text-[clamp(1.9rem,7vw,3.3rem)] font-mono tracking-[0.08em] md:tracking-[0.16em] min-h-16 flex items-center justify-center text-white leading-none">
                  {cpfDigits.length > 0 ? formatCpf(cpfDigits) : <span className="text-white/30">000.000.000-00</span>}
                </div>
              </button>
              <p className="mt-3 text-sm text-white/60">
                {showNumpad ? "Use o teclado abaixo para completar o CPF" : "Toque no campo para abrir o teclado numérico"}
              </p>
            </div>
            {showNumpad && (
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
            )}
            <Button onClick={() => { if (cpfDigits.length === 11) handleLookup(cpfDigits); }}
              disabled={cpfDigits.length !== 11 || lookupLoading}
              className="w-full h-16 text-xl font-bold rounded-xl transition-all"
              style={{ ...btnStyle, opacity: cpfDigits.length === 11 && !lookupLoading ? 1 : 0.65 }} size="lg">
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
        {lookupError && !showFreelanceRegister && (
          <div className="rounded-2xl p-6 backdrop-blur text-center" style={{ backgroundColor: "#dc262644", border: "2px solid #dc262666" }}>
            <XCircle className="h-16 w-16 mx-auto mb-3 text-red-300" />
            <p className="text-white text-xl font-semibold mb-1">Não encontrado</p>
            <p className="text-white/80">{lookupError}</p>
            <div className="flex gap-3 mt-4 justify-center">
              <Button onClick={handleReset} variant="outline" className="border-white/40 text-white hover:bg-white/10">Tentar novamente</Button>
              <Button onClick={() => { setShowFreelanceRegister(true); setRegForm(f => ({ ...f, cpf: cpfDigits })); }} className="gap-2" style={btnStyle}>
                <UserPlus className="h-4 w-4" /> Cadastrar com Chave
              </Button>
            </div>
          </div>
        )}

        {/* Freelance registration */}
        {showFreelanceRegister && (
          <div className="rounded-2xl p-6 backdrop-blur animate-in fade-in zoom-in-95 duration-300 text-left"
            style={{ backgroundColor: `${config.primaryColor}15`, border: `2px solid ${config.primaryColor}33` }}>
            <div className="text-center mb-4">
              <KeyRound className="h-10 w-10 mx-auto text-white/70 mb-2" />
              <p className="text-white text-xl font-bold">Cadastro com Chave de Acesso</p>
              <p className="text-white/60 text-sm">Solicite a chave à sua agência</p>
            </div>

            {!regKeyValid ? (
              <div className="space-y-3">
                <div>
                  <label className="text-white/70 text-sm">Chave de Acesso (6 dígitos)</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={regKeyInput}
                    onChange={e => setRegKeyInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full h-16 text-center text-3xl font-mono tracking-[0.3em] rounded-xl border-2 bg-transparent text-white"
                    style={{ borderColor: `${config.primaryColor}55` }}
                    placeholder="000000"
                    inputMode="numeric"
                  />
                </div>
                {regError && <p className="text-red-400 text-sm text-center">{regError}</p>}
                <div className="flex gap-3">
                  <Button onClick={resetFreelanceRegister} variant="outline" className="flex-1 h-12 border-white/30 text-white hover:bg-white/10">Voltar</Button>
                  <Button onClick={handleValidateRegKey} disabled={regKeyInput.length !== 6 || regLoading} className="flex-1 h-12 font-bold" style={btnStyle}>
                    {regLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Validar'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-2 rounded-lg text-center" style={{ backgroundColor: `${config.primaryColor}33` }}>
                  <p className="text-white/60 text-xs">Agência</p>
                  <p className="text-white font-semibold">{regKeyValid.agency_name}</p>
                </div>
                <div>
                  <label className="text-white/70 text-sm">Nome Completo *</label>
                  <input
                    value={regForm.name}
                    onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full h-12 rounded-xl border-2 bg-transparent text-white px-4"
                    style={{ borderColor: `${config.primaryColor}55` }}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm">CPF *</label>
                  <input
                    value={formatCpf(regForm.cpf)}
                    onChange={e => setRegForm(f => ({ ...f, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                    className="w-full h-12 rounded-xl border-2 bg-transparent text-white px-4"
                    style={{ borderColor: `${config.primaryColor}55` }}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm">Telefone (opcional)</label>
                  <input
                    value={regForm.phone}
                    onChange={e => setRegForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                    className="w-full h-12 rounded-xl border-2 bg-transparent text-white px-4"
                    style={{ borderColor: `${config.primaryColor}55` }}
                    placeholder="00 00000-0000"
                    inputMode="numeric"
                  />
                </div>
                {regError && <p className="text-red-400 text-sm text-center">{regError}</p>}
                <div className="flex gap-3">
                  <Button onClick={resetFreelanceRegister} variant="outline" className="flex-1 h-12 border-white/30 text-white hover:bg-white/10">Cancelar</Button>
                  <Button onClick={handleRegisterFreelance} disabled={!regForm.name || regForm.cpf.length < 11 || regLoading} className="flex-1 h-12 font-bold gap-2" style={btnStyle}>
                    {regLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                    Cadastrar
                  </Button>
                </div>
              </div>
            )}
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

            {getFacialRequirement(lookupResult.has_open_entry, lookupResult) && (
              <div className="mt-3 flex items-center justify-center gap-2 text-white/60 text-sm">
                <ScanFace className="h-4 w-4" />
                <span>{facialVerified ? "✓ Identidade facial confirmada" : "Verificação facial obrigatória"}</span>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button onClick={handleReset} variant="outline" className="flex-1 h-14 text-lg border-white/30 text-white hover:bg-white/10">Não sou eu</Button>
              {lookupResult.has_open_entry ? (
                <Button onClick={handleConfirmCheckout} disabled={loading}
                  className="flex-1 h-14 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : (getFacialRequirement(true, lookupResult) && !facialVerified) ? <ScanFace className="h-5 w-5 mr-2" /> : selfieRequired ? <Camera className="h-5 w-5 mr-2" /> : <LogOut className="h-5 w-5 mr-2" />}
                  {loading ? "Saindo..." : (getFacialRequirement(true, lookupResult) && !facialVerified) ? "Verificar facial" : selfieRequired ? "Tirar selfie" : "Check-out"}
                </Button>
              ) : (
                <Button onClick={handleConfirmCheckin} disabled={loading} className="flex-1 h-14 text-lg font-bold" style={btnStyle}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : (getFacialRequirement(false, lookupResult) && !facialVerified) ? <ScanFace className="h-5 w-5 mr-2" /> : selfieRequired ? <Camera className="h-5 w-5 mr-2" /> : <LogIn className="h-5 w-5 mr-2" />}
                  {loading ? "Validando..." : (getFacialRequirement(false, lookupResult) && !facialVerified) ? "Verificar facial" : selfieRequired ? "Tirar selfie" : "Check-in"}
                </Button>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-white/35">Powered by Ayratech</p>
      </div>

      {/* Facial Verification Dialog */}
      {lookupResult?.face_descriptor?.length && (
        <FaceVerifyDialog
          open={showFacialVerify}
          onOpenChange={(open) => { if (!open) { setShowFacialVerify(false); setFacialPendingAction(null); } }}
          storedDescriptor={lookupResult.face_descriptor}
          storedPhotoUrl={lookupResult.face_photo_url || lookupResult.photo_url}
          personName={lookupResult.name}
          threshold={authConfig.facial_min_confidence || 70}
          onResult={handleFacialResult}
        />
      )}

      {renderConfigDialog()}
    </div>
  );
};

export default TotemAccess;
