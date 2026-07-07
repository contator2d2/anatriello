import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { useSRVehicles, useSRSaveVehicle, useSRDeleteVehicle } from "@/hooks/use-smartroute";

export default function SmartRouteFrota() {
  const { data = [] } = useSRVehicles();
  const save = useSRSaveVehicle();
  const del = useSRDeleteVehicle();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const onSave = async () => {
    if (!form.plate) return toast.error("Placa é obrigatória");
    try { await save.mutateAsync(form); toast.success("Salvo"); setOpen(false); setForm({}); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="w-6 h-6" /> Frota</h1>
            <p className="text-sm text-muted-foreground">Veículos disponíveis para distribuição.</p>
          </div>
          <Button onClick={() => { setForm({}); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Novo veículo</Button>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Placa</TableHead><TableHead>Modelo</TableHead><TableHead>Capacidade</TableHead>
              <TableHead>Combustível</TableHead><TableHead>Consumo</TableHead><TableHead>R$/L</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono">{v.plate}</TableCell>
                  <TableCell>{v.brand} {v.model}</TableCell>
                  <TableCell>{v.capacity_kg} kg · {v.capacity_m3} m³</TableCell>
                  <TableCell>{v.fuel_type}</TableCell>
                  <TableCell>{v.km_per_liter ? `${v.km_per_liter} km/L` : "—"}</TableCell>
                  <TableCell>{v.fuel_price_per_liter ? `R$ ${Number(v.fuel_price_per_liter).toFixed(2)}` : "—"}</TableCell>
                  <TableCell>{v.status}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => { setForm(v); setOpen(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(v.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!data.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum veículo cadastrado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Editar veículo" : "Novo veículo"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Placa*</Label><Input value={form.plate || ""} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} /></div>
              <div><Label>Marca</Label><Input value={form.brand || ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
              <div><Label>Modelo</Label><Input value={form.model || ""} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
              <div><Label>Ano</Label><Input type="number" value={form.year || ""} onChange={(e) => setForm({ ...form, year: +e.target.value })} /></div>
              <div><Label>Capacidade (kg)</Label><Input type="number" value={form.capacity_kg || ""} onChange={(e) => setForm({ ...form, capacity_kg: +e.target.value })} /></div>
              <div><Label>Capacidade (m³)</Label><Input type="number" step="0.01" value={form.capacity_m3 || ""} onChange={(e) => setForm({ ...form, capacity_m3: +e.target.value })} /></div>
              <div><Label>Combustível</Label><Input value={form.fuel_type || "diesel"} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })} /></div>
              <div><Label>Status</Label><Input value={form.status || "ativo"} onChange={(e) => setForm({ ...form, status: e.target.value })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={onSave} disabled={save.isPending}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
