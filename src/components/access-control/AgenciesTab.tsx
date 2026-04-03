import { useState } from "react";
import { useAgencies, useCreateAgency, useUpdateAgency, useUnits, useCreateAgencyUser, useSetAgencyUnits } from "@/hooks/use-access-control";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Users, Loader2, KeyRound, Eye, EyeOff, Store, FileSignature, DollarSign, Send } from "lucide-react";
import SendAccessDialog from "./SendAccessDialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useUpload } from "@/hooks/use-upload";
import { generateAgencyContractPdfBlob } from "@/lib/agency-contract-pdf";
import { formatCnpj, formatCpf, formatPhone, isValidCnpj, isValidCpf, isValidPhone, onlyDigits } from "@/lib/br-utils";

const defaultForm = {
  name: "",
  cnpj: "",
  responsible_name: "",
  responsible_cpf: "",
  contact_email: "",
  contact_phone: "",
  max_promoters: "50",
  is_active: true,
  address: "",
  city: "",
  state: "",
  plan_id: "",
  contracted_promoters: "",
};

const AgenciesTab = () => {
  const { data: agencies = [], isLoading } = useAgencies();
  const { data: units = [] } = useUnits();
  const { data: plans = [] } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => api<any[]>("/api/access-control/billing/plans"),
  });
  const createMutation = useCreateAgency();
  const updateMutation = useUpdateAgency();
  const createUserMutation = useCreateAgencyUser();
  const setUnitsMutation = useSetAgencyUnits();
  const { uploadFile } = useUpload();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [dialogTab, setDialogTab] = useState("dados");
  const [form, setForm] = useState(defaultForm);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginName, setLoginName] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractAgency, setContractAgency] = useState<any>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractSignerName, setContractSignerName] = useState("");
  const [contractSignerEmail, setContractSignerEmail] = useState("");
  const [contractSignerCpf, setContractSignerCpf] = useState("");

  const [sendAccessOpen, setSendAccessOpen] = useState(false);
  const [sendAccessAgency, setSendAccessAgency] = useState<any>(null);

  const openNew = () => {
    setEditing(null);
    setForm(defaultForm);
    setLoginEmail("");
    setLoginPassword("");
    setLoginName("");
    setShowPw(false);
    setSelectedUnits([]);
    setDialogTab("dados");
    setDialogOpen(true);
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      name: a.name,
      cnpj: formatCnpj(a.cnpj || ""),
      responsible_name: a.responsible_name || "",
      responsible_cpf: formatCpf(a.responsible_cpf || ""),
      contact_email: a.contact_email || a.responsible_email || "",
      contact_phone: formatPhone(a.contact_phone || a.responsible_phone || ""),
      max_promoters: a.max_promoters?.toString() || "50",
      is_active: a.is_active !== false && a.status !== "inactive",
      address: a.address || "",
      city: a.city || "",
      state: a.state || "",
      plan_id: a.plan_id || "",
      contracted_promoters: a.contracted_promoters?.toString() || a.promoter_count?.toString() || a.max_promoters?.toString() || "",
    });
    setLoginEmail("");
    setLoginPassword("");
    setLoginName(a.responsible_name || "");
    setShowPw(false);
    setSelectedUnits([]);
    setDialogTab("dados");
    setDialogOpen(true);
    api<any[]>(`/api/access-control/agencies/${a.id}/allowed-units`).then(list => {
      setSelectedUnits(list.map((u: any) => u.supermarket_unit_id));
    }).catch(() => {});
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let pw = "agc";
    for (let i = 0; i < 5; i += 1) pw += chars[Math.floor(Math.random() * chars.length)];
    setLoginPassword(pw);
    setShowPw(true);
  };

  const toggleUnit = (unitId: string) => {
    setSelectedUnits(prev => prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]);
  };

  const validateAgencyForm = () => {
    if (form.cnpj && !isValidCnpj(form.cnpj)) {
      toast({ title: "CNPJ inválido", description: "Revise o CNPJ da agência antes de salvar.", variant: "destructive" });
      return false;
    }

    if (form.responsible_cpf && !isValidCpf(form.responsible_cpf)) {
      toast({ title: "CPF inválido", description: "Revise o CPF do responsável antes de salvar.", variant: "destructive" });
      return false;
    }

    if (form.contact_phone && !isValidPhone(form.contact_phone)) {
      toast({ title: "Telefone inválido", description: "Informe um telefone com DDD válido.", variant: "destructive" });
      return false;
    }

    const hasPartialAccessData = loginEmail || loginPassword || loginName;
    if (hasPartialAccessData) {
      if (!loginEmail || !loginPassword || !loginName) {
        toast({ title: "Dados de acesso incompletos", description: "Preencha nome, e-mail e senha para criar o acesso do portal.", variant: "destructive" });
        return false;
      }
      if (loginPassword.length < 6) {
        toast({ title: "Senha inválida", description: "A senha do portal deve ter no mínimo 6 caracteres.", variant: "destructive" });
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateAgencyForm()) return;

    const payload = {
      ...form,
      cnpj: form.cnpj ? onlyDigits(form.cnpj) : null,
      responsible_cpf: form.responsible_cpf ? onlyDigits(form.responsible_cpf) : null,
      contact_phone: form.contact_phone ? onlyDigits(form.contact_phone) : null,
      max_promoters: parseInt(form.max_promoters) || 50,
      responsible_email: form.contact_email,
      responsible_phone: form.contact_phone ? onlyDigits(form.contact_phone) : null,
      plan_id: form.plan_id || undefined,
      contracted_promoters: parseInt(form.contracted_promoters) || undefined,
    };

    try {
      let agencyId = editing?.id;
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
      } else {
        const result: any = await createMutation.mutateAsync(payload);
        agencyId = result?.id;
      }

      if (agencyId) {
        await setUnitsMutation.mutateAsync({ agencyId, unit_ids: selectedUnits });
      }

      if (agencyId && loginEmail && loginPassword && loginName) {
        await createUserMutation.mutateAsync({
          agencyId,
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
          name: loginName.trim(),
        });
      }

      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Erro ao salvar agência", description: error?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const openContractDialog = (a: any) => {
    setContractAgency(a);
    setContractSignerName(a.responsible_name || a.name || "");
    setContractSignerEmail((a.contact_email || a.responsible_email || "").trim().toLowerCase());
    setContractSignerCpf(formatCpf(a.responsible_cpf || ""));
    setContractDialogOpen(true);
  };

  const handleGenerateContract = async () => {
    if (!contractAgency) return;
    if (!contractSignerName.trim() || !contractSignerEmail.trim()) {
      toast({ title: "Dados incompletos", description: "Informe nome e e-mail do responsável para gerar o contrato.", variant: "destructive" });
      return;
    }
    if (!isValidCpf(contractSignerCpf)) {
      toast({ title: "CPF inválido", description: "Informe um CPF válido para o signatário do contrato.", variant: "destructive" });
      return;
    }

    setContractLoading(true);
    try {
      const pdfBlob = generateAgencyContractPdfBlob({
        agencyName: contractAgency.name,
        agencyCnpj: contractAgency.cnpj,
        responsibleName: contractSignerName.trim(),
        responsibleEmail: contractSignerEmail.trim().toLowerCase(),
        responsiblePhone: contractAgency.contact_phone || contractAgency.responsible_phone || "",
        responsibleCpf: contractSignerCpf,
        address: contractAgency.address || "",
        city: contractAgency.city || "",
        state: contractAgency.state || "",
        planName: contractAgency.plan_name || "Plano comercial vigente",
        contractedPromoters: Number(contractAgency.max_promoters || 0),
        pricePerPromoter: Number(contractAgency.price_per_promoter || 0),
        organizationName: "Ayratech",
      });

      const safeAgencyName = contractAgency.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const file = new File([pdfBlob], `contrato-agencia-${safeAgencyName || 'agencia'}.pdf`, { type: "application/pdf" });
      const fileUrl = await uploadFile(file);

      if (!fileUrl) {
        throw new Error("Não foi possível enviar o PDF do contrato.");
      }

      const document = await api<any>("/api/doc-signatures", {
        method: "POST",
        body: {
          title: `Contrato de Prestação de Serviços — ${contractAgency.name}`,
          description: `Contrato da agência ${contractAgency.name}`,
          file_url: fileUrl,
        },
      });

      await api(`/api/doc-signatures/${document.id}/signers`, {
        method: "POST",
        body: {
          name: contractSignerName.trim(),
          email: contractSignerEmail.trim().toLowerCase(),
          cpf: onlyDigits(contractSignerCpf),
          phone: onlyDigits(contractAgency.contact_phone || contractAgency.responsible_phone || "") || null,
          role: "signer",
        },
      });

      let emailSent = true;
      try {
        await api(`/api/doc-signatures/${document.id}/send`, { method: "POST" });
      } catch {
        emailSent = false;
      }

      toast({
        title: emailSent ? "Contrato gerado!" : "Contrato criado",
        description: emailSent
          ? "O contrato foi criado e enviado para assinatura digital."
          : "O contrato foi criado no módulo de Assinaturas, mas o envio por e-mail falhou. Verifique o SMTP.",
      });
      setContractDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Erro ao gerar contrato", description: error?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setContractLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Agências Terceiras</CardTitle>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Agência</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : agencies.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma agência cadastrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Limite</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agencies.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.cnpj ? formatCnpj(a.cnpj) : "—"}</TableCell>
                  <TableCell>{a.responsible_name || "—"}</TableCell>
                  <TableCell>{a.max_promoters} promotores</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "active" || a.is_active ? "default" : "secondary"}>
                      {a.status === "active" || a.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setSendAccessAgency(a); setSendAccessOpen(true); }} title="Enviar Acesso">
                        <Send className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openContractDialog(a)} title="Gerar Contrato">
                        <FileSignature className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(a)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader><DialogTitle>{editing ? "Editar Agência" : "Nova Agência"}</DialogTitle></DialogHeader>

          <Tabs value={dialogTab} onValueChange={setDialogTab}>
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="pdvs" className="flex-1 gap-1"><Store className="h-3.5 w-3.5" /> PDVs Permitidos</TabsTrigger>
              <TabsTrigger value="acesso" className="flex-1 gap-1"><KeyRound className="h-3.5 w-3.5" /> Acesso Portal</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 max-h-[50vh] overflow-y-auto">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: formatCnpj(e.target.value) }))} placeholder="00.000.000/0000-00" /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Responsável</Label><Input value={form.responsible_name} onChange={e => setForm(f => ({ ...f, responsible_name: e.target.value }))} /></div>
                <div><Label>CPF do responsável</Label><Input value={form.responsible_cpf} onChange={e => setForm(f => ({ ...f, responsible_cpf: formatCpf(e.target.value) }))} placeholder="000.000.000-00" /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Email</Label><Input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
                <div><Label>Telefone</Label><Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" /></div>
              </div>
              <div><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Cidade</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
                <div><Label>UF</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} maxLength={2} /></div>
              </div>
              <Separator />
              <p className="text-sm font-medium flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Plano e Cobrança</p>
              <div>
                <Label>Plano de Cobrança</Label>
                <Select value={form.plan_id} onValueChange={v => {
                  const plan = (plans as any[])?.find((p: any) => p.id === v);
                  setForm(f => ({
                    ...f,
                    plan_id: v,
                    max_promoters: plan?.max_promoters?.toString() || f.max_promoters,
                  }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione um plano..." /></SelectTrigger>
                  <SelectContent>
                    {(plans as any[])?.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — R$ {Number(p.price_per_promoter || 0).toFixed(2)}/promotor
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Qtd. Promotores Contratados</Label>
                <Input type="number" value={form.contracted_promoters} onChange={e => setForm(f => ({ ...f, contracted_promoters: e.target.value }))} placeholder="Ex: 10" />
                <p className="text-xs text-muted-foreground mt-1">Quantidade que a agência deseja contratar. As faturas serão geradas com base nesse número.</p>
              </div>
              {form.plan_id && form.contracted_promoters && (() => {
                const plan = (plans as any[])?.find((p: any) => p.id === form.plan_id);
                const total = (parseInt(form.contracted_promoters) || 0) * (parseFloat(plan?.price_per_promoter) || 0);
                return (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor mensal estimado:</span><span className="font-bold text-primary">R$ {total.toFixed(2)}</span></div>
                  </div>
                );
              })()}
              <Separator />
              <div><Label>Limite Máx. de Promotores</Label><Input value={form.max_promoters} onChange={e => setForm(f => ({ ...f, max_promoters: e.target.value }))} type="number" /></div>
              {editing && (
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                  <Label>Agência ativa</Label>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pdvs" className="space-y-3 max-h-[50vh] overflow-y-auto">
              <p className="text-sm text-muted-foreground">Selecione os PDVs que esta agência pode atender:</p>
              {units.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma unidade cadastrada</p>
              ) : (
                <div className="space-y-2">
                  {units.map((u: any) => (
                    <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer">
                      <Checkbox
                        checked={selectedUnits.includes(u.id)}
                        onCheckedChange={() => toggleUnit(u.id)}
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm">{u.name}</span>
                        {u.city && <span className="text-xs text-muted-foreground ml-2">{u.city}/{u.state}</span>}
                      </div>
                      {u.network_name && <Badge variant="outline" className="text-xs">{u.network_name}</Badge>}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{selectedUnits.length} PDV(s) selecionado(s)</p>
            </TabsContent>

            <TabsContent value="acesso" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Crie um login para que a agência acesse o portal e gerencie seus promotores.
              </p>
              <Separator />
              <div><Label>Nome *</Label><Input value={loginName} onChange={e => setLoginName(e.target.value)} placeholder={form.responsible_name || "Nome do usuário"} /></div>
              <div><Label>E-mail de acesso *</Label><Input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="agencia@email.com" /></div>
              <div>
                <Label>Senha *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input type={showPw ? "text" : "password"} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" minLength={6} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPw(!showPw)}>
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={generatePassword}>Gerar</Button>
                </div>
                {showPw && loginPassword && (
                  <p className="text-xs text-muted-foreground mt-1">Senha: <code className="bg-muted px-1 rounded">{loginPassword}</code></p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Ao salvar, o acesso será criado com os dados informados acima.</p>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || createMutation.isPending || updateMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" /> Gerar Contrato
            </DialogTitle>
          </DialogHeader>
          {contractAgency && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O sistema vai gerar o PDF do contrato da agência <strong>{contractAgency.name}</strong> e enviá-lo para assinatura digital.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Agência:</span><span className="font-medium">{contractAgency.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">CNPJ:</span><span>{contractAgency.cnpj ? formatCnpj(contractAgency.cnpj) : "N/I"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Plano:</span><span>{contractAgency.plan_name || "N/I"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Limite promotores:</span><span>{contractAgency.max_promoters}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor/promotor:</span><span>R$ {Number(contractAgency.price_per_promoter || 0).toFixed(2)}</span></div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div><Label>Responsável signatário *</Label><Input value={contractSignerName} onChange={e => setContractSignerName(e.target.value)} placeholder="Nome do responsável" /></div>
                <div><Label>E-mail para assinatura *</Label><Input type="email" value={contractSignerEmail} onChange={e => setContractSignerEmail(e.target.value)} placeholder="responsavel@agencia.com" /></div>
                <div><Label>CPF do signatário *</Label><Input value={contractSignerCpf} onChange={e => setContractSignerCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" /></div>
              </div>
              <p className="text-xs text-muted-foreground">
                O contrato será criado no módulo de Assinaturas Digitais. Se o SMTP estiver configurado, o link seguirá por e-mail automaticamente.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateContract} disabled={contractLoading}>
              {contractLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Gerar Contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SendAccessDialog
        open={sendAccessOpen}
        onOpenChange={setSendAccessOpen}
        portalType="agency"
        entityName={sendAccessAgency?.name || ""}
        loginEmail={sendAccessAgency?.contact_email || sendAccessAgency?.responsible_email || ""}
        contactEmail={sendAccessAgency?.contact_email || sendAccessAgency?.responsible_email || ""}
        contactPhone={sendAccessAgency?.contact_phone || sendAccessAgency?.responsible_phone || ""}
      />
    </Card>
  );
};

export default AgenciesTab;
