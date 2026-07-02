import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import { hasCap, type CapabilityKey } from "@/lib/colab-capabilities";
import { useToast } from "@/hooks/use-toast";

interface Props {
  cap: CapabilityKey | string;
  children: React.ReactNode;
  fallback?: string; // caminho para redirecionar. Default: /app/home
}

export default function RequireCap({ cap, children, fallback = "/colaborador/home" }: Props) {
  const { toast } = useToast();
  const ok = hasCap(cap);

  useEffect(() => {
    if (!ok) {
      toast({
        title: "Função não liberada",
        description: "Seu perfil de acesso não permite usar esta função. Fale com o RH.",
        variant: "destructive",
      });
    }
  }, [ok, toast]);

  if (!ok) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}
