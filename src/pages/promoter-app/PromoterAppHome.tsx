import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePromoterAppAuth } from '@/contexts/PromoterAppAuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  QrCode, LogOut, Calendar, MapPin, Clock, CheckCircle2,
  AlertTriangle, History, Loader2,
} from 'lucide-react';

type Me = {
  user: { name: string; cpf: string; agency_name: string; doc_status: string };
  today: string;
  schedules: Array<{ id: string; unit_name: string; city?: string; state?: string; start_time: string; end_time: string; tolerance_min: number; }>;
  open_visit: any | null;
};

export default function PromoterAppHome() {
  const navigate = useNavigate();
  const { user, logout } = usePromoterAppAuth();
  const [data, setData] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/p/login', { replace: true }); return; }
    api<Me>('/api/promoter-app/me').then(setData).finally(() => setLoading(false));
  }, [user, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const docOk = data?.user.doc_status === 'active';

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{data?.user.agency_name}</p>
            <p className="font-semibold leading-tight">{data?.user.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { logout(); navigate('/p/login'); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {!docOk && (
          <Card className="border-amber-400 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="py-3 flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Sua documentação está pendente. Procure sua agência.
            </CardContent>
          </Card>
        )}

        {data?.open_visit ? (
          <Card className="border-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Visita em andamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">{data.open_visit.unit_name}</p>
              <p className="text-xs text-muted-foreground">
                Entrada: {new Date(data.open_visit.checkin_at).toLocaleTimeString('pt-BR')}
              </p>
              <Button className="w-full" onClick={() => navigate('/p/visit')}>
                Registrar saída
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Button
            size="lg" className="w-full h-20 text-base"
            onClick={() => navigate('/p/scanner')} disabled={!docOk}
          >
            <QrCode className="h-7 w-7 mr-2" /> Escanear QR do PDV
          </Button>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Escalas de hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.schedules.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma escala hoje.</p>
            )}
            {data?.schedules.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm border-b last:border-b-0 py-2">
                <div>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {s.unit_name}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">±{s.tolerance_min}min</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => navigate('/p/history')}>
          <History className="h-4 w-4 mr-2" /> Meu histórico
        </Button>
      </div>
    </div>
  );
}
