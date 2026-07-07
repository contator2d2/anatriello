import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDriverAuth } from "@/contexts/DriverAuthContext";

export default function EntregadorLogin() {
  const { login, driver } = useDriverAuth();
  const nav = useNavigate();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (driver) return <Navigate to="/entregador/home" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await login(loginId, password); nav("/entregador/home"); }
    catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-xl">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white text-xl font-bold">SmartRoute</h1>
          <p className="text-slate-300 text-sm">App do Entregador</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>CPF ou e-mail</Label>
                <Input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoFocus required />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-slate-400 mt-4">Anatriello · SmartRoute AI</p>
      </div>
    </div>
  );
}
