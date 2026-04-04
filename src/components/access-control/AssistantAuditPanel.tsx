import { useAssistantLog } from '@/hooks/use-incidents';
import { Badge } from '@/components/ui/badge';
import { Bot, Phone, MessageSquare, AlertTriangle, ShieldX } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  portal?: 'supermarket' | 'admin';
}

const TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  query: { label: 'Consulta', icon: MessageSquare },
  incident_creation: { label: 'Ocorrência', icon: AlertTriangle },
  score_check: { label: 'Score', icon: Bot },
  schedule_check: { label: 'Agenda', icon: Bot },
  unauthorized: { label: 'Não Autorizado', icon: ShieldX },
};

export default function AssistantAuditPanel({ portal = 'supermarket' }: Props) {
  const { logs, isLoading } = useAssistantLog(portal);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" /> Histórico do Assistente
        </h2>
        <p className="text-sm text-muted-foreground">Todas as interações do assistente WhatsApp</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-4">Carregando...</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <Bot className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma interação registrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => {
            const typeInfo = TYPE_LABELS[log.interaction_type] || TYPE_LABELS.query;
            const Icon = typeInfo.icon;
            return (
              <div key={log.id} className={`p-3 rounded-lg border bg-card ${!log.authorized ? 'border-destructive/30 bg-destructive/5' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <Badge variant={log.authorized ? 'outline' : 'destructive'} className="text-[10px]">
                      {typeInfo.label}
                    </Badge>
                    {log.contact_name && <span className="text-xs font-medium">{log.contact_name}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {log.phone}
                    <span>{format(new Date(log.created_at), 'dd/MM HH:mm')}</span>
                  </div>
                </div>
                {log.user_message && (
                  <div className="mb-1">
                    <p className="text-xs text-muted-foreground">Pergunta:</p>
                    <p className="text-sm bg-muted/50 rounded p-2">{log.user_message}</p>
                  </div>
                )}
                {log.ai_response && (
                  <div>
                    <p className="text-xs text-muted-foreground">Resposta:</p>
                    <p className="text-sm bg-primary/5 rounded p-2">{log.ai_response}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
