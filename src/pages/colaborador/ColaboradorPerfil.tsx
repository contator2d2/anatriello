import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { useColabMeFull } from "@/hooks/use-promotor";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { User, Settings, Shield, ChevronRight, Camera, LogOut, KeyRound, Info, RefreshCw, Loader2 } from "lucide-react";

const ITEMS: { icon: any; label: string; to: string }[] = [
  { icon: Camera, label: "Reconhecimento facial", to: "/colaborador/biometria" },
  { icon: KeyRound, label: "Trocar senha", to: "/promotor/trocar-senha" },
  { icon: Settings, label: "Configurações", to: "/colaborador/configuracoes" },
  { icon: Shield, label: "Privacidade e segurança", to: "/colaborador/dados?section=privacidade" },
];

export default function ColaboradorPerfil() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useColabMeFull();
  const emp = data?.employee;
  const [syncing, setSyncing] = useState(false);

  function logout() {
    localStorage.removeItem("promotor_token");
    localStorage.removeItem("promotor_employee");
    nav("/colaborador/login");
  }

  async function forceSync() {
    if (syncing) return;
    setSyncing(true);
    toast({ title: "Sincronizando...", description: "Baixando a versão mais recente." });
    try {
      // 1) invalida todas as queries em memória
      await qc.invalidateQueries();
      qc.clear();
      // 2) limpa Cache Storage (SW/PWA)
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      // 3) desregistra service workers
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      // 4) limpa sessionStorage (mantém login em localStorage)
      try { sessionStorage.clear(); } catch {}
    } catch (e) {
      console.error("[sync] erro:", e);
    } finally {
      // 5) recarrega com bypass de cache HTTP (funciona no iOS/iPad Safari)
      setTimeout(() => {
        window.location.replace(window.location.pathname + "?v=" + Date.now());
      }, 400);
    }
  }

  return (
    <ColaboradorLayout bg="light" title="Meu Perfil" showBack>
      <div className="px-4 pt-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-slate-200 overflow-hidden">
              {emp?.photo_url ? <img src={emp.photo_url} alt="" className="h-full w-full object-cover" /> : <User className="h-16 w-16 p-3 text-slate-400" />}
            </div>
            <button className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#f97316] text-white flex items-center justify-center">
              <Camera className="h-3 w-3" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold truncate">{emp?.full_name || "—"}</p>
            <p className="text-xs text-slate-500 truncate">{emp?.position || "Colaborador"}</p>
            <p className="text-xs text-slate-400 truncate">{emp?.company_name || emp?.company_cnpj || "Empresa"}</p>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow-sm overflow-hidden">
          {ITEMS.map((it, i) => (
            <button
              key={it.label}
              onClick={() => nav(it.to)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50 ${i > 0 ? "border-t border-slate-100" : ""}`}
            >
              <it.icon className="h-5 w-5 text-slate-500" />
              <span className="flex-1 text-sm">{it.label}</span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </button>
          ))}
        </div>

        <button
          onClick={() => nav("/colaborador/solicitacoes?new=1&kind=atualizacao_cadastral")}
          className="w-full mt-4 flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-left"
        >
          <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-amber-900">Precisa atualizar dados cadastrais?</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Dados pessoais, endereço, dependentes e conta bancária são atualizados via Solicitação para o RH.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-amber-600 mt-1" />
        </button>

        <button
          onClick={forceSync}
          disabled={syncing}
          className="w-full mt-4 py-3 rounded-2xl bg-white text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm active:bg-slate-50 disabled:opacity-60"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {syncing ? "Atualizando..." : "Atualizar app (limpar cache)"}
        </button>
        <p className="mt-1.5 text-[11px] text-slate-400 text-center px-4">
          Use se algum dado (jornada, horário, foto) parecer desatualizado.
        </p>

        <button onClick={logout} className="w-full mt-4 py-3 rounded-2xl bg-white text-red-500 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </ColaboradorLayout>
  );
}
