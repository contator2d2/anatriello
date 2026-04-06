import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAgencyAuth } from '@/contexts/AgencyAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useUpload } from '@/hooks/use-upload';
import { Plus, Search, Edit, Ban, CheckCircle, Users, FileText, Camera, CalendarDays, Loader2, Phone, Mail, MapPin, Key } from 'lucide-react';
import { RegistrationKeyDialog } from '@/components/access-control/RegistrationKeyDialog';
import { AuthorizationLetterDialog } from '@/components/access-control/AuthorizationLetterDialog';
import { formatCpf, formatPhone, isValidCpf, onlyDigits } from '@/lib/br-utils';
import { format, differenceInYears } from 'date-fns';

const getHeaders = () => {
  const token = localStorage.getItem('agency_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const defaultForm = {
  name: '', cpf: '', phone: '', email: '', whatsapp: '', birth_date: '',
  rg: '', gender: '', photo_url: '', document_url: '',
  address: '', city: '', state: '',
  emergency_contact: '', emergency_phone: '', notes: '',
};

export default function AgencyPromoters() {
  const { user, isLoading: isAuthLoading } = useAgencyAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { uploadFile, isUploading } = useUpload(() => localStorage.getItem('agency_auth_token'));
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState('dados');
  const [letterOpen, setLetterOpen] = useState(false);
  const [letterPromoter, setLetterPromoter] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(defaultForm);
  const [detailPromoter, setDetailPromoter] = useState<any>(null);
  const [regKeyOpen, setRegKeyOpen] = useState(false);

  const { data: promoters = [], isLoading } = useQuery({
    queryKey: ['agency-promoters'],
    queryFn: () => api<any[]>('/api/access-control/agency/promoters', { headers: getHeaders() }),
    enabled: !!user && !isAuthLoading,
  });

  const { data: visitRequests = [] } = useQuery({
    queryKey: ['agency-visit-requests-summary'],
    queryFn: () => api<any[]>('/api/access-control/agency/visit-requests', { headers: getHeaders() }),
    enabled: !!user && !isAuthLoading,
  });

  const { data: agencyBrands = [] } = useQuery({
    queryKey: ['agency-brands'],
    queryFn: () => api<any[]>('/api/access-control/agency/brands', { headers: getHeaders() }),
    enabled: !!user && !isAuthLoading,
  });

  const { data: allowedUnits = [] } = useQuery({
    queryKey: ['agency-allowed-units'],
    queryFn: () => api<any[]>('/api/access-control/agency/allowed-units', { headers: getHeaders() }),
    enabled: !!user && !isAuthLoading,
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        cpf: onlyDigits(data.cpf),
        phone: data.phone ? onlyDigits(data.phone) : null,
        whatsapp: data.whatsapp ? onlyDigits(data.whatsapp) : null,
        emergency_phone: data.emergency_phone ? onlyDigits(data.emergency_phone) : null,
      };
      if (editing) {
        return api(`/api/access-control/agency/promoters/${editing.id}`, { method: 'PUT', body: payload, headers: getHeaders() });
      }
      return api('/api/access-control/agency/promoters', { method: 'POST', body: payload, headers: getHeaders() });
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
      api(`/api/access-control/agency/promoters/${id}/status`, { method: 'PUT', body: { status }, headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-promoters'] });
      toast({ title: 'Status atualizado' });
    },
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(defaultForm); setDialogTab('dados'); };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      cpf: formatCpf(p.cpf || ''),
      phone: formatPhone(p.phone || ''),
      email: p.email || '',
      whatsapp: formatPhone(p.whatsapp || ''),
      birth_date: p.birth_date ? p.birth_date.split('T')[0] : '',
      rg: p.rg || '',
      gender: p.gender || '',
      photo_url: p.photo_url || '',
      document_url: p.document_url || '',
      address: p.address || '',
      city: p.city || '',
      state: p.state || '',
      emergency_contact: p.emergency_contact || '',
      emergency_phone: formatPhone(p.emergency_phone || ''),
      notes: p.notes || '',
    });
    setDialogTab('dados');
    setDialogOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      if (url) setForm(f => ({ ...f, photo_url: url }));
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err?.message, variant: 'destructive' });
    }
  };

  const handleSave = () => {
    if (!form.name || !form.cpf) {
      toast({ title: 'Campos obrigatórios', description: 'Nome e CPF são obrigatórios.', variant: 'destructive' });
      return;
    }
    if (!isValidCpf(form.cpf)) {
      toast({ title: 'CPF inválido', description: 'Revise o CPF antes de salvar.', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(form);
  };

  const getPromoterVisitRequests = (promoterId: string) =>
    visitRequests.filter((vr: any) => vr.promoter_id === promoterId);

  const calcAge = (birthDate: string) => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), new Date(birthDate));
  };

  const filtered = promoters.filter((p: any) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) || p.cpf?.includes(onlyDigits(search))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Promotores</h1>
          <p className="text-muted-foreground">Gerencie os promotores da sua agência</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRegKeyOpen(true)}>
            <Key className="h-4 w-4 mr-2" /> Chave Cadastro PDV
          </Button>
          <Button onClick={() => { setForm(defaultForm); setEditing(null); setDialogTab('dados'); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo Promotor
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum promotor encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: any) => {
            const age = calcAge(p.birth_date);
            const vrs = getPromoterVisitRequests(p.id);
            const pendingVrs = vrs.filter((v: any) => v.status === 'pending').length;
            const approvedVrs = vrs.filter((v: any) => v.status === 'approved').length;
            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailPromoter(p)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={p.photo_url} alt={p.name} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                          {p.name?.charAt(0)?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">CPF: {formatCpf(p.cpf)}</p>
                        {age !== null && <p className="text-xs text-muted-foreground">{age} anos</p>}
                      </div>
                    </div>
                    <Badge variant={p.status === 'active' ? 'default' : p.status === 'blocked' ? 'destructive' : 'secondary'}>
                      {p.status === 'active' ? 'Ativo' : p.status === 'blocked' ? 'Bloqueado' : 'Inativo'}
                    </Badge>
                  </div>

                  {/* Contact info */}
                  <div className="mt-3 space-y-1">
                    {p.whatsapp && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {formatPhone(p.whatsapp)}</p>}
                    {p.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {p.email}</p>}
                    {p.city && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.city}/{p.state}</p>}
                  </div>

                  {/* Visit requests summary */}
                  {vrs.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      {pendingVrs > 0 && <Badge variant="outline" className="text-xs gap-1"><CalendarDays className="h-3 w-3" /> {pendingVrs} pendente(s)</Badge>}
                      {approvedVrs > 0 && <Badge variant="default" className="text-xs gap-1">{approvedVrs} aprovada(s)</Badge>}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                      <Edit className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setLetterPromoter(p); setLetterOpen(true); }}>
                      <FileText className="h-3 w-3 mr-1" /> Carta
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
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailPromoter} onOpenChange={o => { if (!o) setDetailPromoter(null); }}>
        <DialogContent className="max-w-lg">
          {detailPromoter && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={detailPromoter.photo_url} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">{detailPromoter.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg">{detailPromoter.name}</p>
                    <p className="text-sm text-muted-foreground font-normal">CPF: {formatCpf(detailPromoter.cpf)}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {detailPromoter.birth_date && (
                    <div><span className="text-muted-foreground">Nascimento:</span><p className="font-medium">{format(new Date(detailPromoter.birth_date), 'dd/MM/yyyy')} ({calcAge(detailPromoter.birth_date)} anos)</p></div>
                  )}
                  {detailPromoter.rg && <div><span className="text-muted-foreground">RG:</span><p className="font-medium">{detailPromoter.rg}</p></div>}
                  {detailPromoter.gender && <div><span className="text-muted-foreground">Gênero:</span><p className="font-medium">{detailPromoter.gender}</p></div>}
                  {detailPromoter.email && <div><span className="text-muted-foreground">E-mail:</span><p className="font-medium">{detailPromoter.email}</p></div>}
                  {detailPromoter.whatsapp && <div><span className="text-muted-foreground">WhatsApp:</span><p className="font-medium">{formatPhone(detailPromoter.whatsapp)}</p></div>}
                  {detailPromoter.phone && <div><span className="text-muted-foreground">Telefone:</span><p className="font-medium">{formatPhone(detailPromoter.phone)}</p></div>}
                  {detailPromoter.city && <div><span className="text-muted-foreground">Cidade:</span><p className="font-medium">{detailPromoter.city}/{detailPromoter.state}</p></div>}
                  {detailPromoter.address && <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span><p className="font-medium">{detailPromoter.address}</p></div>}
                  {detailPromoter.emergency_contact && (
                    <div className="col-span-2"><span className="text-muted-foreground">Contato de Emergência:</span><p className="font-medium">{detailPromoter.emergency_contact} {detailPromoter.emergency_phone ? `— ${formatPhone(detailPromoter.emergency_phone)}` : ''}</p></div>
                  )}
                </div>

                {/* Visit Requests for this promoter */}
                {(() => {
                  const vrs = getPromoterVisitRequests(detailPromoter.id);
                  if (!vrs.length) return null;
                  return (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Solicitações de Visita</p>
                        <div className="space-y-2">
                          {vrs.map((vr: any) => (
                            <div key={vr.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                              <div>
                                <p className="font-medium">{vr.unit_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {vr.period_start && format(new Date(vr.period_start), 'dd/MM/yy')} — {vr.period_end && format(new Date(vr.period_end), 'dd/MM/yy')}
                                </p>
                              </div>
                              <Badge variant={vr.status === 'approved' ? 'default' : vr.status === 'rejected' ? 'destructive' : 'outline'}>
                                {vr.status === 'approved' ? 'Aprovado' : vr.status === 'rejected' ? 'Recusado' : 'Pendente'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailPromoter(null)}>Fechar</Button>
                <Button onClick={() => { openEdit(detailPromoter); setDetailPromoter(null); }}>Editar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Promotor' : 'Novo Promotor'}</DialogTitle>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={setDialogTab}>
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="contato" className="flex-1">Contato</TabsTrigger>
              <TabsTrigger value="docs" className="flex-1">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 max-h-[50vh] overflow-y-auto">
              {/* Photo upload */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={form.photo_url} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">
                      {form.name?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90">
                    <Camera className="h-3.5 w-3.5 text-primary-foreground" />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploading} />
                  </label>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Foto do Promotor</p>
                  <p className="text-xs text-muted-foreground">Clique no ícone da câmera para enviar</p>
                  {isUploading && <p className="text-xs text-primary mt-1">Enviando...</p>}
                </div>
              </div>

              <div><Label>Nome Completo *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo do promotor" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CPF *</Label><Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: formatCpf(e.target.value) }))} placeholder="000.000.000-00" disabled={!!editing} /></div>
                <div><Label>RG</Label><Input value={form.rg} onChange={e => setForm(f => ({ ...f, rg: e.target.value }))} placeholder="00.000.000-0" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data de Nascimento</Label>
                  <Input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
                  {form.birth_date && <p className="text-xs text-muted-foreground mt-1">{calcAge(form.birth_date)} anos</p>}
                </div>
                <div>
                  <Label>Gênero</Label>
                  <Select value={form.gender || '__none__'} onValueChange={v => setForm(f => ({ ...f, gender: v === '__none__' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não informado</SelectItem>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contato" className="space-y-4 max-h-[50vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" /></div>
                <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" /></div>
              </div>
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="promotor@email.com" /></div>
              <Separator />
              <div><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número, bairro" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cidade</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
                <div><Label>UF</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} maxLength={2} /></div>
              </div>
              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Contato de Emergência</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} placeholder="Nome do contato" /></div>
                <div><Label>Telefone</Label><Input value={form.emergency_phone} onChange={e => setForm(f => ({ ...f, emergency_phone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" /></div>
              </div>
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anotações internas sobre o promotor..." rows={3} /></div>
            </TabsContent>

            <TabsContent value="docs" className="space-y-4 max-h-[50vh] overflow-y-auto">
              <p className="text-sm text-muted-foreground">Documentos adicionais como comprovante de residência, certificações, etc.</p>
              {form.document_url ? (
                <div className="p-3 rounded-lg border border-border">
                  <p className="text-sm font-medium">Documento enviado</p>
                  <a href={form.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Visualizar documento</a>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum documento enviado</p>
              )}
              <div>
                <Label>Enviar Documento</Label>
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const url = await uploadFile(file);
                    if (url) setForm(f => ({ ...f, document_url: url }));
                  } catch (err: any) {
                    toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
                  }
                }} disabled={isUploading} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.cpf || saveMutation.isPending || isUploading}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuthorizationLetterDialog
        open={letterOpen}
        onOpenChange={setLetterOpen}
        promoter={letterPromoter ? {
          name: letterPromoter.name,
          cpf: letterPromoter.cpf,
          phone: letterPromoter.phone,
          isInternal: false,
        } : undefined}
        agency={user ? { name: user.agency_name || '' } : undefined}
        availableBrands={agencyBrands.filter((b: any) => b.active !== false).map((b: any) => ({ id: b.id, name: b.name }))}
        availableUnits={allowedUnits.map((u: any) => ({ id: u.id, name: u.name, address: u.address, city: u.city, state: u.state, networkName: u.network_name, cnpj: u.cnpj }))}
      />

      <RegistrationKeyDialog open={regKeyOpen} onOpenChange={setRegKeyOpen} />
    </div>
  );
}
