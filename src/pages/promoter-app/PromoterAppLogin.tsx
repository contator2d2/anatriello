import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePromoterAppAuth } from '@/contexts/PromoterAppAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Loader2 } from 'lucide-react';
import InstallPwaPrompt from '@/components/InstallPwaPrompt';

export default function PromoterAppLogin() {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = usePromoterAppAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { if (isAuthenticated) navigate('/p/home', { replace: true }); }, [isAuthenticated, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(cpf, password);
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message || 'CPF ou senha inválidos', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-1">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Acesso ao PDV</CardTitle>
          <CardDescription>Entre com seu CPF e senha</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="tel" inputMode="numeric" placeholder="CPF"
              value={cpf} onChange={(e) => setCpf(e.target.value)} required
            />
            <Input
              type="password" placeholder="Senha"
              value={password} onChange={(e) => setPassword(e.target.value)} required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground mt-4">
        App de controle de acesso · ayratech
      </p>
    </div>
  );
}
