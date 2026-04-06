import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ShieldCheck, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const WEEKDAY_LABELS: Record<number, string> = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

interface SharedLettersPanelProps {
  portalType: 'supermarket' | 'agency';
}

export function SharedLettersPanel({ portalType }: SharedLettersPanelProps) {
  const getHeaders = () => {
    const tokenKey = portalType === 'supermarket' ? 'supermarket_auth_token' : 'agency_auth_token';
    const t = localStorage.getItem(tokenKey);
    return t ? { Authorization: `Bearer ${t}` } : undefined;
  };

  const endpoint = portalType === 'supermarket'
    ? '/api/access-control/supermarket-portal/shared-letters'
    : '/api/access-control/agency/shared-letters';

  const { data: letters = [], isLoading } = useQuery({
    queryKey: ['shared-letters', portalType],
    queryFn: () => api<any[]>(endpoint, { headers: getHeaders() }),
  });

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!letters.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Cartas de Autorização
          <Badge variant="secondary" className="ml-auto">{letters.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {letters.slice(0, 10).map((letter: any) => (
          <div key={letter.id} className="flex items-start justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{letter.promoter_name}</p>
                {letter.is_digitally_signed && (
                  <Badge variant="default" className="text-xs gap-1 shrink-0">
                    <ShieldCheck className="h-3 w-3" /> Assinada
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {portalType === 'supermarket' && letter.agency_name && `Agência: ${letter.agency_name} • `}
                {letter.unit_name}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(letter.brands || []).map((b: string) => (
                  <Badge key={b} variant="outline" className="text-xs">{b}</Badge>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{letter.start_time?.slice(0,5)} - {letter.end_time?.slice(0,5)}</span>
                <span>•</span>
                <span>{(letter.allowed_weekdays || []).map((d: number) => WEEKDAY_LABELS[d]).join(', ')}</span>
              </div>
              {letter.valid_from && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Validade: {letter.valid_from}{letter.valid_until ? ` — ${letter.valid_until}` : ''}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground shrink-0 ml-2">
              {format(new Date(letter.created_at), 'dd/MM/yy')}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
