import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Users2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useSRDrivers, useSRSaveDriver, useSRDeleteDriver, useSRVehicles } from "@/hooks/use-smartroute";

export default function SmartRouteMotoristas() {
  const { data = [] } = useSRDrivers();
  const { data: vehicles = [] } = useSRVehicles();
  const save = useSRSaveDriver();
  const del = useSRDeleteDriver();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const onSave = async () => {
    if (!form.full_name) return toast.error("Nome é obrigatório");
    try {
      const r: any = await save.mutateAsync(form);
      if (r?.generated_password) {
        toast.success(`Motorista criado. Senha: ${r.generated_password}`, { duration: 15000 });
      } else {
        toast.success("Salvo");
      }
      setOpen(false); setForm({});
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users2 className="w-6 h-6" /> Motoristas</h1>
            <p className="text-sm text-muted-foreground">Cadastro e acesso ao app do entregador.</p>
          </div>
          <Button onClick={() => { setForm({ active: true }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Novo motorista</Button>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>CPF</TableHead><TableHead>Telefone</TableHead>
              <TableHead>Veículo</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.full_name}</TableCell>
                  <TableCell>{d.cpf}</TableCell>
                  <TableCell>{d.phone}</TableCell>
                  <TableCell>{d.vehicle_plate || "—"}</TableCell>
                  <TableCell>{d.current_status}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => { setForm(d); setOpen(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(d.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!data.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum motorista.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Editar motorista" : "Novo motorista"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome completo*</Label><Input value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>CPF</Label><Input value={form.cpf || ""} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="col-span-2"><Label>Email</Label><Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>CNH nº</Label><Input value={form.license_number || ""} onChange={(e) => setForm({ ...form, license_number: e.target.value })} /></div>
              <div><Label>Categoria</Label><Input value={form.license_category || ""} onChange={(e) => setForm({ ...form, license_category: e.target.value })} /></div>
              <div><Label>Validade CNH</Label><Input type="date" value={form.license_expires_at?.slice(0, 10) || ""} onChange={(e) => setForm({ ...form, license_expires_at: e.target.value })} /></div>
              <div>
                <Label>Veículo</Label>
                <Select value={form.vehicle_id || "none"} onValueChange={(v) => setForm({ ...form, vehicle_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} — {v.model}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>{form.id ? "Nova senha (opcional)" : "Senha (deixe em branco para gerar)"}</Label><Input type="text" value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div className="col-span-2 flex items-center gap-2"><Switch checked={form.active !== false} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={onSave} disabled={save.isPending}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
