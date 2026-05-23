import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useLiveRoutes, useMerchDamages, useReturnRequests, useMerchRouteDetail } from "@/hooks/use-merch-routes";
import { MapPin, Clock, User, Camera, AlertTriangle, CheckCircle2, Activity, Package, Eye, Store, ChevronRight, Calendar, Filter } from "lucide-react";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const PERIOD_PRESETS = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: 'custom', label: 'Personalizado' },
];

function getDateRange(preset: string): { from: string; to: string } {
  const today = new Date();
  switch (preset) {
    case 'today': return { from: format(today, 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
    case 'yesterday': { const y = subDays(today, 1); return { from: format(y, 'yyyy-MM-dd'), to: format(y, 'yyyy-MM-dd') }; }
    case 'week': return { from: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
    case 'month': return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
    default: return { from: format(today, 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
  }
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada', confirmed: 'Confirmada', in_progress: 'Em Andamento',
  completed: 'Concluída', not_done: 'Não Realizada', cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-700',
  confirmed: 'bg-cyan-500/20 text-cyan-700',
  in_progress: 'bg-orange-500/20 text-orange-700',
  completed: 'bg-green-500/20 text-green-700',
  not_done: 'bg-red-500/20 text-red-700',
  cancelled: 'bg-muted text-muted-foreground',
};

const DAMAGE_STATUS: Record<string, string> = {
  registered: 'Registrada', awaiting_invoice: 'Aguardando Nota', invoice_sent: 'Nota Enviada',
  in_review: 'Em Conferência', completed: 'Concluída', cancelled: 'Cancelada',
};

export default function MerchExecucao() {
  const [period, setPeriod] = useState('today');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const dateRange = useMemo(() => {
    if (period === 'custom' && dateFrom && dateTo) return { from: dateFrom, to: dateTo };
    return getDateRange(period);
  }, [period, dateFrom, dateTo]);

  const { data: liveRoutes = [] } = useLiveRoutes({ date_from: dateRange.from, date_to: dateRange.to });
  const [damageFilter, setDamageFilter] = useState('');
  const { data: damages = [] } = useMerchDamages({ status: damageFilter || undefined });
  const { data: returnRequests = [] } = useReturnRequests();
  const [viewRouteId, setViewRouteId] = useState<string | null>(null);
  const { data: routeDetail, isLoading: isLoadingDetail } = useMerchRouteDetail(viewRouteId || undefined);
  const viewRoute = routeDetail || liveRoutes.find((r: any) => r.id === viewRouteId);

  const inProgress = liveRoutes.filter((r: any) => r.status === 'in_progress');
  const completed = liveRoutes.filter((r: any) => r.status === 'completed');
  const scheduled = liveRoutes.filter((r: any) => r.status === 'scheduled' || r.status === 'confirmed');

  const totalProducts = liveRoutes.reduce((sum: number, r: any) => sum + (parseInt(r.total_products) || 0), 0);
  const completedProducts = liveRoutes.reduce((sum: number, r: any) => sum + (parseInt(r.completed_products) || 0), 0);

  const periodLabel = period === 'today' ? 'do dia' : period === 'yesterday' ? 'de ontem' : period === 'week' ? 'da semana' : period === 'month' ? 'do mês' : 'do período';

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Execução em Campo
          </h1>
          <p className="text-sm text-muted-foreground">Acompanhamento das rotas {periodLabel}</p>
        </div>

        {/* Period Filter */}
        <Card className="p-3">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Período</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {period === 'custom' && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">De</label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Até</label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
                </div>
              </>
            )}
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
          <Card><CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{completedProducts}/{totalProducts}</div>
            <div className="text-xs text-muted-foreground">Produtos</div>
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
                <h3 className="text-sm font-semibold text-orange-600 flex items-center gap-1">
                  <Activity className="h-4 w-4 animate-pulse" /> Em Andamento ({inProgress.length})
                </h3>
                {inProgress.map((r: any) => (
                  <Card key={r.id} className="border-orange-500/30 cursor-pointer hover:border-orange-500/60 transition-colors"
                    onClick={() => setViewRouteId(r.id)}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-semibold text-sm">{r.pdv_name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{r.promoter_name}</span>
                            <span>•</span>
                            {r.is_multi_brand ? (
                              <span className="flex items-center gap-1">🏷️ {r.route_brands?.length || 0} marcas</span>
                            ) : (
                              <span>{r.brand_name}</span>
                            )}
                            {!r.is_multi_brand && r.checklist_name && <><span>•</span><span>{r.checklist_name}</span></>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-lg font-bold text-orange-500">{Math.round(r.progress_pct || 0)}%</div>
                            <div className="text-[10px] text-muted-foreground">
                              {r.completed_products || 0}/{r.total_products || 0} produtos
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <Progress value={r.progress_pct || 0} className="h-1.5" />
                      {/* Multi-brand mini progress */}
                      {r.is_multi_brand && r.route_brands?.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {r.route_brands.map((rb: any) => (
                            <div key={rb.brand_id} className="flex-1 text-center">
                              <div className="text-[9px] text-muted-foreground truncate">{rb.brand_name}</div>
                              <Progress value={rb.progress_pct || 0} className="h-1 mt-0.5" />
                              <div className="text-[9px] font-mono">{Math.round(rb.progress_pct || 0)}%</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.checkin_at && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Check-in: {new Date(r.checkin_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {r.pdv_city && ` • ${r.pdv_city}`}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-green-600">✅ Concluídas Hoje ({completed.length})</h3>
                {completed.map((r: any) => (
                  <Card key={r.id} className="border-green-500/20 cursor-pointer hover:border-green-500/40 transition-colors"
                    onClick={() => setViewRouteId(r.id)}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">{r.pdv_name}</div>
                        <div className="text-xs text-muted-foreground">{r.promoter_name} • {r.brand_name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {r.completed_products || 0}/{r.total_products || 0} produtos
                          {r.completed_at && ` • Concluída ${new Date(r.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
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
                <h3 className="text-sm font-semibold text-blue-600">📅 Aguardando ({scheduled.length})</h3>
                {scheduled.map((r: any) => (
                  <Card key={r.id} className="cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => setViewRouteId(r.id)}>
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
              <Select value={damageFilter || "__all__"} onValueChange={(v) => setDamageFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
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

        {/* Route Detail Dialog */}
        <Dialog open={!!viewRouteId} onOpenChange={(open) => !open && setViewRouteId(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                {viewRoute?.pdv_name}
              </DialogTitle>
            </DialogHeader>
            {viewRoute && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className={STATUS_COLORS[viewRoute.status] || 'bg-muted'}>
                    {STATUS_LABELS[viewRoute.status] || viewRoute.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{viewRoute.scheduled_time?.slice(0, 5) || '--:--'}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Promotor</div>
                    <div className="font-medium flex items-center gap-1"><User className="h-3.5 w-3.5" /> {viewRoute.promoter_name}</div>
                  </div>
                  {viewRoute.supervisor_name && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Supervisor</div>
                      <div className="font-medium flex items-center gap-1"><User className="h-3.5 w-3.5 text-blue-500" /> {viewRoute.supervisor_name}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Marca</div>
                    <div className="font-medium">
                      {viewRoute.is_multi_brand
                        ? `🏷️ ${viewRoute.route_brands?.length || 0} marcas`
                        : viewRoute.brand_name}
                    </div>
                  </div>
                  {viewRoute.checkin_at && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Check-in</div>
                      <div className="font-medium flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-green-500" /> {new Date(viewRoute.checkin_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  )}
                  {viewRoute.checkout_at && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Check-out</div>
                      <div className="font-medium flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-red-500" /> {new Date(viewRoute.checkout_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  )}
                  {!viewRoute.is_multi_brand && viewRoute.checklist_name && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Checklist</div>
                      <div className="font-medium truncate">{viewRoute.checklist_name}</div>
                    </div>
                  )}
                </div>

                {/* Multi-brand detailed view */}
                {viewRoute.is_multi_brand && viewRoute.route_brands?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">Progresso por Marca</div>
                    {viewRoute.route_brands.map((rb: any) => (
                      <Card key={rb.brand_id} className={`${rb.status === 'completed' ? 'border-green-500/30 bg-green-500/5' : rb.status === 'in_progress' ? 'border-orange-500/30 bg-orange-500/5' : 'border-border'}`}>
                        <CardContent className="p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{rb.brand_name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold">{Math.round(rb.progress_pct || 0)}%</span>
                              <Badge variant="outline" className="text-[9px]">
                                {rb.status === 'completed' ? '✅ Concluída' : rb.status === 'in_progress' ? '🔄 Em Andamento' : '⏳ Pendente'}
                              </Badge>
                            </div>
                          </div>
                          <Progress value={rb.progress_pct || 0} className="h-1.5" />
                          {rb.checklist_name && (
                            <div className="text-[10px] text-muted-foreground">Checklist: {rb.checklist_name}</div>
                          )}
                          {rb.started_at && (
                            <div className="text-[10px] text-muted-foreground">
                              Início: {new Date(rb.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              {rb.completed_at && ` • Fim: ${new Date(rb.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Execution progress */}
                {(viewRoute.status === 'in_progress' || viewRoute.status === 'completed') && (
                  <Card className={viewRoute.status === 'in_progress' ? 'border-orange-500/30 bg-orange-500/5' : 'border-green-500/30 bg-green-500/5'}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          <Activity className="h-4 w-4" />
                          {viewRoute.status === 'in_progress' ? 'Executando agora' : 'Concluída'}
                        </span>
                        <span className="font-mono font-bold">{Math.round(viewRoute.progress_pct || 0)}%</span>
                      </div>
                      <Progress value={viewRoute.progress_pct || 0} className="h-2" />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Produtos: {viewRoute.completed_products || 0}/{viewRoute.total_products || 0}</span>
                        {viewRoute.checkin_at && (
                          <span>Check-in: {new Date(viewRoute.checkin_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>

                      {/* Category progress */}
                      {viewRoute.category_progress && Array.isArray(viewRoute.category_progress) && (
                        <div className="space-y-1 pt-1 border-t">
                          <div className="text-[10px] font-semibold text-muted-foreground">Categorias</div>
                          {viewRoute.category_progress.map((cat: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-[10px]">
                              <span className="truncate flex-1">{cat.category_name}</span>
                              <div className="flex items-center gap-1.5">
                                {cat.point_type && (
                                  <Badge variant="outline" className="text-[8px] px-1 h-4">
                                    {cat.point_type === 'natural' ? '📍' : '🎯'} {cat.point_type}
                                  </Badge>
                                )}
                                {cat.completed ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                ) : cat.products_unlocked ? (
                                  <Activity className="h-3 w-3 text-orange-500" />
                                ) : (
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Check-in/out Photos */}
                {(viewRoute.checkin_photo || viewRoute.checkout_photo) && (
                  <div className="grid grid-cols-2 gap-3">
                    {viewRoute.checkin_photo && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase">Foto Check-in</div>
                        <div className="aspect-video rounded-md overflow-hidden bg-muted border">
                          <img src={viewRoute.checkin_photo} alt="Check-in" className="w-full h-full object-cover cursor-pointer" 
                            onClick={() => window.open(viewRoute.checkin_photo, '_blank')} />
                        </div>
                      </div>
                    )}
                    {viewRoute.checkout_photo && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase">Foto Check-out</div>
                        <div className="aspect-video rounded-md overflow-hidden bg-muted border">
                          <img src={viewRoute.checkout_photo} alt="Check-out" className="w-full h-full object-cover cursor-pointer" 
                            onClick={() => window.open(viewRoute.checkout_photo, '_blank')} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Photos Section */}
                {viewRoute.photos && viewRoute.photos.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Camera className="h-4 w-4" /> Fotos da Execução ({viewRoute.photos.length})
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {viewRoute.photos.map((photo: any) => (
                        <div key={photo.id} className="relative aspect-square rounded-md overflow-hidden bg-muted border group">
                          <img src={photo.photo_url} alt="Execução" className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-110" 
                            onClick={() => window.open(photo.photo_url, '_blank')} />
                          {photo.category_name && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white p-1 truncate">
                              {photo.category_name}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Damages & Ruptures */}
                {(viewRoute.damages?.length > 0 || viewRoute.ruptures?.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {viewRoute.damages?.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-red-600 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" /> Avarias ({viewRoute.damages.length})
                        </div>
                        <div className="space-y-1">
                          {viewRoute.damages.map((d: any) => (
                            <div key={d.id} className="text-[10px] bg-red-50 p-1.5 rounded border border-red-100">
                              <span className="font-bold">{d.product_name}</span>: {d.qty_total} un.
                              {d.reason && <div className="text-muted-foreground italic mt-0.5">{d.reason}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewRoute.ruptures?.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-orange-600 flex items-center gap-1">
                          <Package className="h-4 w-4" /> Rupturas ({viewRoute.ruptures.length})
                        </div>
                        <div className="space-y-1">
                          {viewRoute.ruptures.map((r: any) => (
                            <div key={r.id} className="text-[10px] bg-orange-50 p-1.5 rounded border border-orange-100">
                              <span className="font-bold">{r.product_name}</span>
                              {r.reason && <div className="text-muted-foreground italic mt-0.5">{r.reason}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Logs / Timeline */}
                {viewRoute.logs && viewRoute.logs.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Activity className="h-4 w-4" /> Histórico da Rota
                    </div>
                    <div className="space-y-1.5 border-l-2 border-muted ml-2 pl-3 py-1">
                      {viewRoute.logs.slice(-5).map((log: any) => (
                        <div key={log.id} className="relative">
                          <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                          <div className="text-[10px]">
                            <span className="font-medium text-muted-foreground">{new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="ml-2">{log.action_description || log.action_type}</span>
                          </div>
                        </div>
                      ))}
                      {viewRoute.logs.length > 5 && (
                        <div className="text-[9px] text-primary cursor-pointer hover:underline">Ver todo o histórico (+{viewRoute.logs.length - 5})</div>
                      )}
                    </div>
                  </div>
                )}

                {viewRoute.notes && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Observações</div>
                    <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md border italic">
                      "{viewRoute.notes}"
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
