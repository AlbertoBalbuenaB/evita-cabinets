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
  const pendingEbTypeSummary       = useStore((s) => s.pendingEbTypeSummary);
  const pendingBuiltAt             = useStore((s) => s.pendingBuiltAt);
  const pendingCabinetInstanceCount = useStore((s) => s.pendingCabinetInstanceCount);
  const pendingCabinetDetails      = useStore((s) => s.pendingCabinetDetails);
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
  const uniqueAreas     = new Set([
    ...pendingPieces.map((p) => p.areaId).filter(Boolean),
    ...Object.values(pendingCabinetDetails).map((d) => d.areaId),
  ]).size;

  return (
    <div className="h-full overflow-y-auto bg-surf-card border-r border-border-soft">
      <div className="p-3 space-y-4">

        {/* ── Build summary ─────────────────────────────────── */}
        <section>
          <header className="flex items-center gap-1.5 mb-2">
            <Layers className="h-3.5 w-3.5 text-accent-text" />
            <h3 className="text-xs font-semibold text-fg-800 uppercase tracking-wide">Build Summary</h3>
          </header>
          {pendingBuiltAt ? (
            <div className="text-xs space-y-1 text-fg-600">
              <div className="flex justify-between"><span>Pieces</span><span className="font-mono tabular-nums">{totalPieceCount}</span></div>
              <div className="flex justify-between"><span>Cabinet types</span><span className="font-mono tabular-nums">{uniqueCabinets}</span></div>
              <div className="flex justify-between"><span>Cabinet units</span><span className="font-mono tabular-nums">{pendingCabinetInstanceCount}</span></div>
              <div className="flex justify-between"><span>Areas</span><span className="font-mono tabular-nums">{uniqueAreas}</span></div>
              <div className="text-[10px] text-fg-400 mt-1">Built {formatRelative(pendingBuiltAt)}</div>
            </div>
          ) : (
            <p className="text-xs text-fg-400 italic">Click "Build from Quotation" in the header to populate.</p>
          )}

          {hasPending && (
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={handleRefreshStocks}
                disabled={refreshingStocks}
                title="Re-fetch material prices from the price list. Invalidates the current result."
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-border-soft bg-surf-card text-fg-700 hover:bg-surf-app disabled:opacity-50"
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
                className="inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-border-soft bg-surf-card text-fg-600 hover:bg-status-red-bg hover:text-status-red-fg hover:border-status-red-brd"
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
            <Package className="h-3.5 w-3.5 text-accent-text" />
            <h3 className="text-xs font-semibold text-fg-800 uppercase tracking-wide">Stocks ({pendingStocks.length})</h3>
          </header>
          {pendingStocks.length === 0 ? (
            <p className="text-xs text-fg-400 italic">No stocks yet.</p>
          ) : (
            <ul className="space-y-1">
              {pendingStocks.map((s) => (
                <li key={s.id} className={`rounded border px-2 py-1.5 text-xs ${selectedStockIds.has(s.id) ? 'border-border-soft' : 'border-dashed border-border-solid opacity-60'}`}>
                  <label className="flex items-start gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStockIds.has(s.id)}
                      onChange={() => toggleStockSelected(s.id)}
                      className="mt-0.5 rounded border-border-solid shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-fg-800 truncate" title={s.nombre}>{s.nombre}</div>
                      <div className="flex justify-between text-fg-500 mt-0.5">
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

        {/* ── Edge banding types ─────────────────────────────── */}
        <section>
          <header className="flex items-center gap-1.5 mb-2">
            <Scissors className="h-3.5 w-3.5 text-accent-text" />
            <h3 className="text-xs font-semibold text-fg-800 uppercase tracking-wide">Edge Banding</h3>
          </header>
          <ul className="space-y-1">
            {Object.keys(pendingEbTypeSummary).length > 0 ? (
              Object.values(pendingEbTypeSummary).map((eb) => (
                <li key={eb.plId} className="rounded border border-border-soft px-2 py-1.5 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-fg-400">{eb.roles.join(' + ')}</span>
                      <span className="font-mono tabular-nums text-fg-500">${eb.pricePerMeter.toFixed(2)}/m</span>
                    </div>
                    <div className="mt-0.5 truncate text-fg-800" title={eb.name}>
                      {eb.name}
                    </div>
                  </div>
                </li>
              ))
            ) : (
              /* Legacy fallback: 3 fixed slots */
              (['a', 'b', 'c'] as const).map((slot) => {
                const cfg = pendingEbConfig[slot];
                const isSet = cfg.id !== '';
                const isSelected = selectedEbSlots.has(slot);
                return (
                  <li key={slot} className={`rounded border px-2 py-1.5 text-xs ${isSet ? (isSelected ? 'border-border-soft' : 'border-dashed border-border-solid opacity-60') : 'border-dashed border-border-soft bg-surf-app'}`}>
                    <label className="flex items-start gap-1.5 cursor-pointer">
                      {isSet && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEbSlot(slot)}
                          className="mt-0.5 rounded border-border-solid shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-mono uppercase text-fg-400">{slot}</span>
                          <span className="font-mono tabular-nums text-fg-500">
                            {isSet ? `$${cfg.price.toFixed(2)}/m` : '—'}
                          </span>
                        </div>
                        <div className={`mt-0.5 truncate ${isSet ? 'text-fg-800' : 'text-fg-400 italic'}`} title={cfg.name || 'not configured'}>
                          {cfg.name || 'not configured'}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        {/* ── Settings ────────────────────────────────────────── */}
        <section>
          <header className="flex items-center gap-1.5 mb-2">
            <Settings className="h-3.5 w-3.5 text-accent-text" />
            <h3 className="text-xs font-semibold text-fg-800 uppercase tracking-wide">Settings</h3>
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
            <label className="flex items-center gap-2 text-xs text-fg-700">
              <input
                type="checkbox"
                checked={trimIncludesKerf}
                onChange={(e) => setTrimIncludesKerf(e.target.checked)}
                className="rounded border-border-solid"
              />
              <span>Trim includes kerf</span>
            </label>

            {/* Engine mode */}
            <div className="pt-2 border-t border-border-soft">
              <p className="text-xs text-fg-500 mb-1.5 font-medium">Engine</p>
              <div className="flex flex-col gap-1">
                {(['guillotine', 'both'] as const).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-xs text-fg-700 cursor-pointer">
                    <input
                      type="radio"
                      name="quotation-engine-mode"
                      value={mode}
                      checked={engineMode === mode}
                      onChange={() => setEngineMode(mode)}
                      className="border-border-solid text-accent-text"
                    />
                    {mode === 'guillotine' ? 'Guillotine only (panel saw)' : 'Both engines (+ MaxRect)'}
                  </label>
                ))}
              </div>
            </div>

            {/* Objective */}
            <div className="pt-2 border-t border-border-soft">
              <p className="text-xs text-fg-500 mb-1.5 font-medium">Optimize for</p>
              <div className="flex flex-col gap-1">
                {([
                  ['min-boards', 'Fewer boards'],
                  ['min-waste',  'Less waste'],
                  ['min-cuts',   'Fewer cuts'],
                ] as const).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 text-xs text-fg-700 cursor-pointer">
                    <input
                      type="radio"
                      name="quotation-objective"
                      value={val}
                      checked={objective === val}
                      onChange={() => setObjective(val)}
                      className="border-border-solid text-accent-text"
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
      <span className="text-xs text-fg-600">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-0.5 w-full px-2 py-1 text-xs border border-border-soft rounded font-mono tabular-nums focus:ring-1 focus-visible:ring-focus focus:outline-none"
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
