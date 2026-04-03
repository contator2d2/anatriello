import { useEffect, useState } from "react";
import { useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit, useNetworks, useCreateSupermarketUser, useUpdateSupermarketUser, useSupermarketUser, useRegenerateTotemToken } from "@/hooks/use-access-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, Store, Loader2, Copy, KeyRound, Eye, EyeOff, RefreshCw, Send } from "lucide-react";
import SendAccessDialog from "./SendAccessDialog";
import { useToast } from "@/hooks/use-toast";
import { formatCnpj, isValidCnpj, onlyDigits } from "@/lib/br-utils";

const defaultForm = {
  name: "", cnpj: "", address: "", city: "", state: "", network_id: "",
  latitude: "", longitude: "", radius_meters: "200",
  opening_time: "06:00", closing_time: "22:00", totem_enabled: false,
};

const UnitsTab = () => {
  const { data: units = [], isLoading } = useUnits();
  const { data: networks = [] } = useNetworks();
  const createMutation = useCreateUnit();
  const updateMutation = useUpdateUnit();
  const deleteMutation = useDeleteUnit();
  const createUserMutation = useCreateSupermarketUser();
  const updateUserMutation = useUpdateSupermarketUser();
  const regenerateTotemTokenMutation = useRegenerateTotemToken();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(defaultForm);

  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [loginUnit, setLoginUnit] = useState<any>(null);
  const [loginForm, setLoginForm] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const { data: supermarketUser, isLoading: isLoadingSupermarketUser } = useSupermarketUser(loginUnit?.id);

  const [sendAccessOpen, setSendAccessOpen] = useState(false);
  const [sendAccessUnit, setSendAccessUnit] = useState<any>(null);

  const openNew = () => { setEditing(null); setForm(defaultForm); setDialogOpen(true); };
  const openEdit = (u: any) => {
    setEditing(u);
    setForm({
      name: u.name,
      cnpj: formatCnpj(u.cnpj || ""),
      address: u.address || "",
      city: u.city || "",
      state: u.state || "",
      network_id: u.network_id || "",
      latitude: u.latitude?.toString() || "",
      longitude: u.longitude?.toString() || "",
      radius_meters: u.radius_meters?.toString() || "200",
      opening_time: u.opening_time || "06:00",
      closing_time: u.closing_time || "22:00",
      totem_enabled: !!u.totem_enabled,
    });
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!loginDialogOpen || !loginUnit) return;
    setLoginForm({
      name: supermarketUser?.name || loginUnit.name || "",
      email: supermarketUser?.email || "",
      password: "",
    });
    setShowPw(false);
  }, [supermarketUser, loginDialogOpen, loginUnit]);

  const handleSave = async () => {
    if (form.cnpj && !isValidCnpj(form.cnpj)) {
      toast({ title: "CNPJ inválido", description: "Revise o CNPJ da unidade antes de salvar.", variant: "destructive" });
      return;
    }

    const payload = {
      ...form,
      cnpj: form.cnpj ? onlyDigits(form.cnpj) : null,
      network_id: form.network_id || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      radius_meters: parseInt(form.radius_meters) || 200,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Erro ao salvar unidade", description: error?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const copyTotemToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: "Token copiado!" });
  };

  const openLoginDialog = (u: any) => {
    setLoginUnit(u);
    setLoginForm({ name: u.name, email: "", password: "" });
    setShowPw(false);
    setLoginDialogOpen(true);
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let pw = "pdv";
    for (let i = 0; i < 5; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setLoginForm(f => ({ ...f, password: pw }));
    setShowPw(true);
  };

  const handleRegenerateTotemToken = async (unit: any) => {
    try {
      const data = await regenerateTotemTokenMutation.mutateAsync(unit.id);
      copyTotemToken(data.totem_token);
    } catch (error: any) {
      toast({ title: "Erro ao gerar token", description: error?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const handleSaveLogin = async () => {
    if (!loginForm.email || !loginForm.name) return;
    if (!supermarketUser?.id && !loginForm.password) return;
    if (loginForm.password && loginForm.password.length < 6) {
      toast({ title: "Senha inválida", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        supermarket_unit_id: loginUnit.id,
        network_id: loginUnit.network_id || null,
        name: loginForm.name.trim(),
        email: loginForm.email.trim().toLowerCase(),
        ...(loginForm.password ? { password: loginForm.password } : {}),
      };

      if (supermarketUser?.id) {
        await updateUserMutation.mutateAsync({ id: supermarketUser.id, ...payload });
      } else {
        await createUserMutation.mutateAsync({ ...payload, password: loginForm.password });
      }

      setLoginDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Erro ao salvar acesso", description: error?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" /> Unidades (PDVs)</CardTitle>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Unidade</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : units.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma unidade cadastrada</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Rede</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Token Totem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.network_name || "—"}</TableCell>
                    <TableCell>{u.city ? `${u.city}/${u.state}` : "—"}</TableCell>
                     <TableCell>{u.opening_time || "06:00"} - {u.closing_time || "22:00"}</TableCell>
                    <TableCell>
                       {u.totem_token ? (
                         <div className="flex items-center gap-2">
                           <Badge variant={u.totem_enabled ? "default" : "secondary"}>{u.totem_enabled ? "Ativo" : "Gerado"}</Badge>
                           <Button size="sm" variant="outline" onClick={() => copyTotemToken(u.totem_token)} className="gap-1">
                             <Copy className="h-3 w-3" /> Copiar
                           </Button>
                         </div>
                       ) : (
                         <span className="text-sm text-muted-foreground">Não configurado</span>
                       )}
                    </TableCell>
                    <TableCell>
                       <Badge variant={u.active !== false ? "default" : "secondary"}>{u.active !== false ? "Ativa" : "Inativa"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                         <Button size="icon" variant="ghost" onClick={() => { setSendAccessUnit(u); setSendAccessOpen(true); }} title="Enviar Acesso">
                           <Send className="h-4 w-4 text-primary" />
                         </Button>
                         <Button size="icon" variant="ghost" onClick={() => handleRegenerateTotemToken(u)} title={u.totem_token ? "Regenerar token do totem" : "Gerar token do totem"}>
                           <RefreshCw className="h-4 w-4 text-primary" />
                         </Button>
                        <Button size="icon" variant="ghost" onClick={() => openLoginDialog(u)} title="Criar acesso portal">
                          <KeyRound className="h-4 w-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(u.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Unidade" : "Nova Unidade"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: formatCnpj(e.target.value) }))} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label>Rede</Label>
              <Select value={form.network_id || "__none__"} onValueChange={v => setForm(f => ({ ...f, network_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Sem rede" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {networks.map((n: any) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Cidade</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>UF</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} maxLength={2} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Latitude</Label><Input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} /></div>
              <div><Label>Longitude</Label><Input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} /></div>
              <div><Label>Raio (m)</Label><Input value={form.radius_meters} onChange={e => setForm(f => ({ ...f, radius_meters: e.target.value }))} type="number" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Abertura</Label><Input value={form.opening_time} onChange={e => setForm(f => ({ ...f, opening_time: e.target.value }))} type="time" /></div>
              <div><Label>Fechamento</Label><Input value={form.closing_time} onChange={e => setForm(f => ({ ...f, closing_time: e.target.value }))} type="time" /></div>
            </div>
             <div className="rounded-lg border border-border p-3 space-y-3">
               <div className="flex items-center justify-between gap-3">
                 <div>
                   <Label>Totem do PDV</Label>
                   <p className="text-xs text-muted-foreground">Habilite o terminal para check-in por CPF e gere o token exclusivo da unidade.</p>
                 </div>
                 <Button type="button" variant={form.totem_enabled ? "default" : "outline"} onClick={() => setForm(f => ({ ...f, totem_enabled: !f.totem_enabled }))}>
                   {form.totem_enabled ? "Habilitado" : "Desabilitado"}
                 </Button>
               </div>
               <p className="text-xs text-muted-foreground">
                 {editing ? "Você também pode regenerar o token pela ação de recarregar na lista." : "Ao salvar com o totem habilitado, o token será gerado automaticamente."}
               </p>
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || createMutation.isPending || updateMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> {supermarketUser?.id ? "Editar Acesso" : "Criar Acesso"} — Portal do Supermercado
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Crie um login para que o supermercado <strong>{loginUnit?.name}</strong> acesse o portal e acompanhe promotores em tempo real.
          </p>
          <Separator />
          {isLoadingSupermarketUser ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
          <div className="space-y-4">
            <div><Label>Nome do responsável *</Label><Input value={loginForm.name} onChange={e => setLoginForm(f => ({ ...f, name: e.target.value }))} placeholder="Gerente da loja" /></div>
            <div><Label>E-mail de acesso *</Label><Input type="email" value={loginForm.email} onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))} placeholder="gerente@supermercado.com" /></div>
            <div>
              <Label>Senha *</Label>
               {supermarketUser?.id && <p className="text-xs text-muted-foreground mb-2">A senha atual não é exibida por segurança; preencha apenas se quiser redefinir.</p>}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={loginForm.password}
                    onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    minLength={6}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPw(!showPw)}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={generatePassword}>Gerar</Button>
              </div>
              {showPw && loginForm.password && (
                <p className="text-xs text-muted-foreground mt-1">Senha: <code className="bg-muted px-1 rounded">{loginForm.password}</code></p>
              )}
            </div>
          </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoginDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLogin} disabled={!loginForm.email || !loginForm.name || isLoadingSupermarketUser || createUserMutation.isPending || updateUserMutation.isPending || (!supermarketUser?.id && !loginForm.password)}>
              {supermarketUser?.id ? "Salvar Acesso" : "Criar Acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SendAccessDialog
        open={sendAccessOpen}
        onOpenChange={setSendAccessOpen}
        portalType="supermarket"
        entityName={sendAccessUnit?.name || ""}
        loginEmail={supermarketUser?.email || ""}
        contactEmail={supermarketUser?.email || ""}
        contactPhone=""
      />
    </Card>
  );
};

export default UnitsTab;
