import { useState } from 'react';
import { Layers, Package, Scissors, Settings, RefreshCw, Eraser, Loader2 } from 'lucide-react';
import type { UseBoundStore, StoreApi } from 'zustand';
import type { QuotationOptimizerState } from '../../../hooks/createQuotationOptimizerStore';

interface Props {
  useStore: UseBoundStore<StoreApi<QuotationOptimizerState>>;
}

/**
 * Left sidebar for the Breakdown tab.
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
  const pendingPieces              = useStore((s) => s.pendingPieces);
  const pendingStocks              = useStore((s) => s.pendingStocks);
  const pendingEbConfig            = useStore((s) => s.pendingEbConfig);
  const pendingBuiltAt             = useStore((s) => s.pendingBuiltAt);
  const pendingCabinetInstanceCount = useStore((s) => s.pendingCabinetInstanceCount);
  const globalSierra               = useStore((s) => s.globalSierra);
  const minOffcut                  = useStore((s) => s.minOffcut);
  const boardTrim                  = useStore((s) => s.boardTrim);
  const trimIncludesKerf           = useStore((s) => s.trimIncludesKerf);
  const engineMode                 = useStore((s) => s.engineMode);
  const objective                  = useStore((s) => s.objective);
  const setGlobalSierra            = useStore((s) => s.setGlobalSierra);
  const setMinOffcut               = useStore((s) => s.setMinOffcut);
  const setBoardTrim               = useStore((s) => s.setBoardTrim);
  const setTrimIncludesKerf        = useStore((s) => s.setTrimIncludesKerf);
  const setEngineMode              = useStore((s) => s.setEngineMode);
  const setObjective               = useStore((s) => s.setObjective);
  const clearPending               = useStore((s) => s.clearPending);
  const refreshStocks              = useStore((s) => s.refreshStocks);
  const selectedStockIds           = useStore((s) => s.selectedStockIds);
  const selectedEbSlots            = useStore((s) => s.selectedEbSlots);
  const toggleStockSelected        = useStore((s) => s.toggleStockSelected);
  const toggleEbSlot               = useStore((s) => s.toggleEbSlot);

  const [refreshingStocks, setRefreshingStocks] = useState(false);

  const hasPending = pendingPieces.length > 0;

  async function handleRefreshStocks() {
    setRefreshingStocks(true);
    try { await refreshStocks(); } finally { setRefreshingStocks(false); }
  }

  function handleClear() {
    if (!confirm('Discard the current build? This will clear pending pieces, stocks, and any unsaved result.')) return;
    clearPending();
  }

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
              <div className="flex justify-between"><span>Cabinet types</span><span className="font-mono tabular-nums">{uniqueCabinets}</span></div>
              <div className="flex justify-between"><span>Cabinet units</span><span className="font-mono tabular-nums">{pendingCabinetInstanceCount}</span></div>
              <div className="flex justify-between"><span>Areas</span><span className="font-mono tabular-nums">{uniqueAreas}</span></div>
              <div className="text-[10px] text-slate-400 mt-1">Built {formatRelative(pendingBuiltAt)}</div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Click "Build from Quotation" in the header to populate.</p>
          )}

          {hasPending && (
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={handleRefreshStocks}
                disabled={refreshingStocks}
                title="Re-fetch material prices from the price list. Invalidates the current result."
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {refreshingStocks
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <RefreshCw className="h-3 w-3" />}
                Refresh stocks
              </button>
              <button
                type="button"
                onClick={handleClear}
                title="Discard the current build."
                className="inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              >
                <Eraser className="h-3 w-3" />
                Clear
              </button>
            </div>
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
                <li key={s.id} className={`rounded border px-2 py-1.5 text-xs ${selectedStockIds.has(s.id) ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-60'}`}>
                  <label className="flex items-start gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStockIds.has(s.id)}
                      onChange={() => toggleStockSelected(s.id)}
                      className="mt-0.5 rounded border-slate-300 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 truncate" title={s.nombre}>{s.nombre}</div>
                      <div className="flex justify-between text-slate-500 mt-0.5">
                        <span className="font-mono tabular-nums">{s.ancho}×{s.alto}mm</span>
                        <span className="font-mono tabular-nums">${s.costo.toFixed(2)}</span>
                      </div>
                    </div>
                  </label>
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
              const isSelected = selectedEbSlots.has(slot);
              return (
                <li key={slot} className={`rounded border px-2 py-1.5 text-xs ${isSet ? (isSelected ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-60') : 'border-dashed border-slate-200 bg-slate-50'}`}>
                  <label className="flex items-start gap-1.5 cursor-pointer">
                    {isSet && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEbSlot(slot)}
                        className="mt-0.5 rounded border-slate-300 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono uppercase text-slate-400">{slot}</span>
                        <span className="font-mono tabular-nums text-slate-500">
                          {isSet ? `$${cfg.price.toFixed(2)}/m` : '—'}
                        </span>
                      </div>
                      <div className={`mt-0.5 truncate ${isSet ? 'text-slate-800' : 'text-slate-400 italic'}`} title={cfg.name || 'not configured'}>
                        {cfg.name || 'not configured'}
                      </div>
                    </div>
                  </label>
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

            {/* Engine mode */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-1.5 font-medium">Engine</p>
              <div className="flex flex-col gap-1">
                {(['guillotine', 'both'] as const).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="quotation-engine-mode"
                      value={mode}
                      checked={engineMode === mode}
                      onChange={() => setEngineMode(mode)}
                      className="border-slate-300 text-blue-600"
                    />
                    {mode === 'guillotine' ? 'Guillotine only (dimensionadora)' : 'Both engines (+ MaxRect)'}
                  </label>
                ))}
              </div>
            </div>

            {/* Objective */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-1.5 font-medium">Optimize for</p>
              <div className="flex flex-col gap-1">
                {([
                  ['min-boards', 'Menos tableros'],
                  ['min-waste',  'Menos desperdicio'],
                  ['min-cuts',   'Menos cortes'],
                ] as const).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="quotation-objective"
                      value={val}
                      checked={objective === val}
                      onChange={() => setObjective(val)}
                      className="border-slate-300 text-blue-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
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
