import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useOnboardings, useOnboarding, useCreateOnboarding, useUpdateOnboarding,
  useFinishOnboarding, useCancelOnboarding, useEmployees, useBranches, useRhDepartments,
} from "@/hooks/use-rh";
import { useCompanies } from "@/hooks/use-companies";
import {
  UserPlus, Plus, FileText, Check, Loader2, ClipboardCheck, FileCheck, GraduationCap, Trash2, Users,
} from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  em_andamento: "bg-yellow-100 text-yellow-800",
  concluido: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};
const STATUS_LABEL: Record<string, string> = {
  em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado",
};

const fmtDate = (d?: string) => d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "-";

export default function RHAdmissao() {
  const { toast } = useToast();
  const [openNew, setOpenNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const { data: list = [], isLoading } = useOnboardings(statusFilter ? { status: statusFilter } : undefined);
  const { data: detail } = useOnboarding(detailId || undefined);
  const { data: employees = [] } = useEmployees();
  const { data: branches = [] } = useBranches();
  const { data: departments = [] } = useRhDepartments();
  const { companies } = useCompanies();

  const createMut = useCreateOnboarding();
  const updateMut = useUpdateOnboarding();
  const finishMut = useFinishOnboarding();
  const cancelMut = useCancelOnboarding();

  const emptyForm = {
    candidate_name: "", candidate_email: "", candidate_phone: "", candidate_cpf: "",
    position: "", department_id: "", branch_id: "", company_id: "",
    admission_date: new Date().toISOString().slice(0, 10),
    probation_end_date: "",
    salary: 0,
    buddy_id: "", manager_id: "",
    exam_scheduled_at: "", integration_scheduled_at: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const kpis = useMemo(() => ({
    em_andamento: list.filter((o: any) => o.status === "em_andamento").length,
    concluido_mes: list.filter((o: any) =>
      o.status === "concluido" && new Date(o.completed_at || o.admission_date).getMonth() === new Date().getMonth()).length,
    proximas: list.filter((o: any) => {
      if (o.status !== "em_andamento") return false;
      const days = Math.ceil((new Date(o.admission_date).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 7;
    }).length,
    total: list.length,
  }), [list]);

  const submit = async () => {
    if (!form.candidate_name || !form.admission_date) {
      toast({ title: "Preencha nome e data de admissão", variant: "destructive" });
      return;
    }
    try {
      const r: any = await createMut.mutateAsync(form);
      toast({ title: "Admissão criada", description: "Acompanhe o processo pelo detalhe." });
      setOpenNew(false); setForm(emptyForm);
      setDetailId(r.id);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const toggleDoc = async (idx: number) => {
    if (!detail) return;
    const docs = [...(detail.documents || [])];
    docs[idx] = { ...docs[idx], received: !docs[idx].received, received_at: !docs[idx].received ? new Date().toISOString() : null };
    await updateMut.mutateAsync({ id: detail.id, documents: docs });
  };

  const toggleChecklist = async (idx: number) => {
    if (!detail) return;
    const cl = [...(detail.checklist || [])];
    cl[idx] = { ...cl[idx], done: !cl[idx].done, done_at: !cl[idx].done ? new Date().toISOString() : null };
    await updateMut.mutateAsync({ id: detail.id, checklist: cl });
  };

  const doFinish = async (force = false) => {
    if (!detail) return;
    try {
      await finishMut.mutateAsync({ id: detail.id, force });
      toast({ title: "Admissão concluída", description: "Colaborador criado e ativo." });
      setDetailId(null);
    } catch (e: any) {
      if (e.message?.includes("pendentes") && !force) {
        if (confirm(`${e.message}\n\nFinalizar mesmo com pendências?`)) doFinish(true);
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

  const progress = (o: any) => {
    const total = Number(o.docs_required || 0) + Number(o.checklist_total || 0);
    const done = Number(o.docs_received || 0) + Number(o.checklist_done || 0);
    return total ? Math.round((done / total) * 100) : 0;
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserPlus className="w-6 h-6" /> Admissão / Onboarding
            </h1>
            <p className="text-sm text-muted-foreground">
              Processo completo: documentos, exame admissional, integração e criação automática do colaborador.
            </p>
          </div>
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova Admissão
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: "Em andamento", v: kpis.em_andamento, i: ClipboardCheck },
            { l: "Próximos 7 dias", v: kpis.proximas, i: GraduationCap },
            { l: "Concluídas no mês", v: kpis.concluido_mes, i: Check },
            { l: "Total processos", v: kpis.total, i: Users },
          ].map((k) => (
            <Card key={k.l}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{k.l}</p>
                  <p className="text-2xl font-bold">{k.v}</p>
                </div>
                <k.i className="w-6 h-6 text-primary/60" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Processos de admissão</CardTitle>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluido">Concluídos</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-6"><Loader2 className="animate-spin" /></div>
            ) : list.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum processo de admissão.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidato</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Admissão</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((o: any) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => setDetailId(o.id)}>
                      <TableCell className="font-medium">
                        {o.candidate_name}
                        <div className="text-xs text-muted-foreground">{o.candidate_email || o.candidate_phone || "—"}</div>
                      </TableCell>
                      <TableCell>{o.position || "—"}</TableCell>
                      <TableCell>{fmtDate(o.admission_date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 w-40">
                          <Progress value={progress(o)} className="h-2 flex-1" />
                          <span className="text-xs">{progress(o)}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {o.docs_received}/{o.docs_required} docs · {o.checklist_done}/{o.checklist_total} check
                        </div>
                      </TableCell>
                      <TableCell><Badge className={STATUS_COLOR[o.status]}>{STATUS_LABEL[o.status]}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nova admissão */}
      <Dialog open={openNew} onOpenChange={(o) => { setOpenNew(o); if (!o) setForm(emptyForm); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Admissão</DialogTitle></DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label>Nome completo *</Label>
                <Input value={form.candidate_name} onChange={(e) => setForm({ ...form, candidate_name: e.target.value })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={form.candidate_email} onChange={(e) => setForm({ ...form, candidate_email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.candidate_phone} onChange={(e) => setForm({ ...form, candidate_phone: e.target.value })} />
              </div>
              <div>
                <Label>CPF</Label>
                <Input value={form.candidate_cpf} onChange={(e) => setForm({ ...form, candidate_cpf: e.target.value })} />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div>
              <div className="col-span-2">
                <Label>Empresa *</Label>
                <Select value={form.company_id || "none"} onValueChange={(v) => setForm({ ...form, company_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa do colaborador" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.trade_name || c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Filial</Label>
                <Select value={form.branch_id || "none"} onValueChange={(v) => setForm({ ...form, branch_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Departamento</Label>
                <Select value={form.department_id || "none"} onValueChange={(v) => setForm({ ...form, department_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de admissão *</Label>
                <Input type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} />
              </div>
              <div>
                <Label>Fim da experiência</Label>
                <Input type="date" value={form.probation_end_date} onChange={(e) => setForm({ ...form, probation_end_date: e.target.value })} />
              </div>
              <div>
                <Label>Salário</Label>
                <Input type="number" step="0.01" value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Padrinho/Buddy</Label>
                <Select value={form.buddy_id || "none"} onValueChange={(v) => setForm({ ...form, buddy_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gestor imediato</Label>
                <Select value={form.manager_id || "none"} onValueChange={(v) => setForm({ ...form, manager_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Exame admissional em</Label>
                <Input type="datetime-local" value={form.exam_scheduled_at}
                  onChange={(e) => setForm({ ...form, exam_scheduled_at: e.target.value })} />
              </div>
              <div>
                <Label>Integração em</Label>
                <Input type="datetime-local" value={form.integration_scheduled_at}
                  onChange={(e) => setForm({ ...form, integration_scheduled_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar processo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{detail.candidate_name}</span>
                  <Badge className={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="docs">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="docs">Documentos</TabsTrigger>
                  <TabsTrigger value="exame">Exame</TabsTrigger>
                  <TabsTrigger value="integracao">Integração</TabsTrigger>
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                </TabsList>

                <TabsContent value="docs" className="space-y-2 mt-4">
                  <p className="text-xs text-muted-foreground">Marque os documentos conforme forem recebidos.</p>
                  {(detail.documents || []).map((d: any, idx: number) => (
                    <label key={d.key} className="flex items-center gap-3 p-2 border rounded cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={d.received} disabled={detail.status !== "em_andamento"}
                        onCheckedChange={() => toggleDoc(idx)} />
                      <div className="flex-1">
                        <p className={`text-sm ${d.received ? "line-through text-muted-foreground" : ""}`}>
                          {d.label} {d.required && <span className="text-red-500">*</span>}
                        </p>
                        {d.received && d.received_at && (
                          <p className="text-xs text-muted-foreground">✓ {new Date(d.received_at).toLocaleString("pt-BR")}</p>
                        )}
                      </div>
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </label>
                  ))}
                </TabsContent>

                <TabsContent value="exame" className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Agendado para</Label>
                      <Input type="datetime-local"
                        value={detail.exam_scheduled_at ? new Date(detail.exam_scheduled_at).toISOString().slice(0, 16) : ""}
                        disabled={detail.status !== "em_andamento"}
                        onChange={(e) => updateMut.mutate({ id: detail.id, exam_scheduled_at: e.target.value })} />
                    </div>
                    <div>
                      <Label>Realizado em</Label>
                      <Input type="datetime-local"
                        value={detail.exam_done_at ? new Date(detail.exam_done_at).toISOString().slice(0, 16) : ""}
                        disabled={detail.status !== "em_andamento"}
                        onChange={(e) => updateMut.mutate({ id: detail.id, exam_done_at: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label>Resultado (ASO)</Label>
                      <Select value={detail.exam_result || "none"}
                        disabled={detail.status !== "em_andamento"}
                        onValueChange={(v) => updateMut.mutate({ id: detail.id, exam_result: v === "none" ? null : v })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          <SelectItem value="apto">Apto</SelectItem>
                          <SelectItem value="apto_restricoes">Apto com restrições</SelectItem>
                          <SelectItem value="inapto">Inapto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>URL do ASO</Label>
                      <Input value={detail.exam_file_url || ""}
                        disabled={detail.status !== "em_andamento"}
                        onChange={(e) => updateMut.mutate({ id: detail.id, exam_file_url: e.target.value })}
                        placeholder="Link para o arquivo do ASO" />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="integracao" className="space-y-2 mt-4">
                  <p className="text-xs text-muted-foreground">Checklist de integração e liberações.</p>
                  {(detail.checklist || []).map((c: any, idx: number) => (
                    <label key={c.key} className="flex items-center gap-3 p-2 border rounded cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={c.done} disabled={detail.status !== "em_andamento"}
                        onCheckedChange={() => toggleChecklist(idx)} />
                      <div className="flex-1">
                        <p className={`text-sm ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.label}</p>
                        {c.done && c.done_at && (
                          <p className="text-xs text-muted-foreground">✓ {new Date(c.done_at).toLocaleString("pt-BR")}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </TabsContent>

                <TabsContent value="dados" className="mt-4 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Cargo:</span> {detail.position || "—"}</div>
                    <div><span className="text-muted-foreground">Salário:</span> {Number(detail.salary || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                    <div><span className="text-muted-foreground">Admissão:</span> {fmtDate(detail.admission_date)}</div>
                    <div><span className="text-muted-foreground">Fim experiência:</span> {fmtDate(detail.probation_end_date)}</div>
                    <div><span className="text-muted-foreground">E-mail:</span> {detail.candidate_email || "—"}</div>
                    <div><span className="text-muted-foreground">Telefone:</span> {detail.candidate_phone || "—"}</div>
                    <div><span className="text-muted-foreground">CPF:</span> {detail.candidate_cpf || "—"}</div>
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea rows={3} value={detail.notes || ""}
                      disabled={detail.status !== "em_andamento"}
                      onChange={(e) => updateMut.mutate({ id: detail.id, notes: e.target.value })} />
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                {detail.status === "em_andamento" && (
                  <>
                    <Button variant="outline" onClick={doCancel}>
                      <Trash2 className="w-4 h-4 mr-2" /> Cancelar admissão
                    </Button>
                    <Button onClick={() => doFinish(false)} disabled={finishMut.isPending}>
                      {finishMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileCheck className="w-4 h-4 mr-2" />}
                      Concluir e criar colaborador
                    </Button>
                  </>
                )}
                {detail.status === "concluido" && (
                  <p className="text-sm text-muted-foreground">
                    Concluído em {fmtDate(detail.completed_at?.slice(0, 10))} — colaborador ativo.
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
