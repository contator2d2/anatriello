import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, Loader2, RefreshCw, TrendingUp, ClipboardCheck, AlertTriangle,
  Lightbulb, CheckCircle2, Target, Route as RouteIcon, Clock, Fuel, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { useSRRoutes } from "@/hooks/use-smartroute";
import { useSRPostAnalyses, useSRRoutePostAnalyses, useSRRunPostAnalysis } from "@/hooks/use-smartroute-ai";

const PRIO: Record<string, string> = {
  alta: "bg-red-100 text-red-800 border-red-200",
  media: "bg-amber-100 text-amber-800 border-amber-200",
  baixa: "bg-slate-100 text-slate-700 border-slate-200",
};

function ScoreCard({ label, score, comment }: { label: string; score?: number; comment?: string }) {
  const s = typeof score === "number" ? score : 0;
  const color = s >= 80 ? "text-emerald-600" : s >= 60 ? "text-amber-600" : "text-red-600";
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold ${color}`}>{score ?? "-"}</div>
        <Progress value={s} className="h-1.5" />
        {comment && <div className="text-xs text-muted-foreground">{comment}</div>}
      </CardContent>
    </Card>
  );
}

export default function SmartRoutePosAnalise() {
  const [routeId, setRouteId] = useState<string>("");
  const { data: routes = [] } = useSRRoutes();
  const { data: routeAnalyses = [] } = useSRRoutePostAnalyses(routeId);
  const { data: allAnalyses = [] } = useSRPostAnalyses();
  const run = useSRRunPostAnalysis();
  const [selected, setSelected] = useState<any>(null);

  const finishedRoutes = useMemo(
    () => (routes as any[]).filter((r) => ["concluida", "em_andamento"].includes(r.status)),
    [routes]
  );

  const current = selected || routeAnalyses[0] || allAnalyses[0];
  const parsed = current?.data || current?.parsed || {};
  const metrics = parsed.metricas_calculadas || current?.metrics || {};

  const handleRun = async () => {
    if (!routeId) return toast.error("Selecione uma rota");
    try {
      const r: any = await run.mutateAsync(routeId);
      setSelected(r);
      toast.success("Análise pós-rota gerada", { description: r?.parsed?.resumo_executivo?.slice(0, 80) });
    } catch (e: any) { toast.error(e.message || "Falha ao analisar"); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> Análise Pós-Rota (IA)
          </h1>
          <p className="text-sm text-muted-foreground">
            Relatório inteligente da execução: produtividade, gargalos, cumprimento de checklist, ocorrências e recomendações.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><RouteIcon className="w-4 h-4" /> Nova análise</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <Label className="text-xs">Rota</Label>
              <Select value={routeId} onValueChange={(v) => { setRouteId(v); setSelected(null); }}>
                <SelectTrigger><SelectValue placeholder="Selecione uma rota" /></SelectTrigger>
                <SelectContent>
                  {finishedRoutes.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.code} — {r.status} {r.planned_date ? `(${new Date(r.planned_date).toLocaleDateString("pt-BR")})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleRun} disabled={!routeId || run.isPending}>
              {run.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Gerar análise
            </Button>
          </CardContent>
        </Card>

        {current && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" /> {current.route_code || metrics?.rota?.codigo || "Rota"}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground">
                      Gerado em {new Date(current.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRun} disabled={run.isPending}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Reprocessar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">{parsed.resumo_executivo}</p>
                <div className="grid md:grid-cols-4 gap-3">
                  <ScoreCard label="Score de execução" score={parsed.score_execucao} />
                  <ScoreCard label="Produtividade" score={parsed.produtividade?.nota} comment={parsed.produtividade?.comentario} />
                  <ScoreCard label="Checklist" score={parsed.cumprimento_checklist?.nota} comment={parsed.cumprimento_checklist?.comentario} />
                  <ScoreCard label="Qualidade atendimento" score={parsed.qualidade_atendimento?.nota} comment={parsed.qualidade_atendimento?.comentario} />
                </div>
              </CardContent>
            </Card>

            {metrics?.rota && (
              <div className="grid md:grid-cols-4 gap-3">
                <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Duração</div><div className="text-xl font-semibold">{metrics.rota.duracao_min ?? "-"} min</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><RouteIcon className="w-3 h-3" /> Distância</div><div className="text-xl font-semibold">{metrics.rota.km_total ?? "-"} km</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Fuel className="w-3 h-3" /> Combustível</div><div className="text-xl font-semibold">{metrics.rota.combustivel_l ?? "-"} L</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> Custo</div><div className="text-xl font-semibold">R$ {metrics.rota.custo_brl ?? "-"}</div></CardContent></Card>
              </div>
            )}

            {metrics?.paradas && (
              <Card>
                <CardHeader><CardTitle className="text-base">Métricas de paradas</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-5 gap-3 text-sm">
                  <div><div className="text-xs text-muted-foreground">Total</div><div className="font-semibold">{metrics.paradas.total}</div></div>
                  <div><div className="text-xs text-muted-foreground">Concluídas</div><div className="font-semibold text-emerald-600">{metrics.paradas.concluidas}</div></div>
                  <div><div className="text-xs text-muted-foreground">Não entregues</div><div className="font-semibold text-red-600">{metrics.paradas.nao_entregues}</div></div>
                  <div><div className="text-xs text-muted-foreground">Taxa sucesso</div><div className="font-semibold">{metrics.paradas.taxa_sucesso_pct}%</div></div>
                  <div><div className="text-xs text-muted-foreground">Tempo médio</div><div className="font-semibold">{metrics.paradas.tempo_medio_atendimento_min ?? "-"} min</div></div>
                </CardContent>
              </Card>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              {parsed.pontos_positivos?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Pontos positivos</CardTitle></CardHeader>
                  <CardContent className="text-sm"><ul className="list-disc pl-4 space-y-1">{parsed.pontos_positivos.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></CardContent>
                </Card>
              )}
              {parsed.gargalos?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Gargalos</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-2">
                    {parsed.gargalos.map((g: any, i: number) => (
                      <div key={i} className="border-l-2 border-amber-400 pl-2">
                        <div className="font-medium">{g.titulo}</div>
                        <div className="text-xs text-muted-foreground">{g.descricao}</div>
                        {g.impacto && <div className="text-xs">Impacto: {g.impacto}</div>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {parsed.ocorrencias_criticas?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" /> Ocorrências críticas</CardTitle></CardHeader>
                <CardContent className="text-sm"><ul className="list-disc pl-4 space-y-1">{parsed.ocorrencias_criticas.map((o: string, i: number) => <li key={i}>{o}</li>)}</ul></CardContent>
              </Card>
            )}

            {parsed.recomendacoes?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Recomendações</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {parsed.recomendacoes.map((r: any, i: number) => (
                    <div key={i} className="border rounded p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={PRIO[r.prioridade] || ""}>{r.prioridade}</Badge>
                        <div className="font-medium text-sm">{r.titulo}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{r.acao}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {parsed.aprendizados_para_proxima_rota?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Aprendizados para a próxima rota</CardTitle></CardHeader>
                <CardContent className="text-sm"><ul className="list-disc pl-4 space-y-1">{parsed.aprendizados_para_proxima_rota.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></CardContent>
              </Card>
            )}
          </>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="w-4 h-4" /> Histórico de análises</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {(allAnalyses as any[]).length === 0 && <div className="text-sm text-muted-foreground">Nenhuma análise pós-rota gerada ainda.</div>}
            {(allAnalyses as any[]).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between border rounded p-2 hover:bg-muted/30 cursor-pointer"
                   onClick={() => { setRouteId(a.route_id); setSelected(a); }}>
                <div className="text-sm">
                  <div className="font-medium">{a.route_code || a.title?.slice(0, 60)}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.driver_name || "-"} · {new Date(a.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <Badge variant="outline">Score {a.data?.score_execucao ?? "-"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
