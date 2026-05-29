let deferredPrompt: any = null;

// Service worker registration is handled by vite-plugin-pwa in production


window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  (window as any).deferredPrompt = deferredPrompt;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  (window as any).deferredPrompt = null;
});

export function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export function canInstallPWA(): boolean {
  return !!deferredPrompt;
}

export async function installPWA(): Promise<boolean> {
  if (!deferredPrompt) return false;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    deferredPrompt = null;
    return true;
  }
  
  return false;
}

export function supportsNotifications(): boolean {
  return 'Notification' in window;
}

export function supportsServiceWorker(): boolean {
  return 'serviceWorker' in navigator;
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

export function isMobile(): boolean {
  return isIOS() || isAndroid();
}