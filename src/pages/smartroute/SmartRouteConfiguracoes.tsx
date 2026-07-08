import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Clock, CalendarX, Plus, Pencil, Trash2, Settings, ShieldCheck } from "lucide-react";
import {
  useSRVehicleTypes, useSRSaveVehicleType, useSRDeleteVehicleType,
  useSRWindows, useSRSaveWindow, useSRDeleteWindow,
  useSRExceptions, useSRSaveException, useSRDeleteException,
} from "@/hooks/use-smartroute-ops";
import { useOperationSettings, useSaveOperationSettings } from "@/hooks/use-smartroute-checklists";
import { toast } from "sonner";

const DAYS = [
  { v: 0, l: "Dom" }, { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" },
  { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" },
];

function VehicleTypesTab() {
  const { data = [] } = useSRVehicleTypes();
  const save = useSRSaveVehicleType();
  const del = useSRDeleteVehicleType();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const submit = async () => {
    if (!form.name) return toast.error("Informe o nome");
    await save.mutateAsync(form);
    toast.success("Salvo");
    setOpen(false); setForm({});
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Truck className="w-4 h-4" />Tipos de veículo</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setForm({ active: true, avg_speed_kmh: 40 })}><Plus className="w-4 h-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Editar" : "Novo"} tipo</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Van, Truck 3/4, Moto" /></div>
              <div className="col-span-2"><Label>Descrição</Label><Textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Peso máx (kg)</Label><Input type="number" value={form.max_weight_kg || ""} onChange={(e) => setForm({ ...form, max_weight_kg: Number(e.target.value) })} /></div>
              <div><Label>Volume máx (m³)</Label><Input type="number" step="0.01" value={form.max_volume_m3 || ""} onChange={(e) => setForm({ ...form, max_volume_m3: Number(e.target.value) })} /></div>
              <div><Label>Máx. paradas</Label><Input type="number" value={form.max_stops || ""} onChange={(e) => setForm({ ...form, max_stops: Number(e.target.value) })} /></div>
              <div><Label>Vel. média (km/h)</Label><Input type="number" value={form.avg_speed_kmh || ""} onChange={(e) => setForm({ ...form, avg_speed_kmh: Number(e.target.value) })} /></div>
              <div><Label>Custo por km (R$)</Label><Input type="number" step="0.01" value={form.cost_per_km || ""} onChange={(e) => setForm({ ...form, cost_per_km: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2 pt-6"><Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={save.isPending}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="text-right">Peso (kg)</TableHead><TableHead className="text-right">Volume (m³)</TableHead><TableHead className="text-right">Paradas</TableHead><TableHead className="text-right">R$/km</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {data.map((v: any) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell className="text-right">{v.max_weight_kg}</TableCell>
                <TableCell className="text-right">{v.max_volume_m3}</TableCell>
                <TableCell className="text-right">{v.max_stops}</TableCell>
                <TableCell className="text-right">R$ {Number(v.cost_per_km).toFixed(2)}</TableCell>
                <TableCell>{v.active ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setForm(v); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(v.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!data.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum tipo cadastrado</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WindowsTab() {
  const { data = [] } = useSRWindows();
  const save = useSRSaveWindow();
  const del = useSRDeleteWindow();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const toggleDay = (d: number) => {
    const arr = new Set<number>(form.weekdays || []);
    arr.has(d) ? arr.delete(d) : arr.add(d);
    setForm({ ...form, weekdays: Array.from(arr).sort() });
  };
  const submit = async () => {
    if (!form.name || !form.window_start || !form.window_end) return toast.error("Preencha nome e horários");
    await save.mutateAsync(form);
    toast.success("Salvo");
    setOpen(false); setForm({});
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" />Janelas de entrega</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setForm({ active: true, weekdays: [1, 2, 3, 4, 5], priority: 5 })}><Plus className="w-4 h-4 mr-1" />Nova janela</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nova"} janela</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Manhã, Tarde, Comercial" /></div>
              <div><Label>Início</Label><Input type="time" value={form.window_start || ""} onChange={(e) => setForm({ ...form, window_start: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="time" value={form.window_end || ""} onChange={(e) => setForm({ ...form, window_end: e.target.value })} /></div>
              <div className="col-span-2">
                <Label>Dias da semana</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {DAYS.map((d) => (
                    <Button key={d.v} type="button" size="sm" variant={(form.weekdays || []).includes(d.v) ? "default" : "outline"} onClick={() => toggleDay(d.v)}>
                      {d.l}
                    </Button>
                  ))}
                </div>
              </div>
              <div><Label>Prioridade (1-10)</Label><Input type="number" min={1} max={10} value={form.priority || 5} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2 pt-6"><Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativa</Label></div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={save.isPending}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Horário</TableHead><TableHead>Dias</TableHead><TableHead className="text-right">Prioridade</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {data.map((w: any) => (
              <TableRow key={w.id}>
                <TableCell className="font-medium">{w.name}</TableCell>
                <TableCell>{String(w.window_start).slice(0, 5)} - {String(w.window_end).slice(0, 5)}</TableCell>
                <TableCell className="text-xs">{(w.weekdays || []).map((d: number) => DAYS.find((x) => x.v === d)?.l).join(", ")}</TableCell>
                <TableCell className="text-right">{w.priority}</TableCell>
                <TableCell>{w.active ? <Badge>Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setForm({ ...w, weekdays: w.weekdays || [] }); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(w.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!data.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma janela cadastrada</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ExceptionsTab() {
  const { data = [] } = useSRExceptions();
  const save = useSRSaveException();
  const del = useSRDeleteException();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ blocks_delivery: true, kind: "feriado" });
  const submit = async () => {
    if (!form.exception_date || !form.name) return toast.error("Preencha data e nome");
    await save.mutateAsync(form);
    toast.success("Salvo");
    setOpen(false); setForm({ blocks_delivery: true, kind: "feriado" });
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><CalendarX className="w-4 h-4" />Exceções (feriados e bloqueios)</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setForm({ blocks_delivery: true, kind: "feriado" })}><Plus className="w-4 h-4 mr-1" />Nova exceção</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova exceção</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={form.exception_date || ""} onChange={(e) => setForm({ ...form, exception_date: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feriado">Feriado</SelectItem>
                    <SelectItem value="ponto_facultativo">Ponto facultativo</SelectItem>
                    <SelectItem value="bloqueio">Bloqueio operacional</SelectItem>
                    <SelectItem value="evento">Evento especial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Natal, Greve, Fechamento CD" /></div>
              <div className="col-span-2"><Label>Descrição</Label><Textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="col-span-2 flex items-center gap-2"><Switch checked={!!form.blocks_delivery} onCheckedChange={(v) => setForm({ ...form, blocks_delivery: v })} /><Label>Bloqueia entregas neste dia</Label></div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={save.isPending}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Nome</TableHead><TableHead>Bloqueia?</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {data.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>{new Date(e.exception_date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell>
                <TableCell><Badge variant="secondary">{e.kind}</Badge></TableCell>
                <TableCell>{e.name}</TableCell>
                <TableCell>{e.blocks_delivery ? <Badge variant="destructive">Sim</Badge> : <Badge>Não</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(e.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!data.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma exceção cadastrada</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function SmartRouteConfiguracoes() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6" />Configurações operacionais</h1>
          <p className="text-sm text-muted-foreground">Tipos de veículo, janelas de entrega e exceções do calendário.</p>
        </div>
        <Tabs defaultValue="tipos">
          <TabsList>
            <TabsTrigger value="tipos"><Truck className="w-4 h-4 mr-1" />Tipos de veículo</TabsTrigger>
            <TabsTrigger value="janelas"><Clock className="w-4 h-4 mr-1" />Janelas de entrega</TabsTrigger>
            <TabsTrigger value="excecoes"><CalendarX className="w-4 h-4 mr-1" />Exceções</TabsTrigger>
          </TabsList>
          <TabsContent value="tipos"><VehicleTypesTab /></TabsContent>
          <TabsContent value="janelas"><WindowsTab /></TabsContent>
          <TabsContent value="excecoes"><ExceptionsTab /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
