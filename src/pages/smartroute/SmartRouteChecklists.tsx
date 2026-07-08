import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Trash2, Pencil, ArrowUp, ArrowDown, Save, Target } from "lucide-react";
import { toast } from "sonner";
import {
  useChecklistTemplates, useChecklistTemplate, useSaveChecklistTemplate, useDeleteChecklistTemplate,
  useSaveChecklistItems, useChecklistAssignments, useSaveChecklistAssignment,
  useDeleteChecklistAssignment, FIELD_TYPES,
} from "@/hooks/use-smartroute-checklists";

function TemplatesPanel({ selectedId, onSelect }: { selectedId?: string; onSelect: (id: string) => void }) {
  const { data = [] } = useChecklistTemplates();
  const save = useSaveChecklistTemplate();
  const del = useDeleteChecklistTemplate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const submit = async () => {
    if (!form.name?.trim()) return toast.error("Nome obrigatório");
    const r: any = await save.mutateAsync(form);
    toast.success("Template salvo");
    setOpen(false); setForm({});
    if (r?.id) onSelect(r.id);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Templates</CardTitle>
        <Button size="sm" onClick={() => { setForm({}); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Novo</Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {data.map((t: any) => (
          <button key={t.id} onClick={() => onSelect(t.id)}
            className={`w-full text-left p-2 rounded border flex items-center justify-between hover:bg-slate-50 ${selectedId === t.id ? "border-blue-500 bg-blue-50" : ""}`}>
            <div>
              <div className="text-sm font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.items_count} itens · prioridade {t.priority}</div>
            </div>
            <div className="flex gap-1">
              <Badge variant={t.active ? "default" : "secondary"}>{t.active ? "Ativo" : "Inativo"}</Badge>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm("Excluir template?")) del.mutate(t.id); }}>
                <Trash2 className="w-3 h-3 text-red-500" />
              </Button>
            </div>
          </button>
        ))}
        {!data.length && <div className="text-xs text-muted-foreground text-center py-4">Nenhum template criado.</div>}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo template de checklist</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome*</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prioridade</Label><Input type="number" value={form.priority ?? 100} onChange={(e) => setForm({ ...form, priority: +e.target.value })} /></div>
              <div className="flex items-end gap-2"><Switch checked={form.active !== false} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={submit}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ItemsEditor({ templateId }: { templateId: string }) {
  const { data } = useChecklistTemplate(templateId);
  const save = useSaveChecklistItems();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { setItems(data?.items || []); }, [data?.id]);

  const add = () => setItems([...items, { field_type: "photo", label: "Novo item", required: true, config: {} }]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= items.length) return;
    const c = [...items]; [c[i], c[j]] = [c[j], c[i]]; setItems(c);
  };
  const upd = (i: number, patch: any) => { const c = [...items]; c[i] = { ...c[i], ...patch }; setItems(c); };
  const remove = (i: number) => setItems(items.filter((_, k) => k !== i));

  const submit = async () => {
    await save.mutateAsync({ id: templateId, items });
    toast.success("Itens salvos");
  };

  if (!data) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Itens · {data.name}</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={add}><Plus className="w-4 h-4 mr-1" /> Item</Button>
          <Button size="sm" onClick={submit} disabled={save.isPending}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="border rounded p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
              <Input className="flex-1" value={it.label} onChange={(e) => upd(i, { label: e.target.value })} />
              <Select value={it.field_type} onValueChange={(v) => upd(i, { field_type: v })}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1"><Switch checked={!!it.required} onCheckedChange={(v) => upd(i, { required: v })} /><span className="text-xs">Obrig.</span></div>
              <Button size="icon" variant="ghost" onClick={() => move(i, -1)}><ArrowUp className="w-3 h-3" /></Button>
              <Button size="icon" variant="ghost" onClick={() => move(i, 1)}><ArrowDown className="w-3 h-3" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
            </div>
            {(it.field_type === "multi_choice") && (
              <Input placeholder="Opções separadas por vírgula" value={(it.config?.options || []).join(", ")}
                onChange={(e) => upd(i, { config: { ...it.config, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })} />
            )}
            {(it.field_type === "number" || it.field_type === "temperature" || it.field_type === "stock_count") && (
              <div className="flex gap-2">
                <Input type="number" placeholder="min" value={it.config?.min ?? ""} onChange={(e) => upd(i, { config: { ...it.config, min: e.target.value === "" ? undefined : +e.target.value } })} />
                <Input type="number" placeholder="max" value={it.config?.max ?? ""} onChange={(e) => upd(i, { config: { ...it.config, max: e.target.value === "" ? undefined : +e.target.value } })} />
              </div>
            )}
          </div>
        ))}
        {!items.length && <div className="text-xs text-muted-foreground text-center py-6">Nenhum item. Adicione o primeiro.</div>}
      </CardContent>
    </Card>
  );
}

