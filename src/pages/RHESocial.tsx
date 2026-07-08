import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useEsocialEvents, useEsocialEvent, useEsocialSummary,
  useGenerateEsocial, useGenerateEsocialBatch, useUpdateEsocialStatus, useDeleteEsocial,
  useEmployees, useTerminations, useAbsences,
} from "@/hooks/use-rh";
import {
  FileCode, Plus, Loader2, Download, Copy, Send, CheckCircle2, XCircle,
  AlertTriangle, Layers, Trash2, RefreshCw,
} from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  "S-2200": "S-2200 · Admissão",
  "S-2299": "S-2299 · Desligamento",
  "S-2230": "S-2230 · Afastamento",
  "S-3000": "S-3000 · Exclusão",
};
const STATUS_LABEL: Record<string, string> = {
  gerado: "Gerado",
  enviado: "Enviado",
  aceito: "Aceito",
  rejeitado: "Rejeitado",
  cancelado: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  gerado: "bg-blue-100 text-blue-800",
  enviado: "bg-yellow-100 text-yellow-800",
  aceito: "bg-green-100 text-green-800",
  rejeitado: "bg-red-100 text-red-800",
  cancelado: "bg-slate-200 text-slate-700",
};

const fmtDate = (d?: string) => d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "-";
const fmtDateTime = (d?: string) => d ? new Date(d).toLocaleString("pt-BR") : "-";

