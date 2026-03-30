import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee, useRhDepartments, useBranches, useCreateBranch, useDeleteBranch, useCreateRhDepartment, useDeleteRhDepartment, useRhPositions, useCreateRhPosition, useDeleteRhPosition, useWorkerProfiles, useCreateWorkerProfile, useDeleteWorkerProfile } from "@/hooks/use-rh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, UserCircle, Building2, FileText, Edit, Trash2, Eye, EyeOff, Users, Loader2, Calendar, Briefcase, X, MapPin, UserCog, DollarSign, Gift } from "lucide-react";
import { format, differenceInYears, differenceInMonths, differenceInDays, addYears, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-green-500/10 text-green-700 border-green-200",
  afastado: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  ferias: "bg-blue-500/10 text-blue-700 border-blue-200",
  desligado: "bg-red-500/10 text-red-700 border-red-200",
  suspenso: "bg-orange-500/10 text-orange-700 border-orange-200",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  clt: "CLT", pj: "PJ", freelancer: "Freelancer", temporario: "Temporário", estagiario: "Estagiário", aprendiz: "Aprendiz",
};

const PROFILE_LABELS: Record<string, string> = {
  administrativo: "Administrativo", supervisor: "Supervisor", promotor: "Promotor", operacional: "Operacional",
};

const SALARY_ITEM_TYPES = [
  "Salário Base", "Adicional Noturno", "Adicional Periculosidade", "Adicional Insalubridade",
  "Comissão", "Gratificação", "Hora Extra", "DSR", "Adicional de Função", "Bonificação", "Outro"
];

const BENEFIT_TYPES = [
  "Vale Transporte", "Vale Refeição", "Vale Alimentação", "Plano de Saúde", "Plano Odontológico",
  "Seguro de Vida", "Auxílio Creche", "Auxílio Educação", "Gympass/Wellhub", "PLR",
  "Cesta Básica", "Auxílio Home Office", "Outro"
];

const WEEKDAYS = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

const DEFAULT_SCHEDULE = {
  days: { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false },
  entry: "08:00",
  exit: "17:00",
  lunch_start: "12:00",
  lunch_end: "13:00",
};

function parseSchedule(ws: any) {
  if (!ws) return { ...DEFAULT_SCHEDULE, days: { ...DEFAULT_SCHEDULE.days } };
  if (typeof ws === "object" && ws.days) return ws;
  // Legacy "08:00-17:00" format
  const match = typeof ws === "string" && ws.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (match) return { ...DEFAULT_SCHEDULE, days: { ...DEFAULT_SCHEDULE.days }, entry: match[1], exit: match[2] };
  try { return JSON.parse(ws); } catch { return { ...DEFAULT_SCHEDULE, days: { ...DEFAULT_SCHEDULE.days } }; }
}

function calcScheduleHours(sched: any) {
  const [eh, em] = sched.entry.split(":").map(Number);
  const [xh, xm] = sched.exit.split(":").map(Number);
  const [lsh, lsm] = sched.lunch_start.split(":").map(Number);
  const [leh, lem] = sched.lunch_end.split(":").map(Number);
  const totalMin = (xh * 60 + xm) - (eh * 60 + em);
  const lunchMin = (leh * 60 + lem) - (lsh * 60 + lsm);
  const dailyHours = Math.max(0, totalMin - lunchMin) / 60;
  const workDays = Object.values(sched.days).filter(Boolean).length;
  const monthlyWorkDays = Math.round(workDays * 4.33);
  return { dailyHours, workDays, monthlyWorkDays, monthlyHours: dailyHours * monthlyWorkDays };
}

const EMPTY_FORM = {
  full_name: "", social_name: "", cpf: "", rg: "", birth_date: "", gender: "", email: "", phone: "",
  address: "", address_number: "", complement: "", neighborhood: "", city: "", state: "", zip_code: "",
  registration_number: "",
  worker_profile: "operacional", employment_type: "clt", position: "", salary: "",
  admission_date: "", department_id: "", branch_id: "", direct_manager_id: "",
  work_schedule: { ...DEFAULT_SCHEDULE, days: { ...DEFAULT_SCHEDULE.days } },
  bank_name: "", bank_agency: "", bank_account: "", bank_account_type: "",
  ctps_number: "", pis_pasep: "", cnpj: "", company_name: "", status: "ativo",
  salary_items: [] as { type: string; description: string; value: string }[],
  benefits: [] as { type: string; description: string; value: string; employer_cost: string }[],
};

