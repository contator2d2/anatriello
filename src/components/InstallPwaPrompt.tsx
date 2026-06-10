import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share, Plus, Smartphone } from 'lucide-react';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Props {
  /** Storage key to remember dismissal — change per app */
  storageKey?: string;
  /** Optional override manifest URL to inject (used by sub-apps with /p scope) */
  manifestHref?: string;
}

/**
 * Mostra um popup para instalar o app no celular:
 * - Android/Chrome: usa beforeinstallprompt nativo.
 * - iOS Safari: mostra instruções (Compartilhar → Adicionar à Tela de Início).
 */
export default function InstallPwaPrompt({ storageKey = 'pwa_install_dismissed_at', manifestHref }: Props) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Inject custom manifest for this scope (e.g. /p) without breaking the main app
  useEffect(() => {
    if (!manifestHref) return;
    const existing = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previous = existing?.getAttribute('href') || null;
    if (existing) existing.setAttribute('href', manifestHref);
    return () => { if (existing && previous) existing.setAttribute('href', previous); };
  }, [manifestHref]);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua);
    setIsIOS(iOS);

    // already installed (standalone)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (standalone) return;

    // dismissed within last 3 days?
    const dismissedAt = Number(localStorage.getItem(storageKey) || 0);
    if (dismissedAt && Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setOpen(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS doesn't fire beforeinstallprompt — show our own instructions
    if (iOS) {
      const t = setTimeout(() => setOpen(true), 1200);
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', handler); };
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [storageKey]);

  const dismiss = () => {
    localStorage.setItem(storageKey, String(Date.now()));
    setOpen(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-2">
            <Smartphone className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center">Instalar app no celular</DialogTitle>
          <DialogDescription className="text-center">
            Tenha acesso rápido ao Controle de PDV direto da sua tela de início, sem precisar abrir o navegador.
          </DialogDescription>
        </DialogHeader>

        {isIOS && !deferred ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium">No iPhone/iPad (Safari):</p>
            <ol className="space-y-2 list-decimal list-inside text-muted-foreground">
              <li className="flex items-center gap-2">
                <span>Toque no botão</span>
                <Share className="h-4 w-4 inline text-primary" />
                <span>Compartilhar (parte inferior)</span>
              </li>
              <li className="flex items-center gap-2">
                <span>Escolha</span>
                <Plus className="h-4 w-4 inline text-primary" />
                <span>“Adicionar à Tela de Início”</span>
              </li>
              <li>Confirme em “Adicionar”.</li>
            </ol>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Clique em <strong>Instalar</strong> e confirme no aviso do navegador. O ícone do app aparecerá na sua tela inicial.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={dismiss} className="flex-1">Agora não</Button>
          {deferred && (
            <Button onClick={install} className="flex-1 gap-1">
              <Download className="h-4 w-4" /> Instalar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
