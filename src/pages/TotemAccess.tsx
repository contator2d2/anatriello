import { useState, useRef, useEffect } from "react";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Clock, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ValidationResult {
  status: "authorized" | "blocked";
  promoter_name?: string;
  promoter_photo?: string;
  agency_name?: string;
  brands?: string[];
  entry_id?: string;
  block_reason?: string;
}

const TotemAccess = () => {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const inputRef = useRef<HTMLInputElement>(null);

  // Token do totem salvo no localStorage
  const totemToken = localStorage.getItem("totem_token") || "";
  const unitName = localStorage.getItem("totem_unit_name") || "PDV";

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!result) inputRef.current?.focus();
  }, [result]);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCpf(e.target.value));
  };

  const handleValidate = async () => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) return;

    setLoading(true);
    try {
      const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const res = await fetch(`${API_URL}/api/access-control/totem/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-totem-token": totemToken,
        },
        body: JSON.stringify({ cpf: cleanCpf }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({
          status: "authorized",
          promoter_name: data.promoter_name,
          promoter_photo: data.promoter_photo,
          agency_name: data.agency_name,
          brands: data.brands || [],
          entry_id: data.entry_id,
        });
      } else {
        setResult({
          status: "blocked",
          block_reason: data.error || "Acesso não autorizado",
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
          "x-totem-token": totemToken,
        },
        body: JSON.stringify({ entry_id: result.entry_id }),
      });
    } catch {
      // silent
    }
    handleReset();
  };

  const handleReset = () => {
    setResult(null);
    setCpf("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleValidate();
  };

  // Tela de resultado
  if (result) {
    const isAuthorized = result.status === "authorized";
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-8 transition-colors duration-500 ${
        isAuthorized ? "bg-green-600" : "bg-red-600"
      }`}>
        <div className="text-center text-white max-w-lg">
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

  // Tela de entrada CPF
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-md w-full">
        <div className="mb-8">
          <ShieldCheck className="h-20 w-20 mx-auto text-primary mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Controle de Acesso</h1>
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <Store className="h-5 w-5" />
            <span className="text-lg">{unitName}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-slate-400 mb-8">
          <Clock className="h-5 w-5" />
          <span className="text-2xl font-mono">
            {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>

        <Card className="bg-white/10 backdrop-blur border-white/20 p-8">
          <p className="text-white text-xl mb-6">Digite seu CPF para entrar</p>
          <Input
            ref={inputRef}
            value={cpf}
            onChange={handleCpfChange}
            onKeyDown={handleKeyDown}
            placeholder="000.000.000-00"
            className="text-center text-3xl h-16 bg-white/10 border-white/30 text-white placeholder:text-white/40 tracking-widest"
            maxLength={14}
            autoFocus
          />
          <Button
            onClick={handleValidate}
            disabled={cpf.replace(/\D/g, "").length !== 11 || loading}
            className="w-full mt-6 h-14 text-xl"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
            ) : (
              <ShieldCheck className="h-6 w-6 mr-2" />
            )}
            {loading ? "Verificando..." : "Confirmar"}
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default TotemAccess;
