import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRhOvertimeRequests, useApproveOvertimeRequest } from "@/hooks/use-promotor";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Check, X, Loader2 } from "lucide-react";
import { format } from "date-fns";

function safeFormatDate(value: any, fmt: string, fallback = '—'): string {
  if (!value) return fallback;
  const d = new Date(String(value).replace(' ', 'T'));
  return d && !Number.isNaN(d.getTime()) ? format(d, fmt) : fallback;
}

function formatWorkSchedule(ws: any): string {
  if (!ws) return '—';
  try {
    const obj = typeof ws === 'string' ? JSON.parse(ws) : ws;
    if (obj.entry && obj.exit) {
      const days = obj.days;
      const activeDays = days
        ? Object.entries(days)
            .filter(([, v]) => v)
            .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
            .join(', ')
        : '';
      return `${obj.entry}–${obj.exit}${activeDays ? ` (${activeDays})` : ''}`;
    }
    return String(ws);
  } catch {
    return String(ws);
  }
}

interface Props {
  statusFilter?: string;
  compact?: boolean;
}

export function OvertimeRequestsPanel({ statusFilter = 'pendente', compact = false }: Props) {
  const { data: otRequests = [], isLoading } = useRhOvertimeRequests({ status: statusFilter === 'all' ? undefined : statusFilter });
  const approveOt = useApproveOvertimeRequest();
  const { toast } = useToast();
  const [otNotes, setOtNotes] = useState<Record<string, string>>({});

  const handleOtAction = async (id: string, status: 'aprovado' | 'recusado') => {
    try {
      await approveOt.mutateAsync({ id, status, supervisor_notes: otNotes[id] || '' });
      toast({ title: status === 'aprovado' ? 'Hora extra aprovada!' : 'Hora extra recusada' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (otRequests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {statusFilter === 'pendente' ? 'Nenhuma solicitação pendente' : 'Nenhuma solicitação encontrada'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {otRequests.map((ot: any) => (
        <div key={ot.id} className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/10 border border-purple-200 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium">{ot.employee_name}</p>
              <p className="text-xs text-muted-foreground">{ot.position} • Jornada: {formatWorkSchedule(ot.work_schedule)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={ot.status === 'aprovado' ? 'default' : ot.status === 'recusado' ? 'destructive' : 'secondary'} className="text-[10px]">
                {ot.status === 'aprovado' ? 'Aprovado' : ot.status === 'recusado' ? 'Recusado' : 'Pendente'}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {safeFormatDate(ot.request_date ? ot.request_date + 'T12:00:00' : ot.created_at, 'dd/MM')}
              </Badge>
            </div>
          </div>
          <p className="text-sm bg-background/80 rounded p-2"><b>Motivo:</b> {ot.reason}</p>
          {(ot.requested_start || ot.requested_end) && (
            <p className="text-xs text-muted-foreground">
              Horário solicitado: {ot.requested_start || '—'} a {ot.requested_end || '—'}
            </p>
          )}
          {ot.status === 'pendente' && (
            <>
              <Textarea
                placeholder="Observação (opcional)..."
                value={otNotes[ot.id] || ''}
                onChange={e => setOtNotes(n => ({ ...n, [ot.id]: e.target.value }))}
                rows={2}
                className="text-xs"
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="destructive" onClick={() => handleOtAction(ot.id, 'recusado')} disabled={approveOt.isPending} className="gap-1 text-xs">
                  <X className="h-3.5 w-3.5" /> Recusar
                </Button>
                <Button size="sm" onClick={() => handleOtAction(ot.id, 'aprovado')} disabled={approveOt.isPending} className="gap-1 text-xs">
                  <Check className="h-3.5 w-3.5" /> Aprovar
                </Button>
              </div>
            </>
          )}
          {ot.status !== 'pendente' && ot.supervisor_notes && (
            <p className="text-xs text-muted-foreground italic">Obs: {ot.supervisor_notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function useOvertimePendingCount() {
  const { data: otRequests = [] } = useRhOvertimeRequests({ status: 'pendente' });
  return otRequests.length;
}
