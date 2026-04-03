import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSupermarketAuth } from '@/contexts/SupermarketAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, History, Download } from 'lucide-react';
import { format, subDays } from 'date-fns';

const getHeaders = () => {
  const t = localStorage.getItem('supermarket_auth_token');
  return t ? { Authorization: `Bearer ${t}` } : undefined;
};

const BLOCK_REASONS: Record<string, string> = {
  fora_horario: 'Fora do Horário',
  sem_autorizacao: 'Sem Autorização',
  pdv_nao_permitido: 'PDV Não Permitido',
  cadastro_inexistente: 'Cadastro Inexistente',
  agencia_bloqueada: 'Agência Bloqueada',
};

export default function SupermarketHistory() {
  const { user } = useSupermarketAuth();
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['sm-history', dateFrom, dateTo],
    queryFn: () => api<any[]>(`/api/access-control/supermarket-portal/history?from=${dateFrom}&to=${dateTo}`, { headers: getHeaders() }),
    enabled: !!user,
  });

  const filtered = entries.filter((e: any) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (search && !e.promoter_name?.toLowerCase().includes(search.toLowerCase()) && !e.cpf?.includes(search)) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Histórico de Acessos</h1>
          <p className="text-muted-foreground">{user?.unit_name}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">De</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Até</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="authorized">Autorizados</SelectItem>
              <SelectItem value="blocked">Bloqueados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
              <History className="h-10 w-10" />
              <p>Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Promotor</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Agência</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.promoter_name || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{e.cpf}</TableCell>
                      <TableCell>{e.agency_name || 'Interno'}</TableCell>
                      <TableCell className="text-xs">{e.entry_at ? format(new Date(e.entry_at), 'dd/MM HH:mm') : '—'}</TableCell>
                      <TableCell className="text-xs">{e.exit_at ? format(new Date(e.exit_at), 'dd/MM HH:mm') : '—'}</TableCell>
                      <TableCell>{e.duration_minutes ? `${e.duration_minutes} min` : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={e.status === 'authorized' ? 'default' : 'destructive'}>
                          {e.status === 'authorized' ? 'Autorizado' : 'Bloqueado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.block_reason ? (BLOCK_REASONS[e.block_reason] || e.block_reason) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground text-right">
        {filtered.length} registro(s) encontrado(s)
      </div>
    </div>
  );
}
