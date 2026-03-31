import { useState, useMemo, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, ChevronLeft, ChevronRight, Plus, MapPin, Clock, User, Eye, Copy, Trash2, Edit, Filter, Repeat } from "lucide-react";
import { useMerchRoutes, useCreateMerchRoute, useUpdateMerchRoute, useDeleteMerchRoute, useDuplicateMerchRoute, useBrandChecklists } from "@/hooks/use-merch-routes";
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
  const [filterPromoter, setFilterPromoter] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

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
              <Select value={filterPromoter} onValueChange={setFilterPromoter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Promotor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
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
                        <Card key={r.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedRoute(r)}>
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
                          onClick={(e) => { e.stopPropagation(); setSelectedRoute(r); }}>
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

        {/* Route Detail / Edit Dialog */}
        <RouteFormDialog
          open={showCreate || !!selectedRoute}
          route={selectedRoute}
          onClose={() => { setShowCreate(false); setSelectedRoute(null); }}
          pdvs={pdvs}
          employees={employees}
          onSave={(data: any) => {
            if (selectedRoute?.id) {
              updateRoute.mutate({ id: selectedRoute.id, ...data }, { onSuccess: () => { toast.success('Rota atualizada'); setSelectedRoute(null); } });
            } else {
              createRoute.mutate(data, { onSuccess: () => { toast.success('Rota criada'); setShowCreate(false); } });
            }
          }}
          onDelete={selectedRoute?.id ? () => {
            deleteRoute.mutate(selectedRoute.id, { onSuccess: () => { toast.success('Rota excluída'); setSelectedRoute(null); } });
          } : undefined}
          onDuplicate={selectedRoute?.id ? () => {
            duplicateRoute.mutate({ id: selectedRoute.id }, { onSuccess: () => { toast.success('Rota duplicada'); setSelectedRoute(null); } });
          } : undefined}
        />
      </div>
    </MainLayout>
  );
}

// Route Form Dialog
function RouteFormDialog({ open, route, onClose, pdvs, employees, onSave, onDelete, onDuplicate }: any) {
  const [form, setForm] = useState<any>({});
  const { data: brands = [] } = useBrands();
  const { data: checklists = [] } = useBrandChecklists(form.brand_id);

  const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

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
    } else {
      setForm({
        visit_date: format(new Date(), 'yyyy-MM-dd'), priority: 'normal', visit_type: 'regular',
        estimated_duration_min: 60, recurrence_type: 'none', recurrence_interval: 1,
        recurrence_weekdays: [], recurrence_until: '',
      });
    }
  }, [route, open]);

  const toggleWeekday = (wd: number) => {
    const current = form.recurrence_weekdays || [];
    setForm({ ...form, recurrence_weekdays: current.includes(wd) ? current.filter((d: number) => d !== wd) : [...current, wd] });
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{route ? 'Editar Rota' : 'Nova Rota'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Promotor *</Label>
              <Select value={form.promoter_id || ''} onValueChange={v => setForm({ ...form, promoter_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(employees || []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">PDV *</Label>
              <Select value={form.pdv_id || ''} onValueChange={v => setForm({ ...form, pdv_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(pdvs || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Marca *</Label>
            <Select value={form.brand_id || ''} onValueChange={v => setForm({ ...form, brand_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione a marca" /></SelectTrigger>
              <SelectContent>
                {(brands || []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
          {checklists.length > 0 && (
            <div>
              <Label className="text-xs">Checklist</Label>
              <Select value={form.checklist_id || ''} onValueChange={v => setForm({ ...form, checklist_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar checklist" /></SelectTrigger>
                <SelectContent>
                  {checklists.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
            <Button onClick={() => onSave(form)} disabled={!form.promoter_id || !form.pdv_id || !form.brand_id || !form.visit_date}>
              {form.recurrence_type && form.recurrence_type !== 'none' ? 'Criar Rotas' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