export default function RHESocial() {
  const { toast } = useToast();
  const [openNew, setOpenNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: "enviado", protocol: "", receipt_number: "", error_message: "" });

  const filters: any = {};
  if (statusFilter) filters.status = statusFilter;
  if (typeFilter) filters.event_type = typeFilter;

  const { data: list = [], isLoading, refetch } = useEsocialEvents(filters);
  const { data: detail } = useEsocialEvent(detailId || undefined);
  const { data: summary } = useEsocialSummary();
  const { data: employees = [] } = useEmployees();
  const { data: terminations = [] } = useTerminations();
  const { data: absences = [] } = useAbsences();

  const generateMut = useGenerateEsocial();
  const batchMut = useGenerateEsocialBatch();
  const statusMut = useUpdateEsocialStatus();
  const deleteMut = useDeleteEsocial();

  const [genType, setGenType] = useState("S-2200");
  const [genRef, setGenRef] = useState("");

  const kpis = useMemo(() => {
    const s: any = { total: list.length };
    (summary?.by_status || []).forEach((r: any) => { s[r.status] = r.total; });
    s.pendentes_s2200 = summary?.pending?.["S-2200"] || 0;
    return s;
  }, [list, summary]);

  const refOptions = useMemo(() => {
    if (genType === "S-2200") {
      return employees.filter((e: any) => e.status === "ativo").map((e: any) => ({
        id: e.id, label: `${e.full_name}${e.cpf ? ` — ${e.cpf}` : ""}`,
      }));
    }
    if (genType === "S-2299") {
      return terminations.filter((t: any) => t.status === "homologada").map((t: any) => ({
        id: t.id, label: `${t.employee_name || t.employee_id?.slice(0, 8)} — ${fmtDate(t.termination_date)}`,
      }));
    }
    if (genType === "S-2230") {
      return absences.map((a: any) => ({
        id: a.id, label: `${a.employee_name || ""} — ${a.absence_type} (${fmtDate(a.start_date)})`,
      }));
    }
    return [];
  }, [genType, employees, terminations, absences]);

  const submitGenerate = async () => {
    if (!genRef) { toast({ title: "Selecione a referência", variant: "destructive" }); return; }
    try {
      const r: any = await generateMut.mutateAsync({ type: genType, reference_id: genRef });
      toast({ title: "Evento gerado", description: `${r.event_type} · ${r.event_id_esocial}` });
      setOpenNew(false); setGenRef("");
      setDetailId(r.id);
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message, variant: "destructive" });
    }
  };

  const runBatch = async (type: string) => {
    if (!confirm(`Gerar todos os eventos ${type} elegíveis ainda não gerados?`)) return;
    try {
      const r: any = await batchMut.mutateAsync({ type });
      toast({
        title: `Lote ${type} processado`,
        description: `${r.ok} gerados, ${r.failed} com erro (de ${r.total} candidatos).`,
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const downloadXML = (id: string) => {
    window.open(`/api/rh/esocial/events/${id}/xml`, "_blank");
  };

  const copyXML = async () => {
    if (!detail?.xml) return;
    await navigator.clipboard.writeText(detail.xml);
    toast({ title: "XML copiado" });
  };

  const openStatus = () => {
    if (!detail) return;
    setStatusForm({
      status: detail.status === "gerado" ? "enviado" : detail.status,
      protocol: detail.protocol || "",
      receipt_number: detail.receipt_number || "",
      error_message: detail.error_message || "",
    });
    setStatusOpen(true);
  };

  const submitStatus = async () => {
    if (!detail) return;
    try {
      await statusMut.mutateAsync({ id: detail.id, ...statusForm });
      toast({ title: "Status atualizado" });
      setStatusOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const doDelete = async () => {
    if (!detail) return;
    if (!confirm("Excluir este evento? Só permitido se ainda não foi aceito.")) return;
    try {
      await deleteMut.mutateAsync(detail.id);
      toast({ title: "Excluído" });
      setDetailId(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const generateCancellation = async () => {
    if (!detail) return;
    if (!detail.receipt_number) { toast({ title: "Evento precisa ter nº de recibo (S-3000)", variant: "destructive" }); return; }
    if (!confirm("Gerar S-3000 (exclusão) para este evento?")) return;
    try {
      const r: any = await generateMut.mutateAsync({ type: "S-3000", reference_id: detail.id });
      toast({ title: "S-3000 gerado", description: r.event_id_esocial });
      setDetailId(r.id);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileCode className="w-6 h-6" /> Exportação eSocial
            </h1>
            <p className="text-sm text-muted-foreground">
              Geração de eventos S-2200 (admissão), S-2299 (desligamento) e S-2230 (afastamentos) em XML.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
            <Button onClick={() => setOpenNew(true)}>
              <Plus className="w-4 h-4 mr-2" /> Gerar evento
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { l: "Total eventos", v: kpis.total || 0 },
            { l: "Aceitos", v: kpis.aceito || 0 },
            { l: "Enviados", v: kpis.enviado || 0 },
            { l: "Rejeitados", v: kpis.rejeitado || 0 },
            { l: "S-2200 pendentes", v: kpis.pendentes_s2200 || 0 },
          ].map((k) => (
            <Card key={k.l}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{k.l}</p>
                <p className="text-2xl font-bold">{k.v}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Geração em lote</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => runBatch("S-2200")} disabled={batchMut.isPending}>
              <Layers className="w-4 h-4 mr-2" /> Gerar S-2200 pendentes
            </Button>
            <Button variant="outline" size="sm" onClick={() => runBatch("S-2299")} disabled={batchMut.isPending}>
              <Layers className="w-4 h-4 mr-2" /> Gerar S-2299 (rescisões homologadas)
            </Button>
            <Button variant="outline" size="sm" onClick={() => runBatch("S-2230")} disabled={batchMut.isPending}>
              <Layers className="w-4 h-4 mr-2" /> Gerar S-2230 (afastamentos)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle>Eventos gerados</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={typeFilter || "all"} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos tipos</SelectItem>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-6"><Loader2 className="animate-spin" /></div>
            ) : list.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento gerado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>ID do evento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Protocolo/Recibo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((ev: any) => (
                    <TableRow key={ev.id} className="cursor-pointer" onClick={() => setDetailId(ev.id)}>
                      <TableCell><Badge variant="outline">{ev.event_type}</Badge></TableCell>
                      <TableCell>
                        <div className="text-sm">{ev.employee_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{ev.employee_cpf || ""}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{ev.event_id_esocial}</TableCell>
                      <TableCell>{fmtDate(ev.event_date)}</TableCell>
                      <TableCell><Badge className={STATUS_COLOR[ev.status]}>{STATUS_LABEL[ev.status]}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {ev.protocol && <div>Prot: {ev.protocol}</div>}
                        {ev.receipt_number && <div>Rec: {ev.receipt_number}</div>}
                        {ev.error_message && <div className="text-red-600">{ev.error_message.slice(0, 40)}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gerar evento */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Gerar evento eSocial</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo de evento *</Label>
              <Select value={genType} onValueChange={(v) => { setGenType(v); setGenRef(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S-2200">S-2200 · Admissão</SelectItem>
                  <SelectItem value="S-2299">S-2299 · Desligamento</SelectItem>
                  <SelectItem value="S-2230">S-2230 · Afastamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                {genType === "S-2200" ? "Colaborador *" : genType === "S-2299" ? "Rescisão homologada *" : "Afastamento *"}
              </Label>
              <Select value={genRef || "none"} onValueChange={(v) => setGenRef(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {refOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {refOptions.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Nenhuma referência elegível encontrada para este tipo.</p>
              )}
            </div>
            <div className="text-xs text-muted-foreground border-l-2 border-primary pl-2">
              O XML gerado segue o layout eSocial S-1.02 (ambiente de <b>testes</b>, tpAmb=2). Ajuste para produção antes de enviar oficialmente.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={submitGenerate} disabled={generateMut.isPending || !genRef}>
              {generateMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileCode className="w-5 h-5" /> {TYPE_LABEL[detail.event_type]}
                  </span>
                  <Badge className={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="info">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="info">Informações</TabsTrigger>
                  <TabsTrigger value="xml">XML</TabsTrigger>
                  <TabsTrigger value="processo">Envio</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-2 mt-4 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Colaborador:</span> <b>{detail.employee_name || "—"}</b></div>
                    <div><span className="text-muted-foreground">CPF:</span> {detail.employee_cpf || "—"}</div>
                    <div><span className="text-muted-foreground">Matrícula:</span> {detail.registration_number || "—"}</div>
                    <div><span className="text-muted-foreground">Data do evento:</span> {fmtDate(detail.event_date)}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">ID eSocial:</span> <span className="font-mono">{detail.event_id_esocial}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Hash SHA-256:</span> <span className="font-mono text-xs break-all">{detail.xml_hash}</span></div>
                    <div><span className="text-muted-foreground">Gerado em:</span> {fmtDateTime(detail.created_at)}</div>
                    <div><span className="text-muted-foreground">Enviado em:</span> {fmtDateTime(detail.sent_at)}</div>
                    <div><span className="text-muted-foreground">Processado em:</span> {fmtDateTime(detail.processed_at)}</div>
                  </div>
                </TabsContent>

                <TabsContent value="xml" className="mt-4 space-y-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadXML(detail.id)}>
                      <Download className="w-4 h-4 mr-2" /> Baixar
                    </Button>
                    <Button size="sm" variant="outline" onClick={copyXML}>
                      <Copy className="w-4 h-4 mr-2" /> Copiar
                    </Button>
                  </div>
                  <pre className="text-xs bg-muted p-3 rounded max-h-[50vh] overflow-auto whitespace-pre-wrap">{detail.xml}</pre>
                </TabsContent>

                <TabsContent value="processo" className="mt-4 space-y-3 text-sm">
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Protocolo de envio</Label>
                      <p className="p-2 bg-muted rounded">{detail.protocol || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs">Nº do recibo</Label>
                      <p className="p-2 bg-muted rounded">{detail.receipt_number || "—"}</p>
                    </div>
                    {detail.error_message && (
                      <div>
                        <Label className="text-xs text-red-600">Mensagem de erro</Label>
                        <p className="p-2 bg-red-50 border border-red-200 rounded whitespace-pre-wrap">{detail.error_message}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" onClick={openStatus}>
                      <Send className="w-4 h-4 mr-2" /> Atualizar status / protocolo
                    </Button>
                    {detail.status === "aceito" && detail.event_type !== "S-3000" && (
                      <Button size="sm" variant="outline" onClick={generateCancellation}>
                        <XCircle className="w-4 h-4 mr-2" /> Gerar S-3000 (exclusão)
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O envio ao ambiente oficial do eSocial requer certificado digital A1/A3 do empregador. Após enviar por seu meio de transmissão, registre aqui o protocolo e nº de recibo retornados.
                  </p>
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex-wrap gap-2">
                {["gerado", "rejeitado", "cancelado"].includes(detail.status) && (
                  <Button variant="destructive" size="sm" onClick={doDelete}>
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailId(null)}>Fechar</Button>
              </DialogFooter>
            </>
          ) : (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          )}
        </DialogContent>
      </Dialog>

      {/* Atualizar status */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Atualizar status do evento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Status *</Label>
              <Select value={statusForm.status} onValueChange={(v) => setStatusForm({ ...statusForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Protocolo</Label>
              <Input value={statusForm.protocol} onChange={(e) => setStatusForm({ ...statusForm, protocol: e.target.value })} />
            </div>
            <div>
              <Label>Nº do recibo</Label>
              <Input value={statusForm.receipt_number} onChange={(e) => setStatusForm({ ...statusForm, receipt_number: e.target.value })} />
            </div>
            {statusForm.status === "rejeitado" && (
              <div>
                <Label>Mensagem de erro</Label>
                <Textarea rows={3} value={statusForm.error_message}
                  onChange={(e) => setStatusForm({ ...statusForm, error_message: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancelar</Button>
            <Button onClick={submitStatus} disabled={statusMut.isPending}>
              {statusMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
