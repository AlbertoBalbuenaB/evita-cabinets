import type { Crumb } from '../contexts/PageChromeContext';

/**
 * Maps a URL path segment to a human-readable label. Used by Breadcrumbs
 * as a fallback when a page hasn't registered its own crumbs via
 * `usePageChrome`.
 */
export const ROUTE_LABELS: Record<string, string> = {
  '': 'Home',
  dashboard: 'Dashboard',
  projects: 'Projects',
  quotations: 'Quote',
  products: 'Cabinets',
  prices: 'Inventory',
  tools: 'Tools',
  takeoff: 'Takeoff',
  draft: 'Draft',
  'plan-viewer': 'Plan Viewer',
  kb: 'KB',
  wiki: 'Wiki',
  suppliers: 'Suppliers',
  settings: 'Settings',
  crm: 'CRM',
  optimizer: 'Optimizer',
  templates: 'Templates',
  proposals: 'Proposals',
  audit: 'Audit',
  new: 'New',
};

const UUID_LIKE = /^[0-9a-f]{8,}(-[0-9a-f]{4,})*$/i;
const LONG_HEX = /^[0-9a-f-]{20,}$/i;

function isDynamicSegment(segment: string): boolean {
  if (UUID_LIKE.test(segment)) return true;
  if (LONG_HEX.test(segment)) return true;
  return false;
}

/**
 * Derive breadcrumbs from a pathname. Known segments map to their label;
 * UUID-like segments render as an ellipsis (no link).
 *
 * Example: "/projects/abc-123-def/quotations/xyz"
 *   → [
 *       { label: 'Projects', to: '/projects' },
 *       { label: '…' },
 *       { label: 'Quote', to: '/projects/abc-123-def/quotations' },
 *       { label: '…' },
 *     ]
 */
export function deriveCrumbs(pathname: string): Crumb[] {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return [{ label: 'Home' }];

  const crumbs: Crumb[] = [];
  let acc = '';
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    acc += `/${seg}`;
    const isLast = i === parts.length - 1;
    if (isDynamicSegment(seg)) {
      crumbs.push({ label: '…' });
      continue;
    }
    const label = ROUTE_LABELS[seg] ?? seg;
    crumbs.push({ label, to: isLast ? undefined : acc });
  }
  return crumbs;
}
