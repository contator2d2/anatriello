import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { useSROrders, useSRSaveOrder, useSRDeleteOrder, useSRPdvs } from "@/hooks/use-smartroute";
import { useSRTemplates, useSRRoutePdvs } from "@/hooks/use-smartroute-daily";

const brl = (c: number) => `R$ ${((c || 0) / 100).toFixed(2).replace('.', ',')}`;
const statusColor: Record<string, string> = { pendente: "bg-slate-200", em_rota: "bg-blue-200", entregue: "bg-emerald-200", devolvido: "bg-red-200" };

export default function SmartRoutePedidos() {
  const [filter, setFilter] = useState<any>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const { data = [] } = useSROrders(filter);
  const { data: pdvs = [] } = useSRPdvs();
  const { data: templates = [] } = useSRTemplates();
  const { data: routePdvs = [] } = useSRRoutePdvs(form.route_id);
  const save = useSRSaveOrder();
  const del = useSRDeleteOrder();

  const onSave = async () => {
    if (!form.pdv_id) return toast.error("Selecione o PDV");
    try { await save.mutateAsync(form); toast.success("Salvo"); setOpen(false); setForm({}); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="w-6 h-6" /> Pedidos</h1>
            <p className="text-sm text-muted-foreground">Pedidos aguardando roteirização e histórico.</p>
          </div>
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={filter.status || "all"} onValueChange={(v) => setFilter({ ...filter, status: v === "all" ? undefined : v })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_rota">Em rota</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                  <SelectItem value="devolvido">Devolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={filter.date || ""} onChange={(e) => setFilter({ ...filter, date: e.target.value || undefined })} className="w-44" />
            </div>
            <Button onClick={() => { setForm({ priority: 5 }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Novo pedido</Button>
          </div>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nº Pedido</TableHead><TableHead>PDV</TableHead><TableHead>Data entrega</TableHead>
              <TableHead>Peso</TableHead><TableHead>Volume</TableHead><TableHead>Valor</TableHead>
              <TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">{o.order_number || o.id.slice(0, 8)}</TableCell>
                  <TableCell>{o.pdv_name || "—"}</TableCell>
                  <TableCell>{o.delivery_date?.slice(0, 10) || "—"}</TableCell>
                  <TableCell>{o.weight_kg} kg</TableCell>
                  <TableCell>{o.volume_m3} m³</TableCell>
                  <TableCell>{brl(o.value_cents)}</TableCell>
                  <TableCell><Badge className={statusColor[o.status] || ""}>{o.status}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => { setForm(o); setOpen(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(o.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!data.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum pedido.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{form.id ? "Editar pedido" : "Novo pedido"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Rota fixa</Label>
                <Select value={form.route_id || "__none"} onValueChange={(v) => setForm({ ...form, route_id: v === "__none" ? null : v, pdv_id: undefined, pdv_window: undefined })}>
                  <SelectTrigger><SelectValue placeholder="Sem rota (pedido avulso)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem rota</SelectItem>
                    {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>PDV*</Label>
                <Select value={form.pdv_id || ""} onValueChange={(v) => {
                  const rp = routePdvs.find((x: any) => x.pdv_id === v);
                  setForm({ ...form, pdv_id: v, pdv_window: rp?.window || null });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(form.route_id ? routePdvs.map((rp: any) => ({ id: rp.pdv_id, name: rp.pdv_name })) : pdvs).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.pdv_window && <p className="text-xs text-muted-foreground mt-1">Janela do PDV: {form.pdv_window}</p>}
              </div>
              <div><Label>Nº pedido</Label><Input value={form.order_number || ""} onChange={(e) => setForm({ ...form, order_number: e.target.value })} /></div>
              <div><Label>Data entrega*</Label><Input type="date" value={form.delivery_date?.slice(0, 10) || ""} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} /></div>
              <div><Label>Peso (kg)</Label><Input type="number" step="0.01" value={form.weight_kg || ""} onChange={(e) => setForm({ ...form, weight_kg: +e.target.value })} /></div>

              <div><Label>Volume (m³)</Label><Input type="number" step="0.001" value={form.volume_m3 || ""} onChange={(e) => setForm({ ...form, volume_m3: +e.target.value })} /></div>
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.value_cents ? form.value_cents / 100 : ""} onChange={(e) => setForm({ ...form, value_cents: Math.round(+e.target.value * 100) })} /></div>
              <div><Label>Prioridade (1-10)</Label><Input type="number" min={1} max={10} value={form.priority || 5} onChange={(e) => setForm({ ...form, priority: +e.target.value })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={onSave} disabled={save.isPending}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