// ============ CPF Validation ============
function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false; // all same digits
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(cleaned[10]);
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// ============ Age Calculation ============
function calcAge(birthDate: string): string {
  if (!birthDate) return "";
  const birth = new Date(birthDate + "T00:00:00");
  const today = new Date();
  const years = differenceInYears(today, birth);
  const afterYears = addYears(birth, years);
  const months = differenceInMonths(today, afterYears);
  const afterMonths = addMonths(afterYears, months);
  const days = differenceInDays(today, afterMonths);
  return `${years} anos, ${months} meses e ${days} dias`;
}

export default function RHColaboradores() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ ...EMPTY_FORM });
  const [showSensitive, setShowSensitive] = useState(false);
  const [cpfError, setCpfError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useEmployees({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const { data: departments = [] } = useRhDepartments();
  const { data: branches = [] } = useBranches();
  const { data: positions = [] } = useRhPositions();
  const { data: workerProfiles = [] } = useWorkerProfiles();
  const createMut = useCreateEmployee();
  const updateMut = useUpdateEmployee();
  const deleteMut = useDeleteEmployee();
  const createDeptMut = useCreateRhDepartment();
  const deleteDeptMut = useDeleteRhDepartment();
  const createPosMut = useCreateRhPosition();
  const deletePosMut = useDeleteRhPosition();
  const createBranchMut = useCreateBranch();
  const deleteBranchMut = useDeleteBranch();
  const createProfileMut = useCreateWorkerProfile();
  const deleteProfileMut = useDeleteWorkerProfile();

  const [newDeptName, setNewDeptName] = useState("");
  const [newPosName, setNewPosName] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [showDeptManager, setShowDeptManager] = useState(false);
  const [showPosManager, setShowPosManager] = useState(false);
  const [showBranchManager, setShowBranchManager] = useState(false);
  const [showProfileManager, setShowProfileManager] = useState(false);

  const maskCPF = (cpf: string) => {
    if (!cpf) return "—";
    if (showSensitive) return cpf;
    return cpf.replace(/(\d{3})\.\d{3}\.\d{3}(-\d{2})/, "$1.***.***$2");
  };

  // ============ CEP Lookup ============
  const lookupCEP = useCallback(async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((p: any) => ({
          ...p,
          address: data.logradouro || p.address,
          neighborhood: data.bairro || p.neighborhood,
          city: data.localidade || p.city,
          state: data.uf || p.state,
          complement: data.complemento || p.complement,
        }));
        toast({ title: "Endereço preenchido automaticamente!" });
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    } finally {
      setCepLoading(false);
    }
  }, [toast]);

  // ============ CPF handler ============
  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    setField("cpf", formatted);
    const digits = value.replace(/\D/g, "");
    if (digits.length === 11) {
      if (!validateCPF(digits)) {
        setCpfError("CPF inválido");
      } else {
        setCpfError("");
      }
    } else {
      setCpfError("");
    }
  };

  const openNew = () => { setForm({ ...EMPTY_FORM }); setEditId(null); setCpfError(""); setDialogOpen(true); };
  const openEdit = (emp: any) => {
    setForm({
      ...emp,
      salary: emp.salary || "",
      birth_date: emp.birth_date?.slice(0, 10) || "",
      admission_date: emp.admission_date?.slice(0, 10) || "",
      work_schedule: parseSchedule(emp.work_schedule),
      salary_items: emp.salary_items || [],
      benefits: emp.benefits || [],
    });
    setEditId(emp.id);
    setCpfError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    if (cpfError) { toast({ title: "CPF inválido, corrija antes de salvar", variant: "destructive" }); return; }
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, ...form });
        toast({ title: "Colaborador atualizado!" });
      } else {
        await createMut.mutateAsync(form);
        toast({ title: "Colaborador cadastrado!" });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja desligar este colaborador?")) return;
    await deleteMut.mutateAsync(id);
    toast({ title: "Colaborador desligado" });
  };

  const setField = (key: string, val: any) => setForm((p: any) => ({ ...p, [key]: val }));

  const stats = {
    total: employees.length,
    ativos: employees.filter((e: any) => e.status === "ativo").length,
    afastados: employees.filter((e: any) => e.status === "afastado" || e.status === "ferias").length,
    desligados: employees.filter((e: any) => e.status === "desligado").length,
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Colaboradores</h1>
            <p className="text-sm text-muted-foreground">Gestão de pessoas e fichas cadastrais</p>
          </div>
          <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Colaborador</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Ativos", value: stats.ativos, color: "text-green-600" },
            { label: "Afastados", value: stats.afastados, color: "text-yellow-600" },
            { label: "Desligados", value: stats.desligados, color: "text-red-600" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, CPF ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="afastado">Afastado</SelectItem>
              <SelectItem value="ferias">Férias</SelectItem>
              <SelectItem value="desligado">Desligado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setShowSensitive(!showSensitive)} title={showSensitive ? "Ocultar dados sensíveis" : "Mostrar dados sensíveis"}>
            {showSensitive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">CPF</TableHead>
                  <TableHead className="hidden md:table-cell">Cargo</TableHead>
                  <TableHead className="hidden lg:table-cell">Vínculo</TableHead>
                  <TableHead className="hidden lg:table-cell">Departamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : employees.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum colaborador encontrado</TableCell></TableRow>
                ) : employees.map((emp: any) => (
                  <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(emp)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{emp.full_name}</p>
                          <p className="text-xs text-muted-foreground">{emp.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{maskCPF(emp.cpf)}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{emp.position || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell"><Badge variant="outline" className="text-xs">{EMPLOYMENT_LABELS[emp.employment_type] || emp.employment_type}</Badge></TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{emp.department_name || "—"}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[emp.status] || ""}>{emp.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openEdit(emp); }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); handleDelete(emp.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
            {/* Age display when editing and has birth_date */}
            {form.birth_date && (
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Idade: <strong className="text-foreground">{calcAge(form.birth_date)}</strong></span>
              </div>
            )}
          </DialogHeader>
          <Tabs defaultValue="pessoal">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
              <TabsTrigger value="profissional">Profissional</TabsTrigger>
              <TabsTrigger value="remuneracao" className="gap-1"><DollarSign className="h-3 w-3" />Remuneração</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
              <TabsTrigger value="bancario">Bancário</TabsTrigger>
            </TabsList>

            <TabsContent value="pessoal" className="space-y-3 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Nome Completo *</Label><Input value={form.full_name} onChange={e => setField("full_name", e.target.value)} /></div>
                <div><Label>Nome Social</Label><Input value={form.social_name} onChange={e => setField("social_name", e.target.value)} /></div>
                <div>
                  <Label>CPF</Label>
                  <Input
                    value={form.cpf}
                    onChange={e => handleCPFChange(e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={cpfError ? "border-destructive" : ""}
                  />
                  {cpfError && <p className="text-xs text-destructive mt-1">{cpfError}</p>}
                </div>
                <div><Label>RG</Label><Input value={form.rg} onChange={e => setField("rg", e.target.value)} /></div>
                <div>
                  <Label>Data de Nascimento</Label>
                  <Input type="date" value={form.birth_date} onChange={e => setField("birth_date", e.target.value)} />
                  {form.birth_date && (
                    <p className="text-xs text-muted-foreground mt-1">{calcAge(form.birth_date)}</p>
                  )}
                </div>
                <div><Label>Gênero</Label>
                  <Select value={form.gender} onValueChange={v => setField("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                      <SelectItem value="nao_informar">Prefiro não informar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setField("email", e.target.value)} /></div>
                <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setField("phone", e.target.value)} /></div>
              </div>

              {/* Endereço com CEP auto-fill */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input
                      value={form.zip_code}
                      onChange={e => {
                        const formatted = formatCEP(e.target.value);
                        setField("zip_code", formatted);
                        if (formatted.replace(/\D/g, "").length === 8) {
                          lookupCEP(formatted);
                        }
                      }}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    {cepLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                <div className="md:col-span-2"><Label>Endereço</Label><Input value={form.address} onChange={e => setField("address", e.target.value)} /></div>
                <div><Label>Número</Label><Input value={form.address_number} onChange={e => setField("address_number", e.target.value)} /></div>
                <div><Label>Complemento</Label><Input value={form.complement} onChange={e => setField("complement", e.target.value)} /></div>
                <div><Label>Bairro</Label><Input value={form.neighborhood} onChange={e => setField("neighborhood", e.target.value)} /></div>
                <div><Label>Cidade</Label><Input value={form.city} onChange={e => setField("city", e.target.value)} /></div>
                <div><Label>Estado</Label><Input value={form.state} onChange={e => setField("state", e.target.value)} maxLength={2} /></div>
              </div>
            </TabsContent>

            <TabsContent value="profissional" className="space-y-3 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Matrícula</Label><Input value={form.registration_number} onChange={e => setField("registration_number", e.target.value)} /></div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Cargo</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => setShowPosManager(!showPosManager)}>
                      <Briefcase className="h-3 w-3" /> Gerenciar
                    </Button>
                  </div>
                  <Select value={form.position || ""} onValueChange={v => setField("position", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar cargo" /></SelectTrigger>
                    <SelectContent>
                      {positions.map((p: any) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                      {positions.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum cargo cadastrado</p>}
                    </SelectContent>
                  </Select>
                  {showPosManager && (
                    <div className="mt-2 p-3 border rounded-lg bg-muted/30 space-y-2">
                      <p className="text-xs font-medium">Cargos cadastrados:</p>
                      <div className="flex flex-wrap gap-1">
                        {positions.map((p: any) => (
                          <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
                            {p.name}
                            <button onClick={() => deletePosMut.mutate(p.id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Input value={newPosName} onChange={e => setNewPosName(e.target.value)} placeholder="Novo cargo..." className="h-8 text-sm" />
                        <Button size="sm" className="h-8 shrink-0" disabled={!newPosName.trim() || createPosMut.isPending}
                          onClick={async () => { await createPosMut.mutateAsync({ name: newPosName.trim() }); setNewPosName(""); }}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Perfil Funcional</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => setShowProfileManager(!showProfileManager)}>
                      <UserCog className="h-3 w-3" /> Gerenciar
                    </Button>
                  </div>
                  <Select value={form.worker_profile || ""} onValueChange={v => setField("worker_profile", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar perfil" /></SelectTrigger>
                    <SelectContent>
                      {/* Default profiles */}
                      {Object.entries(PROFILE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      {/* Custom profiles */}
                      {workerProfiles.filter((p: any) => !Object.keys(PROFILE_LABELS).includes(p.name)).map((p: any) => (
                        <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showProfileManager && (
                    <div className="mt-2 p-3 border rounded-lg bg-muted/30 space-y-2">
                      <p className="text-xs font-medium">Perfis cadastrados:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(PROFILE_LABELS).map(([k, v]) => (
                          <Badge key={k} variant="outline" className="gap-1">{v}</Badge>
                        ))}
                        {workerProfiles.map((p: any) => (
                          <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
                            {p.name}
                            <button onClick={() => deleteProfileMut.mutate(p.id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Input value={newProfileName} onChange={e => setNewProfileName(e.target.value)} placeholder="Novo perfil..." className="h-8 text-sm" />
                        <Button size="sm" className="h-8 shrink-0" disabled={!newProfileName.trim() || createProfileMut.isPending}
                          onClick={async () => { await createProfileMut.mutateAsync({ name: newProfileName.trim() }); setNewProfileName(""); }}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div><Label>Tipo de Vínculo</Label>
                  <Select value={form.employment_type} onValueChange={v => setField("employment_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Departamento</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => setShowDeptManager(!showDeptManager)}>
                      <Building2 className="h-3 w-3" /> Gerenciar
                    </Button>
                  </div>
                  <Select value={form.department_id || ""} onValueChange={v => setField("department_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      {departments.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum departamento cadastrado</p>}
                    </SelectContent>
                  </Select>
                  {showDeptManager && (
                    <div className="mt-2 p-3 border rounded-lg bg-muted/30 space-y-2">
                      <p className="text-xs font-medium">Departamentos cadastrados:</p>
                      <div className="flex flex-wrap gap-1">
                        {departments.map((d: any) => (
                          <Badge key={d.id} variant="secondary" className="gap-1 pr-1">
                            {d.name}
                            <button onClick={() => deleteDeptMut.mutate(d.id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Input value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="Novo departamento..." className="h-8 text-sm" />
                        <Button size="sm" className="h-8 shrink-0" disabled={!newDeptName.trim() || createDeptMut.isPending}
                          onClick={async () => { await createDeptMut.mutateAsync({ name: newDeptName.trim() }); setNewDeptName(""); }}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Filial</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => setShowBranchManager(!showBranchManager)}>
                      <MapPin className="h-3 w-3" /> Gerenciar
                    </Button>
                  </div>
                  <Select value={form.branch_id || ""} onValueChange={v => setField("branch_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar filial" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      {branches.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhuma filial cadastrada</p>}
                    </SelectContent>
                  </Select>
                  {showBranchManager && (
                    <div className="mt-2 p-3 border rounded-lg bg-muted/30 space-y-2">
                      <p className="text-xs font-medium">Filiais cadastradas:</p>
                      <div className="flex flex-wrap gap-1">
                        {branches.map((b: any) => (
                          <Badge key={b.id} variant="secondary" className="gap-1 pr-1">
                            {b.name}
                            <button onClick={() => deleteBranchMut.mutate(b.id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Input value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder="Nova filial..." className="h-8 text-sm" />
                        <Button size="sm" className="h-8 shrink-0" disabled={!newBranchName.trim() || createBranchMut.isPending}
                          onClick={async () => { await createBranchMut.mutateAsync({ name: newBranchName.trim() }); setNewBranchName(""); }}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div><Label>Salário Mensal (R$)</Label><Input type="number" value={form.salary} onChange={e => setField("salary", e.target.value)} /></div>

                {/* ====== JORNADA DE TRABALHO DETALHADA ====== */}
                <div className="col-span-2 space-y-3 p-4 rounded-lg border bg-muted/30">
                  <Label className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> Jornada de Trabalho</Label>
                  {(() => {
                    const sched = form.work_schedule && typeof form.work_schedule === "object" ? form.work_schedule : parseSchedule(form.work_schedule);
                    const updateSched = (patch: any) => setField("work_schedule", { ...sched, ...patch });
                    const toggleDay = (day: string) => updateSched({ days: { ...sched.days, [day]: !sched.days[day] } });

                    const stats = calcScheduleHours(sched);
                    const hourlyRate = stats.monthlyHours > 0 && form.salary ? parseFloat(form.salary) / stats.monthlyHours : 0;

                    return (
                      <>
                        {/* Days of week toggles */}
                        <div className="flex flex-wrap gap-2">
                          {WEEKDAYS.map(wd => (
                            <button key={wd.key} type="button" onClick={() => toggleDay(wd.key)}
                              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                                sched.days[wd.key]
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted text-muted-foreground border-border hover:bg-accent"
                              }`}>
                              {wd.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Dias trabalhados: {Object.entries(sched.days).filter(([,v]) => v).map(([k]) => WEEKDAYS.find(w => w.key === k)?.label).join(", ") || "Nenhum"}
                          {" · "}Folga: {Object.entries(sched.days).filter(([,v]) => !v).map(([k]) => WEEKDAYS.find(w => w.key === k)?.label).join(", ") || "Nenhuma"}
                        </p>

                        {/* Time inputs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div><Label className="text-xs">Entrada</Label><Input type="time" value={sched.entry} onChange={e => updateSched({ entry: e.target.value })} /></div>
                          <div><Label className="text-xs">Saída</Label><Input type="time" value={sched.exit} onChange={e => updateSched({ exit: e.target.value })} /></div>
                          <div><Label className="text-xs">Início Almoço</Label><Input type="time" value={sched.lunch_start} onChange={e => updateSched({ lunch_start: e.target.value })} /></div>
                          <div><Label className="text-xs">Fim Almoço</Label><Input type="time" value={sched.lunch_end} onChange={e => updateSched({ lunch_end: e.target.value })} /></div>
                        </div>

                        {/* Calculated stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-background border">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Horas/Dia</p>
                            <p className="text-sm font-semibold">{stats.dailyHours.toFixed(1)}h</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Dias/Semana</p>
                            <p className="text-sm font-semibold">{stats.workDays}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Horas/Mês ({stats.monthlyWorkDays}d)</p>
                            <p className="text-sm font-semibold">{stats.monthlyHours.toFixed(0)}h</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Valor/Hora</p>
                            <p className="text-sm font-semibold text-primary">R$ {hourlyRate.toFixed(2)}</p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div><Label>Data de Admissão</Label><Input type="date" value={form.admission_date} onChange={e => setField("admission_date", e.target.value)} /></div>
                <div><Label>Supervisor / Responsável</Label>
                  <Select value={form.direct_manager_id || "__none__"} onValueChange={v => setField("direct_manager_id", v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar supervisor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {employees.filter((e: any) => e.id !== editId && (e.worker_profile === 'supervisor' || e.worker_profile === 'administrativo')).map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.position || e.worker_profile})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setField("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="afastado">Afastado</SelectItem>
                      <SelectItem value="ferias">Férias</SelectItem>
                      <SelectItem value="suspenso">Suspenso</SelectItem>
                      <SelectItem value="desligado">Desligado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* ===== ABA REMUNERAÇÃO ===== */}
            <TabsContent value="remuneracao" className="space-y-4 mt-4">
              {/* Composição Salarial */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Composição Salarial</h3>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setForm((p: any) => ({
                      ...p,
                      salary_items: [...(p.salary_items || []), { type: "Salário Base", description: "", value: "" }]
                    }))}>
                    <Plus className="h-3 w-3" /> Adicionar Item
                  </Button>
                </div>
                {(form.salary_items || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg border-dashed">Nenhum item de composição salarial adicionado</p>
                )}
                {(form.salary_items || []).map((item: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-[1fr_1.5fr_auto_auto] gap-2 items-end p-3 rounded-lg bg-muted/30 border">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={item.type} onValueChange={v => {
                        const items = [...form.salary_items];
                        items[idx] = { ...items[idx], type: v };
                        setField("salary_items", items);
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SALARY_ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Descrição</Label>
                      <Input className="h-8 text-xs" placeholder="Detalhes..." value={item.description}
                        onChange={e => {
                          const items = [...form.salary_items];
                          items[idx] = { ...items[idx], description: e.target.value };
                          setField("salary_items", items);
                        }} />
                    </div>
                    <div>
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input className="h-8 text-xs w-28" type="number" placeholder="0,00" value={item.value}
                        onChange={e => {
                          const items = [...form.salary_items];
                          items[idx] = { ...items[idx], value: e.target.value };
                          setField("salary_items", items);
                        }} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => {
                        const items = form.salary_items.filter((_: any, i: number) => i !== idx);
                        setField("salary_items", items);
                      }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {(form.salary_items || []).length > 0 && (
                  <div className="flex justify-end p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm font-semibold">Total Composição: <span className="text-primary">
                      R$ {(form.salary_items || []).reduce((s: number, i: any) => s + (parseFloat(i.value) || 0), 0).toFixed(2)}
                    </span></p>
                  </div>
                )}
              </div>

              {/* Benefícios */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /> Benefícios</h3>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setForm((p: any) => ({
                      ...p,
                      benefits: [...(p.benefits || []), { type: "Vale Refeição", description: "", value: "", employer_cost: "" }]
                    }))}>
                    <Plus className="h-3 w-3" /> Adicionar Benefício
                  </Button>
                </div>
                {(form.benefits || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg border-dashed">Nenhum benefício adicionado</p>
                )}
                {(form.benefits || []).map((ben: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-end p-3 rounded-lg bg-muted/30 border">
                    <div>
                      <Label className="text-xs">Benefício</Label>
                      <Select value={ben.type} onValueChange={v => {
                        const items = [...form.benefits];
                        items[idx] = { ...items[idx], type: v };
                        setField("benefits", items);
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BENEFIT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Descrição</Label>
                      <Input className="h-8 text-xs" placeholder="Detalhes..." value={ben.description}
                        onChange={e => {
                          const items = [...form.benefits];
                          items[idx] = { ...items[idx], description: e.target.value };
                          setField("benefits", items);
                        }} />
                    </div>
                    <div>
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input className="h-8 text-xs w-24" type="number" placeholder="0,00" value={ben.value}
                        onChange={e => {
                          const items = [...form.benefits];
                          items[idx] = { ...items[idx], value: e.target.value };
                          setField("benefits", items);
                        }} />
                    </div>
                    <div>
                      <Label className="text-xs">Custo Empresa</Label>
                      <Input className="h-8 text-xs w-24" type="number" placeholder="0,00" value={ben.employer_cost}
                        onChange={e => {
                          const items = [...form.benefits];
                          items[idx] = { ...items[idx], employer_cost: e.target.value };
                          setField("benefits", items);
                        }} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => {
                        const items = form.benefits.filter((_: any, i: number) => i !== idx);
                        setField("benefits", items);
                      }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {(form.benefits || []).length > 0 && (
                  <div className="flex justify-between p-2 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                    <p className="font-semibold">Total Benefícios: <span className="text-primary">
                      R$ {(form.benefits || []).reduce((s: number, i: any) => s + (parseFloat(i.value) || 0), 0).toFixed(2)}
                    </span></p>
                    <p className="font-semibold">Custo Empresa: <span className="text-destructive">
                      R$ {(form.benefits || []).reduce((s: number, i: any) => s + (parseFloat(i.employer_cost) || 0), 0).toFixed(2)}
                    </span></p>
                  </div>
                )}
              </div>

              {/* Resumo Geral */}
              {((form.salary_items || []).length > 0 || (form.benefits || []).length > 0) && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 space-y-1">
                  <h4 className="text-sm font-bold text-primary">Resumo da Remuneração</h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Composição Salarial</p>
                      <p className="font-semibold text-sm">R$ {(form.salary_items || []).reduce((s: number, i: any) => s + (parseFloat(i.value) || 0), 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Benefícios</p>
                      <p className="font-semibold text-sm">R$ {(form.benefits || []).reduce((s: number, i: any) => s + (parseFloat(i.value) || 0), 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Geral</p>
                      <p className="font-bold text-sm text-primary">R$ {(
                        (form.salary_items || []).reduce((s: number, i: any) => s + (parseFloat(i.value) || 0), 0) +
                        (form.benefits || []).reduce((s: number, i: any) => s + (parseFloat(i.value) || 0), 0)
                      ).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="documentos" className="space-y-3 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>CTPS Número</Label><Input value={form.ctps_number} onChange={e => setField("ctps_number", e.target.value)} /></div>
                <div><Label>PIS/PASEP</Label><Input value={form.pis_pasep} onChange={e => setField("pis_pasep", e.target.value)} /></div>
                {form.employment_type === "pj" && (
                  <>
                    <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setField("cnpj", e.target.value)} /></div>
                    <div><Label>Razão Social</Label><Input value={form.company_name} onChange={e => setField("company_name", e.target.value)} /></div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="bancario" className="space-y-3 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Banco</Label><Input value={form.bank_name} onChange={e => setField("bank_name", e.target.value)} /></div>
                <div><Label>Agência</Label><Input value={form.bank_agency} onChange={e => setField("bank_agency", e.target.value)} /></div>
                <div><Label>Conta</Label><Input value={form.bank_account} onChange={e => setField("bank_account", e.target.value)} /></div>
                <div><Label>Tipo</Label>
                  <Select value={form.bank_account_type || ""} onValueChange={v => setField("bank_account_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Corrente</SelectItem>
                      <SelectItem value="poupanca">Poupança</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
