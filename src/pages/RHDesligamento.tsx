import { useMemo, useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  useTerminations, useTermination, usePreviewTermination, useCreateTermination,
  useUpdateTermination, useHomologateTermination, useCancelTermination, useEmployees,
} from "@/hooks/use-rh";
import {
  UserMinus, Plus, Calculator, FileText, Check, X, AlertTriangle, Loader2, Printer, DollarSign, Trash2,
} from "lucide-react";

const REASONS = [
  { v: "sem_justa_causa", l: "Dispensa sem justa causa", desc: "Empresa dispensa. Multa FGTS 40%, aviso, saque FGTS, seguro-desemprego." },
  { v: "com_justa_causa", l: "Dispensa com justa causa", desc: "Sem aviso, sem multa FGTS, sem 13º/férias proporcionais." },
  { v: "pedido_demissao", l: "Pedido de demissão", desc: "Colaborador pediu. Sem multa FGTS, sem seguro-desemprego." },
  { v: "acordo", l: "Acordo (Lei 13.467/17)", desc: "Multa FGTS 20%, aviso 50%, saque 80% FGTS, sem seguro-desemprego." },
  { v: "fim_contrato_experiencia", l: "Fim de contrato de experiência", desc: "Término natural. Sem aviso e sem multa." },
  { v: "fim_contrato_experiencia_antecipado", l: "Fim antecipado de experiência", desc: "Empresa antecipa. Multa proporcional." },
  { v: "aposentadoria", l: "Aposentadoria", desc: "Requer aviso e verbas normais sem multa FGTS." },
  { v: "morte", l: "Falecimento", desc: "Verbas pagas aos dependentes/espólio." },
];

const NOTICE_TYPES = [
  { v: "indenizado", l: "Indenizado (empresa paga)" },
  { v: "trabalhado", l: "Trabalhado" },
  { v: "dispensado", l: "Dispensado (sem custo)" },
  { v: "nao_cumprido", l: "Não cumprido (desconto)" },
];

const STATUS_COLOR: Record<string, string> = {
  em_andamento: "bg-yellow-100 text-yellow-800",
  homologado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};
const STATUS_LABEL: Record<string, string> = {
  em_andamento: "Em andamento", homologado: "Homologado", cancelado: "Cancelado",
};

const fmtBRL = (n: number | string) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string) => d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "-";

