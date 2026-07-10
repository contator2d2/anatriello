import { useMemo, useState, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useOnboardings, useOnboarding, useCreateOnboarding, useUpdateOnboarding,
  useFinishOnboarding, useCancelOnboarding, useEmployees, useBranches, useRhDepartments,
  useRhPositions, useCreateRhPosition,
} from "@/hooks/use-rh";
import { useCompanies } from "@/hooks/use-companies";
import { useScheduleTemplates } from "@/hooks/use-timeclock";
import { useUpload } from "@/hooks/use-upload";
import { formatPhone } from "@/lib/br-utils";
import {
  UserPlus, Plus, FileText, Check, Loader2, ClipboardCheck, FileCheck, GraduationCap,
  Trash2, Users, Upload, AlertTriangle, ExternalLink, ArrowLeft, ArrowRight, KeyRound, Fingerprint, Clock,
} from "lucide-react";

// Soma meses a uma data ISO (yyyy-mm-dd) mantendo formato ISO.
function addMonthsISO(iso: string, months: number): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m - 1) + months, d));
  return dt.toISOString().slice(0, 10);
}

// Colaborador em experiência? (probation_end_date > hoje)
const inProbation = (iso?: string) => {
  if (!iso) return false;
  return new Date(iso.slice(0, 10) + "T23:59:59").getTime() >= Date.now();
};

const STATUS_COLOR: Record<string, string> = {
  em_andamento: "bg-yellow-100 text-yellow-800",
  concluido: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};
const STATUS_LABEL: Record<string, string> = {
  em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado",
};

const fmtDate = (d?: string) => d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "-";
const todayISO = () => new Date().toISOString().slice(0, 10);

// Pendências: retorna lista de itens faltando + primeira data de vencimento
function computePending(o: any) {
  const items: string[] = [];
  const docs = Array.isArray(o.documents) ? o.documents : [];
  const docsMiss = docs.filter((d: any) => d.required && !d.received);
  if (docsMiss.length) items.push(`${docsMiss.length} documento(s) obrigatório(s)`);
  const cl = Array.isArray(o.checklist) ? o.checklist : [];
  const clMiss = cl.filter((c: any) => !c.done);
  if (clMiss.length) items.push(`${clMiss.length} item(ns) de integração`);
  const ac = o.access_config || {};
  const sys = Array.isArray(ac.systems) ? ac.systems : [];
  const sysMiss = sys.filter((s: any) => !s.granted);
  if (sysMiss.length) items.push(`${sysMiss.length} acesso(s) não liberado(s)`);
  if (!ac.biometry?.registered) items.push("Biometria não cadastrada");
  if (!ac.timeclock?.registered) items.push("Relógio de ponto não configurado");
  if (!o.schedule_template_id) items.push("Escala não definida");
  if (!o.exam_done_at || o.exam_result !== "apto") items.push("Exame admissional pendente");
  return items;
}

const WIZARD_STEPS = [
  { key: "dados", label: "Dados" },
  { key: "docs", label: "Documentos" },
  { key: "exame", label: "Exame" },
  { key: "acessos", label: "Acessos" },
  { key: "escala", label: "Escala" },
  { key: "integracao", label: "Integração" },
  { key: "concluir", label: "Concluir" },
];

