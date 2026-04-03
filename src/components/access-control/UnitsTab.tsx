import { useState } from "react";
import { useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit, useNetworks } from "@/hooks/use-access-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Store, Loader2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const defaultForm = {
  name: "", cnpj: "", address: "", city: "", state: "", network_id: "",
  latitude: "", longitude: "", radius_meters: "200",
  operating_hours_start: "06:00", operating_hours_end: "22:00",
};

const UnitsTab = () => {
  const { data: units = [], isLoading } = useUnits();
  const { data: networks = [] } = useNetworks();
  const createMutation = useCreateUnit();
  const updateMutation = useUpdateUnit();
  const deleteMutation = useDeleteUnit();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(defaultForm);

  const openNew = () => { setEditing(null); setForm(defaultForm); setDialogOpen(true); };
  const openEdit = (u: any) => {
    setEditing(u);
    setForm({
      name: u.name, cnpj: u.cnpj || "", address: u.address || "", city: u.city || "", state: u.state || "",
      network_id: u.network_id || "", latitude: u.latitude?.toString() || "", longitude: u.longitude?.toString() || "",
      radius_meters: u.radius_meters?.toString() || "200",
      operating_hours_start: u.operating_hours_start || "06:00", operating_hours_end: u.operating_hours_end || "22:00",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      network_id: form.network_id || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      radius_meters: parseInt(form.radius_meters) || 200,
    };
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const copyTotemToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: "Token copiado!" });
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
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.network_name || "—"}</TableCell>
                    <TableCell>{u.city ? `${u.city}/${u.state}` : "—"}</TableCell>
                    <TableCell>{u.operating_hours_start} - {u.operating_hours_end}</TableCell>
                    <TableCell>
                      {u.totem_token && (
                        <Button size="sm" variant="outline" onClick={() => copyTotemToken(u.totem_token)} className="gap-1">
                          <Copy className="h-3 w-3" /> Copiar
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "Ativa" : "Inativa"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(u.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
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
              <div><Label>UF</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} maxLength={2} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Latitude</Label><Input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} /></div>
              <div><Label>Longitude</Label><Input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} /></div>
              <div><Label>Raio (m)</Label><Input value={form.radius_meters} onChange={e => setForm(f => ({ ...f, radius_meters: e.target.value }))} type="number" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Abertura</Label><Input value={form.operating_hours_start} onChange={e => setForm(f => ({ ...f, operating_hours_start: e.target.value }))} type="time" /></div>
              <div><Label>Fechamento</Label><Input value={form.operating_hours_end} onChange={e => setForm(f => ({ ...f, operating_hours_end: e.target.value }))} type="time" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || createMutation.isPending || updateMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default UnitsTab;
