/**
 * Draft Tool — catalog cache hook.
 *
 * Loads the draft-enabled products_catalog rows once per session and
 * exposes them as a `Record<id, row>` for O(1) lookup inside the canvas.
 * Multiple components that call `useCatalog()` share the same fetch via
 * a module-level promise.
 *
 * CRITICAL FIX (crash root cause):
 *   - The previous version did NOT clear `pending` on fetch failure,
 *     leaving the promise stuck in rejected state forever. Subsequent
 *     calls got the stale rejected promise, and the hook returned a
 *     NEW `{}` on every render → the `visibleElements` useMemo that
 *     depends on `catalog` recomputed infinitely → white-screen crash.
 *   - Fix: `.catch()` resets `pending = null` so re-fetch can happen.
 *   - Fix: `EMPTY_MAP` is a stable module-level constant so the hook
 *     returns the SAME reference on every cache-miss render.
 */

import { useEffect, useState } from 'react';
import * as api from './draftApi';
import type { ProductsCatalogRow } from '../types';

type CatalogMap = Record<string, ProductsCatalogRow>;

let cached: CatalogMap | null = null;
let pending: Promise<CatalogMap> | null = null;

/** Stable empty reference — returning this prevents useMemo churn. */
const EMPTY_MAP: CatalogMap = {};

function loadOnce(): Promise<CatalogMap> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  pending = api
    .listDraftCatalog()
    .then((rows) => {
      const map: CatalogMap = {};
      for (const r of rows) map[r.id] = r;
      cached = map;
      pending = null;
      return map;
    })
    .catch((err) => {
      // CRITICAL: clear pending so the next mount/retry can re-fetch
      // instead of returning the stuck rejected promise forever.
      pending = null;
      console.error('[useCatalog] fetch failed, will retry on next mount', err);
      return EMPTY_MAP;
    });
  return pending;
}

export function useCatalog(): CatalogMap {
  const [map, setMap] = useState<CatalogMap>(cached ?? EMPTY_MAP);

  useEffect(() => {
    if (cached) {
      // Cache already populated (e.g., another component loaded it).
      // Set it in case this component mounted before the cache was ready.
      setMap(cached);
      return;
    }
    let active = true;
    loadOnce()
      .then((m) => {
        if (active && m !== EMPTY_MAP) setMap(m);
      })
      .catch(() => {
        // loadOnce already handles errors internally; this catch is
        // just a safety net to prevent unhandled rejection warnings.
      });
    return () => {
      active = false;
    };
  }, []);

  return map;
}
