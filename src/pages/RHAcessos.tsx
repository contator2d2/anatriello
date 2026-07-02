import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useEmployees, useGrantManagerAccess } from "@/hooks/use-rh";
import { useGrantAppAccess, useBlockAppAccess, useResetAppPassword } from "@/hooks/use-promotor";
import { useAppAccessTemplates, useAssignAppTemplate } from "@/hooks/use-app-access-templates";
import AppAccessTemplatesTab from "@/components/rh/AppAccessTemplatesTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Shield, ShieldOff, KeyRound, Copy, Smartphone, UserCheck, UserX, RefreshCw, Loader2, BriefcaseBusiness } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ACCESS_STATUS_MAP: Record<string, { label: string; color: string }> = {
  sem_acesso: { label: "Sem acesso", color: "bg-muted text-muted-foreground" },
  liberado: { label: "Liberado", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
  aguardando_login: { label: "Aguardando login", color: "bg-yellow-500/10 text-yellow-700 border-yellow-200" },
  ativo: { label: "Ativo", color: "bg-green-500/10 text-green-700 border-green-200" },
  bloqueado: { label: "Bloqueado", color: "bg-red-500/10 text-red-700 border-red-200" },
  suspenso: { label: "Suspenso", color: "bg-orange-500/10 text-orange-700 border-orange-200" },
};

function generateTempPassword() {
  const nums = Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('');
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const letters = Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `anatri${nums}${letters}`;
}

