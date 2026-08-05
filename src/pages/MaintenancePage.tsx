import { useEffect, useState } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function MaintenancePage() {
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      // Tenta bater em um endpoint público leve
      await api('/api/public/branding', { auth: false, silent: true });
      // Se chegar aqui, o servidor respondeu (mesmo que com erro estrutural, se for ok=true/false tratamos no catch se for 500)
      window.location.reload();
    } catch (err: any) {
      // Se for 500 ou erro de rede, continua aqui
      console.log("Servidor ainda indisponível");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center">
          <div className="h-20 w-20 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-amber-600" />
          </div>
        </div>
        
        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Servidor Indisponível
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed">
            Precisei reiniciar o servidor e agora ele aparece assim: servidor indisponível. 
            Tente novamente mais tarde.
          </p>
          <p className="text-slate-500 text-sm">
            Todos os demais serviços que estão no servidor já voltaram.
          </p>
        </div>

        <div className="pt-6">
          <Button 
            onClick={checkStatus} 
            disabled={checking}
            className="w-full h-12 text-lg font-semibold gap-2"
          >
            {checking ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
            {checking ? "Verificando..." : "Verificar agora"}
          </Button>
        </div>

        <div className="pt-8 border-t border-slate-200">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
            Anatriello Gestão
          </p>
        </div>
      </div>
    </div>
  );
}
