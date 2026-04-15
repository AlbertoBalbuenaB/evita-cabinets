/**
 * Draft Tool — Catalog Panel (Step 6).
 *
 * Sidebar panel that queries `products_catalog WHERE draft_enabled = true`
 * and groups the results by AWI series. Each entry is draggable onto the
 * canvas via the standard HTML5 drag-and-drop API; the drag payload is a
 * JSON blob under the MIME type `DRAG_MIME`.
 *
 * Collapsible section layout mirrors the AWI/NAAWS 4.0 Appendix grouping:
 *   - 100 Series — Base Cabinets (no drawers)
 *   - 200 Series — Base Cabinets (with drawers)
 *   - 300 Series — Wall Hung Cabinets
 *   - 400 Series — Tall Storage Cabinets
 *   - 460 Series — Panels / Fillers / Toe Kicks / Crowns
 *   - 500 Series — Closet Library (legacy products_catalog rows only;
 *     closet_catalog is Phase 2)
 *
 * Thumbnails are rendered via `primitivesToSvgString` from the same block
 * renderer that paints the canvas.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Grip } from 'lucide-react';
import * as api from '../lib/draftApi';
import type { ProductsCatalogRow, DragPayload, DrawingFamily } from '../types';
import { DRAG_MIME } from '../types';
import { inToMm } from '../utils/format';
import { getBlockSvg, primitivesToSvgString } from '../svg/blockRenderer';

const SECTIONS: Array<{
  series: string;
  title: string;
  subtitle: string;
}> = [
  { series: '100', title: '100 Series', subtitle: 'Base Cabinets — No Drawers' },
  { series: '200', title: '200 Series', subtitle: 'Base Cabinets — With Drawers' },
  { series: '300', title: '300 Series', subtitle: 'Wall Hung Cabinets' },
  { series: '400', title: '400 Series', subtitle: 'Tall Storage Cabinets' },
  { series: '460', title: '460 Series', subtitle: 'Panels / Fillers / Toe Kicks / Crowns' },
  { series: '500', title: 'Closet Library', subtitle: 'Legacy closet items' },
];

export function CatalogPanel() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductsCatalogRow[]>([]);
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    '100': true,
    '200': true,
    '300': true,
    '400': false,
    '460': false,
    '500': false,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listDraftCatalog()
      .then((rows) => {
        if (!cancelled) setProducts(rows);
      })
      .catch((err) => {
        console.error('[CatalogPanel] Failed to load draft catalog', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySection: Record<string, ProductsCatalogRow[]> = {};
    for (const s of SECTIONS) bySection[s.series] = [];
    for (const p of products) {
      if (q && !p.sku.toLowerCase().includes(q) && !(p.description ?? '').toLowerCase().includes(q)) {
        continue;
      }
      const series = p.draft_series ?? '';
      if (bySection[series]) bySection[series].push(p);
    }
    return bySection;
  }, [products, search]);

  return (
    <aside className="glass-white w-72 min-w-[18rem] max-w-[18rem] flex flex-col h-full rounded-2xl overflow-hidden">
      <div className="p-3 border-b border-slate-200/60">
        <h2 className="text-sm font-semibold text-slate-800">Catalog Library</h2>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU or description…"
            className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-slate-300/80 bg-white/70 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading && (
          <div className="skeleton-shimmer h-24 rounded-lg" />
        )}
        {!loading &&
          SECTIONS.map((section) => {
            const items = grouped[section.series] ?? [];
            if (items.length === 0 && !search) {
              // Keep section header visible but collapsed-empty
            }
            const isOpen = openSections[section.series];
            return (
              <div key={section.series} className="glass-blue rounded-lg">
                <button
                  type="button"
                  onClick={() =>
                    setOpenSections((prev) => ({
                      ...prev,
                      [section.series]: !prev[section.series],
                    }))
                  }
                  className="w-full flex items-center justify-between p-2 text-left"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{section.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {section.subtitle} · {items.length}
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  )}
                </button>
                {isOpen && items.length > 0 && (
                  <ul className="px-1 pb-2 space-y-1">
                    {items.slice(0, 50).map((p) => (
                      <CatalogEntry key={p.id} product={p} />
                    ))}
                    {items.length > 50 && (
                      <li className="text-[11px] text-slate-500 px-2 py-1">
                        {items.length - 50} more — refine the search to see.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
      </div>
    </aside>
  );
}

function CatalogEntry({ product }: { product: ProductsCatalogRow }) {
  // Pre-render a tiny thumbnail SVG from the block renderer so every entry
  // shows a miniature of the cabinet (Step 7 hybrid renderer feeds the
  // panel thumbnails and the canvas from the same function).
  const thumb = useMemo(() => {
    try {
      const result = getBlockSvg(product, 'elevation', {
        lang: 'en',
        showDiamond: false,
        showSpecString: false,
      });
      if (result.customSvg) return result.customSvg;
      return primitivesToSvgString(result.primitives, result.widthMm, result.heightMm, 60);
    } catch (err) {
      console.warn('[CatalogEntry] thumb render failed', product.sku, err);
      return '';
    }
  }, [product]);

  function handleDragStart(e: React.DragEvent) {
    const widthMm = product.width_in ? inToMm(Number(product.width_in)) : 0;
    const heightMm = product.height_in ? inToMm(Number(product.height_in)) : 0;
    const depthMm = product.depth_in ? inToMm(Number(product.depth_in)) : 0;
    const payload: DragPayload = {
      kind: 'catalog_cabinet',
      product_id: product.id,
      sku: product.sku,
      width_mm: widthMm,
      height_mm: heightMm,
      depth_mm: depthMm,
      family: (product.draft_family ?? 'base') as DrawingFamily,
      series: product.draft_series ?? '',
      description: product.description ?? '',
    };
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <li
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-2 p-1.5 rounded-md hover:bg-white/70 cursor-grab active:cursor-grabbing group transition-colors"
    >
      <div
        className="w-11 h-11 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-md bg-white/60 border border-slate-200/60 text-slate-700 p-1"
        dangerouslySetInnerHTML={{ __html: thumb }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-mono text-slate-800 truncate">{product.sku}</div>
        <div className="text-[10px] text-slate-500 truncate">{product.description}</div>
      </div>
      <Grip className="h-3 w-3 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
    </li>
  );
}
