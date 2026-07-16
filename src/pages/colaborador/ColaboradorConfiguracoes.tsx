import { useNavigate } from "react-router-dom";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { ScanFace, KeyRound, Bell, Shield, HelpCircle, LogOut, ChevronRight } from "lucide-react";

export default function ColaboradorConfiguracoes() {
  const nav = useNavigate();

  const items = [
    { icon: ScanFace, label: "Reconhecimento facial", desc: "Coletar / atualizar biometria facial", to: "/colaborador/biometria" },
    { icon: KeyRound, label: "Trocar senha", desc: "Alterar sua senha de acesso", to: "/promotor/trocar-senha" },
    { icon: Bell, label: "Notificações", desc: "Preferências de alertas e avisos", to: "/colaborador/perfil?section=notificacoes" },
    { icon: Shield, label: "Privacidade e segurança", desc: "LGPD, sessões e permissões", to: "/colaborador/perfil?section=privacidade" },
    { icon: HelpCircle, label: "Ajuda e suporte", desc: "Fale com o RH da sua empresa", to: "/colaborador/solicitacoes" },
  ];

  function logout() {
    localStorage.removeItem("promotor_token");
    localStorage.removeItem("promotor_employee");
    nav("/colaborador/login");
  }

  return (
    <ColaboradorLayout bg="light" title="Configurações" showBack>
      <div className="px-4 pt-6 pb-8">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {items.map((it, i) => (
            <button
              key={it.label}
              onClick={() => nav(it.to)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${i > 0 ? "border-t border-slate-100" : ""}`}
            >
              <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <it.icon className="h-5 w-5 text-[#f97316]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{it.label}</p>
                <p className="text-xs text-slate-500 truncate">{it.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </button>
          ))}
        </div>

        <button onClick={logout} className="w-full mt-6 py-3 rounded-2xl bg-white text-red-500 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm">
          <LogOut className="h-4 w-4" /> Sair da conta
        </button>
      </div>
    </ColaboradorLayout>
  );
}
