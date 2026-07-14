import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Edit3, Store, Calendar, ArrowUp, ArrowDown, Route as RouteIcon, Sun, Sunset, Moon, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  useSRTemplates, useSRCreateTemplate, useSRUpdateTemplate, useSRDeleteTemplate,
  useSRRoutePdvs, useSRSaveRoutePdv, useSRUpdateRoutePdv, useSRDeleteRoutePdv, useSRReorderRoutePdvs,
  useSRRouteSchedule, useSRSaveRouteSchedule,
} from "@/hooks/use-smartroute-daily";
import { useSRDrivers, useSRVehicles, useSRPdvs } from "@/hooks/use-smartroute";

const WINDOWS = [
  { value: "manha", label: "Manhã", icon: Sun },
  { value: "tarde", label: "Tarde", icon: Sunset },
  { value: "noite", label: "Noite", icon: Moon },
  { value: "qualquer", label: "Qualquer horário", icon: Clock },
];
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function RotasMontadas() {
  const { data: templates = [], isLoading } = useSRTemplates();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><RouteIcon className="w-6 h-6" /> Rotas Montadas</h1>
          <p className="text-sm text-muted-foreground">Rotas fixas com PDVs pré-cadastrados, janelas de horário e escala de entregadores.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-2" /> Nova rota</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando…</div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma rota fixa cadastrada. Crie sua primeira rota-modelo.
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="cursor-pointer hover:shadow-md transition" onClick={() => setSelected(t)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="truncate">{t.code}</span>
                  <Badge variant="outline">{t.pdvs_count} PDVs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="text-muted-foreground">Entregador padrão: <span className="font-medium text-foreground">{t.default_driver_name || "—"}</span></div>
                <div className="text-muted-foreground">Veículo: <span className="font-medium text-foreground">{t.default_vehicle_plate || "—"}</span></div>
                <div className="flex gap-2 pt-2">
                  <Link to={`/smartroute/rota-do-dia?route=${t.id}`} onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline"><Calendar className="w-3 h-3 mr-1" /> Rota do dia</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateDialog open={creating} onOpenChange={setCreating} />
      {selected && <TemplateEditor template={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function TemplateDialog({ open, onOpenChange, template }: any) {
  const create = useSRCreateTemplate();
  const update = useSRUpdateTemplate();
  const { data: drivers = [] } = useSRDrivers();
  const { data: vehicles = [] } = useSRVehicles();
  const [form, setForm] = useState<any>(template || { code: "", default_driver_id: "", default_vehicle_id: "", notes: "" });

  const save = async () => {
    try {
      if (template) await update.mutateAsync({ id: template.id, ...form });
      else await create.mutateAsync(form);
      toast.success("Rota salva");
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{template ? "Editar rota" : "Nova rota fixa"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="text-sm">Código/Nome da rota*</label><Input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex: Rota Centro-SP" /></div>
          <div><label className="text-sm">Entregador padrão</label>
            <Select value={form.default_driver_id || ""} onValueChange={(v) => setForm({ ...form, default_driver_id: v || null })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><label className="text-sm">Veículo padrão</label>
            <Select value={form.default_vehicle_id || ""} onValueChange={(v) => setForm({ ...form, default_vehicle_id: v || null })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} — {v.model}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><label className="text-sm">Observações</label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!form.code}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateEditor({ template, onClose }: any) {
  const del = useSRDeleteTemplate();
  const [editing, setEditing] = useState(false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{template.code}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit3 className="w-3 h-3 mr-1" /> Editar</Button>
              <Button size="sm" variant="destructive" onClick={async () => {
                if (!confirm("Excluir esta rota fixa?")) return;
                await del.mutateAsync(template.id); toast.success("Excluída"); onClose();
              }}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="pdvs">
          <TabsList>
            <TabsTrigger value="pdvs"><Store className="w-4 h-4 mr-1" /> PDVs Fixos</TabsTrigger>
            <TabsTrigger value="schedule"><Calendar className="w-4 h-4 mr-1" /> Escala Semanal</TabsTrigger>
          </TabsList>
          <TabsContent value="pdvs"><PdvsTab routeId={template.id} /></TabsContent>
          <TabsContent value="schedule"><ScheduleTab routeId={template.id} /></TabsContent>
        </Tabs>
        {editing && <TemplateDialog open onOpenChange={setEditing} template={template} />}
      </DialogContent>
    </Dialog>
  );
}

function PdvsTab({ routeId }: { routeId: string }) {
  const { data: routePdvs = [], refetch } = useSRRoutePdvs(routeId);
  const { data: allPdvs = [] } = useSRPdvs();
  const save = useSRSaveRoutePdv();
  const upd = useSRUpdateRoutePdv();
  const del = useSRDeleteRoutePdv();
  const reorder = useSRReorderRoutePdvs();
  const [selectedPdv, setSelectedPdv] = useState("");
  const [win, setWin] = useState("qualquer");

  const linkedIds = new Set(routePdvs.map((p: any) => p.pdv_id));
  const availablePdvs = allPdvs.filter((p: any) => !linkedIds.has(p.id));

  const add = async () => {
    if (!selectedPdv) return;
    await save.mutateAsync({ routeId, pdv_id: selectedPdv, window: win });
    setSelectedPdv(""); setWin("qualquer");
    toast.success("PDV adicionado"); refetch();
  };
  const move = async (idx: number, dir: -1 | 1) => {
    const arr = [...routePdvs]; const to = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    await reorder.mutateAsync({ routeId, pdv_ids: arr.map((p: any) => p.pdv_id) });
    refetch();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">PDV</label>
            <Select value={selectedPdv} onValueChange={setSelectedPdv}>
              <SelectTrigger><SelectValue placeholder="Escolha um PDV" /></SelectTrigger>
              <SelectContent>{availablePdvs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs text-muted-foreground">Janela</label>
            <Select value={win} onValueChange={setWin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{WINDOWS.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={add} disabled={!selectedPdv}><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
        </CardContent>
      </Card>

      {routePdvs.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Nenhum PDV vinculado ainda.</div>
      ) : (
        <div className="space-y-2">
          {routePdvs.map((rp: any, i: number) => (
            <Card key={rp.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">{i + 1}</div>
                <div className="flex-1">
                  <div className="font-medium">{rp.pdv_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{rp.address} · {rp.city}</div>
                </div>
                <Select value={rp.window || "qualquer"} onValueChange={(v) => upd.mutate({ routeId, pdvId: rp.pdv_id, window: v })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{WINDOWS.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === routePdvs.length - 1}><ArrowDown className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={async () => { await del.mutateAsync({ routeId, pdvId: rp.pdv_id }); refetch(); }}><Trash2 className="w-4 h-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">A janela de horário serve apenas para ordenar as entregas — não bloqueia lançamentos.</p>
    </div>
  );
}

function ScheduleTab({ routeId }: { routeId: string }) {
  const { data: schedule = [], refetch } = useSRRouteSchedule(routeId);
  const { data: drivers = [] } = useSRDrivers();
  const { data: vehicles = [] } = useSRVehicles();
  const save = useSRSaveRouteSchedule();

  const byDay = (wd: number) => schedule.find((s: any) => s.weekday === wd) || { weekday: wd, driver_id: "", vehicle_id: "" };
  const [local, setLocal] = useState<any[]>(() => WEEKDAYS.map((_, i) => byDay(i)));

  const persist = async () => {
    await save.mutateAsync({ routeId, entries: local });
    toast.success("Escala salva"); refetch();
  };
  const setDay = (wd: number, patch: any) => setLocal((prev) => prev.map((d) => d.weekday === wd ? { ...d, ...patch } : d));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Defina qual entregador/veículo assume a rota em cada dia da semana. Vazio = usa o padrão da rota.</p>
      {WEEKDAYS.map((name, wd) => {
        const d = local.find((x) => x.weekday === wd) || {};
        return (
          <div key={wd} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
            <div className="font-medium">{name}</div>
            <Select value={d.driver_id || ""} onValueChange={(v) => setDay(wd, { driver_id: v || null })}>
              <SelectTrigger><SelectValue placeholder="Entregador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— usar padrão —</SelectItem>
                {drivers.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={d.vehicle_id || ""} onValueChange={(v) => setDay(wd, { vehicle_id: v || null })}>
              <SelectTrigger><SelectValue placeholder="Veículo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— usar padrão —</SelectItem>
                {vehicles.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.plate}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      })}
      <div className="flex justify-end"><Button onClick={persist}>Salvar escala</Button></div>
    </div>
  );
}
