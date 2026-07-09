// SmartRoute — Onda 4: Ocorrências & SLA
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, Clock, RefreshCw, ShieldCheck, ShieldAlert, Timer,
  CheckCircle2, XCircle, Filter, Search, MessageSquare, Plus, Trash2, Pencil,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useOccurrences, useOccurrence, useUpdateOccurrence, useAddOccurrenceComment,
  useRefreshSLA, useSLAMetrics, useOccurrenceTypes, useSaveOccurrenceType, useDeleteOccurrenceType,
  type OccStatus,
} from "@/hooks/use-smartroute-occurrences";

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta", em_analise: "Em análise", resolvida: "Resolvida", descartada: "Descartada",
};
const STATUS_COLOR: Record<string, string> = {
  aberta: "bg-amber-100 text-amber-800",
  em_analise: "bg-blue-100 text-blue-800",
  resolvida: "bg-emerald-100 text-emerald-800",
  descartada: "bg-slate-200 text-slate-700",
};
const SEV_COLOR: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

function fmtMin(min?: number) {
  if (min == null) return "—";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  return `${h}h${(min % 60).toString().padStart(2, "0")}`;
}
function fmtSec(sec?: number) { return fmtMin(sec == null ? undefined : Math.round(sec / 60)); }
function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const KPI = ({ icon: Icon, label, value, tone = "default", hint }: any) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        tone === "green" ? "bg-emerald-100 text-emerald-700"
        : tone === "amber" ? "bg-amber-100 text-amber-700"
        : tone === "red" ? "bg-red-100 text-red-700"
        : "bg-blue-100 text-blue-700"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="text-2xl font-bold">{value ?? 0}</div>
        {hint && <div className="text-xs text-muted-foreground truncate">{hint}</div>}
      </div>
    </CardContent>
  </Card>
);

