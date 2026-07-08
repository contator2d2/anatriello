import { useMemo, useRef, useState, useEffect } from "react";
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
  useWarnings, useWarning, useCreateWarning, useUpdateWarning,
  useAcknowledgeWarning, useRefuseWarning, useRevokeWarning, useDeleteWarning,
  useEmployees,
} from "@/hooks/use-rh";
import {
  AlertTriangle, Plus, Loader2, Trash2, ShieldAlert, FileSignature,
  Printer, Ban, CheckCircle2, XCircle, Eraser,
} from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  verbal: "Advertência verbal",
  escrita: "Advertência escrita",
  suspensao: "Suspensão",
  justa_causa: "Justa causa",
};
const TYPE_COLOR: Record<string, string> = {
  verbal: "bg-yellow-100 text-yellow-800",
  escrita: "bg-orange-100 text-orange-800",
  suspensao: "bg-red-100 text-red-800",
  justa_causa: "bg-red-200 text-red-900",
};
const STATUS_LABEL: Record<string, string> = {
  pendente_ciencia: "Pendente ciência",
  dada_ciencia: "Ciência dada",
  recusada: "Ciência recusada",
  revogada: "Revogada",
  cancelada: "Cancelada",
};
const STATUS_COLOR: Record<string, string> = {
  pendente_ciencia: "bg-yellow-100 text-yellow-800",
  dada_ciencia: "bg-green-100 text-green-800",
  recusada: "bg-red-100 text-red-800",
  revogada: "bg-slate-200 text-slate-700",
  cancelada: "bg-slate-100 text-slate-500",
};

const fmtDate = (d?: string) => d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "-";
const fmtDateTime = (d?: string) => d ? new Date(d).toLocaleString("pt-BR") : "-";

// Simple canvas signature pad
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.lineCap = "round";
  }, []);

  const pos = (e: any) => {
    const canvas = ref.current!;
    const r = canvas.getBoundingClientRect();
    const t = e.touches?.[0];
    const cx = t ? t.clientX : e.clientX;
    const cy = t ? t.clientY : e.clientY;
    return { x: (cx - r.left) * (canvas.width / r.width), y: (cy - r.top) * (canvas.height / r.height) };
  };
  const start = (e: any) => { e.preventDefault(); drawing.current = true; last.current = pos(e); };
  const move = (e: any) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.current!.x, last.current!.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
    onChange(canvas.toDataURL("image/png"));
  };
  const end = () => { drawing.current = false; last.current = null; };
  const clear = () => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={ref} width={600} height={180}
        className="w-full border rounded bg-white touch-none"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <Button type="button" variant="outline" size="sm" onClick={clear}>
        <Eraser className="w-4 h-4 mr-2" /> Limpar assinatura
      </Button>
    </div>
  );
}

