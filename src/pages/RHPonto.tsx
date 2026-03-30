import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTimeRecords, useSaveTimeRecord, useEmployees, useAppPunches } from "@/hooks/use-rh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Clock, Smartphone, MapPin, CheckCircle2, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  normal: "Normal", falta: "Falta", atestado: "Atestado", feriado: "Feriado", compensado: "Compensado",
};

const GEO_LABELS: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  dentro_area: { label: "Dentro PDV", variant: "default" },
  fora_area: { label: "Fora PDV", variant: "destructive" },
  excecao: { label: "Exceção", variant: "secondary" },
  sem_gps: { label: "Sem GPS", variant: "outline" },
  sem_pdv: { label: "Sem PDV", variant: "outline" },
};

const PUNCH_LABELS: Record<string, string> = {
  entrada: '🟢 Entrada', saida_intervalo: '🟡 Saída Intervalo', retorno_intervalo: '🔵 Retorno', saida: '🔴 Saída', extraordinaria: '⚪ Extra', ajuste: '🔧 Ajuste'
};

export default function RHPonto() {
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("app");
  const [form, setForm] = useState<any>({ employee_id: "", record_date: format(new Date(), "yyyy-MM-dd"), entry1: "08:00", exit1: "12:00", entry2: "13:00", exit2: "17:00", entry3: "", exit3: "", status: "normal", justification: "" });
  const { toast } = useToast();

  const { data: records = [], isLoading } = useTimeRecords({
    employee_id: employeeFilter || undefined,
    start_date: startDate,
    end_date: endDate,
  });
  const { data: appPunches = [], isLoading: loadingPunches } = useAppPunches({
    employee_id: employeeFilter || undefined,
    start_date: startDate,
    end_date: endDate,
  });
  const { data: employees = [] } = useEmployees({ status: "ativo" });
  const saveMut = useSaveTimeRecord();

  const calcHours = (f: any) => {
    let total = 0;
    const calc = (entry: string, exit: string) => {
      if (!entry || !exit) return 0;
      const [eh, em] = entry.split(":").map(Number);
      const [xh, xm] = exit.split(":").map(Number);
      return (xh * 60 + xm - eh * 60 - em) / 60;
    };
    total += calc(f.entry1, f.exit1);
    total += calc(f.entry2, f.exit2);
    total += calc(f.entry3, f.exit3);
    return Math.round(total * 100) / 100;
  };

  const handleSave = async () => {
    if (!form.employee_id || !form.record_date) { toast({ title: "Selecione o colaborador e a data", variant: "destructive" }); return; }
    const totalH = calcHours(form);
    const overtime = Math.max(0, totalH - 8);
    try {
      await saveMut.mutateAsync({ ...form, total_hours: totalH, overtime_hours: overtime });
      toast({ title: "Ponto registrado!" });
      setDialogOpen(false);
    } catch { toast({ title: "Erro ao registrar ponto", variant: "destructive" }); }
  };

  const setField = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const totalOvertime = records.reduce((s: number, r: any) => s + (parseFloat(r.overtime_hours) || 0), 0);
  const offlinePunches = appPunches.filter((p: any) => p.is_offline);
  const outsidePdv = appPunches.filter((p: any) => p.geo_status === 'fora_area');

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Clock className="h-6 w-6 text-primary" /> Gestão de Ponto</h1>
            <p className="text-sm text-muted-foreground">Controle de jornada e banco de horas</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Registrar Ponto</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{appPunches.length}</p><p className="text-xs text-muted-foreground">Registros App</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{records.length}</p><p className="text-xs text-muted-foreground">Registros Manual</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{totalOvertime.toFixed(1)}h</p><p className="text-xs text-muted-foreground">Horas Extras</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{offlinePunches.length}</p><p className="text-xs text-muted-foreground">Offline</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{outsidePdv.length}</p><p className="text-xs text-muted-foreground">Fora do PDV</p></CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={employeeFilter || "__all__"} onValueChange={v => setEmployeeFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Todos os colaboradores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="app" className="gap-2"><Smartphone className="h-4 w-4" /> Registros do App ({appPunches.length})</TabsTrigger>
            <TabsTrigger value="manual" className="gap-2"><Clock className="h-4 w-4" /> Registros Manuais ({records.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="app">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="hidden md:table-cell">PDV</TableHead>
                      <TableHead>Geo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingPunches ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : appPunches.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro do app encontrado</TableCell></TableRow>
                    ) : appPunches.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-sm">
                          {p.punched_at ? format(new Date(p.punched_at), "dd/MM/yyyy HH:mm:ss") : "—"}
                        </TableCell>
                        <TableCell>{p.employee_name}</TableCell>
                        <TableCell><span className="text-sm">{PUNCH_LABELS[p.punch_type] || p.punch_type}</span></TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          {p.pdv_name ? <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.pdv_name}</span> : "—"}
                        </TableCell>
                        <TableCell>
                          {p.geo_status && GEO_LABELS[p.geo_status] ? (
                            <Badge variant={GEO_LABELS[p.geo_status].variant} className="text-[10px]">
                              {p.geo_status === 'dentro_area' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : p.geo_status === 'fora_area' ? <AlertTriangle className="h-3 w-3 mr-1" /> : null}
                              {GEO_LABELS[p.geo_status].label}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {p.is_offline ? (
                              <Badge variant="outline" className="text-[10px]"><WifiOff className="h-3 w-3 mr-1" />Offline</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-green-600 border-green-300"><Wifi className="h-3 w-3 mr-1" />Online</Badge>
                            )}
                            <Badge variant={p.sync_status === 'synced' ? 'default' : 'secondary'} className="text-[10px]">
                              {p.sync_status === 'synced' ? '✓ Sync' : '⏳ Pendente'}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead className="hidden md:table-cell">Entrada</TableHead>
                      <TableHead className="hidden md:table-cell">Almoço</TableHead>
                      <TableHead className="hidden md:table-cell">Retorno</TableHead>
                      <TableHead className="hidden md:table-cell">Saída</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>HE</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : records.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
                    ) : records.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.record_date ? format(new Date(r.record_date + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell>{r.employee_name}</TableCell>
                        <TableCell className="hidden md:table-cell">{r.entry1 || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell">{r.exit1 || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell">{r.entry2 || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell">{r.exit2 || "—"}</TableCell>
                        <TableCell className="font-medium">{r.total_hours ? `${r.total_hours}h` : "—"}</TableCell>
                        <TableCell>{parseFloat(r.overtime_hours) > 0 ? <Badge variant="outline" className="text-primary">{r.overtime_hours}h</Badge> : "—"}</TableCell>
                        <TableCell><Badge variant="outline">{STATUS_LABELS[r.status] || r.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Registrar Ponto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Colaborador *</Label>
              <Select value={form.employee_id} onValueChange={v => setField("employee_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Data *</Label><Input type="date" value={form.record_date} onChange={e => setField("record_date", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Entrada</Label><Input type="time" value={form.entry1} onChange={e => setField("entry1", e.target.value)} /></div>
              <div><Label>Saída Almoço</Label><Input type="time" value={form.exit1} onChange={e => setField("exit1", e.target.value)} /></div>
              <div><Label>Retorno</Label><Input type="time" value={form.entry2} onChange={e => setField("entry2", e.target.value)} /></div>
              <div><Label>Saída</Label><Input type="time" value={form.exit2} onChange={e => setField("exit2", e.target.value)} /></div>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Justificativa</Label><Input value={form.justification} onChange={e => setField("justification", e.target.value)} /></div>
            <div className="text-sm text-muted-foreground">Total calculado: <strong>{calcHours(form)}h</strong></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
