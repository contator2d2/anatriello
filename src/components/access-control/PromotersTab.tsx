import { useState } from "react";
import { usePromoters, useCreatePromoter, useUpdatePromoter, useAgencies, useUnits, useCreateAccessRule, useAccessRules, useDeleteAccessRule } from "@/hooks/use-access-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, ShieldCheck, Loader2, Key, Trash2, FileText } from "lucide-react";
import { AuthorizationLetterDialog } from "./AuthorizationLetterDialog";
import { useToast } from "@/hooks/use-toast";
import { formatCpf, formatPhone, isValidCpf, isValidPhone, onlyDigits } from "@/lib/br-utils";
import HelpPanel from "./HelpPanel";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const PromotersTab = () => {
  const { data: promoters = [], isLoading } = usePromoters();
  const { data: agencies = [] } = useAgencies();
  const { data: units = [] } = useUnits();
  const createMutation = useCreatePromoter();
  const updateMutation = useUpdatePromoter();
  const createRuleMutation = useCreateAccessRule();
  const deleteRuleMutation = useDeleteAccessRule();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [letterDialogOpen, setLetterDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedPromoter, setSelectedPromoter] = useState<any>(null);
  const [letterPromoter, setLetterPromoter] = useState<any>(null);
  const [form, setForm] = useState({ full_name: "", cpf: "", phone: "", agency_id: "", is_active: true });
  const [ruleForm, setRuleForm] = useState({ unit_id: "", allowed_weekdays: [1, 2, 3, 4, 5], time_start: "08:00", time_end: "18:00", brands: "" });

  const { data: rules = [] } = useAccessRules(selectedPromoter?.id);

  const openNew = () => {
    setEditing(null);
    setForm({ full_name: "", cpf: "", phone: "", agency_id: "", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ full_name: p.full_name, cpf: formatCpf(p.cpf), phone: formatPhone(p.phone || ""), agency_id: p.agency_id || "", is_active: p.is_active });
    setDialogOpen(true);
  };

  const openRules = (p: any) => {
    setSelectedPromoter(p);
    setRuleForm({ unit_id: "", allowed_weekdays: [1, 2, 3, 4, 5], time_start: "08:00", time_end: "18:00", brands: "" });
    setRulesDialogOpen(true);
  };

  const handleSave = async () => {
    if (!isValidCpf(form.cpf)) {
      toast({ title: "CPF inválido", description: "Revise o CPF do promotor antes de salvar.", variant: "destructive" });
      return;
    }

    if (form.phone && !isValidPhone(form.phone)) {
      toast({ title: "Telefone inválido", description: "Informe um telefone com DDD válido.", variant: "destructive" });
      return;
    }

    const payload = {
      ...form,
      cpf: onlyDigits(form.cpf),
      phone: form.phone ? onlyDigits(form.phone) : null,
      agency_id: form.agency_id || null,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Erro ao salvar promotor", description: error?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const handleAddRule = async () => {
    if (!ruleForm.unit_id || !selectedPromoter) return;
    await createRuleMutation.mutateAsync({
      promoter_id: selectedPromoter.id,
      unit_id: ruleForm.unit_id,
      allowed_weekdays: ruleForm.allowed_weekdays,
      time_start: ruleForm.time_start,
      time_end: ruleForm.time_end,
      brands: ruleForm.brands ? ruleForm.brands.split(",").map((b: string) => b.trim()) : [],
    });
    setRuleForm({ unit_id: "", allowed_weekdays: [1, 2, 3, 4, 5], time_start: "08:00", time_end: "18:00", brands: "" });
  };

  const toggleWeekday = (day: number) => {
    setRuleForm(f => ({
      ...f,
      allowed_weekdays: f.allowed_weekdays.includes(day)
        ? f.allowed_weekdays.filter(d => d !== day)
        : [...f.allowed_weekdays, day].sort(),
    }));
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Promotores</CardTitle>
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Promotor</Button>
        </CardHeader>
        <CardContent>
          <HelpPanel
            title="Como cadastrar promotores?"
            sections={[
              {
                title: "Tipos de promotor",
                icon: "info",
                content: [
                  "Interno — Colaborador CLT da empresa; usa a foto do cadastro no RH.",
                  "Externo — Vinculado a uma agência terceira; cadastrado com foto obrigatória pelo portal da agência.",
                ],
              },
              {
                title: "Foto para reconhecimento facial",
                icon: "alert",
                content: [
                  "Se a Rede do PDV exige selfie ou facial, o promotor DEVE ter foto conforme.",
                  "Requisitos: frontal, bem iluminada, sem óculos escuros/bonés, mínimo 480×480px.",
                  "Promotores sem foto adequada ficam 'não conforme' e não conseguem fazer check-in no Totem.",
                ],
              },
              {
                title: "Regras de acesso",
                icon: "check",
                content: [
                  "Clique no ícone de chave (🔑) para definir em quais PDVs, dias e horários o promotor pode entrar.",
                  "É possível restringir por marcas autorizadas.",
                  "Use a carta de autorização (📄) para gerar documento formal de permissão.",
                ],
              },
            ]}
          />
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : promoters.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum promotor cadastrado</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Agência</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promoters.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell className="font-mono text-sm">{formatCpf(p.cpf)}</TableCell>
                      <TableCell>{p.agency_name || "Interno"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.employee_id ? "Interno" : "Externo"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openRules(p)} title="Regras de acesso"><Key className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => { setLetterPromoter(p); setLetterDialogOpen(true); }} title="Carta de autorização"><FileText className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Promotor" : "Novo Promotor"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome Completo *</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
            <div><Label>CPF *</Label><Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: formatCpf(e.target.value) }))} placeholder="000.000.000-00" /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" /></div>
            <div>
              <Label>Agência</Label>
              <Select value={form.agency_id || "__none__"} onValueChange={v => setForm(f => ({ ...f, agency_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Interno (sem agência)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Interno</SelectItem>
                  {agencies.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.full_name || !form.cpf}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Regras de Acesso — {selectedPromoter?.full_name}</DialogTitle></DialogHeader>

          <div className="space-y-2 max-h-[30vh] overflow-y-auto">
            {(rules as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada</p>
            ) : (rules as any[]).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <p className="font-medium text-sm">{r.unit_name || r.unit_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.time_start} - {r.time_end} | Dias: {r.allowed_weekdays?.map((d: number) => WEEKDAYS[d]?.slice(0, 3)).join(", ")}
                  </p>
                  {r.brands?.length > 0 && (
                    <div className="flex gap-1 mt-1">{r.brands.map((b: string) => <Badge key={b} variant="outline" className="text-xs">{b}</Badge>)}</div>
                  )}
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteRuleMutation.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="font-medium text-sm">Adicionar regra</p>
            <div>
              <Label>Unidade (PDV)</Label>
              <Select value={ruleForm.unit_id} onValueChange={v => setRuleForm(f => ({ ...f, unit_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dias permitidos</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {WEEKDAYS.map((day, i) => (
                  <label key={i} className="flex items-center gap-1 text-sm">
                    <Checkbox checked={ruleForm.allowed_weekdays.includes(i)} onCheckedChange={() => toggleWeekday(i)} />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Entrada</Label><Input type="time" value={ruleForm.time_start} onChange={e => setRuleForm(f => ({ ...f, time_start: e.target.value }))} /></div>
              <div><Label>Saída</Label><Input type="time" value={ruleForm.time_end} onChange={e => setRuleForm(f => ({ ...f, time_end: e.target.value }))} /></div>
            </div>
            <div><Label>Marcas (separadas por vírgula)</Label><Input value={ruleForm.brands} onChange={e => setRuleForm(f => ({ ...f, brands: e.target.value }))} placeholder="Nestlé, Unilever" /></div>
            <Button onClick={handleAddRule} disabled={!ruleForm.unit_id} size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AuthorizationLetterDialog
        open={letterDialogOpen}
        onOpenChange={setLetterDialogOpen}
        promoter={letterPromoter ? {
          name: letterPromoter.full_name,
          cpf: letterPromoter.cpf,
          phone: letterPromoter.phone,
          isInternal: !!letterPromoter.employee_id,
        } : undefined}
        agency={letterPromoter?.agency_name ? {
          name: letterPromoter.agency_name,
        } : undefined}
      />
    </>
  );
};

export default PromotersTab;
