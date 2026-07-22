import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Users2, UserPlus2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  useSRDrivers, useSRSaveDriver, useSRDeleteDriver, useSRVehicles,
  useSRRHCandidates, useSRImportDriversFromRH,
} from "@/hooks/use-smartroute";

export default function SmartRouteMotoristas() {
  const { data = [] } = useSRDrivers();
  const { data: vehicles = [] } = useSRVehicles();
  const save = useSRSaveDriver();
  const del = useSRDeleteDriver();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  // Import from RH
  const [importOpen, setImportOpen] = useState(false);
  const { data: candidates = [], isLoading: loadingCandidates, refetch } = useSRRHCandidates(importOpen);
  const importMut = useSRImportDriversFromRH();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  const filteredCandidates = candidates.filter((c: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.full_name, c.cpf, c.position, c.email].some((v: any) => String(v || "").toLowerCase().includes(q));
  });
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

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

  const onImport = async () => {
    if (!selectedIds.length) return toast.error("Selecione pelo menos um colaborador");
    try {
      const r: any = await importMut.mutateAsync(selectedIds);
      toast.success(`${r.imported} motorista(s) importado(s) do RH`);
      if (r.credentials?.length) {
        const lines = r.credentials.map((c: any) => `${c.full_name} — CPF ${c.cpf || "—"} — senha ${c.password}`).join("\n");
        // Copia credenciais para clipboard para facilitar entrega
        try { await navigator.clipboard.writeText(lines); toast.info("Credenciais copiadas para a área de transferência"); } catch {}
      }
      setSelected({});
      setImportOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users2 className="w-6 h-6" /> Motoristas</h1>
            <p className="text-sm text-muted-foreground">Cadastro e acesso ao app do entregador.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setSelected({}); setSearch(""); setImportOpen(true); }}>
              <UserPlus2 className="w-4 h-4 mr-1" /> Importar do RH
            </Button>
            <Button onClick={() => { setForm({ active: true }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Novo motorista</Button>
          </div>
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
                  <TableCell className="font-medium">
                    {d.full_name}
                    {d.employee_id && <Badge variant="secondary" className="ml-2 text-[10px]">RH</Badge>}
                  </TableCell>
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

        {/* Import from RH */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Importar motoristas do RH</DialogTitle>
              <DialogDescription>
                Mostra colaboradores cadastrados no RH com cargo/perfil de motorista que ainda não estão no SmartRoute.
                Uma senha aleatória será gerada para cada um.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar por nome, CPF, cargo..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Atualizar</Button>
            </div>

            <div className="border rounded-md max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredCandidates.length > 0 && filteredCandidates.every((c: any) => selected[c.id])}
                        onCheckedChange={(v) => {
                          const next = { ...selected };
                          filteredCandidates.forEach((c: any) => { next[c.id] = !!v; });
                          setSelected(next);
                        }}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>CNH</TableHead>
                    <TableHead>Telefone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCandidates && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
                  )}
                  {!loadingCandidates && filteredCandidates.map((c: any) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected({ ...selected, [c.id]: !selected[c.id] })}>
                      <TableCell><Checkbox checked={!!selected[c.id]} onCheckedChange={(v) => setSelected({ ...selected, [c.id]: !!v })} /></TableCell>
                      <TableCell className="font-medium">{c.full_name}</TableCell>
                      <TableCell>{c.cpf || "—"}</TableCell>
                      <TableCell>{c.position || c.worker_profile || "—"}</TableCell>
                      <TableCell>{c.license_number ? `${c.license_number}${c.license_category ? ` (${c.license_category})` : ""}` : "—"}</TableCell>
                      <TableCell>{c.phone || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!loadingCandidates && !filteredCandidates.length && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      Nenhum colaborador disponível. Cadastre no RH com cargo "Motorista" ou perfil funcional motorista.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <div className="text-xs text-muted-foreground mr-auto">{selectedIds.length} selecionado(s)</div>
              <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
              <Button onClick={onImport} disabled={!selectedIds.length || importMut.isPending}>
                {importMut.isPending ? "Importando..." : `Importar ${selectedIds.length || ""}`.trim()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

