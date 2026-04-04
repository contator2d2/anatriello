import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBrands } from "@/hooks/use-merchandising";
import {
  useBrandResults, useBrandResultDetail, usePriceResearchDashboard, usePriceResearchExecutions,
} from "@/hooks/use-price-research";
import {
  BarChart3, DollarSign, CheckCircle2, Clock, Package, Eye, FileText, TrendingUp,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

const ALL_BRANDS_VALUE = "__all_brands__";

export default function MerchPesquisaDashboard() {
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const { data: brands = [] } = useBrands();
  const { data: sharedResults = [] } = useBrandResults(selectedBrandId || undefined);
  const { data: resultDetail } = useBrandResultDetail(selectedRuleId || undefined);

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Resultados de Pesquisa de Preços
          </h1>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Select
            value={selectedBrandId || ALL_BRANDS_VALUE}
            onValueChange={v => {
              setSelectedBrandId(v === ALL_BRANDS_VALUE ? '' : v);
              setSelectedRuleId(null);
            }}
          >
            <SelectTrigger className="w-48"><SelectValue placeholder="Selecione a marca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_BRANDS_VALUE}>Todas as marcas</SelectItem>
              {brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedRuleId && resultDetail ? (
          <ResultDetailView detail={resultDetail} onBack={() => setSelectedRuleId(null)} />
        ) : (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{sharedResults.length}</p>
                    <p className="text-xs text-muted-foreground">Pesquisas Compartilhadas</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{sharedResults.reduce((s: number, r: any) => s + (parseInt(r.completed_count) || 0), 0)}</p>
                    <p className="text-xs text-muted-foreground">Concluídas</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <Clock className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{sharedResults.reduce((s: number, r: any) => s + (parseInt(r.in_progress_count) || 0), 0)}</p>
                    <p className="text-xs text-muted-foreground">Em Execução</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{sharedResults.reduce((s: number, r: any) => s + (parseInt(r.total_count) || 0), 0)}</p>
                    <p className="text-xs text-muted-foreground">Total de Pesquisas</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Shared research list */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pesquisas Disponíveis</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pesquisa</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Recorrência</TableHead>
                      <TableHead>Concluídas</TableHead>
                      <TableHead>Em Execução</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sharedResults.map((r: any) => (
                      <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedRuleId(r.id)}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{r.name || 'Pesquisa de Preços'}</p>
                            {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{r.brand_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.frequency === 'once' ? 'Única' : r.frequency === 'weekly' ? 'Semanal' : r.frequency === 'biweekly' ? 'Quinzenal' : r.frequency === 'monthly' ? 'Mensal' : r.frequency}</Badge>
                        </TableCell>
                        <TableCell><Badge variant="default">{r.completed_count || 0}</Badge></TableCell>
                        <TableCell><Badge variant="secondary">{r.in_progress_count || 0}</Badge></TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost"><Eye className="h-4 w-4 mr-1" />Ver</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sharedResults.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        {selectedBrandId ? 'Nenhuma pesquisa compartilhada para esta marca.' : 'Selecione uma marca para ver as pesquisas compartilhadas.'}
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

// ===== Result Detail View =====
function ResultDetailView({ detail, onBack }: { detail: any; onBack: () => void }) {
  const { rule, executions = [], avgPrices = [] } = detail;
  const [tab, setTab] = useState('prices');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack}>← Voltar</Button>
        <div>
          <h2 className="text-lg font-semibold">{rule?.name || 'Pesquisa de Preços'}</h2>
          {rule?.description && <p className="text-sm text-muted-foreground">{rule.description}</p>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="prices"><DollarSign className="h-4 w-4 mr-1" />Preços Médios</TabsTrigger>
          <TabsTrigger value="executions"><CheckCircle2 className="h-4 w-4 mr-1" />Pesquisas Realizadas</TabsTrigger>
          <TabsTrigger value="chart"><BarChart3 className="h-4 w-4 mr-1" />Gráfico</TabsTrigger>
        </TabsList>

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
                      <TableCell className="text-right font-semibold">R$ {Number(p.avg_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-green-600">R$ {Number(p.min_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-red-600">R$ {Number(p.max_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right"><Badge variant="secondary">{p.collections}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {avgPrices.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem dados de preços</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>PDV</TableHead>
                    <TableHead>Promotor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.completed_at ? format(new Date(e.completed_at), 'dd/MM/yyyy') : '-'}</TableCell>
                      <TableCell>{e.pdv_name || '-'}</TableCell>
                      <TableCell>{e.promoter_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="default">
                          {e.status === 'validated' ? '✓ Validada' : 'Concluída'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {executions.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma pesquisa concluída</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart">
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
            <Card><CardContent className="py-12 text-center text-muted-foreground">Sem dados para exibir o gráfico</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}