export default function RHDesligamento() {
  const { toast } = useToast();
  const [openNew, setOpenNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: list = [], isLoading } = useTerminations(statusFilter ? { status: statusFilter } : undefined);
  const { data: detail } = useTermination(detailId || undefined);
  const { data: employees = [] } = useEmployees({ status: "ativo" });

  const previewMut = usePreviewTermination();
  const createMut = useCreateTermination();
  const updateMut = useUpdateTermination();
  const homologateMut = useHomologateTermination();
  const cancelMut = useCancelTermination();

  const emptyForm = {
    employee_id: "",
    reason: "sem_justa_causa",
    notice_type: "indenizado",
    termination_date: new Date().toISOString().slice(0, 10),
    last_working_day: "",
    base_salary: 0,
    fgts_balance: 0,
    other_credits: 0,
    other_debits: 0,
    interview_notes: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [calc, setCalc] = useState<any>(null);

  const kpis = useMemo(() => ({
    em_andamento: list.filter((t: any) => t.status === "em_andamento").length,
    homologado_mes: list.filter((t: any) => t.status === "homologado" &&
      new Date(t.homologated_at || t.termination_date).getMonth() === new Date().getMonth()).length,
    total_pagar: list.filter((t: any) => t.status === "em_andamento").reduce((s: number, t: any) => s + Number(t.net_total || 0), 0),
    total: list.length,
  }), [list]);

  // Auto preview quando dados mudam
  useEffect(() => {
    if (!openNew || !form.employee_id) return;
    const t = setTimeout(async () => {
      try {
        const r = await previewMut.mutateAsync(form);
        setCalc(r);
      } catch (_) {}
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNew, form.employee_id, form.reason, form.notice_type, form.termination_date,
      form.base_salary, form.fgts_balance, form.other_credits, form.other_debits]);

  const submit = async () => {
    if (!form.employee_id || !form.termination_date || !form.reason) {
      toast({ title: "Preencha colaborador, data e motivo", variant: "destructive" });
      return;
    }
    try {
      await createMut.mutateAsync(form);
      toast({ title: "Rescisão criada", description: "Complete o checklist antes de homologar." });
      setOpenNew(false); setForm(emptyForm); setCalc(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const toggleChecklist = async (idx: number) => {
    if (!detail) return;
    const cl = Array.isArray(detail.checklist) ? [...detail.checklist] : [];
    cl[idx] = { ...cl[idx], done: !cl[idx].done, done_at: !cl[idx].done ? new Date().toISOString() : null };
    await updateMut.mutateAsync({ id: detail.id, checklist: cl });
  };

  const doHomologate = async (force = false) => {
    if (!detail) return;
    try {
      await homologateMut.mutateAsync({ id: detail.id, force });
      toast({ title: "Rescisão homologada", description: "Colaborador desligado com sucesso." });
      setDetailId(null);
    } catch (e: any) {
      if (e.message?.includes("pendentes") && !force) {
        if (confirm(`${e.message}\n\nForçar homologação mesmo assim?`)) doHomologate(true);
      } else {
        toast({ title: "Erro", description: e.message, variant: "destructive" });
      }
    }
  };

  const doCancel = () => {
    if (!detail) return;
    const reason = prompt("Motivo do cancelamento:");
    if (!reason) return;
    cancelMut.mutate({ id: detail.id, reason });
    setDetailId(null);
  };

  const printTRCT = () => window.print();

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserMinus className="w-6 h-6" /> Desligamento / Rescisão
            </h1>
            <p className="text-sm text-muted-foreground">
              Cálculo automático de verbas rescisórias, checklist de devoluções e TRCT.
            </p>
          </div>
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova Rescisão
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: "Em andamento", v: kpis.em_andamento, i: AlertTriangle },
            { l: "Homologados no mês", v: kpis.homologado_mes, i: Check },
            { l: "Total a pagar", v: fmtBRL(kpis.total_pagar), i: DollarSign },
            { l: "Total rescisões", v: kpis.total, i: FileText },
          ].map((k) => (
            <Card key={k.l}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{k.l}</p>
                  <p className="text-xl font-bold">{k.v}</p>
                </div>
                <k.i className="w-6 h-6 text-primary/60" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Rescisões</CardTitle>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="homologado">Homologados</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-6"><Loader2 className="animate-spin" /></div>
            ) : list.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma rescisão registrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Líquido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((t: any) => (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => setDetailId(t.id)}>
                      <TableCell className="font-medium">
                        {t.employee_name}
                        <div className="text-xs text-muted-foreground">{t.position} · {t.registration_number}</div>
                      </TableCell>
                      <TableCell className="text-xs">{REASONS.find(r => r.v === t.reason)?.l || t.reason}</TableCell>
                      <TableCell>{fmtDate(t.termination_date)}</TableCell>
                      <TableCell className="font-mono">{fmtBRL(t.net_total)}</TableCell>
                      <TableCell><Badge className={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost"><FileText className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nova rescisão */}
      <Dialog open={openNew} onOpenChange={(o) => { setOpenNew(o); if (!o) { setForm(emptyForm); setCalc(null); } }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Rescisão</DialogTitle></DialogHeader>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label>Colaborador</Label>
                <Select value={form.employee_id} onValueChange={(v) => {
                  const emp: any = employees.find((e: any) => e.id === v);
                  setForm({ ...form, employee_id: v, base_salary: Number(emp?.current_salary || emp?.salary || 0) });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name} — {e.position}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Motivo</Label>
                <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map(r => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{REASONS.find(r => r.v === form.reason)?.desc}</p>
              </div>

              <div>
                <Label>Tipo de aviso prévio</Label>
                <Select value={form.notice_type} onValueChange={(v) => setForm({ ...form, notice_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTICE_TYPES.map(n => <SelectItem key={n.v} value={n.v}>{n.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Data do desligamento</Label>
                  <Input type="date" value={form.termination_date}
                    onChange={(e) => setForm({ ...form, termination_date: e.target.value })} />
                </div>
                <div>
                  <Label>Último dia trabalhado</Label>
                  <Input type="date" value={form.last_working_day}
                    onChange={(e) => setForm({ ...form, last_working_day: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Salário base</Label>
                  <Input type="number" step="0.01" value={form.base_salary}
                    onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Saldo FGTS</Label>
                  <Input type="number" step="0.01" value={form.fgts_balance}
                    onChange={(e) => setForm({ ...form, fgts_balance: Number(e.target.value) })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Outros créditos</Label>
                  <Input type="number" step="0.01" value={form.other_credits}
                    onChange={(e) => setForm({ ...form, other_credits: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Outros descontos</Label>
                  <Input type="number" step="0.01" value={form.other_debits}
                    onChange={(e) => setForm({ ...form, other_debits: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <Label>Observações da entrevista de desligamento</Label>
                <Textarea rows={3} value={form.interview_notes}
                  onChange={(e) => setForm({ ...form, interview_notes: e.target.value })} />
              </div>
            </div>

            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="w-4 h-4" /> Verbas Rescisórias
                  {previewMut.isPending && <Loader2 className="w-3 h-3 animate-spin ml-2" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {calc ? (
                  <>
                    <Row l="Saldo de salário" v={calc.salary_proportional} sub={`${calc.days_worked_month} dias`} />
                    <Row l="13º proporcional" v={calc.thirteenth_proportional} />
                    <Row l="Férias proporcionais" v={calc.vacation_proportional} />
                    <Row l="Férias vencidas" v={calc.vacation_expired} />
                    <Row l="1/3 constitucional" v={calc.vacation_third} />
                    <Row l={`Aviso prévio (${calc.notice_days}d)`} v={calc.notice_amount} />
                    <Row l="Banco de horas" v={calc.time_bank_amount} sub={`${Math.round(calc.time_bank_minutes / 60)}h + 50%`} />
                    <Row l="Multa FGTS" v={calc.fgts_fine} sub="paga direto ao FGTS" />
                    <Row l="Outros créditos" v={calc.other_credits} />
                    <Row l="Outros descontos" v={-calc.other_debits} />
                    <Separator className="my-2" />
                    <Row l="Bruto" v={calc.gross_total} bold />
                    <Row l="Líquido a pagar" v={calc.net_total} bold className="text-lg text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">* Multa FGTS é recolhida à Caixa e não integra o líquido.</p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">Selecione um colaborador para calcular</p>
                )}
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={createMut.isPending || !form.employee_id}>
              {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar rescisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto print:max-w-full">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{detail.employee_name}</span>
                  <Badge className={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="verbas">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="verbas">Verbas</TabsTrigger>
                  <TabsTrigger value="checklist">Checklist</TabsTrigger>
                  <TabsTrigger value="entrevista">Entrevista</TabsTrigger>
                  <TabsTrigger value="trct">TRCT</TabsTrigger>
                </TabsList>

                <TabsContent value="verbas" className="space-y-2 mt-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Motivo:</span> {REASONS.find(r => r.v === detail.reason)?.l}</div>
                    <div><span className="text-muted-foreground">Data:</span> {fmtDate(detail.termination_date)}</div>
                    <div><span className="text-muted-foreground">Aviso:</span> {NOTICE_TYPES.find(n => n.v === detail.notice_type)?.l} ({detail.notice_days}d)</div>
                    <div><span className="text-muted-foreground">Admissão:</span> {fmtDate(detail.admission_date)}</div>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <Row l="Saldo de salário" v={detail.salary_proportional} />
                    <Row l="13º proporcional" v={detail.thirteenth_proportional} />
                    <Row l="Férias proporcionais + 1/3" v={Number(detail.vacation_proportional) + Number(detail.vacation_third)} />
                    <Row l="Férias vencidas" v={detail.vacation_expired} />
                    <Row l="Aviso prévio" v={detail.notice_amount} />
                    <Row l="Banco de horas" v={detail.time_bank_amount} />
                    <Row l="Multa FGTS (à Caixa)" v={detail.fgts_fine} />
                    <Row l="Outros créditos" v={detail.other_credits} />
                    <Row l="Outros descontos" v={-Number(detail.other_debits)} />
                    <Separator />
                    <Row l="Bruto" v={detail.gross_total} bold />
                    <Row l="Líquido a pagar" v={detail.net_total} bold className="text-lg text-primary" />
                  </div>
                </TabsContent>

                <TabsContent value="checklist" className="space-y-2 mt-4">
                  {(Array.isArray(detail.checklist) ? detail.checklist : []).map((item: any, idx: number) => (
                    <label key={item.key} className="flex items-center gap-3 p-2 border rounded cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={item.done} disabled={detail.status !== "em_andamento"}
                        onCheckedChange={() => toggleChecklist(idx)} />
                      <div className="flex-1">
                        <p className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.label}</p>
                        {item.done && item.done_at && (
                          <p className="text-xs text-muted-foreground">✓ {new Date(item.done_at).toLocaleString("pt-BR")}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </TabsContent>

                <TabsContent value="entrevista" className="mt-4">
                  <Textarea rows={8} placeholder="Anotações da entrevista de desligamento..."
                    value={detail.interview_notes || ""}
                    disabled={detail.status !== "em_andamento"}
                    onChange={(e) => updateMut.mutate({ id: detail.id, interview_notes: e.target.value })} />
                </TabsContent>

                <TabsContent value="trct" className="mt-4 space-y-3">
                  <Alert>
                    <FileText className="w-4 h-4" />
                    <AlertTitle>Termo de Rescisão do Contrato de Trabalho</AlertTitle>
                    <AlertDescription className="text-xs">
                      Documento para assinatura e homologação. Imprima e colete as assinaturas conforme legislação vigente.
                    </AlertDescription>
                  </Alert>
                  <div id="trct-print" className="border rounded p-4 text-sm space-y-2 bg-white">
                    <h2 className="text-center font-bold text-base">TERMO DE RESCISÃO DE CONTRATO DE TRABALHO</h2>
                    <p><strong>Colaborador:</strong> {detail.employee_name}</p>
                    <p><strong>CPF:</strong> {detail.cpf || "—"} · <strong>Matrícula:</strong> {detail.registration_number || "—"}</p>
                    <p><strong>Cargo:</strong> {detail.position}</p>
                    <p><strong>Admissão:</strong> {fmtDate(detail.admission_date)} · <strong>Desligamento:</strong> {fmtDate(detail.termination_date)}</p>
                    <p><strong>Motivo:</strong> {REASONS.find(r => r.v === detail.reason)?.l}</p>
                    <Separator className="my-2" />
                    <table className="w-full text-xs">
                      <tbody>
                        <tr><td>Saldo de salário</td><td className="text-right">{fmtBRL(detail.salary_proportional)}</td></tr>
                        <tr><td>13º proporcional</td><td className="text-right">{fmtBRL(detail.thirteenth_proportional)}</td></tr>
                        <tr><td>Férias proporcionais + 1/3</td><td className="text-right">{fmtBRL(Number(detail.vacation_proportional) + Number(detail.vacation_third))}</td></tr>
                        <tr><td>Férias vencidas</td><td className="text-right">{fmtBRL(detail.vacation_expired)}</td></tr>
                        <tr><td>Aviso prévio</td><td className="text-right">{fmtBRL(detail.notice_amount)}</td></tr>
                        <tr><td>Banco de horas</td><td className="text-right">{fmtBRL(detail.time_bank_amount)}</td></tr>
                        <tr className="font-bold border-t"><td>LÍQUIDO A PAGAR</td><td className="text-right">{fmtBRL(detail.net_total)}</td></tr>
                        <tr className="text-muted-foreground"><td>Multa FGTS (recolhida à Caixa)</td><td className="text-right">{fmtBRL(detail.fgts_fine)}</td></tr>
                      </tbody>
                    </table>
                    <div className="grid grid-cols-2 gap-8 mt-8 text-center text-xs">
                      <div><div className="border-t pt-1">Colaborador</div></div>
                      <div><div className="border-t pt-1">Empresa</div></div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={printTRCT}>
                    <Printer className="w-4 h-4 mr-2" /> Imprimir TRCT
                  </Button>
                </TabsContent>
              </Tabs>

              <DialogFooter className="print:hidden">
                {detail.status === "em_andamento" && (
                  <>
                    <Button variant="outline" onClick={doCancel}>
                      <Trash2 className="w-4 h-4 mr-2" /> Cancelar rescisão
                    </Button>
                    <Button onClick={() => doHomologate(false)} disabled={homologateMut.isPending}>
                      {homologateMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                      Homologar e desligar
                    </Button>
                  </>
                )}
                {detail.status === "homologado" && (
                  <p className="text-sm text-muted-foreground">
                    Homologado em {fmtDate(detail.homologated_at?.slice(0, 10))}
                  </p>
                )}
              </DialogFooter>
            </>
          ) : (
            <div className="flex justify-center p-6"><Loader2 className="animate-spin" /></div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function Row({ l, v, sub, bold, className = "" }: { l: string; v: number | string; sub?: string; bold?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between items-baseline ${bold ? "font-bold" : ""} ${className}`}>
      <span>{l}{sub && <span className="text-xs text-muted-foreground ml-1">({sub})</span>}</span>
      <span className="font-mono">{fmtBRL(v as any)}</span>
    </div>
  );
}
