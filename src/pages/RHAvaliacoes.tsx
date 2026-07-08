import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  usePerfCycles, usePerfCycle, useCreatePerfCycle, useOpenPerfCycle, useClosePerfCycle, useDeletePerfCycle,
  usePerfReviews, usePerfReview, useUpdatePerfReview, useSubmitPerfReview,
  usePerfGoals, useCreatePerfGoal, useUpdatePerfGoal, useDeletePerfGoal,
  usePerfFeedback, useCreatePerfFeedback, useDeletePerfFeedback,
  usePerfPDIs, useCreatePerfPDI, useUpdatePerfPDI, useDeletePerfPDI,
  usePerfNineBox, usePerfConsolidated,
  useEmployees,
} from "@/hooks/use-rh";
import {
  Target, Plus, Loader2, Trash2, Play, StopCircle, Star, MessageSquare,
  Award, TrendingUp, Users as UsersIcon, ListChecks, Send, Grid3X3,
} from "lucide-react";

const CYCLE_STATUS: Record<string, string> = {
  rascunho: "Rascunho", aberto: "Aberto", em_avaliacao: "Em avaliação",
  consolidacao: "Consolidação", concluido: "Concluído", arquivado: "Arquivado",
};
const CYCLE_COLOR: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-700",
  aberto: "bg-blue-100 text-blue-800",
  em_avaliacao: "bg-yellow-100 text-yellow-800",
  consolidacao: "bg-purple-100 text-purple-800",
  concluido: "bg-green-100 text-green-800",
  arquivado: "bg-slate-200 text-slate-500",
};
const REVIEW_STATUS: Record<string, string> = {
  pendente: "Pendente", em_andamento: "Em andamento", enviada: "Enviada",
};
const EVAL_TYPE: Record<string, string> = {
  self: "Autoavaliação", manager: "Gestor", peer: "Par", subordinate: "Subordinado", leader: "Líder",
};
const GOAL_STATUS: Record<string, string> = {
  nao_iniciada: "Não iniciada", em_andamento: "Em andamento",
  concluida: "Concluída", nao_atingida: "Não atingida",
};
const GOAL_COLOR: Record<string, string> = {
  nao_iniciada: "bg-slate-100 text-slate-700",
  em_andamento: "bg-blue-100 text-blue-800",
  concluida: "bg-green-100 text-green-800",
  nao_atingida: "bg-red-100 text-red-800",
};
const FEEDBACK_TYPE: Record<string, string> = {
  positivo: "Positivo", construtivo: "Construtivo", reconhecimento: "Reconhecimento",
};
const FB_COLOR: Record<string, string> = {
  positivo: "bg-green-100 text-green-800",
  construtivo: "bg-yellow-100 text-yellow-800",
  reconhecimento: "bg-purple-100 text-purple-800",
};

const fmtDate = (d?: string) => d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "-";

// 9-Box grid cells
const NINE_BOX_LABELS: Record<string, string> = {
  alto_baixo: "Enigma", alto_medio: "Talento", alto_alto: "Estrela",
  medio_baixo: "Cumpre função", medio_medio: "Mantenedor", medio_alto: "Alto potencial",
  baixo_baixo: "Insuficiente", baixo_medio: "Eficaz limitado", baixo_alto: "Dilema",
};