export default function RHAdmissao() {
  const { toast } = useToast();
  const [openNew, setOpenNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [wizardStep, setWizardStep] = useState(0);

  const { data: list = [], isLoading } = useOnboardings(statusFilter ? { status: statusFilter } : undefined);
  const { data: detail } = useOnboarding(detailId || undefined);
  const { data: employees = [] } = useEmployees();
  const { data: branches = [] } = useBranches();
  const { data: departments = [] } = useRhDepartments();
  const { data: positions = [] } = useRhPositions();
  const { data: scheduleTemplates = [] } = useScheduleTemplates();
  const { companies } = useCompanies();

  const createMut = useCreateOnboarding();
  const updateMut = useUpdateOnboarding();
  const finishMut = useFinishOnboarding();
  const cancelMut = useCancelOnboarding();
  const createPos = useCreateRhPosition();
  const { uploadFile, isUploading } = useUpload();

  const emptyForm: any = {
    candidate_name: "", candidate_email: "", candidate_phone: "", candidate_cpf: "",
    position: "", position_id: "", department_id: "", branch_id: "", company_id: "",
    admission_date: todayISO(),
    probation_end_date: addMonthsISO(todayISO(), 3), // sugerido: 3 meses (CLT)
    salary: "",
    buddy_id: "", manager_id: "",
    zip_code: "", address: "", address_number: "", complement: "", neighborhood: "", city: "", state: "",
    notes: "",
  };

  const [form, setForm] = useState<any>(emptyForm);
  const [newPosDialog, setNewPosDialog] = useState(false);
  const [newPos, setNewPos] = useState({ name: "", department_id: "" });

  // Cargos: catálogo + cargos já em uso por colaboradores existentes (distintos)
  const mergedPositions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; fromCatalog: boolean }>();
    (positions || []).forEach((p: any) => map.set(p.name.toLowerCase(), { id: p.id, name: p.name, fromCatalog: true }));
    (employees || []).forEach((e: any) => {
      const n = (e.position || "").trim();
      if (n && !map.has(n.toLowerCase())) map.set(n.toLowerCase(), { id: `emp:${n}`, name: n, fromCatalog: false });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [positions, employees]);

  const kpis = useMemo(() => ({
    em_andamento: list.filter((o: any) => o.status === "em_andamento").length,
    com_pendencias: list.filter((o: any) => o.status === "em_andamento" && computePending(o).length > 0).length,
    em_experiencia: list.filter((o: any) => o.status === "concluido" && inProbation(o.probation_end_date)).length,
    concluido_mes: list.filter((o: any) =>
      o.status === "concluido" && new Date(o.completed_at || o.admission_date).getMonth() === new Date().getMonth()).length,
  }), [list]);

  const submit = async () => {
    if (!form.candidate_name || !form.admission_date) {
      toast({ title: "Preencha nome e data de admissão", variant: "destructive" });
      return;
    }
    try {
      const payload = { ...form, salary: form.salary === "" ? 0 : Number(form.salary) };
      const r: any = await createMut.mutateAsync(payload);
      toast({ title: "Admissão criada", description: "Continue o processo pelo wizard." });
      setOpenNew(false); setForm(emptyForm);
      setDetailId(r.id); setWizardStep(0);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const patchDoc = async (idx: number, patch: any) => {
    if (!detail) return;
    const docs = [...(detail.documents || [])];
    docs[idx] = { ...docs[idx], ...patch };
    await updateMut.mutateAsync({ id: detail.id, documents: docs });
  };

  const patchChecklist = async (idx: number, patch: any) => {
    if (!detail) return;
    const cl = [...(detail.checklist || [])];
    cl[idx] = { ...cl[idx], ...patch };
    await updateMut.mutateAsync({ id: detail.id, checklist: cl });
  };

  const patchAccess = async (patch: any) => {
    if (!detail) return;
    const cur = detail.access_config || {};
    const next = { ...cur, ...patch };
    await updateMut.mutateAsync({ id: detail.id, access_config: next });
  };

  const patchSystem = async (idx: number, patch: any) => {
    if (!detail) return;
    const cur = detail.access_config || {};
    const systems = Array.isArray(cur.systems) ? [...cur.systems] : [];
    systems[idx] = { ...systems[idx], ...patch };
    await patchAccess({ systems });
  };

  const doFinish = async (force = false) => {
    if (!detail) return;
    try {
      await finishMut.mutateAsync({ id: detail.id, force });
      toast({ title: "Admissão concluída", description: "Colaborador criado e ativo." });
      setDetailId(null); setWizardStep(0);
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
    const docs = Array.isArray(o.documents) ? o.documents : [];
    const cl = Array.isArray(o.checklist) ? o.checklist : [];
    const ac = o.access_config || {};
    const sys = Array.isArray(ac.systems) ? ac.systems : [];
    const total = docs.length + cl.length + sys.length + 3; // + biometria + ponto + escala
    const done = docs.filter((d: any) => d.received).length
      + cl.filter((c: any) => c.done).length
      + sys.filter((s: any) => s.granted).length
      + (ac.biometry?.registered ? 1 : 0)
      + (ac.timeclock?.registered ? 1 : 0)
      + (o.schedule_template_id ? 1 : 0);
    return total ? Math.round((done / total) * 100) : 0;
  };

  const createPosition = async () => {
    if (!newPos.name.trim()) return;
    try {
      const p: any = await createPos.mutateAsync(newPos);
      setForm({ ...form, position_id: p.id, position: p.name });
      setNewPosDialog(false); setNewPos({ name: "", department_id: "" });
      toast({ title: "Cargo criado" });
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
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
              Wizard completo: dados, documentos, exame, acessos, biometria, ponto, escala e integração.
            </p>
          </div>
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova Admissão
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: "Em andamento", v: kpis.em_andamento, i: ClipboardCheck, c: "text-primary" },
            { l: "Com pendências", v: kpis.com_pendencias, i: AlertTriangle, c: "text-amber-600" },
            { l: "Em experiência", v: kpis.em_experiencia, i: GraduationCap, c: "text-blue-600" },
            { l: "Concluídas no mês", v: kpis.concluido_mes, i: Check, c: "text-green-600" },
          ].map((k) => (
            <Card key={k.l}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{k.l}</p>
                  <p className="text-2xl font-bold">{k.v}</p>
                </div>
                <k.i className={`w-6 h-6 ${k.c}`} />
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
                    <TableHead>Pendências</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((o: any) => {
                    const pend = o.status === "em_andamento" ? computePending(o) : [];
                    const daysLeft = Math.ceil((new Date(o.admission_date).getTime() - Date.now()) / 86400000);
                    return (
                      <TableRow key={o.id} className="cursor-pointer" onClick={() => { setDetailId(o.id); setWizardStep(0); }}>
                        <TableCell className="font-medium">
                          {o.candidate_name}
                          <div className="text-xs text-muted-foreground">{o.candidate_email || (o.candidate_phone ? formatPhone(o.candidate_phone) : "—")}</div>
                        </TableCell>
                        <TableCell>{o.position || "—"}</TableCell>
                        <TableCell>
                          {fmtDate(o.admission_date)}
                          {o.status === "em_andamento" && daysLeft >= 0 && daysLeft <= 7 && (
                            <div className="text-[10px] text-amber-600 font-medium">em {daysLeft}d</div>
                          )}
                          {o.status === "concluido" && inProbation(o.probation_end_date) && (
                            <div className="text-[10px] text-blue-600 font-medium">
                              experiência até {fmtDate(o.probation_end_date)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 w-32">
                            <Progress value={progress(o)} className="h-2 flex-1" />
                            <span className="text-xs">{progress(o)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {pend.length === 0 ? (
                            <Badge variant="outline" className="text-green-700 border-green-300">Tudo ok</Badge>
                          ) : (
                            <div className="text-xs text-amber-700 max-w-xs">
                              <AlertTriangle className="w-3 h-3 inline mr-1" />
                              {pend.slice(0, 2).join(" · ")}
                              {pend.length > 2 && <span className="text-muted-foreground"> +{pend.length - 2}</span>}
                            </div>
                          )}
                        </TableCell>
                        <TableCell><Badge className={STATUS_COLOR[o.status]}>{STATUS_LABEL[o.status]}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nova admissão (dialog inicial simples com só dados essenciais) */}
      <Dialog open={openNew} onOpenChange={(o) => { setOpenNew(o); if (!o) setForm(emptyForm); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Admissão — dados iniciais</DialogTitle>
            <p className="text-xs text-muted-foreground">Após criar, você continuará no wizard (documentos, exame, acessos, escala…).</p>
          </DialogHeader>

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
                <Label>Telefone / WhatsApp</Label>
                <Input
                  placeholder="(11) 90000-0000"
                  value={formatPhone(form.candidate_phone)}
                  onChange={(e) => setForm({ ...form, candidate_phone: e.target.value })}
                />
              </div>
              <div>
                <Label>CPF</Label>
                <Input value={form.candidate_cpf} onChange={(e) => setForm({ ...form, candidate_cpf: e.target.value })} />
              </div>
              <div>
                <Label>Cargo</Label>
                <Select
                  value={form.position_id || (form.position ? `name:${form.position}` : "none")}
                  onValueChange={(v) => {
                    if (v === "__new") { setNewPosDialog(true); return; }
                    if (v === "none") { setForm({ ...form, position_id: "", position: "" }); return; }
                    if (v.startsWith("name:")) {
                      setForm({ ...form, position_id: "", position: v.slice(5) });
                      return;
                    }
                    const p = mergedPositions.find((x) => x.id === v);
                    setForm({ ...form, position_id: p?.fromCatalog ? v : "", position: p?.name || "" });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione ou cadastre" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {mergedPositions.map((p) => (
                      <SelectItem key={p.id} value={p.fromCatalog ? p.id : `name:${p.name}`}>
                        {p.name} {!p.fromCatalog && <span className="text-[10px] text-muted-foreground ml-1">(em uso)</span>}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new" className="text-primary">+ Cadastrar novo cargo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                <Input type="date" value={form.admission_date}
                  onChange={(e) => {
                    const prevAuto = addMonthsISO(form.admission_date, 3);
                    const shouldResync = !form.probation_end_date || form.probation_end_date === prevAuto;
                    setForm({
                      ...form,
                      admission_date: e.target.value,
                      probation_end_date: shouldResync ? addMonthsISO(e.target.value, 3) : form.probation_end_date,
                    });
                  }} />
              </div>
              <div>
                <Label>Fim do contrato de experiência</Label>
                <Input type="date" value={form.probation_end_date}
                  onChange={(e) => setForm({ ...form, probation_end_date: e.target.value })} />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Sugerido: 3 meses (CLT). {form.probation_end_date && `Término em ${fmtDate(form.probation_end_date)}.`}
                </p>
              </div>
              <div>
                <Label>Salário (R$)</Label>
                <Input
                  type="number" step="0.01" placeholder="0,00"
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                />
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
              Criar e continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Novo Cargo */}
      <Dialog open={newPosDialog} onOpenChange={setNewPosDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cadastrar novo cargo</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Nome *</Label>
              <Input value={newPos.name} onChange={(e) => setNewPos({ ...newPos, name: e.target.value })} />
            </div>
            <div>
              <Label>Departamento</Label>
              <Select value={newPos.department_id || "none"} onValueChange={(v) => setNewPos({ ...newPos, department_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPosDialog(false)}>Cancelar</Button>
            <Button onClick={createPosition} disabled={createPos.isPending}>Salvar cargo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wizard de detalhe */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{detail.candidate_name} <span className="text-sm font-normal text-muted-foreground">— {detail.position || "sem cargo"}</span></span>
                  <Badge className={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
                </DialogTitle>
              </DialogHeader>

              {/* Passos do wizard */}
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {WIZARD_STEPS.map((s, i) => (
                  <button
                    key={s.key}
                    onClick={() => setWizardStep(i)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition
                      ${i === wizardStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                  >
                    {i + 1}. {s.label}
                  </button>
                ))}
              </div>

              {/* STEP 0: Dados */}
              {wizardStep === 0 && (
                <StepDados detail={detail} update={(patch) => updateMut.mutate({ id: detail.id, ...patch })}
                  positions={mergedPositions} departments={departments} branches={branches} companies={companies} employees={employees} />
              )}

              {/* STEP 1: Documentos */}
              {wizardStep === 1 && (
                <StepDocumentos detail={detail} patchDoc={patchDoc} uploadFile={uploadFile} isUploading={isUploading} />
              )}

              {/* STEP 2: Exame */}
              {wizardStep === 2 && (
                <StepExame detail={detail} updateMut={updateMut} uploadFile={uploadFile} isUploading={isUploading} />
              )}

              {/* STEP 3: Acessos + Biometria + Ponto */}
              {wizardStep === 3 && (
                <StepAcessos detail={detail} patchAccess={patchAccess} patchSystem={patchSystem} />
              )}

              {/* STEP 4: Escala */}
              {wizardStep === 4 && (
                <StepEscala detail={detail} scheduleTemplates={scheduleTemplates} updateMut={updateMut} />
              )}

              {/* STEP 5: Integração */}
              {wizardStep === 5 && (
                <StepIntegracao detail={detail} patchChecklist={patchChecklist} />
              )}

              {/* STEP 6: Concluir */}
              {wizardStep === 6 && (
                <StepConcluir detail={detail} pending={computePending(detail)} />
              )}

              <DialogFooter className="flex-wrap gap-2 justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setWizardStep(Math.max(0, wizardStep - 1))} disabled={wizardStep === 0}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Anterior
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWizardStep(Math.min(WIZARD_STEPS.length - 1, wizardStep + 1))} disabled={wizardStep === WIZARD_STEPS.length - 1}>
                    Próximo <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  {detail.status === "em_andamento" && (
                    <>
                      <Button variant="outline" onClick={doCancel}>
                        <Trash2 className="w-4 h-4 mr-2" /> Cancelar
                      </Button>
                      <Button onClick={() => doFinish(false)} disabled={finishMut.isPending}>
                        {finishMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileCheck className="w-4 h-4 mr-2" />}
                        Concluir e criar colaborador
                      </Button>
                    </>
                  )}
                  {detail.status === "concluido" && (
                    <p className="text-sm text-muted-foreground self-center">
                      Concluído em {fmtDate(detail.completed_at?.slice(0, 10))} — colaborador ativo.
                    </p>
                  )}
                </div>
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

// ============ STEP COMPONENTS ============

function SalaryInput({ value, disabled, onCommit }: { value: any; disabled?: boolean; onCommit: (n: number) => void }) {
  const toStr = (v: any) => {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(v);
    if (!isFinite(n) || n === 0) return "";
    return String(n);
  };
  const [local, setLocal] = useState<string>(toStr(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setLocal(toStr(value)); }, [value]);
  return (
    <Input
      type="number" step="0.01" inputMode="decimal" placeholder="0,00"
      value={local}
      disabled={disabled}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        focused.current = false;
        const n = local === "" ? 0 : Number(local);
        onCommit(isFinite(n) ? n : 0);
      }}
    />
  );
}


function StepDados({ detail, update, positions, departments, branches, companies, employees }: any) {
  const disabled = detail.status !== "em_andamento";
  return (
    <div className="grid grid-cols-2 gap-3 py-2">
      <div className="col-span-2"><Label>Nome</Label>
        <Input value={detail.candidate_name || ""} disabled={disabled}
          onChange={(e) => update({ candidate_name: e.target.value })} /></div>
      <div><Label>E-mail</Label><Input value={detail.candidate_email || ""} disabled={disabled}
        onChange={(e) => update({ candidate_email: e.target.value })} /></div>
      <div><Label>Telefone / WhatsApp</Label>
        <Input value={formatPhone(detail.candidate_phone || "")} disabled={disabled}
          placeholder="(11) 90000-0000"
          onChange={(e) => update({ candidate_phone: e.target.value })} /></div>
      <div><Label>CPF</Label><Input value={detail.candidate_cpf || ""} disabled={disabled}
        onChange={(e) => update({ candidate_cpf: e.target.value })} /></div>
      <div>
        <Label>Cargo</Label>
        <Select
          value={detail.position_id || (detail.position ? `name:${detail.position}` : "none")}
          disabled={disabled}
          onValueChange={(v) => {
            if (v === "none") { update({ position_id: null, position: null }); return; }
            if (v.startsWith("name:")) { update({ position_id: null, position: v.slice(5) }); return; }
            const p = positions.find((x: any) => x.id === v);
            update({ position_id: p?.fromCatalog ? v : null, position: p?.name || detail.position });
          }}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {positions.map((p: any) => (
              <SelectItem key={p.id} value={p.fromCatalog ? p.id : `name:${p.name}`}>
                {p.name}{!p.fromCatalog && <span className="text-[10px] text-muted-foreground ml-1">(em uso)</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Departamento</Label>
        <Select value={detail.department_id || "none"} disabled={disabled}
          onValueChange={(v) => update({ department_id: v === "none" ? null : v })}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Data admissão</Label><Input type="date" value={detail.admission_date?.slice(0, 10) || ""} disabled={disabled}
        onChange={(e) => {
          const prev = detail.admission_date?.slice(0, 10) || "";
          const prevAuto = prev ? addMonthsISO(prev, 3) : "";
          const curEnd = detail.probation_end_date?.slice(0, 10) || "";
          const shouldResync = !curEnd || curEnd === prevAuto;
          update({
            admission_date: e.target.value,
            ...(shouldResync ? { probation_end_date: addMonthsISO(e.target.value, 3) } : {}),
          });
        }} /></div>
      <div>
        <Label>Fim do contrato de experiência</Label>
        <Input type="date" value={detail.probation_end_date?.slice(0, 10) || ""} disabled={disabled}
          onChange={(e) => update({ probation_end_date: e.target.value })} />
        <p className="text-[10px] text-muted-foreground mt-1">Sugerido: 3 meses (CLT).</p>
      </div>
      <div>
        <Label>Salário (R$)</Label>
        <SalaryInput
          value={detail.salary}
          disabled={disabled}
          onCommit={(n) => update({ salary: n })}
        />
      </div>

      <div>
        <Label>Gestor imediato</Label>
        <Select value={detail.manager_id || "none"} disabled={disabled}
          onValueChange={(v) => update({ manager_id: v === "none" ? null : v })}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2"><Label>Observações</Label>
        <Textarea rows={2} value={detail.notes || ""} disabled={disabled}
          onChange={(e) => update({ notes: e.target.value })} /></div>
    </div>
  );
}

function StepDocumentos({ detail, patchDoc, uploadFile, isUploading }: any) {
  const disabled = detail.status !== "em_andamento";
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleUpload = async (idx: number, file: File) => {
    const url = await uploadFile(file);
    if (url) {
      await patchDoc(idx, { file_url: url, file_name: file.name, received: true, received_at: new Date().toISOString() });
    }
  };

  return (
    <div className="space-y-2 py-2">
      <p className="text-xs text-muted-foreground">Envie cada documento e defina a data de vencimento quando aplicável.</p>
      {(detail.documents || []).map((d: any, idx: number) => (
        <div key={d.key} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{d.label} {d.required && <span className="text-red-500">*</span>}</span>
              {d.received && <Badge className="bg-green-100 text-green-800">Recebido</Badge>}
            </div>
            <div className="flex gap-1">
              {d.file_url && (
                <a href={d.file_url} target="_blank" rel="noreferrer" className="text-primary text-xs flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> abrir
                </a>
              )}
              <input
                ref={(el) => { fileRefs.current[idx] = el; }}
                type="file" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(idx, e.target.files[0])}
              />
              <Button size="sm" variant="outline" disabled={disabled || isUploading}
                onClick={() => fileRefs.current[idx]?.click()}>
                <Upload className="w-3 h-3 mr-1" /> {d.file_url ? "Substituir" : "Enviar"}
              </Button>
              {d.received && (
                <Button size="sm" variant="ghost" disabled={disabled}
                  onClick={() => patchDoc(idx, { received: false, received_at: null, file_url: null, file_name: null })}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Recebido em</Label>
              <Input type="date" disabled={disabled}
                value={d.received_at ? d.received_at.slice(0, 10) : ""}
                onChange={(e) => patchDoc(idx, { received_at: e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : null, received: !!e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Vencimento (se houver)</Label>
              <Input type="date" disabled={disabled}
                value={d.expiry_date || ""}
                onChange={(e) => patchDoc(idx, { expiry_date: e.target.value || null })} />
            </div>
          </div>
          {d.file_name && <p className="text-[10px] text-muted-foreground truncate">📎 {d.file_name}</p>}
        </div>
      ))}
    </div>
  );
}

function StepExame({ detail, updateMut, uploadFile, isUploading }: any) {
  const disabled = detail.status !== "em_andamento";
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    const url = await uploadFile(file);
    if (url) updateMut.mutate({ id: detail.id, exam_file_url: url, exam_done_at: new Date().toISOString() });
  };

  return (
    <div className="grid grid-cols-2 gap-3 py-2">
      <div>
        <Label>Agendado para</Label>
        <Input type="datetime-local" disabled={disabled}
          value={detail.exam_scheduled_at ? new Date(detail.exam_scheduled_at).toISOString().slice(0, 16) : ""}
          onChange={(e) => updateMut.mutate({ id: detail.id, exam_scheduled_at: e.target.value })} />
      </div>
      <div>
        <Label>Realizado em</Label>
        <Input type="datetime-local" disabled={disabled}
          value={detail.exam_done_at ? new Date(detail.exam_done_at).toISOString().slice(0, 16) : ""}
          onChange={(e) => updateMut.mutate({ id: detail.id, exam_done_at: e.target.value })} />
      </div>
      <div className="col-span-2">
        <Label>Resultado (ASO)</Label>
        <Select value={detail.exam_result || "none"} disabled={disabled}
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
      <div className="col-span-2 border rounded-lg p-3 space-y-2">
        <Label>Arquivo do ASO (PDF/imagem) ou link</Label>
        <div className="flex gap-2 items-center">
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          <Button size="sm" variant="outline" disabled={disabled || isUploading} onClick={() => fileRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> Enviar arquivo
          </Button>
          {detail.exam_file_url && (
            <a href={detail.exam_file_url} target="_blank" rel="noreferrer" className="text-primary text-xs flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> abrir atual
            </a>
          )}
        </div>
        <Input placeholder="Ou cole a URL"
          value={detail.exam_file_url || ""} disabled={disabled}
          onChange={(e) => updateMut.mutate({ id: detail.id, exam_file_url: e.target.value })} />
      </div>
    </div>
  );
}

function StepAcessos({ detail, patchAccess, patchSystem }: any) {
  const disabled = detail.status !== "em_andamento";
  const ac = detail.access_config || {};
  const systems = Array.isArray(ac.systems) ? ac.systems : [];
  const [newSys, setNewSys] = useState("");

  const addSys = async () => {
    if (!newSys.trim()) return;
    const next = [...systems, { key: `custom_${Date.now()}`, label: newSys, granted: false }];
    await patchAccess({ systems: next });
    setNewSys("");
  };

  return (
    <div className="space-y-4 py-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="w-4 h-4" /> Liberação de acessos</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {systems.map((s: any, idx: number) => (
            <div key={s.key} className="flex items-center gap-3 border rounded p-2">
              <Switch checked={!!s.granted} disabled={disabled}
                onCheckedChange={(v) => patchSystem(idx, { granted: v, granted_at: v ? new Date().toISOString() : null })} />
              <div className="flex-1 min-w-0">
                <Input value={s.label} disabled={disabled}
                  className="h-7 text-sm border-none focus-visible:ring-0 p-0"
                  onChange={(e) => patchSystem(idx, { label: e.target.value })} />
                <Input placeholder="Login / usuário / observação"
                  value={s.login || ""} disabled={disabled}
                  className="h-7 text-xs mt-1"
                  onChange={(e) => patchSystem(idx, { login: e.target.value })} />
              </div>
              <Button variant="ghost" size="icon" disabled={disabled}
                onClick={() => patchAccess({ systems: systems.filter((_: any, i: number) => i !== idx) })}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input placeholder="Adicionar sistema..." value={newSys} disabled={disabled}
              onChange={(e) => setNewSys(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSys()} />
            <Button size="sm" onClick={addSys} disabled={disabled}><Plus className="w-4 h-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Fingerprint className="w-4 h-4" /> Biometria</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Cadastro biométrico realizado</span>
            <Switch checked={!!ac.biometry?.registered} disabled={disabled}
              onCheckedChange={(v) => patchAccess({ biometry: { ...(ac.biometry || {}), registered: v, registered_at: v ? new Date().toISOString() : null } })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" disabled={disabled}
                value={ac.biometry?.registered_at ? ac.biometry.registered_at.slice(0, 10) : ""}
                onChange={(e) => patchAccess({ biometry: { ...(ac.biometry || {}), registered_at: e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : null } })} />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={ac.biometry?.type || "facial"} disabled={disabled}
                onValueChange={(v) => patchAccess({ biometry: { ...(ac.biometry || {}), type: v } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="facial">Facial</SelectItem>
                  <SelectItem value="digital">Digital</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Relógio de ponto</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Cadastrado no relógio de ponto</span>
            <Switch checked={!!ac.timeclock?.registered} disabled={disabled}
              onCheckedChange={(v) => patchAccess({ timeclock: { ...(ac.timeclock || {}), registered: v, registered_at: v ? new Date().toISOString() : null } })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" disabled={disabled}
                value={ac.timeclock?.registered_at ? ac.timeclock.registered_at.slice(0, 10) : ""}
                onChange={(e) => patchAccess({ timeclock: { ...(ac.timeclock || {}), registered_at: e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : null } })} />
            </div>
            <div>
              <Label className="text-xs">Matrícula/PIN</Label>
              <Input value={ac.timeclock?.pin || ""} disabled={disabled}
                onChange={(e) => patchAccess({ timeclock: { ...(ac.timeclock || {}), pin: e.target.value } })} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepEscala({ detail, scheduleTemplates, updateMut }: any) {
  const disabled = detail.status !== "em_andamento";
  return (
    <div className="space-y-3 py-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Escala de horário</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Modelo de escala *</Label>
            <Select value={detail.schedule_template_id || "none"} disabled={disabled}
              onValueChange={(v) => updateMut.mutate({ id: detail.id, schedule_template_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione uma escala" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {(scheduleTemplates || []).map((t: any) => (
                  <SelectItem key={t.id || t.key} value={t.id || t.key}>
                    {t.name || t.label || t.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(!scheduleTemplates || scheduleTemplates.length === 0) && (
              <p className="text-xs text-muted-foreground mt-1">
                Nenhum modelo cadastrado. Configure em <b>RH → Escalas</b>.
              </p>
            )}
          </div>
          <div>
            <Label>Data de início da escala</Label>
            <Input type="date" disabled={disabled}
              value={detail.schedule_start_date?.slice(0, 10) || detail.admission_date?.slice(0, 10) || ""}
              onChange={(e) => updateMut.mutate({ id: detail.id, schedule_start_date: e.target.value })} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepIntegracao({ detail, patchChecklist }: any) {
  const disabled = detail.status !== "em_andamento";
  return (
    <div className="space-y-2 py-2">
      <p className="text-xs text-muted-foreground">Registre quando cada item foi previsto e concluído.</p>
      {(detail.checklist || []).map((c: any, idx: number) => (
        <div key={c.key} className={`border rounded-lg p-3 grid grid-cols-12 gap-2 items-center ${c.done ? "bg-green-50/50" : ""}`}>
          <div className="col-span-12 md:col-span-5 flex items-center gap-2">
            <Switch checked={!!c.done} disabled={disabled}
              onCheckedChange={(v) => patchChecklist(idx, { done: v, done_at: v && !c.done_at ? new Date().toISOString() : c.done_at })} />
            <span className={`text-sm ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.label}</span>
          </div>
          <div className="col-span-6 md:col-span-3">
            <Label className="text-[10px] text-muted-foreground">Previsto</Label>
            <Input type="date" className="h-8" disabled={disabled}
              value={c.scheduled_at ? c.scheduled_at.slice(0, 10) : ""}
              onChange={(e) => patchChecklist(idx, { scheduled_at: e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : null })} />
          </div>
          <div className="col-span-6 md:col-span-3">
            <Label className="text-[10px] text-muted-foreground">Recebido/Feito em</Label>
            <Input type="date" className="h-8" disabled={disabled}
              value={c.done_at ? c.done_at.slice(0, 10) : ""}
              onChange={(e) => patchChecklist(idx, { done_at: e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : null, done: !!e.target.value })} />
          </div>
          <div className="col-span-12 md:col-span-1 text-right">
            {c.done && <Check className="w-4 h-4 text-green-600 inline" />}
          </div>
        </div>
      ))}
    </div>
  );
}

function StepConcluir({ detail, pending }: { detail: any; pending: string[] }) {
  return (
    <div className="space-y-3 py-2">
      {pending.length === 0 ? (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Check className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-semibold">Tudo pronto!</p>
              <p className="text-xs text-muted-foreground">Você pode concluir a admissão e criar o colaborador.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <p className="font-semibold">{pending.length} pendência(s) para regularizar</p>
            </div>
            <ul className="text-xs list-disc list-inside space-y-1">
              {pending.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            <p className="text-xs text-muted-foreground">
              Você pode voltar aos passos anteriores ou concluir mesmo assim (será solicitada confirmação).
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><span className="text-muted-foreground">Cargo:</span> {detail.position || "—"}</div>
        <div><span className="text-muted-foreground">Salário:</span> {Number(detail.salary || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
        <div><span className="text-muted-foreground">Admissão:</span> {fmtDate(detail.admission_date)}</div>
        <div><span className="text-muted-foreground">Escala:</span> {detail.schedule_template_id || "—"}</div>
      </div>
    </div>
  );
}
