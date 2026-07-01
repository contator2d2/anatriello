import { useRef, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Plus, Pencil, Power, ScanFace, Upload, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCompanies, Company } from '@/hooks/use-companies';
import { useUpload } from '@/hooks/use-upload';

const emptyForm: Partial<Company> = {
  name: '',
  trade_name: '',
  cnpj: '',
  logo_url: '',
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
  ie: '',
  im: '',
  website: '',
  legal_representative: '',
  legal_representative_cpf: '',
  notes: '',
  is_active: true,
  punch_facial_required: true,
  punch_gps_required: false,
};

export default function RHEmpresas() {
  const { companies, loading, create, update, remove, refresh } = useCompanies();
  const { uploadFile, isUploading } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<Partial<Company>>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: Company) => { setEditing(c); setForm(c); setOpen(true); };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Envie uma imagem'); return; }
    try {
      const url = await uploadFile(file);
      if (url) {
        setForm(f => ({ ...f, logo_url: url }));
        toast.success('Logo enviada');
      }
    } catch (e: any) { toast.error(e.message || 'Erro no upload'); }
  };

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
                        <div className="flex items-center gap-3">
                          {c.logo_url ? (
                            <img src={c.logo_url} alt={c.name} className="h-9 w-9 rounded object-contain bg-muted border" />
                          ) : (
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded border text-xs font-semibold" style={{ background: (c.color || '#3B82F6') + '22', color: c.color || '#3B82F6' }}>
                              {c.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar empresa' : 'Nova empresa'}</DialogTitle></DialogHeader>

          {/* Logo + identidade visual */}
          <div className="flex items-center gap-4 border rounded-lg p-4 bg-muted/30">
            <div className="relative">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="h-20 w-20 rounded-lg object-contain bg-background border" />
              ) : (
                <div className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground">
                  <Building2 className="h-8 w-8" />
                </div>
              )}
              {form.logo_url && (
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, logo_url: '' }))}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow"
                  title="Remover logo"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Logo da empresa</p>
              <p className="text-xs text-muted-foreground mb-2">PNG/JPG, fundo transparente de preferência. Substitui a logo antiga desta empresa.</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }} />
              <Button type="button" size="sm" variant="outline" disabled={isUploading} onClick={() => fileRef.current?.click()}>
                {isUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                {isUploading ? 'Enviando...' : (form.logo_url ? 'Trocar logo' : 'Enviar logo')}
              </Button>
            </div>
            <div>
              <Label className="text-xs">Cor</Label>
              <Input type="color" className="h-10 w-16 p-1" value={form.color || '#3B82F6'} onChange={e => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Razão social *</Label>
              <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Nome fantasia</Label>
              <Input value={form.trade_name || ''} onChange={e => setForm({ ...form, trade_name: e.target.value })} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj || ''} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label>Inscrição Estadual</Label>
              <Input value={form.ie || ''} onChange={e => setForm({ ...form, ie: e.target.value })} />
            </div>
            <div>
              <Label>Inscrição Municipal</Label>
              <Input value={form.im || ''} onChange={e => setForm({ ...form, im: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://" />
            </div>
            <div className="md:col-span-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>

            <div className="md:col-span-2 border-t pt-3">
              <p className="text-sm font-semibold mb-2">Responsável Legal</p>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={form.legal_representative || ''} onChange={e => setForm({ ...form, legal_representative: e.target.value })} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={form.legal_representative_cpf || ''} onChange={e => setForm({ ...form, legal_representative_cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>

            <div className="md:col-span-2 border-t pt-3">
              <p className="text-sm font-semibold mb-2">Endereço</p>
            </div>
            <div>
              <Label>CEP</Label>
              <Input
                value={form.cep || ''}
                onChange={e => setForm({ ...form, cep: e.target.value })}
                onBlur={async (e) => {
                  const cep = e.target.value.replace(/\D/g, '');
                  if (cep.length !== 8) return;
                  try {
                    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const d = await r.json();
                    if (!d.erro) setForm(f => ({
                      ...f,
                      address: f.address || d.logradouro || '',
                      neighborhood: f.neighborhood || d.bairro || '',
                      city: f.city || d.localidade || '',
                      state: f.state || d.uf || '',
                    }));
                  } catch {}
                }}
                placeholder="00000-000"
              />
            </div>
            <div className="md:col-span-1" />
            <div className="md:col-span-2">
              <Label>Logradouro</Label>
              <Input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Número</Label>
              <Input value={form.address_number || ''} onChange={e => setForm({ ...form, address_number: e.target.value })} />
            </div>
            <div>
              <Label>Complemento</Label>
              <Input value={form.complement || ''} onChange={e => setForm({ ...form, complement: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Bairro</Label>
              <Input value={form.neighborhood || ''} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>UF</Label>
              <Input maxLength={2} value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })} />
            </div>

            <div className="md:col-span-2 border-t pt-3">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
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
