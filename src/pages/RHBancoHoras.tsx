import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useTimeBankConfig, useSaveTimeBankConfig,
  useTimeBankSummary, useExpiringEntries, useRunExpiration,
  useCompensations, useCreateCompensation, useUpdateCompensation, useDeleteCompensation,
} from "@/hooks/use-timeclock";
import { useEmployees } from "@/hooks/use-rh";
import {
  Clock, AlertTriangle, Settings, PlayCircle, Plus, Check, X, Trash2, CalendarClock, Loader2, TrendingUp, TrendingDown,
} from "lucide-react";

const fmtHM = (min: number) => {
  const n = Math.abs(min || 0);
  const h = Math.floor(n / 60);
  const m = n % 60;
  const sign = (min || 0) < 0 ? "-" : "";
  return `${sign}${h}h${String(m).padStart(2, "0")}`;
};

export default function RHBancoHoras() {
  const { toast } = useToast();
  const [tab, setTab] = useState("resumo");

  const { data: config } = useTimeBankConfig();
  const saveConfig = useSaveTimeBankConfig();
  const { data: summary = [], isLoading: loadSummary } = useTimeBankSummary();
  const { data: expiring = [] } = useExpiringEntries({ days: 60 });
  const runExpire = useRunExpiration();

  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const { data: compensations = [] } = useCompensations({ status: statusFilter || undefined });

  const { data: employees = [] } = useEmployees({ status: "ativo" });
  const createComp = useCreateCompensation();
  const updateComp = useUpdateCompensation();
  const deleteComp = useDeleteCompensation();

  const [cfgForm, setCfgForm] = useState<any>(null);
  const [cfgOpen, setCfgOpen] = useState(false);
  const openConfig = () => {
    setCfgForm({
      expiration_months: config?.expiration_months ?? 12,
      allow_debit: config?.allow_debit ?? true,
      max_debit_hours: config?.max_debit_hours ?? 40,
      notify_days_before: config?.notify_days_before ?? 30,
      compensation_requires_approval: config?.compensation_requires_approval ?? true,
      auto_expire_enabled: config?.auto_expire_enabled ?? true,
    });
    setCfgOpen(true);
  };
  const submitConfig = async () => {
    await saveConfig.mutateAsync(cfgForm);
    toast({ title: "Configuração salva" });
    setCfgOpen(false);
  };

  const [compOpen, setCompOpen] = useState(false);
  const [compForm, setCompForm] = useState({ employee_id: "", planned_date: "", hours: 1, description: "" });
  const submitComp = async () => {
    if (!compForm.employee_id || !compForm.planned_date || !compForm.hours) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    await createComp.mutateAsync({
      employee_id: compForm.employee_id,
      planned_date: compForm.planned_date,
      minutes: Math.round(compForm.hours * 60),
      description: compForm.description,
    });
    toast({ title: "Compensação solicitada" });
    setCompOpen(false);
    setCompForm({ employee_id: "", planned_date: "", hours: 1, description: "" });
  };

  const totals = useMemo(() => {
    const t = { balance: 0, available: 0, expiring: 0, expired: 0, pending: 0, positive: 0, negative: 0 };
    for (const r of summary as any[]) {
      t.balance += Number(r.balance_min || 0);
      t.available += Number(r.available_min || 0);
      t.expiring += Number(r.expiring_soon_min || 0);
      t.expired += Number(r.expired_min || 0);
      t.pending += Number(r.pending_comp_min || 0);
      if ((r.balance_min || 0) > 0) t.positive++;
      else if ((r.balance_min || 0) < 0) t.negative++;
    }
    return t;
  }, [summary]);

  const runExpirationNow = async () => {
    const res = await runExpire.mutateAsync();
    toast({ title: `${res.processed} lançamentos expirados` });
  };

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="w-6 h-6 text-primary" /> Banco de Horas
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerenciamento de créditos, compensações e expiração ({config?.expiration_months || 12} meses)
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openConfig}>
              <Settings className="w-4 h-4 mr-2" /> Configurar
            </Button>
            <Button variant="outline" onClick={runExpirationNow} disabled={runExpire.isPending}>
              {runExpire.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
              Executar Expiração
            </Button>
            <Button onClick={() => setCompOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nova Compensação
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI title="Saldo Total" value={fmtHM(totals.balance)} icon={<Clock className="w-5 h-5" />} />
          <KPI title="Disponível" value={fmtHM(totals.available)} icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} />
          <KPI title="A Expirar (60d)" value={fmtHM(totals.expiring)} icon={<AlertTriangle className="w-5 h-5 text-amber-600" />} />
          <KPI title="Compensações Pendentes" value={fmtHM(totals.pending)} icon={<CalendarClock className="w-5 h-5 text-blue-600" />} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="resumo">Colaboradores</TabsTrigger>
            <TabsTrigger value="expirando">A Expirar ({expiring.length})</TabsTrigger>
            <TabsTrigger value="compensacoes">Compensações</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo">
            <Card>
              <CardHeader><CardTitle>Saldo por Colaborador</CardTitle></CardHeader>
              <CardContent>
                {loadSummary ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                ) : (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Colaborador</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead className="text-right">Disponível</TableHead>
                          <TableHead className="text-right">A Expirar</TableHead>
                          <TableHead className="text-right">Expirado</TableHead>
                          <TableHead className="text-right">Pendente Comp.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(summary as any[]).map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.full_name}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={r.balance_min >= 0 ? "default" : "destructive"}>{fmtHM(r.balance_min)}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{fmtHM(r.available_min)}</TableCell>
                            <TableCell className="text-right">
                              {r.expiring_soon_min > 0 ? (
                                <span className="text-amber-600 font-medium">{fmtHM(r.expiring_soon_min)}</span>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">{fmtHM(r.expired_min)}</TableCell>
                            <TableCell className="text-right">{r.pending_comp_min > 0 ? fmtHM(r.pending_comp_min) : "—"}</TableCell>
                          </TableRow>
                        ))}
                        {!summary.length && (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum colaborador</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expirando">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" /> Créditos Próximos ao Vencimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-right">Minutos</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Vence em</TableHead>
                        <TableHead className="text-right">Dias</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiring.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.full_name}</TableCell>
                          <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                          <TableCell className="text-right">{fmtHM(r.minutes)}</TableCell>
                          <TableCell>{r.entry_date?.slice(0, 10)}</TableCell>
                          <TableCell>{r.expires_at?.slice(0, 10)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={r.days_remaining <= 15 ? "destructive" : "secondary"}>
                              {r.days_remaining}d
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!expiring.length && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum crédito vencendo em 60 dias</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compensacoes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Solicitações de Compensação</CardTitle>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="approved">Aprovadas</SelectItem>
                    <SelectItem value="executed">Executadas</SelectItem>
                    <SelectItem value="rejected">Rejeitadas</SelectItem>
                    <SelectItem value="cancelled">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Data Planejada</TableHead>
                        <TableHead className="text-right">Horas</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compensations.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.full_name}</TableCell>
                          <TableCell>{c.planned_date?.slice(0, 10)}</TableCell>
                          <TableCell className="text-right">{fmtHM(c.minutes)}</TableCell>
                          <TableCell className="max-w-[240px] truncate">{c.description || "—"}</TableCell>
                          <TableCell><StatusBadge status={c.status} /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {c.status === "pending" && (
                                <>
                                  <Button size="sm" variant="outline"
                                    onClick={async () => { await updateComp.mutateAsync({ id: c.id, status: "approved" }); toast({ title: "Aprovada" }); }}>
                                    <Check className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="sm" variant="outline"
                                    onClick={async () => { await updateComp.mutateAsync({ id: c.id, status: "rejected" }); toast({ title: "Rejeitada" }); }}>
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost"
                                    onClick={async () => { await deleteComp.mutateAsync(c.id); toast({ title: "Removida" }); }}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                              {c.status === "approved" && (
                                <Button size="sm"
                                  onClick={async () => { await updateComp.mutateAsync({ id: c.id, status: "executed" }); toast({ title: "Executada — débito lançado" }); }}>
                                  Executar
                                </Button>
                              )}
                              {c.status === "executed" && (
                                <Button size="sm" variant="outline"
                                  onClick={async () => { await updateComp.mutateAsync({ id: c.id, status: "cancelled" }); toast({ title: "Cancelada — débito revertido" }); }}>
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!compensations.length && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma compensação</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Config */}
      <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configuração do Banco de Horas</DialogTitle></DialogHeader>
          {cfgForm && (
            <div className="space-y-4">
              <div>
                <Label>Prazo de expiração</Label>
                <Select value={String(cfgForm.expiration_months)} onValueChange={(v) => setCfgForm({ ...cfgForm, expiration_months: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                    <SelectItem value="18">18 meses</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Créditos não utilizados dentro deste prazo são debitados automaticamente.
                </p>
              </div>
              <div>
                <Label>Notificar antes (dias)</Label>
                <Input type="number" min={1} max={90} value={cfgForm.notify_days_before}
                  onChange={(e) => setCfgForm({ ...cfgForm, notify_days_before: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Limite máximo de saldo negativo (horas)</Label>
                <Input type="number" min={0} step={0.5} value={cfgForm.max_debit_hours}
                  onChange={(e) => setCfgForm({ ...cfgForm, max_debit_hours: Number(e.target.value) })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Permitir saldo negativo</Label>
                <Switch checked={cfgForm.allow_debit} onCheckedChange={(v) => setCfgForm({ ...cfgForm, allow_debit: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Compensações exigem aprovação</Label>
                <Switch checked={cfgForm.compensation_requires_approval} onCheckedChange={(v) => setCfgForm({ ...cfgForm, compensation_requires_approval: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Expiração automática ativa</Label>
                <Switch checked={cfgForm.auto_expire_enabled} onCheckedChange={(v) => setCfgForm({ ...cfgForm, auto_expire_enabled: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCfgOpen(false)}>Cancelar</Button>
            <Button onClick={submitConfig} disabled={saveConfig.isPending}>
              {saveConfig.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Compensação */}
      <Dialog open={compOpen} onOpenChange={setCompOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Compensação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <Select value={compForm.employee_id} onValueChange={(v) => setCompForm({ ...compForm, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(employees as any[]).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data prevista</Label>
              <Input type="date" value={compForm.planned_date}
                onChange={(e) => setCompForm({ ...compForm, planned_date: e.target.value })} />
            </div>
            <div>
              <Label>Horas a compensar</Label>
              <Input type="number" min={0.25} step={0.25} value={compForm.hours}
                onChange={(e) => setCompForm({ ...compForm, hours: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea rows={2} value={compForm.description}
                onChange={(e) => setCompForm({ ...compForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompOpen(false)}>Cancelar</Button>
            <Button onClick={submitComp} disabled={createComp.isPending}>
              {createComp.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Solicitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function KPI({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    pending: { label: "Pendente", variant: "secondary" },
    approved: { label: "Aprovada", variant: "default" },
    executed: { label: "Executada", variant: "default" },
    rejected: { label: "Rejeitada", variant: "destructive" },
    cancelled: { label: "Cancelada", variant: "outline" },
  };
  const s = map[status] || { label: status, variant: "outline" };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
