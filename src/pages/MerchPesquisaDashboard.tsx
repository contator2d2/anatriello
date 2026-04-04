import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useBrands } from "@/hooks/use-merchandising";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  usePriceResearchDashboard, usePriceResearchExecutions, usePriceHistory,
} from "@/hooks/use-price-research";
import {
  BarChart3, DollarSign, Store, Building2, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { format } from "date-fns";

export default function MerchPesquisaDashboard() {
  const [tab, setTab] = useState('overview');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: brands = [] } = useBrands();
  const { data: dashboard } = usePriceResearchDashboard({
    brand_id: selectedBrandId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });
  const { data: executions = [] } = usePriceResearchExecutions({
    brand_id: selectedBrandId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });
  const { data: pdvs = [] } = useQuery({
    queryKey: ['rh-pdvs-list'],
    queryFn: () => api<any[]>('/api/promotor/rh/pdvs'),
  });

  const stats = dashboard?.stats || {};
  const avgPrices = dashboard?.avgPrices || [];

  const statusCards = [
    { label: 'Pendentes', value: stats.pending || 0, icon: Clock, color: 'text-yellow-500' },
    { label: 'Concluídas', value: stats.completed || 0, icon: CheckCircle2, color: 'text-green-500' },
    { label: 'Prorrogadas', value: stats.postponed || 0, icon: AlertCircle, color: 'text-orange-500' },
    { label: 'Vencidas', value: stats.expired || 0, icon: AlertCircle, color: 'text-destructive' },
  ];

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Dashboard Pesquisa de Preços
          </h1>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Todas as marcas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" placeholder="Data início" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" placeholder="Data fim" />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statusCards.map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="executions">Pesquisas</TabsTrigger>
            <TabsTrigger value="prices">Preços Médios</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {avgPrices.length > 0 ? (
              <Card>
                <CardHeader><CardTitle className="text-sm">Preço Médio por Produto</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={avgPrices}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="product_name" fontSize={11} angle={-20} textAnchor="end" height={60} />
                        <YAxis />
                        <Tooltip formatter={(v: any) => `R$ ${Number(v).toFixed(2)}`} />
                        <Bar dataKey="avg_price" fill="hsl(var(--primary))" name="Média" radius={[4,4,0,0]} />
                        <Bar dataKey="min_price" fill="hsl(var(--muted-foreground))" name="Mínimo" radius={[4,4,0,0]} />
                        <Bar dataKey="max_price" fill="hsl(var(--accent))" name="Máximo" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Sem dados de preços disponíveis</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="executions">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>PDV</TableHead>
                      <TableHead>Promotor</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.created_at ? format(new Date(e.created_at), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell>{e.brand_name}</TableCell>
                        <TableCell>{e.pdv_name}</TableCell>
                        <TableCell>{e.promoter_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${e.progress_pct || 0}%` }} />
                            </div>
                            <span className="text-xs">{e.progress_pct || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={e.status === 'completed' ? 'default' : e.status === 'in_progress' ? 'secondary' : 'outline'}>
                            {e.status === 'completed' ? 'Concluída' : e.status === 'in_progress' ? 'Em andamento' : e.status === 'postponed' ? 'Prorrogada' : 'Pendente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {executions.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma pesquisa encontrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prices">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Preço Médio</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="text-right">Máximo</TableHead>
                      <TableHead className="text-right">Coletas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {avgPrices.map((p: any) => (
                      <TableRow key={p.product_id}>
                        <TableCell className="font-medium">{p.product_name}</TableCell>
                        <TableCell className="text-right">R$ {Number(p.avg_price).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-green-600">R$ {Number(p.min_price).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-red-600">R$ {Number(p.max_price).toFixed(2)}</TableCell>
                        <TableCell className="text-right"><Badge variant="secondary">{p.collections}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {avgPrices.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem dados</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
