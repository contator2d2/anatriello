import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useSubcategories, useCreateSubcategory, useUpdateSubcategory, useDeleteSubcategory, useImportCategories } from "@/hooks/use-merchandising";
import { Plus, Pencil, Trash2, FolderTree, Upload } from "lucide-react";
import { toast } from "sonner";

export default function MerchCategorias() {
  const [tab, setTab] = useState('categorias');
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [catForm, setCatForm] = useState<any>({ name: '', description: '', status: 'active' });
  const [subForm, setSubForm] = useState<any>({ name: '', category_id: '', description: '', status: 'active' });
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);

  const { data: categories = [] } = useCategories();
  const { data: subcategories = [] } = useSubcategories();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  const createSub = useCreateSubcategory();
  const updateSub = useUpdateSubcategory();
  const deleteSub = useDeleteSubcategory();

  const openNewCat = () => { setCatForm({ name: '', description: '', status: 'active' }); setEditingCatId(null); setCatDialogOpen(true); };
  const openEditCat = (c: any) => { setCatForm({ ...c }); setEditingCatId(c.id); setCatDialogOpen(true); };
  const openNewSub = () => { setSubForm({ name: '', category_id: categories[0]?.id || '', description: '', status: 'active' }); setEditingSubId(null); setSubDialogOpen(true); };
  const openEditSub = (s: any) => { setSubForm({ ...s }); setEditingSubId(s.id); setSubDialogOpen(true); };

  const saveCat = async () => {
    if (!catForm.name) { toast.error('Nome obrigatório'); return; }
    try {
      if (editingCatId) { await updateCat.mutateAsync({ id: editingCatId, ...catForm }); toast.success('Atualizada'); }
      else { await createCat.mutateAsync(catForm); toast.success('Criada'); }
      setCatDialogOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const saveSub = async () => {
    if (!subForm.name || !subForm.category_id) { toast.error('Nome e categoria obrigatórios'); return; }
    try {
      if (editingSubId) { await updateSub.mutateAsync({ id: editingSubId, ...subForm }); toast.success('Atualizada'); }
      else { await createSub.mutateAsync(subForm); toast.success('Criada'); }
      setSubDialogOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <MainLayout>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="subcategorias">Subcategorias</TabsTrigger>
          </TabsList>
          <Button onClick={tab === 'categorias' ? openNewCat : openNewSub}><Plus className="h-4 w-4 mr-2" />Nova</Button>
        </div>

        <TabsContent value="categorias">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {categories.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><FolderTree className="h-4 w-4 text-primary" />{c.name}</div></TableCell>
                    <TableCell>{c.description || '-'}</TableCell>
                    <TableCell><Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status === 'active' ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditCat(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm('Excluir?')) deleteCat.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {categories.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma categoria</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="subcategorias">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {subcategories.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.category_name}</TableCell>
                    <TableCell><Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{s.status === 'active' ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditSub(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm('Excluir?')) deleteSub.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {subcategories.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma subcategoria</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCatId ? 'Editar' : 'Nova'} Categoria</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={catForm.name} onChange={e => setCatForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={catForm.description || ''} onChange={e => setCatForm((p: any) => ({ ...p, description: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={catForm.status} onValueChange={v => setCatForm((p: any) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="inactive">Inativo</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveCat}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSubId ? 'Editar' : 'Nova'} Subcategoria</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={subForm.name} onChange={e => setSubForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Categoria *</Label>
              <Select value={subForm.category_id} onValueChange={v => setSubForm((p: any) => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={subForm.description || ''} onChange={e => setSubForm((p: any) => ({ ...p, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveSub}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
