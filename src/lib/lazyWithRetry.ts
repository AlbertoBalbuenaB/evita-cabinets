import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Wraps `React.lazy()` with retry + cache-reload-on-stale-hash semantics.
 *
 * Vite fingerprints each lazy chunk with a content hash in the filename
 * (e.g. `ProjectPage-2vOe8XpA.js`). When a new deploy lands, Vercel starts
 * serving a fresh `index.html` with new hashes, and removes the old chunks
 * from its CDN. A user who had the app open before the deploy is still
 * running the OLD `index.html`; their first navigation to a not-yet-loaded
 * route triggers `import()` against a URL that now 404s. The default React
 * behaviour is to surface "Failed to fetch dynamically imported module" to
 * the nearest ErrorBoundary — the user sees a red "Something went wrong"
 * card and has to manually refresh.
 *
 * This helper short-circuits that:
 *   1. Retries the failed `import()` once after a short delay. Handles
 *      transient network blips silently (Suspense keeps showing the
 *      fallback while the retry runs).
 *   2. If the retry also fails, forces a hard page reload so the browser
 *      fetches the fresh `index.html` and the new hashes. From the user's
 *      perspective the navigation "just works" after a blink — no error
 *      card.
 *
 * A sessionStorage sentinel prevents reload loops: if the new bundle ALSO
 * fails to load within 10s of a previous reload, we stop reloading and let
 * the error bubble up to ErrorBoundary (signals a real bug, not stale hash).
 *
 * Usage: replace `lazy(() => import('./Page'))` with
 * `lazyWithRetry(() => import('./Page'))`. The `.then(m => ({ default: m.Foo }))`
 * pattern that named-export pages use keeps working because the factory's
 * promise shape is unchanged.
 */
// Pages take whatever props they take; mirror React.lazy's own
// `ComponentType<any>` bound so callers don't need to widen prop types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<M extends { default: ComponentType<any> }>(
  factory: () => Promise<M>,
): LazyExoticComponent<M['default']> {
  return lazy<M['default']>(async () => {
    try {
      return await factory();
    } catch (firstErr) {
      // Short delay before retry — smooths over transient network blips.
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      try {
        return await factory();
      } catch (secondErr) {
        // Two consecutive fails. Almost certainly a stale-hash situation
        // post-deploy (the fingerprinted chunk URL no longer exists on
        // the CDN). Hard-reload unless we already did one in the last 10s.
        const SENTINEL_KEY = 'evita:lazy-reload-sentinel';
        const STALE_WINDOW_MS = 10_000;
        try {
          const lastReloadTs = Number(sessionStorage.getItem(SENTINEL_KEY) ?? '0');
          const now = Date.now();
          if (now - lastReloadTs > STALE_WINDOW_MS) {
            sessionStorage.setItem(SENTINEL_KEY, String(now));
            // Hard reload picks up the fresh index.html and new chunk hashes.
            window.location.reload();
            // Return a pending promise so Suspense keeps the fallback visible
            // while the reload navigates away; it will never resolve here.
            return new Promise<M>(() => {});
          }
        } catch {
          // sessionStorage might be unavailable (e.g. incognito iframe);
          // fall through to re-throwing.
        }
        // Inside the reload-loop window — let the error bubble to
        // ErrorBoundary so the user sees something rather than a silent
        // hang. Log the first error too so devtools shows the original cause.
        console.error('[lazyWithRetry] import failed twice and reload was suppressed:', { firstErr, secondErr });
        throw secondErr;
      }
    }
  });
}
