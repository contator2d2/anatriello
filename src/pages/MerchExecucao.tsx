import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLiveRoutes, useMerchDamages, useReturnRequests } from "@/hooks/use-merch-routes";
import { MapPin, Clock, User, Camera, AlertTriangle, CheckCircle2, Activity, Package, Eye } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada', confirmed: 'Confirmada', in_progress: 'Em Andamento',
  completed: 'Concluída', not_done: 'Não Realizada', cancelled: 'Cancelada',
};

const DAMAGE_STATUS: Record<string, string> = {
  registered: 'Registrada', awaiting_invoice: 'Aguardando Nota', invoice_sent: 'Nota Enviada',
  in_review: 'Em Conferência', completed: 'Concluída', cancelled: 'Cancelada',
};

export default function MerchExecucao() {
  const { data: liveRoutes = [] } = useLiveRoutes();
  const [damageFilter, setDamageFilter] = useState('');
  const { data: damages = [] } = useMerchDamages({ status: damageFilter || undefined });
  const { data: returnRequests = [] } = useReturnRequests();

  const inProgress = liveRoutes.filter((r: any) => r.status === 'in_progress');
  const completed = liveRoutes.filter((r: any) => r.status === 'completed');
  const scheduled = liveRoutes.filter((r: any) => r.status === 'scheduled' || r.status === 'confirmed');

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Execução em Campo
          </h1>
          <p className="text-sm text-muted-foreground">Acompanhamento em tempo real das rotas do dia</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{liveRoutes.length}</div>
            <div className="text-xs text-muted-foreground">Total Hoje</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-orange-500">{inProgress.length}</div>
            <div className="text-xs text-muted-foreground">Em Andamento</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-500">{completed.length}</div>
            <div className="text-xs text-muted-foreground">Concluídas</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-500">{scheduled.length}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="live">
          <TabsList>
            <TabsTrigger value="live">Tempo Real</TabsTrigger>
            <TabsTrigger value="damages">Avarias ({damages.length})</TabsTrigger>
            <TabsTrigger value="returns">Devoluções ({returnRequests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-3">
            {/* In Progress */}
            {inProgress.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-orange-600">🔴 Em Andamento</h3>
                {inProgress.map((r: any) => (
                  <Card key={r.id} className="border-orange-500/30">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm">{r.pdv_name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{r.promoter_name}</span>
                            <span>•</span>
                            <span>{r.brand_name}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-orange-500">{Math.round(r.progress_pct || 0)}%</div>
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${r.progress_pct || 0}%` }} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-green-600">✅ Concluídas Hoje</h3>
                {completed.map((r: any) => (
                  <Card key={r.id} className="border-green-500/20">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">{r.pdv_name}</div>
                        <div className="text-xs text-muted-foreground">{r.promoter_name} • {r.brand_name}</div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Scheduled */}
            {scheduled.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-blue-600">📅 Aguardando</h3>
                {scheduled.map((r: any) => (
                  <Card key={r.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">{r.pdv_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.scheduled_time?.slice(0, 5)} • {r.promoter_name} • {r.brand_name}
                        </div>
                      </div>
                      <Badge variant="secondary">{r.scheduled_time?.slice(0, 5) || 'S/ horário'}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {liveRoutes.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhuma rota agendada para hoje</p>
            )}
          </TabsContent>

          <TabsContent value="damages" className="space-y-3">
            <div className="flex gap-2">
              <Select value={damageFilter} onValueChange={setDamageFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {Object.entries(DAMAGE_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {damages.map((d: any) => (
              <Card key={d.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{d.product_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.pdv_name} • {d.brand_name} • {d.promoter_name}
                      </div>
                      <div className="text-xs mt-1">
                        Loja: {d.qty_store} | Estoque: {d.qty_stock} | <strong>Total: {d.qty_total}</strong>
                      </div>
                      {d.reason && <div className="text-xs text-muted-foreground mt-0.5">{d.reason}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      {d.photo_url && <Camera className="h-4 w-4 text-muted-foreground" />}
                      <Badge className="text-[10px]">{DAMAGE_STATUS[d.status] || d.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {damages.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma avaria registrada</p>}
          </TabsContent>

          <TabsContent value="returns" className="space-y-3">
            {returnRequests.map((r: any) => (
              <Card key={r.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{r.pdv_name} - {r.brand_name}</div>
                      <div className="text-xs text-muted-foreground">{r.promoter_name} • {r.item_count} item(s)</div>
                    </div>
                    <Badge>{DAMAGE_STATUS[r.status] || r.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {returnRequests.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma solicitação de devolução</p>}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
