import { useState } from "react";
import { useNetworks, useCreateNetwork, useUpdateNetwork, useDeleteNetwork } from "@/hooks/use-access-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Building2, Loader2, Shield } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { NetworkAuthSettingsDialog } from "./NetworkAuthSettingsDialog";
import HelpPanel from "./HelpPanel";

const NetworksTab = () => {
  const { data: networks = [], isLoading } = useNetworks();
  const createMutation = useCreateNetwork();
  const updateMutation = useUpdateNetwork();
  const deleteMutation = useDeleteNetwork();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", cnpj: "", contact_email: "", contact_phone: "", notes: "" });
  const [authSettingsNetwork, setAuthSettingsNetwork] = useState<any>(null);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", cnpj: "", contact_email: "", contact_phone: "", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (n: any) => {
    setEditing(n);
    setForm({ name: n.name, cnpj: n.cnpj || "", contact_email: n.contact_email || "", contact_phone: n.contact_phone || "", notes: n.notes || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, ...form });
    } else {
      await createMutation.mutateAsync(form);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Excluir esta rede?")) deleteMutation.mutate(id);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Redes de Supermercados
        </CardTitle>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Rede</Button>
      </CardHeader>
      <CardContent>
        <HelpPanel
          title="Como funcionam as Redes?"
          sections={[
            {
              title: "O que é uma Rede?",
              icon: "info",
              content: [
                "Uma Rede agrupa várias Unidades (PDVs) de um mesmo supermercado.",
                "As regras de autenticação são definidas por Rede e herdadas por todas as Unidades.",
              ],
            },
            {
              title: "Configurar segurança",
              icon: "check",
              content: [
                "Clique no ícone de escudo (🛡️) na coluna Ações para abrir as Regras de Autenticação.",
                "Escolha um preset (Básico, Intermediário, Alto, Máximo) ou configure manualmente.",
                "Métodos: CPF, QR Code, Selfie (entrada/saída), Reconhecimento Facial.",
              ],
            },
            {
              title: "Impacto nos promotores",
              icon: "alert",
              content: [
                "Ao ativar métodos avançados (selfie, facial), promotores sem foto conforme serão bloqueados.",
                "Agências são notificadas automaticamente para adequar o cadastro dos promotores.",
              ],
            },
          ]}
        />
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : networks.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma rede cadastrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {networks.map((n: any) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{n.name}</TableCell>
                  <TableCell>{n.cnpj || "—"}</TableCell>
                  <TableCell>{n.contact_email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={n.is_active !== false ? "default" : "secondary"}>
                      {n.is_active !== false ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setAuthSettingsNetwork(n)} title="Regras de Autenticação">
                        <Shield className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(n)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Rede" : "Nova Rede"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
            <div><Label>Email</Label><Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
            <div><Label>Telefone</Label><Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {authSettingsNetwork && (
        <NetworkAuthSettingsDialog
          open={!!authSettingsNetwork}
          onOpenChange={(v) => { if (!v) setAuthSettingsNetwork(null); }}
          networkId={authSettingsNetwork.id}
          networkName={authSettingsNetwork.name}
        />
      )}
    </Card>
  );
};

export default NetworksTab;
