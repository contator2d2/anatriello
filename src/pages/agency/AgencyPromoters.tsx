import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAgencyAuth } from '@/contexts/AgencyAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Edit, Ban, CheckCircle, Users } from 'lucide-react';

const getHeaders = () => {
  const token = localStorage.getItem('agency_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export default function AgencyPromoters() {
  const { user } = useAgencyAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', cpf: '', phone: '', photo_url: '' });

  const { data: promoters = [], isLoading } = useQuery({
    queryKey: ['agency-promoters'],
    queryFn: () => api<any[]>('/api/access-control/agency-portal/promoters', { headers: getHeaders() }),
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editing) {
        return api(`/api/access-control/agency-portal/promoters/${editing.id}`, { method: 'PUT', body: data, headers: getHeaders() });
      }
      return api('/api/access-control/agency-portal/promoters', { method: 'POST', body: data, headers: getHeaders() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-promoters'] });
      toast({ title: editing ? 'Promotor atualizado' : 'Promotor cadastrado' });
      closeDialog();
    },
    onError: (err: any) => toast({ title: 'Erro', description: err?.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/api/access-control/agency-portal/promoters/${id}/status`, { method: 'PUT', body: { status }, headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-promoters'] });
      toast({ title: 'Status atualizado' });
    },
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({ name: '', cpf: '', phone: '', photo_url: '' }); };
  const openEdit = (p: any) => { setEditing(p); setForm({ name: p.name, cpf: p.cpf, phone: p.phone || '', photo_url: p.photo_url || '' }); setDialogOpen(true); };

  const filtered = promoters.filter((p: any) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) || p.cpf?.includes(search)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Promotores</h1>
          <p className="text-muted-foreground">Gerencie os promotores da sua agência</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Promotor
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum promotor encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: any) => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {p.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">CPF: {p.cpf}</p>
                      {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
                    </div>
                  </div>
                  <Badge variant={p.status === 'active' ? 'default' : p.status === 'blocked' ? 'destructive' : 'secondary'}>
                    {p.status === 'active' ? 'Ativo' : p.status === 'blocked' ? 'Bloqueado' : 'Inativo'}
                  </Badge>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                    <Edit className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  {p.status === 'active' ? (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => toggleMutation.mutate({ id: p.id, status: 'blocked' })}>
                      <Ban className="h-3 w-3 mr-1" /> Bloquear
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-primary" onClick={() => toggleMutation.mutate({ id: p.id, status: 'active' })}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Ativar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Promotor' : 'Novo Promotor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">CPF *</label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} disabled={!!editing} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.cpf || saveMutation.isPending}>
              {editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
