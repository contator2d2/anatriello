import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePunchMonitor } from "@/hooks/use-promotor";
import { Clock, CheckCircle2, AlertTriangle, MapPin, UserX, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function RHPontoMonitor() {
  const { data, isLoading } = usePunchMonitor();

  const punchedToday = data?.punched_today || [];
  const notPunched = data?.not_punched || [];
  const alerts = data?.alerts || [];
  const outsidePdv = data?.outside_pdv || [];

  if (isLoading) return <MainLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold flex items-center gap-2"><Clock className="h-5 w-5" /> Monitoramento de Ponto — Tempo Real</h1>
        <p className="text-sm text-muted-foreground">Atualiza automaticamente a cada 15 segundos</p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto text-green-600 mb-1" />
              <p className="text-2xl font-bold text-green-700">{punchedToday.length}</p>
              <p className="text-xs text-green-600">Bateram ponto</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-950/20 border-red-200">
            <CardContent className="p-3 text-center">
              <UserX className="h-6 w-6 mx-auto text-red-600 mb-1" />
              <p className="text-2xl font-bold text-red-700">{notPunched.length}</p>
              <p className="text-xs text-red-600">Sem marcação</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200">
            <CardContent className="p-3 text-center">
              <AlertTriangle className="h-6 w-6 mx-auto text-yellow-600 mb-1" />
              <p className="text-2xl font-bold text-yellow-700">{alerts.length}</p>
              <p className="text-xs text-yellow-600">Alertas</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200">
            <CardContent className="p-3 text-center">
              <MapPin className="h-6 w-6 mx-auto text-orange-600 mb-1" />
              <p className="text-2xl font-bold text-orange-700">{outsidePdv.length}</p>
              <p className="text-xs text-orange-600">Fora do PDV</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="border-yellow-200">
            <CardHeader className="p-3 pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-600" /> Alertas Ativos</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0">
              <Table>
                <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead></TableRow></TableHeader>
                <TableBody>
                  {alerts.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.full_name}</TableCell>
                      <TableCell><Badge variant="destructive">{a.alert_type}</Badge></TableCell>
                      <TableCell className="text-sm">{a.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Not punched */}
        <Card>
          <CardHeader className="p-3 pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserX className="h-4 w-4 text-red-600" /> Sem Marcação Hoje ({notPunched.length})</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0">
            <Table>
              <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Cargo</TableHead><TableHead>Departamento</TableHead><TableHead>Jornada</TableHead></TableRow></TableHeader>
              <TableBody>
                {notPunched.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.full_name}</TableCell>
                    <TableCell>{e.position}</TableCell>
                    <TableCell>{e.department_name || '-'}</TableCell>
                    <TableCell className="text-xs">{e.work_schedule || '-'}</TableCell>
                  </TableRow>
                ))}
                {notPunched.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Todos já registraram ponto</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Punched today */}
        <Card>
          <CardHeader className="p-3 pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Registros de Hoje ({punchedToday.length})</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0">
            <Table>
              <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Último Registro</TableHead><TableHead>PDV</TableHead><TableHead>Status Geo</TableHead></TableRow></TableHeader>
              <TableBody>
                {punchedToday.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell className="text-xs">{format(new Date(p.punched_at), 'HH:mm:ss')}</TableCell>
                    <TableCell className="text-xs">{p.pdv_name || '-'}</TableCell>
                    <TableCell>
                      {p.geo_status === 'dentro_area' ? <Badge className="bg-green-500 text-[10px]">Dentro</Badge>
                        : p.geo_status === 'fora_area' ? <Badge variant="destructive" className="text-[10px]">Fora</Badge>
                        : <Badge variant="outline" className="text-[10px]">{p.geo_status}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
