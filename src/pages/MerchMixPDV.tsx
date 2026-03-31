import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrands, useProducts, usePdvBrands, useAddPdvBrand, useRemovePdvBrand, useMix, useAddToMix, useRemoveFromMix } from "@/hooks/use-merchandising";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search, Plus, Trash2, Store, Building2, Package, ArrowRight, ArrowLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function MerchMixPDV() {
  const [selectedPdvId, setSelectedPdvId] = useState<string>('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [addBrandDialogOpen, setAddBrandDialogOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [selectedToRemove, setSelectedToRemove] = useState<string[]>([]);

  // Fetch PDVs from RH module
  const { data: pdvs = [] } = useQuery({
    queryKey: ['rh-pdvs-list'],
    queryFn: () => api<any[]>('/api/promotor/rh/pdvs'),
  });

  const { data: allBrands = [] } = useBrands({ status: 'active' });
  const { data: pdvBrands = [] } = usePdvBrands(selectedPdvId || undefined);
  const { data: allBrandProducts = [] } = useProducts({ brand_id: selectedBrandId || undefined });
  const { data: mixProducts = [] } = useMix(selectedPdvId || undefined, selectedBrandId || undefined);

  const addPdvBrand = useAddPdvBrand();
  const removePdvBrand = useRemovePdvBrand();
  const addToMix = useAddToMix();
  const removeFromMix = useRemoveFromMix();

  const selectedPdv = pdvs.find((p: any) => p.id === selectedPdvId);
  const mixProductIds = new Set(mixProducts.map((m: any) => m.product_id));
  const availableProducts = allBrandProducts.filter((p: any) => !mixProductIds.has(p.id) && p.name.toLowerCase().includes(productSearch.toLowerCase()));

  const handleAddBrand = async (brandId: string) => {
    try {
      await addPdvBrand.mutateAsync({ pdv_id: selectedPdvId, brand_id: brandId });
      toast.success('Marca vinculada');
      setAddBrandDialogOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRemoveBrand = async (pbId: string) => {
    if (!confirm('Desvincular marca?')) return;
    try { await removePdvBrand.mutateAsync(pbId); toast.success('Desvinculada'); setSelectedBrandId(''); } catch (e: any) { toast.error(e.message); }
  };

  const handleAddToMix = async () => {
    if (selectedToAdd.length === 0) return;
    try {
      await addToMix.mutateAsync({ pdv_id: selectedPdvId, brand_id: selectedBrandId, product_ids: selectedToAdd });
      toast.success(`${selectedToAdd.length} produto(s) adicionado(s)`);
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
        {/* PDV Selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1 w-full">
                <Select value={selectedPdvId} onValueChange={v => { setSelectedPdvId(v); setSelectedBrandId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione um PDV" /></SelectTrigger>
                  <SelectContent>
                    {pdvs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} {p.network ? `(${p.network})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedPdv && (
                <div className="text-sm text-muted-foreground">
                  <Store className="inline h-4 w-4 mr-1" />
                  {selectedPdv.city} - {selectedPdv.state}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedPdvId && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Brands Panel */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">Marcas do PDV</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setAddBrandDialogOpen(true)}><Plus className="h-3 w-3" /></Button>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[400px]">
                  {pdvBrands.map((pb: any) => (
                    <div
                      key={pb.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer mb-1 transition-colors ${selectedBrandId === pb.brand_id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'}`}
                      onClick={() => setSelectedBrandId(pb.brand_id)}
                    >
                      <div className="flex items-center gap-2">
                        {pb.logo_url ? <img src={pb.logo_url} className="h-6 w-6 rounded" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-sm font-medium">{pb.brand_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); handleRemoveBrand(pb.id); }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                  {pdvBrands.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma marca vinculada</p>}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Dual List - Mix Editor */}
            {selectedBrandId ? (
              <Card className="lg:col-span-3">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Gestão de Mix</CardTitle>
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
                <p className="text-muted-foreground">Selecione uma marca para gerenciar o mix</p>
              </Card>
            )}
          </div>
        )}

        {!selectedPdvId && (
          <Card className="flex items-center justify-center min-h-[300px]">
            <div className="text-center space-y-2">
              <Store className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Selecione um PDV para gerenciar o mix de produtos</p>
            </div>
          </Card>
        )}
      </div>

      {/* Add Brand Dialog */}
      <Dialog open={addBrandDialogOpen} onOpenChange={setAddBrandDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vincular Marca ao PDV</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {allBrands.filter((b: any) => !pdvBrands.some((pb: any) => pb.brand_id === b.id)).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer" onClick={() => handleAddBrand(b.id)}>
                <div className="flex items-center gap-2">
                  {b.logo_url ? <img src={b.logo_url} className="h-8 w-8 rounded" /> : <Building2 className="h-5 w-5 text-muted-foreground" />}
                  <span className="font-medium">{b.name}</span>
                </div>
                <Plus className="h-4 w-4 text-primary" />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
