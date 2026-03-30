import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePromotorChangePassword } from "@/hooks/use-promotor";
import { Lock, Loader2 } from "lucide-react";

export default function PromotorTrocarSenha() {
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const changePassword = usePromotorChangePassword();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 6) { toast({ title: 'Mínimo 6 caracteres', variant: 'destructive' }); return; }
    if (newPwd !== confirmPwd) { toast({ title: 'Senhas não conferem', variant: 'destructive' }); return; }
    try {
      await changePassword.mutateAsync({ new_password: newPwd });
      toast({ title: 'Senha alterada com sucesso!' });
      navigate('/promotor/home');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Lock className="h-8 w-8 mx-auto text-primary mb-2" />
          <CardTitle className="text-lg">Primeiro Acesso</CardTitle>
          <p className="text-sm text-muted-foreground">Crie uma nova senha para continuar</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <Input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={changePassword.isPending}>
              {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Nova Senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
