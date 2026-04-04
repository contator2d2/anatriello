import { useState, useCallback, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useBrands, useBrandPdvs } from "@/hooks/use-merchandising";
import { useEmployees } from "@/hooks/use-rh";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  usePriceResearchRules, useUpsertPriceResearchRule, useDeletePriceResearchRule, useShareRule,
  usePriceResearchCompetitors, useCreateCompetitor,
  usePriceResearchExecutions, useValidateExecution, usePublishExecution,
  usePriceResearchDashboard, usePriceResearchExecutionDetail,
} from "@/hooks/use-price-research";
import { useUpload } from "@/hooks/use-upload";
import { resolveMediaUrl } from "@/lib/media";
import {
  DollarSign, Plus, Trash2, Image as ImageIcon, Upload, FileText, List, CheckCircle2,
  Calendar, Building2, Package, Share2, Edit, Clock, BarChart3, CalendarPlus, MapPin, User,
  ChevronDown, ChevronUp, Eye, Send, AlertTriangle, TrendingUp, TrendingDown, Target,
  Copy, Settings, GripVertical, Camera, X, ArrowRight, Repeat,
} from "lucide-react";
import { format, isValid, parseISO } from "date-fns";

const ALL_VALUE = "__all__";

const FREQUENCIES = [
  { value: 'once', label: 'Única' },
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
];

const POSTPONE_LIMITS = [
  { value: 'week', label: 'Dentro da semana' },
  { value: 'month', label: 'Dentro do mês' },
  { value: 'custom', label: 'Até X dias' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'secondary' },
  scheduled: { label: '📅 Agendada', color: 'outline' },
  pending: { label: 'Pendente', color: 'outline' },
  in_progress: { label: '🔄 Em andamento', color: 'outline' },
  partially_completed: { label: 'Parcial', color: 'outline' },
  completed: { label: '✅ Concluída', color: 'secondary' },
  validated: { label: '✓ Validada', color: 'default' },
  published: { label: '📢 Publicada', color: 'default' },
  postponed: { label: '⏳ Prorrogada', color: 'outline' },
  expired: { label: '❌ Vencida', color: 'destructive' },
};

function safeFormatDate(dateStr: any, fmt: string = 'dd/MM/yyyy'): string {
  if (!dateStr) return '-';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    return isValid(d) ? format(d, fmt) : '-';
  } catch { return '-'; }
}

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
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="modelos"><FileText className="h-4 w-4 mr-1" />Modelos</TabsTrigger>
            <TabsTrigger value="agendamentos"><Calendar className="h-4 w-4 mr-1" />Pesquisas</TabsTrigger>
            <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" />Dashboard</TabsTrigger>
            <TabsTrigger value="marcas"><Building2 className="h-4 w-4 mr-1" />Marcas</TabsTrigger>
          </TabsList>

          <TabsContent value="modelos">
            <ModelosTab brands={brands} onSwitchTab={setTab} />
          </TabsContent>
          <TabsContent value="agendamentos">
            <PesquisasTab brands={brands} />
          </TabsContent>
          <TabsContent value="dashboard">
            <DashboardTab brands={brands} />
          </TabsContent>
          <TabsContent value="marcas">
            <MarcasTab brands={brands} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// ===== Modelos Tab =====
