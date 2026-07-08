import { useMemo, useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  useWorkSchedules, useCreateWorkSchedule, useDeleteWorkSchedule, useAssignWorkSchedule,
  useScheduleTemplates, useScheduleForecast, useSchedulePreview,
} from "@/hooks/use-timeclock";
import { useEmployees } from "@/hooks/use-rh";
import {
  CalendarClock, Plus, Trash2, Users, Sparkles, Eye, Loader2, LayoutTemplate,
} from "lucide-react";

const WEEKDAY_ABBR = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const fmtHM = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;

export default function RHEscalas() {
  const { toast } = useToast();
  const [tab, setTab] = useState("lista");
  const { data: schedules = [] } = useWorkSchedules();
  const { data: templates = [] } = useScheduleTemplates();
  const { data: employees = [] } = useEmployees({ status: "ativo" });
  const create = useCreateWorkSchedule();
  const del = useDeleteWorkSchedule();
  const assign = useAssignWorkSchedule();
  const previewMut = useSchedulePreview();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [forecastStart, setForecastStart] = useState(new Date().toISOString().slice(0, 10));
  const [forecastDays, setForecastDays] = useState(90);
  const { data: forecast, isLoading: loadingForecast } = useScheduleForecast(
    selectedId || undefined, forecastStart, forecastDays
  );

  const [tmplOpen, setTmplOpen] = useState(false);
  const [tmplName, setTmplName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [tmplPreview, setTmplPreview] = useState<any>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedTemplate) return;
    previewMut.mutateAsync({
      schedule: selectedTemplate,
      start: forecastStart,
      days: 60,
    }).then(setTmplPreview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate]);

  async function createFromTemplate() {
    if (!selectedTemplate || !tmplName.trim()) {
      toast({ title: "Informe o nome da escala", variant: "destructive" });
      return;
    }
    await create.mutateAsync({
      name: tmplName,
      kind: selectedTemplate.kind,
      schedule_json: selectedTemplate.schedule_json || {},
      cycle_pattern: selectedTemplate.cycle_pattern || null,
      cycle_start_date: selectedTemplate.cycle_pattern ? forecastStart : null,
      tolerance_minutes: 10,
    });
    toast({ title: "Escala criada" });
    setTmplOpen(false);
    setTmplName("");
    setSelectedTemplate(null);
  }

  async function assignSelected() {
    if (!selectedId || !selectedEmps.length) return;
    await assign.mutateAsync({ id: selectedId, employee_ids: selectedEmps });
    toast({ title: `${selectedEmps.length} colaborador(es) vinculado(s)` });
    setAssignOpen(false);
    setSelectedEmps([]);
  }

  const selectedSchedule = useMemo(
    () => schedules.find((s: any) => s.id === selectedId),
    [schedules, selectedId]
  );

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarClock className="w-6 h-6 text-primary" /> Escalas de Trabalho
            </h1>
            <p className="text-sm text-muted-foreground">
              Escalas fixas, cíclicas (4x2, 5x1, 6x1) e plantões (12x36, 24x48) com previsão anual
            </p>
          </div>
          <Button onClick={() => setTmplOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2" /> Nova a partir de Template
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="lista">Escalas Cadastradas ({schedules.length})</TabsTrigger>
            <TabsTrigger value="templates">
              <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" />
              Biblioteca de Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-1">
                <CardHeader><CardTitle className="text-base">Escalas</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {schedules.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma escala. Crie a partir de um template.
                    </p>
                  )}
                  {schedules.map((s: any) => (
                    <div key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition ${selectedId === s.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{s.name}</span>
                        <Badge variant="outline" className="text-xs">{s.kind}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {s.employees_count || 0} colaboradores
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    {selectedSchedule ? `Previsão — ${selectedSchedule.name}` : 'Selecione uma escala'}
                  </CardTitle>
                  {selectedSchedule && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                        <Users className="w-3.5 h-3.5 mr-1.5" /> Atribuir
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={async () => {
                          if (confirm(`Excluir escala "${selectedSchedule.name}"?`)) {
                            await del.mutateAsync(selectedSchedule.id);
                            setSelectedId(null);
                            toast({ title: "Escala excluída" });
                          }
                        }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {!selectedSchedule ? (
                    <p className="text-center text-muted-foreground py-10">
                      Escolha uma escala à esquerda para ver a previsão anual.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-3 mb-4">
                        <div>
                          <Label className="text-xs">Início</Label>
                          <Input type="date" value={forecastStart}
                            onChange={(e) => setForecastStart(e.target.value)} className="w-40" />
                        </div>
                        <div>
                          <Label className="text-xs">Período (dias)</Label>
                          <Select value={String(forecastDays)} onValueChange={(v) => setForecastDays(Number(v))}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">30 dias</SelectItem>
                              <SelectItem value="60">60 dias</SelectItem>
                              <SelectItem value="90">90 dias</SelectItem>
                              <SelectItem value="180">6 meses</SelectItem>
                              <SelectItem value="365">1 ano</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {loadingForecast ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
                      ) : forecast ? (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <KPI label="Dias trabalhados" value={String(forecast.totals.work_days)} />
                            <KPI label="Dias de folga" value={String(forecast.totals.off_days)} />
                            <KPI label="Total de horas" value={fmtHM(forecast.totals.total_minutes)} />
                            <KPI label="Média semanal" value={`${forecast.totals.weekly_hours}h`} />
                          </div>
                          <ForecastCalendar days={forecast.days_list} />
                        </>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((t: any) => (
                <Card key={t.id} className="cursor-pointer hover:border-primary transition"
                  onClick={() => { setSelectedTemplate(t); setTmplName(t.name); setTmplOpen(true); }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      {t.name}
                      <Badge variant="outline">{t.kind}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Criar a partir de Template */}
      <Dialog open={tmplOpen} onOpenChange={(o) => { setTmplOpen(o); if (!o) { setSelectedTemplate(null); setTmplPreview(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Criar Escala a partir de Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!selectedTemplate ? (
              <div className="grid gap-2 md:grid-cols-2 max-h-96 overflow-auto">
                {templates.map((t: any) => (
                  <button key={t.id}
                    onClick={() => { setSelectedTemplate(t); setTmplName(t.name); }}
                    className="text-left p-3 rounded-lg border hover:bg-muted transition">
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{selectedTemplate.name}</div>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedTemplate(null)}>Trocar</Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{selectedTemplate.description}</div>
                </div>

                <div>
                  <Label>Nome da escala</Label>
                  <Input value={tmplName} onChange={(e) => setTmplName(e.target.value)}
                    placeholder="Ex: Loja Centro - Vendas 6x1" />
                </div>

                {selectedTemplate.cycle_pattern && (
                  <div>
                    <Label>Data de início do ciclo</Label>
                    <Input type="date" value={forecastStart}
                      onChange={(e) => setForecastStart(e.target.value)} />
                  </div>
                )}

                {tmplPreview && (
                  <div>
                    <Label className="mb-2 block">Preview dos primeiros 60 dias</Label>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2 text-xs mb-3">
                      <Metric label="Dias trab." value={tmplPreview.totals.work_days} />
                      <Metric label="Folgas" value={tmplPreview.totals.off_days} />
                      <Metric label="Total h" value={fmtHM(tmplPreview.totals.total_minutes)} />
                      <Metric label="Média/sem" value={`${tmplPreview.totals.weekly_hours}h`} />
                    </div>
                    <ForecastCalendar days={tmplPreview.days_list} compact />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTmplOpen(false)}>Cancelar</Button>
            <Button onClick={createFromTemplate} disabled={!selectedTemplate || !tmplName || create.isPending}>
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Plus className="w-4 h-4 mr-2" /> Criar Escala
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Atribuir Colaboradores */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atribuir Colaboradores</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-auto space-y-1">
            {(employees as any[]).map((e) => (
              <label key={e.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                <input type="checkbox" checked={selectedEmps.includes(e.id)}
                  onChange={(ev) => {
                    setSelectedEmps((p) => ev.target.checked ? [...p, e.id] : p.filter(x => x !== e.id));
                  }} />
                <span className="text-sm">{e.full_name}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancelar</Button>
            <Button onClick={assignSelected} disabled={!selectedEmps.length || assign.isPending}>
              {assign.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Atribuir ({selectedEmps.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-2 rounded bg-background border">
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function ForecastCalendar({ days, compact = false }: { days: any[]; compact?: boolean }) {
  // Agrupa por mês
  const months = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const d of days) {
      const key = d.date.slice(0, 7);
      (map[key] ||= []).push(d);
    }
    return Object.entries(map).map(([key, ds]) => ({ key, days: ds }));
  }, [days]);

  return (
    <div className={`space-y-4 ${compact ? 'max-h-72 overflow-auto' : ''}`}>
      {months.map(({ key, days: monthDays }) => {
        const [y, m] = key.split("-").map(Number);
        const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
        const cells: any[] = Array(firstWeekday).fill(null);
        for (const d of monthDays) cells.push(d);
        return (
          <div key={key}>
            <p className="text-sm font-medium mb-2">{MONTHS[m - 1]} {y}</p>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAY_ABBR.map((w, i) => (
                <div key={i} className="text-[10px] text-muted-foreground font-medium">{w}</div>
              ))}
              {cells.map((c, i) => c ? (
                <div key={i}
                  title={c.is_off ? 'Folga' : `${c.shift} (${fmtHM(c.minutes)})`}
                  className={`aspect-square rounded flex flex-col items-center justify-center text-[10px] leading-tight
                    ${c.is_off
                      ? 'bg-muted text-muted-foreground'
                      : c.minutes >= 600
                        ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 font-medium'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium'}`}>
                  <span>{Number(c.date.slice(8, 10))}</span>
                  {!c.is_off && !compact && (
                    <span className="text-[8px] opacity-75">{Math.round(c.minutes / 60)}h</span>
                  )}
                </div>
              ) : <div key={i} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
