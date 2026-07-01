import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Plus, Pencil, Power, ScanFace } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCompanies, Company } from '@/hooks/use-companies';

const emptyForm: Partial<Company> = {
  name: '',
  trade_name: '',
  cnpj: '',
  color: '#3B82F6',
  cep: '',
  address: '',
  address_number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  phone: '',
  email: '',
  is_active: true,
  punch_facial_required: true,
  punch_gps_required: false,
};

export default function RHEmpresas() {
  const { companies, loading, create, update, remove, refresh } = useCompanies();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<Partial<Company>>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: Company) => { setEditing(c); setForm(c); setOpen(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('Informe o nome'); return; }
    setSaving(true);
    try {
      if (editing) await update(editing.id, form);
      else await create(form);
      toast.success(editing ? 'Empresa atualizada' : 'Empresa criada');
      setOpen(false);
    } catch (err: any) { toast.error(err.message || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (c: Company) => {
    try {
      await update(c.id, { is_active: !c.is_active });
      toast.success(c.is_active ? 'Empresa desativada' : 'Empresa ativada');
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" /> Empresas da Holding
            </h1>
            <p className="text-sm text-muted-foreground">Gerencie as empresas do grupo e regras de ponto por empresa.</p>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova empresa</Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Todas as empresas</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead className="text-center">Ativos</TableHead>
                    <TableHead className="text-center">Facial</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-full" style={{ background: c.color || '#3B82F6' }} />
                          <div>
                            <div className="font-medium">{c.name}</div>
                            {c.trade_name && <div className="text-xs text-muted-foreground">{c.trade_name}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{c.cnpj || '-'}</TableCell>
                      <TableCell className="text-sm">{[c.city, c.state].filter(Boolean).join('/') || '-'}</TableCell>
                      <TableCell className="text-center">{c.active_employees ?? 0}</TableCell>
                      <TableCell className="text-center">
                        {c.punch_facial_required
                          ? <Badge variant="default" className="gap-1"><ScanFace className="h-3 w-3" />Sim</Badge>
                          : <Badge variant="outline">Não</Badge>}
                      </TableCell>
                      <TableCell>
                        {c.is_active ? <Badge>Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => toggleActive(c)}><Power className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!companies.length && (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Nenhuma empresa cadastrada</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar empresa' : 'Nova empresa'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Nome *</Label>
              <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Nome fantasia</Label>
              <Input value={form.trade_name || ''} onChange={e => setForm({ ...form, trade_name: e.target.value })} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj || ''} onChange={e => setForm({ ...form, cnpj: e.target.value })} />
            </div>
            <div>
              <Label>Cor</Label>
              <Input type="color" value={form.color || '#3B82F6'} onChange={e => setForm({ ...form, color: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Email</Label>
              <Input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>UF</Label>
              <Input maxLength={2} value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })} />
            </div>
            <div className="md:col-span-2 border-t pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Exigir reconhecimento facial no ponto</Label>
                  <p className="text-xs text-muted-foreground">Aplica-se a todos os colaboradores desta empresa (pode ser sobreposto por colaborador).</p>
                </div>
                <Switch checked={!!form.punch_facial_required} onCheckedChange={v => setForm({ ...form, punch_facial_required: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Exigir GPS no ponto</Label>
                  <p className="text-xs text-muted-foreground">Bloqueia a batida se localização não estiver disponível.</p>
                </div>
                <Switch checked={!!form.punch_gps_required} onCheckedChange={v => setForm({ ...form, punch_gps_required: v })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