function ModelosTab({ brands, onSwitchTab }: { brands: any[]; onSwitchTab: (t: string) => void }) {
  const { data: rules = [] } = usePriceResearchRules();
  const deleteRule = useDeletePriceResearchRule();
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [showSchedule, setShowSchedule] = useState<any>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <p className="text-sm text-muted-foreground">Modelos definem marca, produtos, concorrentes e regras de execução.</p>
          <p className="text-xs text-muted-foreground mt-1">Crie um modelo → Agende a pesquisa → Promotor executa → Valide e publique.</p>
        </div>
        <Button onClick={() => { setEditingRule(null); setShowEditor(true); }}>
          <Plus className="h-4 w-4 mr-1" />Novo Modelo
        </Button>
      </div>

      <div className="grid gap-3">
        {rules.map((r: any) => {
          const brandName = brands.find((b: any) => b.id === r.brand_id)?.name || r.brand_name || 'Marca';
          const productCount = r.selected_products?.length || r.products_count || 0;
          const competitorCount = r.selected_competitors?.length || 0;
          return (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold truncate">{r.name || 'Pesquisa de Preços'}</h3>
                      <Badge variant={r.enabled ? 'default' : 'secondary'}>{r.enabled ? 'Ativo' : 'Inativo'}</Badge>
                      {r.shared_with_brand && <Badge variant="outline" className="text-primary border-primary"><Share2 className="h-3 w-3 mr-1" />Na marca</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{brandName}{r.category ? ` • ${r.category}` : ''}</p>
                    {r.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{r.description}</p>}
                    <div className="flex gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                      <span className="flex items-center gap-1"><Repeat className="h-3 w-3" />{FREQUENCIES.find(f => f.value === r.frequency)?.label}</span>
                      <span className="flex items-center gap-1"><Package className="h-3 w-3" />{productCount} prod.</span>
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{competitorCount} conc.</span>
                      {(r.executions_count || 0) > 0 && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{r.completed_count || 0}/{r.executions_count} pesquisas</span>}
                      {r.block_route_completion && <Badge variant="destructive" className="text-[10px] h-5">Obrigatória</Badge>}
                      {r.require_photo && <Badge variant="outline" className="text-[10px] h-5">📷 Foto</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" onClick={() => setShowSchedule(r)} title="Usar modelo e agendar">
                      <CalendarPlus className="h-4 w-4 mr-1" />Usar modelo
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditingRule(r); setShowEditor(true); }}>
                      <Edit className="h-4 w-4" />
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
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            Nenhum modelo criado. Clique em "Novo Modelo" para começar.
          </CardContent></Card>
        )}
      </div>

      {showEditor && (
        <ModelEditorDialog rule={editingRule} brands={brands} open={showEditor} onClose={() => setShowEditor(false)} />
      )}
      {showSchedule && (
        <ScheduleResearchDialog rule={showSchedule} brands={brands} open={!!showSchedule} onClose={() => { setShowSchedule(null); onSwitchTab('agendamentos'); }} />
      )}
    </div>
  );
}

// ===== Model Editor Dialog =====
function ModelEditorDialog({ rule, brands, open, onClose }: { rule: any; brands: any[]; open: boolean; onClose: () => void }) {
  const upsert = useUpsertPriceResearchRule();
  const qc = useQueryClient();

  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [brandId, setBrandId] = useState(rule?.brand_id || '');
  const [category, setCategory] = useState(rule?.category || '');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [frequency, setFrequency] = useState(rule?.frequency || 'once');
  const [preferredWeekday, setPreferredWeekday] = useState(String(rule?.preferred_weekday ?? 1));

  // Rules
  const [requirePhoto, setRequirePhoto] = useState(rule?.require_photo ?? false);
  const [requireJustification, setRequireJustification] = useState(rule?.require_justification ?? true);
  const [blockRouteCompletion, setBlockRouteCompletion] = useState(rule?.block_route_completion ?? false);
  const [requireAllPrices, setRequireAllPrices] = useState(rule?.require_all_prices ?? true);
  const [allowPartial, setAllowPartial] = useState(rule?.allow_partial ?? true);
  const [requireObservation, setRequireObservation] = useState(rule?.require_observation ?? false);
  const [allowPromoterEdit, setAllowPromoterEdit] = useState(rule?.allow_promoter_edit ?? false);
  const [allowPostpone, setAllowPostpone] = useState(rule?.allow_postpone ?? true);
  const [postponeLimitType, setPostponeLimitType] = useState(rule?.postpone_limit_type || 'week');
  const [postponeLimitDays, setPostponeLimitDays] = useState(String(rule?.postpone_limit_days ?? 7));

  const [selectedProducts, setSelectedProducts] = useState<string[]>(rule?.selected_products || []);
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>(rule?.selected_competitors || []);

  const [showProducts, setShowProducts] = useState(false);
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showPostpone, setShowPostpone] = useState(false);
  const [showAddCompetitor, setShowAddCompetitor] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompCategory, setNewCompCategory] = useState('');
  const createCompetitor = useCreateCompetitor();

  const { data: products = [] } = useQuery({
    queryKey: ['merch-products-brand', brandId],
    queryFn: () => api<any[]>(`/api/merchandising/products?brand_id=${brandId}`),
    enabled: !!brandId,
  });
  const { data: competitors = [] } = usePriceResearchCompetitors(brandId || undefined);
  const isRecurring = frequency !== 'once';

  const toggleProduct = (id: string) => setSelectedProducts(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  const toggleCompetitor = (id: string) => setSelectedCompetitors(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handleSave = () => {
    if (!brandId) return toast.error('Selecione uma marca');
    if (!name.trim()) return toast.error('Nome obrigatório');
    if (selectedProducts.length === 0) return toast.error('Selecione pelo menos um produto');

    upsert.mutate({
      id: rule?.id, brand_id: brandId, name, description, category, enabled, frequency,
      preferred_weekday: parseInt(preferredWeekday),
      require_photo: requirePhoto, require_justification: requireJustification,
      block_route_completion: blockRouteCompletion, require_all_prices: requireAllPrices,
      allow_partial: allowPartial, require_observation: requireObservation,
      allow_promoter_edit: allowPromoterEdit, allow_postpone: allowPostpone,
      postpone_limit_type: postponeLimitType, postpone_limit_days: parseInt(postponeLimitDays),
      selected_products: selectedProducts, selected_competitors: selectedCompetitors,
    }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-research-rules'] }); onClose(); toast.success(rule ? 'Modelo atualizado!' : 'Modelo criado!'); },
    });
  };

  const handleAddCompetitor = () => {
    if (!brandId) return toast.error('Selecione a marca primeiro');
    if (!newCompName.trim()) return toast.error('Nome obrigatório');
    createCompetitor.mutate({ brand_id: brandId, competitor_name: newCompName, category: newCompCategory }, {
      onSuccess: (data: any) => { setShowAddCompetitor(false); setNewCompName(''); setNewCompCategory(''); if (data?.id) setSelectedCompetitors(prev => [...prev, data.id]); toast.success('Concorrente criado'); },
    });
  };

  const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader><DialogTitle>{rule ? 'Editar Modelo' : 'Novo Modelo de Pesquisa'}</DialogTitle></DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome do modelo *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pesquisa Semanal Limpeza" />
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Objetivo da pesquisa..." />
              </div>
              <div>
                <Label>Marca *</Label>
                <Select value={brandId} onValueChange={(v) => { setBrandId(v); setSelectedProducts([]); setSelectedCompetitors([]); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Opcional" />
              </div>
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

            {/* Products */}
            {brandId && (
              <CollapsibleSection
                title={`Produtos (${selectedProducts.length} selecionados)`}
                icon={<Package className="h-4 w-4" />}
                open={showProducts} onToggle={() => setShowProducts(!showProducts)}
              >
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {products.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto nesta marca</p>}
                  {products.map((p: any) => (
                    <label key={p.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={selectedProducts.includes(p.id)} onCheckedChange={() => toggleProduct(p.id)} />
                      {p.photo_url ? (
                        <img src={resolveMediaUrl(p.photo_url) || ''} alt={p.name} className="h-10 w-10 rounded object-cover border flex-shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0"><Package className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                        {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                      </div>
                    </label>
                  ))}
                  {products.length > 0 && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" onClick={() => setSelectedProducts(products.map((p: any) => p.id))}>Todos</Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedProducts([])}>Limpar</Button>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Competitors */}
            {brandId && (
              <CollapsibleSection
                title={`Concorrentes (${selectedCompetitors.length} selecionados)`}
                icon={<Building2 className="h-4 w-4" />}
                open={showCompetitors} onToggle={() => setShowCompetitors(!showCompetitors)}
              >
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {competitors.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Nenhum concorrente</p>}
                  {competitors.filter((c: any) => c.active).map((c: any) => (
                    <label key={c.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={selectedCompetitors.includes(c.id)} onCheckedChange={() => toggleCompetitor(c.id)} />
                      <div><p className="text-sm font-medium">{c.competitor_name}</p>{c.category && <p className="text-xs text-muted-foreground">{c.category}</p>}</div>
                    </label>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setShowAddCompetitor(true)} className="w-full mt-2">
                    <Plus className="h-3 w-3 mr-1" />Novo Concorrente (Biblioteca Global)
                  </Button>
                </div>
              </CollapsibleSection>
            )}

            {/* Validation Rules */}
            <CollapsibleSection
              title="Regras de validação"
              icon={<Settings className="h-4 w-4" />}
              open={showRules} onToggle={() => setShowRules(!showRules)}
            >
              <div className="space-y-3">
                <SwitchRow label="Modelo ativo" checked={enabled} onChange={setEnabled} />
                <SwitchRow label="Preço obrigatório (todos)" checked={requireAllPrices} onChange={setRequireAllPrices} />
                <SwitchRow label="Foto obrigatória" checked={requirePhoto} onChange={setRequirePhoto} />
                <SwitchRow label="Observação obrigatória" checked={requireObservation} onChange={setRequireObservation} />
                <SwitchRow label="Permitir execução parcial" checked={allowPartial} onChange={setAllowPartial} />
                <SwitchRow label="Permitir edição pelo promotor" checked={allowPromoterEdit} onChange={setAllowPromoterEdit} />
                <SwitchRow label="Exigir justificativa se não executada" checked={requireJustification} onChange={setRequireJustification} />
                <SwitchRow label="Bloquear rota sem pesquisa (obrigatória)" checked={blockRouteCompletion} onChange={setBlockRouteCompletion} />
              </div>
            </CollapsibleSection>

            {/* Postponement Rules */}
            <CollapsibleSection
              title="Regras de prorrogação"
              icon={<Clock className="h-4 w-4" />}
              open={showPostpone} onToggle={() => setShowPostpone(!showPostpone)}
            >
              <div className="space-y-3">
                <SwitchRow label="Permitir prorrogar" checked={allowPostpone} onChange={setAllowPostpone} />
                {allowPostpone && (
                  <>
                    <div>
                      <Label className="text-xs">Limite de prorrogação</Label>
                      <Select value={postponeLimitType} onValueChange={setPostponeLimitType}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{POSTPONE_LIMITS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {postponeLimitType === 'custom' && (
                      <div>
                        <Label className="text-xs">Máximo de dias</Label>
                        <Input type="number" value={postponeLimitDays} onChange={e => setPostponeLimitDays(e.target.value)} className="h-8" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </CollapsibleSection>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>{rule ? 'Salvar' : 'Criar Modelo'}</Button>
        </DialogFooter>

        <Dialog open={showAddCompetitor} onOpenChange={setShowAddCompetitor}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Novo Concorrente</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={newCompName} onChange={e => setNewCompName(e.target.value)} placeholder="Ex: Marca X" /></div>
              <div><Label>Categoria</Label><Input value={newCompCategory} onChange={e => setNewCompCategory(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={handleAddCompetitor} disabled={createCompetitor.isPending}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

// ===== Schedule Research Dialog =====
function ScheduleResearchDialog({ rule, brands, open, onClose }: { rule: any; brands: any[]; open: boolean; onClose: () => void }) {
  const brandName = brands.find((b: any) => b.id === rule.brand_id)?.name || 'Marca';
  const { data: pdvs = [] } = useBrandPdvs(rule.brand_id);
  const { data: employees = [] } = useEmployees();
  const qc = useQueryClient();
  const [pdvId, setPdvId] = useState('');
  const [promoterId, setPromoterId] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [recurrenceType, setRecurrenceType] = useState(rule.frequency || 'once');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSchedule = async () => {
    if (!pdvId) return toast.error('Selecione um PDV');
    if (!promoterId) return toast.error('Selecione um promotor');
    if (!scheduleDate) return toast.error('Selecione uma data');
    if (recurrenceType !== 'once' && !recurrenceEndDate) return toast.error('Defina a data final da recorrência');
    setIsSubmitting(true);
    try {
      await api('/api/price-research/schedule', {
        method: 'POST',
        body: {
          rule_id: rule.id, brand_id: rule.brand_id,
          pdv_id: pdvId, promoter_id: promoterId,
          scheduled_date: scheduleDate, scheduled_time: scheduleTime || null,
          recurrence_type: recurrenceType, recurrence_end_date: recurrenceEndDate || null,
        },
      });
      qc.invalidateQueries({ queryKey: ['price-research-executions'] });
      toast.success('Pesquisa agendada!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao agendar');
    } finally { setIsSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarPlus className="h-5 w-5" />Agendar Pesquisa</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Card className="bg-muted/50">
            <CardContent className="pt-3 pb-2">
              <p className="font-medium text-sm">{rule.name || 'Pesquisa de Preços'}</p>
              <p className="text-xs text-muted-foreground">{brandName}</p>
              <div className="flex gap-2 mt-1 text-xs flex-wrap">
                <Badge variant="outline" className="text-[10px] h-5">{rule.selected_products?.length || 0} produtos</Badge>
                <Badge variant="outline" className="text-[10px] h-5">{rule.selected_competitors?.length || 0} concorrentes</Badge>
                {rule.block_route_completion && <Badge variant="destructive" className="text-[10px] h-5">Obrigatória</Badge>}
              </div>
            </CardContent>
          </Card>

          <div>
            <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" />PDV *</Label>
            <Select value={pdvId} onValueChange={setPdvId}>
              <SelectTrigger><SelectValue placeholder="Selecione o PDV" /></SelectTrigger>
              <SelectContent>{pdvs.map((p: any) => <SelectItem key={p.pdv_id || p.id} value={p.pdv_id || p.id}>{p.pdv_name || p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label className="flex items-center gap-1"><User className="h-3 w-3" />Promotor *</Label>
            <Select value={promoterId} onValueChange={setPromoterId}>
              <SelectTrigger><SelectValue placeholder="Selecione o promotor" /></SelectTrigger>
              <SelectContent>{employees.filter((e: any) => e.active !== false).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" />Data *</Label>
              <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Clock className="h-3 w-3" />Horário</Label>
              <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1"><Repeat className="h-3 w-3" />Recorrência</Label>
            <Select value={recurrenceType} onValueChange={setRecurrenceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {recurrenceType !== 'once' && (
            <div>
              <Label>Data final da recorrência *</Label>
              <Input type="date" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSchedule} disabled={isSubmitting}><CalendarPlus className="h-4 w-4 mr-1" />Agendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Pesquisas Tab (list of executions/schedules) =====
function PesquisasTab({ brands }: { brands: any[] }) {
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data: executions = [] } = usePriceResearchExecutions({
    brand_id: selectedBrandId || undefined,
    status: statusFilter || undefined,
  });
  const validate = useValidateExecution();
  const publish = usePublishExecution();
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={selectedBrandId || ALL_VALUE} onValueChange={v => setSelectedBrandId(v === ALL_VALUE ? '' : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as marcas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todas</SelectItem>
            {brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter || ALL_VALUE} onValueChange={v => setStatusFilter(v === ALL_VALUE ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="h-9 px-3 flex items-center">
          {executions.length} pesquisa{executions.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>PDV</TableHead>
                <TableHead>Promotor</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((e: any) => {
                const st = STATUS_LABELS[e.status] || { label: e.status, color: 'outline' };
                return (
                  <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailId(e.id)}>
                    <TableCell className="text-sm">
                      {e.scheduled_date ? safeFormatDate(e.scheduled_date + 'T12:00:00') : safeFormatDate(e.created_at)}
                      {e.scheduled_time && <span className="text-xs text-muted-foreground ml-1">{String(e.scheduled_time).slice(0, 5)}</span>}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{e.rule_name || '-'}</TableCell>
                    <TableCell>{e.brand_name || '-'}</TableCell>
                    <TableCell>{e.pdv_name || '-'}</TableCell>
                    <TableCell>{e.promoter_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${e.progress_pct || 0}%` }} />
                        </div>
                        <span className="text-xs">{e.progress_pct || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={st.color as any}>{st.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={ev => ev.stopPropagation()}>
                        {e.status === 'completed' && (
                          <Button size="sm" variant="outline" onClick={() => validate.mutate(e.id, { onSuccess: () => toast.success('Validada!') })}>
                            <CheckCircle2 className="h-3 w-3 mr-1" />Validar
                          </Button>
                        )}
                        {e.status === 'validated' && (
                          <Button size="sm" onClick={() => publish.mutate(e.id, { onSuccess: () => toast.success('Publicada!') })}>
                            <Send className="h-3 w-3 mr-1" />Publicar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {executions.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  Nenhuma pesquisa encontrada. Crie um modelo e clique em "Usar modelo".
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {detailId && <ExecutionDetailDialog id={detailId} open={!!detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

// ===== Execution Detail Dialog =====
function ExecutionDetailDialog({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const { data: exec, isLoading } = usePriceResearchExecutionDetail(id);
  if (!exec && !isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Detalhes da Pesquisa
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Carregando...</div>
          ) : exec ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoCard label="Marca" value={exec.brand_name || '-'} />
                <InfoCard label="PDV" value={exec.pdv_name || '-'} />
                <InfoCard label="Promotor" value={exec.promoter_name || '-'} />
                <InfoCard label="Status" value={STATUS_LABELS[exec.status]?.label || exec.status} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoCard label="Progresso" value={`${exec.progress_pct || 0}%`} />
                <InfoCard label="Itens" value={`${exec.completed_items || 0}/${exec.total_items || 0}`} />
                <InfoCard label="Data" value={exec.scheduled_date ? safeFormatDate(exec.scheduled_date + 'T12:00:00') : safeFormatDate(exec.created_at)} />
                <InfoCard label="Modelo" value={exec.rule_name || '-'} />
              </div>

              {exec.items?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Produtos e Preços</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Observação</TableHead>
                        <TableHead>Concorrentes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exec.items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {item.photo_url ? (
                                <img src={resolveMediaUrl(item.photo_url) || ''} alt="" className="h-8 w-8 rounded object-cover border" />
                              ) : null}
                              <span className="text-sm">{item.product_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{item.price != null ? `R$ ${Number(item.price).toFixed(2)}` : '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{item.observation || '-'}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {item.competitors?.map((c: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  {c.photo_url && <img src={resolveMediaUrl(c.photo_url) || ''} alt="" className="h-6 w-6 rounded object-cover border" />}
                                  <span className="text-muted-foreground">{c.competitor_brand_name}: </span>
                                  <span className="font-mono">{c.price != null ? `R$ ${Number(c.price).toFixed(2)}` : '-'}</span>
                                </div>
                              ))}
                              {(!item.competitors || item.competitors.length === 0) && <span className="text-xs text-muted-foreground">-</span>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {exec.photos?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Fotos ({exec.photos.length})</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {exec.photos.map((p: any) => (
                      <img key={p.id} src={resolveMediaUrl(p.photo_url) || ''} alt="" className="w-full h-24 object-cover rounded border" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ===== Dashboard Tab =====
function DashboardTab({ brands }: { brands: any[] }) {
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const { data: dashboard } = usePriceResearchDashboard({ brand_id: selectedBrandId || undefined });
  const stats = dashboard?.stats || {};
  const avgPrices = dashboard?.avgPrices || [];
  const competitorPrices = dashboard?.competitorPrices || [];

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={selectedBrandId || ALL_VALUE} onValueChange={v => setSelectedBrandId(v === ALL_VALUE ? '' : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as marcas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todas</SelectItem>
            {brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard title="Total" value={stats.total || 0} icon={<List className="h-4 w-4" />} />
        <KpiCard title="Agendadas" value={stats.scheduled || 0} icon={<Calendar className="h-4 w-4" />} color="text-blue-500" />
        <KpiCard title="Em andamento" value={stats.in_progress || 0} icon={<Clock className="h-4 w-4" />} color="text-amber-500" />
        <KpiCard title="Concluídas" value={Number(stats.completed || 0) + Number(stats.validated || 0)} icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-500" />
        <KpiCard title="Publicadas" value={stats.published || 0} icon={<Send className="h-4 w-4" />} color="text-primary" />
        <KpiCard title="Pendentes" value={stats.pending || 0} icon={<AlertTriangle className="h-4 w-4" />} color="text-orange-500" />
        <KpiCard title="Prorrogadas" value={stats.postponed || 0} icon={<Clock className="h-4 w-4" />} color="text-yellow-500" />
        <KpiCard title="Vencidas" value={stats.expired || 0} icon={<AlertTriangle className="h-4 w-4" />} color="text-destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Average Prices */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Preço Médio por Produto</CardTitle></CardHeader>
          <CardContent>
            {avgPrices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Mín</TableHead>
                    <TableHead>Média</TableHead>
                    <TableHead>Máx</TableHead>
                    <TableHead>Coletas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {avgPrices.map((p: any) => (
                    <TableRow key={p.product_id}>
                      <TableCell className="text-sm">{p.product_name}</TableCell>
                      <TableCell className="font-mono text-xs">R$ {Number(p.min_price).toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">R$ {Number(p.avg_price).toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs">R$ {Number(p.max_price).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{p.collections}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Competitor Comparison */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />Concorrentes - Preço Médio</CardTitle></CardHeader>
          <CardContent>
            {competitorPrices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados de concorrentes</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marca Concorrente</TableHead>
                    <TableHead>Preço Médio</TableHead>
                    <TableHead>Coletas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitorPrices.map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{c.competitor_brand_name || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">R$ {Number(c.avg_price).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{c.collections}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== Marcas Tab (brand-facing results) =====
function MarcasTab({ brands }: { brands: any[] }) {
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const { data: rules = [] } = usePriceResearchRules(selectedBrandId || undefined);
  const shareRule = useShareRule();

  const sharedRules = rules.filter((r: any) => r.shared_with_brand);
  const unsharedWithResults = rules.filter((r: any) => !r.shared_with_brand && (r.completed_count || 0) > 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <Select value={selectedBrandId || ALL_VALUE} onValueChange={v => setSelectedBrandId(v === ALL_VALUE ? '' : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as marcas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todas</SelectItem>
            {brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">Pesquisas publicadas aparecem no painel da marca. Compartilhe para dar acesso.</p>
      </div>

      {sharedRules.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Share2 className="h-4 w-4 text-primary" />Compartilhadas com a marca</h3>
          <div className="grid gap-3">
            {sharedRules.map((r: any) => (
              <BrandResultCard key={r.id} rule={r} brands={brands} onToggleShare={() => shareRule.mutate({ id: r.id, shared: false }, { onSuccess: () => toast.success('Removido') })} />
            ))}
          </div>
        </div>
      )}

      {unsharedWithResults.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Disponíveis para compartilhar</h3>
          <div className="grid gap-3">
            {unsharedWithResults.map((r: any) => (
              <BrandResultCard key={r.id} rule={r} brands={brands} onToggleShare={() => shareRule.mutate({ id: r.id, shared: true }, { onSuccess: () => toast.success('Compartilhada!') })} />
            ))}
          </div>
        </div>
      )}

      {sharedRules.length === 0 && unsharedWithResults.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          Nenhuma pesquisa com resultados disponíveis.
        </CardContent></Card>
      )}
    </div>
  );
}

function BrandResultCard({ rule, brands, onToggleShare }: { rule: any; brands: any[]; onToggleShare: () => void }) {
  const brandName = brands.find((b: any) => b.id === rule.brand_id)?.name || rule.brand_name;
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{rule.name || 'Pesquisa'}</h3>
            <p className="text-sm text-muted-foreground">{brandName}</p>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
              <span><CheckCircle2 className="h-3 w-3 inline mr-1" />{rule.completed_count || 0} concluídas</span>
              <span><Package className="h-3 w-3 inline mr-1" />{rule.selected_products?.length || rule.products_count || 0} produtos</span>
            </div>
          </div>
          <Button size="sm" variant={rule.shared_with_brand ? 'default' : 'outline'} onClick={onToggleShare}>
            <Share2 className="h-4 w-4 mr-1" />
            {rule.shared_with_brand ? 'Compartilhada' : 'Compartilhar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Helper Components =====
function CollapsibleSection({ title, icon, open, onToggle, children }: { title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
        <span className="flex items-center gap-2 font-medium text-sm">{icon}{title}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="border-t p-3">{children}</div>}
    </div>
  );
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2">
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function KpiCard({ title, value, icon, color }: { title: string; value: number | string; icon: React.ReactNode; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className={color || 'text-muted-foreground'}>{icon}</span>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
