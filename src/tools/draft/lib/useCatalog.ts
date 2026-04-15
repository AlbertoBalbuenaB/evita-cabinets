/**
 * Draft Tool — catalog cache hook.
 *
 * Loads the draft-enabled products_catalog rows once per session and
 * exposes them as a `Record<id, row>` for O(1) lookup inside the canvas.
 * Multiple components that call `useCatalog()` share the same fetch via
 * a module-level promise.
 */

import { useEffect, useState } from 'react';
import * as api from './draftApi';
import type { ProductsCatalogRow } from '../types';

let cached: Record<string, ProductsCatalogRow> | null = null;
let pending: Promise<Record<string, ProductsCatalogRow>> | null = null;

function loadOnce(): Promise<Record<string, ProductsCatalogRow>> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  pending = api.listDraftCatalog().then((rows) => {
    const map: Record<string, ProductsCatalogRow> = {};
    for (const r of rows) map[r.id] = r;
    cached = map;
    pending = null;
    return map;
  });
  return pending;
}

export function useCatalog(): Record<string, ProductsCatalogRow> {
  const [map, setMap] = useState<Record<string, ProductsCatalogRow>>(cached ?? {});
  useEffect(() => {
    if (cached) return;
    let active = true;
    loadOnce()
      .then((m) => {
        if (active) setMap(m);
      })
      .catch((err) => {
        console.error('[useCatalog] load failed', err);
      });
    return () => {
      active = false;
    };
  }, []);
  return map;
}