export default function RHAdvertencias() {
  const { toast } = useToast();
  const [openNew, setOpenNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [empFilter, setEmpFilter] = useState("");
  const [ackOpen, setAckOpen] = useState(false);
  const [ackSig, setAckSig] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState("");

  const filters: any = {};
  if (statusFilter) filters.status = statusFilter;
  if (typeFilter) filters.type = typeFilter;
  if (empFilter) filters.employee_id = empFilter;

  const { data: list = [], isLoading } = useWarnings(filters);
  const { data: detail } = useWarning(detailId || undefined);
  const { data: employees = [] } = useEmployees();

  const createMut = useCreateWarning();
  const updateMut = useUpdateWarning();
  const ackMut = useAcknowledgeWarning();
  const refuseMut = useRefuseWarning();
  const revokeMut = useRevokeWarning();
  const deleteMut = useDeleteWarning();

  const emptyForm = {
    employee_id: "", type: "escrita", reason: "", description: "",
    incident_date: "", issued_date: new Date().toISOString().slice(0, 10),
    suspension_days: 0, suspension_start_date: "", suspension_end_date: "",
    witness_name: "", witness_document: "",
  };
  const [form, setForm] = useState(emptyForm);

  const kpis = useMemo(() => ({
    pendentes: list.filter((w: any) => w.status === "pendente_ciencia").length,
    mes: list.filter((w: any) => new Date(w.issued_date).getMonth() === new Date().getMonth() && new Date(w.issued_date).getFullYear() === new Date().getFullYear()).length,
    suspensoes: list.filter((w: any) => w.type === "suspensao" && w.status !== "revogada" && w.status !== "cancelada").length,
    total: list.length,
  }), [list]);

  const submit = async () => {
    if (!form.employee_id || !form.reason.trim()) {
      toast({ title: "Preencha colaborador e motivo", variant: "destructive" });
      return;
    }
    if (form.type === "suspensao" && (!form.suspension_days || form.suspension_days < 1)) {
      toast({ title: "Suspensão exige nº de dias > 0", variant: "destructive" });
      return;
    }
    try {
      const r: any = await createMut.mutateAsync(form);
      toast({ title: "Advertência registrada", description: "Aguardando ciência do colaborador." });
      setOpenNew(false); setForm(emptyForm);
      setDetailId(r.id);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const doAck = async () => {
    if (!detail || !ackSig) { toast({ title: "Assine antes de confirmar", variant: "destructive" }); return; }
    try {
      await ackMut.mutateAsync({ id: detail.id, signature: ackSig, note: ackNote });
      toast({ title: "Ciência registrada" });
      setAckOpen(false); setAckSig(null); setAckNote("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const doRefuse = async () => {
    if (!detail) return;
    const reason = prompt("Motivo da recusa (opcional):") ?? "";
    if (!confirm("Registrar recusa de ciência?")) return;
    await refuseMut.mutateAsync({ id: detail.id, reason });
    toast({ title: "Recusa registrada" });
  };

  const doRevoke = async () => {
    if (!detail) return;
    const reason = prompt("Motivo da revogação:");
    if (!reason) return;
    try {
      await revokeMut.mutateAsync({ id: detail.id, reason });
      toast({ title: "Advertência revogada" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const doDelete = async () => {
    if (!detail) return;
    if (!confirm("Excluir esta advertência? Só é possível enquanto pendente de ciência.")) return;
    try {
      await deleteMut.mutateAsync(detail.id);
      toast({ title: "Excluída" });
      setDetailId(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const doPrint = () => window.print();

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-6 h-6" /> Advertências e Medidas Disciplinares
            </h1>
            <p className="text-sm text-muted-foreground">
              Registro formal de advertências, suspensões e justa causa com ciência assinada pelo colaborador.
            </p>
          </div>
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova Advertência
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: "Pendentes de ciência", v: kpis.pendentes, i: FileSignature },
            { l: "Emitidas no mês", v: kpis.mes, i: AlertTriangle },
            { l: "Suspensões ativas", v: kpis.suspensoes, i: Ban },
            { l: "Total", v: kpis.total, i: ShieldAlert },
          ].map((k) => (
            <Card key={k.l}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{k.l}</p>
                  <p className="text-2xl font-bold">{k.v}</p>
                </div>
                <k.i className="w-6 h-6 text-primary/60" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle>Histórico disciplinar</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={empFilter || "all"} onValueChange={(v) => setEmpFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Colaborador" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos colaboradores</SelectItem>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={typeFilter || "all"} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
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
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma advertência registrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Emitida em</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((w: any) => (
                    <TableRow key={w.id} className="cursor-pointer" onClick={() => setDetailId(w.id)}>
                      <TableCell className="font-medium">
                        {w.employee_name || "—"}
                        <div className="text-xs text-muted-foreground">{w.employee_position || ""}</div>
                      </TableCell>
                      <TableCell><Badge className={TYPE_COLOR[w.type]}>{TYPE_LABEL[w.type]}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate">{w.reason}</TableCell>
                      <TableCell>{fmtDate(w.issued_date)}</TableCell>
                      <TableCell><Badge className={STATUS_COLOR[w.status]}>{STATUS_LABEL[w.status]}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nova advertência */}
      <Dialog open={openNew} onOpenChange={(o) => { setOpenNew(o); if (!o) setForm(emptyForm); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Advertência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label>Colaborador *</Label>
                <Select value={form.employee_id || "none"} onValueChange={(v) => setForm({ ...form, employee_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de emissão</Label>
                <Input type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} />
              </div>
              <div>
                <Label>Data do incidente</Label>
                <Input type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} />
              </div>
              {form.type === "suspensao" && (
                <>
                  <div>
                    <Label>Dias de suspensão *</Label>
                    <Input type="number" min={1} max={30} value={form.suspension_days}
                      onChange={(e) => setForm({ ...form, suspension_days: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Início da suspensão</Label>
                    <Input type="date" value={form.suspension_start_date}
                      onChange={(e) => setForm({ ...form, suspension_start_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Fim da suspensão</Label>
                    <Input type="date" value={form.suspension_end_date}
                      onChange={(e) => setForm({ ...form, suspension_end_date: e.target.value })} />
                  </div>
                </>
              )}
              <div className="col-span-2">
                <Label>Motivo (resumo) *</Label>
                <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Ex.: Atraso reiterado, ausência sem justificativa..." />
              </div>
              <div className="col-span-2">
                <Label>Descrição detalhada dos fatos</Label>
                <Textarea rows={4} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descreva com precisão os fatos, datas, horários e circunstâncias..." />
              </div>
              <div>
                <Label>Testemunha (nome)</Label>
                <Input value={form.witness_name} onChange={(e) => setForm({ ...form, witness_name: e.target.value })} />
              </div>
              <div>
                <Label>Testemunha (CPF/RG)</Label>
                <Input value={form.witness_document} onChange={(e) => setForm({ ...form, witness_document: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar advertência
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
                    <ShieldAlert className="w-5 h-5" /> {TYPE_LABEL[detail.type]}
                  </span>
                  <Badge className={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="info">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="info">Detalhes</TabsTrigger>
                  <TabsTrigger value="ciencia">Ciência</TabsTrigger>
                  <TabsTrigger value="termo">Termo</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-3 mt-4 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground">Colaborador:</span> <b>{detail.employee_name}</b></div>
                    <div><span className="text-muted-foreground">Matrícula:</span> {detail.employee_registration || "—"}</div>
                    <div><span className="text-muted-foreground">Cargo:</span> {detail.employee_position || "—"}</div>
                    <div><span className="text-muted-foreground">CPF:</span> {detail.employee_cpf || "—"}</div>
                    <div><span className="text-muted-foreground">Emitida em:</span> {fmtDate(detail.issued_date)}</div>
                    <div><span className="text-muted-foreground">Incidente em:</span> {fmtDate(detail.incident_date)}</div>
                    {detail.type === "suspensao" && (
                      <>
                        <div><span className="text-muted-foreground">Suspensão:</span> {detail.suspension_days} dias</div>
                        <div><span className="text-muted-foreground">Período:</span> {fmtDate(detail.suspension_start_date)} — {fmtDate(detail.suspension_end_date)}</div>
                      </>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Motivo</Label>
                    <p className="p-2 bg-muted rounded">{detail.reason}</p>
                  </div>
                  {detail.description && (
                    <div>
                      <Label className="text-xs">Descrição</Label>
                      <p className="p-2 bg-muted rounded whitespace-pre-wrap">{detail.description}</p>
                    </div>
                  )}
                  {(detail.witness_name || detail.witness_document) && (
                    <div className="text-xs text-muted-foreground">
                      Testemunha: {detail.witness_name || "—"} {detail.witness_document ? `(${detail.witness_document})` : ""}
                    </div>
                  )}
                  {detail.status === "revogada" && (
                    <div className="p-2 border border-red-300 bg-red-50 rounded text-xs">
                      <b>Revogada em {fmtDateTime(detail.revoked_at)}:</b> {detail.revoked_reason}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ciencia" className="space-y-3 mt-4">
                  {detail.status === "dada_ciencia" ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-medium">Ciência dada em {fmtDateTime(detail.acknowledged_at)}</span>
                      </div>
                      {detail.acknowledged_ip && (
                        <p className="text-xs text-muted-foreground">IP: {detail.acknowledged_ip}</p>
                      )}
                      {detail.acknowledged_note && (
                        <p className="text-sm p-2 bg-muted rounded">{detail.acknowledged_note}</p>
                      )}
                      {detail.acknowledged_signature && (
                        <div>
                          <Label className="text-xs">Assinatura</Label>
                          <img src={detail.acknowledged_signature} alt="Assinatura" className="border rounded bg-white max-h-40" />
                        </div>
                      )}
                    </div>
                  ) : detail.status === "recusada" ? (
                    <div className="p-3 border border-red-300 bg-red-50 rounded">
                      <div className="flex items-center gap-2 text-red-700 font-medium">
                        <XCircle className="w-5 h-5" /> Ciência recusada em {fmtDateTime(detail.refused_at)}
                      </div>
                      {detail.refused_reason && <p className="text-sm mt-1">{detail.refused_reason}</p>}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        O colaborador deve dar ciência assinando digitalmente. A assinatura ficará vinculada ao registro com data, hora e IP.
                      </p>
                      <div className="flex gap-2">
                        <Button onClick={() => setAckOpen(true)} disabled={detail.status !== "pendente_ciencia"}>
                          <FileSignature className="w-4 h-4 mr-2" /> Registrar ciência (assinatura)
                        </Button>
                        <Button variant="outline" onClick={doRefuse} disabled={detail.status !== "pendente_ciencia"}>
                          <XCircle className="w-4 h-4 mr-2" /> Registrar recusa
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="termo" className="mt-4">
                  <div id="warning-termo" className="p-6 border rounded bg-white text-sm space-y-3 text-black">
                    <h2 className="text-lg font-bold text-center uppercase">Termo de {TYPE_LABEL[detail.type]}</h2>
                    <p>Ao(À) Sr(a). <b>{detail.employee_name}</b>, portador(a) do CPF <b>{detail.employee_cpf || "—"}</b>,
                      matrícula <b>{detail.employee_registration || "—"}</b>, ocupante do cargo de <b>{detail.employee_position || "—"}</b>.</p>
                    <p>Comunicamos que, nos termos do Art. 482 da CLT, fica aplicada a presente medida disciplinar em razão dos seguintes fatos:</p>
                    <p><b>Motivo:</b> {detail.reason}</p>
                    {detail.description && <p><b>Descrição:</b> {detail.description}</p>}
                    {detail.incident_date && <p><b>Data do incidente:</b> {fmtDate(detail.incident_date)}</p>}
                    {detail.type === "suspensao" && (
                      <p><b>Suspensão de {detail.suspension_days} dia(s)</b>, período: {fmtDate(detail.suspension_start_date)} a {fmtDate(detail.suspension_end_date)}.</p>
                    )}
                    <p>A reincidência poderá ensejar penalidade mais severa, inclusive rescisão contratual por justa causa.</p>
                    <p className="mt-4">Emitida em: {fmtDate(detail.issued_date)}</p>
                    <div className="grid grid-cols-2 gap-6 mt-8">
                      <div className="text-center">
                        <div className="border-t border-black pt-1">Empregador</div>
                      </div>
                      <div className="text-center">
                        {detail.acknowledged_signature ? (
                          <img src={detail.acknowledged_signature} alt="Assinatura" className="mx-auto max-h-20" />
                        ) : <div className="h-20" />}
                        <div className="border-t border-black pt-1">Empregado (ciência)</div>
                        {detail.acknowledged_at && (
                          <div className="text-xs mt-1">Ciência em {fmtDateTime(detail.acknowledged_at)}</div>
                        )}
                      </div>
                    </div>
                    {(detail.witness_name) && (
                      <div className="mt-6 text-center">
                        <div className="border-t border-black pt-1 inline-block px-8">
                          Testemunha: {detail.witness_name} {detail.witness_document ? `— ${detail.witness_document}` : ""}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end mt-3">
                    <Button variant="outline" onClick={doPrint}><Printer className="w-4 h-4 mr-2" /> Imprimir</Button>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex-wrap gap-2">
                {detail.status === "pendente_ciencia" && (
                  <Button variant="destructive" onClick={doDelete}>
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                  </Button>
                )}
                {["dada_ciencia", "recusada", "pendente_ciencia"].includes(detail.status) && (
                  <Button variant="outline" onClick={doRevoke}>
                    <Ban className="w-4 h-4 mr-2" /> Revogar
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

      {/* Modal de ciência (assinatura) */}
      <Dialog open={ackOpen} onOpenChange={(o) => { setAckOpen(o); if (!o) { setAckSig(null); setAckNote(""); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Registrar ciência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ao assinar, o colaborador declara estar ciente do teor desta advertência. Assinatura, data, hora e IP serão armazenados.
            </p>
            <SignaturePad onChange={setAckSig} />
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea rows={2} value={ackNote} onChange={(e) => setAckNote(e.target.value)}
                placeholder="Ex.: Assinado na presença do gestor..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAckOpen(false)}>Cancelar</Button>
            <Button onClick={doAck} disabled={ackMut.isPending || !ackSig}>
              {ackMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar ciência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
