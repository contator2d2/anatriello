import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useBrands } from "@/hooks/use-merchandising";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  usePriceResearchRules, useUpsertPriceResearchRule,
  usePriceResearchCompetitors, useCreateCompetitor, useUpdateCompetitor, useDeleteCompetitor,
  usePriceResearchMappings, useCreateProductMapping, useDeleteProductMapping,
  useCreateCompetitorProduct, useDeleteCompetitorProduct,
} from "@/hooks/use-price-research";
import {
  DollarSign, Settings, Building2, Package, Plus, Trash2, Image as ImageIcon,
} from "lucide-react";

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const FREQUENCIES = [
  { value: 'once', label: 'Única (sem recorrência)' },
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
];

export default function MerchPesquisaPrecos() {
  const [tab, setTab] = useState('config');
  const [selectedBrandId, setSelectedBrandId] = useState('');
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

        <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder="Selecione uma marca" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((b: any) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedBrandId && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="config"><Settings className="h-4 w-4 mr-1" />Configuração</TabsTrigger>
              <TabsTrigger value="competitors"><Building2 className="h-4 w-4 mr-1" />Concorrentes</TabsTrigger>
              <TabsTrigger value="products"><Package className="h-4 w-4 mr-1" />Produtos</TabsTrigger>
            </TabsList>

            <TabsContent value="config">
              <RuleConfig brandId={selectedBrandId} />
            </TabsContent>
            <TabsContent value="competitors">
              <CompetitorsPanel brandId={selectedBrandId} />
            </TabsContent>
            <TabsContent value="products">
              <ProductMappingsPanel brandId={selectedBrandId} />
            </TabsContent>
          </Tabs>
        )}

        {!selectedBrandId && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Selecione uma marca para configurar a pesquisa de preços
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

// ===== Rule Config =====
function RuleConfig({ brandId }: { brandId: string }) {
  const { data: rules = [] } = usePriceResearchRules(brandId);
  const upsert = useUpsertPriceResearchRule();
  const rule = rules[0] || {};

  const [enabled, setEnabled] = useState(rule.enabled ?? false);
  const [frequency, setFrequency] = useState(rule.frequency ?? 'weekly');
  const [preferredWeekday, setPreferredWeekday] = useState(String(rule.preferred_weekday ?? 1));
  const [requirePhoto, setRequirePhoto] = useState(rule.require_photo ?? false);
  const [requireJustification, setRequireJustification] = useState(rule.require_justification ?? true);
  const [blockRouteCompletion, setBlockRouteCompletion] = useState(rule.block_route_completion ?? false);

  useEffect(() => {
    if (rule.id) {
      setEnabled(rule.enabled);
      setFrequency(rule.frequency);
      setPreferredWeekday(String(rule.preferred_weekday));
      setRequirePhoto(rule.require_photo);
      setRequireJustification(rule.require_justification);
      setBlockRouteCompletion(rule.block_route_completion);
    }
  }, [rule.id]);

  const handleSave = () => {
    upsert.mutate({
      brand_id: brandId,
      enabled, frequency,
      preferred_weekday: parseInt(preferredWeekday),
      require_photo: requirePhoto,
      require_justification: requireJustification,
      block_route_completion: blockRouteCompletion,
    }, { onSuccess: () => toast.success('Configuração salva!') });
  };

  const isRecurring = frequency !== 'once';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Regras da Pesquisa de Preço</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Pesquisa de preços ativa</Label>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Recorrência</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isRecurring && (
            <div>
              <Label>Dia preferencial</Label>
              <Select value={preferredWeekday} onValueChange={setPreferredWeekday}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {frequency === 'once' && (
          <p className="text-xs text-muted-foreground">
            A pesquisa será solicitada apenas uma vez, sem repetição automática.
          </p>
        )}
        <div className="flex items-center justify-between">
          <Label>Foto obrigatória</Label>
          <Switch checked={requirePhoto} onCheckedChange={setRequirePhoto} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Exigir justificativa se não executada</Label>
          <Switch checked={requireJustification} onCheckedChange={setRequireJustification} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Bloquear conclusão da rota sem pesquisa</Label>
          <Switch checked={blockRouteCompletion} onCheckedChange={setBlockRouteCompletion} />
        </div>
        <Button onClick={handleSave} disabled={upsert.isPending}>Salvar Configuração</Button>
      </CardContent>
    </Card>
  );
}

// ===== Competitors Panel =====
function CompetitorsPanel({ brandId }: { brandId: string }) {
  const { data: competitors = [] } = usePriceResearchCompetitors(brandId);
  const create = useCreateCompetitor();
  const update = useUpdateCompetitor();
  const del = useDeleteCompetitor();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return toast.error('Nome obrigatório');
    create.mutate({ brand_id: brandId, competitor_name: name, category }, {
      onSuccess: () => { setShowAdd(false); setName(''); setCategory(''); toast.success('Concorrente adicionado'); },
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Marcas Concorrentes</CardTitle>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
      </CardHeader>
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
    </Card>
  );
}

// ===== Product Mappings Panel =====
function ProductMappingsPanel({ brandId }: { brandId: string }) {
  const { data: mappings = [] } = usePriceResearchMappings(brandId);
  const { data: competitors = [] } = usePriceResearchCompetitors(brandId);
  const createMapping = useCreateProductMapping();
  const deleteMapping = useDeleteProductMapping();
  const createCP = useCreateCompetitorProduct();
  const deleteCP = useDeleteCompetitorProduct();
  const { data: products = [] } = useQuery({
    queryKey: ['merch-products-brand', brandId],
    queryFn: () => api<any[]>(`/api/merchandising/products?brand_id=${brandId}`),
    enabled: !!brandId,
  });

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showAddComp, setShowAddComp] = useState<string | null>(null);
  const [compName, setCompName] = useState('');
  const [compCompetitorId, setCompCompetitorId] = useState('');
  const [compPhotoUrl, setCompPhotoUrl] = useState('');

  const mappedProductIds = new Set(mappings.map((m: any) => m.product_id));
  const availableProducts = products.filter((p: any) => !mappedProductIds.has(p.id));

  const selectedProductData = products.find((p: any) => p.id === selectedProduct);

  const handleAddProduct = () => {
    if (!selectedProduct) return;
    createMapping.mutate({ brand_id: brandId, product_id: selectedProduct }, {
      onSuccess: () => { setShowAddProduct(false); setSelectedProduct(''); toast.success('Produto adicionado à pesquisa'); },
    });
  };

  const handleAddCompetitorProduct = () => {
    if (!compName.trim() || !compCompetitorId || !showAddComp) return;
    createCP.mutate({
      mapping_id: showAddComp,
      competitor_id: compCompetitorId,
      competitor_product_name: compName,
      photo_url: compPhotoUrl || null,
    }, {
      onSuccess: () => { setShowAddComp(null); setCompName(''); setCompCompetitorId(''); setCompPhotoUrl(''); toast.success('Produto concorrente adicionado'); },
    });
  };

  // Find full product info for a mapping
  const getProductInfo = (productId: string) => products.find((p: any) => p.id === productId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Produtos na Pesquisa</CardTitle>
          <Button size="sm" onClick={() => setShowAddProduct(true)}><Plus className="h-4 w-4 mr-1" />Adicionar Produto</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {mappings.map((m: any) => {
            const prodInfo = getProductInfo(m.product_id);
            return (
              <Card key={m.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {(prodInfo?.photo_url || m.photo_url) ? (
                      <img src={prodInfo?.photo_url || m.photo_url} alt={m.product_name} className="h-12 w-12 rounded object-cover border" />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{m.product_name || prodInfo?.name || m.product_id}</p>
                      {(prodInfo?.description || m.sku) && (
                        <p className="text-xs text-muted-foreground">{prodInfo?.description || `SKU: ${m.sku}`}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setShowAddComp(m.id)}>
                      <Plus className="h-3 w-3 mr-1" />Concorrente
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm('Remover?')) deleteMapping.mutate(m.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {m.competitor_products?.length > 0 && (
                  <div className="ml-4 space-y-1">
                    {m.competitor_products.map((cp: any) => (
                      <div key={cp.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                        <div className="flex items-center gap-2">
                          {cp.photo_url ? (
                            <img src={cp.photo_url} alt={cp.competitor_product_name} className="h-8 w-8 rounded object-cover border" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <span>{cp.competitor_name} — {cp.competitor_product_name}</span>
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteCP.mutate(cp.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {(!m.competitor_products || m.competitor_products.length === 0) && (
                  <p className="text-xs text-muted-foreground ml-4">Nenhum produto concorrente vinculado</p>
                )}
              </Card>
            );
          })}
          {mappings.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">Nenhum produto adicionado à pesquisa</p>
          )}
        </CardContent>
      </Card>

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
                {selectedProductData.photo_url ? (
                  <img src={selectedProductData.photo_url} alt={selectedProductData.name} className="h-16 w-16 rounded object-cover border" />
                ) : (
                  <div className="h-16 w-16 rounded bg-muted flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
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
                <SelectContent>
                  {competitors.filter((c: any) => c.active).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.competitor_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome do produto concorrente</Label>
              <Input value={compName} onChange={e => setCompName(e.target.value)} placeholder="Ex: Sabonete 85g" />
            </div>
            <div>
              <Label>Foto do produto (URL)</Label>
              <Input value={compPhotoUrl} onChange={e => setCompPhotoUrl(e.target.value)} placeholder="https://..." />
              {compPhotoUrl && (
                <div className="mt-2">
                  <img src={compPhotoUrl} alt="Preview" className="h-20 w-20 rounded object-cover border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddCompetitorProduct} disabled={createCP.isPending}>Adicionar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
