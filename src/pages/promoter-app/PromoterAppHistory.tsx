import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function PromoterAppHistory() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<any[]>('/api/promoter-app/visits').then(setItems).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b">
        <div className="px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/p/home')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="font-semibold">Histórico</h1>
        </div>
      </header>
      <div className="p-4 max-w-md mx-auto space-y-2">
        {loading && <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></div>}
        {!loading && items.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhuma visita registrada.</p>
        )}
        {items.map((it) => (
          <Card key={it.id}>
            <CardContent className="py-3 space-y-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{it.unit_name}</p>
                {it.status === 'closed' && <Badge><CheckCircle2 className="h-3 w-3 mr-1" /> Concluída</Badge>}
                {it.status === 'open' && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Aberta</Badge>}
                {it.status === 'denied' && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Negada</Badge>}
              </div>
              {it.checkin_at && <p className="text-xs text-muted-foreground">
                Entrada: {new Date(it.checkin_at).toLocaleString('pt-BR')}
              </p>}
              {it.checkout_at && <p className="text-xs text-muted-foreground">
                Saída: {new Date(it.checkout_at).toLocaleString('pt-BR')}
              </p>}
              {it.denied_reason && <p className="text-xs text-destructive">{it.denied_reason}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
