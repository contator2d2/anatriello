import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Search, 
  RefreshCcw, 
  Monitor,
  User,
  ExternalLink,
  Smartphone
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LEVEL_COLORS: Record<string, string> = {
  debug: "bg-slate-500",
  info: "bg-blue-500",
  warn: "bg-yellow-500",
  error: "bg-red-500",
  fatal: "bg-purple-600",
};

export default function RHLogs() {
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["app-logs", levelFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (levelFilter !== "all") params.set('level', levelFilter);
      if (search) params.set('search', search);
      
      return await api<any[]>(`/api/app-logs?${params.toString()}`);
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" /> Central de Logs e Erros
          </h1>
          <p className="text-muted-foreground text-sm">
            Monitore em tempo real as atividades e problemas técnicos dos promotores.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por mensagem ou e-mail..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por Nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Níveis</SelectItem>
                  <SelectItem value="error">Erros</SelectItem>
                  <SelectItem value="warn">Avisos</SelectItem>
                  <SelectItem value="info">Informações</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Data/Hora</TableHead>
                <TableHead className="w-[100px]">Nível</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Carregando logs...</TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum log encontrado.</TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {log.created_at ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${LEVEL_COLORS[log.level]} text-white border-none text-[10px] uppercase`}>
                        {log.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[400px] truncate text-sm">
                      {log.message}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {log.user_email || "Anônimo"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalhes do Log
              {selectedLog && (
                <Badge className={LEVEL_COLORS[selectedLog.level]}>
                  {selectedLog.level.toUpperCase()}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs">ID do Log</span>
                  <span className="font-mono">{selectedLog.id}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs">Data e Hora</span>
                  <span>{selectedLog.created_at ? format(new Date(selectedLog.created_at), "PPP p", { locale: ptBR }) : '—'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs flex items-center gap-1"><User className="h-3 w-3" /> Usuário</span>
                  <span>{selectedLog.user_email || "Anônimo"}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs flex items-center gap-1"><Smartphone className="h-3 w-3" /> URL da Página</span>
                  <span className="break-all">{selectedLog.page_url}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Mensagem</h4>
                <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {selectedLog.message}
                </div>
              </div>

              {selectedLog.context && Object.keys(selectedLog.context).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Contexto</h4>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-md text-xs overflow-x-auto">
                    {typeof selectedLog.context === 'string' ? selectedLog.context : JSON.stringify(selectedLog.context, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.device_info && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Dispositivo</h4>
                  <pre className="p-3 bg-muted rounded-md text-xs overflow-x-auto">
                    {typeof selectedLog.device_info === 'string' ? selectedLog.device_info : JSON.stringify(selectedLog.device_info, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.stack_trace && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-red-500">Stack Trace</h4>
                  <pre className="p-3 bg-red-50 text-red-900 dark:bg-red-950/20 dark:text-red-400 rounded-md text-xs overflow-x-auto whitespace-pre">
                    {selectedLog.stack_trace}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
