import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useEmployees } from "@/hooks/use-rh";
import { usePDVs, useCreatePDV, useUpdatePDV } from "@/hooks/use-promotor";
import { useGeocode } from "@/hooks/use-rh";
import { MapPin, Plus, Edit, Search, Loader2, Navigation } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_PDV = { name: '', client_name: '', address: '', address_number: '', complement: '', zip_code: '', city: '', state: '', neighborhood: '', latitude: '', longitude: '', radius_meters: 200, supervisor_id: '', notes: '', active: true };

function splitAddressAndNumber(address: string) {
  const normalized = String(address || '').trim().replace(/\s+/g, ' ');
  const match = normalized.match(/^(.*?)(?:,\s*|\s+)(?:n[ºo°.]?\s*)?(\d{1,6}[a-zA-Z]?)\s*$/i);
  if (!match) return { street: normalized, number: '' };
  return { street: String(match[1] || '').trim().replace(/,$/, ''), number: String(match[2] || '').trim() };
}

export default function RHPDVs() {
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_PDV);
  const [search, setSearch] = useState("");
  const { data: pdvs, isLoading } = usePDVs();
  const { data: employees } = useEmployees();
  const createPDV = useCreatePDV();
  const updatePDV = useUpdatePDV();
  const { toast } = useToast();

  const supervisors = (employees || []).filter((e: any) => e.worker_profile === 'supervisor' || e.worker_profile === 'administrativo');

  const handleCep = useCallback(async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setForm(f => ({ ...f, address: data.logradouro || '', neighborhood: data.bairro || '', city: data.localidade || '', state: data.uf || '' }));
        }
      } catch {}
    }
  }, []);

  const openCreate = () => { setForm(EMPTY_PDV); setEditId(null); setShowDialog(true); };
  const openEdit = (pdv: any) => {
    const parsed = splitAddressAndNumber(pdv.address || '');
    setForm({ name: pdv.name, client_name: pdv.client_name || '', address: parsed.street || pdv.address || '', address_number: pdv.address_number || parsed.number || '', complement: pdv.complement || '', zip_code: pdv.zip_code || '', city: pdv.city || '', state: pdv.state || '', neighborhood: pdv.neighborhood || '', latitude: pdv.latitude || '', longitude: pdv.longitude || '', radius_meters: pdv.radius_meters || 200, supervisor_id: pdv.supervisor_id || '', notes: pdv.notes || '', active: pdv.active !== false });
    setEditId(pdv.id);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    try {
      if (editId) {
        await updatePDV.mutateAsync({ id: editId, ...form, address: [form.address, form.address_number].filter(Boolean).join(', '), latitude: form.latitude ? Number(form.latitude) : null, longitude: form.longitude ? Number(form.longitude) : null });
      } else {
        await createPDV.mutateAsync({ ...form, address: [form.address, form.address_number].filter(Boolean).join(', '), latitude: form.latitude ? Number(form.latitude) : null, longitude: form.longitude ? Number(form.longitude) : null });
      }
      toast({ title: editId ? 'PDV atualizado!' : 'PDV criado!' });
      setShowDialog(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = (pdvs || []).filter((p: any) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.client_name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2"><MapPin className="h-5 w-5" /> Cadastro de PDVs</h1>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo PDV</Button>
        </div>

        <div className="relative max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar PDV..." className="pl-9" /></div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Raio (m)</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.client_name || '-'}</TableCell>
                  <TableCell>{p.city ? `${p.city}/${p.state}` : '-'}</TableCell>
                  <TableCell>{p.radius_meters}m</TableCell>
                  <TableCell className="text-sm">{p.supervisor_name || '-'}</TableCell>
                  <TableCell>{p.active ? <Badge className="bg-green-500">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum PDV cadastrado</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Editar PDV' : 'Novo PDV'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Cliente</Label><Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>CEP</Label><Input value={form.zip_code} onChange={e => { setForm(f => ({ ...f, zip_code: e.target.value })); handleCep(e.target.value); }} placeholder="00000-000" /></div>
                <div className="space-y-1 col-span-2"><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Número *</Label><Input value={form.address_number} onChange={e => setForm(f => ({ ...f, address_number: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Complemento</Label><Input value={form.complement} onChange={e => setForm(f => ({ ...f, complement: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Bairro</Label><Input value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Cidade</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div className="space-y-1"><Label>UF</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} maxLength={2} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="-23.550520" /></div>
              <div className="space-y-1"><Label>Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-46.633308" /></div>
              <div className="space-y-1"><Label>Raio (metros)</Label><Input type="number" value={form.radius_meters} onChange={e => setForm(f => ({ ...f, radius_meters: Number(e.target.value) }))} /></div>
            </div>
            <GeocodeButton form={form} setForm={setForm} />
            <div className="space-y-1"><Label>Supervisor</Label>
              <Select value={form.supervisor_id} onValueChange={v => setForm(f => ({ ...f, supervisor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{supervisors.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button onClick={handleSave} className="w-full" disabled={createPDV.isPending || updatePDV.isPending}>
              {(createPDV.isPending || updatePDV.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editId ? 'Salvar Alterações' : 'Criar PDV'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function GeocodeButton({ form, setForm }: { form: any; setForm: React.Dispatch<React.SetStateAction<any>> }) {
  const geocode = useGeocode();
  const { toast } = useToast();

  const handleGeocode = async () => {
    const parsed = splitAddressAndNumber(form.address);
    const addressNumber = String(form.address_number || parsed.number || '').trim();
    const addressStreet = String(parsed.street || form.address || '').trim();
    const cleanZip = String(form.zip_code || '').replace(/\D/g, '');
    const state = String(form.state || '').trim().toUpperCase();

    if (!addressStreet || !addressNumber || !form.neighborhood || !form.city || !state || cleanZip.length !== 8) {
      toast({
        title: 'Endereço incompleto',
        description: 'Informe rua + número, bairro, cidade, UF e CEP válido para geolocalizar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await geocode.mutateAsync({
        address: addressStreet,
        address_number: addressNumber,
        complement: form.complement,
        neighborhood: form.neighborhood,
        city: form.city,
        state,
        zip_code: cleanZip,
      });
      if (result.found) {
        setForm((f: any) => ({ ...f, latitude: String(result.latitude), longitude: String(result.longitude) }));
        toast({ title: 'Coordenadas geradas!', description: result.display_name });
      } else {
        toast({ title: 'Endereço não encontrado', description: result?.attempted_address ? `Busca: ${result.attempted_address}` : 'Tente um endereço mais completo', variant: 'destructive' });
      }
    } catch (err: any) {
      const desc = [err.message, err?.attempted_address ? `Busca: ${err.attempted_address}` : null].filter(Boolean).join(' • ');
      toast({ title: 'Erro na geocodificação', description: desc, variant: 'destructive' });
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleGeocode} disabled={geocode.isPending} className="gap-2 text-xs">
      {geocode.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
      Gerar Coordenadas pelo Endereço
    </Button>
  );
}
