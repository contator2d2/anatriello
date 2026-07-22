import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Store, UserPlus, X, Share2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useSRPdvs, useSRSavePdv, useSRDeletePdv } from "@/hooks/use-smartroute";
import { useSRChecklistTemplates, useSRTemplates } from "@/hooks/use-smartroute-daily";
import { useSRGeocodeDepot } from "@/hooks/use-smartroute-depots";
import { PDVImportDialog } from "@/components/smartroute/PDVImportDialog";

const WEEKDAYS = [
  { n: 0, l: "Dom" }, { n: 1, l: "Seg" }, { n: 2, l: "Ter" },
  { n: 3, l: "Qua" }, { n: 4, l: "Qui" }, { n: 5, l: "Sex" }, { n: 6, l: "Sáb" },
];

export default function SmartRoutePDVs() {
  const { data = [] } = useSRPdvs();
  const { data: checklists = [] } = useSRChecklistTemplates();
  const { data: routes = [] } = useSRTemplates();
  const save = useSRSavePdv();
  const del = useSRDeletePdv();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const geocode = useSRGeocodeDepot();
  const [cepLoading, setCepLoading] = useState(false);

  const lookupCep = async (rawCep: string) => {
    const cep = String(rawCep || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (j.erro) { toast.error("CEP não encontrado"); return; }
      const address = [j.logradouro, j.bairro].filter(Boolean).join(", ");
      const next = { ...form, zip: cep, address: address || form.address, city: j.localidade || form.city, state: j.uf || form.state };
      setForm(next);
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
    const digits = v.replace(/\D/g, "").slice(0, 8);
    const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setForm({ ...form, zip: masked });
    if (digits.length === 8) lookupCep(digits);
  };


  const openForm = (row: any = {}) => {
    setForm({
      delivery_window: "qualquer",
      service_time_min: 15,
      ...row,
      allowed_weekdays: row?.allowed_weekdays || [1, 2, 3, 4, 5],
    });
    setOpen(true);
  };


  const toggleWd = (n: number) => {
    const arr: number[] = form.allowed_weekdays || [];
    setForm({ ...form, allowed_weekdays: arr.includes(n) ? arr.filter((x) => x !== n) : [...arr, n].sort() });
  };

  const onSave = async () => {
    if (!form.name) return toast.error("Nome é obrigatório");
    try { await save.mutateAsync(form); toast.success("Salvo"); setOpen(false); setForm({}); } catch (e: any) { toast.error(e.message); }
  };

  const winLabel = (w?: string) => ({ manha: "Manhã", tarde: "Tarde", noite: "Noite", qualquer: "Qualquer" }[w || "qualquer"]);

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="w-6 h-6" /> PDVs / Clientes</h1>
            <p className="text-sm text-muted-foreground">Cadastro de pontos de entrega com regras: janela preferencial, dias permitidos, tempo de descarga e checklist.</p>
          </div>
          <Button onClick={() => openForm()}><Plus className="w-4 h-4 mr-1" /> Novo PDV</Button>
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Cidade</TableHead>
              <TableHead>Rota fixa</TableHead>
              <TableHead>Janela</TableHead><TableHead>Dias</TableHead>
              <TableHead>Descarga</TableHead><TableHead>Checklist</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.city}{p.state ? `/${p.state}` : ""}</TableCell>
                  <TableCell className="text-xs">
                    {routes.find((r: any) => r.id === p.route_template_id)?.code
                      || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{winLabel(p.delivery_window)}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {WEEKDAYS.map((w) => (
                      <span key={w.n} className={(p.allowed_weekdays || []).includes(w.n) ? "text-primary font-semibold mr-1" : "text-muted-foreground/40 mr-1"}>
                        {w.l[0]}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell>{p.service_time_min || 15} min</TableCell>
                  <TableCell className="text-xs">{checklists.find((c: any) => c.id === p.checklist_template_id)?.name || <span className="text-muted-foreground">padrão</span>}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openForm(p)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(p.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!data.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum PDV cadastrado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{form.id ? "Editar PDV" : "Novo PDV"}</DialogTitle></DialogHeader>

            <h3 className="text-sm font-semibold mt-2">Identificação</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome / Razão Social*</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>CNPJ</Label><Input value={form.cnpj || ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
              <div>
                <Label>CEP {cepLoading && <span className="text-xs text-muted-foreground">buscando…</span>}</Label>
                <Input value={form.zip || ""} onChange={(e) => onCepChange(e.target.value)} placeholder="00000-000" maxLength={9} />
              </div>
              <div className="col-span-2"><Label>Endereço</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Cidade</Label><Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>UF</Label><Input value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} /></div>
              <div className="col-span-2">
                <Button type="button" variant="outline" className="w-full" disabled={geocode.isPending} onClick={async () => {
                  if (!form.address && !form.city) return toast.error("Preencha endereço/cidade");
                  try {
                    const g = await geocode.mutateAsync({ address: form.address, city: form.city, state: form.state, zip: form.zip });
                    setForm((f: any) => ({ ...f, lat: g.lat, lng: g.lng }));
                    toast.success("Coordenadas encontradas", { description: g.display_name });
                  } catch { toast.error("Endereço não localizado", { description: "Preencha lat/lng manualmente." }); }
                }}>
                  {geocode.isPending ? "Buscando..." : "Obter coordenadas do endereço"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">Preencha o número do endereço antes para maior precisão.</p>
              </div>
              <div><Label>Latitude</Label><Input type="number" step="any" value={form.lat || ""} onChange={(e) => setForm({ ...form, lat: +e.target.value })} /></div>
              <div><Label>Longitude</Label><Input type="number" step="any" value={form.lng || ""} onChange={(e) => setForm({ ...form, lng: +e.target.value })} /></div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <h3 className="text-sm font-semibold">Contatos do PDV</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => {
                const list = Array.isArray(form.contacts) ? form.contacts : [];
                setForm({ ...form, contacts: [...list, { name: "", role: "", phone: "", email: "", whatsapp: "", shared: false }] });
              }}>
                <UserPlus className="w-4 h-4 mr-1" /> Adicionar contato
              </Button>
            </div>
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              {(!form.contacts || form.contacts.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhum contato adicionado. Adicione múltiplos contatos (comprador, gerente, recebedor…) e marque quais devem ser sincronizados com a lista de contatos central futuramente.
                </p>
              )}
              {(form.contacts || []).map((c: any, idx: number) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-background border rounded p-2">
                  <div className="col-span-3"><Label className="text-xs">Nome</Label><Input value={c.name || ""} onChange={(e) => {
                    const list = [...form.contacts]; list[idx] = { ...list[idx], name: e.target.value }; setForm({ ...form, contacts: list });
                  }} /></div>
                  <div className="col-span-2"><Label className="text-xs">Função</Label><Input placeholder="Comprador, Gerente…" value={c.role || ""} onChange={(e) => {
                    const list = [...form.contacts]; list[idx] = { ...list[idx], role: e.target.value }; setForm({ ...form, contacts: list });
                  }} /></div>
                  <div className="col-span-2"><Label className="text-xs">Telefone</Label><Input value={c.phone || ""} onChange={(e) => {
                    const list = [...form.contacts]; list[idx] = { ...list[idx], phone: e.target.value }; setForm({ ...form, contacts: list });
                  }} /></div>
                  <div className="col-span-2"><Label className="text-xs">WhatsApp</Label><Input value={c.whatsapp || ""} onChange={(e) => {
                    const list = [...form.contacts]; list[idx] = { ...list[idx], whatsapp: e.target.value }; setForm({ ...form, contacts: list });
                  }} /></div>
                  <div className="col-span-2"><Label className="text-xs">E-mail</Label><Input value={c.email || ""} onChange={(e) => {
                    const list = [...form.contacts]; list[idx] = { ...list[idx], email: e.target.value }; setForm({ ...form, contacts: list });
                  }} /></div>
                  <div className="col-span-1 flex flex-col items-center gap-1">
                    <label className="flex items-center gap-1 text-[10px] cursor-pointer" title="Compartilhar com lista central de contatos">
                      <Checkbox checked={!!c.shared} onCheckedChange={() => {
                        const list = [...form.contacts]; list[idx] = { ...list[idx], shared: !list[idx].shared }; setForm({ ...form, contacts: list });
                      }} />
                      <Share2 className="w-3 h-3" />
                    </label>
                    <Button type="button" size="icon" variant="ghost" onClick={() => {
                      const list = [...form.contacts]; list.splice(idx, 1); setForm({ ...form, contacts: list });
                    }}><X className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                <Share2 className="w-3 h-3 inline mr-1" />Marque para incluir na lista de contatos compartilhada (integração futura).
              </p>
            </div>

            <h3 className="text-sm font-semibold mt-4">Contato principal (legado)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome contato principal</Label><Input value={form.contact_name || ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div><Label>Telefone contato principal</Label><Input value={form.contact_phone || ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
            </div>

            <h3 className="text-sm font-semibold mt-4">Rota fixa (linha do caminhão)</h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Rota fixa vinculada</Label>
                <Select value={form.route_template_id || "__none"} onValueChange={(v) => setForm({ ...form, route_template_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Sem rota fixa (legado)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem rota fixa (legado)</SelectItem>
                    {routes.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.code || r.name || r.id}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Este PDV pertence à linha do caminhão selecionada. Uma rota pode ter centenas de PDVs; a IA monta a rota do dia apenas com os PDVs que tiverem pedidos.
                </p>
              </div>
            </div>

            <h3 className="text-sm font-semibold mt-4">Regras de recebimento (usadas pela IA)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Janela preferencial</Label>
                <Select value={form.delivery_window || "qualquer"} onValueChange={(v) => setForm({ ...form, delivery_window: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="noite">Noite</SelectItem>
                    <SelectItem value="qualquer">Qualquer horário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tempo de descarga (min)</Label>
                <Input type="number" min={1} value={form.service_time_min || 15} onChange={(e) => setForm({ ...form, service_time_min: +e.target.value || 15 })} />
              </div>
              <div className="col-span-2">
                <Label>Dias da semana permitidos</Label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {WEEKDAYS.map((w) => (
                    <label key={w.n} className="flex items-center gap-1 border rounded px-3 py-1.5 cursor-pointer hover:bg-muted">
                      <Checkbox checked={(form.allowed_weekdays || []).includes(w.n)} onCheckedChange={() => toggleWd(w.n)} />
                      <span className="text-sm">{w.l}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pedidos lançados para um dia fora desta lista ficam bloqueados na otimização.</p>
              </div>
              <div className="col-span-2">
                <Label>Checklist do PDV</Label>
                <Select value={form.checklist_template_id || "__default"} onValueChange={(v) => setForm({ ...form, checklist_template_id: v === "__default" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Usar template padrão" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default">Template padrão da organização</SelectItem>
                    {checklists.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Janela horária início</Label><Input type="time" value={form.delivery_window_start || ""} onChange={(e) => setForm({ ...form, delivery_window_start: e.target.value })} /></div>
              <div><Label>Janela horária fim</Label><Input type="time" value={form.delivery_window_end || ""} onChange={(e) => setForm({ ...form, delivery_window_end: e.target.value })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>

            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={onSave} disabled={save.isPending}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

