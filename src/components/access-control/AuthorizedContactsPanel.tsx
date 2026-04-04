import { useState } from 'react';
import { useAuthorizedContacts } from '@/hooks/use-incidents';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Phone, User, Trash2, Edit2, Shield } from 'lucide-react';

const ROLES = [
  { value: 'gerente', label: 'Gerente' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'encarregado', label: 'Encarregado' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'other', label: 'Outro' },
];

const PERMISSIONS = [
  { value: 'consultar_operacao', label: 'Consultar operação' },
  { value: 'registrar_ocorrencia', label: 'Registrar ocorrência' },
  { value: 'consultar_score', label: 'Consultar score' },
  { value: 'consultar_agenda', label: 'Consultar agenda' },
  { value: 'acesso_total', label: 'Acesso total do PDV' },
];

interface Props {
  portal?: 'supermarket' | 'admin';
}

export default function AuthorizedContactsPanel({ portal = 'supermarket' }: Props) {
  const { contacts, isLoading, createContact, updateContact, deleteContact } = useAuthorizedContacts(portal);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', phone: '', role: 'gerente', permissions: ['consultar_operacao'] as string[], notes: '' });

  const openEdit = (contact: any) => {
    setEditing(contact);
    setForm({
      name: contact.name,
      phone: contact.phone,
      role: contact.role || 'other',
      permissions: contact.permissions || ['consultar_operacao'],
      notes: contact.notes || '',
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', phone: '', role: 'gerente', permissions: ['consultar_operacao'], notes: '' });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.name || !form.phone) return;
    if (editing) {
      updateContact.mutate({ id: editing.id, ...form });
    } else {
      createContact.mutate(form);
    }
    setShowForm(false);
  };

  const togglePermission = (perm: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Contatos Autorizados
          </h2>
          <p className="text-sm text-muted-foreground">Gerencie quem pode interagir com o assistente WhatsApp</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-4">Carregando...</p>
      ) : contacts.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <Phone className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum contato autorizado</p>
          <p className="text-xs text-muted-foreground">Adicione contatos para usar o assistente WhatsApp</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone} • {ROLES.find(r => r.value === c.role)?.label || c.role}</p>
                  <div className="flex gap-1 mt-1">
                    {(c.permissions || []).slice(0, 3).map((p: string) => (
                      <Badge key={p} variant="outline" className="text-[9px] px-1.5 py-0">
                        {PERMISSIONS.find(pp => pp.value === p)?.label || p}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={c.active ? 'default' : 'secondary'} className="text-[10px]">
                  {c.active ? 'Ativo' : 'Inativo'}
                </Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Remover contato?')) deleteContact.mutate(c.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Contato' : 'Novo Contato Autorizado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do contato" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="11999999999" />
            </div>
            <div className="space-y-1.5">
              <Label>Função</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissões</Label>
              {PERMISSIONS.map(p => (
                <div key={p.value} className="flex items-center gap-2">
                  <Checkbox checked={form.permissions.includes(p.value)} onCheckedChange={() => togglePermission(p.value)} />
                  <span className="text-sm">{p.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.name || !form.phone}>
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