function AssignmentsPanel() {
  const { data = [] } = useChecklistAssignments();
  const { data: tpls = [] } = useChecklistTemplates();
  const save = useSaveChecklistAssignment();
  const del = useDeleteChecklistAssignment();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ scope: {}, priority: 100, active: true });

  const submit = async () => {
    if (!form.template_id) return toast.error("Selecione o template");
    await save.mutateAsync({
      ...form,
      scope: Object.fromEntries(
        Object.entries(form.scope || {}).map(([k, v]) => [k, typeof v === "string"
          ? (v as string).split(",").map((s) => s.trim()).filter(Boolean) : v])
      ),
    });
    toast.success("Vinculação salva");
    setOpen(false); setForm({ scope: {}, priority: 100, active: true });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4" /> Vinculações</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Nova</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((a: any) => (
          <div key={a.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{a.template_name}</div>
              <div className="text-xs text-muted-foreground">
                Escopo: {Object.entries(a.scope || {}).filter(([_, v]: any) => v?.length).map(([k, v]: any) => `${k}(${v.length})`).join(" · ") || "todos"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={a.active ? "default" : "secondary"}>{a.active ? "Ativa" : "Inativa"}</Badge>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover vinculação?")) del.mutate(a.id); }}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
        {!data.length && <div className="text-xs text-muted-foreground text-center py-6">Sem vinculações.</div>}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Vincular template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Template*</Label>
              <Select value={form.template_id || ""} onValueChange={(v) => setForm({ ...form, template_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {tpls.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {["pdv_types", "channels", "categories", "regions", "states", "cities"].map((k) => (
              <div key={k}>
                <Label className="capitalize">{k.replace("_", " ")}</Label>
                <Input placeholder="separe por vírgula (vazio = todos)"
                  value={Array.isArray(form.scope?.[k]) ? form.scope[k].join(", ") : (form.scope?.[k] || "")}
                  onChange={(e) => setForm({ ...form, scope: { ...(form.scope || {}), [k]: e.target.value } })} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prioridade</Label><Input type="number" value={form.priority ?? 100} onChange={(e) => setForm({ ...form, priority: +e.target.value })} /></div>
              <div className="flex items-end gap-2"><Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativa</Label></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={submit}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function SmartRouteChecklists() {
  const [selected, setSelected] = useState<string>();
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Checklists inteligentes</h1>
            <p className="text-sm text-muted-foreground">Regras aplicadas às entregas conforme atributos do PDV.</p>
          </div>
        </div>
        <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates">Templates & Itens</TabsTrigger>
            <TabsTrigger value="assignments">Vinculações</TabsTrigger>
          </TabsList>
          <TabsContent value="templates">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-1"><TemplatesPanel selectedId={selected} onSelect={setSelected} /></div>
              <div className="md:col-span-2">
                {selected
                  ? <ItemsEditor templateId={selected} />
                  : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Selecione um template ao lado ou crie um novo.</CardContent></Card>}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="assignments"><AssignmentsPanel /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
