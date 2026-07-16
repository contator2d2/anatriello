import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Mantém o app do colaborador sincronizado com o servidor.
 * - Ao voltar para a aba (visibilitychange)
 * - Ao recuperar conexão
 * - A cada 2 min como fallback
 * Invalida todas as queries colab-* + promotor-home para refetch imediato.
 */
export function useColabAutoSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      qc.invalidateQueries({
        predicate: (q) => {
          const k = String(q.queryKey?.[0] || "");
          return k.startsWith("colab-") || k.startsWith("promotor-");
        },
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    const onOnline = () => invalidate();
    const onFocus = () => invalidate();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);

    const iv = window.setInterval(invalidate, 120000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(iv);
    };
  }, [qc]);
}
