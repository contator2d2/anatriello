import { useState } from 'react';
import { useSupermarketAuth } from '@/contexts/SupermarketAuthContext';
import { useIncidents } from '@/hooks/use-incidents';
import { IncidentCreateDialog } from '@/components/incidents/IncidentCreateDialog';
import { IncidentDetailDialog } from '@/components/incidents/IncidentDetailDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, AlertTriangle, Brain, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open: { label: 'Aberta', variant: 'destructive' },
  under_review: { label: 'Em Análise', variant: 'secondary' },
  responded: { label: 'Respondida', variant: 'outline' },
  resolved: { label: 'Resolvida', variant: 'default' },
  escalated: { label: 'Escalada', variant: 'destructive' },
};

const SEVERITY_LABELS: Record<string, { label: string; className: string }> = {
  low: { label: 'Leve', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  medium: { label: 'Médio', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  high: { label: 'Grave', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const RISK_COLORS: Record<string, string> = {
  baixo: 'text-green-600',
  medio: 'text-orange-600',
  alto: 'text-red-600',
};

export default function SupermarketIncidents() {
  const { user } = useSupermarketAuth();
  const { incidents, isLoading, createIncident, respondIncident, analyzeIncident } = useIncidents('supermarket');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = incidents.filter((i: any) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    const searchLower = search.toLowerCase();
    if (search && !(
      i.promoter_name?.toLowerCase().includes(searchLower) ||
      i.description?.toLowerCase().includes(searchLower) ||
      i.ai_classification?.summary?.toLowerCase().includes(searchLower) ||
      i.ai_classification?.keywords?.some((k: string) => k.toLowerCase().includes(searchLower))
    )) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ocorrências</h1>
          <p className="text-muted-foreground">Registre e acompanhe problemas com promotores</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Ocorrência
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, descrição ou palavras-chave IA..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="open">Abertas</SelectItem>
            <SelectItem value="under_review">Em Análise</SelectItem>
            <SelectItem value="responded">Respondidas</SelectItem>
            <SelectItem value="resolved">Resolvidas</SelectItem>
            <SelectItem value="escalated">Escaladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma ocorrência encontrada</p>
        ) : filtered.map((inc: any) => {
          const st = STATUS_LABELS[inc.status] || STATUS_LABELS.open;
          const sv = SEVERITY_LABELS[inc.severity] || SEVERITY_LABELS.low;
          const ai = inc.ai_classification;
          return (
            <div key={inc.id} className="p-4 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelected(inc)}>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${inc.severity === 'high' ? 'text-destructive' : inc.severity === 'medium' ? 'text-orange-500' : 'text-yellow-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{inc.promoter_name || 'Promotor'}</p>
                    <p className="text-xs text-muted-foreground truncate">{inc.agency_name} • {inc.description?.slice(0, 80)}</p>
                    {/* AI summary */}
                    {ai?.summary && (
                      <p className="text-xs text-primary mt-1 flex items-center gap-1">
                        <Brain className="h-3 w-3 shrink-0" />
                        <span className="truncate">{ai.summary}</span>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {inc.incident_date ? format(new Date(inc.incident_date), 'dd/MM/yyyy HH:mm') : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {ai?.risk && (
                    <Badge variant="outline" className={`text-[10px] ${RISK_COLORS[ai.risk] || ''}`}>
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                      Risco {ai.risk}
                    </Badge>
                  )}
                  <Badge className={sv.className}>{sv.label}</Badge>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
              </div>
              {/* AI keywords */}
              {ai?.keywords?.length > 0 && (
                <div className="flex gap-1 mt-2 ml-8 flex-wrap">
                  {ai.keywords.slice(0, 4).map((kw: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0">{kw}</Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <IncidentCreateDialog open={showCreate} onOpenChange={setShowCreate}
        onSubmit={(data) => { createIncident.mutate(data); setShowCreate(false); }}
        isSubmitting={createIncident.isPending} />

      <IncidentDetailDialog open={!!selected} onOpenChange={() => setSelected(null)}
        incident={selected} canRespond responderType="supermarket" responderName={user?.unit_name}
        onRespond={(data) => respondIncident.mutate(data)}
        onAnalyze={(id) => analyzeIncident.mutate(id)}
        isAnalyzing={analyzeIncident.isPending} />
    </div>
  );
}
