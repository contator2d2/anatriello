import { useState } from "react";
import { useEntryLogs, useUnits } from "@/hooks/use-access-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Loader2 } from "lucide-react";

const LogsTab = () => {
  const { data: units = [] } = useUnits();
  const [unitId, setUnitId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data: logs = [], isLoading } = useEntryLogs({ unit_id: unitId || undefined, date });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Logs de Entrada/Saída</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="w-60">
            <Label>Unidade</Label>
            <Select value={unitId || "__all__"} onValueChange={v => setUnitId(v === "__all__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (logs as any[]).length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Promotor</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Marcas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs as any[]).map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.promoter_name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{log.cpf || "—"}</TableCell>
                    <TableCell>{log.unit_name || "—"}</TableCell>
                    <TableCell>{log.entry_time ? new Date(log.entry_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell>{log.exit_time ? new Date(log.exit_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell>{log.duration_minutes ? `${log.duration_minutes} min` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "authorized" ? "default" : "destructive"}>
                        {log.status === "authorized" ? "Autorizado" : "Bloqueado"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {log.brands?.map((b: string) => <Badge key={b} variant="outline" className="text-xs">{b}</Badge>)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LogsTab;
