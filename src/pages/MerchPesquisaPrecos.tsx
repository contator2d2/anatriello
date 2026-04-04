import { useState, useEffect, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useBrands } from "@/hooks/use-merchandising";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  usePriceResearchRules, useUpsertPriceResearchRule, useDeletePriceResearchRule, useShareRule,
  usePriceResearchCompetitors, useCreateCompetitor, useUpdateCompetitor, useDeleteCompetitor,
  usePriceResearchMappings, useCreateProductMapping, useDeleteProductMapping,
  useCreateCompetitorProduct, useDeleteCompetitorProduct,
  usePriceResearchExecutions, useValidateExecution,
} from "@/hooks/use-price-research";
import { useUpload } from "@/hooks/use-upload";
import {
  DollarSign, Plus, Trash2, Image as ImageIcon, Upload, FileText, List, CheckCircle2,
  Calendar, Settings, Building2, Package, Eye, Share2, Edit, Clock, BarChart3,
} from "lucide-react";
import { format } from "date-fns";

const ALL_BRANDS_VALUE = "__all_brands__";
const ALL_STATUS_VALUE = "__all_status__";

const FREQUENCIES = [
  { value: 'once', label: 'Única (sem recorrência)' },
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
];
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function MerchPesquisaPrecos() {
  const [tab, setTab] = useState('modelos');
  const { data: brands = [] } = useBrands();

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Pesquisa de Preços
          </h1>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="modelos"><FileText className="h-4 w-4 mr-1" />Modelos</TabsTrigger>
            <TabsTrigger value="pesquisas"><List className="h-4 w-4 mr-1" />Pesquisas</TabsTrigger>
            <TabsTrigger value="resultados"><BarChart3 className="h-4 w-4 mr-1" />Resultados</TabsTrigger>
            <TabsTrigger value="concorrentes"><Building2 className="h-4 w-4 mr-1" />Concorrentes</TabsTrigger>
            <TabsTrigger value="produtos"><Package className="h-4 w-4 mr-1" />Produtos</TabsTrigger>
          </TabsList>

          <TabsContent value="modelos">
            <ModelosTab brands={brands} />
          </TabsContent>
          <TabsContent value="pesquisas">
            <PesquisasTab brands={brands} />
          </TabsContent>
          <TabsContent value="resultados">
            <ResultadosTab brands={brands} />
          </TabsContent>
          <TabsContent value="concorrentes">
            <ConcorrentesTab brands={brands} />
          </TabsContent>
          <TabsContent value="produtos">
            <ProdutosTab brands={brands} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// ===== Modelos Tab =====
function ModelosTab({ brands }: { brands: any[] }) {
  const { data: rules = [] } = usePriceResearchRules();
  const upsert = useUpsertPriceResearchRule();
  const deleteRule = useDeletePriceResearchRule();
  const shareRule = useShareRule();
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  // Editor state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brandId, setBrandId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState('once');
  const [preferredWeekday, setPreferredWeekday] = useState('1');
  const [scheduledDate, setScheduledDate] = useState('');
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [requireJustification, setRequireJustification] = useState(true);
  const [blockRouteCompletion, setBlockRouteCompletion] = useState(false);

  const openNew = () => {
    setEditingRule(null);
    setName(''); setDescription(''); setBrandId(''); setEnabled(true);
    setFrequency('once'); setPreferredWeekday('1'); setScheduledDate('');
    setRequirePhoto(false); setRequireJustification(true); setBlockRouteCompletion(false);
    setShowEditor(true);
  };

  const openEdit = (rule: any) => {
    setEditingRule(rule);
    setName(rule.name || '');
    setDescription(rule.description || '');
    setBrandId(rule.brand_id);
    setEnabled(rule.enabled);
    setFrequency(rule.frequency || 'once');
    setPreferredWeekday(String(rule.preferred_weekday ?? 1));
    setScheduledDate(rule.scheduled_date || '');
    setRequirePhoto(rule.require_photo);
    setRequireJustification(rule.require_justification);
    setBlockRouteCompletion(rule.block_route_completion);
    setShowEditor(true);
  };

  const handleSave = () => {
    if (!brandId) return toast.error('Selecione uma marca');
    if (!name.trim()) return toast.error('Nome obrigatório');
    upsert.mutate({
      id: editingRule?.id,
      brand_id: brandId,
      name, description, enabled, frequency,
      preferred_weekday: parseInt(preferredWeekday),
      scheduled_date: scheduledDate || null,
      require_photo: requirePhoto,
      require_justification: requireJustification,
      block_route_completion: blockRouteCompletion,
    }, {
      onSuccess: () => { setShowEditor(false); toast.success(editingRule ? 'Modelo atualizado!' : 'Modelo criado!'); },
    });
  };

  const isRecurring = frequency !== 'once';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Crie modelos de pesquisa de preços e agende datas para execução.</p>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo Modelo</Button>
      </div>

      <div className="grid gap-3">
        {rules.map((r: any) => {
          const brandName = brands.find((b: any) => b.id === r.brand_id)?.name || r.brand_name || 'Marca';
          return (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{r.name || 'Pesquisa de Preços'}</h3>
                      <Badge variant={r.enabled ? 'default' : 'secondary'}>{r.enabled ? 'Ativa' : 'Inativa'}</Badge>
                      {r.shared_with_brand && <Badge variant="outline" className="text-primary border-primary"><Share2 className="h-3 w-3 mr-1" />Compartilhada</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{brandName}</p>
                    {r.description && <p className="text-xs text-muted-foreground mb-2">{r.description}</p>}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {FREQUENCIES.find(f => f.value === r.frequency)?.label || r.frequency}
                        {r.scheduled_date && ` — ${format(new Date(r.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy')}`}
                      </span>
                      <span className="flex items-center gap-1"><Package className="h-3 w-3" />{r.products_count || 0} produtos</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{r.completed_count || 0}/{r.executions_count || 0} pesquisas</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Editar">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => shareRule.mutate({ id: r.id, shared: !r.shared_with_brand }, { onSuccess: () => toast.success(r.shared_with_brand ? 'Compartilhamento removido' : 'Resultados compartilhados com a marca') })} title={r.shared_with_brand ? 'Remover compartilhamento' : 'Compartilhar com marca'}>
                      <Share2 className={`h-4 w-4 ${r.shared_with_brand ? 'text-primary' : ''}`} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm('Excluir modelo?')) deleteRule.mutate(r.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {rules.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum modelo de pesquisa criado. Clique em "Novo Modelo" para começar.</CardContent></Card>
        )}
      </div>

      {/* Model Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingRule ? 'Editar Modelo' : 'Novo Modelo de Pesquisa'}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <Label>Nome do modelo</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pesquisa Semanal Limpeza" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição do objetivo desta pesquisa" rows={2} />
            </div>
            <div>
              <Label>Marca</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativa</Label>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Recorrência</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {isRecurring && (
                <div>
                  <Label>Dia preferencial</Label>
                  <Select value={preferredWeekday} onValueChange={setPreferredWeekday}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {frequency === 'once' && (
              <div>
                <Label>Data da pesquisa</Label>
                <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
              </div>
            )}
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium">Opções</p>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Foto obrigatória</Label>
                <Switch checked={requirePhoto} onCheckedChange={setRequirePhoto} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Exigir justificativa se não executada</Label>
                <Switch checked={requireJustification} onCheckedChange={setRequireJustification} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Bloquear rota sem pesquisa</Label>
                <Switch checked={blockRouteCompletion} onCheckedChange={setBlockRouteCompletion} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>{editingRule ? 'Salvar' : 'Criar Modelo'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Pesquisas Tab =====
function PesquisasTab({ brands }: { brands: any[] }) {
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data: executions = [] } = usePriceResearchExecutions({
    brand_id: selectedBrandId || undefined,
    status: statusFilter || undefined,
  });
  const validate = useValidateExecution();
  const [viewId, setViewId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select
          value={selectedBrandId || ALL_BRANDS_VALUE}
          onValueChange={(value) => setSelectedBrandId(value === ALL_BRANDS_VALUE ? '' : value)}
        >
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as marcas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_BRANDS_VALUE}>Todas</SelectItem>
            {brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter || ALL_STATUS_VALUE}
          onValueChange={(value) => setStatusFilter(value === ALL_STATUS_VALUE ? '' : value)}
        >
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUS_VALUE}>Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="in_progress">Em andamento</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="validated">Validada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>PDV</TableHead>
                <TableHead>Promotor</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">{e.created_at ? format(new Date(e.created_at), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell>{e.brand_name}</TableCell>
                  <TableCell>{e.pdv_name || '-'}</TableCell>
                  <TableCell>{e.promoter_name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${e.progress_pct || 0}%` }} />
                      </div>
                      <span className="text-xs">{e.progress_pct || 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.status === 'validated' ? 'default' : e.status === 'completed' ? 'secondary' : e.status === 'in_progress' ? 'outline' : 'outline'}>
                      {e.status === 'validated' ? '✓ Validada' : e.status === 'completed' ? 'Concluída' : e.status === 'in_progress' ? 'Em andamento' : 'Pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {e.status === 'completed' && (
                        <Button size="sm" variant="outline" onClick={() => validate.mutate(e.id, { onSuccess: () => toast.success('Pesquisa validada!') })}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />Validar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {executions.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma pesquisa encontrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Resultados Tab =====
function ResultadosTab({ brands }: { brands: any[] }) {
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const { data: rules = [] } = usePriceResearchRules(selectedBrandId || undefined);
  const shareRule = useShareRule();

  // Filter only rules that have completed executions
  const rulesWithResults = rules.filter((r: any) => (r.completed_count || 0) > 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <Select
          value={selectedBrandId || ALL_BRANDS_VALUE}
          onValueChange={(value) => setSelectedBrandId(value === ALL_BRANDS_VALUE ? '' : value)}
        >
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as marcas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_BRANDS_VALUE}>Todas</SelectItem>
            {brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">Pesquisas validadas podem ser compartilhadas na área da marca.</p>
      </div>

      <div className="grid gap-3">
        {rulesWithResults.map((r: any) => {
          const brandName = brands.find((b: any) => b.id === r.brand_id)?.name || r.brand_name;
          return (
            <Card key={r.id}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{r.name || 'Pesquisa de Preços'}</h3>
                    <p className="text-sm text-muted-foreground">{brandName}</p>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span><CheckCircle2 className="h-3 w-3 inline mr-1" />{r.completed_count} concluídas</span>
                      <span><Package className="h-3 w-3 inline mr-1" />{r.products_count || 0} produtos</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={r.shared_with_brand ? 'default' : 'outline'}
                      onClick={() => shareRule.mutate({ id: r.id, shared: !r.shared_with_brand }, {
                        onSuccess: () => toast.success(r.shared_with_brand ? 'Compartilhamento removido' : 'Resultados compartilhados com a marca!'),
                      })}
                    >
                      <Share2 className="h-4 w-4 mr-1" />
                      {r.shared_with_brand ? 'Compartilhada' : 'Compartilhar'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {rulesWithResults.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma pesquisa com resultados concluídos.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

// ===== Concorrentes Tab =====
function ConcorrentesTab({ brands }: { brands: any[] }) {
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const { data: competitors = [] } = usePriceResearchCompetitors(selectedBrandId || undefined);
  const create = useCreateCompetitor();
  const update = useUpdateCompetitor();
  const del = useDeleteCompetitor();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  const handleAdd = () => {
    if (!selectedBrandId) return toast.error('Selecione uma marca');
    if (!name.trim()) return toast.error('Nome obrigatório');
    create.mutate({ brand_id: selectedBrandId, competitor_name: name, category }, {
      onSuccess: () => { setShowAdd(false); setName(''); setCategory(''); toast.success('Concorrente adicionado'); },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center justify-between flex-wrap">
        <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Selecione uma marca" /></SelectTrigger>
          <SelectContent>{brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
        {selectedBrandId && <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>}
      </div>

      {selectedBrandId ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.competitor_name}</TableCell>
                    <TableCell>{c.category || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={c.active ? 'default' : 'secondary'} className="cursor-pointer"
                        onClick={() => update.mutate({ id: c.id, active: !c.active })}>
                        {c.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm('Excluir?')) del.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {competitors.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum concorrente cadastrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione uma marca para gerenciar concorrentes</CardContent></Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Concorrente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome da marca concorrente</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Categoria (opcional)</Label><Input value={category} onChange={e => setCategory(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd} disabled={create.isPending}>Adicionar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Produtos Tab =====
function ProdutosTab({ brands }: { brands: any[] }) {
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const { data: mappings = [] } = usePriceResearchMappings(selectedBrandId || undefined);
  const { data: competitors = [] } = usePriceResearchCompetitors(selectedBrandId || undefined);
  const createMapping = useCreateProductMapping();
  const deleteMapping = useDeleteProductMapping();
  const createCP = useCreateCompetitorProduct();
  const deleteCP = useDeleteCompetitorProduct();
  const { data: products = [] } = useQuery({
    queryKey: ['merch-products-brand', selectedBrandId],
    queryFn: () => api<any[]>(`/api/merchandising/products?brand_id=${selectedBrandId}`),
    enabled: !!selectedBrandId,
  });

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showAddComp, setShowAddComp] = useState<string | null>(null);
  const [compName, setCompName] = useState('');
  const [compCompetitorId, setCompCompetitorId] = useState('');
  const [compPhotoUrl, setCompPhotoUrl] = useState('');
  const { uploadFile, isUploading } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Apenas imagens são permitidas'); return; }
    try {
      const url = await uploadFile(file);
      if (url) setCompPhotoUrl(url);
    } catch (err: any) { toast.error(err.message || 'Erro ao enviar foto'); }
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) { const file = item.getAsFile(); if (file) { handleFileUpload(file); break; } }
    }
  }, [handleFileUpload]);

  const mappedProductIds = new Set(mappings.map((m: any) => m.product_id));
  const availableProducts = products.filter((p: any) => !mappedProductIds.has(p.id));
  const selectedProductData = products.find((p: any) => p.id === selectedProduct);

  const handleAddProduct = () => {
    if (!selectedProduct) return;
    createMapping.mutate({ brand_id: selectedBrandId, product_id: selectedProduct }, {
      onSuccess: () => { setShowAddProduct(false); setSelectedProduct(''); toast.success('Produto adicionado à pesquisa'); },
    });
  };

  const handleAddCompetitorProduct = () => {
    if (!compName.trim() || !compCompetitorId || !showAddComp) return;
    createCP.mutate({ mapping_id: showAddComp, competitor_id: compCompetitorId, competitor_product_name: compName, photo_url: compPhotoUrl || null }, {
      onSuccess: () => { setShowAddComp(null); setCompName(''); setCompCompetitorId(''); setCompPhotoUrl(''); toast.success('Produto concorrente adicionado'); },
    });
  };

  const getProductInfo = (productId: string) => products.find((p: any) => p.id === productId);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center justify-between flex-wrap">
        <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Selecione uma marca" /></SelectTrigger>
          <SelectContent>{brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
        {selectedBrandId && <Button size="sm" onClick={() => setShowAddProduct(true)}><Plus className="h-4 w-4 mr-1" />Adicionar Produto</Button>}
      </div>

      {selectedBrandId ? (
        <div className="space-y-3">
          {mappings.map((m: any) => {
            const prodInfo = getProductInfo(m.product_id);
            return (
              <Card key={m.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {(prodInfo?.photo_url || m.photo_url) ? (
                      <img src={prodInfo?.photo_url || m.photo_url} alt={m.product_name} className="h-12 w-12 rounded object-cover border" />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{m.product_name || prodInfo?.name || m.product_id}</p>
                      {(prodInfo?.description || m.sku) && <p className="text-xs text-muted-foreground">{prodInfo?.description || `SKU: ${m.sku}`}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setShowAddComp(m.id)}><Plus className="h-3 w-3 mr-1" />Concorrente</Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm('Remover?')) deleteMapping.mutate(m.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                {m.competitor_products?.length > 0 && (
                  <div className="ml-4 space-y-1">
                    {m.competitor_products.map((cp: any) => (
                      <div key={cp.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                        <div className="flex items-center gap-2">
                          {cp.photo_url ? <img src={cp.photo_url} alt={cp.competitor_product_name} className="h-8 w-8 rounded object-cover border" /> : <div className="h-8 w-8 rounded bg-muted flex items-center justify-center"><ImageIcon className="h-3 w-3 text-muted-foreground" /></div>}
                          <span>{cp.competitor_name} — {cp.competitor_product_name}</span>
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteCP.mutate(cp.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
                {(!m.competitor_products || m.competitor_products.length === 0) && <p className="text-xs text-muted-foreground ml-4">Nenhum produto concorrente vinculado</p>}
              </Card>
            );
          })}
          {mappings.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum produto adicionado à pesquisa</CardContent></Card>}
        </div>
      ) : (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione uma marca para gerenciar produtos</CardContent></Card>
      )}

      {/* Add product dialog */}
      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Produto à Pesquisa</DialogTitle></DialogHeader>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
            <SelectContent>
              {availableProducts.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    {p.photo_url && <img src={p.photo_url} alt="" className="h-5 w-5 rounded object-cover" />}
                    <span>{p.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProductData && (
            <Card className="p-3">
              <div className="flex items-center gap-3">
                {selectedProductData.photo_url ? <img src={selectedProductData.photo_url} alt={selectedProductData.name} className="h-16 w-16 rounded object-cover border" /> : <div className="h-16 w-16 rounded bg-muted flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground" /></div>}
                <div>
                  <p className="font-medium">{selectedProductData.name}</p>
                  {selectedProductData.sku && <p className="text-xs text-muted-foreground">SKU: {selectedProductData.sku}</p>}
                  {selectedProductData.description && <p className="text-xs text-muted-foreground">{selectedProductData.description}</p>}
                </div>
              </div>
            </Card>
          )}
          <DialogFooter><Button onClick={handleAddProduct} disabled={createMapping.isPending}>Adicionar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add competitor product dialog */}
      <Dialog open={!!showAddComp} onOpenChange={() => setShowAddComp(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Produto Concorrente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Marca concorrente</Label>
              <Select value={compCompetitorId} onValueChange={setCompCompetitorId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{competitors.filter((c: any) => c.active).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.competitor_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome do produto concorrente</Label>
              <Input value={compName} onChange={e => setCompName(e.target.value)} placeholder="Ex: Sabonete 85g" />
            </div>
            <div>
              <Label>Foto do produto</Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onPaste={handlePaste}
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                  ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                  ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
                {compPhotoUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={compPhotoUrl} alt="Preview" className="h-24 w-24 rounded object-cover border" />
                    <p className="text-xs text-muted-foreground">Clique ou arraste para substituir</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{isUploading ? 'Enviando...' : 'Arraste uma foto, cole (Ctrl+V) ou clique'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddCompetitorProduct} disabled={createCP.isPending}>Adicionar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}