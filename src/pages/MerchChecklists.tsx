import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBrandChecklists, useCreateBrandChecklist, useUpdateBrandChecklist, useDeleteBrandChecklist } from "@/hooks/use-merch-routes";
import { useBrands } from "@/hooks/use-merchandising";
import { toast } from "sonner";
import { Plus, Edit, ClipboardList, Camera, Package, CalendarDays, Archive, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";

const FREQUENCIES = [
  { value: 'every_visit', label: 'Toda visita' },
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
];

export default function MerchChecklists() {
  const [selectedBrand, setSelectedBrand] = useState('');
  const { data: brands = [] } = useBrands();
  const { data: checklists = [], isLoading } = useBrandChecklists(selectedBrand || undefined);
  const createChecklist = useCreateBrandChecklist();
  const updateChecklist = useUpdateBrandChecklist();
  const deleteChecklist = useDeleteBrandChecklist();
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const openCreate = () => {
    setEditing(null);
    setForm({
      brand_id: selectedBrand, name: '', description: '',
      require_checkin_photo: true, require_checkout_photo: false,
      require_category_photos: true,
      category_photo_mode: 'both', // 'before', 'after', or 'both'
      min_category_photos_before: 1,
      min_category_photos_after: 1,
      require_stock_count: false, require_validity_check: false,
      require_extra_point: false,
      stock_count_frequency: 'every_visit', validity_check_frequency: 'every_visit',
    });
    setShowEditor(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ ...c });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.brand_id) { toast.error('Nome e marca são obrigatórios'); return; }
    try {
      if (editing) {
        await updateChecklist.mutateAsync({ id: editing.id, ...form });
        toast.success('Checklist atualizado');
      } else {
        await createChecklist.mutateAsync(form);
        toast.success('Checklist criado');
      }
      setShowEditor(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('Tem certeza que deseja excluir este checklist?')) return;
    try {
      await deleteChecklist.mutateAsync(id);
      toast.success('Checklist excluído');
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Select value={selectedBrand || '__all__'} onValueChange={v => setSelectedBrand(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as marcas</SelectItem>
                {brands.filter((b: any) => b?.id).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openCreate} disabled={!selectedBrand}>
            <Plus className="h-4 w-4 mr-1" /> Novo Checklist
          </Button>
        </div>

        {!selectedBrand && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Selecione uma marca para gerenciar seus checklists</p>
          </CardContent></Card>
        )}

        {/* Checklists List */}
        {selectedBrand && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {checklists.map((c: any) => (
              <Card key={c.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => openEdit(c)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{c.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" 
                        onClick={(e) => handleDelete(c.id, e)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Badge variant={c.active !== false ? 'default' : 'secondary'} className="text-[10px]">
                        {c.active !== false ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </div>
                  {c.brand_name && <p className="text-xs text-muted-foreground">{c.brand_name}</p>}
                </CardHeader>
                <CardContent>
                  {c.description && <p className="text-xs text-muted-foreground mb-3">{c.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {c.require_checkin_photo && <Badge variant="outline" className="text-[10px] gap-1"><Camera className="h-3 w-3" /> Foto Check-in</Badge>}
                    {c.require_checkout_photo && <Badge variant="outline" className="text-[10px] gap-1"><Camera className="h-3 w-3" /> Foto Check-out</Badge>}
                    {c.require_stock_count && <Badge variant="outline" className="text-[10px] gap-1"><Package className="h-3 w-3" /> Estoque ({FREQUENCIES.find(f => f.value === c.stock_count_frequency)?.label})</Badge>}
                    {c.require_validity_check && <Badge variant="outline" className="text-[10px] gap-1"><CalendarDays className="h-3 w-3" /> Validade ({FREQUENCIES.find(f => f.value === c.validity_check_frequency)?.label})</Badge>}
                    {c.require_extra_point && <Badge variant="outline" className="text-[10px] gap-1"><Archive className="h-3 w-3" /> Ponto Extra</Badge>}
                    {c.require_category_photos !== false && <Badge variant="outline" className="text-[10px] gap-1"><Camera className="h-3 w-3" /> Fotos Categoria (A/D)</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {checklists.length === 0 && !isLoading && (
              <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground text-sm">
                Nenhum checklist configurado para esta marca
              </CardContent></Card>
            )}
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {editing ? 'Editar Checklist' : 'Novo Checklist'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="rules">Regras</TabsTrigger>
              <TabsTrigger value="frequency">Periodicidade</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-3 mt-3">
              <div>
                <Label>Marca</Label>
                <Select value={form.brand_id || '__none__'} onValueChange={v => setForm({ ...form, brand_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione</SelectItem>
                    {brands.filter((b: any) => b?.id).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome do Checklist *</Label>
                <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Checklist Padrão Marca X" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Instruções gerais..." />
              </div>
              {editing && (
                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch checked={form.active !== false} onCheckedChange={v => setForm({ ...form, active: v })} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="rules" className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground">Defina o que é obrigatório em cada visita para esta marca.</p>
              {[
                { key: 'require_checkin_photo', label: 'Foto de Check-in obrigatória', icon: Camera },
                { key: 'require_checkout_photo', label: 'Foto de Check-out obrigatória', icon: Camera },
                { key: 'require_stock_count', label: 'Contagem de estoque obrigatória', icon: Package },
                { key: 'require_validity_check', label: 'Verificação de validade obrigatória', icon: CalendarDays },
                { key: 'require_extra_point', label: 'Verificação de ponto extra', icon: Archive },
                { key: 'require_category_photos', label: 'Fotos da categoria (Antes/Depois) obrigatórias', icon: Camera },
              ].map(r => (
                <div key={r.key} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <r.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{r.label}</span>
                  </div>
                  <Switch checked={!!form[r.key]} onCheckedChange={v => setForm({ ...form, [r.key]: v })} />
                </div>
              ))}

              {form.require_category_photos && (
                <div className="p-3 rounded-lg border bg-muted/30 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Camera className="h-3.5 w-3.5" /> Modo de fotos da categoria
                    </Label>
                    <Select value={form.category_photo_mode || 'both'} onValueChange={v => setForm({ ...form, category_photo_mode: v })}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Antes e Depois</SelectItem>
                        <SelectItem value="before">Somente Antes</SelectItem>
                        <SelectItem value="after">Somente Depois</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(form.category_photo_mode === 'both' || form.category_photo_mode === 'before') && (
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Mínimo ANTES</Label>
                        <Input
                          type="number" min={1} max={20}
                          value={form.min_category_photos_before ?? 1}
                          onChange={e => setForm({ ...form, min_category_photos_before: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        />
                      </div>
                    )}
                    {(form.category_photo_mode === 'both' || form.category_photo_mode === 'after') && (
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Mínimo DEPOIS</Label>
                        <Input
                          type="number" min={1} max={20}
                          value={form.min_category_photos_after ?? 1}
                          onChange={e => setForm({ ...form, min_category_photos_after: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {form.category_photo_mode === 'before' 
                      ? 'O promotor enviará fotos apenas antes de iniciar os ajustes.' 
                      : form.category_photo_mode === 'after' 
                      ? 'O promotor enviará fotos apenas após concluir os ajustes.' 
                      : 'O promotor enviará fotos do antes e do depois para comparação.'}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="frequency" className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground">Configure a periodicidade de cada tipo de verificação.</p>
              {form.require_stock_count && (
                <div>
                  <Label>Frequência de contagem de estoque</Label>
                  <Select value={form.stock_count_frequency || 'every_visit'} onValueChange={v => setForm({ ...form, stock_count_frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.require_validity_check && (
                <div>
                  <Label>Frequência de verificação de validade</Label>
                  <Select value={form.validity_check_frequency || 'every_visit'} onValueChange={v => setForm({ ...form, validity_check_frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!form.require_stock_count && !form.require_validity_check && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Ative contagem de estoque ou validade na aba "Regras" para configurar periodicidade.
                </p>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createChecklist.isPending || updateChecklist.isPending}>
              {editing ? 'Salvar Alterações' : 'Criar Checklist'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
