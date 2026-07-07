import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Brain, Sparkles, RefreshCw, Trash2, TrendingUp, AlertTriangle, Lightbulb, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSRAdvisorHistory, useSRAdvisorAnalyze, useSRDeleteAdvisor } from "@/hooks/use-smartroute-ai";
import { useSRRoutes } from "@/hooks/use-smartroute";

const PRIORITY: Record<string, string> = {
  alta: "bg-red-100 text-red-800 border-red-200",
  media: "bg-amber-100 text-amber-800 border-amber-200",
  baixa: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function SmartRouteGestorIA() {
  const [scope, setScope] = useState("operacional");
  const [routeId, setRouteId] = useState<string>("");
  const { data: routes = [] } = useSRRoutes();
  const { data: history = [] } = useSRAdvisorHistory();
  const analyze = useSRAdvisorAnalyze();
  const del = useSRDeleteAdvisor();
  const [selected, setSelected] = useState<any>(null);

  const run = async () => {
    try {
      const r: any = await analyze.mutateAsync({ scope, route_id: routeId || undefined });
      setSelected(r);
      toast.success("Análise gerada", { description: r?.parsed?.resumo_executivo?.slice(0, 80) });
    } catch (e: any) { toast.error(e.message); }
  };

  const current = selected || history[0];
  const parsed = current?.data || current?.parsed || {};

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" /> Gestor IA
            </h1>
            <p className="text-sm text-muted-foreground">Recomendações estratégicas e operacionais baseadas nos dados reais da sua operação.</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4" /> Nova análise</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-3 items-end">
            <div>
              <Label className="text-xs">Escopo</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operacional">Operacional (dia a dia)</SelectItem>
                  <SelectItem value="tatico">Tático (semana)</SelectItem>
                  <SelectItem value="estrategico">Estratégico (mês)</SelectItem>
                  <SelectItem value="frota">Frota & motoristas</SelectItem>
                  <SelectItem value="atendimento">Qualidade de atendimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Rota específica (opcional)</Label>
              <Select value={routeId || "all"} onValueChange={(v) => setRouteId(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Toda a operação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda a operação</SelectItem>
                  {routes.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.code} — {r.planned_date?.slice(0, 10)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={run} disabled={analyze.isPending} size="lg">
              {analyze.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando...</> : <><Brain className="w-4 h-4 mr-2" /> Consultar Gestor IA</>}
            </Button>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Histórico */}
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto divide-y">
                {history.map((h: any) => (
                  <button key={h.id} onClick={() => setSelected(h)} className={`w-full text-left p-3 hover:bg-muted transition ${current?.id === h.id ? "bg-muted" : ""}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{h.scope}</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-sm line-clamp-2">{h.title}</p>
                  </button>
                ))}
                {!history.length && <p className="text-xs text-muted-foreground text-center p-6">Nenhuma análise ainda.</p>}
              </div>
            </CardContent>
          </Card>

          {/* Análise atual */}
          <div className="lg:col-span-2 space-y-4">
            {!current && (
              <Card><CardContent className="p-10 text-center text-muted-foreground">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-40" />
                Nenhuma análise selecionada. Rode uma nova acima para receber recomendações do Gestor IA.
              </CardContent></Card>
            )}
            {current && (
              <>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Resumo Executivo</div>
                        <p className="text-base font-medium mt-1">{parsed.resumo_executivo || current.title}</p>
                      </div>
                      {typeof parsed.score_operacional === "number" && (
                        <div className="text-center">
                          <div className={`text-3xl font-bold ${parsed.score_operacional >= 75 ? "text-emerald-600" : parsed.score_operacional >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {parsed.score_operacional}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Score</div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Escopo: <b>{current.scope}</b></span>
                      <span>·</span>
                      <span>{new Date(current.created_at).toLocaleString("pt-BR")}</span>
                      <div className="flex-1" />
                      <Button size="sm" variant="ghost" onClick={() => del.mutate(current.id, { onSuccess: () => setSelected(null) })}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {Array.isArray(parsed.principais_riscos) && parsed.principais_riscos.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Principais riscos</CardTitle></CardHeader>
                    <CardContent><ul className="space-y-1 text-sm">
                      {parsed.principais_riscos.map((r: string, i: number) => <li key={i} className="flex gap-2"><span className="text-red-500">•</span>{r}</li>)}
                    </ul></CardContent>
                  </Card>
                )}

                {Array.isArray(parsed.recomendacoes) && parsed.recomendacoes.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Recomendações</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {parsed.recomendacoes.map((r: any, i: number) => (
                        <div key={i} className="border-l-2 border-primary/50 pl-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={PRIORITY[r.prioridade] || ""}>{r.prioridade || "media"}</Badge>
                            <span className="font-semibold text-sm">{r.titulo}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{r.descricao}</p>
                          {r.impacto && <p className="text-xs mt-1 text-emerald-700"><TrendingUp className="w-3 h-3 inline mr-1" /> {r.impacto}</p>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {Array.isArray(parsed.oportunidades) && parsed.oportunidades.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-500" /> Oportunidades</CardTitle></CardHeader>
                    <CardContent><ul className="space-y-1 text-sm">
                      {parsed.oportunidades.map((o: string, i: number) => <li key={i} className="flex gap-2"><span className="text-blue-500">•</span>{o}</li>)}
                    </ul></CardContent>
                  </Card>
                )}

                {Array.isArray(parsed.proximos_passos_24h) && parsed.proximos_passos_24h.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-emerald-500" /> Próximos passos (24h)</CardTitle></CardHeader>
                    <CardContent><ol className="space-y-1 text-sm list-decimal list-inside">
                      {parsed.proximos_passos_24h.map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ol></CardContent>
                  </Card>
                )}

                {parsed.raw_text && (
                  <Card><CardContent className="p-4"><pre className="text-xs whitespace-pre-wrap">{parsed.raw_text}</pre></CardContent></Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
