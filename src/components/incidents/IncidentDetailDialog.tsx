import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { AlertTriangle, Clock, MessageSquare, Send, User, Brain, Sparkles, Tag, Shield, TrendingUp, Loader2 } from "lucide-react";
import type { Incident } from "@/hooks/use-incidents";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: Incident | null;
  onRespond?: (data: { id: string; message: string; new_status?: string; responder_type: string; responder_name?: string }) => void;
  onAnalyze?: (id: string) => void;
  isAnalyzing?: boolean;
  canRespond?: boolean;
  responderType?: string;
  responderName?: string;
}

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

const TYPE_LABELS: Record<string, string> = {
  delay: 'Atraso',
  misconduct: 'Comportamento Inadequado',
  non_execution: 'Não Execução',
  product_issue: 'Problema com Produto',
  other: 'Outro',
  atraso: 'Atraso',
  ausencia: 'Ausência',
  saida_antecipada: 'Saída Antecipada',
  nao_execucao: 'Não Execução',
  execucao_incompleta: 'Execução Incompleta',
  comportamento_inadequado: 'Comportamento Inadequado',
  desacordo_equipe: 'Desacordo com Equipe',
  falha_operacional: 'Falha Operacional',
  outro: 'Outro',
};

const IMPACT_LABELS: Record<string, { label: string; icon: string }> = {
  operacional: { label: 'Operacional', icon: '⚙️' },
  relacionamento: { label: 'Relacionamento', icon: '🤝' },
  financeiro: { label: 'Financeiro', icon: '💰' },
  reputacional: { label: 'Reputacional', icon: '📢' },
};

const RISK_COLORS: Record<string, string> = {
  baixo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medio: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  alto: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export const IncidentDetailDialog = ({ open, onOpenChange, incident, onRespond, onAnalyze, isAnalyzing, canRespond, responderType = 'admin', responderName }: Props) => {
  const [replyMessage, setReplyMessage] = useState('');
  const [newStatus, setNewStatus] = useState('');

  if (!incident) return null;

  const statusInfo = STATUS_LABELS[incident.status] || STATUS_LABELS.open;
  const severityInfo = SEVERITY_LABELS[incident.severity] || SEVERITY_LABELS.low;
  const ai = incident.ai_classification as any;

  const handleRespond = () => {
    if (!replyMessage.trim() || !onRespond) return;
    onRespond({
      id: incident.id,
      message: replyMessage,
      new_status: newStatus || undefined,
      responder_type: responderType,
      responder_name: responderName,
    });
    setReplyMessage('');
    setNewStatus('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Ocorrência #{incident.id.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header info */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            <Badge className={severityInfo.className}>{severityInfo.label}</Badge>
            <Badge variant="outline">{TYPE_LABELS[incident.incident_type] || incident.incident_type}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Promotor</p>
              <p className="font-medium">{incident.promoter_name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Agência</p>
              <p className="font-medium">{incident.agency_name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Unidade</p>
              <p className="font-medium">{incident.unit_name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Data</p>
              <p className="font-medium">
                {incident.incident_date ? format(new Date(incident.incident_date), 'dd/MM/yyyy HH:mm') : '—'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Descrição</p>
            <p className="text-sm bg-muted/50 rounded-lg p-3">{incident.description}</p>
          </div>

          {/* AI Analysis Section */}
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> Análise Inteligente (IA)
              </h3>
              {onAnalyze && (
                <Button variant="outline" size="sm" onClick={() => onAnalyze(incident.id)} disabled={isAnalyzing} className="gap-1.5">
                  {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {ai ? 'Reanalisar' : 'Analisar com IA'}
                </Button>
              )}
            </div>

            {ai ? (
              <div className="space-y-3 bg-primary/5 border border-primary/20 rounded-lg p-4">
                {/* AI Summary */}
                {ai.summary && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Resumo IA</p>
                    <p className="text-sm font-medium">{ai.summary}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* AI Type */}
                  {ai.type && (
                    <div className="text-center p-2 rounded-md bg-background border">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo IA</p>
                      <p className="text-xs font-medium mt-0.5">{TYPE_LABELS[ai.type] || ai.type}</p>
                    </div>
                  )}
                  {/* AI Severity */}
                  {ai.severity && (
                    <div className="text-center p-2 rounded-md bg-background border">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gravidade IA</p>
                      <Badge className={`mt-0.5 text-[10px] ${SEVERITY_LABELS[ai.severity === 'baixa' ? 'low' : ai.severity === 'media' ? 'medium' : ai.severity === 'alta' ? 'high' : 'low']?.className || ''}`}>
                        {ai.severity}
                      </Badge>
                    </div>
                  )}
                  {/* Impact */}
                  {ai.impact && (
                    <div className="text-center p-2 rounded-md bg-background border">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Impacto</p>
                      <p className="text-xs font-medium mt-0.5">{IMPACT_LABELS[ai.impact]?.icon} {IMPACT_LABELS[ai.impact]?.label || ai.impact}</p>
                    </div>
                  )}
                  {/* Risk */}
                  {ai.risk && (
                    <div className="text-center p-2 rounded-md bg-background border">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Risco</p>
                      <Badge className={`mt-0.5 text-[10px] ${RISK_COLORS[ai.risk] || ''}`}>{ai.risk}</Badge>
                    </div>
                  )}
                </div>

                {/* Keywords */}
                {ai.keywords?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Tag className="h-3 w-3" /> Palavras-chave</p>
                    <div className="flex flex-wrap gap-1">
                      {ai.keywords.map((kw: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {ai.analyzed_at && (
                  <p className="text-[10px] text-muted-foreground">Analisado em {format(new Date(ai.analyzed_at), 'dd/MM/yyyy HH:mm')}</p>
                )}
              </div>
            ) : (
              <div className="text-center py-4 bg-muted/30 rounded-lg border border-dashed">
                <Brain className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Análise IA não disponível</p>
                <p className="text-xs text-muted-foreground">Clique em "Analisar com IA" para classificar automaticamente</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <Separator />
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Histórico
            </h3>
            <div className="space-y-3">
              {/* Creation event */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium">Ocorrência criada por {incident.reported_by_user_name || 'Sistema'}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {format(new Date(incident.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {/* Responses */}
              {(incident.responses || []).map(r => (
                <div key={r.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{r.responder_name || r.responder_type}</p>
                    <p className="text-sm bg-muted/50 rounded-lg p-2 mt-1">{r.message}</p>
                    {r.new_status && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        Status → {STATUS_LABELS[r.new_status]?.label || r.new_status}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reply */}
          {canRespond && incident.status !== 'resolved' && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Responder</h3>
                <Textarea rows={3} value={replyMessage} onChange={e => setReplyMessage(e.target.value)}
                  placeholder="Digite sua resposta..." />
                <div className="flex items-center gap-3">
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Alterar status (opcional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="under_review">Em Análise</SelectItem>
                      <SelectItem value="responded">Respondida</SelectItem>
                      <SelectItem value="resolved">Resolvida</SelectItem>
                      <SelectItem value="escalated">Escalada</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleRespond} disabled={!replyMessage.trim()} className="gap-2 ml-auto">
                    <Send className="h-4 w-4" /> Enviar
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
