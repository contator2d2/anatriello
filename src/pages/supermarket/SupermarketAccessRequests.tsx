import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSupermarketAuth } from '@/contexts/SupermarketAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, X, Brain, Eye, ShieldCheck, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { UnitDocValidationConfig } from '@/components/access-control/UnitDocValidationConfig';
import { ValidationDetailDialog } from '@/components/access-control/ValidationDetailDialog';

const STATUS_LABEL: Record<string, { label: string; variant: any }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  analyzing: { label: 'Analisando', variant: 'secondary' },
  pre_approved: { label: 'Pré-aprovado IA', variant: 'default' },
  approved: { label: 'Aprovado', variant: 'default' },
  divergent: { label: 'Divergente', variant: 'destructive' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  failed: { label: 'Falha', variant: 'destructive' },
};

export default function SupermarketAccessRequests() {
  const { user } = useSupermarketAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const unitId = user?.supermarket_unit_id;

  const headers = useMemo(() => {
    const t = localStorage.getItem('supermarket_auth_token');
    const h: Record<string, string> = {};
    if (t) h.Authorization = `Bearer ${t}`;
    if (unitId) h['x-supermarket-unit-id'] = unitId;
    if (user?.email) h['x-supermarket-user-name'] = user.email;
    return h;
  }, [unitId, user]);

  const [tab, setTab] = useState<'requests' | 'config'>('requests');
  const [filter, setFilter] = useState<string>('all');
  const [reviewing, setReviewing] = useState<{ id: string; decision: 'approved' | 'rejected' } | null>(null);
  const [reason, setReason] = useState('');
  const [detailId, setDetailId] = useState<string | undefined>();

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ['portal-sm-validations', unitId],
    queryFn: () => api(`/api/promoter-validations/portal/supermarket?unit_id=${unitId}`, { headers }),
    enabled: !!unitId,
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'approved' | 'rejected'; reason?: string }) =>
      api(`/api/promoter-validations/portal/supermarket/${id}/review`, {
        method: 'POST', body: { decision, reason }, headers,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-sm-validations'] });
      setReviewing(null); setReason('');
      toast({ title: 'Decisão registrada' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const filtered = filter === 'all' ? items : items.filter((i: any) => i.status === filter);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Solicitações de Acesso
        </h1>
        <p className="text-sm text-muted-foreground">Aprove ou rejeite promotores que solicitaram acesso a este PDV.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'requests' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <CardTitle className="text-base">Histórico</CardTitle>
              <div className="flex flex-wrap gap-1">
                {['all', 'pending', 'pre_approved', 'divergent', 'approved', 'rejected'].map(s => (
                  <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
                    {s === 'all' ? 'Todas' : STATUS_LABEL[s]?.label || s}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma solicitação no filtro selecionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Promotor</TableHead>
                      <TableHead className="hidden md:table-cell">Agência</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score IA</TableHead>
                      <TableHead>Decisão</TableHead>
                      <TableHead className="hidden sm:table-cell">Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((v: any) => {
                      const st = STATUS_LABEL[v.status] || { label: v.status, variant: 'secondary' };
                      const decidedBy = v.override_status
                        ? <span className="inline-flex items-center gap-1 text-xs"><UserCheck className="h-3 w-3" /> Manual</span>
                        : v.auto_applied
                        ? <span className="inline-flex items-center gap-1 text-xs"><Brain className="h-3 w-3" /> IA</span>
                        : <span className="text-xs text-muted-foreground">—</span>;
                      const pending = ['pending', 'analyzing', 'pre_approved', 'divergent'].includes(v.status);
                      return (
                        <TableRow key={v.id}>
                          <TableCell>
                            <div className="font-medium">{v.promoter_name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{v.promoter_cpf}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{v.agency_name || '—'}</TableCell>
                          <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                          <TableCell>
                            <span className={`text-sm font-medium ${Number(v.score) >= 90 ? 'text-green-600' : Number(v.score) >= 70 ? 'text-amber-600' : 'text-destructive'}`}>
                              {v.score != null ? Number(v.score).toFixed(0) : '—'}
                            </span>
                          </TableCell>
                          <TableCell>{decidedBy}</TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {v.created_at ? format(new Date(v.created_at), 'dd/MM HH:mm') : ''}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setDetailId(v.id)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {pending && (
                                <>
                                  <Button size="sm" variant="outline" className="text-green-600" onClick={() => setReviewing({ id: v.id, decision: 'approved' })}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setReviewing({ id: v.id, decision: 'rejected' })}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'config' && unitId && (
        <Card>
          <CardHeader><CardTitle className="text-base">Validação de documentos deste PDV</CardTitle></CardHeader>
          <CardContent>
            <UnitDocValidationConfig unitId={unitId} />
          </CardContent>
        </Card>
      )}

      <Dialog open={!!reviewing} onOpenChange={(o) => { if (!o) { setReviewing(null); setReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewing?.decision === 'approved' ? 'Aprovar solicitação' : 'Rejeitar solicitação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Informe um motivo (opcional). Todas as decisões são auditadas.</p>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>Cancelar</Button>
            <Button
              variant={reviewing?.decision === 'approved' ? 'default' : 'destructive'}
              disabled={reviewMut.isPending}
              onClick={() => reviewing && reviewMut.mutate({ id: reviewing.id, decision: reviewing.decision, reason })}
            >
              {reviewMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ValidationDetailDialog
        validationId={detailId}
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(undefined); }}
      />
    </div>
  );
}
