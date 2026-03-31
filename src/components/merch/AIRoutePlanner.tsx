import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, ArrowRight, ArrowLeft, Check, Clock, MapPin, User, AlertTriangle, TrendingUp, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useOptimizationContext, useAIOptimize, useAIApprove } from "@/hooks/use-merch-routes";
import { useBrands } from "@/hooks/use-merchandising";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

interface AIRoutePlannerProps {
  open: boolean;
  onClose: () => void;
}

export default function AIRoutePlanner({ open, onClose }: AIRoutePlannerProps) {
  const [step, setStep] = useState(1);
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(addDays(new Date(), 6), 'yyyy-MM-dd'));
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedPromoterIds, setSelectedPromoterIds] = useState<string[]>([]);
  const [region, setRegion] = useState('');
  const [maxVisitsPerDay, setMaxVisitsPerDay] = useState(6);
  const [maxHoursPerDay, setMaxHoursPerDay] = useState(8);
  const [defaultDuration, setDefaultDuration] = useState(60);
  const [additionalRules, setAdditionalRules] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  const { data: brands = [] } = useBrands();
  const { data: context, isLoading: loadingContext } = useOptimizationContext({
    date_from: dateFrom,
    date_to: dateTo,
    brand_id: selectedBrand || undefined,
    region: region || undefined,
  });

  const optimizeMutation = useAIOptimize();
  const approveMutation = useAIApprove();

  const promoters = context?.promoters || [];
  const pdvs = context?.pdvs || [];
  const existingRoutes = context?.existing_routes || [];

  const filteredPromoters = useMemo(() => {
    if (!selectedBrand) return promoters;
    return promoters.filter((p: any) => {
      const brands = Array.isArray(p.brand_ids) ? p.brand_ids : [];
      return brands.includes(selectedBrand) || brands.length === 0;
    });
  }, [promoters, selectedBrand]);

  const togglePromoter = (id: string) => {
    setSelectedPromoterIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSuggestion = (idx: number) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAllSuggestions = () => {
    setSelectedSuggestions(new Set(suggestions.map((_, i) => i)));
  };

  const handleGenerate = async () => {
    const selectedP = selectedPromoterIds.length > 0
      ? promoters.filter((p: any) => selectedPromoterIds.includes(p.id))
      : promoters;

    if (selectedP.length === 0) {
      toast.error('Selecione ao menos um promotor');
      return;
    }
    if (pdvs.length === 0) {
      toast.error('Nenhum PDV encontrado para os filtros selecionados');
      return;
    }

    try {
      const result = await optimizeMutation.mutateAsync({
        promoters: selectedP,
        pdvs,
        existing_routes: existingRoutes,
        date_from: dateFrom,
        date_to: dateTo,
        brand_id: selectedBrand || null,
        rules: {
          max_visits_per_day: maxVisitsPerDay,
          max_hours_per_day: maxHoursPerDay,
          default_visit_duration: defaultDuration,
          additional_rules: additionalRules,
        },
      });
      setSuggestions(result.suggestions || []);
      setInsights(result.insights || []);
      setMetrics(result.metrics || null);
      setSelectedSuggestions(new Set((result.suggestions || []).map((_: any, i: number) => i)));
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar sugestões');
    }
  };

  const handleApprove = async () => {
    const toApprove = suggestions.filter((_, i) => selectedSuggestions.has(i));
    if (toApprove.length === 0) {
      toast.error('Selecione ao menos uma sugestão');
      return;
    }
    try {
      const result = await approveMutation.mutateAsync({ suggestions: toApprove });
      toast.success(`${result.created} rota(s) criada(s) com sucesso!`);
      onClose();
      resetState();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao aprovar sugestões');
    }
  };

  const resetState = () => {
    setStep(1);
    setSuggestions([]);
    setInsights([]);
    setMetrics(null);
    setSelectedSuggestions(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); resetState(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Planejamento Inteligente com IA
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-4">
          {[
            { n: 1, label: 'Configurar' },
            { n: 2, label: 'Selecionar' },
            { n: 3, label: 'Resultados' },
          ].map(({ n, label }) => (
            <div key={n} className="flex items-center gap-1">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold
                ${step >= n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {step > n ? <Check className="h-4 w-4" /> : n}
              </div>
              <span className={`text-xs ${step >= n ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{label}</span>
              {n < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 1: Configuration */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data Início *</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Data Fim *</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Marca (opcional)</Label>
                <Select value={selectedBrand || "__all__"} onValueChange={v => setSelectedBrand(v === "__all__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as Marcas</SelectItem>
                    {brands.filter((b: any) => b?.id).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Região (opcional)</Label>
                <Input placeholder="Ex: São Paulo" value={region} onChange={e => setRegion(e.target.value)} />
              </div>
            </div>

            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm">Regras de Otimização</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Max visitas/dia</Label>
                    <Input type="number" value={maxVisitsPerDay} onChange={e => setMaxVisitsPerDay(+e.target.value)} min={1} max={12} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Max horas/dia</Label>
                    <Input type="number" value={maxHoursPerDay} onChange={e => setMaxHoursPerDay(+e.target.value)} min={4} max={12} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Duração padrão (min)</Label>
                    <Input type="number" value={defaultDuration} onChange={e => setDefaultDuration(+e.target.value)} min={15} max={240} />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Regras adicionais</Label>
                  <Textarea placeholder="Ex: PDV X deve ser visitado na segunda. Promotor Y prefere manhãs..."
                    value={additionalRules} onChange={e => setAdditionalRules(e.target.value)} rows={2} />
                </div>
              </CardContent>
            </Card>

            {/* Context summary */}
            {loadingContext ? (
              <div className="text-sm text-muted-foreground text-center py-4">Carregando dados...</div>
            ) : (
              <div className="flex gap-3 flex-wrap">
                <Badge variant="secondary"><User className="h-3 w-3 mr-1" />{promoters.length} promotores</Badge>
                <Badge variant="secondary"><MapPin className="h-3 w-3 mr-1" />{pdvs.length} PDVs</Badge>
                <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{existingRoutes.length} rotas existentes</Badge>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select promoters */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Selecione os promotores para incluir na otimização:</p>
              <Button variant="outline" size="sm" onClick={() => {
                if (selectedPromoterIds.length === filteredPromoters.length) setSelectedPromoterIds([]);
                else setSelectedPromoterIds(filteredPromoters.map((p: any) => p.id));
              }}>
                {selectedPromoterIds.length === filteredPromoters.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
              {filteredPromoters.map((p: any) => (
                <div key={p.id}
                  onClick={() => togglePromoter(p.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${selectedPromoterIds.includes(p.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <Checkbox checked={selectedPromoterIds.includes(p.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.existing_routes || 0} rotas no período •
                      {p.home_latitude ? ' 📍 Com localização' : ' ⚠️ Sem localização'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredPromoters.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum promotor encontrado para os filtros selecionados
              </div>
            )}
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Metrics */}
            {metrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{metrics.total_visits || suggestions.length}</div>
                    <div className="text-[10px] text-muted-foreground">Visitas Sugeridas</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{metrics.total_travel_hours_estimated || '—'}</div>
                    <div className="text-[10px] text-muted-foreground">Horas Deslocamento</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{metrics.avg_visits_per_day || '—'}</div>
                    <div className="text-[10px] text-muted-foreground">Média/Dia</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{metrics.conflicts_avoided || 0}</div>
                    <div className="text-[10px] text-muted-foreground">Conflitos Evitados</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Insights */}
            {insights.length > 0 && (
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Insights da IA</span>
                  </div>
                  <ul className="space-y-1">
                    {insights.map((insight, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <Sparkles className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Suggestions list */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{suggestions.length} sugestão(ões)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllSuggestions}>
                  Selecionar todas
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedSuggestions(new Set())}>
                  Limpar seleção
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {suggestions.map((s: any, i: number) => (
                <div key={i}
                  onClick={() => toggleSuggestion(i)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors
                    ${selectedSuggestions.has(i) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <Checkbox checked={selectedSuggestions.has(i)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{s.visit_date}</span>
                      <span className="font-mono text-xs">{s.scheduled_time}</span>
                      <span className="font-semibold truncate">{s.pdv_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span><User className="inline h-3 w-3" /> {s.promoter_name}</span>
                      <span>• {s.brand_name}</span>
                      <span>• {s.estimated_duration_min || 60}min</span>
                    </div>
                    {s.reason && <div className="text-[10px] text-muted-foreground mt-0.5 italic">💡 {s.reason}</div>}
                  </div>
                  {selectedSuggestions.has(i) ? (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {suggestions.length === 0 && !optimizeMutation.isPending && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                Nenhuma sugestão gerada. Verifique os filtros e tente novamente.
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!dateFrom || !dateTo}>
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={handleGenerate} disabled={optimizeMutation.isPending}>
                {optimizeMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> Gerar Rotas Inteligentes</>
                )}
              </Button>
            )}
            {step === 3 && (
              <>
                <Button variant="outline" onClick={() => { setStep(2); setSuggestions([]); }}>
                  Regerar
                </Button>
                <Button onClick={handleApprove} disabled={selectedSuggestions.size === 0 || approveMutation.isPending}>
                  {approveMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando...</>
                  ) : (
                    <><Check className="h-4 w-4 mr-1" /> Aprovar {selectedSuggestions.size} rota(s)</>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
