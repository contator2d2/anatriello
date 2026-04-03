import { useState, useRef, useEffect } from "react";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Clock, Store, Delete, Settings } from "lucide-react";
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
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {}
  // Migrate old keys
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

  // Auto-reset result after 8 seconds
  useEffect(() => {
    if (result) {
      const timer = setTimeout(handleReset, 8000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  // Show config if no token
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
    if (key === "⌫") {
      setCpfDigits(prev => prev.slice(0, -1));
    } else if (key && cpfDigits.length < 11) {
      const newDigits = cpfDigits + key;
      setCpfDigits(newDigits);
      // Auto-validate when 11 digits reached
      if (newDigits.length === 11) {
        setTimeout(() => handleValidate(newDigits), 300);
      }
    }
  };

  const handleValidate = async (digits?: string) => {
    const cleanCpf = digits || cpfDigits;
    if (cleanCpf.length !== 11) return;

    setLoading(true);
    try {
      const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const res = await fetch(`${API_URL}/api/access-control/totem/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-totem-token": config.token,
        },
        body: JSON.stringify({ cpf: cleanCpf }),
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
      setResult({
        status: "blocked",
        block_reason: "Erro de conexão com o servidor",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!result?.entry_id) return;
    try {
      const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      await fetch(`${API_URL}/api/access-control/totem/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-totem-token": config.token,
        },
        body: JSON.stringify({ entry_id: result.entry_id }),
      });
    } catch {}
    handleReset();
  };

  const handleReset = () => {
    setResult(null);
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

  // Dynamic styles based on config
  const bgStyle = { background: `linear-gradient(135deg, ${config.bgColor} 0%, ${config.secondaryColor} 50%, ${config.bgColor} 100%)` };
  const btnStyle = { backgroundColor: config.buttonColor, color: config.buttonTextColor };
  const numpadBtnStyle = { backgroundColor: `${config.primaryColor}22`, borderColor: `${config.primaryColor}44`, color: "#fff" };

  // ═══ Result screen ═══
  if (result) {
    const isAuthorized = result.status === "authorized";
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-8 transition-colors duration-500"
        style={{ background: isAuthorized ? "#16a34a" : "#dc2626" }}
      >
        <div className="text-center text-white max-w-lg w-full">
          {config.logoUrl && (
            <img src={config.logoUrl} alt="Logo" className="h-16 mx-auto mb-6 object-contain" />
          )}

          {isAuthorized ? (
            <CheckCircle2 className="h-32 w-32 mx-auto mb-6 animate-in zoom-in duration-500" />
          ) : (
            <XCircle className="h-32 w-32 mx-auto mb-6 animate-in zoom-in duration-500" />
          )}

          <h1 className="text-5xl font-bold mb-4">
            {isAuthorized ? "ACESSO LIBERADO" : "ACESSO BLOQUEADO"}
          </h1>

          {isAuthorized && (
            <Card className="bg-white/20 backdrop-blur border-white/30 p-6 mt-6 text-white">
              {result.promoter_photo && (
                <img
                  src={result.promoter_photo}
                  alt="Foto"
                  className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white object-cover"
                />
              )}
              <p className="text-3xl font-semibold mb-2">{result.promoter_name}</p>
              {result.agency_name && (
                <p className="text-xl opacity-90 mb-4">Agência: {result.agency_name}</p>
              )}
              {result.brands && result.brands.length > 0 && (
                <div className="mt-4">
                  <p className="text-lg mb-2 opacity-80">Marcas autorizadas hoje:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {result.brands.map((brand) => (
                      <Badge key={brand} className="bg-white/30 text-white text-lg px-4 py-1">
                        {brand}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {!isAuthorized && (
            <p className="text-2xl mt-4 opacity-90">{result.block_reason}</p>
          )}

          <div className="mt-8 flex gap-4 justify-center">
            {isAuthorized && result.entry_id && (
              <Button
                size="lg"
                onClick={handleCheckout}
                className="bg-white text-green-700 hover:bg-white/90 text-xl px-8 py-6"
              >
                Registrar Saída
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              onClick={handleReset}
              className="border-white text-white hover:bg-white/20 text-xl px-8 py-6"
            >
              Nova Consulta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ Main CPF Input screen with virtual numpad ═══
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 select-none" style={bgStyle}>
      {/* Hidden settings trigger — tap 5x on clock area */}
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
        <div
          className="flex items-center justify-center gap-2 text-white/60 cursor-default"
          onClick={handleSettingsTap}
        >
          <Clock className="h-5 w-5" />
          <span className="text-2xl font-mono">
            {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>

        {/* CPF Display */}
        <div className="rounded-2xl p-6 backdrop-blur" style={{ backgroundColor: `${config.primaryColor}15`, border: `2px solid ${config.primaryColor}33` }}>
          <p className="text-white/80 text-lg mb-3">Digite seu CPF</p>
          <div
            className="text-4xl md:text-5xl font-mono tracking-[0.2em] h-16 flex items-center justify-center text-white"
            style={{ minHeight: 64 }}
          >
            {cpfDigits.length > 0 ? formatCpf(cpfDigits) : (
              <span className="text-white/30">000.000.000-00</span>
            )}
          </div>
        </div>

        {/* Virtual Numpad */}
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
          {NUMPAD_KEYS.map((key, i) => {
            if (key === "") return <div key={i} />;
            if (key === "⌫") {
              return (
                <button
                  key={i}
                  onClick={() => handleNumpadPress(key)}
                  className="h-16 md:h-20 rounded-xl text-2xl font-bold flex items-center justify-center transition-all active:scale-95 border"
                  style={{ ...numpadBtnStyle, backgroundColor: `${config.primaryColor}33` }}
                >
                  <Delete className="h-7 w-7" />
                </button>
              );
            }
            return (
              <button
                key={i}
                onClick={() => handleNumpadPress(key)}
                className="h-16 md:h-20 rounded-xl text-3xl font-bold transition-all active:scale-95 border"
                style={numpadBtnStyle}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* Confirm button */}
        <Button
          onClick={() => handleValidate()}
          disabled={cpfDigits.length !== 11 || loading}
          className="w-full h-16 text-xl font-bold rounded-xl transition-all"
          style={cpfDigits.length === 11 && !loading ? btnStyle : undefined}
          size="lg"
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
          ) : (
            <ShieldCheck className="h-6 w-6 mr-2" />
          )}
          {loading ? "Verificando..." : "Confirmar Acesso"}
        </Button>
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
              <Input
                value={configForm.token}
                onChange={e => setConfigForm(f => ({ ...f, token: e.target.value }))}
                placeholder="Cole aqui o token gerado na aba Unidades"
                className="font-mono text-xs"
              />
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
