import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadInput } from "@/components/ui/file-upload-input";
import { useBrandContracts, useCreateContract, useUpdateContract, useDeleteContract, useContractCompliance, useCheckCompliance, useOrgLetterhead } from "@/hooks/use-brand-contracts";
import { useBrandPdvs } from "@/hooks/use-merchandising";
import { FileText, Plus, Trash2, Pencil, GripVertical, Clock, MapPin, DollarSign, CheckCircle, AlertTriangle, XCircle, BarChart3, Calendar, Shield } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface BrandContractPanelProps {
  brand: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyContract = {
  title: '', status: 'draft', start_date: '', end_date: '', auto_renew: false,
  hours_per_visit: '', visits_per_week: '', total_monthly_hours: '',
  pdv_ids: [] as string[], contract_value: '', payment_terms: '',
  clauses: [] as { order: number; title: string; content: string }[],
  letterhead_url: '', header_logo_url: '', footer_text: '', notes: '',
};

export function BrandContractPanel({ brand, open, onOpenChange }: BrandContractPanelProps) {
  const [activeTab, setActiveTab] = useState("list");
  const [editingContract, setEditingContract] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...emptyContract });
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  const { data: contracts = [], isLoading } = useBrandContracts(brand?.id);
  const { data: brandPdvs = [] } = useBrandPdvs(brand?.id);
  const { data: letterhead } = useOrgLetterhead();
  const { data: compliance = [] } = useContractCompliance(selectedContractId || undefined);

  const createContract = useCreateContract();
  const updateContract = useUpdateContract();
  const deleteContract = useDeleteContract();
  const checkCompliance = useCheckCompliance();

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const openNew = () => {
    setForm({ ...emptyContract, title: `Contrato ${brand?.name || ''}` });
    setEditingContract(null);
    setActiveTab("editor");
  };

  const openEdit = (c: any) => {
    setForm({
      ...c,
      clauses: Array.isArray(c.clauses) ? c.clauses : JSON.parse(c.clauses || '[]'),
      pdv_ids: c.pdv_ids || [],
      start_date: c.start_date?.split('T')[0] || '',
      end_date: c.end_date?.split('T')[0] || '',
    });
    setEditingContract(c);
    setActiveTab("editor");
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('Título obrigatório'); return; }
    try {
      if (editingContract) {
        await updateContract.mutateAsync({ id: editingContract.id, ...form, brand_id: brand.id });
        toast.success('Contrato atualizado');
      } else {
        await createContract.mutateAsync({ ...form, brand_id: brand.id });
        toast.success('Contrato criado');
      }
      setActiveTab("list");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir contrato?')) return;
    try { await deleteContract.mutateAsync(id); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
  };

  const addClause = () => {
    const clauses = [...(form.clauses || [])];
    clauses.push({ order: clauses.length + 1, title: '', content: '' });
    set('clauses', clauses);
  };

  const updateClause = (idx: number, field: string, value: string) => {
    const clauses = [...form.clauses];
    clauses[idx] = { ...clauses[idx], [field]: value };
    set('clauses', clauses);
  };

  const removeClause = (idx: number) => {
    const clauses = form.clauses.filter((_: any, i: number) => i !== idx);
    set('clauses', clauses.map((c: any, i: number) => ({ ...c, order: i + 1 })));
  };

  const togglePdv = (pdvId: string) => {
    const ids = form.pdv_ids.includes(pdvId)
      ? form.pdv_ids.filter((id: string) => id !== pdvId)
      : [...form.pdv_ids, pdvId];
    set('pdv_ids', ids);
  };

  const handleCheckCompliance = async (contractId: string) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];
    try {
      const result = await checkCompliance.mutateAsync({ contractId, period_start: start, period_end: end });
      toast.success(`Conformidade: ${result.compliance_pct?.toFixed(1)}%`);
    } catch (e: any) { toast.error(e.message); }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'default';
      case 'draft': return 'secondary';
      case 'expired': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'active': return 'Ativo';
      case 'draft': return 'Rascunho';
      case 'expired': return 'Expirado';
      case 'cancelled': return 'Cancelado';
      default: return s;
    }
  };

  const complianceIcon = (pct: number | null) => {
    if (!pct) return <Shield className="h-4 w-4 text-muted-foreground" />;
    if (pct >= 90) return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    if (pct >= 70) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Contratos — {brand?.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="list">Contratos</TabsTrigger>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="compliance">Conformidade</TabsTrigger>
          </TabsList>

          {/* LIST */}
          <TabsContent value="list" className="flex-1 overflow-auto">
            <div className="flex justify-end mb-3">
              <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Novo Contrato</Button>
            </div>
            {contracts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum contrato cadastrado</p>
                <Button variant="outline" className="mt-3" onClick={openNew}>Criar primeiro contrato</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {contracts.map((c: any) => (
                  <Card key={c.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openEdit(c)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium truncate">{c.title}</p>
                            <Badge variant={statusColor(c.status) as any}>{statusLabel(c.status)}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {c.contract_value && (
                              <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />R$ {Number(c.contract_value).toLocaleString('pt-BR')}</span>
                            )}
                            {c.visits_per_week && (
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{c.visits_per_week}x/semana</span>
                            )}
                            {c.hours_per_visit && (
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.hours_per_visit}h/visita</span>
                            )}
                            {c.pdv_ids?.length > 0 && (
                              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.pdv_ids.length} PDVs</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {complianceIcon(c.compliance_score)}
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleCheckCompliance(c.id); }}>
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* EDITOR */}
          <TabsContent value="editor" className="flex-1 overflow-auto">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* Basic Info */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Dados do Contrato</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-full space-y-2">
                      <Label>Título *</Label>
                      <Input value={form.title} onChange={e => set('title', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={v => set('status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="expired">Expirado</SelectItem>
                          <SelectItem value="cancelled">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor Mensal (R$)</Label>
                      <Input type="number" value={form.contract_value} onChange={e => set('contract_value', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Início</Label>
                      <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Término</Label>
                      <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Condições de Pagamento</Label>
                      <Input value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} placeholder="Ex: 30 dias" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={form.auto_renew} onCheckedChange={v => set('auto_renew', v)} />
                      <Label>Renovação automática</Label>
                    </div>
                  </CardContent>
                </Card>

                {/* Business Rules */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Regras de Execução</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Horas por Visita</Label>
                      <Input type="number" step="0.5" value={form.hours_per_visit} onChange={e => set('hours_per_visit', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Visitas por Semana</Label>
                      <Input type="number" value={form.visits_per_week} onChange={e => set('visits_per_week', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Horas/Mês</Label>
                      <Input type="number" value={form.total_monthly_hours} onChange={e => set('total_monthly_hours', e.target.value)} />
                    </div>
                  </CardContent>
                </Card>

                {/* PDVs */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">PDVs Cobertos ({form.pdv_ids?.length || 0})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {brandPdvs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum PDV vinculado a esta marca</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                        {brandPdvs.map((bp: any) => (
                          <div key={bp.pdv_id || bp.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
                            <Checkbox
                              checked={form.pdv_ids?.includes(bp.pdv_id)}
                              onCheckedChange={() => togglePdv(bp.pdv_id)}
                            />
                            <span className="text-sm">{bp.pdv_name || bp.pdv_id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Clauses */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Cláusulas ({form.clauses?.length || 0})</CardTitle>
                      <Button variant="outline" size="sm" onClick={addClause}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(form.clauses || []).map((clause: any, idx: number) => (
                      <div key={idx} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">Cláusula {idx + 1}</span>
                          <div className="flex-1" />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeClause(idx)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Título da cláusula"
                          value={clause.title}
                          onChange={e => updateClause(idx, 'title', e.target.value)}
                          className="text-sm"
                        />
                        <Textarea
                          placeholder="Conteúdo da cláusula..."
                          value={clause.content}
                          onChange={e => updateClause(idx, 'content', e.target.value)}
                          rows={3}
                          className="text-sm"
                        />
                      </div>
                    ))}
                    {(!form.clauses || form.clauses.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma cláusula adicionada</p>
                    )}
                  </CardContent>
                </Card>

                {/* Letterhead */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Timbrado do Contrato</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Deixe em branco para usar o timbrado padrão da organização{letterhead?.logo_url ? ' (configurado)' : ' (não configurado)'}.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Logo do Contrato</Label>
                        <FileUploadInput value={form.header_logo_url || ''} onChange={v => set('header_logo_url', v)} accept="image/*" />
                      </div>
                      <div className="space-y-2">
                        <Label>Timbrado (fundo)</Label>
                        <FileUploadInput value={form.letterhead_url || ''} onChange={v => set('letterhead_url', v)} accept="image/*" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Rodapé</Label>
                      <Input value={form.footer_text || ''} onChange={e => set('footer_text', e.target.value)} placeholder="Texto do rodapé do contrato" />
                    </div>
                  </CardContent>
                </Card>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} />
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setActiveTab("list")}>Cancelar</Button>
              <Button onClick={handleSave} disabled={createContract.isPending || updateContract.isPending}>
                {editingContract ? 'Atualizar' : 'Criar'} Contrato
              </Button>
            </div>
          </TabsContent>

          {/* COMPLIANCE */}
          <TabsContent value="compliance" className="flex-1 overflow-auto">
            {contracts.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">Crie um contrato para acompanhar a conformidade</p>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2 items-center">
                  <Label>Contrato:</Label>
                  <Select value={selectedContractId || ''} onValueChange={setSelectedContractId}>
                    <SelectTrigger className="w-[300px]"><SelectValue placeholder="Selecione um contrato" /></SelectTrigger>
                    <SelectContent>
                      {contracts.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedContractId && (
                    <Button size="sm" variant="outline" onClick={() => handleCheckCompliance(selectedContractId)} disabled={checkCompliance.isPending}>
                      <BarChart3 className="h-4 w-4 mr-1" />Verificar Agora
                    </Button>
                  )}
                </div>

                {selectedContractId && (
                  <>
                    {/* Current contract summary */}
                    {(() => {
                      const contract = contracts.find((c: any) => c.id === selectedContractId);
                      if (!contract) return null;
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Card>
                            <CardContent className="p-3 text-center">
                              <p className="text-xs text-muted-foreground">Conformidade</p>
                              <p className="text-2xl font-bold">{contract.compliance_score != null ? `${Number(contract.compliance_score).toFixed(0)}%` : '—'}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-3 text-center">
                              <p className="text-xs text-muted-foreground">Visitas/Semana</p>
                              <p className="text-2xl font-bold">{contract.visits_per_week || '—'}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-3 text-center">
                              <p className="text-xs text-muted-foreground">Horas/Visita</p>
                              <p className="text-2xl font-bold">{contract.hours_per_visit || '—'}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-3 text-center">
                              <p className="text-xs text-muted-foreground">PDVs</p>
                              <p className="text-2xl font-bold">{contract.pdv_ids?.length || 0}</p>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })()}

                    {/* Compliance history */}
                    <Card>
                      <CardHeader className="pb-3"><CardTitle className="text-sm">Histórico de Conformidade</CardTitle></CardHeader>
                      <CardContent>
                        {compliance.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma verificação realizada</p>
                        ) : (
                          <div className="space-y-2">
                            {compliance.map((c: any) => (
                              <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                  {c.status === 'ok' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                                  {c.status === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                                  {c.status === 'breach' && <XCircle className="h-4 w-4 text-destructive" />}
                                  <div>
                                    <p className="text-sm font-medium">
                                      {format(new Date(c.period_start), 'dd/MM')} — {format(new Date(c.period_end), 'dd/MM/yyyy')}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {c.actual_visits}/{c.expected_visits} visitas · {Number(c.actual_hours).toFixed(1)}/{Number(c.expected_hours).toFixed(1)}h
                                    </p>
                                  </div>
                                </div>
                                <Badge variant={c.status === 'ok' ? 'default' : c.status === 'warning' ? 'secondary' : 'destructive'}>
                                  {Number(c.compliance_pct).toFixed(0)}%
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
