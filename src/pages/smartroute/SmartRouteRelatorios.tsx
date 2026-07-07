import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useSRReportKpis, useSRReportTimeseries, useSRReportSlaDrivers,
  useSRReportSlaPdvs, useSRReportHeatmap, useSRReportHourly, useSRReportFailures,
} from "@/hooks/use-smartroute-ops";
import { BarChart3, TrendingUp, Truck, MapPin, Clock, AlertTriangle, Download } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function KPI({ label, value, sub, tone = "default" }: any) {
  const tones: Record<string, string> = {
    default: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub && <Badge className={`mt-2 ${tones[tone]}`} variant="secondary">{sub}</Badge>}
      </CardContent>
    </Card>
  );
}

function exportCsv(name: string, rows: any[]) {
  if (!rows?.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function SmartRouteRelatorios() {
  const today = new Date().toISOString().slice(0, 10);
  const past = new Date(); past.setDate(past.getDate() - 30);
  const [from, setFrom] = useState(past.toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const params = { from, to };

  const kpis = useSRReportKpis(params);
  const ts = useSRReportTimeseries(params);
  const sladrv = useSRReportSlaDrivers(params);
  const slapdv = useSRReportSlaPdvs(params);
  const [heatKind, setHeatKind] = useState<"delivered" | "failed">("delivered");
  const heat = useSRReportHeatmap({ ...params, kind: heatKind });
  const hourly = useSRReportHourly(params);
  const failures = useSRReportFailures(params);

  const k = kpis.data || {};
  const center = useMemo<[number, number]>(() => {
    const rows = heat.data || [];
    if (!rows.length) return [-23.5505, -46.6333];
    const lat = rows.reduce((s, r) => s + Number(r.lat), 0) / rows.length;
    const lng = rows.reduce((s, r) => s + Number(r.lng), 0) / rows.length;
    return [lat, lng];
  }, [heat.data]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Relatórios & BI</h1>
            <p className="text-sm text-muted-foreground">SLA, heatmap e indicadores operacionais.</p>
          </div>
          <div className="ml-auto flex items-end gap-2">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KPI label="SLA de entrega" value={`${(k.sla_percent ?? 0).toFixed(1)}%`} tone={k.sla_percent >= 95 ? "green" : k.sla_percent >= 85 ? "amber" : "red"} sub="metas" />
          <KPI label="Entregas OK" value={k.delivered ?? 0} tone="green" />
          <KPI label="Falhas" value={k.failed ?? 0} tone="red" />
          <KPI label="Rotas" value={k.total_routes ?? 0} />
          <KPI label="KM percorridos" value={(k.total_km ?? 0).toFixed(0)} />
          <KPI label="Tempo médio/parada" value={`${(k.avg_stop_minutes ?? 0).toFixed(0)} min`} tone="amber" />
        </div>

        <Tabs defaultValue="tendencia">
          <TabsList>
            <TabsTrigger value="tendencia"><TrendingUp className="w-4 h-4 mr-1" />Tendência</TabsTrigger>
            <TabsTrigger value="sla-motoristas"><Truck className="w-4 h-4 mr-1" />SLA por Motorista</TabsTrigger>
            <TabsTrigger value="sla-pdvs"><MapPin className="w-4 h-4 mr-1" />PDVs problemáticos</TabsTrigger>
            <TabsTrigger value="heatmap"><MapPin className="w-4 h-4 mr-1" />Heatmap</TabsTrigger>
            <TabsTrigger value="horas"><Clock className="w-4 h-4 mr-1" />Distribuição horária</TabsTrigger>
            <TabsTrigger value="falhas"><AlertTriangle className="w-4 h-4 mr-1" />Motivos de falha</TabsTrigger>
          </TabsList>

          <TabsContent value="tendencia">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Entregas e KM por dia</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportCsv("tendencia", ts.data || [])}><Download className="w-4 h-4 mr-1" />CSV</Button>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <LineChart data={ts.data || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="delivered" stroke="#10b981" name="Entregues" />
                    <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Falhas" />
                    <Line type="monotone" dataKey="km" stroke="#3b82f6" name="KM" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sla-motoristas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Desempenho por motorista</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportCsv("sla-motoristas", sladrv.data || [])}><Download className="w-4 h-4 mr-1" />CSV</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Motorista</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Entregas</TableHead>
                      <TableHead className="text-right">Falhas</TableHead>
                      <TableHead className="text-right">SLA</TableHead>
                      <TableHead className="text-right">Tempo médio/parada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(sladrv.data || []).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.full_name}</TableCell>
                        <TableCell className="text-right">{r.total}</TableCell>
                        <TableCell className="text-right text-emerald-600">{r.delivered}</TableCell>
                        <TableCell className="text-right text-red-600">{r.failed}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={r.sla_percent >= 95 ? "default" : r.sla_percent >= 85 ? "secondary" : "destructive"}>
                            {r.sla_percent != null ? `${Number(r.sla_percent).toFixed(1)}%` : "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{r.avg_stop_min != null ? `${Number(r.avg_stop_min).toFixed(0)} min` : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sla-pdvs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">PDVs com maior taxa de falha</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportCsv("sla-pdvs", slapdv.data || [])}><Download className="w-4 h-4 mr-1" />CSV</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PDV</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Falhas</TableHead>
                      <TableHead className="text-right">SLA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(slapdv.data || []).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.city}/{r.state}</TableCell>
                        <TableCell className="text-right">{r.total}</TableCell>
                        <TableCell className="text-right text-red-600">{r.failed}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={r.sla_percent >= 95 ? "default" : r.sla_percent >= 85 ? "secondary" : "destructive"}>
                            {r.sla_percent != null ? `${Number(r.sla_percent).toFixed(1)}%` : "-"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="heatmap">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Mapa de concentração ({heatKind === "delivered" ? "entregas" : "falhas"})</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant={heatKind === "delivered" ? "default" : "outline"} onClick={() => setHeatKind("delivered")}>Entregas</Button>
                  <Button size="sm" variant={heatKind === "failed" ? "default" : "outline"} onClick={() => setHeatKind("failed")}>Falhas</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-96 rounded-lg overflow-hidden">
                  <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }}>
                    <TileLayer attribution='&copy; OSM' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {(heat.data || []).map((p: any, i: number) => (
                      <CircleMarker
                        key={i}
                        center={[Number(p.lat), Number(p.lng)]}
                        radius={Math.min(6 + Number(p.weight), 30)}
                        pathOptions={{
                          color: heatKind === "failed" ? "#ef4444" : "#10b981",
                          fillColor: heatKind === "failed" ? "#ef4444" : "#10b981",
                          fillOpacity: 0.5,
                        }}
                      >
                        <Popup>{p.weight} {heatKind === "failed" ? "falhas" : "entregas"}</Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="horas">
            <Card>
              <CardHeader><CardTitle className="text-base">Distribuição por horário (Sao Paulo)</CardTitle></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <BarChart data={hourly.data || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="delivered" fill="#10b981" name="Entregues" />
                    <Bar dataKey="total" fill="#3b82f6" name="Total" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="falhas">
            <Card>
              <CardHeader><CardTitle className="text-base">Principais motivos de falha</CardTitle></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={failures.data || []} dataKey="total" nameKey="reason" outerRadius={110} label>
                      {(failures.data || []).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