export default function RHAvaliacoes() {
  const { toast } = useToast();
  const [tab, setTab] = useState("ciclos");

  // Ciclos
  const [openNewCycle, setOpenNewCycle] = useState(false);
  const [cycleDetailId, setCycleDetailId] = useState<string | null>(null);
  const [openOpenCycle, setOpenOpenCycle] = useState(false);

  const { data: cycles = [], isLoading: cyclesLoading } = usePerfCycles();
  const { data: cycleDetail } = usePerfCycle(cycleDetailId || undefined);
  const { data: employees = [] } = useEmployees();
  const createCycleMut = useCreatePerfCycle();
  const openCycleMut = useOpenPerfCycle();
  const closeCycleMut = useClosePerfCycle();
  const deleteCycleMut = useDeletePerfCycle();

  const [cycleForm, setCycleForm] = useState({
    name: "", description: "", cycle_type: "90",
    scale_min: 1, scale_max: 5,
    start_date: "", end_date: "",
  });
  const [openParams, setOpenParams] = useState({ employee_ids: [] as string[], peers_per_employee: 2 });

  // Reviews
  const [reviewDetailId, setReviewDetailId] = useState<string | null>(null);
  const [reviewCycleFilter, setReviewCycleFilter] = useState<string>("");
  const { data: reviews = [], isLoading: reviewsLoading } = usePerfReviews(reviewCycleFilter ? { cycle_id: reviewCycleFilter } : undefined);
  const { data: reviewDetail } = usePerfReview(reviewDetailId || undefined);
  const updateReviewMut = useUpdatePerfReview();
  const submitReviewMut = useSubmitPerfReview();
  const [reviewScores, setReviewScores] = useState<any[]>([]);
  const [reviewText, setReviewText] = useState({ strengths: "", improvements: "", comments: "" });

  // Consolidated
  const { data: consolidated = [] } = usePerfConsolidated(reviewCycleFilter);

  // Goals
  const [openNewGoal, setOpenNewGoal] = useState(false);
  const [goalEmpFilter, setGoalEmpFilter] = useState("");
  const { data: goals = [] } = usePerfGoals(goalEmpFilter ? { employee_id: goalEmpFilter } : undefined);
  const createGoalMut = useCreatePerfGoal();
  const updateGoalMut = useUpdatePerfGoal();
  const deleteGoalMut = useDeletePerfGoal();
  const emptyGoal = {
    employee_id: "", title: "", description: "", metric: "",
    target_value: 0, current_value: 0, unit: "", weight: 1, due_date: "",
  };
  const [goalForm, setGoalForm] = useState(emptyGoal);

  // Feedback
  const [openNewFb, setOpenNewFb] = useState(false);
  const [fbEmpFilter, setFbEmpFilter] = useState("");
  const { data: feedback = [] } = usePerfFeedback(fbEmpFilter || undefined);
  const createFbMut = useCreatePerfFeedback();
  const deleteFbMut = useDeletePerfFeedback();
  const emptyFb = { employee_id: "", feedback_type: "positivo", category: "", message: "", is_private: false };
  const [fbForm, setFbForm] = useState(emptyFb);

  // PDI + 9-Box
  const [openNewPDI, setOpenNewPDI] = useState(false);
  const { data: pdis = [] } = usePerfPDIs();
  const { data: nineBox = [] } = usePerfNineBox();
  const createPDIMut = useCreatePerfPDI();
  const updatePDIMut = useUpdatePerfPDI();
  const deletePDIMut = useDeletePerfPDI();
  const emptyPDI = {
    employee_id: "", title: "PDI", notes: "",
    performance_score: 3, potential_score: 2,
    actions: [{ title: "", type: "curso", deadline: "", status: "pendente" }],
  };
  const [pdiForm, setPdiForm] = useState<any>(emptyPDI);

  // === Handlers ===
  const submitCycle = async () => {
    if (!cycleForm.name) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    try {
      const r: any = await createCycleMut.mutateAsync(cycleForm);
      toast({ title: "Ciclo criado", description: r.name });
      setOpenNewCycle(false);
      setCycleForm({ name: "", description: "", cycle_type: "90", scale_min: 1, scale_max: 5, start_date: "", end_date: "" });
      setCycleDetailId(r.id);
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const openCycle = async () => {
    if (!cycleDetail) return;
    try {
      const r: any = await openCycleMut.mutateAsync({
        id: cycleDetail.id,
        employee_ids: openParams.employee_ids.length ? openParams.employee_ids : undefined,
        peers_per_employee: openParams.peers_per_employee,
      });
      toast({ title: "Ciclo aberto", description: `${r.created} avaliações criadas para ${r.employees} colaboradores.` });
      setOpenOpenCycle(false);
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const openReviewDetail = (id: string) => {
    setReviewDetailId(id);
  };

  // Sync review edit state when detail loads
  const initReviewEdit = () => {
    if (!reviewDetail) return;
    const criteria = reviewDetail.cycle_criteria || [];
    const existing = reviewDetail.scores || [];
    const merged = criteria.map((c: any) => {
      const found = existing.find((s: any) => s.key === c.key);
      return { key: c.key, label: c.label, weight: c.weight || 1, value: found?.value || 0 };
    });
    setReviewScores(merged);
    setReviewText({
      strengths: reviewDetail.strengths || "",
      improvements: reviewDetail.improvements || "",
      comments: reviewDetail.comments || "",
    });
  };

  // Load edit state when review detail changes
  useMemo(() => { if (reviewDetail) initReviewEdit(); }, [reviewDetail?.id]);

  const saveReview = async (submit = false) => {
    if (!reviewDetail) return;
    try {
      await updateReviewMut.mutateAsync({
        id: reviewDetail.id, scores: reviewScores, ...reviewText,
      });
      if (submit) {
        await submitReviewMut.mutateAsync(reviewDetail.id);
        toast({ title: "Avaliação enviada" });
        setReviewDetailId(null);
      } else {
        toast({ title: "Rascunho salvo" });
      }
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const submitGoal = async () => {
    if (!goalForm.employee_id || !goalForm.title) { toast({ title: "Preencha colaborador e título", variant: "destructive" }); return; }
    try {
      await createGoalMut.mutateAsync(goalForm);
      toast({ title: "Meta criada" });
      setOpenNewGoal(false); setGoalForm(emptyGoal);
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const updateGoalProgress = async (goal: any, current: number) => {
    await updateGoalMut.mutateAsync({ id: goal.id, current_value: current, target_value: goal.target_value });
  };

  const submitFeedback = async () => {
    if (!fbForm.employee_id || !fbForm.message) { toast({ title: "Preencha colaborador e mensagem", variant: "destructive" }); return; }
    try {
      await createFbMut.mutateAsync(fbForm);
      toast({ title: "Feedback registrado" });
      setOpenNewFb(false); setFbForm(emptyFb);
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const submitPDI = async () => {
    if (!pdiForm.employee_id) { toast({ title: "Selecione colaborador", variant: "destructive" }); return; }
    try {
      await createPDIMut.mutateAsync(pdiForm);
      toast({ title: "PDI criado" });
      setOpenNewPDI(false); setPdiForm(emptyPDI);
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const addPDIAction = () => {
    setPdiForm({ ...pdiForm, actions: [...pdiForm.actions, { title: "", type: "curso", deadline: "", status: "pendente" }] });
  };

  const updatePDIAction = (idx: number, patch: any) => {
    const acts = [...pdiForm.actions];
    acts[idx] = { ...acts[idx], ...patch };
    setPdiForm({ ...pdiForm, actions: acts });
  };

  // 9-Box grid
  const nineBoxGrid = useMemo(() => {
    const grid: Record<string, any[]> = {};
    for (const row of ["alto", "medio", "baixo"]) {
      for (const col of ["baixo", "medio", "alto"]) {
        grid[`${row}_${col}`] = [];
      }
    }
    nineBox.forEach((p: any) => {
      if (p.nine_box_cell && grid[p.nine_box_cell]) grid[p.nine_box_cell].push(p);
    });
    return grid;
  }, [nineBox]);

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6" /> Avaliações de Desempenho
          </h1>
          <p className="text-sm text-muted-foreground">
            Ciclos 90°/180°/360°, metas SMART, feedback contínuo, PDI e matriz 9-Box.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
            <TabsTrigger value="ciclos"><Award className="w-4 h-4 mr-1" />Ciclos</TabsTrigger>
            <TabsTrigger value="avaliacoes"><Star className="w-4 h-4 mr-1" />Avaliações</TabsTrigger>
            <TabsTrigger value="metas"><ListChecks className="w-4 h-4 mr-1" />Metas</TabsTrigger>
            <TabsTrigger value="feedback"><MessageSquare className="w-4 h-4 mr-1" />Feedback</TabsTrigger>
            <TabsTrigger value="pdi"><TrendingUp className="w-4 h-4 mr-1" />PDI</TabsTrigger>
            <TabsTrigger value="ninebox"><Grid3X3 className="w-4 h-4 mr-1" />9-Box</TabsTrigger>
          </TabsList>

          {/* CICLOS */}
          <TabsContent value="ciclos" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => setOpenNewCycle(true)}>
                <Plus className="w-4 h-4 mr-2" /> Novo ciclo
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {cyclesLoading ? (
                  <div className="flex justify-center p-6"><Loader2 className="animate-spin" /></div>
                ) : cycles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum ciclo criado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ciclo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cycles.map((c: any) => {
                        const pct = c.reviews_total ? Math.round((c.reviews_done / c.reviews_total) * 100) : 0;
                        return (
                          <TableRow key={c.id} className="cursor-pointer" onClick={() => setCycleDetailId(c.id)}>
                            <TableCell className="font-medium">{c.name}
                              <div className="text-xs text-muted-foreground">{c.description || ""}</div>
                            </TableCell>
                            <TableCell><Badge variant="outline">{c.cycle_type}°</Badge></TableCell>
                            <TableCell className="text-xs">{fmtDate(c.start_date)} — {fmtDate(c.end_date)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 w-40">
                                <Progress value={pct} className="h-2 flex-1" />
                                <span className="text-xs">{c.reviews_done}/{c.reviews_total}</span>
                              </div>
                            </TableCell>
                            <TableCell><Badge className={CYCLE_COLOR[c.status]}>{CYCLE_STATUS[c.status]}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AVALIAÇÕES */}
          <TabsContent value="avaliacoes" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-2 justify-between">
              <Select value={reviewCycleFilter || "all"} onValueChange={(v) => setReviewCycleFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar por ciclo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os ciclos</SelectItem>
                  {cycles.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Card>
              <CardContent className="p-0">
                {reviewsLoading ? (
                  <div className="flex justify-center p-6"><Loader2 className="animate-spin" /></div>
                ) : reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem avaliações. Abra um ciclo para gerar.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Avaliado</TableHead>
                        <TableHead>Avaliador</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Nota</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviews.map((r: any) => (
                        <TableRow key={r.id} className="cursor-pointer" onClick={() => openReviewDetail(r.id)}>
                          <TableCell>{r.employee_name}</TableCell>
                          <TableCell>{r.evaluator_name || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{EVAL_TYPE[r.evaluator_type]}</Badge></TableCell>
                          <TableCell>{r.overall_score ? Number(r.overall_score).toFixed(2) : "—"}</TableCell>
                          <TableCell>
                            <Badge className={r.status === "enviada" ? "bg-green-100 text-green-800" : r.status === "em_andamento" ? "bg-yellow-100 text-yellow-800" : "bg-slate-100"}>
                              {REVIEW_STATUS[r.status]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {reviewCycleFilter && consolidated.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Consolidado do ciclo</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Média</TableHead>
                        <TableHead>Enviadas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consolidated.map((c: any) => (
                        <TableRow key={c.employee_id}>
                          <TableCell>{c.full_name}</TableCell>
                          <TableCell className="text-xs">{c.position || "—"}</TableCell>
                          <TableCell className="font-bold">{c.avg_score ? Number(c.avg_score).toFixed(2) : "—"}</TableCell>
                          <TableCell>{c.submitted}/{c.reviewers}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* METAS */}
          <TabsContent value="metas" className="space-y-4 mt-4">
            <div className="flex justify-between gap-2 flex-wrap">
              <Select value={goalEmpFilter || "all"} onValueChange={(v) => setGoalEmpFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar colaborador" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => setOpenNewGoal(true)}>
                <Plus className="w-4 h-4 mr-2" /> Nova meta
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {goals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem metas cadastradas.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Meta</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead>Prazo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {goals.map((g: any) => (
                        <TableRow key={g.id}>
                          <TableCell>{g.employee_name}</TableCell>
                          <TableCell>
                            <div className="font-medium">{g.title}</div>
                            <div className="text-xs text-muted-foreground">{g.metric} · alvo {g.target_value}{g.unit || ""}</div>
                          </TableCell>
                          <TableCell className="w-56">
                            <div className="flex items-center gap-2">
                              <Progress value={g.progress_pct} className="h-2 flex-1" />
                              <Input type="number" className="w-20 h-7"
                                defaultValue={g.current_value}
                                onBlur={(e) => updateGoalProgress(g, Number(e.target.value))} />
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{fmtDate(g.due_date)}</TableCell>
                          <TableCell><Badge className={GOAL_COLOR[g.status]}>{GOAL_STATUS[g.status]}</Badge></TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => deleteGoalMut.mutate(g.id)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FEEDBACK */}
          <TabsContent value="feedback" className="space-y-4 mt-4">
            <div className="flex justify-between gap-2 flex-wrap">
              <Select value={fbEmpFilter || "all"} onValueChange={(v) => setFbEmpFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar colaborador" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => setOpenNewFb(true)}>
                <Plus className="w-4 h-4 mr-2" /> Novo feedback
              </Button>
            </div>
            <div className="space-y-2">
              {feedback.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Sem feedbacks registrados.</CardContent></Card>
              ) : feedback.map((f: any) => (
                <Card key={f.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={FB_COLOR[f.feedback_type]}>{FEEDBACK_TYPE[f.feedback_type]}</Badge>
                          <span className="text-sm font-medium">{f.employee_name}</span>
                          {f.category && <span className="text-xs text-muted-foreground">· {f.category}</span>}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{f.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          por {f.given_by_full_name || f.given_by_name || "Sistema"} · {new Date(f.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => deleteFbMut.mutate(f.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* PDI */}
          <TabsContent value="pdi" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => setOpenNewPDI(true)}>
                <Plus className="w-4 h-4 mr-2" /> Novo PDI
              </Button>
            </div>
            <div className="grid gap-3">
              {pdis.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Sem PDIs cadastrados.</CardContent></Card>
              ) : pdis.map((p: any) => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-medium">{p.employee_name}</p>
                        <p className="text-xs text-muted-foreground">{p.employee_position}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.nine_box_cell && (
                          <Badge variant="outline">{NINE_BOX_LABELS[p.nine_box_cell] || p.nine_box_cell}</Badge>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => deletePDIMut.mutate(p.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Performance: {p.performance_score || "—"} · Potencial: {p.potential_score || "—"}
                    </div>
                    <div className="space-y-1">
                      {(p.actions || []).map((a: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm border-l-2 border-primary/40 pl-2">
                          <Badge variant="outline" className="text-xs">{a.type}</Badge>
                          <span className="flex-1">{a.title}</span>
                          {a.deadline && <span className="text-xs text-muted-foreground">{fmtDate(a.deadline)}</span>}
                          <Badge className={a.status === "concluida" ? "bg-green-100 text-green-800" : "bg-slate-100"}>{a.status}</Badge>
                        </div>
                      ))}
                    </div>
                    {p.notes && <p className="text-xs mt-2 p-2 bg-muted rounded">{p.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 9-BOX */}
          <TabsContent value="ninebox" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Matriz 9-Box (Performance × Potencial)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-1 text-xs">
                  <div></div>
                  <div className="text-center font-medium py-1">Potencial baixo</div>
                  <div className="text-center font-medium py-1">Potencial médio</div>
                  <div className="text-center font-medium py-1">Potencial alto</div>
                  {["alto", "medio", "baixo"].map((row) => (
                    <>
                      <div key={`lbl_${row}`} className="flex items-center justify-end pr-2 font-medium">
                        Perf.<br />{row}
                      </div>
                      {["baixo", "medio", "alto"].map((col) => {
                        const cell = `${row}_${col}`;
                        const people = nineBoxGrid[cell] || [];
                        const isTop = row === "alto" && col === "alto";
                        return (
                          <div key={cell}
                            className={`border rounded p-2 min-h-24 ${isTop ? "bg-green-50 border-green-300" : "bg-muted/30"}`}>
                            <div className="text-xs font-semibold mb-1">{NINE_BOX_LABELS[cell]}</div>
                            {people.length === 0 && <div className="text-xs text-muted-foreground">—</div>}
                            {people.map((p: any) => (
                              <div key={p.employee_id} className="text-xs bg-white border rounded px-1 py-0.5 mb-1">
                                {p.full_name}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Novo ciclo */}
      <Dialog open={openNewCycle} onOpenChange={setOpenNewCycle}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo ciclo de avaliação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={cycleForm.name} onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
                placeholder="Ex.: Avaliação Anual 2026" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={cycleForm.description}
                onChange={(e) => setCycleForm({ ...cycleForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select value={cycleForm.cycle_type} onValueChange={(v) => setCycleForm({ ...cycleForm, cycle_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="90">90° (gestor + self)</SelectItem>
                    <SelectItem value="180">180° (self + gestor)</SelectItem>
                    <SelectItem value="360">360° (self + gestor + pares + subordinados)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Escala</Label>
                <div className="flex gap-2">
                  <Input type="number" value={cycleForm.scale_min}
                    onChange={(e) => setCycleForm({ ...cycleForm, scale_min: Number(e.target.value) })} />
                  <Input type="number" value={cycleForm.scale_max}
                    onChange={(e) => setCycleForm({ ...cycleForm, scale_max: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Início</Label>
                <Input type="date" value={cycleForm.start_date}
                  onChange={(e) => setCycleForm({ ...cycleForm, start_date: e.target.value })} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={cycleForm.end_date}
                  onChange={(e) => setCycleForm({ ...cycleForm, end_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNewCycle(false)}>Cancelar</Button>
            <Button onClick={submitCycle} disabled={createCycleMut.isPending}>
              {createCycleMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe do ciclo */}
      <Dialog open={!!cycleDetailId} onOpenChange={(o) => !o && setCycleDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {cycleDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{cycleDetail.name}</span>
                  <Badge className={CYCLE_COLOR[cycleDetail.status]}>{CYCLE_STATUS[cycleDetail.status]}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Tipo:</span> {cycleDetail.cycle_type}°</div>
                  <div><span className="text-muted-foreground">Escala:</span> {cycleDetail.scale_min}—{cycleDetail.scale_max}</div>
                  <div><span className="text-muted-foreground">Início:</span> {fmtDate(cycleDetail.start_date)}</div>
                  <div><span className="text-muted-foreground">Fim:</span> {fmtDate(cycleDetail.end_date)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Competências avaliadas</p>
                  <div className="flex flex-wrap gap-1">
                    {(cycleDetail.criteria || []).map((c: any) => (
                      <Badge key={c.key} variant="outline">{c.label} ({c.weight}x)</Badge>
                    ))}
                  </div>
                </div>
                {cycleDetail.reviews?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Avaliações geradas: {cycleDetail.reviews.length}</p>
                  </div>
                )}
              </div>
              <DialogFooter className="flex-wrap gap-2">
                {cycleDetail.status === "rascunho" && (
                  <Button variant="destructive" onClick={() => { deleteCycleMut.mutate(cycleDetail.id); setCycleDetailId(null); }}>
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                  </Button>
                )}
                {["rascunho", "aberto"].includes(cycleDetail.status) && (
                  <Button onClick={() => setOpenOpenCycle(true)}>
                    <Play className="w-4 h-4 mr-2" /> Abrir ciclo
                  </Button>
                )}
                {cycleDetail.status === "em_avaliacao" && (
                  <Button variant="outline" onClick={() => { closeCycleMut.mutate(cycleDetail.id); setCycleDetailId(null); }}>
                    <StopCircle className="w-4 h-4 mr-2" /> Encerrar
                  </Button>
                )}
                <Button variant="outline" onClick={() => setCycleDetailId(null)}>Fechar</Button>
              </DialogFooter>
            </>
          ) : (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          )}
        </DialogContent>
      </Dialog>

      {/* Abrir ciclo */}
      <Dialog open={openOpenCycle} onOpenChange={setOpenOpenCycle}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Abrir ciclo de avaliação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Serão criadas as avaliações conforme o tipo do ciclo. Deixe vazio para todos os colaboradores ativos.
            </p>
            {cycleDetail?.cycle_type === "360" && (
              <div>
                <Label>Pares por colaborador</Label>
                <Input type="number" min={0} max={5} value={openParams.peers_per_employee}
                  onChange={(e) => setOpenParams({ ...openParams, peers_per_employee: Number(e.target.value) })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenOpenCycle(false)}>Cancelar</Button>
            <Button onClick={openCycle} disabled={openCycleMut.isPending}>
              {openCycleMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe da review */}
      <Dialog open={!!reviewDetailId} onOpenChange={(o) => !o && setReviewDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {reviewDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>
                    {reviewDetail.employee_name}
                    <span className="text-sm text-muted-foreground"> · {EVAL_TYPE[reviewDetail.evaluator_type]}</span>
                  </span>
                  <Badge>{REVIEW_STATUS[reviewDetail.status]}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Ciclo: {reviewDetail.cycle_name} · Escala: {reviewDetail.scale_min}—{reviewDetail.scale_max}
                </p>
                <div className="space-y-2">
                  {reviewScores.map((s, idx) => (
                    <div key={s.key} className="flex items-center gap-2 border rounded p-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-muted-foreground">Peso: {s.weight}</p>
                      </div>
                      <div className="flex gap-1">
                        {Array.from({ length: (reviewDetail.scale_max || 5) - (reviewDetail.scale_min || 1) + 1 }, (_, i) => {
                          const v = (reviewDetail.scale_min || 1) + i;
                          return (
                            <Button key={v} size="sm" variant={s.value === v ? "default" : "outline"}
                              className="w-9 h-9 p-0"
                              disabled={reviewDetail.status === "enviada"}
                              onClick={() => {
                                const arr = [...reviewScores]; arr[idx] = { ...arr[idx], value: v }; setReviewScores(arr);
                              }}>{v}</Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <Label>Pontos fortes</Label>
                  <Textarea rows={2} value={reviewText.strengths}
                    disabled={reviewDetail.status === "enviada"}
                    onChange={(e) => setReviewText({ ...reviewText, strengths: e.target.value })} />
                </div>
                <div>
                  <Label>Pontos a desenvolver</Label>
                  <Textarea rows={2} value={reviewText.improvements}
                    disabled={reviewDetail.status === "enviada"}
                    onChange={(e) => setReviewText({ ...reviewText, improvements: e.target.value })} />
                </div>
                <div>
                  <Label>Comentários gerais</Label>
                  <Textarea rows={2} value={reviewText.comments}
                    disabled={reviewDetail.status === "enviada"}
                    onChange={(e) => setReviewText({ ...reviewText, comments: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                {reviewDetail.status !== "enviada" && (
                  <>
                    <Button variant="outline" onClick={() => saveReview(false)} disabled={updateReviewMut.isPending}>
                      Salvar rascunho
                    </Button>
                    <Button onClick={() => saveReview(true)} disabled={submitReviewMut.isPending}>
                      <Send className="w-4 h-4 mr-2" /> Enviar avaliação
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setReviewDetailId(null)}>Fechar</Button>
              </DialogFooter>
            </>
          ) : (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          )}
        </DialogContent>
      </Dialog>

      {/* Nova meta */}
      <Dialog open={openNewGoal} onOpenChange={setOpenNewGoal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova meta SMART</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador *</Label>
              <Select value={goalForm.employee_id || "none"} onValueChange={(v) => setGoalForm({ ...goalForm, employee_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={goalForm.description}
                onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Métrica</Label><Input value={goalForm.metric} onChange={(e) => setGoalForm({ ...goalForm, metric: e.target.value })} placeholder="Ex.: Vendas, NPS" /></div>
              <div><Label>Unidade</Label><Input value={goalForm.unit} onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })} placeholder="R$, %, un" /></div>
              <div><Label>Meta (alvo)</Label><Input type="number" value={goalForm.target_value} onChange={(e) => setGoalForm({ ...goalForm, target_value: Number(e.target.value) })} /></div>
              <div><Label>Atual</Label><Input type="number" value={goalForm.current_value} onChange={(e) => setGoalForm({ ...goalForm, current_value: Number(e.target.value) })} /></div>
              <div><Label>Peso</Label><Input type="number" value={goalForm.weight} onChange={(e) => setGoalForm({ ...goalForm, weight: Number(e.target.value) })} /></div>
              <div><Label>Prazo</Label><Input type="date" value={goalForm.due_date} onChange={(e) => setGoalForm({ ...goalForm, due_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNewGoal(false)}>Cancelar</Button>
            <Button onClick={submitGoal} disabled={createGoalMut.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo feedback */}
      <Dialog open={openNewFb} onOpenChange={setOpenNewFb}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo feedback</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador *</Label>
              <Select value={fbForm.employee_id || "none"} onValueChange={(v) => setFbForm({ ...fbForm, employee_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select value={fbForm.feedback_type} onValueChange={(v) => setFbForm({ ...fbForm, feedback_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FEEDBACK_TYPE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={fbForm.category} onChange={(e) => setFbForm({ ...fbForm, category: e.target.value })}
                  placeholder="Ex.: Comunicação" />
              </div>
            </div>
            <div>
              <Label>Mensagem *</Label>
              <Textarea rows={4} value={fbForm.message}
                onChange={(e) => setFbForm({ ...fbForm, message: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNewFb(false)}>Cancelar</Button>
            <Button onClick={submitFeedback} disabled={createFbMut.isPending}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo PDI */}
      <Dialog open={openNewPDI} onOpenChange={setOpenNewPDI}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo PDI</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador *</Label>
              <Select value={pdiForm.employee_id || "none"} onValueChange={(v) => setPdiForm({ ...pdiForm, employee_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Performance (1-5)</Label>
                <Input type="number" min={1} max={5} step="0.1" value={pdiForm.performance_score}
                  onChange={(e) => setPdiForm({ ...pdiForm, performance_score: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Potencial (1-3)</Label>
                <Select value={String(pdiForm.potential_score)} onValueChange={(v) => setPdiForm({ ...pdiForm, potential_score: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Baixo</SelectItem>
                    <SelectItem value="2">2 - Médio</SelectItem>
                    <SelectItem value="3">3 - Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Ações de desenvolvimento</Label>
              <div className="space-y-2">
                {pdiForm.actions.map((a: any, i: number) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_120px] gap-1 items-center">
                    <Input placeholder="Ação (ex.: Curso de liderança)" value={a.title}
                      onChange={(e) => updatePDIAction(i, { title: e.target.value })} />
                    <Select value={a.type} onValueChange={(v) => updatePDIAction(i, { type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="curso">Curso</SelectItem>
                        <SelectItem value="mentoria">Mentoria</SelectItem>
                        <SelectItem value="projeto">Projeto</SelectItem>
                        <SelectItem value="leitura">Leitura</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="date" value={a.deadline}
                      onChange={(e) => updatePDIAction(i, { deadline: e.target.value })} />
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={addPDIAction}>
                  <Plus className="w-3 h-3 mr-1" /> Adicionar ação
                </Button>
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea rows={2} value={pdiForm.notes}
                onChange={(e) => setPdiForm({ ...pdiForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNewPDI(false)}>Cancelar</Button>
            <Button onClick={submitPDI} disabled={createPDIMut.isPending}>Criar PDI</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
