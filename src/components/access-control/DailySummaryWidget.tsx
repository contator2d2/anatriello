import { useDailySummary } from '@/hooks/use-incidents';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw, AlertTriangle, Lightbulb, TrendingUp, Loader2 } from 'lucide-react';

interface Props {
  portal?: 'supermarket' | 'agency' | 'admin';
}

export default function DailySummaryWidget({ portal = 'supermarket' }: Props) {
  const { summary, isLoading, refetch } = useDailySummary(portal);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-3" />
        <div className="h-3 bg-muted rounded w-full mb-2" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    );
  }

  const hasData = summary?.ai_summary || summary?.summary;
  const metrics = summary?.metrics || {};
  const highlights = (typeof summary?.highlights === 'string' ? JSON.parse(summary.highlights) : summary?.highlights) || [];
  const risks = (typeof summary?.risks === 'string' ? JSON.parse(summary.risks) : summary?.risks) || [];
  const recommendations = (typeof summary?.recommendations === 'string' ? JSON.parse(summary.recommendations) : summary?.recommendations) || [];

  return (
    <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Resumo Operacional IA
        </h3>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1 h-7 text-xs">
          <RefreshCw className="h-3 w-3" /> Atualizar
        </Button>
      </div>

      {hasData ? (
        <>
          <p className="text-sm">{summary.ai_summary || summary.summary}</p>

          {/* Metrics row */}
          {(metrics.total_entries !== undefined) && (
            <div className="flex gap-3 flex-wrap">
              <div className="text-center px-3 py-1.5 rounded-md bg-background border">
                <p className="text-lg font-bold text-primary">{metrics.total_entries || 0}</p>
                <p className="text-[10px] text-muted-foreground">Entradas</p>
              </div>
              <div className="text-center px-3 py-1.5 rounded-md bg-background border">
                <p className="text-lg font-bold text-green-600">{metrics.authorized || 0}</p>
                <p className="text-[10px] text-muted-foreground">Autorizadas</p>
              </div>
              <div className="text-center px-3 py-1.5 rounded-md bg-background border">
                <p className="text-lg font-bold text-destructive">{metrics.blocked || 0}</p>
                <p className="text-[10px] text-muted-foreground">Bloqueadas</p>
              </div>
              <div className="text-center px-3 py-1.5 rounded-md bg-background border">
                <p className="text-lg font-bold text-orange-600">{metrics.incidents || 0}</p>
                <p className="text-[10px] text-muted-foreground">Ocorrências</p>
              </div>
            </div>
          )}

          {/* Highlights */}
          {highlights.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Destaques
              </p>
              <ul className="text-xs space-y-0.5">
                {highlights.map((h: string, i: number) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-primary mt-0.5">•</span> {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risks */}
          {risks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-orange-500" /> Riscos
              </p>
              <ul className="text-xs space-y-0.5">
                {risks.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-orange-500 mt-0.5">⚠</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Lightbulb className="h-3 w-3 text-yellow-500" /> Recomendações
              </p>
              <ul className="text-xs space-y-0.5">
                {recommendations.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-yellow-500 mt-0.5">💡</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-4">
          <Sparkles className="h-6 w-6 mx-auto text-muted-foreground/40 mb-1" />
          <p className="text-xs text-muted-foreground">Resumo IA será gerado automaticamente</p>
          <Button variant="outline" size="sm" className="mt-2 text-xs h-7" onClick={() => refetch()}>
            Gerar agora
          </Button>
        </div>
      )}
    </div>
  );
}
