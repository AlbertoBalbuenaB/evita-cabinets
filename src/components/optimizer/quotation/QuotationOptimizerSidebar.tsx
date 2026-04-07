import { Layers, Package, Scissors, Settings } from 'lucide-react';
import type { UseBoundStore, StoreApi } from 'zustand';
import type { QuotationOptimizerState } from '../../../hooks/createQuotationOptimizerStore';

interface Props {
  useStore: UseBoundStore<StoreApi<QuotationOptimizerState>>;
}

/**
 * Left sidebar for the Cut-list Pricing tab.
 *
 * Shows:
 *  - Stocks list (auto-built from price_list, read-only)
 *  - Edge band slot mapping (a/b/c → price_list rows)
 *  - Optimization settings (sierra, minOffcut, boardTrim, trimIncludesKerf)
 *  - Piece count summary
 *
 * The build/run/save actions live in the tab header (not here), so this
 * sidebar is purely configuration + inspection. All reads come from the
 * per-quotation Zustand store passed in as a prop.
 */
export function QuotationOptimizerSidebar({ useStore }: Props) {
  const pendingPieces        = useStore((s) => s.pendingPieces);
  const pendingStocks        = useStore((s) => s.pendingStocks);
  const pendingEbConfig      = useStore((s) => s.pendingEbConfig);
  const pendingBuiltAt       = useStore((s) => s.pendingBuiltAt);
  const globalSierra         = useStore((s) => s.globalSierra);
  const minOffcut            = useStore((s) => s.minOffcut);
  const boardTrim            = useStore((s) => s.boardTrim);
  const trimIncludesKerf     = useStore((s) => s.trimIncludesKerf);
  const setGlobalSierra      = useStore((s) => s.setGlobalSierra);
  const setMinOffcut         = useStore((s) => s.setMinOffcut);
  const setBoardTrim         = useStore((s) => s.setBoardTrim);
  const setTrimIncludesKerf  = useStore((s) => s.setTrimIncludesKerf);

  const totalPieceCount = pendingPieces.reduce((s, p) => s + p.cantidad, 0);
  const uniqueCabinets  = new Set(pendingPieces.map((p) => p.cabinetId).filter(Boolean)).size;
  const uniqueAreas     = new Set(pendingPieces.map((p) => p.areaId).filter(Boolean)).size;

  return (
    <div className="h-full overflow-y-auto bg-white border-r border-slate-200">
      <div className="p-3 space-y-4">

        {/* ── Build summary ─────────────────────────────────── */}
        <section>
          <header className="flex items-center gap-1.5 mb-2">
            <Layers className="h-3.5 w-3.5 text-blue-600" />
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">Build Summary</h3>
          </header>
          {pendingBuiltAt ? (
            <div className="text-xs space-y-1 text-slate-600">
              <div className="flex justify-between"><span>Pieces</span><span className="font-mono tabular-nums">{totalPieceCount}</span></div>
              <div className="flex justify-between"><span>Cabinets</span><span className="font-mono tabular-nums">{uniqueCabinets}</span></div>
              <div className="flex justify-between"><span>Areas</span><span className="font-mono tabular-nums">{uniqueAreas}</span></div>
              <div className="text-[10px] text-slate-400 mt-1">Built {formatRelative(pendingBuiltAt)}</div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Click "Build from Quotation" in the header to populate.</p>
          )}
        </section>

        {/* ── Stocks list ────────────────────────────────────── */}
        <section>
          <header className="flex items-center gap-1.5 mb-2">
            <Package className="h-3.5 w-3.5 text-blue-600" />
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">Stocks ({pendingStocks.length})</h3>
          </header>
          {pendingStocks.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No stocks yet.</p>
          ) : (
            <ul className="space-y-1">
              {pendingStocks.map((s) => (
                <li key={s.id} className="rounded border border-slate-200 px-2 py-1.5 text-xs">
                  <div className="font-medium text-slate-800 truncate" title={s.nombre}>{s.nombre}</div>
                  <div className="flex justify-between text-slate-500 mt-0.5">
                    <span className="font-mono tabular-nums">{s.ancho} × {s.alto} mm</span>
                    <span className="font-mono tabular-nums">${s.costo.toFixed(2)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Edge banding slots ─────────────────────────────── */}
        <section>
          <header className="flex items-center gap-1.5 mb-2">
            <Scissors className="h-3.5 w-3.5 text-blue-600" />
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">Edge Banding</h3>
          </header>
          <ul className="space-y-1">
            {(['a', 'b', 'c'] as const).map((slot) => {
              const cfg = pendingEbConfig[slot];
              const isSet = cfg.id !== '';
              return (
                <li key={slot} className={`rounded border px-2 py-1.5 text-xs ${isSet ? 'border-slate-200' : 'border-dashed border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono uppercase text-slate-400">{slot}</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {isSet ? `$${cfg.price.toFixed(2)}/m` : '—'}
                    </span>
                  </div>
                  <div className={`mt-0.5 truncate ${isSet ? 'text-slate-800' : 'text-slate-400 italic'}`} title={cfg.name || 'not configured'}>
                    {cfg.name || 'not configured'}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Settings ────────────────────────────────────────── */}
        <section>
          <header className="flex items-center gap-1.5 mb-2">
            <Settings className="h-3.5 w-3.5 text-blue-600" />
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">Settings</h3>
          </header>
          <div className="space-y-2">
            <NumberField
              label="Kerf (mm)"
              value={globalSierra}
              onChange={setGlobalSierra}
              step={0.1}
              min={0}
            />
            <NumberField
              label="Min offcut (mm)"
              value={minOffcut}
              onChange={setMinOffcut}
              step={10}
              min={0}
            />
            <NumberField
              label="Board trim (mm)"
              value={boardTrim}
              onChange={setBoardTrim}
              step={1}
              min={0}
            />
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={trimIncludesKerf}
                onChange={(e) => setTrimIncludesKerf(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Trim includes kerf</span>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function NumberField({
  label, value, onChange, step, min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-600">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-0.5 w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono tabular-nums focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
    </label>
  );
}

function formatRelative(isoTs: string): string {
  const delta = Date.now() - new Date(isoTs).getTime();
  const sec = Math.round(delta / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(isoTs).toLocaleDateString();
}
