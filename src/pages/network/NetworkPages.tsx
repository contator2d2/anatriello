import { useNetworkBrands, useNetworkBlocks, useNetworkAudit } from '@/hooks/use-network-portal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Tag, Ban, FileSearch } from 'lucide-react';
import { format } from 'date-fns';

export function NetworkBrands() {
  const { data = [], isLoading } = useNetworkBrands();
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold flex items-center gap-2"><Tag className="h-5 w-5 text-primary" /> Marcas Atendidas</h1>
      <Card><CardContent className="pt-4">
        {isLoading ? <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : data.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma marca atendida.</p>
          : <Table>
            <TableHeader><TableRow><TableHead>Marca</TableHead><TableHead>Promotores</TableHead><TableHead>PDVs</TableHead></TableRow></TableHeader>
            <TableBody>{data.map(b => (
              <TableRow key={b.id}><TableCell>{b.name}</TableCell><TableCell>{b.promoters}</TableCell><TableCell>{b.units}</TableCell></TableRow>
            ))}</TableBody>
          </Table>}
      </CardContent></Card>
    </div>
  );
}

export function NetworkBlocks() {
  const { data = [], isLoading } = useNetworkBlocks();
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold flex items-center gap-2"><Ban className="h-5 w-5 text-primary" /> Bloqueios em PDVs</h1>
      <Card><CardContent className="pt-4">
        {isLoading ? <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : data.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem bloqueios.</p>
          : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Promotor</TableHead><TableHead>Agência</TableHead><TableHead>PDV</TableHead>
              <TableHead>Status</TableHead><TableHead>Motivo</TableHead><TableHead>Data</TableHead>
            </TableRow></TableHeader>
            <TableBody>{data.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell><div className="font-medium">{b.promoter_name}</div><div className="text-xs text-muted-foreground">{b.promoter_cpf}</div></TableCell>
                <TableCell className="text-sm">{b.agency_name || '—'}</TableCell>
                <TableCell className="text-sm">{b.unit_name || '—'}</TableCell>
                <TableCell>{b.active ? <Badge variant="destructive">Ativo</Badge> : <Badge variant="secondary">Removido</Badge>}</TableCell>
                <TableCell className="text-xs">{b.reason || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{b.blocked_at ? format(new Date(b.blocked_at), 'dd/MM/yy HH:mm') : ''}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>}
      </CardContent></Card>
    </div>
  );
}

export function NetworkAudit() {
  const { data = [], isLoading } = useNetworkAudit();
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold flex items-center gap-2"><FileSearch className="h-5 w-5 text-primary" /> Auditoria</h1>
      <Card><CardContent className="pt-4">
        {isLoading ? <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : data.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem registros.</p>
          : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Ação</TableHead><TableHead>PDV</TableHead>
              <TableHead>Promotor</TableHead><TableHead>Por</TableHead>
            </TableRow></TableHeader>
            <TableBody>{data.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs text-muted-foreground">{format(new Date(a.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                <TableCell><Badge variant="outline">{a.action}</Badge></TableCell>
                <TableCell className="text-sm">{a.unit_name || '—'}</TableCell>
                <TableCell className="text-sm">{a.promoter_name || '—'}</TableCell>
                <TableCell className="text-xs">{a.performed_by_type}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>}
      </CardContent></Card>
    </div>
  );
}

export function NetworkSettings() {
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold">Configurações da Rede</h1>
      <Card><CardContent className="pt-4 space-y-2">
        <p className="text-sm text-muted-foreground">
          As configurações de validação documental, modo de aprovação (IA/híbrido/manual) e
          notificações são geridas pela equipe Ayratech junto com sua rede. Solicite alterações
          pelo seu contato comercial.
        </p>
      </CardContent></Card>
    </div>
  );
}
