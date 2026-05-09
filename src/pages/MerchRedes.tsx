import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useNetworks, useCreateNetwork, useUpdateNetwork, useDeleteNetwork, useNetworkPdvs, useUpdateNetworkPdvs } from "@/hooks/use-merchandising";
import { usePDVs } from "@/hooks/use-promotor";
import { Plus, Search, Pencil, Trash2, LayoutGrid, Store, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function MerchRedes() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pdvDialogOpen, setPdvDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<any>(null);
  const [pdvSearch, setPdvSearch] = useState('');

  const { data: networks = [], isLoading } = useNetworks();
  const createNetwork = useCreateNetwork();
  const updateNetwork = useUpdateNetwork();
  const deleteNetwork = useDeleteNetwork();

  const { data: allPdvs = [] } = usePDVs();
  const { data: networkPdvs = [] } = useNetworkPdvs(selectedNetwork?.id);
  const updateNetworkPdvs = useUpdateNetworkPdvs();

  const filteredNetworks = networks.filter((n: any) => n.name.toLowerCase().includes(search.toLowerCase()));
  
  const currentNetworkPdvIds = new Set(networkPdvs.map((p: any) => p.id));
  const filteredPdvs = allPdvs.filter((p: any) => 
    p.name?.toLowerCase().includes(pdvSearch.toLowerCase()) || 
    p.city?.toLowerCase().includes(pdvSearch.toLowerCase())
  );

  const openNew = () => { setForm({ name: '', description: '' }); setEditingId(null); setDialogOpen(true); };
  const openEdit = (n: any) => { setForm({ name: n.name, description: n.description || '' }); setEditingId(n.id); setDialogOpen(true); };
  
  const handleSave = async () => {
    if (!form.name) { toast.error('Nome é obrigatório'); return; }
    try {
      if (editingId) {
        await updateNetwork.mutateAsync({ id: editingId, ...form });
        toast.success('Rede atualizada');
      } else {
        await createNetwork.mutateAsync(form);
        toast.success('Rede criada');
      }
      setDialogOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir rede?')) return;
    try { await deleteNetwork.mutateAsync(id); toast.success('Excluída'); } catch (e: any) { toast.error(e.message); }
  };

  const togglePdv = async (pdvId: string) => {
    const nextIds = new Set(currentNetworkPdvIds);
    if (nextIds.has(pdvId)) nextIds.delete(pdvId); else nextIds.add(pdvId);
    try {
      await updateNetworkPdvs.mutateAsync({ id: selectedNetwork.id, pdv_ids: Array.from(nextIds) });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar rede..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Rede</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Rede</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>PDVs</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNetworks.map((n: any) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-primary" />
                        {n.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{n.description || '-'}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedNetwork(n); setPdvDialogOpen(true); }}>
                        <Store className="h-4 w-4 mr-2" /> Gerenciar PDVs
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(n)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filteredNetworks.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma rede cadastrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar Rede' : 'Nova Rede'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Grupo Pão de Açúcar" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pdvDialogOpen} onOpenChange={setPdvDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>PDVs na Rede: {selectedNetwork?.name}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar PDV..." value={pdvSearch} onChange={e => setPdvSearch(e.target.value)} className="pl-9" />
            </div>
            <ScrollArea className="h-[400px] border rounded-md p-2">
              <div className="space-y-1">
                {filteredPdvs.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md cursor-pointer" onClick={() => togglePdv(p.id)}>
                    <div className="flex items-center gap-3">
                      <Checkbox checked={currentNetworkPdvIds.has(p.id)} />
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.city} - {p.state}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button onClick={() => setPdvDialogOpen(false)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
