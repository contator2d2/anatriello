import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, Clock, Eye, ShieldQuestion } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useNetworkAccessRequests, useNetworkAccessRequestDetail, useReviewAccessRequest,
} from '@/hooks/use-agency-network-requests';

export default function NetworkAccessRequests() {
  const { toast } = useToast();
  const { data: list = [] } = useNetworkAccessRequests();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: detail } = useNetworkAccessRequestDetail(openId || undefined);
  const review = useReviewAccessRequest();

  const [reviewNotes, setReviewNotes] = useState('');
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'rejected' | 'override'>>({});

  const handleDecide = async (decision: 'approved' | 'rejected') => {
    if (!openId) return;
    try {
      await review.mutateAsync({ id: openId, decision, review_notes: reviewNotes, item_decisions: decisions });
      toast({ title: decision === 'approved' ? 'Solicitação aprovada' : 'Solicitação rejeitada' });
      setOpenId(null); setReviewNotes(''); setDecisions({});
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solicitações de Acesso de Agências</h1>
        <p className="text-muted-foreground text-sm">
          Aprove ou rejeite agências que querem atender marcas em seus PDVs. Resolva conflitos de marca.
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovadas</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
        {(['pending', 'approved', 'rejected', 'all'] as const).map((t) => (
          <TabsContent key={t} value={t} className="space-y-2">
            {list.filter((r) => t === 'all' || r.status === t).map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{r.agency_name}</span>
                      <Badge variant="outline" className="text-xs">{r.agency_cnpj}</Badge>
                      {r.has_conflict && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> {r.conflict_items} conflito(s)
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.items_count} item(ns) • {new Date(r.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'} className="gap-1">
                      {r.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                      {r.status === 'pending' && <Clock className="h-3 w-3" />}
                      {r.status === 'rejected' && <AlertTriangle className="h-3 w-3" />}
                      {r.status}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => { setOpenId(r.id); setReviewNotes(''); setDecisions({}); }}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Revisar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {list.filter((r) => t === 'all' || r.status === t).length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma solicitação.</CardContent></Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar Solicitação — {detail?.request?.agency_name}</DialogTitle>
          </DialogHeader>
          {detail?.request?.message && (
            <p className="text-sm bg-muted/50 rounded p-2 italic">"{detail.request.message}"</p>
          )}
          {detail?.request?.has_conflict && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Conflitos de marca detectados</AlertTitle>
              <AlertDescription>
                Para cada item em conflito escolha: <strong>Aprovar e transferir</strong> (revoga a agência atual)
                ou <strong>Rejeitar</strong> (mantém a agência atual).
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            {detail?.items.map((it) => {
              const cur = decisions[it.id!] || (it.conflict_with_agency_id ? 'rejected' : 'approved');
              return (
                <div key={it.id} className={`rounded-lg border p-3 ${it.conflict_with_agency_id ? 'border-destructive bg-destructive/5' : ''}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm">
                      <strong>{it.unit_name}</strong> · {it.brand_name}
                      {it.conflict_with_agency_id && (
                        <div className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                          <ShieldQuestion className="h-3 w-3" /> Já atendida por <strong>{it.conflict_agency_name}</strong>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {it.conflict_with_agency_id ? (
                        <>
                          <Button size="sm" variant={cur === 'override' ? 'default' : 'outline'} onClick={() => setDecisions((p) => ({ ...p, [it.id!]: 'override' }))}>
                            Transferir
                          </Button>
                          <Button size="sm" variant={cur === 'rejected' ? 'destructive' : 'outline'} onClick={() => setDecisions((p) => ({ ...p, [it.id!]: 'rejected' }))}>
                            Rejeitar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant={cur === 'approved' ? 'default' : 'outline'} onClick={() => setDecisions((p) => ({ ...p, [it.id!]: 'approved' }))}>
                            Aprovar
                          </Button>
                          <Button size="sm" variant={cur === 'rejected' ? 'destructive' : 'outline'} onClick={() => setDecisions((p) => ({ ...p, [it.id!]: 'rejected' }))}>
                            Rejeitar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Observações da revisão</label>
            <Textarea rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => handleDecide('rejected')} disabled={review.isPending}>
              Rejeitar Tudo
            </Button>
            <Button onClick={() => handleDecide('approved')} disabled={review.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
