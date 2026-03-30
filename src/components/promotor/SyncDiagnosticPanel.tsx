import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wifi, WifiOff, CheckCircle2, Clock, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePromotorPunches } from "@/hooks/use-promotor";
import { format, subDays } from "date-fns";
import { useState, useEffect } from "react";

export function SyncDiagnosticPanel() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const startDate = subDays(new Date(), 7).toISOString().slice(0, 10);
  const { data: punches = [], isLoading, refetch } = usePromotorPunches({ start_date: startDate });

  useEffect(() => {
    const onOn = () => setIsOnline(true);
    const onOff = () => setIsOnline(false);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);
    return () => { window.removeEventListener('online', onOn); window.removeEventListener('offline', onOff); };
  }, []);

  const synced = punches.filter((p: any) => p.sync_status === 'synced');
  const pending = punches.filter((p: any) => p.sync_status === 'pending');
  const offline = punches.filter((p: any) => p.is_offline);

  // Check offline queue in localStorage
  const offlineQueue = JSON.parse(localStorage.getItem('promotor_offline_queue') || '[]');

  return (
    <Card>
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Central de Diagnóstico
          </span>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 text-xs">
            Atualizar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">
        {/* Connection Status */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
          {isOnline ? (
            <>
              <Wifi className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-600">Online</p>
                <p className="text-[10px] text-muted-foreground">Conectado ao servidor</p>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-600">Offline</p>
                <p className="text-[10px] text-muted-foreground">Dados serão sincronizados quando a conexão voltar</p>
              </div>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 mx-auto text-green-600 mb-1" />
            <p className="text-lg font-bold text-green-700">{synced.length}</p>
            <p className="text-[10px] text-green-600">Sincronizados</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
            <Clock className="h-4 w-4 mx-auto text-yellow-600 mb-1" />
            <p className="text-lg font-bold text-yellow-700">{pending.length + offlineQueue.length}</p>
            <p className="text-[10px] text-yellow-600">Pendentes</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <WifiOff className="h-4 w-4 mx-auto text-blue-600 mb-1" />
            <p className="text-lg font-bold text-blue-700">{offline.length}</p>
            <p className="text-[10px] text-blue-600">Originados Offline</p>
          </div>
        </div>

        {/* Offline Queue Alert */}
        {offlineQueue.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-yellow-700">{offlineQueue.length} evento(s) na fila offline</p>
              <p className="text-[10px] text-yellow-600">Serão enviados automaticamente quando voltar a conexão</p>
            </div>
          </div>
        )}

        {/* Recent Punches */}
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : punches.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Últimos registros (7 dias)</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {punches.slice(0, 10).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-xs p-1.5 bg-muted/20 rounded">
                  <div className="flex items-center gap-2">
                    <span>{format(new Date(p.punched_at), 'dd/MM HH:mm')}</span>
                    <span className="text-muted-foreground">{p.punch_type}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.is_offline && <Badge variant="outline" className="text-[9px] h-4">Offline</Badge>}
                    <Badge variant={p.sync_status === 'synced' ? 'default' : 'secondary'} className="text-[9px] h-4">
                      {p.sync_status === 'synced' ? '✓' : '⏳'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-center text-muted-foreground py-2">Nenhum registro nos últimos 7 dias</p>
        )}
      </CardContent>
    </Card>
  );
}
