import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Bell, ScanLine, Camera, RefreshCw, Check, Trash2, AlertTriangle, Package, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  useSRAISummary, useSRAlerts, useSRResolveAlert, useSRDeleteAlert, useSRScanAlerts,
  useSRAnalyses, useSROcrBatchExpiry, useSRShelfAnalysis,
} from "@/hooks/use-smartroute-ai";

const SEVERITY: Record<string, { label: string; class: string }> = {
  critical: { label: "Crítico", class: "bg-red-100 text-red-800 border-red-200" },
  high: { label: "Alto", class: "bg-orange-100 text-orange-800 border-orange-200" },
  medium: { label: "Médio", class: "bg-amber-100 text-amber-800 border-amber-200" },
  info: { label: "Info", class: "bg-sky-100 text-sky-800 border-sky-200" },
  low: { label: "Baixo", class: "bg-slate-100 text-slate-700 border-slate-200" },
};

async function fileToBase64(file: File): Promise<{ b64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = String(r.result || "");
      const [, b64] = dataUrl.split(",");
      resolve({ b64, mime: file.type || "image/jpeg" });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function SmartRouteIA() {
  const { data: summary } = useSRAISummary();
  const { data: alerts = [] } = useSRAlerts({ resolved: "false" });
  const resolveAlert = useSRResolveAlert();
  const delAlert = useSRDeleteAlert();
  const scan = useSRScanAlerts();

  const { data: ocrList = [] } = useSRAnalyses("batch_expiry");
  const { data: shelfList = [] } = useSRAnalyses("shelf");
  const ocr = useSROcrBatchExpiry();
  const shelf = useSRShelfAnalysis();

  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [shelfFile, setShelfFile] = useState<File | null>(null);
  const [expected, setExpected] = useState("");

  const runOcr = async () => {
    if (!ocrFile) return toast.error("Envie uma imagem");
    try {
      const { b64, mime } = await fileToBase64(ocrFile);
      const r = await ocr.mutateAsync({ image_base64: b64, mime_type: mime });
      toast.success("Lote/validade analisados", { description: r.result?.batch ? `Lote ${r.result.batch}` : "Sem lote legível" });
      setOcrFile(null);
    } catch (e: any) { toast.error(e.message); }
  };
  const runShelf = async () => {
    if (!shelfFile) return toast.error("Envie uma imagem da gôndola");
    try {
      const { b64, mime } = await fileToBase64(shelfFile);
      const brands = expected.split(",").map((s) => s.trim()).filter(Boolean);
      const r = await shelf.mutateAsync({ image_base64: b64, mime_type: mime, expected_brands: brands });
      toast.success("Gôndola analisada", { description: `${r.result?.fill_percent ?? "?"}% ocupação` });
      setShelfFile(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const bySev = Object.fromEntries((summary?.alerts_by_severity || []).map((r: any) => [r.severity, r.n]));

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-primary" /> IA & Alertas</h1>
            <p className="text-sm text-muted-foreground">OCR de lote/validade, análise de gôndola e alertas operacionais automáticos.</p>
          </div>
          <Button onClick={() => scan.mutate(undefined, { onSuccess: (r: any) => toast.success(`Scan concluído — ${r.generated || 0} alertas gerados`) })} disabled={scan.isPending}>
            <RefreshCw className={`w-4 h-4 mr-2 ${scan.isPending ? "animate-spin" : ""}`} /> Rodar scan de alertas
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Alertas críticos</div>
            <div className="text-3xl font-bold text-red-600">{bySev.critical || 0}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Alertas altos</div>
            <div className="text-3xl font-bold text-orange-600">{bySev.high || 0}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Produtos vencendo (30d)</div>
            <div className="text-3xl font-bold text-amber-600">{summary?.products_expiring_soon || 0}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Análises IA (30d)</div>
            <div className="text-3xl font-bold">{(summary?.analyses_by_kind || []).reduce((s: number, r: any) => s + r.n, 0)}</div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="alerts">
          <TabsList>
            <TabsTrigger value="alerts"><Bell className="w-4 h-4 mr-1" /> Alertas</TabsTrigger>
            <TabsTrigger value="ocr"><ScanLine className="w-4 h-4 mr-1" /> Lote & Validade</TabsTrigger>
            <TabsTrigger value="shelf"><Camera className="w-4 h-4 mr-1" /> Gôndola</TabsTrigger>
          </TabsList>

          {/* ALERTS */}
          <TabsContent value="alerts">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Severidade</TableHead><TableHead>Tipo</TableHead><TableHead>Título</TableHead>
                  <TableHead>Mensagem</TableHead><TableHead>Quando</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {alerts.map((a: any) => {
                    const s = SEVERITY[a.severity] || SEVERITY.info;
                    return (
                      <TableRow key={a.id}>
                        <TableCell><Badge variant="outline" className={s.class}>{s.label}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{a.type}</TableCell>
                        <TableCell className="font-medium">{a.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-md">{a.message}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(a.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="icon" variant="ghost" title="Resolver" onClick={() => resolveAlert.mutate(a.id)}><Check className="w-4 h-4 text-emerald-600" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => delAlert.mutate(a.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!alerts.length && (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" /> Nenhum alerta ativo.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* OCR LOTE/VALIDADE */}
          <TabsContent value="ocr">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> Analisar rótulo</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Input type="file" accept="image/*" onChange={(e) => setOcrFile(e.target.files?.[0] || null)} />
                  <Button onClick={runOcr} disabled={!ocrFile || ocr.isPending} className="w-full">
                    {ocr.isPending ? "Analisando..." : "Extrair lote e validade"}
                  </Button>
                  <p className="text-xs text-muted-foreground">Envie foto nítida do rótulo. A IA identifica lote, validade e emite alerta para vencimentos próximos.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Últimas análises</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Lote</TableHead><TableHead>Validade</TableHead><TableHead>Dias</TableHead><TableHead>Confiança</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {ocrList.map((a: any) => {
                          const d = a.result?.days_to_expiry;
                          const cls = d == null ? "" : d < 0 ? "text-red-600 font-bold" : d <= 15 ? "text-orange-600 font-semibold" : d <= 30 ? "text-amber-600" : "text-emerald-600";
                          return (
                            <TableRow key={a.id}>
                              <TableCell className="font-mono text-xs">{a.result?.batch || "—"}</TableCell>
                              <TableCell>{a.result?.expiry_date || "—"}</TableCell>
                              <TableCell className={cls}>{d ?? "—"}</TableCell>
                              <TableCell>{a.confidence ? Math.round(a.confidence * 100) + "%" : "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                        {!ocrList.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma análise.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* GONDOLA */}
          <TabsContent value="shelf">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> Analisar gôndola</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Marcas esperadas (separadas por vírgula)</Label>
                    <Textarea value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Anatriello, MarcaX, MarcaY" rows={2} />
                  </div>
                  <Input type="file" accept="image/*" onChange={(e) => setShelfFile(e.target.files?.[0] || null)} />
                  <Button onClick={runShelf} disabled={!shelfFile || shelf.isPending} className="w-full">
                    {shelf.isPending ? "Analisando..." : "Analisar gôndola"}
                  </Button>
                  <p className="text-xs text-muted-foreground">Detecta ocupação, rupturas, marcas presentes/ausentes e organização.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Últimas análises</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Ocupação</TableHead><TableHead>Ruptura</TableHead><TableHead>Planograma</TableHead><TableHead>Resumo</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {shelfList.map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-semibold">{a.result?.fill_percent ?? "—"}%</TableCell>
                            <TableCell>{a.result?.out_of_stock ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}</TableCell>
                            <TableCell>{a.result?.planogram_score ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{a.result?.summary}</TableCell>
                          </TableRow>
                        ))}
                        {!shelfList.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma análise.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
