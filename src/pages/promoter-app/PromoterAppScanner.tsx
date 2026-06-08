import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, CheckCircle2, XCircle, MapPin } from 'lucide-react';

type Result = { ok: boolean; reason?: string; unit?: { name: string } };

export default function PromoterAppScanner() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const stopRef = useRef<{ stop: () => void } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back = devices.find((d) => /back|rear|trás|traseira|environment/i.test(d.label)) || devices[0];
        if (!back) throw new Error('Câmera não disponível');
        const controls = await reader.decodeFromVideoDevice(
          back.deviceId,
          videoRef.current!,
          (res) => {
            if (res && !handledRef.current) {
              handledRef.current = true;
              onScan(res.getText());
            }
          }
        );
        stopRef.current = controls;
      } catch (e: any) {
        setError(e?.message || 'Não foi possível acessar a câmera');
      }
    })();
    return () => { stopRef.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScan = async (text: string) => {
    setSubmitting(true);
    try {
      stopRef.current?.stop();
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 12000, maximumAge: 0,
        })
      );
      try {
        const r = await api<any>('/api/promoter-app/checkin', {
          method: 'POST',
          body: {
            qr_token: text,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        });
        setResult({ ok: true, unit: r.unit });
      } catch (e: any) {
        // backend returns 403 with reason
        const reason = e?.response?.reason || e?.message || 'Acesso negado';
        setResult({ ok: false, reason });
      }
    } catch (e: any) {
      setResult({ ok: false, reason: 'Permita o GPS para validar o acesso ao PDV' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="p-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/p/home')} className="text-white hover:bg-white/10">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-base font-semibold">Escaneie o QR do PDV</h1>
      </header>

      <div className="flex-1 relative">
        {!result && (
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        )}
        {!result && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-white/70 rounded-2xl" />
          </div>
        )}

        {submitting && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm flex items-center gap-1"><MapPin className="h-4 w-4" /> Validando localização...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-6">
            <Card className="bg-background text-foreground">
              <CardContent className="p-5 space-y-3">
                <XCircle className="h-10 w-10 text-destructive mx-auto" />
                <p className="text-center">{error}</p>
                <Button className="w-full" onClick={() => navigate('/p/home')}>Voltar</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {result && (
          <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-6">
            <Card className="bg-background text-foreground w-full max-w-sm">
              <CardContent className="p-6 space-y-4 text-center">
                {result.ok ? (
                  <>
                    <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto" />
                    <h2 className="text-xl font-bold">Check-in liberado!</h2>
                    <p className="text-sm text-muted-foreground">{result.unit?.name}</p>
                    <Button className="w-full" onClick={() => navigate('/p/visit')}>
                      Ver visita
                    </Button>
                  </>
                ) : (
                  <>
                    <XCircle className="h-14 w-14 text-destructive mx-auto" />
                    <h2 className="text-xl font-bold">Acesso negado</h2>
                    <p className="text-sm text-muted-foreground">{result.reason}</p>
                    <Button className="w-full" onClick={() => navigate('/p/home')}>
                      Voltar
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
