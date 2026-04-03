import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileUploadInput } from '@/components/ui/file-upload-input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { FileText, Plus, Pencil, Trash2, Loader2, Star, Eye, Building2, Save } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface ContractTemplate {
  id: string;
  name: string;
  logo_url: string | null;
  header_text: string;
  footer_text: string;
  body_clauses: string[];
  header_bg_color: string;
  header_text_color: string;
  is_default: boolean;
  created_at: string;
}

interface CompanyInfo {
  company_name: string;
  cnpj: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  responsible_name: string;
  responsible_cpf: string;
  responsible_email: string;
  responsible_phone: string;
}

const defaultClauses = [
  'A contratada declara que os promotores vinculados atuarão somente nas lojas, dias, horários e marcas liberados na plataforma.',
  'A cobrança recorrente será calculada conforme o plano vigente.',
  'Em caso de inadimplência, o acesso dos promotores poderá ser bloqueado automaticamente.',
  'Este documento poderá ser assinado eletronicamente, com validade jurídica.',
];

const emptyForm = {
  name: '',
  logo_url: '',
  header_text: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS',
  footer_text: 'Este documento poderá ser assinado eletronicamente, com validade jurídica, permanecendo disponível para auditoria e conferência no sistema.',
  body_clauses: defaultClauses,
  header_bg_color: '#121624',
  header_text_color: '#FFFFFF',
  is_default: false,
};

const emptyCompanyInfo: CompanyInfo = {
  company_name: '',
  cnpj: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  responsible_name: '',
  responsible_cpf: '',
  responsible_email: '',
  responsible_phone: '',
};

