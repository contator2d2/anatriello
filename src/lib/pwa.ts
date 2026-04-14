let deferredPrompt: any = null;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  }).catch(() => {});
}

if ('caches' in window) {
  caches.keys().then((names) => {
    names.forEach((name) => {
      if (name.toLowerCase().includes('workbox') || name.toLowerCase().includes('precache')) {
        void caches.delete(name);
      }
    });
  }).catch(() => {});
}

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
  return false;
}

export function canInstallPWA(): boolean {
  return false;
}

export async function installPWA(): Promise<boolean> {
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
