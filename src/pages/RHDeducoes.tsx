import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Plus, Trash2, Loader2, MinusCircle, PlusCircle, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { useEmployees } from "@/hooks/use-rh";
import {
  usePayrollEntries, useCreatePayrollEntry, useDeletePayrollEntry, useUpdatePayrollEntry,
} from "@/hooks/use-rh-deductions";

const CATEGORIAS_DEDUCAO = [
  { value: "adiantamento", label: "Adiantamento" },
  { value: "vale", label: "Vale" },
  { value: "multa", label: "Multa" },
  { value: "emprestimo", label: "Empréstimo" },
  { value: "plano_saude", label: "Plano de Saúde" },
  { value: "farmacia", label: "Farmácia" },
  { value: "uniforme", label: "Uniforme / EPI" },
  { value: "faltas", label: "Faltas" },
  { value: "outro", label: "Outro" },
];
const CATEGORIAS_PROVENTO = [
  { value: "bonus", label: "Bônus" },
  { value: "comissao", label: "Comissão" },
  { value: "premiacao", label: "Premiação" },
  { value: "hora_extra", label: "Hora Extra Extra" },
  { value: "ajuda_custo", label: "Ajuda de Custo" },
  { value: "outro", label: "Outro" },
];

function currentMonth() { return new Date().toISOString().slice(0, 7); }
const brl = (v: number) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RHDeducoes() {
  const [month, setMonth] = useState(currentMonth());
  const [openNew, setOpenNew] = useState(false);
  const { toast } = useToast();

  const { data: employees = [] } = useEmployees({ status: "ativo" });
  const { data: entries = [], isLoading } = usePayrollEntries({ reference_month: month });
  const createEntry = useCreatePayrollEntry();
  const updateEntry = useUpdatePayrollEntry();
  const deleteEntry = useDeletePayrollEntry();

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" /> Lançamentos de Deduções e Proventos
            </h1>
            <p className="text-xs text-muted-foreground">
              Registre adiantamentos, multas, vales, bônus e outros valores avulsos por colaborador.
              Estes lançamentos são consolidados automaticamente na <Link to="/rh/folha-pagamento" className="text-primary underline">Folha de Pagamento</Link>.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild className="gap-2">
              <Link to="/rh/folha-pagamento"><Receipt className="h-4 w-4" /> Ver Folha do Mês</Link>
            </Button>
            <Button onClick={() => setOpenNew(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Lançamento
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Competência</Label>
              <Input type="month" value={month} onChange={e => setMonth(e.target.value)} />
            </div>
            <div className="flex items-end text-xs text-muted-foreground">
              {entries.length} lançamento(s) em {month}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : !entries.length ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhum lançamento em {month}. Clique em "Novo Lançamento" para adicionar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{e.employee_name}</div>
                        <div className="text-[10px] text-muted-foreground">{e.cpf}</div>
                      </TableCell>
                      <TableCell>
                        {e.kind === "deducao"
                          ? <Badge variant="destructive" className="gap-1"><MinusCircle className="h-3 w-3" />Dedução</Badge>
                          : <Badge className="gap-1 bg-emerald-600"><PlusCircle className="h-3 w-3" />Provento</Badge>}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{e.category.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-xs">{e.description}</TableCell>
                      <TableCell className={`text-right tabular-nums font-semibold ${e.kind === "deducao" ? "text-rose-700" : "text-emerald-700"}`}>
                        {e.kind === "deducao" ? "− " : "+ "}{brl(e.amount)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.installments_total > 1 ? `${e.installment_number}/${e.installments_total}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Select value={e.status} onValueChange={(v) => updateEntry.mutate({ id: e.id, status: v })}>
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="aplicada">Aplicada</SelectItem>
                            <SelectItem value="cancelada">Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (confirm("Excluir este lançamento?")) deleteEntry.mutate(e.id);
                        }}>
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <NewEntryDialog
        open={openNew}
        onOpenChange={setOpenNew}
        defaultMonth={month}
        employees={employees as any[]}
        onSubmit={async (payload) => {
          try {
            await createEntry.mutateAsync(payload);
            toast({ title: "Lançamento criado" });
            setOpenNew(false);
          } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
          }
        }}
      />
    </MainLayout>
  );
}


function NewEntryDialog({ open, onOpenChange, defaultMonth, employees, onSubmit }: any) {
  const [form, setForm] = useState<any>({
    employee_id: "", kind: "deducao", category: "adiantamento",
    description: "", amount: "", reference_month: defaultMonth,
    installments_total: 1, spread_installments: false, notes: "",
  });

  const categorias = form.kind === "deducao" ? CATEGORIAS_DEDUCAO : CATEGORIAS_PROVENTO;

  function submit() {
    if (!form.employee_id) return alert("Selecione o colaborador");
    if (!form.description) return alert("Informe a descrição");
    if (!Number(form.amount)) return alert("Informe o valor");
    onSubmit({
      ...form,
      amount: Number(form.amount),
      installments_total: Number(form.installments_total || 1),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Colaborador *</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}{e.cpf ? ` — ${e.cpf}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v, category: v === "deducao" ? "adiantamento" : "bonus" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deducao">Dedução (desconto)</SelectItem>
                  <SelectItem value="provento">Provento (adicional)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição *</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Adiantamento salarial de novembro" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Competência *</Label>
              <Input type="month" value={form.reference_month}
                onChange={e => setForm({ ...form, reference_month: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Parcelas</Label>
              <Input type="number" min={1} value={form.installments_total}
                onChange={e => setForm({ ...form, installments_total: e.target.value })} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={!!form.spread_installments}
                  onCheckedChange={(v) => setForm({ ...form, spread_installments: !!v })}
                />
                Distribuir em meses consecutivos
              </label>
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
