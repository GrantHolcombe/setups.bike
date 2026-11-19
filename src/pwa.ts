// Phase 3 PWA helpers: service worker registration, update notices and app install.
import * as React from 'react';

type Listener = () => void;
const notify = (set: Set<Listener>) => set.forEach((l) => l());

// ---- Service worker and updates ----

let waiting: ServiceWorker | null = null;
const updateListeners = new Set<Listener>();

const watchForWaiting = (reg: ServiceWorkerRegistration) => {
  const track = (worker: ServiceWorker | null) => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      // installed while another version controls the page = an update is ready
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        waiting = worker;
        notify(updateListeners);
      }
    });
  };
  if (reg.waiting && navigator.serviceWorker.controller) {
    waiting = reg.waiting;
    notify(updateListeners);
  }
  reg.addEventListener('updatefound', () => track(reg.installing));
};

// Registers the service worker in production builds only (the dev server doesn't build one).
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL}/service-worker.js`)
      .then((reg) => {
        watchForWaiting(reg);
        // check for a new version when the app comes back to the foreground
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch((err) => console.warn('Service worker registration failed', err));

    // once the new version takes over, reload so the page uses it
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

// True when a new version is downloaded and waiting.
export function useUpdateAvailable() {
  const [ready, setReady] = React.useState(!!waiting);
  React.useEffect(() => {
    const l = () => setReady(!!waiting);
    updateListeners.add(l);
    return () => { updateListeners.delete(l); };
  }, []);
  return ready;
}

// Switches to the waiting version (the page reloads on controllerchange).
export function applyUpdate() {
  if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
  else window.location.reload();
}

// ---- Installing the app ----

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<Listener>();

if (typeof window !== 'undefined') {
  // Chrome, Edge and Android offer this when the app can be installed; keep it for our menu item
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify(installListeners);
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify(installListeners);
  });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

// iPhone and iPad Safari have no install prompt; people use Share > Add to Home Screen.
// (iPadOS reports itself as a Mac, so also check for touch.)
export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

export type InstallOption = 'prompt' | 'ios' | null;

// Which install option to offer: the browser's own prompt, iOS instructions, or nothing
// (already installed, or a browser that can't install).
export function useInstallOption(): InstallOption {
  const compute = (): InstallOption => {
    if (isStandalone()) return null;
    if (deferredPrompt) return 'prompt';
    if (isIOS()) return 'ios';
    return null;
  };
  const [option, setOption] = React.useState<InstallOption>(compute);
  React.useEffect(() => {
    const l = () => setOption(compute());
    installListeners.add(l);
    return () => { installListeners.delete(l); };
  }, []);
  return option;
}

// Shows the browser's install dialog. Returns true if the rider installed.
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const e = deferredPrompt;
  deferredPrompt = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  notify(installListeners);
  return outcome === 'accepted';
}
