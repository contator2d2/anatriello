import { useState } from 'react';
import { useNetworkPartners } from '@/hooks/use-network-portal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users } from 'lucide-react';

const TYPES = [
  { v: 'all', label: 'Todos' },
  { v: 'agency', label: 'Agências' },
  { v: 'installer', label: 'Instaladores' },
  { v: 'maintenance', label: 'Manutenção' },
  { v: 'other', label: 'Outros' },
];

export default function NetworkPartners() {
  const [type, setType] = useState('all');
  const { data = [], isLoading } = useNetworkPartners(type === 'all' ? undefined : type);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Parceiros da Rede</h1>
        <p className="text-sm text-muted-foreground">Agências, instaladores, manutenção e demais terceiros operando nos PDVs.</p>
      </div>
      <Tabs value={type} onValueChange={setType}>
        <TabsList className="flex-wrap">{TYPES.map(t => <TabsTrigger key={t.v} value={t.v}>{t.label}</TabsTrigger>)}</TabsList>
      </Tabs>
      <Card><CardContent className="pt-4">
        {isLoading ? <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : data.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum parceiro encontrado.</p>
          : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Parceiro</TableHead><TableHead>Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Contato</TableHead>
              <TableHead>Promotores ativos</TableHead><TableHead>PDVs atendidos</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map(p => (
                <TableRow key={p.id}>
                  <TableCell><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.cnpj || '—'}</div></TableCell>
                  <TableCell><Badge variant="outline">{p.category_label || p.partner_type}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-xs">
                    {p.responsible_name && <div>{p.responsible_name}</div>}
                    {p.responsible_phone && <div className="text-muted-foreground">{p.responsible_phone}</div>}
                  </TableCell>
                  <TableCell>{p.active_promoters}</TableCell>
                  <TableCell>{p.units_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>}
      </CardContent></Card>
    </div>
  );
}
