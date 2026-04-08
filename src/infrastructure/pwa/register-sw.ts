import { Workbox } from 'workbox-window';

/**
 * Registers the Vite PWA service worker using workbox-window.
 * Only runs in production builds with SW support.
 * Auto-skips waiting and reloads once the new SW takes control.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return;
  }

  const wb = new Workbox('/sw.js');

  wb.addEventListener('waiting', () => {
    console.info(
      JSON.stringify({
        level: 'info',
        event: 'sw_waiting',
        message: 'New service worker waiting — skipping wait.',
        ts: new Date().toISOString(),
      }),
    );
    void wb.messageSkipWaiting();
  });

  wb.addEventListener('controlling', () => {
    window.location.reload();
  });

  void wb.register();
}
