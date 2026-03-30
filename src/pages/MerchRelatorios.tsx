import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBrands, useBrandReport, usePdvReport } from "@/hooks/use-merchandising";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BarChart3, Store, Building2, Package } from "lucide-react";

export default function MerchRelatorios() {
  const [tab, setTab] = useState('marca');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedPdvId, setSelectedPdvId] = useState('');

  const { data: brands = [] } = useBrands();
  const { data: pdvs = [] } = useQuery({ queryKey: ['rh-pdvs-list'], queryFn: () => api<any[]>('/api/rh/pdvs') });
  const { data: brandReport = [] } = useBrandReport(selectedBrandId || undefined);
  const { data: pdvReport = [] } = usePdvReport(selectedPdvId || undefined);

  return (
    <MainLayout title="Relatórios Merchandising">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="marca"><Building2 className="h-4 w-4 mr-1" />Por Marca</TabsTrigger>
          <TabsTrigger value="pdv"><Store className="h-4 w-4 mr-1" />Por PDV</TabsTrigger>
        </TabsList>

        <TabsContent value="marca">
          <div className="space-y-4">
            <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
              <SelectTrigger className="max-w-sm"><SelectValue placeholder="Selecione uma marca" /></SelectTrigger>
              <SelectContent>{brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>

            {selectedBrandId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    PDVs atendidos: {brandReport.length}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>PDV</TableHead><TableHead>Rede</TableHead><TableHead>Cidade</TableHead><TableHead className="text-right">Produtos no Mix</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {brandReport.map((r: any) => (
                        <TableRow key={r.pdv_id}>
                          <TableCell className="font-medium">{r.pdv_name}</TableCell>
                          <TableCell>{r.network || '-'}</TableCell>
                          <TableCell>{r.city || '-'}</TableCell>
                          <TableCell className="text-right"><Badge variant="secondary">{r.product_count}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {brandReport.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem dados</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pdv">
          <div className="space-y-4">
            <Select value={selectedPdvId} onValueChange={setSelectedPdvId}>
              <SelectTrigger className="max-w-sm"><SelectValue placeholder="Selecione um PDV" /></SelectTrigger>
              <SelectContent>{pdvs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>

            {selectedPdvId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Marcas no PDV: {pdvReport.length}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Marca</TableHead><TableHead className="text-right">Produtos no Mix</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {pdvReport.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {r.logo_url ? <img src={r.logo_url} className="h-6 w-6 rounded" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
                              <span className="font-medium">{r.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right"><Badge variant="secondary">{r.product_count}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {pdvReport.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Sem dados</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
