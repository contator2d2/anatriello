import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePayslips, useCreatePayslip, useUpdatePayslip, useEmployees } from "@/hooks/use-rh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  gerado: "bg-blue-500/10 text-blue-700 border-blue-200",
  pago: "bg-green-500/10 text-green-700 border-green-200",
};

export default function RHHolerite() {
  const [monthFilter, setMonthFilter] = useState(format(new Date(), "yyyy-MM"));
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({
    employee_id: "", reference_month: format(new Date(), "yyyy-MM"), payment_type: "mensal",
    gross_salary: 0, earnings: [], total_earnings: 0, deductions: [], total_deductions: 0,
    net_salary: 0, fgts_value: 0, inss_value: 0, irrf_value: 0, payment_date: "", status: "rascunho", notes: "",
  });
  const { toast } = useToast();

  const { data: payslips = [], isLoading } = usePayslips({
    reference_month: monthFilter || undefined,
    employee_id: employeeFilter || undefined,
  });
  const { data: employees = [] } = useEmployees({ status: "ativo" });
  const createMut = useCreatePayslip();
  const updateMut = useUpdatePayslip();

  const fmtCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  const handleSave = async () => {
    if (!form.employee_id || !form.reference_month) { toast({ title: "Preencha colaborador e mês", variant: "destructive" }); return; }
    try {
      await createMut.mutateAsync(form);
      toast({ title: "Holerite criado!" });
      setDialogOpen(false);
    } catch { toast({ title: "Erro ao criar holerite", variant: "destructive" }); }
  };

  const setField = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  // Recalc net
  const recalcNet = (f: any) => {
    const net = (parseFloat(f.gross_salary) || 0) + (parseFloat(f.total_earnings) || 0) - (parseFloat(f.total_deductions) || 0);
    return Math.max(0, net);
  };

  const totalLiquido = payslips.reduce((s: number, p: any) => s + (parseFloat(p.net_salary) || 0), 0);
  const totalBruto = payslips.reduce((s: number, p: any) => s + (parseFloat(p.gross_salary) || 0), 0);

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /> Holerites</h1>
            <p className="text-sm text-muted-foreground">Demonstrativos de pagamento</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Gerar Holerite</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{payslips.length}</p><p className="text-xs text-muted-foreground">Holerites</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-lg font-bold text-primary">{fmtCurrency(totalBruto)}</p><p className="text-xs text-muted-foreground">Total Bruto</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-lg font-bold text-green-600">{fmtCurrency(totalLiquido)}</p><p className="text-xs text-muted-foreground">Total Líquido</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-lg font-bold text-yellow-600">{payslips.filter((p: any) => p.status === "rascunho").length}</p><p className="text-xs text-muted-foreground">Rascunhos</p></CardContent></Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-48" />
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Todos os colaboradores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="hidden md:table-cell">Cargo</TableHead>
                  <TableHead>Mês Ref.</TableHead>
                  <TableHead className="hidden md:table-cell">Bruto</TableHead>
                  <TableHead className="hidden lg:table-cell">Descontos</TableHead>
                  <TableHead>Líquido</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : payslips.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum holerite encontrado</TableCell></TableRow>
                ) : payslips.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.employee_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{p.position || "—"}</TableCell>
                    <TableCell>{p.reference_month}</TableCell>
                    <TableCell className="hidden md:table-cell">{fmtCurrency(p.gross_salary)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-red-600">{fmtCurrency(p.total_deductions)}</TableCell>
                    <TableCell className="font-medium text-green-700">{fmtCurrency(p.net_salary)}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[p.status] || ""}>{p.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Gerar Holerite</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Colaborador *</Label>
              <Select value={form.employee_id} onValueChange={v => {
                const emp = employees.find((e: any) => e.id === v);
                setField("employee_id", v);
                if (emp) setField("gross_salary", emp.salary || 0);
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Mês Referência *</Label><Input type="month" value={form.reference_month} onChange={e => setField("reference_month", e.target.value)} /></div>
              <div><Label>Data Pagamento</Label><Input type="date" value={form.payment_date} onChange={e => setField("payment_date", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Salário Bruto (R$)</Label><Input type="number" value={form.gross_salary} onChange={e => setField("gross_salary", e.target.value)} /></div>
              <div><Label>Tipo</Label>
                <Select value={form.payment_type} onValueChange={v => setField("payment_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="adiantamento">Adiantamento</SelectItem>
                    <SelectItem value="13o">13º Salário</SelectItem>
                    <SelectItem value="ferias">Férias</SelectItem>
                    <SelectItem value="rescisao">Rescisão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>INSS (R$)</Label><Input type="number" value={form.inss_value} onChange={e => setField("inss_value", e.target.value)} /></div>
              <div><Label>IRRF (R$)</Label><Input type="number" value={form.irrf_value} onChange={e => setField("irrf_value", e.target.value)} /></div>
              <div><Label>FGTS (R$)</Label><Input type="number" value={form.fgts_value} onChange={e => setField("fgts_value", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Total Proventos (R$)</Label><Input type="number" value={form.total_earnings} onChange={e => setField("total_earnings", e.target.value)} /></div>
              <div><Label>Total Descontos (R$)</Label><Input type="number" value={form.total_deductions} onChange={e => setField("total_deductions", e.target.value)} /></div>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Salário Líquido</p>
              <p className="text-xl font-bold text-green-700">{fmtCurrency(recalcNet(form))}</p>
            </div>
            <div><Label>Observações</Label><Input value={form.notes} onChange={e => setField("notes", e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending}>{createMut.isPending ? "Salvando..." : "Gerar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
