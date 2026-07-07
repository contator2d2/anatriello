import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Store } from "lucide-react";
import { toast } from "sonner";
import { useSRPdvs, useSRSavePdv, useSRDeletePdv } from "@/hooks/use-smartroute";

export default function SmartRoutePDVs() {
  const { data = [] } = useSRPdvs();
  const save = useSRSavePdv();
  const del = useSRDeletePdv();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const onSave = async () => {
    if (!form.name) return toast.error("Nome é obrigatório");
    try { await save.mutateAsync(form); toast.success("Salvo"); setOpen(false); setForm({}); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="w-6 h-6" /> PDVs / Clientes</h1>
            <p className="text-sm text-muted-foreground">Pontos de entrega e janelas de recebimento.</p>
          </div>
          <Button onClick={() => { setForm({}); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Novo PDV</Button>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>CNPJ</TableHead><TableHead>Endereço</TableHead>
              <TableHead>Janela</TableHead><TableHead>Contato</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.cnpj}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.address}{p.city ? `, ${p.city}` : ""}{p.state ? `/${p.state}` : ""}</TableCell>
                  <TableCell>{p.delivery_window_start ? `${p.delivery_window_start.slice(0,5)}–${p.delivery_window_end?.slice(0,5) || ""}` : "—"}</TableCell>
                  <TableCell>{p.contact_name} {p.contact_phone && `· ${p.contact_phone}`}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => { setForm(p); setOpen(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(p.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!data.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum PDV cadastrado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{form.id ? "Editar PDV" : "Novo PDV"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome / Razão Social*</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>CNPJ</Label><Input value={form.cnpj || ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
              <div><Label>CEP</Label><Input value={form.zip || ""} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
              <div className="col-span-2"><Label>Endereço</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Cidade</Label><Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>UF</Label><Input value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} /></div>
              <div><Label>Latitude</Label><Input type="number" step="any" value={form.lat || ""} onChange={(e) => setForm({ ...form, lat: +e.target.value })} /></div>
              <div><Label>Longitude</Label><Input type="number" step="any" value={form.lng || ""} onChange={(e) => setForm({ ...form, lng: +e.target.value })} /></div>
              <div><Label>Contato</Label><Input value={form.contact_name || ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div><Label>Telefone contato</Label><Input value={form.contact_phone || ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
              <div><Label>Janela início</Label><Input type="time" value={form.delivery_window_start || ""} onChange={(e) => setForm({ ...form, delivery_window_start: e.target.value })} /></div>
              <div><Label>Janela fim</Label><Input type="time" value={form.delivery_window_end || ""} onChange={(e) => setForm({ ...form, delivery_window_end: e.target.value })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={onSave} disabled={save.isPending}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
