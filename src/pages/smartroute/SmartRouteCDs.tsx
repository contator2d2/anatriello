import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Warehouse, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { useSRDepots, useSRSaveDepot, useSRDeleteDepot, useSRGeocodeDepot } from "@/hooks/use-smartroute-depots";

export default function SmartRouteCDs() {
  const { data = [] } = useSRDepots();
  const save = useSRSaveDepot();
  const del = useSRDeleteDepot();
  const geocode = useSRGeocodeDepot();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [cepLoading, setCepLoading] = useState(false);
  const cepTimer = useRef<any>(null);

  const lookupCep = async (rawCep: string) => {
    const cep = String(rawCep || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (j.erro) { toast.error("CEP não encontrado"); return; }
      const address = [j.logradouro, j.bairro].filter(Boolean).join(", ");
      const next = {
        ...form,
        zip: cep,
        address: address || form.address,
        city: j.localidade || form.city,
        state: j.uf || form.state,
      };
      setForm(next);
      // auto-geocode
      try {
        const g = await geocode.mutateAsync({ address: next.address, city: next.city, state: next.state, zip: next.zip });
        setForm((f: any) => ({ ...f, lat: g.lat, lng: g.lng }));
        toast.success("Endereço e coordenadas preenchidos");
      } catch {
        toast.success("Endereço preenchido", { description: "Não foi possível obter coordenadas automaticamente." });
      }
    } catch {
      toast.error("Falha ao consultar CEP");
    } finally {
      setCepLoading(false);
    }
  };

  const onCepChange = (v: string) => {
    const masked = v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
    setForm({ ...form, zip: masked });
    if (cepTimer.current) clearTimeout(cepTimer.current);
    if (masked.replace(/\D/g, "").length === 8) {
      cepTimer.current = setTimeout(() => lookupCep(masked), 300);
    }
  };

  const doGeocode = async () => {
    if (!form.address && !form.city) return toast.error("Preencha endereço/cidade");
    try {
      const g = await geocode.mutateAsync({ address: form.address, city: form.city, state: form.state, zip: form.zip });
      setForm({ ...form, lat: g.lat, lng: g.lng });
      toast.success("Coordenadas encontradas", { description: g.display_name });
    } catch (e: any) { toast.error("Endereço não localizado", { description: "Preencha lat/lng manualmente." }); }
  };

  const onSave = async () => {
    if (!form.name) return toast.error("Nome é obrigatório");
    try { await save.mutateAsync(form); toast.success("Salvo"); setOpen(false); setForm({}); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Warehouse className="w-6 h-6" /> Centros de Distribuição</h1>
            <p className="text-sm text-muted-foreground">Pontos de partida (armazéns) das rotas. O CD padrão é usado automaticamente.</p>
          </div>
          <Button onClick={() => { setForm({}); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Novo CD</Button>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Endereço</TableHead><TableHead>Cidade</TableHead>
              <TableHead>Coordenadas</TableHead><TableHead>Padrão</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-sm">{d.address || "—"}</TableCell>
                  <TableCell className="text-sm">{[d.city, d.state].filter(Boolean).join(" / ") || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{d.lat && d.lng ? `${Number(d.lat).toFixed(4)}, ${Number(d.lng).toFixed(4)}` : <span className="text-red-500">Sem geo</span>}</TableCell>
                  <TableCell>{d.is_default ? <Badge className="bg-amber-100 text-amber-800"><Star className="w-3 h-3 mr-1" />Padrão</Badge> : null}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => { setForm(d); setOpen(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(d.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!data.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum CD cadastrado. Cadastre pelo menos 1 e marque como padrão.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{form.id ? "Editar CD" : "Novo CD"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome*</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: CD Anatriello Matriz" /></div>
              <div className="col-span-2">
                <Label>CEP {cepLoading && <span className="text-xs text-muted-foreground ml-1">buscando...</span>}</Label>
                <Input
                  value={form.zip || ""}
                  onChange={(e) => onCepChange(e.target.value)}
                  onBlur={(e) => lookupCep(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                />
                <p className="text-xs text-muted-foreground mt-1">Digite o CEP para preencher endereço e coordenadas automaticamente.</p>
              </div>
              <div className="col-span-2"><Label>Endereço</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro" /></div>
              <div><Label>Cidade</Label><Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Estado (UF)</Label><Input maxLength={2} value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} /></div>
              <div className="col-span-2">
                <Button type="button" variant="outline" className="w-full" onClick={doGeocode} disabled={geocode.isPending}>
                  <MapPin className="w-4 h-4 mr-1" /> {geocode.isPending ? "Buscando..." : "Rebuscar coordenadas"}
                </Button>
              </div>

              <div><Label>Latitude</Label><Input type="number" step="any" value={form.lat ?? ""} onChange={(e) => setForm({ ...form, lat: e.target.value ? +e.target.value : null })} /></div>
              <div><Label>Longitude</Label><Input type="number" step="any" value={form.lng ?? ""} onChange={(e) => setForm({ ...form, lng: e.target.value ? +e.target.value : null })} /></div>
              <div className="col-span-2 flex items-center gap-2 pt-2">
                <Switch checked={!!form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
                <Label className="!m-0">Definir como CD padrão</Label>
              </div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={onSave} disabled={save.isPending}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