// ---------- Ocorrências (tab) ----------
function OcorrenciasTab() {
  const [filters, setFilters] = useState<any>({ status: "", severity: "", sla: "", q: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: rows = [], isLoading, refetch } = useOccurrences(filters);
  const { data: types = [] } = useOccurrenceTypes();
  const refreshSLA = useRefreshSLA();

  const setF = (k: string, v: any) => setFilters((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="PDV, descrição..." value={filters.q}
                onChange={(e) => setF("q", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={filters.status || "all"} onValueChange={(v) => setF("status", v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="resolvida">Resolvida</SelectItem>
                <SelectItem value="descartada">Descartada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Severidade</Label>
            <Select value={filters.severity || "all"} onValueChange={(v) => setF("severity", v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={filters.type || "all"} onValueChange={(v) => setF("type", v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {types.map((t: any) => (
                  <SelectItem key={t.id} value={t.code}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">SLA</Label>
            <Select value={filters.sla || "all"} onValueChange={(v) => setF("sla", v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="in_sla">Dentro do SLA</SelectItem>
                <SelectItem value="breached">SLA estourado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{rows.length} ocorrência(s)</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={async () => {
            const r: any = await refreshSLA.mutateAsync();
            toast.success(`${r.updated || 0} ocorrência(s) marcadas com SLA vencido`);
          }}>
            <Timer className="w-4 h-4 mr-1" /> Recalcular SLA
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>PDV</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Idade</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Nenhuma ocorrência</TableCell></TableRow>
              )}
              {rows.map((o: any) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelectedId(o.id)}>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDate(o.created_at)}</TableCell>
                  <TableCell className="text-sm">{types.find((t: any) => t.code === o.type)?.label || o.type}</TableCell>
                  <TableCell className="text-sm">{o.pdv_name || "—"} <span className="text-xs text-muted-foreground">{o.pdv_city}</span></TableCell>
                  <TableCell className="text-sm">{o.driver_name || "—"}</TableCell>
                  <TableCell><Badge className={SEV_COLOR[o.severity] || ""}>{o.severity}</Badge></TableCell>
                  <TableCell><Badge className={STATUS_COLOR[o.status] || ""}>{STATUS_LABEL[o.status] || o.status}</Badge></TableCell>
                  <TableCell>
                    {o.sla_breached_now
                      ? <Badge className="bg-red-100 text-red-800"><ShieldAlert className="w-3 h-3 mr-1" />Vencido</Badge>
                      : o.sla_target_min
                        ? <Badge variant="outline"><ShieldCheck className="w-3 h-3 mr-1" />{fmtMin(o.sla_target_min)}</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">{fmtMin(o.age_min)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(o.id); }}>Abrir</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <OccurrenceDrawer id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function OccurrenceDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = useOccurrence(id || undefined);
  const upd = useUpdateOccurrence();
  const addCmt = useAddOccurrenceComment();
  const [status, setStatus] = useState<OccStatus | "">("");
  const [severity, setSeverity] = useState<string>("");
  const [resolution, setResolution] = useState("");
  const [comment, setComment] = useState("");

  const occ = data?.occurrence;
  const media = data?.media || [];
  const comments = data?.comments || [];

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Ocorrência {occ?.code || occ?.type}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !occ ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Aberta em</div>{fmtDate(occ.created_at)}</div>
              <div><div className="text-xs text-muted-foreground">Motorista</div>{occ.driver_name || "—"}</div>
              <div><div className="text-xs text-muted-foreground">Rota</div>{occ.route_code || "—"}</div>
              <div><div className="text-xs text-muted-foreground">PDV</div>{occ.pdv_name || "—"}</div>
              <div><div className="text-xs text-muted-foreground">Status atual</div><Badge className={STATUS_COLOR[occ.status]}>{STATUS_LABEL[occ.status]}</Badge></div>
              <div><div className="text-xs text-muted-foreground">Severidade</div><Badge className={SEV_COLOR[occ.severity]}>{occ.severity}</Badge></div>
              <div><div className="text-xs text-muted-foreground">SLA</div>{fmtMin(occ.sla_target_min)}</div>
              <div><div className="text-xs text-muted-foreground">Prazo</div>{fmtDate(occ.sla_deadline_at)}</div>
            </div>

            {occ.description && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Descrição do motorista</div>
                <div className="p-3 rounded bg-muted text-sm whitespace-pre-wrap">{occ.description}</div>
              </div>
            )}

            {media.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-2">Evidências ({media.length})</div>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {media.slice(0, 8).map((m: any) => (
                    <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block">
                      <img src={m.url} alt={m.kind} className="w-full h-24 object-cover rounded border" />
                      <div className="text-[10px] text-muted-foreground mt-1">{m.kind}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Alterar status</Label>
                <Select value={status || occ.status} onValueChange={(v) => setStatus(v as OccStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberta">Aberta</SelectItem>
                    <SelectItem value="em_analise">Em análise</SelectItem>
                    <SelectItem value="resolvida">Resolvida</SelectItem>
                    <SelectItem value="descartada">Descartada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Severidade</Label>
                <Select value={severity || occ.severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Resolução (obrigatório ao resolver)</Label>
                <Input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Como foi resolvido?" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Comentário / follow-up</Label>
              <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Notas internas" />
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Histórico ({comments.length})
              </div>
              <ScrollArea className="h-40 border rounded">
                <div className="p-2 space-y-2">
                  {comments.length === 0 && <div className="text-xs text-muted-foreground p-2">Sem comentários</div>}
                  {comments.map((c: any) => (
                    <div key={c.id} className="text-sm p-2 rounded bg-muted">
                      <div className="text-xs text-muted-foreground">{c.author_name} · {fmtDate(c.created_at)}</div>
                      <div className="whitespace-pre-wrap">{c.body}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {occ.resolved_at && (
              <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-sm">
                <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Resolvida em {fmtDate(occ.resolved_at)}</div>
                {occ.resolution && <div className="mt-1 text-emerald-900">{occ.resolution}</div>}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button
            disabled={!occ || upd.isPending}
            onClick={async () => {
              const finalStatus = (status || occ!.status) as OccStatus;
              if ((finalStatus === "resolvida") && !resolution) {
                toast.error("Informe a resolução antes de marcar como resolvida");
                return;
              }
              await upd.mutateAsync({
                id: occ!.id, status: finalStatus,
                severity: severity || undefined,
                resolution: resolution || undefined,
              });
              if (comment) await addCmt.mutateAsync({ id: occ!.id, body: comment });
              toast.success("Ocorrência atualizada");
              setComment(""); setResolution("");
            }}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- SLA (tab) ----------
function SLATab() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useSLAMetrics(days);
  const t = data?.totals || {};
  const stage = data?.stage_avg || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Métricas dos últimos <b>{days}</b> dias</div>
        <div className="w-40">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPI icon={AlertTriangle} label="Total" value={t.total || 0} />
        <KPI icon={Clock} label="Abertas" value={t.abertas || 0} tone="amber" />
        <KPI icon={CheckCircle2} label="Resolvidas" value={t.resolvidas || 0} tone="green" />
        <KPI icon={XCircle} label="Descartadas" value={t.descartadas || 0} />
        <KPI icon={ShieldAlert} label="SLA vencido" value={t.breached || 0} tone="red" />
        <KPI icon={ShieldCheck} label="SLA compliance" value={`${t.sla_compliance_pct ?? 100}%`} tone="green" hint={`MTTR ${fmtMin(data?.mttr_min || 0)}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Etapa média — chegada → check-in</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{fmtSec(stage.avg_arrival_to_checkin_sec)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Etapa média — atendimento</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{fmtSec(stage.avg_service_sec)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Tempo médio total por parada</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{fmtSec(stage.avg_total_sec)}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top tipos de ocorrência</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Tipo</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Vencidas</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(data?.top_types || []).map((t: any) => (
                  <TableRow key={t.type}>
                    <TableCell>{t.label}</TableCell>
                    <TableCell className="text-right">{t.n}</TableCell>
                    <TableCell className="text-right">{t.breached}</TableCell>
                  </TableRow>
                ))}
                {(!data?.top_types?.length) && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sem dados</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Motoristas com mais ocorrências</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Motorista</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Vencidas</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(data?.top_drivers || []).map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.full_name}</TableCell>
                    <TableCell className="text-right">{d.n}</TableCell>
                    <TableCell className="text-right">{d.breached}</TableCell>
                  </TableRow>
                ))}
                {(!data?.top_drivers?.length) && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sem dados</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Tendência diária</CardTitle></CardHeader>
        <CardContent>
          {(!data?.trend?.length) ? (
            <div className="text-sm text-muted-foreground text-center py-4">Sem dados</div>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {data.trend.map((p: any) => {
                const max = Math.max(...data.trend.map((x: any) => x.n), 1);
                const h = Math.round((p.n / max) * 100);
                const bh = Math.round((p.breached / max) * 100);
                return (
                  <div key={p.d} className="flex-1 flex flex-col items-center gap-1" title={`${p.d}: ${p.n} (${p.breached} vencidas)`}>
                    <div className="w-full bg-blue-200 rounded-t relative" style={{ height: `${h}%` }}>
                      <div className="absolute bottom-0 left-0 right-0 bg-red-500 rounded-t" style={{ height: `${bh}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-200 inline-block rounded" /> Total</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 inline-block rounded" /> SLA vencido</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Catálogo de tipos (tab) ----------
function CatalogoTab() {
  const { data: types = [], isLoading } = useOccurrenceTypes();
  const save = useSaveOccurrenceType();
  const del = useDeleteOccurrenceType();
  const [editing, setEditing] = useState<any | null>(null);

  const empty = {
    code: "", label: "", description: "", severity: "medium",
    sla_target_min: 60, require_photo: true, require_description: true,
    blocks_checkout: false, color: "#f59e0b", active: true,
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">Configure tipos, SLA e obrigatoriedades usadas no app do entregador.</div>
        <Button onClick={() => setEditing(empty)}><Plus className="w-4 h-4 mr-1" /> Novo tipo</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Foto</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Bloqueia checkout</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {types.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.code}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: t.color }} />
                      {t.label}
                    </span>
                  </TableCell>
                  <TableCell><Badge className={SEV_COLOR[t.severity]}>{t.severity}</Badge></TableCell>
                  <TableCell>{fmtMin(t.sla_target_min)}</TableCell>
                  <TableCell>{t.require_photo ? "Sim" : "Não"}</TableCell>
                  <TableCell>{t.require_description ? "Sim" : "Não"}</TableCell>
                  <TableCell>{t.blocks_checkout ? "Sim" : "Não"}</TableCell>
                  <TableCell>{t.active ? <Badge className="bg-emerald-100 text-emerald-800">ativo</Badge> : <Badge variant="outline">inativo</Badge>}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      if (!confirm(`Desativar "${t.label}"?`)) return;
                      await del.mutateAsync(t.id);
                      toast.success("Tipo desativado");
                    }}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar tipo" : "Novo tipo de ocorrência"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Código</Label>
                  <Input value={editing.code} disabled={!!editing.id}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value.toLowerCase().replace(/\s+/g, "_") })} />
                </div>
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Severidade padrão</Label>
                  <Select value={editing.severity} onValueChange={(v) => setEditing({ ...editing, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">SLA (min)</Label>
                  <Input type="number" value={editing.sla_target_min} onChange={(e) => setEditing({ ...editing, sla_target_min: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Cor</Label>
                  <Input type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.require_photo} onCheckedChange={(v) => setEditing({ ...editing, require_photo: v })} />
                  Exigir foto ao registrar
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.require_description} onCheckedChange={(v) => setEditing({ ...editing, require_description: v })} />
                  Exigir descrição
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.blocks_checkout} onCheckedChange={(v) => setEditing({ ...editing, blocks_checkout: v })} />
                  Bloqueia checkout da parada
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                  Ativo
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={!editing?.code || !editing?.label || save.isPending}
              onClick={async () => {
                await save.mutateAsync(editing);
                toast.success("Tipo salvo");
                setEditing(null);
              }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Página ----------
export default function SmartRouteOcorrencias() {
  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600" /> Ocorrências & SLA
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie ocorrências das rotas, prazos de resolução e catálogo de tipos.</p>
        </div>
        <Tabs defaultValue="lista">
          <TabsList>
            <TabsTrigger value="lista"><Filter className="w-4 h-4 mr-1" /> Ocorrências</TabsTrigger>
            <TabsTrigger value="sla"><Timer className="w-4 h-4 mr-1" /> SLA & KPIs</TabsTrigger>
            <TabsTrigger value="catalogo"><ShieldCheck className="w-4 h-4 mr-1" /> Catálogo</TabsTrigger>
          </TabsList>
          <TabsContent value="lista"><OcorrenciasTab /></TabsContent>
          <TabsContent value="sla"><SLATab /></TabsContent>
          <TabsContent value="catalogo"><CatalogoTab /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
