import * as React from 'react';
import { API_BASE } from '../../billing';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export const SAVE_DELAY_MS = 700;
// how long "Saved" stays up
export const SAVED_SHOWN_MS = 2000;

// Batches a bike's setting changes into one updateBike call. Changes are merged and sent
// SAVE_DELAY_MS after the last one, only the changed fields go out (the Lambda leaves the
// rest alone), and saves run one at a time so they arrive in order. A failed save keeps its
// changes for the next try. Anything still pending is sent when the card goes away or the
// page is hidden.
export default function useBikeSaver(bikeId: number, token: string) {
  const pending = React.useRef<Record<string, number>>({});
  const timer = React.useRef<number | undefined>(undefined);
  const chain = React.useRef<Promise<void>>(Promise.resolve());
  const [state, setState] = React.useState<SaveState>('idle');

  // "Saved" clears itself after a moment (but never hides "Saving" or an error)
  React.useEffect(() => {
    if (state !== 'saved') return;
    const t = window.setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), SAVED_SHOWN_MS);
    return () => window.clearTimeout(t);
  }, [state]);

  // Clears "Saved" right away, e.g. when the rider moves to another field.
  const dismiss = React.useCallback(() => setState((s) => (s === 'saved' ? 'idle' : s)), []);

  const urlFor = React.useCallback((changes: Record<string, number>) => {
    const params = new URLSearchParams({ bike_id: String(bikeId), token });
    for (const [k, v] of Object.entries(changes)) params.set(k, String(v));
    return `${API_BASE}/updateBike?${params}`;
  }, [bikeId, token]);

  const send = React.useCallback((): Promise<void> => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    // queue behind any save already in flight, so the server sees changes in order
    chain.current = chain.current.then(async () => {
      const changes = pending.current;
      if (Object.keys(changes).length === 0) return;
      pending.current = {};
      setState('saving');
      try {
        const res = await fetch(urlFor(changes), { method: 'POST', body: '{}' });
        if (!res.ok) throw new Error(`updateBike ${res.status}`);
        if (Object.keys(pending.current).length === 0 && timer.current === undefined) setState('saved');
      } catch (err) {
        console.warn(err);
        // keep the failed changes, under anything newer
        pending.current = { ...changes, ...pending.current };
        setState('error');
      }
    });
    return chain.current;
  }, [urlFor]);

  const queue = React.useCallback((changes: Record<string, number>) => {
    pending.current = { ...pending.current, ...changes };
    setState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { send(); }, SAVE_DELAY_MS);
  }, [send]);

  // Sends anything pending now and waits for it (before applying a setup, for example).
  const flush = send;

  // The fields still waiting to be saved, so a garage reload doesn't wipe them from the card.
  const unsaved = React.useCallback(() => ({ ...pending.current }), []);

  // Last chance when leaving: keepalive lets the request finish after the page goes away.
  React.useEffect(() => {
    const sendNow = () => {
      if (Object.keys(pending.current).length === 0) return;
      const url = urlFor(pending.current);
      pending.current = {};
      window.clearTimeout(timer.current);
      fetch(url, { method: 'POST', body: '{}', keepalive: true }).catch(() => {});
    };
    const onHide = () => { if (document.visibilityState === 'hidden') sendNow(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', sendNow);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', sendNow);
      sendNow();
    };
  }, [urlFor]);

  return { queue, flush, unsaved, dismiss, state };
}