export default function ModeloContrato() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(emptyCompanyInfo);
  const [savingCompany, setSavingCompany] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadCompanyInfo();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api<ContractTemplate[]>('/api/doc-signatures/contract-templates/list');
      setTemplates(data);
    } catch { setTemplates([]); }
    setLoading(false);
  };

  const loadCompanyInfo = async () => {
    try {
      const data = await api<CompanyInfo>('/api/doc-signatures/company-info');
      if (data && data.company_name) setCompanyInfo(data);
    } catch { /* ignore */ }
  };

  const saveCompanyInfo = async () => {
    setSavingCompany(true);
    try {
      await api('/api/doc-signatures/company-info', { method: 'PUT', body: companyInfo });
      toast.success('Dados da empresa salvos com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar dados da empresa');
    }
    setSavingCompany(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: ContractTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      logo_url: t.logo_url || '',
      header_text: t.header_text,
      footer_text: t.footer_text,
      body_clauses: Array.isArray(t.body_clauses) ? t.body_clauses : defaultClauses,
      header_bg_color: t.header_bg_color || '#121624',
      header_text_color: t.header_text_color || '#FFFFFF',
      is_default: t.is_default,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Informe um nome para o template'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/doc-signatures/contract-templates/${editing.id}`, { method: 'PUT', body: form });
        toast.success('Template atualizado!');
      } else {
        await api('/api/doc-signatures/contract-templates', { method: 'POST', body: form });
        toast.success('Template criado!');
      }
      setDialogOpen(false);
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/api/doc-signatures/contract-templates/${id}`, { method: 'DELETE' });
      toast.success('Template excluído');
      loadTemplates();
    } catch { toast.error('Erro ao excluir'); }
  };

  const updateClause = (index: number, value: string) => {
    const updated = [...form.body_clauses];
    updated[index] = value;
    setForm(f => ({ ...f, body_clauses: updated }));
  };

  const addClause = () => setForm(f => ({ ...f, body_clauses: [...f.body_clauses, ''] }));
  const removeClause = (index: number) => setForm(f => ({ ...f, body_clauses: f.body_clauses.filter((_, i) => i !== index) }));

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Modelos de Contrato
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Edite o texto, logo, cabeçalho, rodapé e dados da empresa contratante
            </p>
          </div>
          <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Modelo</Button>
        </div>

        <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates" className="gap-2"><FileText className="h-4 w-4" /> Modelos</TabsTrigger>
            <TabsTrigger value="company" className="gap-2"><Building2 className="h-4 w-4" /> Dados da Contratante</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum modelo de contrato cadastrado</p>
                    <p className="text-sm">Clique em "Novo Modelo" para criar</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {templates.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {t.logo_url && <img src={t.logo_url} alt="" className="h-8 w-8 rounded object-contain" />}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{t.name}</p>
                              {t.is_default && <Badge variant="secondary" className="text-xs gap-1"><Star className="h-3 w-3" /> Padrão</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{t.header_text}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => { setPreviewTemplate(t); setPreviewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(t.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  Dados da Empresa Contratante
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Preencha uma vez e esses dados serão utilizados automaticamente em todos os contratos gerados
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Razão Social / Nome da Empresa</Label>
                    <Input value={companyInfo.company_name} onChange={e => setCompanyInfo(c => ({ ...c, company_name: e.target.value }))} placeholder="Ex: Ayratech Tecnologia LTDA" />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={companyInfo.cnpj} onChange={e => setCompanyInfo(c => ({ ...c, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Endereço Completo</Label>
                  <Input value={companyInfo.address} onChange={e => setCompanyInfo(c => ({ ...c, address: e.target.value }))} placeholder="Rua, número, complemento, bairro" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={companyInfo.city} onChange={e => setCompanyInfo(c => ({ ...c, city: e.target.value }))} placeholder="Cidade" />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input value={companyInfo.state} onChange={e => setCompanyInfo(c => ({ ...c, state: e.target.value }))} placeholder="UF" />
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input value={companyInfo.zip_code} onChange={e => setCompanyInfo(c => ({ ...c, zip_code: e.target.value }))} placeholder="00000-000" />
                  </div>
                </div>

                <Separator />
                <p className="text-sm font-medium">Representante Legal</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Responsável</Label>
                    <Input value={companyInfo.responsible_name} onChange={e => setCompanyInfo(c => ({ ...c, responsible_name: e.target.value }))} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF do Responsável</Label>
                    <Input value={companyInfo.responsible_cpf} onChange={e => setCompanyInfo(c => ({ ...c, responsible_cpf: e.target.value }))} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail do Responsável</Label>
                    <Input type="email" value={companyInfo.responsible_email} onChange={e => setCompanyInfo(c => ({ ...c, responsible_email: e.target.value }))} placeholder="email@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone / WhatsApp</Label>
                    <Input value={companyInfo.responsible_phone} onChange={e => setCompanyInfo(c => ({ ...c, responsible_phone: e.target.value }))} placeholder="(00) 00000-0000" />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={saveCompanyInfo} disabled={savingCompany} className="gap-2">
                    {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar Dados da Empresa
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Editor Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl h-[90vh] !flex !flex-col overflow-hidden p-0 gap-0">
            <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
              <DialogTitle>{editing ? 'Editar Modelo de Contrato' : 'Novo Modelo de Contrato'}</DialogTitle>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
              <div className="space-y-5 pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Modelo *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Contrato Padrão" />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_default} onCheckedChange={v => setForm(f => ({ ...f, is_default: v }))} />
                    <Label>Modelo padrão</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Logo (opcional)</Label>
                <FileUploadInput accept="image/*" value={form.logo_url} onChange={url => setForm(f => ({ ...f, logo_url: url }))} previewType="image" />
              </div>

              <Separator />
              <p className="text-sm font-medium">Cabeçalho</p>
              <div className="space-y-2">
                <Label>Texto do Cabeçalho</Label>
                <Input value={form.header_text} onChange={e => setForm(f => ({ ...f, header_text: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor de fundo do cabeçalho</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.header_bg_color} onChange={e => setForm(f => ({ ...f, header_bg_color: e.target.value }))} className="h-9 w-12 rounded border cursor-pointer" />
                    <Input value={form.header_bg_color} onChange={e => setForm(f => ({ ...f, header_bg_color: e.target.value }))} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor do texto do cabeçalho</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.header_text_color} onChange={e => setForm(f => ({ ...f, header_text_color: e.target.value }))} className="h-9 w-12 rounded border cursor-pointer" />
                    <Input value={form.header_text_color} onChange={e => setForm(f => ({ ...f, header_text_color: e.target.value }))} className="flex-1" />
                  </div>
                </div>
              </div>

              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Cláusulas do Contrato</p>
                <Button size="sm" variant="outline" onClick={addClause} className="gap-1"><Plus className="h-3 w-3" /> Adicionar</Button>
              </div>
              <div className="space-y-3">
                {form.body_clauses.map((clause, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-xs text-muted-foreground mt-2 shrink-0 w-5">{i + 1}.</span>
                    <Textarea value={clause} onChange={e => updateClause(i, e.target.value)} rows={2} className="flex-1 text-sm" />
                    {form.body_clauses.length > 1 && (
                      <Button size="icon" variant="ghost" className="shrink-0 text-destructive mt-1" onClick={() => removeClause(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Separator />
              <div className="space-y-2">
                <Label>Texto do Rodapé</Label>
                <Textarea value={form.footer_text} onChange={e => setForm(f => ({ ...f, footer_text: e.target.value }))} rows={3} />
              </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 px-6 py-4 border-t">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Pré-visualização</DialogTitle></DialogHeader>
            {previewTemplate && (
              <div className="border rounded-lg overflow-hidden">
                <div className="p-4 text-center" style={{ backgroundColor: previewTemplate.header_bg_color, color: previewTemplate.header_text_color }}>
                  {previewTemplate.logo_url && <img src={previewTemplate.logo_url} alt="" className="h-10 mx-auto mb-2 object-contain" />}
                  <p className="font-bold text-lg">{previewTemplate.header_text}</p>
                  <p className="text-xs opacity-80 mt-1">Emitido em {new Date().toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <div className="bg-muted/50 rounded p-2 font-medium text-xs">PARTES</div>
                  <p className="text-muted-foreground text-xs">Dados das partes serão preenchidos automaticamente...</p>
                  <div className="bg-muted/50 rounded p-2 font-medium text-xs">CLÁUSULAS</div>
                  {(Array.isArray(previewTemplate.body_clauses) ? previewTemplate.body_clauses : []).map((c: string, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground">{i + 1}. {c}</p>
                  ))}
                </div>
                {previewTemplate.footer_text && (
                  <div className="border-t p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground">{previewTemplate.footer_text}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
