import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBrands, useCreateBrand, useUpdateBrand, useDeleteBrand } from "@/hooks/use-merchandising";
import { FileUploadInput } from "@/components/ui/file-upload-input";
import { Plus, Search, Pencil, Trash2, Building2, Package, Store } from "lucide-react";
import { toast } from "sonner";

const emptyBrand = { name: '', razao_social: '', cnpj: '', logo_url: '', description: '', segment: '', responsible: '', phone: '', email: '', status: 'active', notes: '' };

export default function MerchMarcas() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyBrand);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: brands = [], isLoading } = useBrands({ search, status: statusFilter });
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();

  const openNew = () => { setForm({ ...emptyBrand }); setEditingId(null); setDialogOpen(true); };
  const openEdit = (b: any) => { setForm({ ...b }); setEditingId(b.id); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name) { toast.error('Nome é obrigatório'); return; }
    try {
      if (editingId) {
        await updateBrand.mutateAsync({ id: editingId, ...form });
        toast.success('Marca atualizada');
      } else {
        await createBrand.mutateAsync(form);
        toast.success('Marca criada');
      }
      setDialogOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir marca?')) return;
    try { await deleteBrand.mutateAsync(id); toast.success('Excluída'); } catch (e: any) { toast.error(e.message); }
  };

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar marca..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Marca</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead className="hidden md:table-cell">Segmento</TableHead>
                  <TableHead className="hidden md:table-cell">Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {b.logo_url ? (
                          <img src={b.logo_url} alt={b.name} className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{b.name}</p>
                          {b.cnpj && <p className="text-xs text-muted-foreground">{b.cnpj}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{b.segment || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">{b.responsible || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={b.status === 'active' ? 'default' : 'secondary'}>
                        {b.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && brands.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma marca cadastrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Marca' : 'Nova Marca'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="space-y-2"><Label>Razão Social</Label><Input value={form.razao_social} onChange={e => set('razao_social', e.target.value)} /></div>
            <div className="space-y-2"><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => set('cnpj', e.target.value)} /></div>
            <div className="space-y-2"><Label>Segmento</Label><Input value={form.segment} onChange={e => set('segment', e.target.value)} /></div>
            <div className="space-y-2"><Label>Responsável</Label><Input value={form.responsible} onChange={e => set('responsible', e.target.value)} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-full space-y-2"><Label>Logotipo</Label><FileUploadInput value={form.logo_url || ''} onChange={v => set('logo_url', v)} accept="image/*" /></div>
            <div className="col-span-full space-y-2"><Label>Descrição</Label><Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} /></div>
            <div className="col-span-full space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createBrand.isPending || updateBrand.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
