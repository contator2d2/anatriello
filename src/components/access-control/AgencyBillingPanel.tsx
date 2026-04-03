import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, FileText, AlertTriangle, CheckCircle, Ban, Plus, Receipt, Users } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', overdue: 'Inadimplente', cancelled: 'Cancelado', blocked: 'Bloqueado',
  pending: 'Pendente', paid: 'Pago',
};
const STATUS_VARIANTS: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  active: 'default', paid: 'default', overdue: 'destructive', blocked: 'destructive',
  cancelled: 'secondary', pending: 'outline',
};

export function AgencyBillingPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['agency-subscriptions'],
    queryFn: () => api<any[]>('/api/access-control/billing/subscriptions'),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['agency-invoices'],
    queryFn: () => api<any[]>('/api/access-control/billing/invoices'),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: () => api<any[]>('/api/access-control/billing/plans'),
  });

  const [planDialog, setPlanDialog] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', price_per_promoter: '', max_promoters: '' });
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState('');

  const createPlanMutation = useMutation({
    mutationFn: (data: any) => api('/api/access-control/billing/plans', { method: 'POST', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billing-plans'] }); toast({ title: 'Plano criado' }); setPlanDialog(false); },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api(`/api/access-control/billing/invoices/${id}/pay`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-invoices'] }); qc.invalidateQueries({ queryKey: ['agency-subscriptions'] }); toast({ title: 'Pagamento registrado' }); },
  });

  const toggleBlockMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api(`/api/access-control/billing/subscriptions/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-subscriptions'] }); toast({ title: 'Status atualizado' }); },
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: (agencyId: string) => api('/api/access-control/billing/invoices/generate', { method: 'POST', body: { agency_id: agencyId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-invoices'] }); toast({ title: 'Fatura gerada' }); setInvoiceDialog(false); },
  });

  const totalRevenue = invoices.filter((i: any) => i.status === 'paid').reduce((sum: number, i: any) => sum + Number(i.final_amount || 0), 0);
  const overdueCount = subscriptions.filter((s: any) => s.status === 'overdue' || s.status === 'blocked').length;
  const pendingAmount = invoices.filter((i: any) => i.status === 'pending' || i.status === 'overdue').reduce((sum: number, i: any) => sum + Number(i.final_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Receita Recebida" value={`R$ ${totalRevenue.toFixed(2)}`} icon={<DollarSign className="h-5 w-5 text-primary" />} />
        <StatsCard title="A Receber" value={`R$ ${pendingAmount.toFixed(2)}`} icon={<Receipt className="h-5 w-5 text-primary" />} />
        <StatsCard title="Agências Ativas" value={subscriptions.filter((s: any) => s.status === 'active').length} icon={<Users className="h-5 w-5 text-primary" />} />
        <StatsCard title="Inadimplentes" value={overdueCount} icon={<AlertTriangle className="h-5 w-5 text-destructive" />} />
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
          <TabsTrigger value="invoices">Faturas</TabsTrigger>
          <TabsTrigger value="plans">Planos</TabsTrigger>
        </TabsList>

        {/* Assinaturas */}
        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setInvoiceDialog(true)}>
              <FileText className="h-4 w-4 mr-1" /> Gerar Fatura
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agência</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Promotores</TableHead>
                    <TableHead>Valor Mensal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Auto-Bloqueio</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma assinatura</TableCell></TableRow>
                  ) : subscriptions.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.agency_name}</TableCell>
                      <TableCell>{s.plan_name || '—'}</TableCell>
                      <TableCell>{s.promoter_count}</TableCell>
                      <TableCell>R$ {Number(s.amount_due || 0).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANTS[s.status] || 'secondary'}>{STATUS_LABELS[s.status] || s.status}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={s.auto_block_enabled ? 'default' : 'outline'}>
                          {s.auto_block_enabled ? `${s.block_after_days}d` : 'Desligado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(s.status === 'overdue') && (
                            <Button size="sm" variant="destructive" onClick={() => toggleBlockMutation.mutate({ id: s.id, action: 'block' })}>
                              <Ban className="h-3 w-3 mr-1" /> Bloquear
                            </Button>
                          )}
                          {s.status === 'blocked' && (
                            <Button size="sm" variant="outline" onClick={() => toggleBlockMutation.mutate({ id: s.id, action: 'unblock' })}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Desbloquear
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Faturas */}
        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agência</TableHead>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead>Promotores</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma fatura</TableCell></TableRow>
                  ) : invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.agency_name}</TableCell>
                      <TableCell>{inv.reference_month ? format(new Date(inv.reference_month), 'MM/yyyy') : '—'}</TableCell>
                      <TableCell>{inv.promoter_count}</TableCell>
                      <TableCell>R$ {Number(inv.final_amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{inv.due_date ? format(new Date(inv.due_date), 'dd/MM/yyyy') : '—'}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANTS[inv.status] || 'secondary'}>{STATUS_LABELS[inv.status] || inv.status}</Badge></TableCell>
                      <TableCell>
                        {(inv.status === 'pending' || inv.status === 'overdue') && (
                          <Button size="sm" variant="outline" onClick={() => markPaidMutation.mutate(inv.id)}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Pago
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Planos */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setPlanDialog(true)}><Plus className="h-4 w-4 mr-1" /> Novo Plano</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p: any) => (
              <Card key={p.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-bold text-primary">R$ {Number(p.price_per_promoter || 0).toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/promotor</span></p>
                  <p className="text-sm text-muted-foreground">
                    {p.max_promoters ? `Até ${p.max_promoters} promotores` : 'Promotores ilimitados'}
                  </p>
                  <Badge variant={p.active ? 'default' : 'secondary'}>{p.active ? 'Ativo' : 'Inativo'}</Badge>
                </CardContent>
              </Card>
            ))}
            {plans.length === 0 && <p className="text-muted-foreground col-span-3 text-center py-8">Nenhum plano cadastrado</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog novo plano */}
      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Plano</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Plano *</label>
              <Input value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Básico" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Preço por Promotor (R$) *</label>
              <Input type="number" step="0.01" value={planForm.price_per_promoter} onChange={e => setPlanForm(f => ({ ...f, price_per_promoter: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Máx. Promotores (vazio = ilimitado)</label>
              <Input type="number" value={planForm.max_promoters} onChange={e => setPlanForm(f => ({ ...f, max_promoters: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog(false)}>Cancelar</Button>
            <Button onClick={() => createPlanMutation.mutate({
              name: planForm.name,
              price_per_promoter: parseFloat(planForm.price_per_promoter) || 0,
              max_promoters: planForm.max_promoters ? parseInt(planForm.max_promoters) : null,
            })} disabled={!planForm.name || !planForm.price_per_promoter}>
              Criar Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog gerar fatura */}
      <Dialog open={invoiceDialog} onOpenChange={setInvoiceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar Fatura</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecione a agência para gerar a fatura do mês atual com base no número de promotores ativos.</p>
            <Select value={selectedAgency} onValueChange={setSelectedAgency}>
              <SelectTrigger><SelectValue placeholder="Selecione a agência..." /></SelectTrigger>
              <SelectContent>
                {subscriptions.map((s: any) => (
                  <SelectItem key={s.agency_id} value={s.agency_id}>{s.agency_name} ({s.promoter_count} promotores)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialog(false)}>Cancelar</Button>
            <Button onClick={() => generateInvoiceMutation.mutate(selectedAgency)} disabled={!selectedAgency || generateInvoiceMutation.isPending}>
              Gerar Fatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
