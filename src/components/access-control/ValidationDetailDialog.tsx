import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2, XCircle, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  usePromoterValidation,
  useReviewValidation,
  useRunValidation,
  DOCUMENT_LABELS,
  PromoterValidation,
} from '@/hooks/use-promoter-validations';

const STATUS_META: Record<string, { label: string; variant: any; icon: any }> = {
  pending: { label: 'Pendente', variant: 'outline', icon: Loader2 },
  analyzing: { label: 'Analisando...', variant: 'outline', icon: Loader2 },
  pre_approved: { label: 'Pré-aprovado', variant: 'secondary', icon: CheckCircle2 },
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle2 },
  divergent: { label: 'Divergente', variant: 'destructive', icon: AlertTriangle },
  rejected: { label: 'Recusado', variant: 'destructive', icon: XCircle },
  failed: { label: 'Falhou', variant: 'destructive', icon: XCircle },
};

export function ValidationBadge({ status }: { status: PromoterValidation['status'] }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className="gap-1">
      <Icon className={`h-3 w-3 ${status === 'analyzing' ? 'animate-spin' : ''}`} />
      {meta.label}
    </Badge>
  );
}

export function ValidationDetailDialog({
  validationId,
  open,
  onOpenChange,
}: {
  validationId?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: v, isLoading } = usePromoterValidation(validationId);
  const reviewMut = useReviewValidation();
  const runMut = useRunValidation();
  const { toast } = useToast();
  const [reason, setReason] = useState('');

  const handleReview = async (decision: 'approved' | 'rejected') => {
    if (!v) return;
    try {
      await reviewMut.mutateAsync({ id: v.id, decision, reason });
      toast({ title: decision === 'approved' ? 'Aprovado' : 'Recusado' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleRerun = async () => {
    if (!v) return;
    try {
      await runMut.mutateAsync({
        agency_promoter_id: v.agency_promoter_id,
        rede_id: v.rede_id || undefined,
        supermarket_unit_id: v.supermarket_unit_id || undefined,
      });
      toast({ title: 'Nova análise iniciada' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            Análise de Documentos
            {v && <ValidationBadge status={v.status} />}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !v ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Promotor</p>
                <p className="font-medium">{v.promoter_name}</p>
                <p className="text-xs">{v.promoter_cpf}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Score IA</p>
                <p className="text-2xl font-bold">
                  {Number(v.score).toFixed(0)}
                  <span className="text-sm font-normal text-muted-foreground">/100</span>
                </p>
              </div>
            </div>

            {v.auto_applied && (
              <div className="rounded-md bg-primary/10 border border-primary/20 p-3 text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Aprovação automática aplicada
              </div>
            )}

            {v.error_message && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm">
                <p className="font-medium">Erro:</p>
                <p>{v.error_message}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold mb-2">Documentos Analisados ({v.documents_analyzed?.length || 0})</p>
              <div className="space-y-1">
                {(v.documents_analyzed || []).map((d: any) => (
                  <div key={d.id} className="text-xs px-2 py-1 rounded bg-muted">
                    {DOCUMENT_LABELS[d.category] || d.category} — {d.title || 'sem título'}
                  </div>
                ))}
              </div>
            </div>

            {v.divergences && v.divergences.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Divergências
                </p>
                <div className="space-y-2">
                  {v.divergences.map((d, i) => (
                    <div key={i} className="border rounded p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{d.field}</span>
                        {d.severity && <Badge variant={d.severity === 'critical' ? 'destructive' : 'outline'} className="text-xs">{d.severity}</Badge>}
                      </div>
                      {d.message && <p className="text-xs text-muted-foreground mt-1">{d.message}</p>}
                      {d.values && (
                        <div className="text-xs mt-1 space-y-0.5">
                          {d.values.map((val, idx) => (
                            <div key={idx}>
                              <span className="text-muted-foreground">{d.sources?.[idx] || `fonte ${idx + 1}`}:</span>{' '}
                              <span className="font-mono">{val}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {v.extracted_data && Object.keys(v.extracted_data).length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-semibold">Dados extraídos</summary>
                <pre className="mt-2 bg-muted p-2 rounded overflow-auto">{JSON.stringify(v.extracted_data, null, 2)}</pre>
              </details>
            )}

            {(v.status === 'divergent' || v.status === 'pre_approved') && !v.override_status && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-semibold">Revisão Manual</p>
                <textarea
                  className="w-full text-sm border rounded p-2 min-h-[60px]"
                  placeholder="Motivo (opcional)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button onClick={() => handleReview('approved')} className="flex-1" disabled={reviewMut.isPending}>
                    Aprovar mesmo assim
                  </Button>
                  <Button onClick={() => handleReview('rejected')} variant="destructive" className="flex-1" disabled={reviewMut.isPending}>
                    Recusar
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={handleRerun} disabled={runMut.isPending}>
                <RotateCw className="h-4 w-4 mr-2" /> Re-analisar
              </Button>
              <p className="text-xs text-muted-foreground self-center">
                {v.ai_provider}/{v.ai_model} · {v.validated_at ? new Date(v.validated_at).toLocaleString('pt-BR') : '—'}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
