import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrands, useProducts, usePdvBrands, useAddPdvBrand, useRemovePdvBrand, useBrandPdvs, useMix, useAddToMix, useRemoveFromMix, useNetworks, useNetworkPdvs, useAddToMixBulk } from "@/hooks/use-merchandising";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search, Plus, Store, Building2, Package, ArrowRight, ArrowLeft, ChevronRight, Upload, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { MixImportDialog } from "@/components/merchandising/MixImportDialog";

export default function MerchMixPDV() {
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedPdvId, setSelectedPdvId] = useState<string>('');
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>('');
  const [selectionType, setSelectionType] = useState<'pdv' | 'network'>('pdv');
  const [productSearch, setProductSearch] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [selectedToRemove, setSelectedToRemove] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [pdvSearch, setPdvSearch] = useState('');

  const { data: allBrands = [] } = useBrands({ status: 'active' });
  const { data: brandPdvs = [] } = useBrandPdvs(selectedBrandId || undefined);
  const { data: allBrandProducts = [] } = useProducts({ brand_id: selectedBrandId || undefined });
  const { data: mixProducts = [] } = useMix(selectedPdvId || undefined, selectedBrandId || undefined);

  const addToMix = useAddToMix();
  const addToMixBulk = useAddToMixBulk();
  const removeFromMix = useRemoveFromMix();

  const { data: networks = [] } = useNetworks();
  const { data: networkPdvs = [] } = useNetworkPdvs(selectedNetworkId || undefined);

  const selectedPdv = brandPdvs.find((bp: any) => bp.pdv_id === selectedPdvId);
  const selectedNetwork = networks.find((n: any) => n.id === selectedNetworkId);
  const mixProductIds = new Set(mixProducts.map((m: any) => m.product_id));
  
  const filteredPdvs = useMemo(() => {
    return brandPdvs.filter((bp: any) => 
      bp.pdv_name.toLowerCase().includes(pdvSearch.toLowerCase()) ||
      bp.city?.toLowerCase().includes(pdvSearch.toLowerCase()) ||
      bp.state?.toLowerCase().includes(pdvSearch.toLowerCase())
    );
  }, [brandPdvs, pdvSearch]);

  const availableProducts = allBrandProducts.filter((p: any) => !mixProductIds.has(p.id) && p.name.toLowerCase().includes(productSearch.toLowerCase()));

  const handleAddToMix = async () => {
    if (selectedToAdd.length === 0) return;
    try {
      if (selectionType === 'network' && selectedNetworkId) {
        await addToMixBulk.mutateAsync({ 
          network_id: selectedNetworkId, 
          brand_id: selectedBrandId, 
          product_ids: selectedToAdd 
        });
        toast.success(`${selectedToAdd.length} produto(s) adicionado(s) à rede ${selectedNetwork?.name}`);
      } else {
        await addToMix.mutateAsync({ pdv_id: selectedPdvId, brand_id: selectedBrandId, product_ids: selectedToAdd });
        toast.success(`${selectedToAdd.length} produto(s) adicionado(s)`);
      }
      setSelectedToAdd([]);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRemoveFromMix = async () => {
    if (selectedToRemove.length === 0) return;
    try {
      await removeFromMix.mutateAsync({ pdv_id: selectedPdvId, brand_id: selectedBrandId, product_ids: selectedToRemove });
      toast.success(`${selectedToRemove.length} produto(s) removido(s)`);
      setSelectedToRemove([]);
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleAdd = (id: string) => setSelectedToAdd(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleRemove = (id: string) => setSelectedToRemove(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Brand Selector - First */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1 w-full">
                <Select value={selectedBrandId} onValueChange={v => { setSelectedBrandId(v); setSelectedPdvId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma marca" /></SelectTrigger>
                  <SelectContent>
                    {allBrands.filter((b: any) => b?.id).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        <span className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {b.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedBrandId && (
                <div className="text-sm text-muted-foreground">
                  <Store className="inline h-4 w-4 mr-1" />
                  {brandPdvs.length} PDV(s) vinculado(s)
                </div>
              )}
              <div className="flex gap-2">

                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Mix
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <MixImportDialog open={importOpen} onOpenChange={setImportOpen} />

        {selectedBrandId && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* PDVs Panel - only PDVs linked to the brand */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Agrupamento</CardTitle>
                  <div className="flex bg-muted p-1 rounded-md">
                    <Button 
                      variant={selectionType === 'pdv' ? 'secondary' : 'ghost'} 
                      size="sm" 
                      className="h-6 text-[10px] px-2"
                      onClick={() => setSelectionType('pdv')}
                    >
                      PDVs
                    </Button>
                    <Button 
                      variant={selectionType === 'network' ? 'secondary' : 'ghost'} 
                      size="sm" 
                      className="h-6 text-[10px] px-2"
                      onClick={() => setSelectionType('network')}
                    >
                      Redes
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                {selectionType === 'pdv' ? (
                  <>
                    <div className="px-2 pb-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input 
                          placeholder="Buscar PDV..." 
                          value={pdvSearch} 
                          onChange={e => setPdvSearch(e.target.value)} 
                          className="pl-7 h-8 text-xs" 
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-[400px]">
                      {filteredPdvs.map((bp: any) => (
                        <div
                          key={bp.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer mb-1 transition-colors ${selectedPdvId === bp.pdv_id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'}`}
                          onClick={() => setSelectedPdvId(bp.pdv_id)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate block">{bp.pdv_name}</span>
                              <span className="text-[10px] text-muted-foreground">{[bp.city, bp.state].filter(Boolean).join(' - ')}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      ))}
                      {filteredPdvs.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {pdvSearch ? 'Nenhum PDV encontrado' : 'Nenhum PDV vinculado a esta marca.'}
                        </p>
                      )}
                    </ScrollArea>
                  </>
                ) : (
                  <ScrollArea className="h-[400px]">
                    {networks.map((n: any) => (
                      <div
                        key={n.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer mb-1 transition-colors ${selectedNetworkId === n.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'}`}
                        onClick={() => setSelectedNetworkId(n.id)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <span className="text-sm font-medium truncate block">{n.name}</span>
                            <span className="text-[10px] text-muted-foreground">{n.pdv_count || 0} PDV(s)</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    ))}
                    {networks.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma rede cadastrada</p>
                    )}
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Dual List - Mix Editor */}
            {selectionType === 'pdv' ? (
              selectedPdvId ? (
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      Mix de Produtos — {selectedPdv?.pdv_name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4">
                      {/* Available Products */}
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-muted-foreground">Produtos Disponíveis ({availableProducts.length})</p>
                        </div>
                        <div className="relative mb-2">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <Input placeholder="Buscar..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-7 h-8 text-sm" />
                        </div>
                        <ScrollArea className="h-[300px]">
                          {availableProducts.map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded text-sm cursor-pointer" onClick={() => toggleAdd(p.id)}>
                              <Checkbox checked={selectedToAdd.includes(p.id)} />
                              {p.image_url ? <img src={p.image_url} className="h-6 w-6 rounded object-cover" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                              <span className="truncate">{p.name}</span>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex md:flex-col items-center justify-center gap-2">
                        <Button size="sm" variant="outline" disabled={selectedToAdd.length === 0} onClick={handleAddToMix}>
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" disabled={selectedToRemove.length === 0} onClick={handleRemoveFromMix}>
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Mix Products */}
                      <div className="border rounded-lg p-3 border-primary/30 bg-primary/5">
                        <p className="text-sm font-medium mb-2">Mix Atual ({mixProducts.length})</p>
                        <ScrollArea className="h-[332px]">
                          {mixProducts.map((m: any) => (
                            <div key={m.id} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded text-sm cursor-pointer" onClick={() => toggleRemove(m.product_id)}>
                              <Checkbox checked={selectedToRemove.includes(m.product_id)} />
                              {m.image_url ? <img src={m.image_url} className="h-6 w-6 rounded object-cover" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                              <span className="truncate flex-1">{m.product_name}</span>
                              {m.mandatory && <Badge variant="outline" className="text-[10px] px-1">Obrig.</Badge>}
                              <Badge variant="secondary" className="text-[10px] px-1">{m.priority}</Badge>
                            </div>
                          ))}
                          {mixProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto no mix</p>}
                        </ScrollArea>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="lg:col-span-3 flex items-center justify-center min-h-[400px]">
                  <p className="text-muted-foreground">Selecione um PDV para gerenciar o mix</p>
                </Card>
              )
            ) : (
              selectedNetworkId ? (
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      Mix de Produtos por Rede — {selectedNetwork?.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Ao salvar, os produtos serão vinculados a todos os PDVs desta rede ({networkPdvs.length} PDVs).</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4">
                      {/* Available Products */}
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-muted-foreground">Produtos Disponíveis</p>
                        </div>
                        <div className="relative mb-2">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <Input placeholder="Buscar..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-7 h-8 text-sm" />
                        </div>
                        <ScrollArea className="h-[300px]">
                          {allBrandProducts.filter((p: any) => p.name.toLowerCase().includes(productSearch.toLowerCase())).map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded text-sm cursor-pointer" onClick={() => toggleAdd(p.id)}>
                              <Checkbox checked={selectedToAdd.includes(p.id)} />
                              {p.image_url ? <img src={p.image_url} className="h-6 w-6 rounded object-cover" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                              <span className="truncate">{p.name}</span>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex md:flex-col items-center justify-center gap-2">
                        <Button size="sm" variant="default" disabled={selectedToAdd.length === 0} onClick={handleAddToMix} className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4" /> Salvar na Rede
                        </Button>
                      </div>

                      <div className="flex items-center justify-center p-8 bg-muted/20 rounded-lg border border-dashed text-center">
                        <div className="space-y-2">
                          <LayoutGrid className="h-10 w-10 mx-auto text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">
                            Selecione os produtos e clique em "Salvar na Rede" para atualizar todos os {networkPdvs.length} PDVs.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="lg:col-span-3 flex items-center justify-center min-h-[400px]">
                  <p className="text-muted-foreground">Selecione uma Rede para gerenciar o mix em massa</p>
                </Card>
              )
            )}
          </div>
        )}

        {!selectedBrandId && (
          <Card className="flex items-center justify-center min-h-[300px]">
            <div className="text-center space-y-2">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Selecione uma marca para gerenciar o mix de produtos por PDV</p>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}