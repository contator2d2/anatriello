import { useState, useRef, useEffect } from "react";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Clock, Store, Delete, Settings, UserCheck, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  has_open_entry: boolean;
  open_entry_id?: string;
  entry_at?: string;
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

const DEFAULT_CONFIG: TotemConfig = {
  token: "",
  unitName: "PDV",
  logoUrl: "",
  primaryColor: "#3b82f6",
  secondaryColor: "#1e293b",
  bgColor: "#0f172a",
  buttonColor: "#3b82f6",
  buttonTextColor: "#ffffff",
  headerText: "Controle de Acesso",
};

function loadConfig(): TotemConfig {
  try {
    const saved = localStorage.getItem("totem_config");
    if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch {}
  const token = localStorage.getItem("totem_token") || "";
  const unitName = localStorage.getItem("totem_unit_name") || "PDV";
  return { ...DEFAULT_CONFIG, token, unitName };
}

function saveConfig(config: TotemConfig) {
  localStorage.setItem("totem_config", JSON.stringify(config));
  localStorage.setItem("totem_token", config.token);
  localStorage.setItem("totem_unit_name", config.unitName);
}

const NUMPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

const TotemAccess = () => {
  const [cpfDigits, setCpfDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [config, setConfig] = useState<TotemConfig>(loadConfig);
  const [configOpen, setConfigOpen] = useState(false);
  const [configForm, setConfigForm] = useState<TotemConfig>(config);
  const [settingsTaps, setSettingsTaps] = useState(0);
  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (result) {
      const timer = setTimeout(handleReset, 8000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  useEffect(() => {
    if (!config.token) setConfigOpen(true);
  }, []);

  const formatCpf = (digits: string) => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleNumpadPress = (key: string) => {
    if (lookupResult || lookupError) return; // block input during confirmation
    if (key === "⌫") {
      setCpfDigits(prev => prev.slice(0, -1));
    } else if (key && cpfDigits.length < 11) {
      const newDigits = cpfDigits + key;
      setCpfDigits(newDigits);
      if (newDigits.length === 11) {
        setTimeout(() => handleLookup(newDigits), 300);
      }
    }
  };

  const handleLookup = async (digits: string) => {
    setLookupLoading(true);
    setLookupError(null);
    try {
      const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const res = await fetch(`${API_URL}/api/access-control/totem/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-totem-token": config.token },
        body: JSON.stringify({ cpf: digits }),
      });
      const data = await res.json();
      if (res.ok && data.found) {
        setLookupResult({
          name: data.promoter.name,
          photo_url: data.promoter.photo_url,
          agency_name: data.promoter.agency_name,
          has_open_entry: !!data.has_open_entry,
          open_entry_id: data.open_entry_id,
          entry_at: data.entry_at,
        });
      } else {
        setLookupError(data.reason || "Cadastro não encontrado");
      }
    } catch {
      setLookupError("Erro de conexão com o servidor");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleConfirmCheckin = async () => {
    setLoading(true);
    try {
      const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const res = await fetch(`${API_URL}/api/access-control/totem/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-totem-token": config.token },
        body: JSON.stringify({ cpf: cpfDigits }),
      });
      const data = await res.json();
      if (res.ok && data.authorized) {
        setResult({
          status: "authorized",
          promoter_name: data.promoter?.name,
          promoter_photo: data.promoter?.photo_url,
          agency_name: data.promoter?.agency,
          brands: data.brands?.map((b: any) => b.name || b) || [],
          entry_id: data.entry_id,
        });
      } else {
        setResult({
          status: "blocked",
          block_reason: data.reason || data.error || "Acesso não autorizado",
        });
      }
    } catch {
      setResult({ status: "blocked", block_reason: "Erro de conexão com o servidor" });
    } finally {
      setLoading(false);
      setLookupResult(null);
      setLookupError(null);
    }
  };

  const handleConfirmCheckout = async () => {
    if (!lookupResult?.open_entry_id) return;
    setLoading(true);
    try {
      const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      await fetch(`${API_URL}/api/access-control/totem/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-totem-token": config.token },
        body: JSON.stringify({ entry_id: lookupResult.open_entry_id }),
      });
      setResult({
        status: "authorized",
        promoter_name: lookupResult.name,
        promoter_photo: lookupResult.photo_url,
        agency_name: lookupResult.agency_name,
        block_reason: "SAÍDA REGISTRADA",
      });
    } catch {
      setResult({ status: "blocked", block_reason: "Erro ao registrar saída" });
    } finally {
      setLoading(false);
      setLookupResult(null);
    }
  };

  const handleCheckout = async () => {
    if (!result?.entry_id) return;
    try {
      const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      await fetch(`${API_URL}/api/access-control/totem/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-totem-token": config.token },
        body: JSON.stringify({ entry_id: result.entry_id }),
      });
    } catch {}
    handleReset();
  };

  const handleReset = () => {
    setResult(null);
    setLookupResult(null);
    setLookupError(null);
    setCpfDigits("");
  };

  const handleSettingsTap = () => {
    setSettingsTaps(prev => prev + 1);
    if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
    settingsTimerRef.current = setTimeout(() => setSettingsTaps(0), 2000);
    if (settingsTaps >= 4) {
      setConfigForm(config);
      setConfigOpen(true);
      setSettingsTaps(0);
    }
  };

  const handleSaveConfig = () => {
    saveConfig(configForm);
    setConfig(configForm);
    setConfigOpen(false);
  };

  const bgStyle = { background: `linear-gradient(135deg, ${config.bgColor} 0%, ${config.secondaryColor} 50%, ${config.bgColor} 100%)` };
  const btnStyle = { backgroundColor: config.buttonColor, color: config.buttonTextColor };
  const numpadBtnStyle = { backgroundColor: `${config.primaryColor}22`, borderColor: `${config.primaryColor}44`, color: "#fff" };

  // ═══ Result screen ═══
  if (result) {
    const isAuthorized = result.status === "authorized";
    const isCheckout = result.block_reason === "SAÍDA REGISTRADA";
    const bgColor = isCheckout ? "#2563eb" : isAuthorized ? "#16a34a" : "#dc2626";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 transition-colors duration-500"
        style={{ background: bgColor }}>
        <div className="text-center text-white max-w-lg w-full">
          {config.logoUrl && <img src={config.logoUrl} alt="Logo" className="h-16 mx-auto mb-6 object-contain" />}
          {isCheckout ? (
            <LogOut className="h-32 w-32 mx-auto mb-6 animate-in zoom-in duration-500" />
          ) : isAuthorized ? (
            <CheckCircle2 className="h-32 w-32 mx-auto mb-6 animate-in zoom-in duration-500" />
          ) : (
            <XCircle className="h-32 w-32 mx-auto mb-6 animate-in zoom-in duration-500" />
          )}
          <h1 className="text-5xl font-bold mb-4">
            {isCheckout ? "SAÍDA REGISTRADA" : isAuthorized ? "ACESSO LIBERADO" : "ACESSO BLOQUEADO"}
          </h1>
          {isAuthorized && (
            <Card className="bg-white/20 backdrop-blur border-white/30 p-6 mt-6 text-white">
              {result.promoter_photo && (
                <img src={result.promoter_photo} alt="Foto" className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white object-cover" />
              )}
              <p className="text-3xl font-semibold mb-2">{result.promoter_name}</p>
              {result.agency_name && <p className="text-xl opacity-90 mb-4">Agência: {result.agency_name}</p>}
              {result.brands && result.brands.length > 0 && (
                <div className="mt-4">
                  <p className="text-lg mb-2 opacity-80">Marcas autorizadas hoje:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {result.brands.map((brand) => (
                      <Badge key={brand} className="bg-white/30 text-white text-lg px-4 py-1">{brand}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
          {!isAuthorized && <p className="text-2xl mt-4 opacity-90">{result.block_reason}</p>}
          <div className="mt-8 flex gap-4 justify-center">
            {isAuthorized && result.entry_id && (
              <Button size="lg" onClick={handleCheckout} className="bg-white text-green-700 hover:bg-white/90 text-xl px-8 py-6">
                Registrar Saída
              </Button>
            )}
            <Button size="lg" variant="outline" onClick={handleReset} className="border-white text-white hover:bg-white/20 text-xl px-8 py-6">
              Nova Consulta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ Main CPF Input screen ═══
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 select-none" style={bgStyle}>
      <div className="absolute top-4 right-4 opacity-0" onClick={handleSettingsTap}>
        <Settings className="h-8 w-8" />
      </div>

      <div className="text-center max-w-md w-full space-y-6">
        {/* Logo & Header */}
        <div className="space-y-3">
          {config.logoUrl ? (
            <img src={config.logoUrl} alt="Logo" className="h-20 mx-auto object-contain drop-shadow-lg" />
          ) : (
            <ShieldCheck className="h-20 w-20 mx-auto drop-shadow-lg" style={{ color: config.primaryColor }} />
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-white">{config.headerText}</h1>
          <div className="flex items-center justify-center gap-2 text-white/60">
            <Store className="h-5 w-5" />
            <span className="text-lg">{config.unitName}</span>
          </div>
        </div>

        {/* Clock */}
        <div className="flex items-center justify-center gap-2 text-white/60 cursor-default" onClick={handleSettingsTap}>
          <Clock className="h-5 w-5" />
          <span className="text-2xl font-mono">
            {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>

        {/* CPF Display */}
        <div className="rounded-2xl p-6 backdrop-blur" style={{ backgroundColor: `${config.primaryColor}15`, border: `2px solid ${config.primaryColor}33` }}>
          <p className="text-white/80 text-lg mb-3">Digite seu CPF</p>
          <div className="text-4xl md:text-5xl font-mono tracking-[0.2em] h-16 flex items-center justify-center text-white" style={{ minHeight: 64 }}>
            {cpfDigits.length > 0 ? formatCpf(cpfDigits) : <span className="text-white/30">000.000.000-00</span>}
          </div>
        </div>

        {/* ═══ Confirmation Step: show photo after CPF lookup ═══ */}
        {lookupLoading && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-12 w-12 animate-spin text-white/70" />
            <p className="text-white/70 text-lg">Buscando cadastro...</p>
          </div>
        )}

        {lookupError && (
          <div className="rounded-2xl p-6 backdrop-blur text-center" style={{ backgroundColor: "#dc262644", border: "2px solid #dc262666" }}>
            <XCircle className="h-16 w-16 mx-auto mb-3 text-red-300" />
            <p className="text-white text-xl font-semibold mb-1">Não encontrado</p>
            <p className="text-white/80">{lookupError}</p>
            <Button onClick={handleReset} variant="outline" className="mt-4 border-white/40 text-white hover:bg-white/10">
              Tentar novamente
            </Button>
          </div>
        )}

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
            {lookupResult.agency_name && <p className="text-white/70 text-lg">Agência: {lookupResult.agency_name}</p>}

            {lookupResult.has_open_entry && lookupResult.entry_at && (
              <p className="text-amber-300/80 text-sm mt-2">
                Entrada: {new Date(lookupResult.entry_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <Button onClick={handleReset} variant="outline" className="flex-1 h-14 text-lg border-white/30 text-white hover:bg-white/10">
                Não sou eu
              </Button>
              {lookupResult.has_open_entry ? (
                <Button onClick={handleConfirmCheckout} disabled={loading}
                  className="flex-1 h-14 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <LogOut className="h-5 w-5 mr-2" />}
                  {loading ? "Saindo..." : "Check-out"}
                </Button>
              ) : (
                <Button onClick={handleConfirmCheckin} disabled={loading}
                  className="flex-1 h-14 text-lg font-bold" style={btnStyle}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <LogIn className="h-5 w-5 mr-2" />}
                  {loading ? "Validando..." : "Check-in"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Numpad — hidden during confirmation */}
        {!lookupResult && !lookupError && !lookupLoading && (
          <>
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
                    className="h-16 md:h-20 rounded-xl text-3xl font-bold transition-all active:scale-95 border"
                    style={numpadBtnStyle}>
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
      </div>

      {/* ═══ Config Dialog ═══ */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> Configuração do Totem
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Token do Totem *</Label>
              <Input value={configForm.token} onChange={e => setConfigForm(f => ({ ...f, token: e.target.value }))}
                placeholder="Cole aqui o token gerado na aba Unidades" className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground mt-1">Obtido no painel Admin → Controle de Acesso → Unidades</p>
            </div>
            <div>
              <Label>Nome da Unidade</Label>
              <Input value={configForm.unitName} onChange={e => setConfigForm(f => ({ ...f, unitName: e.target.value }))} placeholder="Ex: Supermercado Central" />
            </div>
            <div>
              <Label>Texto do Cabeçalho</Label>
              <Input value={configForm.headerText} onChange={e => setConfigForm(f => ({ ...f, headerText: e.target.value }))} />
            </div>
            <div>
              <Label>URL do Logo (opcional)</Label>
              <Input value={configForm.logoUrl} onChange={e => setConfigForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." />
              {configForm.logoUrl && (
                <div className="mt-2 p-3 bg-muted rounded-lg flex justify-center">
                  <img src={configForm.logoUrl} alt="Preview" className="h-12 object-contain" />
                </div>
              )}
            </div>
            <div className="border-t pt-4">
              <p className="font-medium text-sm mb-3">Personalização de Cores</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cor Principal</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={configForm.primaryColor} onChange={e => setConfigForm(f => ({ ...f, primaryColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0" />
                    <Input value={configForm.primaryColor} onChange={e => setConfigForm(f => ({ ...f, primaryColor: e.target.value }))} className="font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Cor de Fundo</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={configForm.bgColor} onChange={e => setConfigForm(f => ({ ...f, bgColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0" />
                    <Input value={configForm.bgColor} onChange={e => setConfigForm(f => ({ ...f, bgColor: e.target.value }))} className="font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Cor Secundária</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={configForm.secondaryColor} onChange={e => setConfigForm(f => ({ ...f, secondaryColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0" />
                    <Input value={configForm.secondaryColor} onChange={e => setConfigForm(f => ({ ...f, secondaryColor: e.target.value }))} className="font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Cor do Botão</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={configForm.buttonColor} onChange={e => setConfigForm(f => ({ ...f, buttonColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0" />
                    <Input value={configForm.buttonColor} onChange={e => setConfigForm(f => ({ ...f, buttonColor: e.target.value }))} className="font-mono text-xs" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveConfig} disabled={!configForm.token}>Salvar Configuração</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TotemAccess;
