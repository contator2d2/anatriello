import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Plus, Send, AlertTriangle, CheckCircle2, Clock, Trash2, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useAvailableNetworks, useNetworkUnitsForAgency, useAvailableBrands,
  useCheckConflict, useCreateAccessRequest, useAgencyAccessRequests,
  useAgencyConflictNotifications, useAckConflictNotification,
} from '@/hooks/use-agency-network-requests';

type Pair = { supermarket_unit_id: string; brand_id: string };

export default function AgencyNetworkRequest() {
  const { toast } = useToast();
  const { data: requests = [] } = useAgencyAccessRequests();
  const { data: notifs = [] } = useAgencyConflictNotifications();
  const ackMut = useAckConflictNotification();

  const [open, setOpen] = useState(false);
  const [networkId, setNetworkId] = useState('');
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<Pair[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);

  const { data: networks = [] } = useAvailableNetworks();
  const { data: units = [] } = useNetworkUnitsForAgency(networkId);
  const { data: brands = [] } = useAvailableBrands();
  const checkConflict = useCheckConflict();
  const createReq = useCreateAccessRequest();

  const conflictMap = useMemo(() => {
    const m = new Map<string, any>();
    conflicts.forEach((c) => m.set(`${c.supermarket_unit_id}|${c.brand_id}`, c));
    return m;
  }, [conflicts]);

  useEffect(() => {
    const valid = items.filter((i) => i.supermarket_unit_id && i.brand_id);
    if (!valid.length) { setConflicts([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await checkConflict.mutateAsync(valid);
        setConflicts(r.conflicts);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const addRow = () => setItems((p) => [...p, { supermarket_unit_id: '', brand_id: '' }]);
  const updRow = (i: number, k: keyof Pair, v: string) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const delRow = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    const valid = items.filter((i) => i.supermarket_unit_id && i.brand_id);
    if (!networkId) return toast({ title: 'Selecione a rede', variant: 'destructive' });
    if (!valid.length) return toast({ title: 'Adicione ao menos um par PDV + Marca', variant: 'destructive' });
    try {
      const r: any = await createReq.mutateAsync({ network_id: networkId, message, items: valid });
      toast({
        title: r.has_conflict ? 'Solicitação criada com conflitos' : 'Solicitação enviada',
        description: r.has_conflict ? 'A rede será notificada para resolver o conflito de marca.' : 'A rede receberá para aprovar.',
      });
      setOpen(false); setItems([]); setMessage(''); setNetworkId('');
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    }
  };

  const pendingNotifs = notifs.filter((n) => !n.acknowledged);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Solicitações de Acesso à Rede</h1>
          <p className="text-muted-foreground text-sm">
            Solicite à rede o direito de atender determinadas marcas em PDVs específicos.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Solicitação
        </Button>
      </div>

      {pendingNotifs.length > 0 && (
        <Alert variant="destructive">
          <Bell className="h-4 w-4" />
          <AlertTitle>Notificações de conflito ({pendingNotifs.length})</AlertTitle>
          <AlertDescription>
            <div className="space-y-2 mt-2">
              {pendingNotifs.slice(0, 5).map((n) => (
                <div key={n.id} className="flex items-start justify-between gap-2 bg-background/50 rounded p-2">
                  <div className="text-sm">
                    <strong>{n.unit_name}</strong> / {n.brand_name}
                    {n.other_agency_name && <> — {n.other_agency_name}</>}
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => ackMut.mutate(n.id)}>OK</Button>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovadas</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
        </TabsList>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((t) => (
          <TabsContent key={t} value={t} className="space-y-2">
            {requests
              .filter((r) => t === 'all' || r.status === t)
              .map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{r.network_name}</span>
                        {r.has_conflict && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> {r.conflict_items} conflito(s)
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {r.items_count} item(ns) • {new Date(r.created_at).toLocaleString('pt-BR')}
                      </p>
                      {r.review_notes && (
                        <p className="text-xs text-muted-foreground italic">"{r.review_notes}"</p>
                      )}
                    </div>
                    <Badge
                      variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}
                      className="gap-1"
                    >
                      {r.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                      {r.status === 'pending' && <Clock className="h-3 w-3" />}
                      {r.status === 'rejected' && <AlertTriangle className="h-3 w-3" />}
                      {r.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            {requests.filter((r) => t === 'all' || r.status === t).length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Nenhuma solicitação.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Solicitação de Acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rede *</label>
              <Select value={networkId} onValueChange={setNetworkId}>
                <SelectTrigger><SelectValue placeholder="Selecione a rede..." /></SelectTrigger>
                <SelectContent>
                  {networks.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.name} ({n.units_count} PDVs)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">PDVs + Marcas que pretende atender *</label>
                <Button size="sm" variant="outline" onClick={addRow} disabled={!networkId}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {networkId ? 'Adicione pelo menos um PDV + Marca.' : 'Selecione uma rede primeiro.'}
                </p>
              )}
              <div className="space-y-2">
                {items.map((it, i) => {
                  const key = `${it.supermarket_unit_id}|${it.brand_id}`;
                  const conf = conflictMap.get(key);
                  return (
                    <div key={i} className={`rounded-lg border p-3 space-y-2 ${conf ? 'border-destructive bg-destructive/5' : ''}`}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Select value={it.supermarket_unit_id} onValueChange={(v) => updRow(i, 'supermarket_unit_id', v)}>
                          <SelectTrigger><SelectValue placeholder="PDV..." /></SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name} {u.city ? `— ${u.city}/${u.state}` : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Select value={it.brand_id} onValueChange={(v) => updRow(i, 'brand_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Marca..." /></SelectTrigger>
                            <SelectContent>
                              {brands.map((b) => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="icon" variant="ghost" onClick={() => delRow(i)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {conf && (
                        <div className="flex items-center gap-2 text-xs text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Conflito: marca já atendida por <strong>{conf.conflict_with_agency_name}</strong> neste PDV.
                          A rede decidirá.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mensagem para a rede</label>
              <Textarea
                rows={3}
                placeholder="Contexto, contrato com a marca, etc."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={createReq.isPending}>
              <Send className="h-4 w-4 mr-2" /> Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
