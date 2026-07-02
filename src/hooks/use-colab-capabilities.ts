import { useEffect, useState } from "react";
import { getCapabilities, hasCap, setCapabilities, type CapabilityKey } from "@/lib/colab-capabilities";
import { useColabMeFull } from "@/hooks/use-promotor";

// Mantém localStorage em sincronia com o /me/full (fonte da verdade quando online).
export function useColabCapabilitiesSync() {
  const { data } = useColabMeFull();
  useEffect(() => {
    if (data?.capabilities && Array.isArray(data.capabilities)) {
      setCapabilities(data.capabilities);
    }
  }, [data?.capabilities]);
}

// Hook reativo para checar uma capability (re-renderiza se caps mudarem).
export function useCan(cap: CapabilityKey | string) {
  const [ok, setOk] = useState<boolean>(() => hasCap(cap));
  useEffect(() => {
    const handler = () => setOk(hasCap(cap));
    window.addEventListener('storage', handler);
    // custom event para mudanças no mesmo tab
    window.addEventListener('colab-caps-changed', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('colab-caps-changed', handler);
    };
  }, [cap]);
  return ok;
}

export function useCaps(): string[] {
  const [caps, setCaps] = useState<string[]>(() => getCapabilities());
  useEffect(() => {
    const handler = () => setCaps(getCapabilities());
    window.addEventListener('storage', handler);
    window.addEventListener('colab-caps-changed', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('colab-caps-changed', handler);
    };
  }, []);
  return caps;
}
