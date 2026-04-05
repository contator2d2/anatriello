import { registerSW } from 'virtual:pwa-register';

let deferredPrompt: any = null;

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes('id-preview--') ||
  window.location.hostname.includes('lovableproject.com');

const isInstallableContext = import.meta.env.PROD && !isInIframe && !isPreviewHost;

if ('serviceWorker' in navigator) {
  if (isInstallableContext) {
    registerSW({
      immediate: true,
      onRegisteredSW(_, registration) {
        registration?.update().catch(() => {});
      },
      onRegisterError(error) {
        console.warn('[PWA] SW registration failed, clearing caches:', error);
        if ('caches' in window) {
          caches.keys().then(names => names.forEach(name => caches.delete(name)));
        }
      },
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    }).catch(() => {});
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  if (!isInstallableContext) {
    return;
  }

  e.preventDefault();
  deferredPrompt = e;
  (window as any).deferredPrompt = deferredPrompt;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  (window as any).deferredPrompt = null;

  console.log('PWA was installed');
});

export function isPWAInstalled(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  if ((window.navigator as any).standalone === true) {
    return true;
  }

  return false;
}

export function canInstallPWA(): boolean {
  if (!isInstallableContext || isPWAInstalled()) {
    return false;
  }

  return deferredPrompt !== null || (window as any).deferredPrompt !== null;
}

export async function installPWA(): Promise<boolean> {
  if (!isInstallableContext) {
    console.log('PWA install is unavailable in preview or iframe contexts');
    return false;
  }

  const prompt = deferredPrompt || (window as any).deferredPrompt;

  if (!prompt) {
    console.log('No install prompt available');
    return false;
  }

  prompt.prompt();
  const { outcome } = await prompt.userChoice;

  deferredPrompt = null;
  (window as any).deferredPrompt = null;

  return outcome === 'accepted';
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
