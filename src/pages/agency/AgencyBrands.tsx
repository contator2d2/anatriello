import { useEffect, useMemo, useState } from 'react';
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
import { Plus, Search, Edit, Trash2, Tag, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCnpj, isValidCnpj, onlyDigits } from '@/lib/br-utils';

const getHeaders = () => {
  const t = localStorage.getItem('agency_auth_token');
  return t ? { Authorization: `Bearer ${t}` } : undefined;
};

const defaultForm = { name: '', cnpj: '', segment: '', contact_name: '', contact_phone: '', contact_email: '', notes: '', razao_social: '', street: '', number: '', neighborhood: '', city: '', zip: '' };

interface Suggestion {
  id: string;
  name: string;
  cnpj: string | null;
  cnpj_digits: string | null;
  segment: string | null;
  agency_id: string;
  agency_name: string;
  is_own: boolean;
}

export default function AgencyBrands() {
  const { user, isLoading: isAuthLoading } = useAgencyAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(defaultForm);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [nameFocus, setNameFocus] = useState(false);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['agency-brands'],
    queryFn: () => api<any[]>('/api/access-control/agency/brands', { headers: getHeaders() }),
    enabled: !!user && !isAuthLoading,
  });

  // Debounced suggestions by name or CNPJ
  useEffect(() => {
    const q = form.name.trim();
    const cnpjDigits = onlyDigits(form.cnpj);
    if (!dialogOpen) return;
    if (q.length < 2 && cnpjDigits.length < 8) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (cnpjDigits.length >= 8) params.set('cnpj', cnpjDigits);
        else params.set('q', q);
        const r = await api<Suggestion[]>(`/api/access-control/agency/brands/suggestions?${params}`, { headers: getHeaders() });
        setSuggestions(Array.isArray(r) ? r.filter(s => !editing || s.id !== editing.id) : []);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [form.name, form.cnpj, dialogOpen, editing]);

  const cnpjDigits = onlyDigits(form.cnpj);
  const cnpjValid = cnpjDigits.length === 14 && isValidCnpj(cnpjDigits);
  const cnpjError = form.cnpj && cnpjDigits.length === 14 && !cnpjValid;

  const conflict = useMemo(
    () => suggestions.find(s => s.cnpj_digits && s.cnpj_digits === cnpjDigits && (!editing || s.id !== editing.id)),
    [suggestions, cnpjDigits, editing]
  );

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
    onError: (err: any) => toast({ title: 'Erro', description: err?.message || 'Falha ao salvar', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/access-control/agency/brands/${id}`, { method: 'DELETE', headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-brands'] });
      toast({ title: 'Marca removida' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err?.message, variant: 'destructive' }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(defaultForm); setSuggestions([]); };

  const openEdit = (b: any) => {
    setEditing(b);
    setForm({
      name: b.name || '', cnpj: b.cnpj ? formatCnpj(b.cnpj) : '', segment: b.segment || '',
      contact_name: b.contact_name || '', contact_phone: b.contact_phone || '',
      contact_email: b.contact_email || '', notes: b.notes || '',
      razao_social: b.razao_social || '', street: b.street || '',
      number: b.number || '', neighborhood: b.neighborhood || '',
      city: b.city || '', zip: b.zip || '',
    });
    setDialogOpen(true);
  };

  const applySuggestion = (s: Suggestion) => {
    // Quando é uma marca da própria agência, abre como edição; caso contrário só sugere o nome canônico
    if (s.is_own) {
      const own = (brands as any[]).find(b => b.id === s.id);
      if (own) { openEdit(own); return; }
    }
    setForm(f => ({ ...f, name: s.name, cnpj: s.cnpj ? formatCnpj(s.cnpj) : f.cnpj }));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    if (!cnpjValid) {
      toast({ title: 'CNPJ obrigatório e válido', variant: 'destructive' });
      return;
    }
    if (conflict && !conflict.is_own) {
      toast({
        title: 'CNPJ já cadastrado',
        description: `Marca "${conflict.name}" pertence à agência ${conflict.agency_name}.`,
        variant: 'destructive',
      });
      return;
    }
    saveMutation.mutate({ ...form, cnpj: cnpjDigits });
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
                      <TableCell className="text-sm">{b.cnpj ? formatCnpj(b.cnpj) : '—'}</TableCell>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Marca' : 'Nova Marca'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Label>Nome da Marca *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onFocus={() => setNameFocus(true)}
                onBlur={() => setTimeout(() => setNameFocus(false), 200)}
                placeholder="Ex: Saboroso"
              />
              {nameFocus && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                    Marcas similares já cadastradas na rede
                  </div>
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between gap-2 border-b last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {s.cnpj ? formatCnpj(s.cnpj) : 'sem CNPJ'} · {s.agency_name}
                        </div>
                      </div>
                      <Badge variant={s.is_own ? 'default' : 'secondary'} className="shrink-0">
                        {s.is_own ? 'Sua' : 'Outra agência'}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Razão Social</Label>
                <Input value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} />
              </div>
              <div>
                <Label>CNPJ *</Label>
                <Input
                  value={form.cnpj}
                  onChange={e => setForm(f => ({ ...f, cnpj: formatCnpj(e.target.value) }))}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  className={cnpjError || conflict ? 'border-destructive' : cnpjValid ? 'border-emerald-500' : ''}
                />
                {cnpjError && <p className="text-xs text-destructive mt-1">CNPJ inválido</p>}
                {cnpjValid && !conflict && <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1"><CheckCircle2 className="h-3 w-3" /> CNPJ válido</p>}
              </div>
            </div>

            {conflict && (
              <div className={`rounded-md border p-3 text-sm flex gap-2 ${conflict.is_own ? 'bg-muted border-border' : 'bg-destructive/10 border-destructive/30 text-destructive'}`}>
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  {conflict.is_own ? (
                    <>Você já cadastrou essa marca como <strong>{conflict.name}</strong>.</>
                  ) : (
                    <>Já existe a marca <strong>{conflict.name}</strong> com esse CNPJ na agência <strong>{conflict.agency_name}</strong>. Não é possível duplicar — alinhe com a rede.</>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Rua</Label><Input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} /></div>
              <div><Label>Número</Label><Input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Bairro</Label><Input value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} /></div>
              <div><Label>CEP</Label><Input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cidade</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
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
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !cnpjValid || (!!conflict && !conflict.is_own)}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
