import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Loader2, ArrowLeft } from 'lucide-react';

const schema = z.object({
  company_name: z.string().trim().min(3).max(150),
  cnpj: z.string().trim().max(20).optional().or(z.literal('')),
  responsible_name: z.string().trim().min(3).max(120),
  responsible_phone: z.string().trim().max(30).optional().or(z.literal('')),
  responsible_email: z.string().trim().email().max(180),
  password: z.string().min(6).max(80),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  state: z.string().trim().max(2).optional().or(z.literal('')),
  message: z.string().trim().max(500).optional().or(z.literal('')),
});

export default function AgencySignup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({
    company_name: '', cnpj: '', responsible_name: '', responsible_phone: '',
    responsible_email: '', password: '', city: '', state: '', message: '',
  });
  const [networks, setNetworks] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api<any[]>('/api/public/networks', { auth: false }).then(setNetworks).catch(() => setNetworks([]));
  }, []);

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: 'Verifique os campos', description: parsed.error.issues[0].message, variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await api('/api/agency-signup', {
        method: 'POST', auth: false,
        body: { ...parsed.data, desired_networks: selectedNetworks },
      });
      setDone(true);
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message || 'Não foi possível enviar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle>Solicitação enviada!</CardTitle>
            <CardDescription>
              Sua agência está aguardando aprovação da rede. Você receberá um e-mail
              quando o acesso for liberado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => navigate('/agencia/login')}>Ir para o login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 py-10">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/agencia/login')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Card>
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-center text-2xl">Cadastrar agência</CardTitle>
            <CardDescription className="text-center">
              Preencha os dados da sua agência. A rede aprovará o acesso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-sm font-medium">Razão social *</label>
                  <Input value={form.company_name} onChange={set('company_name')} required />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">CNPJ</label>
                  <Input value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0000-00" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Telefone</label>
                  <Input value={form.responsible_phone} onChange={set('responsible_phone')} placeholder="(11) 90000-0000" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Cidade</label>
                  <Input value={form.city} onChange={set('city')} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">UF</label>
                  <Input value={form.state} onChange={set('state')} maxLength={2} />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-sm font-medium">Responsável *</label>
                  <Input value={form.responsible_name} onChange={set('responsible_name')} required />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">E-mail (login) *</label>
                  <Input type="email" value={form.responsible_email} onChange={set('responsible_email')} required />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Senha *</label>
                  <Input type="password" value={form.password} onChange={set('password')} required minLength={6} />
                </div>
              </div>

              {networks.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Redes que pretende atender</label>
                  <div className="grid sm:grid-cols-2 gap-2 p-3 rounded-md border bg-muted/30 max-h-48 overflow-auto">
                    {networks.map((n) => (
                      <label key={n.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedNetworks.includes(n.id)}
                          onCheckedChange={(v) =>
                            setSelectedNetworks((prev) => (v ? [...prev, n.id] : prev.filter((x) => x !== n.id)))
                          }
                        />
                        {n.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">Mensagem para a rede</label>
                <Textarea value={form.message} onChange={set('message')} rows={3} maxLength={500} />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar solicitação
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Já tem cadastro?{' '}
                <Link to="/agencia/login" className="underline">Faça login</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
