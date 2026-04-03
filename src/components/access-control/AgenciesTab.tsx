import { useState, useEffect } from "react";
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
import { Plus, Pencil, Users, Loader2, KeyRound, Eye, EyeOff, Store, FileSignature, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

const AgenciesTab = () => {
  const { data: agencies = [], isLoading } = useAgencies();
  const { data: units = [] } = useUnits();
  const { data: plans = [] } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: () => api<any[]>('/api/access-control/billing/plans'),
  });
  const createMutation = useCreateAgency();
  const updateMutation = useUpdateAgency();
  const createUserMutation = useCreateAgencyUser();
  const setUnitsMutation = useSetAgencyUnits();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [dialogTab, setDialogTab] = useState("dados");
  const [form, setForm] = useState({
    name: "", cnpj: "", responsible_name: "", contact_email: "", contact_phone: "",
    max_promoters: "50", is_active: true, address: "", city: "", state: "",
    plan_id: "", contracted_promoters: "",
  });

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginName, setLoginName] = useState("");
  const [showPw, setShowPw] = useState(false);

  // PDV selection
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  // Contract dialog
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractAgency, setContractAgency] = useState<any>(null);
  const [contractLoading, setContractLoading] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", cnpj: "", responsible_name: "", contact_email: "", contact_phone: "", max_promoters: "50", is_active: true, address: "", city: "", state: "", plan_id: "", contracted_promoters: "" });
    setLoginEmail(""); setLoginPassword(""); setLoginName(""); setShowPw(false);
    setSelectedUnits([]);
    setDialogTab("dados");
    setDialogOpen(true);
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      name: a.name, cnpj: a.cnpj || "", responsible_name: a.responsible_name || "",
      contact_email: a.contact_email || a.responsible_email || "", contact_phone: a.contact_phone || a.responsible_phone || "",
      max_promoters: a.max_promoters?.toString() || "50", is_active: a.is_active !== false && a.status !== 'inactive',
      address: a.address || "", city: a.city || "", state: a.state || "",
      plan_id: "", contracted_promoters: a.max_promoters?.toString() || "",
    });
    setLoginEmail(""); setLoginPassword(""); setLoginName(a.responsible_name || ""); setShowPw(false);
    setSelectedUnits([]);
    setDialogTab("dados");
    setDialogOpen(true);
    // Load existing allowed units
    api<any[]>(`/api/access-control/agencies/${a.id}/allowed-units`).then(list => {
      setSelectedUnits(list.map((u: any) => u.supermarket_unit_id));
    }).catch(() => {});
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let pw = "agc";
    for (let i = 0; i < 5; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setLoginPassword(pw);
    setShowPw(true);
  };

  const toggleUnit = (unitId: string) => {
    setSelectedUnits(prev => prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]);
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      max_promoters: parseInt(form.max_promoters) || 50,
      responsible_email: form.contact_email,
      responsible_phone: form.contact_phone,
      plan_id: form.plan_id || undefined,
      contracted_promoters: parseInt(form.contracted_promoters) || undefined,
    };
    let agencyId = editing?.id;
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, ...payload });
    } else {
      const result: any = await createMutation.mutateAsync(payload);
      agencyId = result?.id;
    }

    // Save allowed PDVs
    if (agencyId && selectedUnits.length > 0) {
      await setUnitsMutation.mutateAsync({ agencyId, unit_ids: selectedUnits });
    }

    // Create login if provided
    if (agencyId && loginEmail && loginPassword) {
      try {
        await createUserMutation.mutateAsync({
          agencyId,
          email: loginEmail,
          password: loginPassword,
          name: loginName || form.responsible_name || form.name,
        });
      } catch (err: any) {
        toast({ title: "Erro ao criar login", description: err?.message, variant: "destructive" });
      }
    }

    setDialogOpen(false);
  };

  const openContractDialog = (a: any) => {
    setContractAgency(a);
    setContractDialogOpen(true);
  };

  const handleGenerateContract = async () => {
    if (!contractAgency) return;
    setContractLoading(true);
    try {
      // Create a doc-signature document with the contract
      const res = await api<any>('/api/doc-signatures/documents', {
        method: 'POST',
        body: {
          title: `Contrato de Prestação de Serviços — ${contractAgency.name}`,
          description: `Contrato da agência ${contractAgency.name} (CNPJ: ${contractAgency.cnpj || 'N/I'})`,
          template_type: 'agency_contract',
          template_data: {
            agency_name: contractAgency.name,
            agency_cnpj: contractAgency.cnpj || '',
            responsible_name: contractAgency.responsible_name || contractAgency.responsible_email || '',
            contact_email: contractAgency.contact_email || contractAgency.responsible_email || '',
            contact_phone: contractAgency.contact_phone || contractAgency.responsible_phone || '',
            max_promoters: contractAgency.max_promoters,
            price_per_promoter: contractAgency.price_per_promoter || 0,
            address: contractAgency.address || '',
            city: contractAgency.city || '',
            state: contractAgency.state || '',
          },
          signers: [
            {
              name: contractAgency.responsible_name || contractAgency.name,
              email: contractAgency.contact_email || contractAgency.responsible_email || '',
              cpf: contractAgency.cnpj || '',
              role: 'signer',
            },
          ],
        },
      });
      toast({ title: "Contrato gerado!", description: "O contrato foi criado e enviado para assinatura digital." });
      setContractDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao gerar contrato", description: err?.message || "Tente novamente", variant: "destructive" });
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
                  <TableCell>{a.cnpj || "—"}</TableCell>
                  <TableCell>{a.responsible_name || "—"}</TableCell>
                  <TableCell>{a.max_promoters} promotores</TableCell>
                  <TableCell>
                    <Badge variant={a.status === 'active' || a.is_active ? "default" : "secondary"}>
                      {a.status === 'active' || a.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
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

      {/* Agency Edit/Create Dialog */}
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
              <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
              <div><Label>Responsável</Label><Input value={form.responsible_name} onChange={e => setForm(f => ({ ...f, responsible_name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Email</Label><Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
                <div><Label>Telefone</Label><Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></div>
              </div>
              <div><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Cidade</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
                <div><Label>UF</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} maxLength={2} /></div>
              </div>
              <Separator />
              <p className="text-sm font-medium flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Plano e Cobrança</p>
              <div>
                <Label>Plano de Cobrança</Label>
                <Select value={form.plan_id} onValueChange={v => {
                  setForm(f => ({ ...f, plan_id: v }));
                  const plan = (plans as any[])?.find((p: any) => p.id === v);
                  if (plan) {
                    setForm(f => ({ ...f, plan_id: v, max_promoters: plan.max_promoters?.toString() || f.max_promoters }));
                  }
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
                    <Input type={showPw ? "text" : "password"} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" />
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
              {!editing && (
                <p className="text-xs text-muted-foreground">O login será criado automaticamente ao salvar a agência.</p>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || createMutation.isPending || updateMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Dialog */}
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
                Será gerado um contrato de prestação de serviços para a agência <strong>{contractAgency.name}</strong> e enviado para assinatura digital.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Agência:</span><span className="font-medium">{contractAgency.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">CNPJ:</span><span>{contractAgency.cnpj || "N/I"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Responsável:</span><span>{contractAgency.responsible_name || "N/I"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Limite promotores:</span><span>{contractAgency.max_promoters}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor/promotor:</span><span>R$ {(contractAgency.price_per_promoter || 0).toFixed(2)}</span></div>
              </div>
              <p className="text-xs text-muted-foreground">
                O contrato será criado no módulo de Assinaturas Digitais e um link será enviado ao e-mail do responsável para assinatura com validade jurídica.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateContract} disabled={contractLoading}>
              {contractLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Gerar e Enviar para Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AgenciesTab;
