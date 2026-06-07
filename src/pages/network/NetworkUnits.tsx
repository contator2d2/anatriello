import { useState } from 'react';
import { useNetworkUnits, useCreateInaugurationRequest, useNetworkInaugurationRequests } from '@/hooks/use-network-portal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function NetworkUnits() {
  const { data: units = [], isLoading } = useNetworkUnits();
  const { data: requests = [] } = useNetworkInaugurationRequests();
  const create = useCreateInaugurationRequest();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'units' | 'requests'>('units');
  const [form, setForm] = useState<any>({ name: '', cnpj: '', address: '', city: '', state: '', contact_name: '', contact_phone: '', contact_email: '', expected_opening: '', notes: '' });

  const submit = () => {
    if (!form.name.trim()) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    create.mutate(form, {
      onSuccess: () => {
        toast({ title: 'Solicitação enviada', description: 'A inauguração foi enviada para análise.' });
        setOpen(false); setTab('requests');
        setForm({ name: '', cnpj: '', address: '', city: '', state: '', contact_name: '', contact_phone: '', contact_email: '', expected_opening: '', notes: '' });
      },
      onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> PDVs da Rede</h1>
          <p className="text-sm text-muted-foreground">Visualize PDVs ativos e solicite inauguração de novos.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Solicitar novo PDV</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="units">PDVs ({units.length})</TabsTrigger>
          <TabsTrigger value="requests">Solicitações ({requests.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'units' && (
        <Card>
          <CardContent className="pt-4">
            {isLoading ? <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              : units.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum PDV cadastrado.</p>
              : <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead>PDV</TableHead><TableHead className="hidden md:table-cell">Cidade/UF</TableHead>
                  <TableHead>Status</TableHead><TableHead>Entradas hoje</TableHead>
                  <TableHead>Parceiros</TableHead><TableHead>Bloqueios</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {units.map(u => (
                    <TableRow key={u.id}>
                      <TableCell><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.cnpj || '—'}</div></TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{[u.city, u.state].filter(Boolean).join('/') || '—'}</TableCell>
                      <TableCell>{u.active ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                      <TableCell>{u.entries_today}</TableCell>
                      <TableCell>{u.partners_count}</TableCell>
                      <TableCell>{u.active_blocks > 0 ? <Badge variant="destructive">{u.active_blocks}</Badge> : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>}
          </CardContent>
        </Card>
      )}

      {tab === 'requests' && (
        <Card><CardContent className="pt-4">
          {requests.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma solicitação enviada.</p>
            : <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>PDV</TableHead><TableHead>Cidade/UF</TableHead>
                <TableHead>Previsão</TableHead><TableHead>Status</TableHead>
                <TableHead>Enviado em</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {requests.map(r => (
                  <TableRow key={r.id}>
                    <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.cnpj || '—'}</div></TableCell>
                    <TableCell className="text-sm">{[r.city, r.state].filter(Boolean).join('/') || '—'}</TableCell>
                    <TableCell className="text-sm">{r.expected_opening ? format(new Date(r.expected_opening), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell>{r.status === 'pending' ? <Badge variant="secondary">Pendente</Badge>
                      : r.status === 'approved' ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Aprovada</Badge>
                      : <Badge variant="destructive">Rejeitada</Badge>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>}
        </CardContent></Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Solicitar inauguração de PDV</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <Field label="Nome do PDV *"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="CNPJ"><Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} /></Field>
              <Field label="Previsão de abertura"><Input type="date" value={form.expected_opening} onChange={e => setForm({ ...form, expected_opening: e.target.value })} /></Field>
            </div>
            <Field label="Endereço"><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cidade"><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="UF"><Input maxLength={2} value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })} /></Field>
            </div>
            <Field label="Responsável"><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Telefone"><Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></Field>
              <Field label="E-mail"><Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></Field>
            </div>
            <Field label="Observações"><Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-sm font-medium block mb-1">{label}</label>{children}</div>;
}
