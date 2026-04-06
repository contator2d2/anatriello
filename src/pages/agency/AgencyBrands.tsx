import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAgencyAuth } from '@/contexts/AgencyAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Edit, Trash2, Tag, Loader2 } from 'lucide-react';

const getHeaders = () => {
  const t = localStorage.getItem('agency_auth_token');
  return t ? { Authorization: `Bearer ${t}` } : undefined;
};

const defaultForm = { name: '', cnpj: '', segment: '', contact_name: '', contact_phone: '', contact_email: '', notes: '' };

export default function AgencyBrands() {
  const { user, isLoading: isAuthLoading } = useAgencyAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['agency-brands'],
    queryFn: () => api<any[]>('/api/access-control/agency/brands', { headers: getHeaders() }),
    enabled: !!user && !isAuthLoading,
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editing) return api(`/api/access-control/agency/brands/${editing.id}`, { method: 'PUT', body: data, headers: getHeaders() });
      return api('/api/access-control/agency/brands', { method: 'POST', body: data, headers: getHeaders() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-brands'] });
      toast({ title: editing ? 'Marca atualizada' : 'Marca cadastrada' });
      closeDialog();
    },
    onError: (err: any) => toast({ title: 'Erro', description: err?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/access-control/agency/brands/${id}`, { method: 'DELETE', headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-brands'] });
      toast({ title: 'Marca removida' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err?.message, variant: 'destructive' }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(defaultForm); };

  const openEdit = (b: any) => {
    setEditing(b);
    setForm({
      name: b.name || '', cnpj: b.cnpj || '', segment: b.segment || '',
      contact_name: b.contact_name || '', contact_phone: b.contact_phone || '',
      contact_email: b.contact_email || '', notes: b.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(form);
  };

  const filtered = brands.filter((b: any) =>
    b.name?.toLowerCase().includes(search.toLowerCase()) || b.segment?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marcas</h1>
          <p className="text-muted-foreground">Cadastre as marcas que sua agência representa</p>
        </div>
        <Button onClick={() => { setForm(defaultForm); setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova Marca
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar marca..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma marca cadastrada</p>
            <Button className="mt-4" onClick={() => { setForm(defaultForm); setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Cadastrar Marca
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Marcas ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell>{b.segment || '—'}</TableCell>
                      <TableCell className="text-sm">{b.cnpj || '—'}</TableCell>
                      <TableCell className="text-sm">{b.contact_name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={b.active ? 'default' : 'secondary'}>
                          {b.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(b)}><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => {
                            if (confirm('Remover esta marca?')) deleteMutation.mutate(b.id);
                          }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar Marca' : 'Nova Marca'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome da Marca *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Nestlé" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" /></div>
              <div><Label>Segmento</Label><Input value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))} placeholder="Ex: Alimentos" /></div>
            </div>
            <div><Label>Nome do Contato</Label><Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></div>
              <div><Label>E-mail</Label><Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
