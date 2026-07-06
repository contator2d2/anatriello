import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Shirt, HardHat, Key, Package, RotateCcw, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import {
  useItemCatalog, useCreateCatalogItem, useUpdateCatalogItem, useDeleteCatalogItem,
  useItemAssignments, useCreateAssignment, useReturnAssignment, useDeleteAssignment, useItemsSummary,
} from "@/hooks/use-rh-management";
import { useEmployees } from "@/hooks/use-rh";

const KIND_META: Record<string, { label: string; icon: any; color: string }> = {
  uniforme: { label: "Uniforme", icon: Shirt, color: "#3b82f6" },
  epi: { label: "EPI", icon: HardHat, color: "#f59e0b" },
  chave: { label: "Chave / Armário", icon: Key, color: "#8b5cf6" },
  outro: { label: "Outro", icon: Package, color: "#64748b" },
};

const brl = (cents: number) => `R$ ${((cents || 0) / 100).toFixed(2).replace('.', ',')}`;

export default function RHItens() {
  const [tab, setTab] = useState("assignments");
  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Uniformes, EPIs e Chaves</h1>
          <p className="text-sm text-muted-foreground">Controle de entrega, devolução e custos.</p>
        </div>
        <SummaryCards />
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="assignments">Entregas</TabsTrigger>
            <TabsTrigger value="catalog">Catálogo</TabsTrigger>
          </TabsList>
          <TabsContent value="assignments"><AssignmentsPanel /></TabsContent>
          <TabsContent value="catalog"><CatalogPanel /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function SummaryCards() {
  const { data = [] } = useItemsSummary();
  const kinds = ['uniforme', 'epi', 'chave', 'outro'];
  const map: Record<string, any> = {};
  data.forEach((r: any) => { map[r.kind] = r; });
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kinds.map(k => {
        const meta = KIND_META[k];
        const r = map[k] || { ativos: 0, devolvidos: 0, custo_ativo_cents: 0 };
        return (
          <Card key={k}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: `${meta.color}15`, color: meta.color }}>
                <meta.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{meta.label}</p>
                <p className="text-lg font-bold">{r.ativos} <span className="text-xs text-muted-foreground font-normal">ativos</span></p>
                <p className="text-[10px] text-muted-foreground">Custo: {brl(Number(r.custo_ativo_cents))}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AssignmentsPanel() {
  const [filter, setFilter] = useState<{ status?: string; kind?: string }>({ status: 'ativo' });
  const { data: assignments = [], isLoading } = useItemAssignments(filter);
  const { data: catalog = [] } = useItemCatalog();
  const { data: employees = [] } = useEmployees();
  const createAsg = useCreateAssignment();
  const returnAsg = useReturnAssignment();
  const delAsg = useDeleteAssignment();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ quantity: 1 });
  const [returning, setReturning] = useState<any>(null);
  const [returnData, setReturnData] = useState<any>({});

  const submit = async () => {
    if (!form.employee_id || !form.catalog_id) { toast.error('Selecione colaborador e item'); return; }
    try {
      await createAsg.mutateAsync(form);
      toast.success('Entrega registrada');
      setOpen(false); setForm({ quantity: 1 });
    } catch (e: any) { toast.error(e.message); }
  };

  const submitReturn = async () => {
    try {
      await returnAsg.mutateAsync({ id: returning.id, ...returnData });
      toast.success('Devolução registrada');
      setReturning(null); setReturnData({});
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter.status || '__all__'} onValueChange={v => setFilter({ ...filter, status: v === '__all__' ? undefined : v })}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="devolvido">Devolvidos</SelectItem>
            <SelectItem value="perdido">Perdidos</SelectItem>
            <SelectItem value="danificado">Danificados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filter.kind || '__all__'} onValueChange={v => setFilter({ ...filter, kind: v === '__all__' ? undefined : v })}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos tipos</SelectItem>
            {Object.entries(KIND_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova entrega</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Devolução</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!isLoading && assignments.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma entrega</TableCell></TableRow>
              )}
              {assignments.map((a: any) => {
                const meta = KIND_META[a.kind_snapshot || a.catalog_kind || 'outro'];
                return (
                  <TableRow key={a.id}>
                    <TableCell>{a.employee_name || '—'}</TableCell>
                    <TableCell>{a.item_name_snapshot || a.catalog_name || '—'}</TableCell>
                    <TableCell><Badge variant="outline" style={{ color: meta.color }}>{meta.label}</Badge></TableCell>
                    <TableCell>{a.quantity}</TableCell>
                    <TableCell>{brl(a.cost_cents_snapshot)}</TableCell>
                    <TableCell className="text-xs">{a.delivered_at || '—'}</TableCell>
                    <TableCell className="text-xs">{a.returned_at || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === 'ativo' ? 'default' : 'secondary'}>{a.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {a.status === 'ativo' && (
                          <Button variant="ghost" size="icon" title="Devolver" onClick={() => { setReturning(a); setReturnData({}); }}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" title="Excluir" onClick={async () => {
                          if (!confirm('Excluir esta entrega?')) return;
                          try { await delAsg.mutateAsync(a.id); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
                        }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New assignment */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova entrega</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador *</Label>
              <Select value={form.employee_id || ''} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Item *</Label>
              <Select value={form.catalog_id || ''} onValueChange={v => setForm({ ...form, catalog_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione do catálogo" /></SelectTrigger>
                <SelectContent>
                  {catalog.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      [{KIND_META[c.kind]?.label}] {c.name} {c.size ? `— ${c.size}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {catalog.length === 0 && <p className="text-xs text-amber-600 mt-1">Cadastre itens no catálogo primeiro.</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min={1} value={form.quantity ?? 1} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <Label>Data entrega</Label>
                <Input type="date" value={form.delivered_at || ''} onChange={e => setForm({ ...form, delivered_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Condição</Label>
              <Input placeholder="Ex: novo, usado" value={form.condition_out || ''} onChange={e => setForm({ ...form, condition_out: e.target.value })} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={createAsg.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return */}
      <Dialog open={!!returning} onOpenChange={o => !o && setReturning(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar devolução</DialogTitle></DialogHeader>
          {returning && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <b>{returning.item_name_snapshot}</b> — {returning.employee_name}
              </p>
              <div>
                <Label>Status</Label>
                <Select value={returnData.status || 'devolvido'} onValueChange={v => setReturnData({ ...returnData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="devolvido">Devolvido</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                    <SelectItem value="danificado">Danificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={returnData.returned_at || ''} onChange={e => setReturnData({ ...returnData, returned_at: e.target.value })} />
              </div>
              <div>
                <Label>Condição na devolução</Label>
                <Input value={returnData.condition_in || ''} onChange={e => setReturnData({ ...returnData, condition_in: e.target.value })} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={2} value={returnData.notes || ''} onChange={e => setReturnData({ ...returnData, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturning(null)}>Cancelar</Button>
            <Button onClick={submitReturn} disabled={returnAsg.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CatalogPanel() {
  const { data: catalog = [], isLoading } = useItemCatalog();
  const create = useCreateCatalogItem();
  const update = useUpdateCatalogItem();
  const del = useDeleteCatalogItem();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const openNew = () => { setEditing(null); setForm({ kind: 'uniforme', active: true }); setOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm(c); setOpen(true); };

  const submit = async () => {
    if (!form.name) { toast.error('Nome obrigatório'); return; }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...form });
      else await create.mutateAsync(form);
      toast.success('Salvo');
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo item</Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!isLoading && catalog.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum item cadastrado</TableCell></TableRow>
              )}
              {catalog.map((c: any) => {
                const meta = KIND_META[c.kind] || KIND_META.outro;
                return (
                  <TableRow key={c.id}>
                    <TableCell><Badge variant="outline" style={{ color: meta.color }}>{meta.label}</Badge></TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs">{c.sku || '—'}</TableCell>
                    <TableCell className="text-xs">{c.size || '—'}</TableCell>
                    <TableCell>{brl(c.cost_cents)}</TableCell>
                    <TableCell><Badge variant={c.active ? 'default' : 'secondary'}>{c.active ? 'Sim' : 'Não'}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={async () => {
                          if (!confirm('Excluir item do catálogo?')) return;
                          try { await del.mutateAsync(c.id); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
                        }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar item' : 'Novo item'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.kind || 'uniforme'} onValueChange={v => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>SKU</Label>
                <Input value={form.sku || ''} onChange={e => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div>
                <Label>Tamanho</Label>
                <Input value={form.size || ''} onChange={e => setForm({ ...form, size: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Custo (R$)</Label>
              <Input type="number" step="0.01" value={((form.cost_cents || 0) / 100).toString()}
                onChange={e => setForm({ ...form, cost_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
