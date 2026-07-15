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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Edit, Trash2, Package, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSROrders, useSRSaveOrder, useSRDeleteOrder, useSRPdvs } from "@/hooks/use-smartroute";
import { useSRTemplates, useSRRoutePdvs } from "@/hooks/use-smartroute-daily";

const brl = (c: number) => `R$ ${((c || 0) / 100).toFixed(2).replace('.', ',')}`;
const statusColor: Record<string, string> = { pendente: "bg-slate-200", em_rota: "bg-blue-200", entregue: "bg-emerald-200", devolvido: "bg-red-200" };

export default function SmartRoutePedidos() {
  const [filter, setFilter] = useState<any>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [pdvPickerOpen, setPdvPickerOpen] = useState(false);
  const { data = [] } = useSROrders(filter);
  const { data: pdvs = [] } = useSRPdvs();
  const { data: templates = [] } = useSRTemplates();
  const { data: routePdvs = [] } = useSRRoutePdvs(form.route_id);
  const save = useSRSaveOrder();
  const del = useSRDeleteOrder();

  // PDVs disponíveis: se rota selecionada, une routePdvs + pdvs com route_template_id === rota
  const availablePdvs = (() => {
    if (!form.route_id) return pdvs;
    const map = new Map<string, any>();
    routePdvs.forEach((rp: any) => {
      const base = pdvs.find((p: any) => p.id === rp.pdv_id);
      map.set(rp.pdv_id, { ...(base || {}), id: rp.pdv_id, name: rp.pdv_name || base?.name, delivery_window: rp.delivery_window || rp.window || base?.delivery_window });
    });
    pdvs.forEach((p: any) => { if (p.route_template_id === form.route_id && !map.has(p.id)) map.set(p.id, p); });
    return Array.from(map.values());
  })();
  const selectedPdv = pdvs.find((p: any) => p.id === form.pdv_id) || availablePdvs.find((p: any) => p.id === form.pdv_id);

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
                <Popover open={pdvPickerOpen} onOpenChange={setPdvPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {selectedPdv ? selectedPdv.name : (form.route_id ? `Selecione (${availablePdvs.length} PDVs na rota)` : "Selecione ou busque um PDV")}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Digite o nome do PDV..." />
                      <CommandList>
                        <CommandEmpty>Nenhum PDV encontrado.</CommandEmpty>
                        <CommandGroup>
                          {availablePdvs.map((p: any) => (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => {
                                const rp = routePdvs.find((x: any) => x.pdv_id === p.id);
                                setForm({ ...form, pdv_id: p.id, pdv_window: rp?.delivery_window || rp?.window || p.delivery_window || null });
                                setPdvPickerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", form.pdv_id === p.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span>{p.name}</span>
                                {p.delivery_window && <span className="text-xs text-muted-foreground">Janela: {p.delivery_window}</span>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {form.route_id && !availablePdvs.length && (
                  <p className="text-xs text-amber-600 mt-1">Nenhum PDV vinculado a essa rota fixa. Vincule PDVs em "Rotas Montadas" ou no cadastro do PDV.</p>
                )}
                {(() => {
                  const pdv = pdvs.find((x: any) => x.id === form.pdv_id);
                  if (!pdv || !form.delivery_date) return form.pdv_window ? <p className="text-xs text-muted-foreground mt-1">Janela: {form.pdv_window}</p> : null;
                  const wd = new Date(form.delivery_date + "T12:00:00-03:00").getDay();
                  const allowed = pdv.allowed_weekdays || [0,1,2,3,4,5,6];
                  const ok = allowed.includes(wd);
                  return (
                    <p className={`text-xs mt-1 ${ok ? "text-muted-foreground" : "text-amber-600 font-medium"}`}>
                      Janela: {pdv.delivery_window || "qualquer"} · {ok ? "PDV aceita nesse dia" : "⚠ PDV não aceita entrega neste dia da semana — IA irá bloquear"}
                    </p>
                  );
                })()}
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
