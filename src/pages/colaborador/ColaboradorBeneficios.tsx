import { ColaboradorLayout } from "./ColaboradorLayout";
import { useColabBenefits } from "@/hooks/use-promotor";
import { Utensils, Coffee, HeartPulse, Smile, Shield, ChevronRight, Loader2 } from "lucide-react";

const ICONS: Record<string, any> = {
  vale_alimentacao: { icon: Utensils, color: "#f97316" },
  vale_refeicao: { icon: Coffee, color: "#ec4899" },
  plano_saude: { icon: HeartPulse, color: "#ef4444" },
  plano_odonto: { icon: Smile, color: "#06b6d4" },
  seguro_vida: { icon: Shield, color: "#10b981" },
};

export default function ColaboradorBeneficios() {
  const { data, isLoading } = useColabBenefits();

  return (
    <ColaboradorLayout bg="light" title="Benefícios" showBack>
      <div className="px-4 pt-4 space-y-2">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />}
        {(data || []).map((b: any) => {
          const meta = ICONS[b.kind] || { icon: HeartPulse, color: "#64748b" };
          const Icon = meta.icon;
          const val = b.value_cents ? `R$ ${(b.value_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${b.unit ? ` / ${b.unit}` : ""}` : "";
          return (
            <div key={b.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}15`, color: meta.color }}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{b.label}</p>
                <p className="text-xs text-slate-500">{b.provider || val}</p>
              </div>
              <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Ativo</span>
            </div>
          );
        })}
        {!isLoading && !data?.length && (
          <p className="text-xs text-slate-400 text-center py-8">Nenhum benefício vinculado</p>
        )}
        <button className="w-full mt-4 py-3 text-sm text-slate-500 font-semibold flex items-center justify-center gap-1">
          Ver todos os benefícios <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </ColaboradorLayout>
  );
}
