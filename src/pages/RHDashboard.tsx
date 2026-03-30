import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useRhDashboard, useEmployees, useCreateVacation, useCreateMedicalCertificate, useValidateMedicalCertificate, useMedicalCertificates, useVacations } from "@/hooks/use-rh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, AlertTriangle, Clock, UserX, Palmtree, FileText,
  Plus, CheckCircle, XCircle, Stethoscope, CalendarDays, Users, Timer,
  ShieldAlert, FileCheck, Upload
} from "lucide-react";
import { format } from "date-fns";

const VACATION_EMPTY = {
  employee_id: "", vacation_type: "completa", start_date: "", end_date: "",
  days_total: 30, days_taken: 0, abono_pecuniario: false, abono_days: 0,
  acquisition_start: "", acquisition_end: "", notes: "",
};

const CERT_EMPTY = {
  employee_id: "", doctor_name: "", doctor_crm: "", cid_code: "",
  healthcare_unit: "", absence_start: "", absence_end: "", absence_days: 0,
  absence_hours: "", is_partial: false, document_url: "", notes: "",
};

export default function RHDashboard() {
  const [vacDialog, setVacDialog] = useState(false);
  const [certDialog, setCertDialog] = useState(false);
  const [certValidateDialog, setCertValidateDialog] = useState<any>(null);
  const [vacForm, setVacForm] = useState<any>({ ...VACATION_EMPTY });
  const [certForm, setCertForm] = useState<any>({ ...CERT_EMPTY });
  const [activeTab, setActiveTab] = useState("dashboard");
  const { toast } = useToast();

  const { data: dashboard, isLoading } = useRhDashboard();
  const { data: employees = [] } = useEmployees({ status: "ativo" });
  const { data: allCerts = [] } = useMedicalCertificates({});
  const { data: allVacations = [] } = useVacations({});
  const createVacation = useCreateVacation();
  const createCert = useCreateMedicalCertificate();
  const validateCert = useValidateMedicalCertificate();

  const summary = dashboard?.summary || {};
  const lateArrivals = dashboard?.late_arrivals || [];
  const absencesToday = dashboard?.absences_today || [];
  const vacExpiring = dashboard?.vacations_expiring || [];
  const pendingCerts = dashboard?.pending_certificates || [];
  const activeVacations = dashboard?.active_vacations || [];

  const setVacField = (k: string, v: any) => setVacForm((p: any) => {
    const next = { ...p, [k]: v };
    if (k === "days_total" || k === "days_taken") {
      next.days_remaining = (parseInt(next.days_total) || 30) - (parseInt(next.days_taken) || 0);
    }
    return next;
  });
  const setCertField = (k: string, v: any) => setCertForm((p: any) => {
    const next = { ...p, [k]: v };
    if ((k === "absence_start" || k === "absence_end") && next.absence_start && next.absence_end) {
      const d = Math.ceil((new Date(next.absence_end).getTime() - new Date(next.absence_start).getTime()) / 86400000) + 1;
      next.absence_days = Math.max(1, d);
    }
    return next;
  });

  const handleSaveVacation = async () => {
    if (!vacForm.employee_id || !vacForm.start_date || !vacForm.end_date) {
      toast({ title: "Preencha colaborador e datas", variant: "destructive" }); return;
    }
    try {
      await createVacation.mutateAsync(vacForm);
      toast({ title: "Férias registradas!" });
      setVacDialog(false);
      setVacForm({ ...VACATION_EMPTY });
    } catch { toast({ title: "Erro ao registrar férias", variant: "destructive" }); }
  };

  const handleSaveCert = async () => {
    if (!certForm.employee_id || !certForm.absence_start || !certForm.absence_end) {
      toast({ title: "Preencha colaborador e datas", variant: "destructive" }); return;
    }
    try {
      await createCert.mutateAsync(certForm);
      toast({ title: "Atestado registrado! Ponto justificado automaticamente." });
      setCertDialog(false);
      setCertForm({ ...CERT_EMPTY });
    } catch { toast({ title: "Erro ao registrar atestado", variant: "destructive" }); }
  };

  const handleValidateCert = async (approved: boolean) => {
    if (!certValidateDialog) return;
    try {
      await validateCert.mutateAsync({ id: certValidateDialog.id, validated: approved, rejection_reason: approved ? null : "Reprovado pelo RH" });
      toast({ title: approved ? "Atestado validado!" : "Atestado reprovado" });
      setCertValidateDialog(null);
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-primary" /> Dashboard RH
            </h1>
            <p className="text-sm text-muted-foreground">Visão geral de pessoas, ponto, férias e documentos</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { setVacForm({ ...VACATION_EMPTY }); setVacDialog(true); }} className="gap-2" variant="outline">
              <Palmtree className="h-4 w-4" /> Lançar Férias
            </Button>
            <Button onClick={() => { setCertForm({ ...CERT_EMPTY }); setCertDialog(true); }} className="gap-2">
              <Stethoscope className="h-4 w-4" /> Registrar Atestado
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Ativos", value: summary.total_active || 0, icon: Users, color: "text-green-600" },
            { label: "Em Férias", value: summary.on_vacation || 0, icon: Palmtree, color: "text-blue-600" },
            { label: "Afastados", value: summary.on_leave || 0, icon: ShieldAlert, color: "text-yellow-600" },
            { label: "Atrasados Hoje", value: lateArrivals.length, icon: Clock, color: "text-orange-600" },
            { label: "Ausentes Hoje", value: absencesToday.length, icon: UserX, color: "text-red-600" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color} opacity-70`} />
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Alertas</TabsTrigger>
            <TabsTrigger value="vacations">Férias</TabsTrigger>
            <TabsTrigger value="certificates">Atestados</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
          </TabsList>

          {/* DASHBOARD TAB */}
          <TabsContent value="dashboard" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Late Arrivals */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" /> Entradas Atrasadas Hoje
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lateArrivals.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhum atraso registrado</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {lateArrivals.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between p-2 rounded bg-orange-50 dark:bg-orange-950/20">
                          <div>
                            <p className="text-sm font-medium">{r.full_name}</p>
                            <p className="text-xs text-muted-foreground">Jornada: {r.work_schedule}</p>
                          </div>
                          <Badge variant="outline" className="text-orange-600 border-orange-300">{r.entry1}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Absences Today */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <UserX className="h-4 w-4 text-red-500" /> Ausentes Hoje
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {absencesToday.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Todos presentes</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {absencesToday.map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-950/20">
                          <div>
                            <p className="text-sm font-medium">{e.full_name}</p>
                            <p className="text-xs text-muted-foreground">{e.position || "—"} • {e.department_name || "Sem depto"}</p>
                          </div>
                          <Badge variant="destructive" className="text-xs">Ausente</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Vacations Expiring */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" /> Férias a Vencer (30 dias)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {vacExpiring.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma férias próxima ao vencimento</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {vacExpiring.map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between p-2 rounded bg-yellow-50 dark:bg-yellow-950/20">
                          <div>
                            <p className="text-sm font-medium">{e.full_name}</p>
                            <p className="text-xs text-muted-foreground">Admissão: {e.admission_date ? format(new Date(e.admission_date + "T12:00:00"), "dd/MM/yyyy") : "—"}</p>
                          </div>
                          <Badge variant="outline" className="text-yellow-600 border-yellow-300">Vencendo</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pending Certificates */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-blue-500" /> Atestados Pendentes de Validação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingCerts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhum atestado pendente</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {pendingCerts.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between p-2 rounded bg-blue-50 dark:bg-blue-950/20 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/40"
                          onClick={() => setCertValidateDialog(c)}>
                          <div>
                            <p className="text-sm font-medium">{c.full_name}</p>
                            <p className="text-xs text-muted-foreground">CID: {c.cid_code || "N/I"} • Dr. {c.doctor_name || "N/I"}</p>
                            <p className="text-xs text-muted-foreground">{c.absence_start} a {c.absence_end} ({c.absence_days} dias)</p>
                          </div>
                          <Badge variant="outline" className="text-blue-600 border-blue-300">Validar</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Active Vacations */}
            {activeVacations.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Palmtree className="h-4 w-4 text-green-500" /> Férias Ativas / Agendadas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead>Dias</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeVacations.map((v: any) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.full_name}</TableCell>
                          <TableCell><Badge variant="outline">{v.vacation_type === 'parcial' ? 'Parcial' : 'Completa'}</Badge></TableCell>
                          <TableCell>{v.start_date ? format(new Date(v.start_date + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell>{v.end_date ? format(new Date(v.end_date + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell>{v.days_total}</TableCell>
                          <TableCell>
                            <Badge className={v.status === 'em_andamento' ? "bg-green-500/10 text-green-700" : "bg-blue-500/10 text-blue-700"}>
                              {v.status === 'em_andamento' ? 'Em andamento' : 'Agendada'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* VACATIONS TAB */}
          <TabsContent value="vacations" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => { setVacForm({ ...VACATION_EMPTY }); setVacDialog(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Lançar Férias
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead className="hidden md:table-cell">Abono</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allVacations.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma férias registrada</TableCell></TableRow>
                    ) : allVacations.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.employee_name}</TableCell>
                        <TableCell><Badge variant="outline">{v.vacation_type === 'parcial' ? 'Parcial' : 'Completa'}</Badge></TableCell>
                        <TableCell>{v.start_date ? format(new Date(v.start_date + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell>{v.end_date ? format(new Date(v.end_date + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell>{v.days_total}</TableCell>
                        <TableCell className="hidden md:table-cell">{v.abono_pecuniario ? `${v.abono_days}d` : "Não"}</TableCell>
                        <TableCell>
                          <Badge className={
                            v.status === 'concluida' ? "bg-green-500/10 text-green-700" :
                            v.status === 'em_andamento' ? "bg-blue-500/10 text-blue-700" :
                            v.status === 'cancelada' ? "bg-red-500/10 text-red-700" :
                            "bg-yellow-500/10 text-yellow-700"
                          }>{v.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CERTIFICATES TAB */}
          <TabsContent value="certificates" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => { setCertForm({ ...CERT_EMPTY }); setCertDialog(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Registrar Atestado
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>CID</TableHead>
                      <TableHead>Médico</TableHead>
                      <TableHead className="hidden md:table-cell">CRM</TableHead>
                      <TableHead className="hidden md:table-cell">Local</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allCerts.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum atestado registrado</TableCell></TableRow>
                    ) : allCerts.map((c: any) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => !c.validated && setCertValidateDialog(c)}>
                        <TableCell className="font-medium">{c.employee_name}</TableCell>
                        <TableCell><Badge variant="outline">{c.cid_code || "N/I"}</Badge></TableCell>
                        <TableCell>{c.doctor_name || "N/I"}</TableCell>
                        <TableCell className="hidden md:table-cell">{c.doctor_crm || "N/I"}</TableCell>
                        <TableCell className="hidden md:table-cell">{c.healthcare_unit || "N/I"}</TableCell>
                        <TableCell className="text-xs">
                          {c.absence_start ? format(new Date(c.absence_start + "T12:00:00"), "dd/MM") : ""} - {c.absence_end ? format(new Date(c.absence_end + "T12:00:00"), "dd/MM") : ""}
                        </TableCell>
                        <TableCell>{c.absence_days || "—"}</TableCell>
                        <TableCell>
                          {c.validated ? (
                            <Badge className="bg-green-500/10 text-green-700">Validado</Badge>
                          ) : (
                            <Badge className="bg-yellow-500/10 text-yellow-700">Pendente</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DOCUMENTS TAB */}
          <TabsContent value="documents" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Central de Documentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">
                  A central de documentos permite receber e validar documentos dos colaboradores.<br />
                  Use a aba "Atestados" para registrar atestados médicos com justificativa automática de ponto.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* VACATION DIALOG */}
      <Dialog open={vacDialog} onOpenChange={setVacDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Lançar Férias</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador *</Label>
              <Select value={vacForm.employee_id} onValueChange={v => setVacField("employee_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Férias</Label>
              <Select value={vacForm.vacation_type} onValueChange={v => setVacField("vacation_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completa">Completa (30 dias)</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data Início *</Label><Input type="date" value={vacForm.start_date} onChange={e => setVacField("start_date", e.target.value)} /></div>
              <div><Label>Data Fim *</Label><Input type="date" value={vacForm.end_date} onChange={e => setVacField("end_date", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dias Totais</Label><Input type="number" value={vacForm.days_total} onChange={e => setVacField("days_total", parseInt(e.target.value) || 0)} /></div>
              <div><Label>Dias Já Gozados</Label><Input type="number" value={vacForm.days_taken} onChange={e => setVacField("days_taken", parseInt(e.target.value) || 0)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início Per. Aquisitivo</Label><Input type="date" value={vacForm.acquisition_start} onChange={e => setVacField("acquisition_start", e.target.value)} /></div>
              <div><Label>Fim Per. Aquisitivo</Label><Input type="date" value={vacForm.acquisition_end} onChange={e => setVacField("acquisition_end", e.target.value)} /></div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Switch checked={vacForm.abono_pecuniario} onCheckedChange={v => setVacField("abono_pecuniario", v)} />
              <Label>Abono Pecuniário (vender dias)</Label>
              {vacForm.abono_pecuniario && (
                <Input type="number" className="w-20" value={vacForm.abono_days} onChange={e => setVacField("abono_days", parseInt(e.target.value) || 0)} placeholder="Dias" />
              )}
            </div>
            <div><Label>Observações</Label><Textarea value={vacForm.notes} onChange={e => setVacField("notes", e.target.value)} rows={2} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setVacDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveVacation} disabled={createVacation.isPending}>
              {createVacation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MEDICAL CERTIFICATE DIALOG */}
      <Dialog open={certDialog} onOpenChange={setCertDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Atestado Médico</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador *</Label>
              <Select value={certForm.employee_id} onValueChange={v => setCertField("employee_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome do Médico</Label><Input value={certForm.doctor_name} onChange={e => setCertField("doctor_name", e.target.value)} /></div>
              <div><Label>CRM</Label><Input value={certForm.doctor_crm} onChange={e => setCertField("doctor_crm", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CID</Label><Input value={certForm.cid_code} onChange={e => setCertField("cid_code", e.target.value)} placeholder="Ex: J11" /></div>
              <div><Label>Unidade / Local</Label><Input value={certForm.healthcare_unit} onChange={e => setCertField("healthcare_unit", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início Afastamento *</Label><Input type="date" value={certForm.absence_start} onChange={e => setCertField("absence_start", e.target.value)} /></div>
              <div><Label>Fim Afastamento *</Label><Input type="date" value={certForm.absence_end} onChange={e => setCertField("absence_end", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dias de Afastamento</Label><Input type="number" value={certForm.absence_days} onChange={e => setCertField("absence_days", parseInt(e.target.value) || 0)} /></div>
              <div><Label>Horários (parcial)</Label><Input value={certForm.absence_hours} onChange={e => setCertField("absence_hours", e.target.value)} placeholder="Ex: 13:00-17:00" /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={certForm.is_partial} onCheckedChange={v => setCertField("is_partial", v)} />
              <Label>Atestado Parcial (horas)</Label>
            </div>
            <div><Label>URL do Documento</Label><Input value={certForm.document_url} onChange={e => setCertField("document_url", e.target.value)} placeholder="https://..." /></div>
            <div><Label>Observações</Label><Textarea value={certForm.notes} onChange={e => setCertField("notes", e.target.value)} rows={2} /></div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
              <strong>Justificativa automática:</strong> Ao registrar este atestado, os dias de falta ou atraso no período informado serão automaticamente justificados como "Atestado" no controle de ponto.
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setCertDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveCert} disabled={createCert.isPending}>
              {createCert.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* VALIDATE CERTIFICATE DIALOG */}
      <Dialog open={!!certValidateDialog} onOpenChange={() => setCertValidateDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Validar Atestado Médico</DialogTitle></DialogHeader>
          {certValidateDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><strong>Colaborador:</strong> {certValidateDialog.full_name || certValidateDialog.employee_name}</div>
                <div><strong>CID:</strong> {certValidateDialog.cid_code || "N/I"}</div>
                <div><strong>Médico:</strong> {certValidateDialog.doctor_name || "N/I"}</div>
                <div><strong>CRM:</strong> {certValidateDialog.doctor_crm || "N/I"}</div>
                <div><strong>Local:</strong> {certValidateDialog.healthcare_unit || "N/I"}</div>
                <div><strong>Dias:</strong> {certValidateDialog.absence_days || "N/I"}</div>
                <div><strong>Período:</strong> {certValidateDialog.absence_start} a {certValidateDialog.absence_end}</div>
              </div>
              {certValidateDialog.document_url && (
                <a href={certValidateDialog.document_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Ver documento</a>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="destructive" onClick={() => handleValidateCert(false)} disabled={validateCert.isPending}>
                  <XCircle className="h-4 w-4 mr-1" /> Reprovar
                </Button>
                <Button onClick={() => handleValidateCert(true)} disabled={validateCert.isPending}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}