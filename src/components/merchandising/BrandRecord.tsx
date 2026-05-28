import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Route, Store, Package, Activity, AlertTriangle, 
  Download, FileSpreadsheet, Map as MapIcon, Calendar,
  ChevronRight, UserCheck, CheckCircle2, Search, X, Filter
} from "lucide-react";
import { useMerchBrandRecord } from "@/hooks/use-merch-analytics";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BrandRecordProps {
  brandId: string;
  brandName: string;
  onClose: () => void;
  dateRange: { from: string, to: string };
}

export function BrandRecord({ brandId, brandName, onClose, dateRange }: BrandRecordProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [pdvFilter, setPdvFilter] = useState("all");
  const [selectedPDV, setSelectedPDV] = useState<any>(null);
  const { data, isLoading } = useMerchBrandRecord(brandId, dateRange);

  const filteredStockouts = useMemo(() => {
    if (!data?.stockouts) return [];
    if (pdvFilter === "all") return data.stockouts;
    return data.stockouts.filter((s: any) => s.pdv_name === pdvFilter);
  }, [data?.stockouts, pdvFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const exportStockoutsCSV = () => {
    const stockoutsToExport = filteredStockouts;
    if (stockoutsToExport.length === 0) return;

    const headers = ["Data", "PDV", "Promotor", "Produto", "SKU", "Qtd Loja", "Qtd Estoque", "Motivo"];
    const csvContent = [
      headers.join(","),
      ...stockoutsToExport.map((s: any) => [
        format(new Date(s.report_date), 'dd/MM/yyyy'),
        `"${s.pdv_name}"`,
        `"${s.promoter_name}"`,
        `"${s.product_name}"`,
        `"${s.product_sku || ''}"`,
        s.qty_store,
        s.qty_stock,
        `"${s.reason || ''}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `rupturas_${brandName}_${dateRange.from}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between bg-primary/5 p-4 rounded-xl border border-primary/10">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Prontuário da Marca: {brandName}
            </h2>
            <p className="text-xs text-muted-foreground">
              Período: {format(new Date(dateRange.from), 'dd/MM')} a {format(new Date(dateRange.to), 'dd/MM')}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPIBox title="Rotas Realizadas" value={data?.summary?.completed_routes || 0} total={data?.summary?.total_routes || 0} icon={Route} color="text-blue-500" />
        <KPIBox title="PDVs Atendidos" value={data?.summary?.pdvs_served || 0} icon={Store} color="text-green-500" />
        <KPIBox title="Promotores" value={data?.summary?.promoters || 0} icon={UserCheck} color="text-purple-500" />
        <KPIBox title="Rupturas" value={data?.stockouts?.length || 0} icon={AlertTriangle} color="text-orange-500" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="overview">Geral</TabsTrigger>
          <TabsTrigger value="routes">Rotas</TabsTrigger>
          <TabsTrigger value="pdvs">PDVs</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="stockouts">Rupturas/Avarias</TabsTrigger>
          <TabsTrigger value="map">Mapa</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Produtos Auditados</CardTitle>
                <CardDescription>Resumo de execução por produto</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data?.auditedProducts?.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground">{p.completed}/{p.executions} exec</span>
                      </div>
                      <div className="flex gap-2 text-[10px]">
                        {p.total_ruptures > 0 && <span className="text-orange-600 font-semibold">{p.total_ruptures} rupturas</span>}
                        {p.total_damages > 0 && <span className="text-red-600 font-semibold">{p.total_damages} avarias</span>}
                        <span className="text-green-600 ml-auto">Estoque: {p.total_stock}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Próximos Agendamentos</CardTitle>
                <CardDescription>Futuras visitas programadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data?.scheduledRoutes?.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{r.pdv_name}</p>
                        <p className="text-[10px] text-muted-foreground">{r.promoter_name}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {format(new Date(r.visit_date), 'dd/MM')} {r.scheduled_time}
                      </Badge>
                    </div>
                  ))}
                  {(!data?.scheduledRoutes || data.scheduledRoutes.length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum agendamento futuro encontrado.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="routes" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Data</th>
                      <th className="text-left p-3 font-medium">PDV</th>
                      <th className="text-left p-3 font-medium">Promotor</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Execução</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data?.routes?.map((r: any) => (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-xs">{format(new Date(r.visit_date), 'dd/MM')}</td>
                        <td className="p-3">
                          <p className="font-medium text-xs">{r.pdv_name}</p>
                          <p className="text-[10px] text-muted-foreground">{r.pdv_city}</p>
                        </td>
                        <td className="p-3 text-xs">{r.promoter_name}</td>
                        <td className="p-3 text-xs">
                          <Badge variant={r.status === 'completed' ? 'default' : 'outline'} className="text-[10px]">
                            {r.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right text-xs">
                          {r.completed_products}/{r.total_products}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdvs" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.pdvs?.map((p: any) => (
              <Card 
                key={p.id} 
                className="hover:border-primary/30 transition-colors cursor-pointer group"
                onClick={() => setSelectedPDV(p)}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-sm truncate pr-2">{p.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">{p.visit_count} visitas</Badge>
                  </div>
                  <CardDescription className="text-[10px] truncate">{p.address}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Mix Cadastrado:</span>
                    <span className="font-semibold">{p.product_count} itens</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Última Visita:</span>
                    <span className="font-semibold">{p.last_visit ? format(new Date(p.last_visit), 'dd/MM/yyyy') : 'N/A'}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] mt-2 group-hover:text-primary">
                    Ver detalhes do PDV <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedPDV && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <Card className="w-full max-w-md animate-in zoom-in-95 duration-200">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{selectedPDV.name}</CardTitle>
                    <CardDescription className="text-xs">{selectedPDV.address}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedPDV(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Mix de Produtos</p>
                      <p className="text-lg font-bold">{selectedPDV.product_count}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Visitas no Período</p>
                      <p className="text-lg font-bold">{selectedPDV.visit_count}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs font-medium">Último Promotor</p>
                        <p className="text-[10px] text-muted-foreground">
                          {data?.routes?.find((r: any) => r.pdv_id === selectedPDV.id)?.promoter_name || 'Não identificado'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs font-medium">Próximo Agendamento</p>
                        <p className="text-[10px] text-muted-foreground">
                          {data?.scheduledRoutes?.find((r: any) => r.pdv_name === selectedPDV.name)?.visit_date 
                            ? format(new Date(data.scheduledRoutes.find((r: any) => r.pdv_name === selectedPDV.name).visit_date), 'dd/MM/yyyy')
                            : 'Nenhum agendamento futuro'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" onClick={() => setSelectedPDV(null)}>Fechar</Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Produto</th>
                      <th className="text-left p-3 font-medium">SKU</th>
                      <th className="text-right p-3 font-medium">Execuções</th>
                      <th className="text-right p-3 font-medium">Estoque Total</th>
                      <th className="text-right p-3 font-medium">Rupturas</th>
                      <th className="text-right p-3 font-medium">Avarias</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data?.auditedProducts?.map((p: any) => (
                      <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium text-xs">{p.name}</td>
                        <td className="p-3 text-xs text-muted-foreground">{p.sku}</td>
                        <td className="p-3 text-right text-xs">{p.completed}/{p.executions}</td>
                        <td className="p-3 text-right text-xs font-semibold">{p.total_stock}</td>
                        <td className="p-3 text-right text-xs">
                          <Badge variant={p.total_ruptures > 0 ? "outline" : "secondary"} className={p.total_ruptures > 0 ? "text-orange-600 border-orange-200" : ""}>
                            {p.total_ruptures}
                          </Badge>
                        </td>
                        <td className="p-3 text-right text-xs">
                          <Badge variant={p.total_damages > 0 ? "destructive" : "secondary"}>
                            {p.total_damages}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stockouts" className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={pdvFilter} onValueChange={setPdvFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Filtrar por PDV" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os PDVs</SelectItem>
                  {Array.from(new Set(data?.stockouts?.map((s: any) => s.pdv_name))).map((pdv: any) => (
                    <SelectItem key={pdv} value={pdv}>{pdv}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={exportStockoutsCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar Rupturas
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Data</th>
                      <th className="text-left p-3 font-medium">PDV</th>
                      <th className="text-left p-3 font-medium">Produto</th>
                      <th className="text-left p-3 font-medium">Motivo</th>
                      <th className="text-right p-3 font-medium">Qtd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredStockouts.map((s: any) => (
                      <tr key={s.id} className="hover:bg-muted/20">
                        <td className="p-3 text-xs">{format(new Date(s.report_date), 'dd/MM')}</td>
                        <td className="p-3 text-xs">{s.pdv_name}</td>
                        <td className="p-3">
                          <p className="font-medium text-xs">{s.product_name}</p>
                          <p className="text-[10px] text-muted-foreground">Promotor: {s.promoter_name}</p>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{s.reason}</td>
                        <td className="p-3 text-right font-medium text-xs">
                          {s.qty_store + s.qty_stock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map" className="mt-6">
          <Card>
            <CardContent className="p-0 min-h-[500px] flex flex-col md:flex-row bg-muted/20">
              <div className="flex-1 p-6 flex items-center justify-center relative border-r">
                <div className="text-center">
                  <MapIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm font-medium">Mapa de PDVs da Marca</p>
                  <p className="text-xs text-muted-foreground mt-2">Visualização geográfica dos pontos de venda atendidos.</p>
                </div>
              </div>
              <div className="w-full md:w-80 bg-background p-4 flex flex-col gap-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pontos de Venda ({data?.pdvs?.length})</h3>
                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {data?.pdvs?.map((p: any) => (
                      <div 
                        key={p.id} 
                        className="p-3 rounded-lg border bg-muted/30 hover:border-primary transition-colors cursor-pointer"
                        onClick={() => setSelectedPDV(p)}
                      >
                        <p className="text-xs font-bold truncate">{p.name}</p>
                        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                          <span>Mix: {p.product_count}</span>
                          <span>{p.visit_count} visits</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPIBox({ title, value, total, icon: Icon, color }: any) {
  return (
    <Card className="p-4 flex flex-col items-center justify-center text-center">
      <div className={cn("p-2 rounded-full bg-muted mb-2", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground font-medium mb-1">{title}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        {total !== undefined && <span className="text-xs text-muted-foreground">/ {total}</span>}
      </div>
    </Card>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
