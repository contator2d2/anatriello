import { useState } from "react";
import { useFraudLogs, useResolveFraudLog, useUnits } from "@/hooks/use-access-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

const FRAUD_TYPES: Record<string, string> = {
  qr_reused: "QR Reutilizado",
  qr_expired: "QR Expirado",
  qr_invalid: "QR Inválido",
  cpf_invalid: "CPF Inválido",
  selfie_divergent: "Selfie Divergente",
  out_of_hours: "Fora do Horário",
  unauthorized_pdv: "PDV Não Autorizado",
  identity_mismatch: "Identidade Divergente",
};

const SEVERITY_MAP: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  low: { label: "Baixa", variant: "secondary" },
  medium: { label: "Média", variant: "outline" },
  high: { label: "Alta", variant: "destructive" },
  critical: { label: "Crítica", variant: "destructive" },
};

const FraudLogsTab = () => {
  const [unitFilter, setUnitFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [resolvedFilter, setResolvedFilter] = useState("");
  const [resolveDialog, setResolveDialog] = useState<any>(null);
  const [notes, setNotes] = useState("");

  const filters = {
    ...(unitFilter && { unit_id: unitFilter }),
    ...(severityFilter && { severity: severityFilter }),
    ...(resolvedFilter && { resolved: resolvedFilter }),
  };

  const { data: logs = [], isLoading } = useFraudLogs(Object.keys(filters).length ? filters : undefined);
  const { data: units = [] } = useUnits();
  const resolveMutation = useResolveFraudLog();

  const handleResolve = async () => {
    if (!resolveDialog) return;
    await resolveMutation.mutateAsync({ id: resolveDialog.id, resolution_notes: notes });
    setResolveDialog(null);
    setNotes("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Detecção de Fraudes
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
          <Select value={severityFilter} onValueChange={v => setSeverityFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Todas severidades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas severidades</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="critical">Crítica</SelectItem>
            </SelectContent>
          </Select>
          <Select value={resolvedFilter} onValueChange={v => setResolvedFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Todos status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="false">Pendentes</SelectItem>
              <SelectItem value="true">Resolvidos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum evento de fraude detectado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Promotor</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l: any) => {
                const sev = SEVERITY_MAP[l.severity] || { label: l.severity, variant: "secondary" as const };
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{l.unit_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{FRAUD_TYPES[l.fraud_type] || l.fraud_type}</Badge></TableCell>
                    <TableCell><Badge variant={sev.variant}>{sev.label}</Badge></TableCell>
                    <TableCell className="text-sm">{l.promoter_name || l.employee_name || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{l.cpf || "—"}</TableCell>
                    <TableCell>
                      {l.resolved ? (
                        <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Resolvido</Badge>
                      ) : (
                        <Badge variant="secondary">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!l.resolved && (
                        <Button size="sm" variant="outline" onClick={() => { setResolveDialog(l); setNotes(""); }}>
                          Resolver
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!resolveDialog} onOpenChange={v => { if (!v) setResolveDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Resolver Alerta de Fraude</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tipo: <strong>{FRAUD_TYPES[resolveDialog?.fraud_type] || resolveDialog?.fraud_type}</strong>
            </p>
            <Textarea placeholder="Notas de resolução (opcional)" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog(null)}>Cancelar</Button>
            <Button onClick={handleResolve} disabled={resolveMutation.isPending}>
              {resolveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Marcar como Resolvido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FraudLogsTab;
