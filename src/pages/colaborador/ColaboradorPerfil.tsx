import { useNavigate } from "react-router-dom";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { useColabMeFull } from "@/hooks/use-promotor";
import { User, Phone, Users, CreditCard, MapPin, Settings, Shield, ChevronRight, Camera, LogOut, KeyRound } from "lucide-react";

const ITEMS: { icon: any; label: string; to?: string }[] = [
  { icon: User, label: "Dados pessoais" },
  { icon: Phone, label: "Contato" },
  { icon: Users, label: "Dependentes" },
  { icon: CreditCard, label: "Dados bancários" },
  { icon: MapPin, label: "Endereço" },
  { icon: KeyRound, label: "Trocar senha", to: "/promotor/trocar-senha" },
  { icon: Settings, label: "Configurações" },
  { icon: Shield, label: "Privacidade e segurança" },
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
              onClick={() => it.to && nav(it.to)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${i > 0 ? "border-t border-slate-100" : ""}`}
            >
              <it.icon className="h-5 w-5 text-slate-500" />
              <span className="flex-1 text-sm">{it.label}</span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </button>
          ))}
        </div>

        <button onClick={logout} className="w-full mt-6 py-3 rounded-2xl bg-white text-red-500 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </ColaboradorLayout>
  );
}
