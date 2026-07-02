import { useMemo, useState } from "react";
import {
  useAppAccessTemplates,
  useCapabilityCatalog,
  useCreateAppTemplate,
  useUpdateAppTemplate,
  useDeleteAppTemplate,
  type AppTemplate,
} from "@/hooks/use-app-access-templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Loader2, Star } from "lucide-react";

export default function AppAccessTemplatesTab() {
  const { toast } = useToast();
  const { data: templates = [], isLoading } = useAppAccessTemplates();
  const { data: catalog = [] } = useCapabilityCatalog();
  const createMut = useCreateAppTemplate();
  const updateMut = useUpdateAppTemplate();
  const delMut = useDeleteAppTemplate();

  const [editing, setEditing] = useState<AppTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ name: string; description: string; is_default: boolean; caps: Set<string> }>(
    { name: "", description: "", is_default: false, caps: new Set() }
  );

  const grouped = useMemo(() => {
    const g: Record<string, { key: string; label: string }[]> = {};
    for (const c of catalog) (g[c.group] ||= []).push({ key: c.key, label: c.label });
    return g;
  }, [catalog]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", is_default: false, caps: new Set() });
    setCreating(true);
  }

  function openEdit(t: AppTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description || "",
      is_default: t.is_default,
      caps: new Set(t.capabilities || []),
    });
    setCreating(true);
  }

  function toggleCap(key: string, on: boolean) {
    setForm(f => {
      const s = new Set(f.caps);
      if (on) s.add(key); else s.delete(key);
      return { ...f, caps: s };
    });
  }

  function toggleGroup(group: string, on: boolean) {
    const keys = grouped[group]?.map(k => k.key) || [];
    setForm(f => {
      const s = new Set(f.caps);
      keys.forEach(k => { if (on) s.add(k); else s.delete(k); });
      return { ...f, caps: s };
    });
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: "Informe o nome do perfil", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      is_default: form.is_default,
      capabilities: Array.from(form.caps),
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...payload });
        toast({ title: "Perfil atualizado" });
      } else {
        await createMut.mutateAsync(payload);
        toast({ title: "Perfil criado" });
      }
      setCreating(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function remove(t: AppTemplate) {
    if (!confirm(`Excluir o perfil "${t.name}"?\nOs colaboradores vinculados ficarão sem perfil (voltam ao padrão).`)) return;
    try {
      await delMut.mutateAsync(t.id);
      toast({ title: "Perfil excluído" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Perfis do App do Colaborador</h2>
          <p className="text-sm text-muted-foreground">
            Defina o que cada tipo de colaborador pode fazer no app (bater ponto, ver holerite, pedir férias etc.).
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Novo perfil</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {t.name}
                    {t.is_default && (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-amber-500/10 text-amber-700 border-amber-200">
                        <Star className="h-3 w-3" /> padrão
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => remove(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {t.employees_count} colaborador(es)
                </div>
                <div className="flex flex-wrap gap-1">
                  {(t.capabilities || []).slice(0, 6).map(c => (
                    <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                  ))}
                  {(t.capabilities || []).length > 6 && (
                    <Badge variant="outline" className="text-[10px]">+{t.capabilities.length - 6}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-6">
              Nenhum perfil configurado ainda.
            </p>
          )}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar perfil" : "Novo perfil de acesso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex.: Vendedor de loja" />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 flex items-center gap-2 border rounded-md px-3 h-10">
                  <Switch checked={form.is_default} onCheckedChange={v => setForm(f => ({ ...f, is_default: v }))} />
                  <span className="text-sm">Usar como perfil padrão da organização</span>
                </div>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            <div className="space-y-4">
              {Object.entries(grouped).map(([group, items]) => {
                const allOn = items.every(i => form.caps.has(i.key));
                const someOn = items.some(i => form.caps.has(i.key));
                return (
                  <div key={group} className="rounded-lg border">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                      <p className="text-sm font-semibold">{group}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {items.filter(i => form.caps.has(i.key)).length}/{items.length}
                        </span>
                        <Switch
                          checked={allOn}
                          onCheckedChange={v => toggleGroup(group, v)}
                          aria-label={`Ativar todos de ${group}`}
                        />
                      </div>
                    </div>
                    <div className="divide-y">
                      {items.map(i => (
                        <div key={i.key} className="flex items-center justify-between px-3 py-2">
                          <div>
                            <p className="text-sm">{i.label}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{i.key}</p>
                          </div>
                          <Switch
                            checked={form.caps.has(i.key)}
                            onCheckedChange={v => toggleCap(i.key, v)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={save} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar alterações" : "Criar perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
