import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTimeRecords, useSaveTimeRecord, useEmployees } from "@/hooks/use-rh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Clock, Calendar, Timer } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  normal: "Normal", falta: "Falta", atestado: "Atestado", feriado: "Feriado", compensado: "Compensado",
};

export default function RHPonto() {
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({ employee_id: "", record_date: format(new Date(), "yyyy-MM-dd"), entry1: "08:00", exit1: "12:00", entry2: "13:00", exit2: "17:00", entry3: "", exit3: "", status: "normal", justification: "" });
  const { toast } = useToast();

  const { data: records = [], isLoading } = useTimeRecords({
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{records.length}</p><p className="text-xs text-muted-foreground">Registros</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{totalOvertime.toFixed(1)}h</p><p className="text-xs text-muted-foreground">Horas Extras</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{records.filter((r: any) => r.status === "falta").length}</p><p className="text-xs text-muted-foreground">Faltas</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{records.filter((r: any) => r.status === "atestado").length}</p><p className="text-xs text-muted-foreground">Atestados</p></CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Todos os colaboradores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
        </div>

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
