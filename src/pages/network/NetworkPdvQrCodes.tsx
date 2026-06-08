import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, Printer, RefreshCw, Loader2 } from 'lucide-react';

type Row = {
  unit_id: string;
  unit_name: string;
  city?: string;
  state?: string;
  address?: string;
  qr_id?: string;
  token?: string;
  active?: boolean;
  printed_at?: string;
};

export default function NetworkPdvQrCodes() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUnit, setBusyUnit] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api<Row[]>('/api/network-portal/pdv-qrcodes');
      setRows(r || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const generate = async (unitId: string) => {
    setBusyUnit(unitId);
    try {
      await api(`/api/network-portal/pdv-qrcodes/${unitId}/generate`, { method: 'POST' });
      toast({ title: 'QR Code gerado' });
      load();
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally { setBusyUnit(null); }
  };

  const print = async (unitId: string) => {
    setBusyUnit(unitId);
    try {
      const data = await api<{ unit: any; token: string; qr_image: string }>(
        `/api/network-portal/pdv-qrcodes/${unitId}/print`
      );
      const w = window.open('', '_blank', 'width=820,height=900');
      if (!w) return;
      w.document.write(`<!doctype html><html><head><title>QR ${data.unit.name}</title>
        <style>
          body{font-family:system-ui,sans-serif;padding:40px;text-align:center}
          h1{margin:0 0 8px}
          p{color:#555;margin:4px 0}
          img{margin:24px auto;display:block;width:380px;height:380px}
          .box{border:2px dashed #333;border-radius:16px;padding:32px;max-width:520px;margin:0 auto}
          .small{font-size:11px;color:#888;margin-top:24px;word-break:break-all}
        </style></head><body>
        <div class="box">
          <h1>${data.unit.name}</h1>
          <p>${data.unit.address || ''}</p>
          <p><b>${data.unit.city || ''}${data.unit.state ? ' / ' + data.unit.state : ''}</b></p>
          <img src="${data.qr_image}" />
          <p>Escaneie no app para registrar entrada / saída</p>
          <div class="small">${data.token}</div>
        </div>
        <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
        </body></html>`);
      w.document.close();
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally { setBusyUnit(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">QR Codes dos PDVs</h1>
          <p className="text-sm text-muted-foreground">
            Gere um QR fixo por PDV para imprimir e colar na entrada. Os promotores escaneiam pelo app.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r) => (
          <Card key={r.unit_id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{r.unit_name}</CardTitle>
                {r.token ? <Badge>Ativo</Badge> : <Badge variant="secondary">Sem QR</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{r.city}{r.state ? ` / ${r.state}` : ''}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {r.printed_at && (
                <p className="text-xs text-muted-foreground">
                  Impresso em {new Date(r.printed_at).toLocaleString('pt-BR')}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline" className="flex-1"
                  onClick={() => generate(r.unit_id)} disabled={busyUnit === r.unit_id}
                >
                  {busyUnit === r.unit_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  {r.token ? 'Regerar' : 'Gerar'}
                </Button>
                <Button
                  size="sm" className="flex-1" onClick={() => print(r.unit_id)}
                  disabled={!r.token || busyUnit === r.unit_id}
                >
                  <Printer className="h-4 w-4 mr-1" /> Imprimir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && rows.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-10 text-center text-muted-foreground">
              <QrCode className="h-10 w-10 mx-auto mb-2 opacity-50" />
              Nenhum PDV cadastrado nesta rede.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
