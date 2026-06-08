import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Clock, MapPin, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PromoterAppVisit() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<any>('/api/promoter-app/me').then((d) => {
      setVisit(d.open_visit);
    }).finally(() => setLoading(false));
  }, []);

  const checkout = async () => {
    setSubmitting(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 })
      ).catch(() => null);
      await api('/api/promoter-app/checkout', {
        method: 'POST',
        body: { lat: pos?.coords.latitude ?? null, lng: pos?.coords.longitude ?? null },
      });
      toast({ title: 'Saída do PDV registrada' });
      navigate('/p/home');
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!visit) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center gap-3">
        <p>Nenhum acesso em andamento.</p>
        <Button onClick={() => navigate('/p/home')}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b">
        <div className="px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/p/home')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="font-semibold">Acesso ao PDV</h1>
        </div>
      </header>
      <div className="p-4 max-w-md mx-auto space-y-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">{visit.unit_name}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Entrada: <b>{new Date(visit.checkin_at).toLocaleString('pt-BR')}</b>
            </p>
            {visit.checkin_distance_m != null && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Distância do PDV: {visit.checkin_distance_m}m
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Controle de acesso ao PDV — não substitui registro de ponto.
            </p>
            <Button className="w-full" size="lg" onClick={checkout} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
              Registrar saída do PDV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
