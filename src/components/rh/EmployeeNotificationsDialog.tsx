import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmployeeNotifications } from "@/hooks/use-rh";
import { Bell, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_LABELS: Record<string, string> = {
  info: "Informativo",
  punch: "Ponto",
  document: "Documento",
  timesheet: "Espelho de Ponto",
  adjustment: "Ajuste",
  closing: "Fechamento",
  vacation: "Férias",
  certificate: "Atestado",
};

const TYPE_COLORS: Record<string, string> = {
  info: "bg-slate-100 text-slate-700",
  punch: "bg-blue-100 text-blue-700",
  document: "bg-amber-100 text-amber-700",
  timesheet: "bg-purple-100 text-purple-700",
  adjustment: "bg-orange-100 text-orange-700",
  closing: "bg-red-100 text-red-700",
  vacation: "bg-emerald-100 text-emerald-700",
  certificate: "bg-teal-100 text-teal-700",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId?: string;
  employeeName?: string;
}

export function EmployeeNotificationsDialog({ open, onOpenChange, employeeId, employeeName }: Props) {
  const { data = [], isLoading } = useEmployeeNotifications(open ? employeeId : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Histórico de notificações
            {employeeName && <span className="text-sm font-normal text-muted-foreground">— {employeeName}</span>}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Carregando…</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Nenhuma notificação enviada até o momento.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Data</TableHead>
                  <TableHead className="w-32">Tipo</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead className="w-36">Entrega</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((n: any) => (
                  <TableRow key={n.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(n.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${TYPE_COLORS[n.type] || ""}`}>
                        {TYPE_LABELS[n.type] || n.type || "info"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{n.title}</div>
                      {n.message && <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>}
                    </TableCell>
                    <TableCell>
                      {n.read ? (
                        <div className="flex items-center gap-1 text-xs text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Lido {n.read_at && `em ${format(new Date(n.read_at), "dd/MM HH:mm", { locale: ptBR })}`}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Circle className="h-3.5 w-3.5" />
                          Entregue
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
