import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, ChevronLeft, ChevronRight, MapPin, Clock, User, Users, Search, Store, Building2, Filter } from "lucide-react";
import { useMerchPromoters, useMerchRoutes } from "@/hooks/use-merch-routes";
import { useBrands } from "@/hooks/use-merchandising";
import { usePDVs } from "@/hooks/use-promotor";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, eachDayOfInterval, isSameDay, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  confirmed: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300',
  in_progress: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  completed: 'bg-green-500/20 text-green-700 dark:text-green-300',
  not_done: 'bg-red-500/20 text-red-700 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada', confirmed: 'Confirmada', in_progress: 'Em Andamento',
  completed: 'Concluída', not_done: 'Não Realizada', cancelled: 'Cancelada',
};

export default function MerchEquipe() {
  const [search, setSearch] = useState('');
  const [filterSupervisor, setFilterSupervisor] = useState('');
  const [selectedPromoter, setSelectedPromoter] = useState<any>(null);

  const { data: promoters = [], isLoading } = useMerchPromoters();
  const { data: brands = [] } = useBrands();
  const { data: pdvs = [] } = usePDVs();

  // Extract unique supervisors
  const supervisors = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    promoters.forEach((p: any) => {
      if (p.supervisor_id && p.supervisor_name) {
        map.set(p.supervisor_id, { id: p.supervisor_id, name: p.supervisor_name });
      }
    });
    return Array.from(map.values());
  }, [promoters]);

  // Filter promoters
  const filtered = useMemo(() => {
    let list = promoters;
    if (filterSupervisor) list = list.filter((p: any) => p.supervisor_id === filterSupervisor);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p: any) => p.full_name?.toLowerCase().includes(s));
    }
    return list;
  }, [promoters, filterSupervisor, search]);

  // Group by supervisor
  const grouped = useMemo(() => {
    const map: Record<string, { supervisor: string; items: any[] }> = {};
    filtered.forEach((p: any) => {
      const key = p.supervisor_id || '__none__';
      if (!map[key]) map[key] = { supervisor: p.supervisor_name || 'Sem Supervisor', items: [] };
      map[key].items.push(p);
    });
    return Object.values(map).sort((a, b) => a.supervisor.localeCompare(b.supervisor));
  }, [filtered]);

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Equipe de Promotores
            </h1>
            <p className="text-sm text-muted-foreground">Visualize e gerencie a agenda dos promotores por supervisor</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar promotor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterSupervisor || "__all__"} onValueChange={v => setFilterSupervisor(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Supervisor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos Supervisores</SelectItem>
                {supervisors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-xs">{filtered.length} promotor(es)</Badge>
          </CardContent>
        </Card>

        {/* Grouped list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum promotor encontrado</div>
        ) : (
          grouped.map(group => (
            <div key={group.supervisor} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground px-1">
                <User className="h-4 w-4" />
                <span>Supervisor: {group.supervisor}</span>
                <Badge variant="outline" className="text-[10px]">{group.items.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.items.map((p: any) => (
                  <Card key={p.id} className="cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.99]"
                    onClick={() => setSelectedPromoter(p)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {p.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{p.full_name}</div>
                          <div className="text-xs text-muted-foreground">{p.position || 'Promotor'}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.total_routes > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            <MapPin className="h-3 w-3 mr-0.5" />{p.total_routes} rotas
                          </Badge>
                        )}
                        {p.active_brands > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Building2 className="h-3 w-3 mr-0.5" />{p.active_brands} marcas
                          </Badge>
                        )}
                        {p.active_pdvs > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Store className="h-3 w-3 mr-0.5" />{p.active_pdvs} PDVs
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Promoter agenda dialog */}
        {selectedPromoter && (
          <PromoterAgendaDialog
            promoter={selectedPromoter}
            open={!!selectedPromoter}
            onClose={() => setSelectedPromoter(null)}
            brands={brands}
            pdvs={pdvs}
          />
        )}
      </div>
    </MainLayout>
  );
}

// ===== Promoter Agenda Dialog =====
function PromoterAgendaDialog({ promoter, open, onClose, brands, pdvs }: any) {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterBrand, setFilterBrand] = useState('');
  const [filterPDV, setFilterPDV] = useState('');

  const dateRange = useMemo(() => {
    if (viewMode === 'month') return { from: format(startOfMonth(currentDate), 'yyyy-MM-dd'), to: format(endOfMonth(currentDate), 'yyyy-MM-dd') };
    if (viewMode === 'week') return { from: format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
    return { from: format(currentDate, 'yyyy-MM-dd'), to: format(currentDate, 'yyyy-MM-dd') };
  }, [viewMode, currentDate]);

  const { data: routes = [], isLoading } = useMerchRoutes({
    promoter_id: promoter.id,
    date_from: dateRange.from,
    date_to: dateRange.to,
    brand_id: filterBrand || undefined,
    pdv_id: filterPDV || undefined,
  });

  const routesByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    routes.forEach((r: any) => {
      const key = r.visit_date?.split('T')[0] || r.visit_date;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [routes]);

  // Unique brands & PDVs from routes for quick filter
  const routeBrands = useMemo(() => {
    const s = new Map<string, string>();
    routes.forEach((r: any) => { if (r.brand_id && r.brand_name) s.set(r.brand_id, r.brand_name); });
    return Array.from(s.entries()).map(([id, name]) => ({ id, name }));
  }, [routes]);

  const routePDVs = useMemo(() => {
    const s = new Map<string, string>();
    routes.forEach((r: any) => { if (r.pdv_id && r.pdv_name) s.set(r.pdv_id, r.pdv_name); });
    return Array.from(s.entries()).map(([id, name]) => ({ id, name }));
  }, [routes]);

  const nav = (dir: 'prev' | 'next') => {
    if (viewMode === 'month') setCurrentDate(dir === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(dir === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(dir === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
  };

  const calendarDays = useMemo(() => {
    if (viewMode === 'month') {
      return eachDayOfInterval({ start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }) });
    }
    if (viewMode === 'week') {
      return eachDayOfInterval({ start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) });
    }
    return [currentDate];
  }, [viewMode, currentDate]);

  const headerLabel = viewMode === 'month'
    ? format(currentDate, 'MMMM yyyy', { locale: ptBR })
    : viewMode === 'week'
    ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`
    : format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {promoter.full_name?.charAt(0)?.toUpperCase()}
            </div>
            Agenda de {promoter.full_name}
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterBrand || "__all__"} onValueChange={v => setFilterBrand(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas Marcas</SelectItem>
              {(filterBrand ? brands : routeBrands.length > 0 ? routeBrands : brands).filter((b: any) => b?.id).map((b: any) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPDV || "__all__"} onValueChange={v => setFilterPDV(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="PDV" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos PDVs</SelectItem>
              {(filterPDV ? pdvs : routePDVs.length > 0 ? routePDVs : pdvs).filter((p: any) => p?.id).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="text-[10px]">{routes.length} rota(s)</Badge>
        </div>

        {/* Calendar Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => nav('prev')}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-semibold capitalize min-w-[160px] text-center">{headerLabel}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => nav('next')}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="h-7 text-xs ml-1" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          </div>
          <div className="flex bg-muted rounded-lg p-0.5">
            {(['month', 'week', 'day'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${viewMode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {m === 'month' ? 'Mês' : m === 'week' ? 'Semana' : 'Dia'}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div>
          {viewMode !== 'day' && (
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
          )}

          <div className={viewMode === 'day' ? 'space-y-2' : 'grid grid-cols-7 gap-1'}>
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
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-mono font-medium w-12">{r.scheduled_time?.slice(0, 5) || '--:--'}</div>
                          <div>
                            <div className="text-sm font-semibold">{r.pdv_name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span className="flex items-center gap-0.5"><Building2 className="h-3 w-3" />{r.brand_name}</span>
                              {r.estimated_duration_min && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{r.estimated_duration_min}min</span>}
                            </div>
                          </div>
                        </div>
                        <Badge className={`text-[10px] ${STATUS_COLORS[r.status] || 'bg-muted'}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                );
              }

              return (
                <div key={dayStr}
                  onClick={() => { setCurrentDate(day); if (viewMode === 'month') setViewMode('day'); }}
                  className={`min-h-[70px] p-1 rounded-lg border cursor-pointer transition-colors
                    ${isToday ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-muted/30'}
                    ${!isCurrentMonth && viewMode === 'month' ? 'opacity-40' : ''}`}>
                  <div className="text-xs font-medium mb-0.5">
                    {format(day, 'd')}
                    {dayRoutes.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">{dayRoutes.length}</Badge>}
                  </div>
                  <div className="space-y-0.5">
                    {dayRoutes.slice(0, 2).map((r: any) => (
                      <div key={r.id} className={`text-[9px] px-1 py-0.5 rounded truncate ${STATUS_COLORS[r.status] || 'bg-muted'}`}>
                        {r.scheduled_time?.slice(0, 5)} {r.pdv_name}
                      </div>
                    ))}
                    {dayRoutes.length > 2 && <div className="text-[9px] text-muted-foreground pl-1">+{dayRoutes.length - 2}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
