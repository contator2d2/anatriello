import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { AlertTriangle, Clock, MessageSquare, Send, User } from "lucide-react";
import type { Incident } from "@/hooks/use-incidents";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: Incident | null;
  onRespond?: (data: { id: string; message: string; new_status?: string; responder_type: string; responder_name?: string }) => void;
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
};

export const IncidentDetailDialog = ({ open, onOpenChange, incident, onRespond, canRespond, responderType = 'admin', responderName }: Props) => {
  const [replyMessage, setReplyMessage] = useState('');
  const [newStatus, setNewStatus] = useState('');

  if (!incident) return null;

  const statusInfo = STATUS_LABELS[incident.status] || STATUS_LABELS.open;
  const severityInfo = SEVERITY_LABELS[incident.severity] || SEVERITY_LABELS.low;

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
