import { useState } from 'react';
import { useAdminInaugurationRequests, useReviewInaugurationRequest } from '@/hooks/use-network-portal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ClipboardPlus, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function InaugurationRequestsTab() {
  const { data = [], isLoading } = useAdminInaugurationRequests();
  const review = useReviewInaugurationRequest();
  const { toast } = useToast();
  const [selected, setSelected] = useState<any>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [notes, setNotes] = useState('');

  const submit = () => {
    if (!selected) return;
    review.mutate({ id: selected.id, decision, review_notes: notes }, {
      onSuccess: () => {
        toast({ title: decision === 'approved' ? 'Solicitação aprovada' : 'Solicitação rejeitada' });
        setSelected(null); setNotes('');
      },
      onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <ClipboardPlus className="h-5 w-5 text-primary" /> Solicitações de novo PDV
      </h2>
      <Card><CardContent className="pt-4">
        {isLoading ? <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : data.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma solicitação.</p>
          : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Rede</TableHead><TableHead>PDV</TableHead>
              <TableHead>Cidade/UF</TableHead><TableHead>Previsão</TableHead>
              <TableHead>Status</TableHead><TableHead>Enviado em</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>{data.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{r.network_name || '—'}</TableCell>
                <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.cnpj || '—'}</div></TableCell>
                <TableCell className="text-sm">{[r.city, r.state].filter(Boolean).join('/') || '—'}</TableCell>
                <TableCell className="text-sm">{r.expected_opening ? format(new Date(r.expected_opening), 'dd/MM/yyyy') : '—'}</TableCell>
                <TableCell>
                  {r.status === 'pending' ? <Badge variant="secondary">Pendente</Badge>
                    : r.status === 'approved' ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Aprovada</Badge>
                    : <Badge variant="destructive">Rejeitada</Badge>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                <TableCell>
                  {r.status === 'pending' && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => { setSelected(r); setDecision('approved'); setNotes(''); }}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setSelected(r); setDecision('rejected'); setNotes(''); }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>}
      </CardContent></Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{decision === 'approved' ? 'Aprovar solicitação' : 'Rejeitar solicitação'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <p><strong>PDV:</strong> {selected?.name}</p>
              <p><strong>Rede:</strong> {selected?.network_name}</p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Observações da análise</label>
              <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={decision === 'approved' ? 'Notas para a rede (opcional)' : 'Motivo da rejeição'} />
            </div>
            {decision === 'approved' && (
              <p className="text-xs text-muted-foreground">Ao aprovar, o PDV será criado como inativo até completarem os dados.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={submit} disabled={review.isPending}
              variant={decision === 'rejected' ? 'destructive' : 'default'}>
              {review.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {decision === 'approved' ? 'Aprovar' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
