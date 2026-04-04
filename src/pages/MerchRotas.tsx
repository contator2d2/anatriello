import { useState, useMemo, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Calendar, ChevronLeft, ChevronRight, Plus, MapPin, Clock, User, Eye, Copy, Trash2, Edit, Filter, Repeat, Sparkles, Package, RefreshCw, X, CheckCircle2, Activity, Store, Info } from "lucide-react";
import AIRoutePlanner from "@/components/merch/AIRoutePlanner";
import { useMerchRoutes, useCreateMerchRoute, useUpdateMerchRoute, useDeleteMerchRoute, useDuplicateMerchRoute, useBrandChecklists, useBrandPromoters, useRouteMixPreview, useRouteProducts, useAddRouteProduct, useRemoveRouteProduct, useSyncRouteProducts } from "@/hooks/use-merch-routes";
import { useBrands } from "@/hooks/use-merchandising";
import { usePDVs } from "@/hooks/use-promotor";
import { useEmployees } from "@/hooks/use-rh";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, eachDayOfInterval, isSameDay, isSameMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  confirmed: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300',
  changed: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
  in_progress: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  completed: 'bg-green-500/20 text-green-700 dark:text-green-300',
  not_done: 'bg-red-500/20 text-red-700 dark:text-red-300',
  pending_justification: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
  cancelled: 'bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada', confirmed: 'Confirmada', changed: 'Alterada',
  in_progress: 'Em Andamento', completed: 'Concluída', not_done: 'Não Realizada',
  pending_justification: 'Pendente Justificativa', cancelled: 'Cancelada',
};

