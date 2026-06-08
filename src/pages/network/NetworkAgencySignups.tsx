import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Building2, Check, X, Loader2 } from 'lucide-react';

type SignupReq = {
  id: string;
  company_name: string;
  cnpj?: string;
  responsible_name: string;
  responsible_phone?: string;
  responsible_email: string;
  city?: string;
  state?: string;
  message?: string;
  status: string;
  review_notes?: string;
  created_at: string;
};

export default function NetworkAgencySignups() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [items, setItems] = useState<SignupReq[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SignupReq | null>(null);
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api<SignupReq[]>(`/api/network-portal/agency-signups?status=${tab}`);
      setItems(r || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tab]);

  const approve = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await api(`/api/network-portal/agency-signups/${selected.id}/approve`, {
        method: 'POST', body: { notes },
      });
      toast({ title: 'Agência aprovada' });
      setSelected(null); setNotes(''); load();
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  const reject = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await api(`/api/network-portal/agency-signups/${selected.id}/reject`, {
        method: 'POST', body: { notes },
      });
      toast({ title: 'Solicitação rejeitada' });
      setSelected(null); setNotes(''); load();
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cadastros de agências</h1>
        <p className="text-muted-foreground text-sm">Aprove ou rejeite agências que solicitaram acesso à sua rede.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovadas</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {loading && <div className="text-center text-muted-foreground py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></div>}
          {!loading && items.length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum registro.</CardContent></Card>
          )}
          {items.map((it) => (
            <Card key={it.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{it.company_name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{it.cnpj || 'sem CNPJ'} · {it.city}/{it.state}</p>
                    </div>
                  </div>
                  <Badge variant={it.status === 'pending' ? 'secondary' : it.status === 'approved' ? 'default' : 'destructive'}>
                    {it.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div><b>Responsável:</b> {it.responsible_name} · {it.responsible_email} · {it.responsible_phone}</div>
                {it.message && <p className="text-muted-foreground italic">"{it.message}"</p>}
                {it.review_notes && <p className="text-xs"><b>Notas:</b> {it.review_notes}</p>}
                {it.status === 'pending' && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => { setSelected(it); setNotes(''); }}>
                      <Check className="h-4 w-4 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setSelected({ ...it, status: 'reject' } as any); setNotes(''); }}>
                      <X className="h-4 w-4 mr-1" /> Rejeitar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected?.status === 'reject' ? 'Rejeitar agência' : 'Aprovar agência'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">{selected?.company_name}</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações (opcional)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button
              onClick={selected?.status === 'reject' ? reject : approve}
              disabled={actionLoading}
              variant={selected?.status === 'reject' ? 'destructive' : 'default'}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