export default function RHAcessos() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [grantDialog, setGrantDialog] = useState<any>(null);
  const [managerDialog, setManagerDialog] = useState<any>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [grantTemplateId, setGrantTemplateId] = useState<string>("");
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useEmployees();
  const { data: templates = [] } = useAppAccessTemplates();
  const grantAccess = useGrantAppAccess();
  const grantManagerAccess = useGrantManagerAccess();
  const blockAccess = useBlockAppAccess();
  const resetPassword = useResetAppPassword();
  const assignTemplate = useAssignAppTemplate();

  const filtered = useMemo(() => {
    let list = employees as any[];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((e: any) => e.full_name?.toLowerCase().includes(s) || e.cpf?.includes(s) || e.email?.toLowerCase().includes(s));
    }
    if (statusFilter !== "todos") {
      list = list.filter((e: any) => {
        const status = e.app_access_status || "sem_acesso";
        return status === statusFilter;
      });
    }
    return list;
  }, [employees, search, statusFilter]);

  const stats = useMemo(() => {
    const all = employees as any[];
    const active = all.filter((e: any) => e.app_access_status === 'ativo' || e.app_access_status === 'liberado' || e.app_access_status === 'aguardando_login').length;
    const blocked = all.filter((e: any) => e.app_access_status === 'bloqueado' || e.app_access_status === 'suspenso').length;
    const noAccess = all.filter((e: any) => !e.app_access_status || e.app_access_status === 'sem_acesso').length;
    return { active, blocked, noAccess, total: all.length };
  }, [employees]);

  const handleGrant = (emp: any) => {
    const pw = generateTempPassword();
    setTempPassword(pw);
    const currentTpl = emp.app_access_template_id
      || templates.find((t: any) => t.is_default)?.id
      || "";
    setGrantTemplateId(currentTpl);
    setGrantDialog(emp);
  };

  const handleManagerGrant = (emp: any) => {
    const pw = generateTempPassword();
    setManagerPassword(pw);
    setManagerDialog(emp);
  };

  const confirmGrant = async () => {
    if (!grantDialog) return;
    try {
      await grantAccess.mutateAsync({ employee_id: grantDialog.id, password: tempPassword, force_password_change: true });
      if (grantTemplateId) {
        await assignTemplate.mutateAsync({ employee_id: grantDialog.id, template_id: grantTemplateId });
      }
      toast({ title: "Acesso liberado!", description: `Senha temporária: ${tempPassword}` });
      setGrantDialog(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleBlock = async (emp: any) => {
    try {
      await blockAccess.mutateAsync(emp.id);
      toast({ title: "Acesso bloqueado", description: `${emp.full_name} não pode mais acessar o app.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleResetPw = async (emp: any) => {
    const pw = generateTempPassword();
    try {
      await resetPassword.mutateAsync({ employee_id: emp.id, new_password: pw });
      toast({ title: "Senha resetada!", description: `Nova senha: ${pw}` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const confirmManagerGrant = async () => {
    if (!managerDialog) return;
    try {
      await grantManagerAccess.mutateAsync({ employee_id: managerDialog.id, email: managerDialog.email, password: managerPassword });
      toast({ title: "Acesso de gestor liberado!", description: `Login: ${managerDialog.email} · Senha: ${managerPassword}` });
      setManagerDialog(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Acessos</h1>
          <p className="text-sm text-muted-foreground">Controle de acesso ao App do Colaborador</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Smartphone className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <UserCheck className="h-5 w-5 mx-auto text-green-600 mb-1" />
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Com acesso</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <UserX className="h-5 w-5 mx-auto text-red-600 mb-1" />
              <p className="text-2xl font-bold text-red-600">{stats.blocked}</p>
              <p className="text-xs text-muted-foreground">Bloqueados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <ShieldOff className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold text-muted-foreground">{stats.noAccess}</p>
              <p className="text-xs text-muted-foreground">Sem acesso</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome, CPF ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="sem_acesso">Sem acesso</SelectItem>
                  <SelectItem value="liberado">Liberado</SelectItem>
                  <SelectItem value="aguardando_login">Aguardando login</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Colaboradores ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Status RH</TableHead>
                      <TableHead>Status App</TableHead>
                      <TableHead>Acesso Gestor</TableHead>
                      <TableHead>Último Login</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((emp: any) => {
                      const appStatus = emp.app_access_status || "sem_acesso";
                      const statusInfo = ACCESS_STATUS_MAP[appStatus] || ACCESS_STATUS_MAP.sem_acesso;
                      const isActive = appStatus === "ativo" || appStatus === "liberado" || appStatus === "aguardando_login";

                      return (
                        <TableRow key={emp.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm text-foreground">{emp.full_name}</p>
                              {emp.email && <p className="text-xs text-muted-foreground">{emp.email}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{emp.cpf || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${emp.status === 'ativo' ? 'bg-green-500/10 text-green-700' : emp.status === 'desligado' ? 'bg-red-500/10 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                              {emp.status || "ativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${emp.user_id ? 'bg-green-500/10 text-green-700 border-green-200' : 'bg-muted text-muted-foreground'}`}>
                              {emp.user_id ? 'Liberado' : 'Sem acesso'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {emp.app_last_login ? format(new Date(emp.app_last_login), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleManagerGrant(emp)} disabled={!emp.email}>
                                <BriefcaseBusiness className="h-3 w-3" /> {emp.user_id ? 'Reset gestor' : 'Gestor'}
                              </Button>
                              {!isActive ? (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleGrant(emp)}>
                                  <Shield className="h-3 w-3" /> Liberar
                                </Button>
                              ) : (
                                <>
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleResetPw(emp)}>
                                    <KeyRound className="h-3 w-3" /> Resetar
                                  </Button>
                                  <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => handleBlock(emp)}>
                                    <ShieldOff className="h-3 w-3" /> Bloquear
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum colaborador encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grant Access Dialog */}
      <Dialog open={!!grantDialog} onOpenChange={v => !v && setGrantDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Liberar Acesso ao App</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-foreground font-medium">{grantDialog?.full_name}</p>
              <p className="text-xs text-muted-foreground">{grantDialog?.cpf || grantDialog?.email || "—"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Senha temporária gerada:</p>
              <div className="flex items-center gap-2">
                <Input value={tempPassword} readOnly className="font-mono text-base" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(tempPassword); toast({ title: "Copiado!" }); }}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setTempPassword(generateTempPassword())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">O colaborador será obrigado a trocar a senha no primeiro login.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setGrantDialog(null)}>Cancelar</Button>
              <Button onClick={confirmGrant} disabled={grantAccess.isPending}>
                {grantAccess.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Liberar Acesso
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!managerDialog} onOpenChange={v => !v && setManagerDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{managerDialog?.user_id ? 'Resetar Acesso do Gestor' : 'Liberar Acesso de Gestor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-foreground font-medium">{managerDialog?.full_name}</p>
              <p className="text-xs text-muted-foreground">Login: {managerDialog?.email || 'cadastre um e-mail primeiro'}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Senha temporária gerada:</p>
              <div className="flex items-center gap-2">
                <Input value={managerPassword} readOnly className="font-mono text-base" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(managerPassword); toast({ title: "Copiado!" }); }}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setManagerPassword(generateTempPassword())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">O gestor entra em /gestor/login ou /gestor com este e-mail e senha. Este acesso é separado do App do Colaborador.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setManagerDialog(null)}>Cancelar</Button>
              <Button onClick={confirmManagerGrant} disabled={grantManagerAccess.isPending || !managerDialog?.email}>
                {grantManagerAccess.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Liberar Gestor
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