export default function MerchRotas() {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [viewRoute, setViewRoute] = useState<any>(null);
  const [filterPromoter, setFilterPromoter] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAIPlanner, setShowAIPlanner] = useState(false);
  const [scopeDialog, setScopeDialog] = useState<{ action: 'edit' | 'delete'; data?: any } | null>(null);

  // Calculate date range
  const dateRange = useMemo(() => {
    if (viewMode === 'month') return { from: format(startOfMonth(currentDate), 'yyyy-MM-dd'), to: format(endOfMonth(currentDate), 'yyyy-MM-dd') };
    if (viewMode === 'week') return { from: format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
    return { from: format(currentDate, 'yyyy-MM-dd'), to: format(currentDate, 'yyyy-MM-dd') };
  }, [viewMode, currentDate]);

  const { data: routes = [], isLoading } = useMerchRoutes({
    date_from: dateRange.from, date_to: dateRange.to,
    promoter_id: filterPromoter || undefined,
    brand_id: filterBrand || undefined,
    status: filterStatus || undefined,
  });
  const { data: pdvs = [] } = usePDVs();
  const { data: employees = [] } = useEmployees();
  const createRoute = useCreateMerchRoute();
  const updateRoute = useUpdateMerchRoute();
  const deleteRoute = useDeleteMerchRoute();
  const duplicateRoute = useDuplicateMerchRoute();

  // Check if route has future siblings (recurrence)
  const hasFutureSiblings = (route: any) => {
    if (!route?.recurrence) return false;
    const rec = typeof route.recurrence === 'string' ? JSON.parse(route.recurrence) : route.recurrence;
    return rec?.type && rec.type !== 'none';
  };

  const handleSaveIntent = (data: any) => {
    if (selectedRoute?.id && hasFutureSiblings(selectedRoute)) {
      setScopeDialog({ action: 'edit', data });
    } else if (selectedRoute?.id) {
      updateRoute.mutate({ id: selectedRoute.id, ...data }, { onSuccess: () => { toast.success('Rota atualizada'); setSelectedRoute(null); } });
    } else {
      createRoute.mutate(data, { onSuccess: () => { toast.success('Rota criada'); setShowCreate(false); } });
    }
  };

  const handleDeleteIntent = () => {
    if (selectedRoute?.id && hasFutureSiblings(selectedRoute)) {
      setScopeDialog({ action: 'delete' });
    } else if (selectedRoute?.id) {
      deleteRoute.mutate({ id: selectedRoute.id }, { onSuccess: () => { toast.success('Rota excluída'); setSelectedRoute(null); } });
    }
  };

  const executeScopeAction = (scope: 'single' | 'future') => {
    if (!selectedRoute?.id) return;
    if (scopeDialog?.action === 'delete') {
      deleteRoute.mutate({ id: selectedRoute.id, scope }, {
        onSuccess: () => { toast.success(scope === 'future' ? 'Rotas futuras excluídas' : 'Rota excluída'); setSelectedRoute(null); setScopeDialog(null); }
      });
    } else if (scopeDialog?.action === 'edit' && scopeDialog.data) {
      updateRoute.mutate({ id: selectedRoute.id, ...scopeDialog.data, _scope: scope }, {
        onSuccess: () => { toast.success(scope === 'future' ? 'Rotas futuras atualizadas' : 'Rota atualizada'); setSelectedRoute(null); setScopeDialog(null); }
      });
    }
  };

  const navigate = (dir: 'prev' | 'next') => {
    if (viewMode === 'month') setCurrentDate(dir === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(dir === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(dir === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
  };

  const calendarDays = useMemo(() => {
    if (viewMode === 'month') {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
    return [currentDate];
  }, [viewMode, currentDate]);

  const routesByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    routes.forEach((r: any) => {
      const key = r.visit_date?.split('T')[0] || r.visit_date;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [routes]);

  const headerLabel = viewMode === 'month'
    ? format(currentDate, 'MMMM yyyy', { locale: ptBR })
    : viewMode === 'week'
    ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`
    : format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" /> Rotas & Agenda
            </h1>
            <p className="text-sm text-muted-foreground">Planejamento e acompanhamento de visitas</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAIPlanner(true)} className="border-primary/30 text-primary hover:bg-primary/10">
              <Sparkles className="h-4 w-4 mr-1" /> Planejamento IA
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-1" /> Filtros
            </Button>
            <Button size="sm" onClick={() => { setShowCreate(true); setSelectedRoute(null); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Rota
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardContent className="p-3 flex flex-wrap gap-3">
              <Select value={filterPromoter || "__all__"} onValueChange={(v) => setFilterPromoter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Promotor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {employees.filter((e: any) => e?.id).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus || "__all__"} onValueChange={(v) => setFilterStatus(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Calendar Navigation */}
        <Card>
          <CardHeader className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => navigate('prev')}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-semibold capitalize min-w-[180px] text-center">{headerLabel}</span>
                <Button variant="ghost" size="icon" onClick={() => navigate('next')}><ChevronRight className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
              </div>
              <div className="flex bg-muted rounded-lg p-0.5">
                {(['month', 'week', 'day'] as const).map(m => (
                  <button key={m} onClick={() => setViewMode(m)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {m === 'month' ? 'Mês' : m === 'week' ? 'Semana' : 'Dia'}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2">
            {/* Weekday headers */}
            {viewMode !== 'day' && (
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                  <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
            )}

            {/* Calendar grid */}
            <div className={viewMode === 'day' ? '' : 'grid grid-cols-7 gap-1'}>
              {calendarDays.map(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const dayRoutes = routesByDay[dayStr] || [];
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentDate);

                if (viewMode === 'day') {
                  return (
                    <div key={dayStr} className="space-y-2">
                      {dayRoutes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma rota para este dia</p>
                      ) : dayRoutes.map((r: any) => (
                        <Card key={r.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setViewRoute(r)}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="text-sm font-mono font-medium">{r.scheduled_time?.slice(0, 5) || '--:--'}</div>
                                <div>
                                  <div className="text-sm font-semibold">{r.pdv_name}</div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{r.promoter_name}</span>
                                    <span>•</span>
                                    <span>{r.brand_name}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {r.progress_pct > 0 && <span className="text-xs font-mono">{Math.round(r.progress_pct)}%</span>}
                                <Badge className={STATUS_COLORS[r.status] || 'bg-muted'}>{STATUS_LABELS[r.status] || r.status}</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                }

                return (
                  <div key={dayStr}
                    onClick={() => { setCurrentDate(day); if (viewMode === 'month') setViewMode('day'); }}
                    className={`min-h-[80px] p-1 rounded-lg border cursor-pointer transition-colors
                      ${isToday ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-muted/30'}
                      ${!isCurrentMonth && viewMode === 'month' ? 'opacity-40' : ''}`}>
                    <div className="text-xs font-medium mb-0.5">
                      {format(day, 'd')}
                      {dayRoutes.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">{dayRoutes.length}</Badge>}
                    </div>
                    <div className="space-y-0.5">
                      {dayRoutes.slice(0, 3).map((r: any) => (
                        <div key={r.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${STATUS_COLORS[r.status] || 'bg-muted'}`}
                          onClick={(e) => { e.stopPropagation(); setViewRoute(r); }}>
                          {r.scheduled_time?.slice(0, 5)} {r.pdv_name}
                        </div>
                      ))}
                      {dayRoutes.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{dayRoutes.length - 3} mais</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Route Detail Summary Popup */}
        <Dialog open={!!viewRoute} onOpenChange={() => setViewRoute(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Store className="h-5 w-5 text-primary" />
                {viewRoute?.pdv_name}
              </DialogTitle>
            </DialogHeader>
            {viewRoute && (
              <div className="space-y-4">
                {/* Status badge */}
                <div className="flex items-center justify-between">
                  <Badge className={`${STATUS_COLORS[viewRoute.status] || 'bg-muted'}`}>
                    {STATUS_LABELS[viewRoute.status] || viewRoute.status}
                  </Badge>
                  {viewRoute.visit_date && (
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(viewRoute.visit_date.split('T')[0]), "dd/MM/yyyy")} • {viewRoute.scheduled_time?.slice(0, 5) || '--:--'}
                    </span>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-[10px] text-muted-foreground">Promotor</div>
                      <div className="font-medium">{viewRoute.promoter_name || '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-[10px] text-muted-foreground">Marca</div>
                      <div className="font-medium">
                        {viewRoute.is_multi_brand
                          ? `${viewRoute.route_brands?.length || 0} marcas`
                          : (viewRoute.brand_name || '—')}
                      </div>
                    </div>
                  </div>
                  {/* Multi-brand list */}
                  {viewRoute.is_multi_brand && viewRoute.route_brands?.length > 0 && (
                    <div className="col-span-2 space-y-1">
                      <div className="text-[10px] text-muted-foreground font-medium">Marcas da rota</div>
                      {viewRoute.route_brands.map((rb: any) => (
                        <div key={rb.id || rb.brand_id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                          <span className="font-medium">{rb.brand_name || rb.brand_id}</span>
                          <div className="flex items-center gap-2">
                            {rb.progress_pct != null && (
                              <span className="text-[10px] font-mono">{Math.round(rb.progress_pct)}%</span>
                            )}
                            <Badge variant="outline" className="text-[9px] h-4">
                              {rb.status === 'completed' ? '✅' : rb.status === 'in_progress' ? '🔄' : '⏳'} {rb.status || 'pending'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!viewRoute.is_multi_brand && viewRoute.checklist_name && (
                    <div className="flex items-center gap-2 col-span-2">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">Checklist</div>
                        <div className="font-medium">{viewRoute.checklist_name}</div>
                      </div>
                    </div>
                  )}
                  {viewRoute.pdv_city && (
                    <div className="flex items-center gap-2 col-span-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{viewRoute.pdv_city}</span>
                    </div>
                  )}
                </div>

                {/* Execution progress */}
                {(viewRoute.status === 'in_progress' || viewRoute.status === 'completed') && (
                  <Card className={viewRoute.status === 'in_progress' ? 'border-orange-500/30 bg-orange-500/5' : 'border-green-500/30 bg-green-500/5'}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          <Activity className="h-4 w-4" />
                          {viewRoute.status === 'in_progress' ? 'Em execução' : 'Execução concluída'}
                        </span>
                        <span className="font-mono font-bold">{Math.round(viewRoute.progress_pct || 0)}%</span>
                      </div>
                      <Progress value={viewRoute.progress_pct || 0} className="h-2" />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Produtos: {viewRoute.completed_products || 0}/{viewRoute.total_products || 0}</span>
                        {viewRoute.checkin_at && (
                          <span>Check-in: {new Date(viewRoute.checkin_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                        {viewRoute.completed_at && (
                          <span>Concluída: {new Date(viewRoute.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                {viewRoute.notes && (
                  <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">{viewRoute.notes}</div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" onClick={() => { setSelectedRoute(viewRoute); setViewRoute(null); }}>
                    <Edit className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    duplicateRoute.mutate({ id: viewRoute.id }, {
                      onSuccess: () => { toast.success('Rota duplicada'); setViewRoute(null); }
                    });
                  }}>
                    <Copy className="h-4 w-4 mr-1" /> Duplicar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => {
                    setSelectedRoute(viewRoute);
                    setViewRoute(null);
                    setTimeout(() => handleDeleteIntent(), 100);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Route Detail / Edit Dialog */}
        <RouteFormDialog
          open={showCreate || !!selectedRoute}
          route={selectedRoute}
          onClose={() => { setShowCreate(false); setSelectedRoute(null); }}
          pdvs={pdvs}
          employees={employees}
          onSave={handleSaveIntent}
          onDelete={selectedRoute?.id ? handleDeleteIntent : undefined}
          onDuplicate={selectedRoute?.id ? () => {
            duplicateRoute.mutate({ id: selectedRoute.id }, { onSuccess: () => { toast.success('Rota duplicada'); setSelectedRoute(null); } });
          } : undefined}
        />

        {/* Scope Confirmation Dialog */}
        <AlertDialog open={!!scopeDialog} onOpenChange={() => setScopeDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {scopeDialog?.action === 'delete' ? 'Excluir rota recorrente' : 'Editar rota recorrente'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta rota faz parte de uma série recorrente. Deseja aplicar a {scopeDialog?.action === 'delete' ? 'exclusão' : 'alteração'} apenas nesta rota ou em todas as rotas futuras da série?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button variant="outline" onClick={() => executeScopeAction('single')}>
                Apenas esta rota
              </Button>
              <Button variant={scopeDialog?.action === 'delete' ? 'destructive' : 'default'} onClick={() => executeScopeAction('future')}>
                Esta e todas futuras
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* AI Route Planner */}
        <AIRoutePlanner open={showAIPlanner} onClose={() => setShowAIPlanner(false)} />
      </div>
    </MainLayout>
  );
}

// Route Form Dialog
function RouteFormDialog({ open, route, onClose, pdvs, employees, onSave, onDelete, onDuplicate }: any) {
  const [form, setForm] = useState<any>({});
  const [multiBrands, setMultiBrands] = useState<{ brand_id: string; checklist_id?: string }[]>([]);
  const { data: brands = [] } = useBrands();
  // For single-brand backward compat, use first brand for checklists/promoters
  const activeBrandId = multiBrands.length > 0 ? multiBrands[0].brand_id : form.brand_id;
  const { data: checklists = [] } = useBrandChecklists(activeBrandId);
  const { data: brandPromoters = [] } = useBrandPromoters(activeBrandId);
  const { data: mixPreview = [] } = useRouteMixPreview(form.pdv_id, activeBrandId);
  const { data: routeProducts = [] } = useRouteProducts(route?.id);
  const addProduct = useAddRouteProduct();
  const removeProduct = useRemoveRouteProduct();
  const syncProducts = useSyncRouteProducts();

  // Sort employees: brand-linked promoters first
  const sortedEmployees = useMemo(() => {
    if (!employees?.length) return [];
    const linkedIds = new Set(brandPromoters.map((bp: any) => bp.employee_id));
    return [...employees].sort((a: any, b: any) => {
      const aLinked = linkedIds.has(a.id) ? 0 : 1;
      const bLinked = linkedIds.has(b.id) ? 0 : 1;
      return aLinked - bLinked;
    });
  }, [employees, brandPromoters]);

  const displayProducts = route?.id ? routeProducts : mixPreview;
  const routeProductIds = new Set(routeProducts.map((p: any) => p.product_id));
  const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Per-brand checklists for multi-brand
  const BrandChecklistSelector = ({ brandId, checklistId, onChange }: { brandId: string; checklistId?: string; onChange: (v: string) => void }) => {
    const { data: cls = [] } = useBrandChecklists(brandId);
    const brandName = brands.find((b: any) => b.id === brandId)?.name || brandId;
    return (
      <div className="flex items-center gap-2 p-2 rounded-md border bg-background/50">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{brandName}</div>
          {cls.length > 0 ? (
            <Select value={checklistId || ''} onValueChange={onChange}>
              <SelectTrigger className="h-7 text-[10px] mt-1"><SelectValue placeholder="Checklist" /></SelectTrigger>
              <SelectContent>
                {cls.filter((c: any) => c?.id).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-[10px] text-muted-foreground">Sem checklists</span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
          onClick={() => setMultiBrands(prev => prev.filter(b => b.brand_id !== brandId))}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  useEffect(() => {
    if (route) {
      const rec = route.recurrence ? (typeof route.recurrence === 'string' ? JSON.parse(route.recurrence) : route.recurrence) : null;
      setForm({
        promoter_id: route.promoter_id, supervisor_id: route.supervisor_id,
        pdv_id: route.pdv_id, brand_id: route.brand_id, checklist_id: route.checklist_id,
        visit_date: route.visit_date?.split('T')[0], scheduled_time: route.scheduled_time?.slice(0, 5),
        window_start: route.window_start, window_end: route.window_end,
        estimated_duration_min: route.estimated_duration_min, priority: route.priority,
        visit_type: route.visit_type, notes: route.notes, status: route.status,
        recurrence_type: rec?.type || 'none',
        recurrence_interval: rec?.interval || 1,
        recurrence_until: rec?.until || '',
        recurrence_weekdays: rec?.weekdays || [],
      });
      // Load multi-brand data
      if (route.route_brands?.length > 0) {
        setMultiBrands(route.route_brands.map((rb: any) => ({ brand_id: rb.brand_id, checklist_id: rb.checklist_id })));
      } else if (route.brand_id) {
        setMultiBrands([{ brand_id: route.brand_id, checklist_id: route.checklist_id }]);
      } else {
        setMultiBrands([]);
      }
    } else {
      setForm({
        visit_date: format(new Date(), 'yyyy-MM-dd'), priority: 'normal', visit_type: 'regular',
        estimated_duration_min: 60, recurrence_type: 'none', recurrence_interval: 1,
        recurrence_weekdays: [], recurrence_until: '',
      });
      setMultiBrands([]);
    }
  }, [route, open]);

  const toggleWeekday = (wd: number) => {
    const current = form.recurrence_weekdays || [];
    setForm({ ...form, recurrence_weekdays: current.includes(wd) ? current.filter((d: number) => d !== wd) : [...current, wd] });
  };

  const handleAddMixProduct = (product: any) => {
    if (route?.id) {
      addProduct.mutate({ routeId: route.id, product_id: product.product_id, category_id: product.category_id }, {
        onSuccess: () => toast.success('Produto adicionado'),
      });
    }
  };

  const handleRemoveProduct = (productId: string) => {
    if (route?.id) {
      removeProduct.mutate({ routeId: route.id, productId }, {
        onSuccess: () => toast.success('Produto removido'),
      });
    }
  };

  const handleSyncProducts = () => {
    if (route?.id) {
      syncProducts.mutate(route.id, {
        onSuccess: () => toast.success('Produtos sincronizados do mix'),
      });
    }
  };

  const availableToAdd = route?.id
    ? mixPreview.filter((mp: any) => !routeProductIds.has(mp.product_id))
    : [];

  // Available brands not yet added
  const availableBrands = (brands || []).filter((b: any) => b?.id && !multiBrands.some(mb => mb.brand_id === b.id));

  const handleSave = () => {
    const payload = { ...form };
    if (multiBrands.length > 1) {
      // Multi-brand route
      payload.brands = multiBrands;
      payload.brand_id = multiBrands[0].brand_id; // primary brand for backward compat
      payload.checklist_id = multiBrands[0].checklist_id;
    } else if (multiBrands.length === 1) {
      payload.brand_id = multiBrands[0].brand_id;
      payload.checklist_id = multiBrands[0].checklist_id;
      payload.brands = multiBrands;
    }
    onSave(payload);
  };

  const isMultiBrand = multiBrands.length > 1;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{route ? 'Editar Rota' : 'Nova Rota'}</DialogTitle>
          {isMultiBrand && (
            <Badge className="bg-primary/20 text-primary w-fit">🏷️ Multi-marca ({multiBrands.length} marcas)</Badge>
          )}
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Promotor *</Label>
              <Select value={form.promoter_id || ''} onValueChange={v => setForm({ ...form, promoter_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(sortedEmployees || []).filter((e: any) => e?.id).map((e: any) => {
                    const isLinked = brandPromoters.some((bp: any) => bp.employee_id === e.id);
                    return <SelectItem key={e.id} value={e.id}>{e.full_name}{isLinked ? ' ⭐' : ''}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">PDV *</Label>
              <Select value={form.pdv_id || ''} onValueChange={v => setForm({ ...form, pdv_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(pdvs || []).filter((p: any) => p?.id).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Multi-Brand Section */}
          <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4 text-primary" />
                Marcas {multiBrands.length > 0 && `(${multiBrands.length})`}
              </div>
              {availableBrands.length > 0 && (
                <Select value="" onValueChange={(v) => {
                  if (v) setMultiBrands(prev => [...prev, { brand_id: v }]);
                }}>
                  <SelectTrigger className="w-48 h-8 text-xs">
                    <SelectValue placeholder="+ Adicionar marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBrands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {multiBrands.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-3 bg-background/50 rounded-md">
                Selecione pelo menos uma marca para a rota
              </div>
            )}

            <div className="space-y-1.5">
              {multiBrands.map((mb) => (
                <BrandChecklistSelector
                  key={mb.brand_id}
                  brandId={mb.brand_id}
                  checklistId={mb.checklist_id}
                  onChange={(v) => setMultiBrands(prev => prev.map(b => b.brand_id === mb.brand_id ? { ...b, checklist_id: v } : b))}
                />
              ))}
            </div>

            {isMultiBrand && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                O promotor fará check-in único e poderá alternar entre as marcas durante a visita.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data início *</Label>
              <Input type="date" value={form.visit_date || ''} onChange={e => setForm({ ...form, visit_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Horário</Label>
              <Input type="time" value={form.scheduled_time || ''} onChange={e => setForm({ ...form, scheduled_time: e.target.value })} />
            </div>
          </div>

          {/* Recurrence */}
          {!route && (
            <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Repeat className="h-4 w-4 text-primary" /> Recorrência
              </div>
              <Select value={form.recurrence_type || 'none'} onValueChange={v => setForm({ ...form, recurrence_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem recorrência (única)</SelectItem>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>

              {form.recurrence_type && form.recurrence_type !== 'none' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Intervalo</Label>
                      <Input type="number" min={1} value={form.recurrence_interval || 1}
                        onChange={e => setForm({ ...form, recurrence_interval: parseInt(e.target.value) || 1 })} />
                      <span className="text-[10px] text-muted-foreground">
                        {form.recurrence_type === 'daily' ? 'dia(s)' : form.recurrence_type === 'weekly' ? 'semana(s)' : 'mês(es)'}
                      </span>
                    </div>
                    <div>
                      <Label className="text-xs">Até (data fim)</Label>
                      <Input type="date" value={form.recurrence_until || ''}
                        onChange={e => setForm({ ...form, recurrence_until: e.target.value })} />
                    </div>
                  </div>

                  {form.recurrence_type === 'weekly' && (
                    <div>
                      <Label className="text-xs mb-1 block">Dias da semana</Label>
                      <div className="flex gap-1">
                        {WEEKDAY_LABELS.map((label, i) => {
                          const wd = i + 1;
                          const selected = (form.recurrence_weekdays || []).includes(wd);
                          return (
                            <button key={wd} type="button" onClick={() => toggleWeekday(wd)}
                              className={`w-9 h-8 text-xs rounded-md border transition-colors ${selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'}`}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Duração (min)</Label>
              <Input type="number" value={form.estimated_duration_min || 60} onChange={e => setForm({ ...form, estimated_duration_min: parseInt(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={form.priority || 'normal'} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Single-brand checklist (only when NOT multi-brand) */}
          {!isMultiBrand && checklists.length > 0 && multiBrands.length === 1 && (
            <div>
              <Label className="text-xs">Checklist</Label>
              <Select value={multiBrands[0]?.checklist_id || ''} onValueChange={v => setMultiBrands(prev => prev.map((b, i) => i === 0 ? { ...b, checklist_id: v } : b))}>
                <SelectTrigger><SelectValue placeholder="Selecionar checklist" /></SelectTrigger>
                <SelectContent>
                  {checklists.filter((c: any) => c?.id).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {route && (
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status || 'scheduled'} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Product Mix Section */}
          {form.pdv_id && multiBrands.length > 0 && (
            <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4 text-primary" />
                  Produtos ({displayProducts.length})
                </div>
                {route?.id && (
                  <Button variant="outline" size="sm" onClick={handleSyncProducts} disabled={syncProducts.isPending}
                    className="h-7 text-xs">
                    <RefreshCw className={`h-3 w-3 mr-1 ${syncProducts.isPending ? 'animate-spin' : ''}`} />
                    Sincronizar do Mix
                  </Button>
                )}
              </div>

              {displayProducts.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-3 bg-background/50 rounded-md">
                  {!route?.id
                    ? 'Nenhum produto no mix deste PDV/Marca. Configure o mix primeiro em Mix por PDV.'
                    : 'Nenhum produto vinculado. Clique em "Sincronizar do Mix" ou adicione manualmente.'}
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {displayProducts.map((p: any) => (
                    <div key={p.product_id || p.id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-background/50 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.product_name}</div>
                        <div className="text-muted-foreground flex items-center gap-2">
                          {p.category_name && <span>{p.category_name}</span>}
                          {p.sku && <span>SKU: {p.sku}</span>}
                          {p.mandatory && <Badge variant="secondary" className="text-[9px] h-4">Obrigatório</Badge>}
                          {p.status && p.status !== 'pending' && (
                            <Badge variant={p.status === 'completed' ? 'default' : 'secondary'} className="text-[9px] h-4">
                              {p.status === 'completed' ? 'Executado' : p.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {route?.id && (!p.status || p.status === 'pending') && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveProduct(p.product_id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {route?.id && availableToAdd.length > 0 && (
                <div className="pt-2 border-t">
                  <Label className="text-xs text-muted-foreground mb-1 block">Adicionar do mix ({availableToAdd.length} disponíveis)</Label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {availableToAdd.map((p: any) => (
                      <div key={p.product_id} className="flex items-center justify-between py-1 px-2 rounded-md bg-background/30 text-xs">
                        <span className="truncate">{p.product_name} {p.category_name ? `(${p.category_name})` : ''}</span>
                        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2"
                          onClick={() => handleAddMixProduct(p)}>
                          <Plus className="h-3 w-3 mr-0.5" /> Adicionar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2">
            {onDelete && <Button variant="destructive" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>}
            {onDuplicate && <Button variant="outline" size="sm" onClick={onDuplicate}><Copy className="h-4 w-4 mr-1" /> Duplicar</Button>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.promoter_id || !form.pdv_id || multiBrands.length === 0 || !form.visit_date}>
              {form.recurrence_type && form.recurrence_type !== 'none' ? 'Criar Rotas' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
