import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Check, Loader2, Route, MapPin, ListChecks, Timer, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type SimStep = {
  key: string;
  label: string;
  icon: any;
  ms: number;
};

const DEFAULT_STEPS: SimStep[] = [
  { key: "load",   label: "Carregando pedidos da rota…",       icon: Route,       ms: 700 },
  { key: "pdv",    label: "Analisando PDVs e janelas…",         icon: MapPin,      ms: 900 },
  { key: "check",  label: "Verificando checklists por PDV…",    icon: ListChecks,  ms: 800 },
  { key: "seq",    label: "Ajustando sequência ótima…",         icon: Sparkles,    ms: 1000 },
  { key: "time",   label: "Calculando ETAs e deslocamentos…",   icon: Timer,       ms: 800 },
  { key: "upsell", label: "Aplicando tempo de upsell…",         icon: TrendingUp,  ms: 600 },
];

export function SimulationRunnerDialog({
  open,
  onDone,
  steps = DEFAULT_STEPS,
}: {
  open: boolean;
  onDone: () => void;
  steps?: SimStep[];
}) {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) { setIdx(0); setProgress(0); return; }
    let cancelled = false;
    let acc = 0;
    const total = steps.reduce((s, x) => s + x.ms, 0);

    const runStep = async (i: number) => {
      if (cancelled) return;
      if (i >= steps.length) {
        setProgress(100);
        setTimeout(() => !cancelled && onDone(), 350);
        return;
      }
      setIdx(i);
      const start = Date.now();
      const dur = steps[i].ms;
      const tick = () => {
        if (cancelled) return;
        const elapsed = Date.now() - start;
        const localPct = Math.min(1, elapsed / dur);
        setProgress(Math.min(99, ((acc + localPct * dur) / total) * 100));
        if (elapsed < dur) requestAnimationFrame(tick);
        else {
          acc += dur;
          runStep(i + 1);
        }
      };
      requestAnimationFrame(tick);
    };
    runStep(0);
    return () => { cancelled = true; };
  }, [open]);

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white">
        {/* Glow header */}
        <div className="relative p-6 pb-4 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-sky-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-400 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/40">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Simulando rota com IA</div>
              <div className="text-xs text-slate-300">Processando restrições, sequência e tempos</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative mt-5 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 transition-[width] duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute inset-y-0 w-24 bg-white/30 blur-md animate-[shimmer_1.6s_linear_infinite]"
              style={{ left: `calc(${progress}% - 6rem)` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-slate-300 tabular-nums text-right">{Math.round(progress)}%</div>
        </div>

        {/* Steps */}
        <div className="px-6 pb-6 space-y-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const done = i < idx || progress >= 100;
            const active = i === idx && progress < 100;
            return (
              <div
                key={s.key}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-all",
                  active && "bg-white/5 border-indigo-400/40 shadow-[0_0_20px_-8px_rgba(129,140,248,0.7)]",
                  done && "bg-emerald-500/5 border-emerald-500/20",
                  !active && !done && "border-white/5 opacity-50",
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  done ? "bg-emerald-500/20 text-emerald-300"
                       : active ? "bg-indigo-500/20 text-indigo-200"
                       : "bg-white/5 text-slate-400"
                )}>
                  {done ? <Check className="w-4 h-4" />
                    : active ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Icon className="w-4 h-4" />}
                </div>
                <div className={cn("text-sm", active ? "text-white" : done ? "text-emerald-200" : "text-slate-400")}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>

        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
