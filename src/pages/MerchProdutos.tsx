import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useBulkDeleteProducts, useBrands, useCategories, useSubcategories, useImportProducts } from "@/hooks/use-merchandising";
import { FileUploadInput } from "@/components/ui/file-upload-input";
import { mapProductImportRow, parseImportFile } from "@/lib/merch-import";
import { Plus, Search, Pencil, Trash2, Package, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const emptyProduct = { name: '', brand_id: '', category_id: '', subcategory_id: '', sku: '', internal_code: '', barcode: '', description: '', image_url: '', unit: 'un', status: 'active' };

export default function MerchProdutos() {
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading } = useProducts({ search, brand_id: brandFilter, category_id: catFilter });
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();
  const { data: subcategories = [] } = useSubcategories(form.category_id || undefined);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const bulkDeleteProducts = useBulkDeleteProducts();
  const importProducts = useImportProducts();

  const openNew = () => { setForm({ ...emptyProduct }); setEditingId(null); setDialogOpen(true); };
  const openEdit = (p: any) => { setForm({ ...p }); setEditingId(p.id); setDialogOpen(true); };
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.brand_id || !form.category_id || !form.subcategory_id) { toast.error('Preencha nome, marca, categoria e subcategoria'); return; }
    try {
      if (editingId) { await updateProduct.mutateAsync({ id: editingId, ...form }); toast.success('Atualizado'); }
      else { await createProduct.mutateAsync(form); toast.success('Criado'); }
      setDialogOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir produto?')) return;
    try { await deleteProduct.mutateAsync(id); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!confirm(`Excluir ${selectedIds.size} produto(s) selecionado(s)?`)) return;

    try {
      const result = await bulkDeleteProducts.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
      toast.success(`${result.deleted} excluído(s)`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(products.map((product: any) => product.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseImportFile(file);
      const items = rows.map(mapProductImportRow).filter(item => item.name);
      if (!items.length) {
        toast.error('Nenhuma linha válida de produto foi reconhecida no arquivo');
        return;
      }
      const result = await importProducts.mutateAsync({ items, auto_create: true });
      if (result.success > 0) toast.success(`${result.success} produtos importados`);
      if (result.errors?.length > 0) {
        const firstError = result.errors[0];
        toast.error(`${result.errors.length} erro(s). Linha ${firstError.line || firstError.row || '-'}: ${firstError.error}`);
      }
    } catch (err: any) { toast.error(err.message); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleExport = () => {
    const data = products.map((p: any) => ({
      nome: p.name, marca: p.brand_name, categoria: p.category_name, subcategoria: p.subcategory_name,
      sku: p.sku, codigo_barras: p.barcode, unidade: p.unit, status: p.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    XLSX.writeFile(wb, 'produtos.xlsx');
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />Excluir {selectedIds.size}
              </Button>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Importar</Button>
            <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" />Exportar</Button>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Produto</Button>
          </div>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={products.length > 0 && selectedIds.size === products.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="hidden md:table-cell">Marca</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="hidden lg:table-cell">SKU</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p: any) => (
                <TableRow key={p.id} className={selectedIds.has(p.id) ? 'bg-primary/5' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleOne(p.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {p.image_url ? <img src={p.image_url} className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center"><Package className="h-4 w-4 text-primary" /></div>}
                      <div><p className="font-medium">{p.name}</p>{p.barcode && <p className="text-xs text-muted-foreground">{p.barcode}</p>}</div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{p.brand_name}</TableCell>
                  <TableCell className="hidden md:table-cell"><span>{p.category_name}</span>{p.subcategory_name && <span className="text-muted-foreground"> / {p.subcategory_name}</span>}</TableCell>
                  <TableCell className="hidden lg:table-cell">{p.sku || '-'}</TableCell>
                  <TableCell><Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status === 'active' ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && products.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produto</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Produto</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="space-y-2"><Label>Marca *</Label>
              <Select value={form.brand_id} onValueChange={v => set('brand_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="z-[9999]">{brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Categoria *</Label>
              <Select value={form.category_id || undefined} onValueChange={v => { setForm(prev => ({ ...prev, category_id: v, subcategory_id: '' })); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="z-[9999]">{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Subcategoria *</Label>
              <Select value={form.subcategory_id || undefined} onValueChange={v => set('subcategory_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="z-[9999]">{subcategories.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>SKU</Label><Input value={form.sku} onChange={e => set('sku', e.target.value)} /></div>
            <div className="space-y-2"><Label>Código Interno</Label><Input value={form.internal_code} onChange={e => set('internal_code', e.target.value)} /></div>
            <div className="space-y-2"><Label>Código de Barras</Label><Input value={form.barcode} onChange={e => set('barcode', e.target.value)} /></div>
            <div className="space-y-2"><Label>Unidade</Label>
              <Select value={form.unit} onValueChange={v => set('unit', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[9999]">
                  <SelectItem value="un">Unidade</SelectItem>
                  <SelectItem value="cx">Caixa</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                  <SelectItem value="lt">Litro</SelectItem>
                  <SelectItem value="pc">Pacote</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-full space-y-2"><Label>Foto</Label><FileUploadInput value={form.image_url || ''} onChange={v => set('image_url', v)} accept="image/*" /></div>
            <div className="col-span-full space-y-2"><Label>Descrição</Label><Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
