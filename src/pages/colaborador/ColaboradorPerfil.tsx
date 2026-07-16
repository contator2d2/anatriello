import { useNavigate } from "react-router-dom";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { useColabMeFull } from "@/hooks/use-promotor";
import { User, Settings, Shield, ChevronRight, Camera, LogOut, KeyRound, Info } from "lucide-react";

const ITEMS: { icon: any; label: string; to: string }[] = [
  { icon: Camera, label: "Reconhecimento facial", to: "/colaborador/biometria" },
  { icon: KeyRound, label: "Trocar senha", to: "/promotor/trocar-senha" },
  { icon: Settings, label: "Configurações", to: "/colaborador/configuracoes" },
  { icon: Shield, label: "Privacidade e segurança", to: "/colaborador/dados?section=privacidade" },
];

export default function ColaboradorPerfil() {
  const nav = useNavigate();
  const { data } = useColabMeFull();
  const emp = data?.employee;

  function logout() {
    localStorage.removeItem("promotor_token");
    localStorage.removeItem("promotor_employee");
    nav("/colaborador/login");
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


        <button onClick={logout} className="w-full mt-6 py-3 rounded-2xl bg-white text-red-500 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </ColaboradorLayout>
  );
}
