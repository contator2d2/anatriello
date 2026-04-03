import { useState } from "react";
import { useAuthAttempts } from "@/hooks/use-access-control";
import { useUnits } from "@/hooks/use-access-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

const RESULT_MAP: Record<string, { label: string; variant: "default" | "destructive" | "secondary" }> = {
  approved: { label: "Aprovado", variant: "default" },
  denied: { label: "Negado", variant: "destructive" },
  suspect: { label: "Suspeito", variant: "secondary" },
};

const METHOD_MAP: Record<string, string> = {
  cpf: "CPF",
  qr: "QR Code",
  selfie: "Selfie",
  facial: "Facial",
  combined: "Combinado",
};

const AuthAttemptsTab = () => {
  const [unitFilter, setUnitFilter] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [resultFilter, setResultFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");

  const filters = {
    ...(unitFilter && { unit_id: unitFilter }),
    ...(methodFilter && { method: methodFilter }),
    ...(resultFilter && { result: resultFilter }),
    ...(dateFilter && { date: dateFilter }),
  };

  const { data: attempts = [], isLoading } = useAuthAttempts(Object.keys(filters).length ? filters : undefined);
  const { data: units = [] } = useUnits();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Tentativas de Autenticação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select value={unitFilter} onValueChange={v => setUnitFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Todas unidades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas unidades</SelectItem>
              {units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={v => setMethodFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Todos métodos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos métodos</SelectItem>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="qr">QR Code</SelectItem>
              <SelectItem value="selfie">Selfie</SelectItem>
              <SelectItem value="facial">Facial</SelectItem>
              <SelectItem value="combined">Combinado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={resultFilter} onValueChange={v => setResultFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Todos resultados" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos resultados</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="denied">Negado</SelectItem>
              <SelectItem value="suspect">Suspeito</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-44" />
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : attempts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma tentativa encontrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Promotor</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Confiança</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((a: any) => {
                const rm = RESULT_MAP[a.overall_result] || { label: a.overall_result, variant: "secondary" as const };
                return (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{a.unit_name || "—"}</TableCell>
                    <TableCell className="text-sm">{a.promoter_name || a.employee_name || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{a.cpf || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{METHOD_MAP[a.method] || a.method}</Badge></TableCell>
                    <TableCell><Badge variant={rm.variant}>{rm.label}</Badge></TableCell>
                    <TableCell className="text-sm">{a.confidence_level ? `${a.confidence_level}%` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{a.block_reason || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default AuthAttemptsTab;
