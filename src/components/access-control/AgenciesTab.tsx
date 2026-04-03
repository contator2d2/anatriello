import { useState } from "react";
import { useAgencies, useCreateAgency, useUpdateAgency } from "@/hooks/use-access-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Users, Loader2 } from "lucide-react";

const AgenciesTab = () => {
  const { data: agencies = [], isLoading } = useAgencies();
  const createMutation = useCreateAgency();
  const updateMutation = useUpdateAgency();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", cnpj: "", responsible_name: "", contact_email: "", contact_phone: "", max_promoters: "50", is_active: true });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", cnpj: "", responsible_name: "", contact_email: "", contact_phone: "", max_promoters: "50", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      name: a.name, cnpj: a.cnpj || "", responsible_name: a.responsible_name || "",
      contact_email: a.contact_email || "", contact_phone: a.contact_phone || "",
      max_promoters: a.max_promoters?.toString() || "50", is_active: a.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = { ...form, max_promoters: parseInt(form.max_promoters) || 50 };
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setDialogOpen(false);
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
                <TableHead className="w-[80px]">Ações</TableHead>
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
                    <Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "Ativa" : "Inativa"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Agência" : "Nova Agência"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
            <div><Label>Responsável</Label><Input value={form.responsible_name} onChange={e => setForm(f => ({ ...f, responsible_name: e.target.value }))} /></div>
            <div><Label>Email</Label><Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
            <div><Label>Telefone</Label><Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></div>
            <div><Label>Limite de Promotores</Label><Input value={form.max_promoters} onChange={e => setForm(f => ({ ...f, max_promoters: e.target.value }))} type="number" /></div>
            {editing && (
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>Agência ativa</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AgenciesTab;
