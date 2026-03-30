import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePromotorHome, usePromotorPunch } from "@/hooks/use-promotor";
import { PromotorLayout } from "./PromotorLayout";
import {
  Clock, FileText, Bell, MapPin, Wifi, WifiOff, Navigation, AlertTriangle, CheckCircle2, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PromotorHome() {
  const { data, isLoading } = usePromotorHome();
  const punch = usePromotorPunch();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [gpsStatus, setGpsStatus] = useState<'checking' | 'active' | 'denied' | 'off'>('checking');
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [punchLoading, setPunchLoading] = useState(false);

  const employee = data?.employee;
  const todayPunches = data?.today_punches || [];
  const pendingDocs = data?.pending_docs_count || 0;
  const notifications = data?.notifications || [];
  const dailyAssignment = data?.daily_assignment;
  const availablePdvs = data?.available_pdvs || [];

  useEffect(() => {
    const onOn = () => setIsOnline(true);
    const onOff = () => setIsOnline(false);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);
    return () => { window.removeEventListener('online', onOn); window.removeEventListener('offline', onOff); };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus('off'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); setGpsStatus('active'); },
      (err) => { setGpsStatus(err.code === 1 ? 'denied' : 'off'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const getNextPunchType = () => {
    const types = ['entrada', 'saida_intervalo', 'retorno_intervalo', 'saida'];
    return types[todayPunches.length] || 'extraordinaria';
  };

  const PUNCH_LABELS: Record<string, string> = {
    entrada: '🟢 Entrada', saida_intervalo: '🟡 Saída Intervalo', retorno_intervalo: '🔵 Retorno Intervalo', saida: '🔴 Saída', extraordinaria: '⚪ Extra'
  };

  const handlePunch = async () => {
    if (gpsStatus !== 'active' || !currentPos) {
      toast({ title: 'GPS necessário', description: 'Ative a localização para bater o ponto', variant: 'destructive' });
      return;
    }
    setPunchLoading(true);
    try {
      const pdvId = dailyAssignment?.pdv_id || availablePdvs[0]?.id;
      await punch.mutateAsync({
        punch_type: getNextPunchType(),
        latitude: currentPos.lat,
        longitude: currentPos.lng,
        accuracy_meters: currentPos.accuracy,
        pdv_id: pdvId,
      });
      toast({ title: 'Ponto registrado!', description: PUNCH_LABELS[getNextPunchType()] });
    } catch (err: any) {
      toast({ title: 'Erro ao registrar ponto', description: err.message, variant: 'destructive' });
    } finally {
      setPunchLoading(false);
    }
  };

  if (isLoading) return <PromotorLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></PromotorLayout>;

  return (
    <PromotorLayout>
      <div className="space-y-4 p-4 max-w-lg mx-auto">
        {/* Status bar */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {isOnline ? <Badge variant="outline" className="text-green-600 border-green-300"><Wifi className="h-3 w-3 mr-1" />Online</Badge>
              : <Badge variant="destructive"><WifiOff className="h-3 w-3 mr-1" />Offline</Badge>}
            {gpsStatus === 'active' ? <Badge variant="outline" className="text-green-600 border-green-300"><Navigation className="h-3 w-3 mr-1" />GPS</Badge>
              : <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />GPS {gpsStatus === 'denied' ? 'Negado' : 'Desligado'}</Badge>}
          </div>
          <span className="text-muted-foreground">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
        </div>

        {/* GPS Warning */}
        {gpsStatus !== 'active' && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">GPS está desligado</p>
                <p className="text-xs text-muted-foreground">Ative a localização para registrar o ponto</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Offline Warning */}
        {!isOnline && (
          <Card className="border-warning bg-warning/5">
            <CardContent className="p-3 flex items-center gap-3">
              <WifiOff className="h-5 w-5 text-warning flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Você está sem internet</p>
                <p className="text-xs text-muted-foreground">Os dados serão salvos e enviados quando a conexão voltar</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Welcome */}
        <div>
          <h1 className="text-lg font-bold">Olá, {employee?.full_name?.split(' ')[0]}! 👋</h1>
          <p className="text-sm text-muted-foreground">{employee?.position || employee?.worker_profile}</p>
        </div>

        {/* PDV do dia */}
        {dailyAssignment && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">PDV do dia</p>
                <p className="text-xs text-muted-foreground">{dailyAssignment.pdv_name}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PUNCH BUTTON */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Button
              onClick={handlePunch}
              disabled={punchLoading || gpsStatus !== 'active'}
              className="w-full h-24 rounded-none text-lg font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              {punchLoading ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : <Clock className="h-6 w-6 mr-2" />}
              {PUNCH_LABELS[getNextPunchType()] || 'Bater Ponto'}
            </Button>
            {todayPunches.length > 0 && (
              <div className="p-3 border-t space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Registros de hoje:</p>
                {todayPunches.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span>{PUNCH_LABELS[p.punch_type] || p.punch_type}</span>
                    <span className="text-muted-foreground">{format(new Date(p.punched_at), 'HH:mm')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/promotor/documentos')}>
            <CardContent className="p-4 text-center">
              <FileText className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-sm font-medium">Documentos</p>
              {pendingDocs > 0 && <Badge variant="destructive" className="mt-1">{pendingDocs} pendentes</Badge>}
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/promotor/ponto')}>
            <CardContent className="p-4 text-center">
              <Clock className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-sm font-medium">Meu Ponto</p>
              <p className="text-xs text-muted-foreground">{todayPunches.length} registros</p>
            </CardContent>
          </Card>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4" /> Notificações</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {notifications.slice(0, 3).map((n: any) => (
                <div key={n.id} className="flex items-start gap-2 text-xs p-2 bg-muted/50 rounded-lg">
                  <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted-foreground">{n.message}</p>
                  </div>
                </div>
              ))}
              {notifications.length > 3 && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate('/promotor/notificacoes')}>
                  Ver todas ({notifications.length})
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PromotorLayout>
  );
}
