import { useMemo, useState } from 'react';
import { useSupermarketAuth } from '@/contexts/SupermarketAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldCheck, Ban, Undo2, Info, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  useAuthorizedPromoters,
  usePdvBlocks,
  useBlockPromoter,
  useUnblockPromoter,
  type AuthorizedPromoter,
  type PdvPromoterBlock,
} from '@/hooks/use-pdv-blocks';

export default function SupermarketAccessRequests() {
  const { user } = useSupermarketAuth();
  const { toast } = useToast();
  const unitId = user?.supermarket_unit_id;

  const extraHeaders = useMemo(() => {
    const h: Record<string, string> = {};
    if (user?.email) h['x-supermarket-user-name'] = user.email;
    return h;
  }, [user?.email]);

  const [tab, setTab] = useState<'authorized' | 'blocks'>('authorized');
  const [search, setSearch] = useState('');
  const [blocking, setBlocking] = useState<AuthorizedPromoter | null>(null);
  const [unblocking, setUnblocking] = useState<PdvPromoterBlock | null>(null);
  const [reason, setReason] = useState('');

  const { data: promoters = [], isLoading: loadingPromoters } = useAuthorizedPromoters(unitId, extraHeaders);
  const { data: blocks = [], isLoading: loadingBlocks } = usePdvBlocks({ unitId }, extraHeaders);

  const blockMut = useBlockPromoter(extraHeaders);
  const unblockMut = useUnblockPromoter(extraHeaders);

  const filteredPromoters = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promoters;
    return promoters.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.cpf || '').toLowerCase().includes(q) ||
      (p.agency_name || '').toLowerCase().includes(q)
    );
  }, [promoters, search]);

  const handleBlock = () => {
    if (!blocking || !reason.trim()) {
      toast({ title: 'Motivo obrigatório', variant: 'destructive' });
      return;
    }
    blockMut.mutate(
      { agency_promoter_id: blocking.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast({ title: 'Promotor bloqueado neste PDV', description: 'Agência e rede foram notificadas.' });
          setBlocking(null); setReason('');
        },
        onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
      }
    );
  };

  const handleUnblock = () => {
    if (!unblocking) return;
    unblockMut.mutate(
      { id: unblocking.id, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast({ title: 'Promotor desbloqueado', description: 'Agência e rede foram notificadas.' });
          setUnblocking(null); setReason('');
        },
        onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Acessos do PDV
        </h1>
        <p className="text-sm text-muted-foreground">
          Promotores aprovados pela rede. Você pode bloquear individualmente neste PDV se houver problema.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como funciona</AlertTitle>
        <AlertDescription className="text-sm">
          A documentação dos promotores é validada e aprovada pela <strong>rede</strong>. Este PDV
          recebe a lista de promotores autorizados pelas agências contratadas e pode bloquear ou
          liberar individualmente. Toda ação é auditada e <strong>notifica a agência e a rede</strong>.
        </AlertDescription>
      </Alert>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="authorized">Promotores autorizados</TabsTrigger>
          <TabsTrigger value="blocks">Bloqueios ({blocks.filter(b => b.active).length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'authorized' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <CardTitle className="text-base">Promotores aprovados pela rede</CardTitle>
              <div className="relative w-full sm:w-72">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF ou agência..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPromoters ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : filteredPromoters.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum promotor autorizado para este PDV.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Promotor</TableHead>
                      <TableHead className="hidden md:table-cell">Agência</TableHead>
                      <TableHead>Status no PDV</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPromoters.map((p) => {
                      const blocked = !!p.active_block_id;
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.cpf}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{p.agency_name || '—'}</TableCell>
                          <TableCell>
                            {blocked ? (
                              <div className="flex flex-col">
                                <Badge variant="destructive" className="w-fit">Bloqueado neste PDV</Badge>
                                {p.active_block_reason && (
                                  <span className="text-xs text-muted-foreground mt-1">{p.active_block_reason}</span>
                                )}
                              </div>
                            ) : (
                              <Badge variant="default" className="w-fit bg-emerald-600 hover:bg-emerald-600">
                                Aprovado pela rede
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {blocked ? (
                              <Button
                                size="sm" variant="outline"
                                onClick={() => {
                                  const b = blocks.find(x => x.id === p.active_block_id);
                                  if (b) setUnblocking(b);
                                }}
                              >
                                <Undo2 className="h-4 w-4 mr-1" /> Desbloquear
                              </Button>
                            ) : (
                              <Button
                                size="sm" variant="outline" className="text-destructive"
                                onClick={() => setBlocking(p)}
                              >
                                <Ban className="h-4 w-4 mr-1" /> Bloquear neste PDV
                              </Button>
                            )}
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

      {tab === 'blocks' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Histórico de bloqueios</CardTitle></CardHeader>
          <CardContent>
            {loadingBlocks ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : blocks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum bloqueio registrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Promotor</TableHead>
                      <TableHead className="hidden md:table-cell">Agência</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Motivo</TableHead>
                      <TableHead>Bloqueado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blocks.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="font-medium">{b.promoter_name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{b.promoter_cpf}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{b.agency_name || '—'}</TableCell>
                        <TableCell>
                          {b.active
                            ? <Badge variant="destructive">Ativo</Badge>
                            : <Badge variant="secondary">Removido</Badge>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs">{b.reason || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {b.blocked_at ? format(new Date(b.blocked_at), 'dd/MM/yy HH:mm') : ''}
                          {b.blocked_by_name && <div>por {b.blocked_by_name}</div>}
                        </TableCell>
                        <TableCell className="text-right">
                          {b.active && (
                            <Button size="sm" variant="outline" onClick={() => setUnblocking(b)}>
                              <Undo2 className="h-4 w-4 mr-1" /> Desbloquear
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Block dialog */}
      <Dialog open={!!blocking} onOpenChange={(o) => { if (!o) { setBlocking(null); setReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear promotor neste PDV</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <div className="font-medium">{blocking?.name}</div>
              <div className="text-muted-foreground text-xs">{blocking?.cpf} · {blocking?.agency_name}</div>
            </div>
            <div>
              <label className="text-sm font-medium">Motivo do bloqueio *</label>
              <Textarea
                rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: comportamento inadequado, ausências recorrentes, etc."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A agência e a rede serão notificadas automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlocking(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={blockMut.isPending || !reason.trim()} onClick={handleBlock}>
              {blockMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar bloqueio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unblock dialog */}
      <Dialog open={!!unblocking} onOpenChange={(o) => { if (!o) { setUnblocking(null); setReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desbloquear promotor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <div className="font-medium">{unblocking?.promoter_name}</div>
              <div className="text-muted-foreground text-xs">
                {unblocking?.promoter_cpf} · {unblocking?.agency_name}
              </div>
              {unblocking?.reason && (
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">Motivo original: </span>{unblocking.reason}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Motivo do desbloqueio (opcional)</label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnblocking(null)}>Cancelar</Button>
            <Button disabled={unblockMut.isPending} onClick={handleUnblock}>
              {unblockMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar desbloqueio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
