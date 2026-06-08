import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, KeyRound, Plus, Trash2, RefreshCw, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  networkId: string;
  networkName: string;
  defaultEmail?: string;
}

interface NetUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  last_login?: string | null;
}

function genPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const nums = "23456789";
  const n = Array.from({ length: 3 }, () => nums[Math.floor(Math.random() * nums.length)]).join("");
  const l = Array.from({ length: 2 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  return `ayra${n}${l}`;
}

export function NetworkAccessDialog({ open, onOpenChange, networkId, networkName, defaultEmail }: Props) {
  const [users, setUsers] = useState<NetUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "admin" });
  const [lastCreds, setLastCreds] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<NetUser[]>(`/api/network-portal/admin/network-users?network_id=${networkId}`);
      setUsers(data || []);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setForm({ name: "", email: defaultEmail || "", password: genPassword(), role: "admin" });
      setLastCreds(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, networkId]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast.error("Nome, e-mail e senha são obrigatórios");
      return;
    }
    setCreating(true);
    try {
      await api(`/api/network-portal/admin/network-users`, {
        method: "POST",
        body: { network_id: networkId, ...form },
      });
      toast.success("Acesso criado");
      setLastCreds({ email: form.email, password: form.password });
      setForm({ name: "", email: "", password: genPassword(), role: "admin" });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar usuário");
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (u: NetUser) => {
    const newPass = genPassword();
    if (!confirm(`Resetar a senha de ${u.email}?\n\nNova senha: ${newPass}`)) return;
    try {
      await api(`/api/network-portal/admin/network-users/${u.id}`, {
        method: "PUT",
        body: { password: newPass },
      });
      setLastCreds({ email: u.email, password: newPass });
      toast.success("Senha resetada");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao resetar senha");
    }
  };

  const handleToggleActive = async (u: NetUser) => {
    try {
      await api(`/api/network-portal/admin/network-users/${u.id}`, {
        method: "PUT",
        body: { active: !u.active },
      });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    }
  };

  const handleDelete = async (u: NetUser) => {
    if (!confirm(`Excluir o acesso ${u.email}?`)) return;
    try {
      await api(`/api/network-portal/admin/network-users/${u.id}`, { method: "DELETE" });
      toast.success("Excluído");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    }
  };

  const copyCreds = async () => {
    if (!lastCreds) return;
    const url = `${window.location.origin}/rede/login`;
    const txt = `Portal da Rede ${networkName}\nURL: ${url}\nE-mail: ${lastCreds.email}\nSenha: ${lastCreds.password}`;
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Credenciais copiadas");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Acessos do Portal — {networkName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            A Rede acessará o portal em <code className="px-1 py-0.5 bg-background rounded">{window.location.origin}/rede/login</code> usando o e-mail e senha criados aqui.
          </div>

          {lastCreds && (
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3 space-y-2">
              <div className="text-sm font-semibold">Credenciais geradas</div>
              <div className="text-xs space-y-0.5">
                <div><b>E-mail:</b> {lastCreds.email}</div>
                <div><b>Senha:</b> <code className="bg-background px-1 py-0.5 rounded">{lastCreds.password}</code></div>
              </div>
              <Button size="sm" variant="outline" onClick={copyCreds}>
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                Copiar para enviar
              </Button>
            </div>
          )}

          <div className="rounded-lg border p-3 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Novo acesso</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome do responsável *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: João Silva" />
              </div>
              <div>
                <Label className="text-xs">E-mail de login *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="rede@empresa.com" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Senha *</Label>
                <div className="flex gap-2">
                  <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  <Button type="button" variant="outline" size="icon" title="Gerar nova senha" onClick={() => setForm(f => ({ ...f, password: genPassword() }))}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating} size="sm">
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Criar acesso
            </Button>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Acessos existentes</div>
            {loading ? (
              <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : users.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhum acesso criado ainda</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[140px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-xs">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.active ? "default" : "secondary"} className="cursor-pointer" onClick={() => handleToggleActive(u)}>
                          {u.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Resetar senha" onClick={() => handleResetPassword(u)}>
                            <RefreshCw className="h-4 w-4 text-primary" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Excluir" onClick={() => handleDelete(u)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
