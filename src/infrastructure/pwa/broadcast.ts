const CHANNEL_NAME = 'planova-changes';

/**
 * Publish a named event to all same-origin tabs.
 * No-ops gracefully when BroadcastChannel is unavailable (e.g. in tests).
 *
 * @param event - Event name string to broadcast.
 */
export function publish(event: string): void {
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(event);
    channel.close();
  } catch {
    // BroadcastChannel unavailable (SSR, test env, old browser) — safe no-op.
  }
}

/**
 * Subscribe to cross-tab events published on the planova-changes channel.
 *
 * @param handler - Called with the event string on each message.
 * @returns Unsubscribe function — call to stop receiving events.
 */
export function subscribe(handler: (event: string) => void): () => void {
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    const listener = (msg: MessageEvent<unknown>): void => {
      if (typeof msg.data === 'string') {
        handler(msg.data);
      }
    };
    channel.addEventListener('message', listener);
    return () => {
      channel.removeEventListener('message', listener);
      channel.close();
    };
  } catch {
    // BroadcastChannel unavailable — return no-op unsubscribe.
    return () => undefined;
  }
}
