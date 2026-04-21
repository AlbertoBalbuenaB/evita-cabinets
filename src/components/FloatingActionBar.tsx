import { useState, useEffect } from 'react';
import { Plus, RefreshCw, TrendingUp, Save, ArrowDownUp,
         Printer, FileSpreadsheet, FileJson, Download,
         DollarSign, Package, ChevronDown, Layers, AlertTriangle } from 'lucide-react';
import { PricingMethodToggle } from './optimizer/quotation/PricingMethodToggle';
import type { PricingMethod } from '../types';

interface FloatingActionBarProps {
  onAddArea: () => void;
  onChangeMaterials: () => void;
  onRecalculatePrices: () => void;
  onSaveChanges: () => void;
  onPrint: () => void;
  onPrintUSD: () => void;
  onPrintCutListEN: () => void;
  onPrintCutListES: () => void;
  onExportCSV: () => void;
  onExportDetailedCSV: () => void;
  onExportJSON: () => void;
  onAddProduct: () => void;
  onSaveAreasOrder?: () => void;
  hasAreasOrderChanged?: boolean;
  savingAreasOrder?: boolean;
  areasEmpty: boolean;
  /**
   * Global pricing method for the whole Quotation section. The MXN/USD PDF
   * exports, the Info/Pricing/Analytics tabs, the Header Card total, and the
   * per-area Material Breakdown all follow this value. The switch lives in
   * this toolbar (next to Print) and writes `quotations.pricing_method`
   * through the `onPricingMethodChange` callback.
   */
  pricingMethod?: PricingMethod;
  /** True once the quotation has at least one active optimizer run. */
  canSelectOptimizer?: boolean;
  /** True when the active optimizer run is stale (cabinets changed after run). */
  optimizerStale?: boolean;
  onPricingMethodChange?: (next: PricingMethod) => void;
}

export function FloatingActionBar({
  onAddArea,
  onChangeMaterials,
  onRecalculatePrices,
  onSaveChanges,
  onPrint,
  onPrintUSD,
  onPrintCutListEN,
  onPrintCutListES,
  onExportCSV,
  onExportDetailedCSV,
  onExportJSON,
  onAddProduct,
  onSaveAreasOrder,
  hasAreasOrderChanged = false,
  savingAreasOrder = false,
  areasEmpty,
  pricingMethod = 'sqft',
  canSelectOptimizer = false,
  optimizerStale = false,
  onPricingMethodChange,
}: FloatingActionBarProps) {
  const isOptimizerMode = pricingMethod === 'optimizer';
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);
  const [isCSVMenuOpen, setIsCSVMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  function closeMenus() {
    setIsPrintMenuOpen(false);
    setIsCSVMenuOpen(false);
  }

  return (
    <>
      {(isPrintMenuOpen || isCSVMenuOpen) && (
        <div className="fixed inset-0 z-[35]" onClick={closeMenus} />
      )}

      <div
        className="fixed right-0 left-0 lg:left-[var(--rail-w)] z-[36] transition-[left,box-shadow] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          // Tracks the ProjectHeader's measured height via the `--ph-h`
          // CSS var written from ProjectHeader on mount + every resize.
          // Only constant: 56 px Topbar. The FAB sits flush against the
          // header's bottom border (0 px gap, no overlap) — their borders
          // touch cleanly because `--ph-h` uses `Math.ceil` of the
          // measured height. Fallback 200 px is used only if the var
          // hasn't been set (JS disabled).
          top: 'calc(56px + var(--ph-h, 200px))',
          boxShadow: scrolled
            ? 'var(--shadow-card)'
            : 'none',
          background: 'var(--surf-projhdr)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-soft)',
          borderRadius: 0,
        }}
      >
        <div className="px-4 h-11 flex items-center gap-1">

          <button
            onClick={onSaveChanges}
            className="h-[30px] px-3 rounded-md text-[12.5px] font-semibold text-white inline-flex items-center gap-[5px] shrink-0 tracking-[0.01em] transition-opacity hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
            }}
          >
            <Save style={{ width: 13, height: 13 }} />
            <span>Save</span>
          </button>

          <button
            onClick={onAddArea}
            className="h-[30px] px-3 rounded-md bg-accent-primary text-accent-on text-[12.5px] font-semibold inline-flex items-center gap-[5px] shrink-0 tracking-[0.01em] shadow-btn transition-opacity hover:opacity-90"
          >
            <Plus style={{ width: 13, height: 13 }} />
            <span className="hidden sm:inline">Add Area</span>
          </button>

          <div className="w-px h-5 bg-sep mx-1 shrink-0" />

          <button
            onClick={onAddProduct}
            className="h-[30px] px-2.5 rounded-md bg-surf-btn text-fg-700 text-[12.5px] font-medium border border-border-soft inline-flex items-center gap-[5px] shrink-0 transition-colors hover:bg-surf-btn-hover hover:border-accent-tint-border"
          >
            <Package style={{ width: 13, height: 13 }} className="text-accent-a" />
            <span className="hidden sm:inline">Create Cabinet</span>
          </button>

          <div className="w-px h-5 bg-sep mx-1 shrink-0" />

          {[
            { icon: RefreshCw, label: 'Materials', onClick: onChangeMaterials, color: '#0891b2', disabled: false },
            { icon: TrendingUp, label: 'Prices', onClick: onRecalculatePrices, color: '#7c3aed', disabled: areasEmpty },
          ].map(({ icon: Icon, label, onClick, color, disabled }) => (
            <button
              key={label}
              onClick={onClick}
              disabled={disabled}
              className={`h-[30px] px-2.5 rounded-md bg-transparent text-[12.5px] font-medium inline-flex items-center gap-[5px] shrink-0 transition-colors ${
                disabled
                  ? 'text-fg-400 cursor-not-allowed opacity-50'
                  : 'text-fg-700 hover:bg-surf-btn-hover'
              }`}
            >
              <Icon style={{ width: 13, height: 13, color: disabled ? 'var(--fg-400)' : color }} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}

          {hasAreasOrderChanged && onSaveAreasOrder && (
            <button
              onClick={onSaveAreasOrder}
              disabled={savingAreasOrder}
              className="h-[30px] px-2.5 rounded-md bg-status-amber-fg text-white text-[12.5px] font-semibold inline-flex items-center gap-[5px] shrink-0"
            >
              <ArrowDownUp style={{ width: 13, height: 13 }} />
              <span className="hidden sm:inline">{savingAreasOrder ? 'Saving...' : 'Save Order'}</span>
            </button>
          )}

          <div className="flex-1" />

          <div className="w-px h-5 bg-sep mx-1 shrink-0" />

          {/*
            Global Pricing Method switch — flips FT² ↔ Optimizer for the whole
            Quotation section: Info/Pricing/Analytics tabs, Header Card total,
            per-area Material Breakdown, AND the PDF exports. Default is FT²;
            once the first optimizer run is saved, the method auto-switches to
            Optimizer (one-shot — further manual toggles are respected).
          */}
          <div className="flex items-center gap-1.5 shrink-0">
            <PricingMethodToggle
              value={pricingMethod}
              onChange={(next) => onPricingMethodChange?.(next)}
              canSelectOptimizer={canSelectOptimizer}
              size="sm"
            />
            {isOptimizerMode && optimizerStale && (
              <div
                title="The active optimizer run is stale because cabinets changed after it was saved. Values shown are from the last run. Re-optimize in the Breakdown tab to refresh."
                className="h-[22px] px-2 rounded-full bg-status-amber-bg text-status-amber-fg border border-status-amber-brd text-[10px] font-bold tracking-[0.05em] flex items-center gap-1 cursor-help select-none"
              >
                <AlertTriangle style={{ width: 10, height: 10 }} />
                STALE
              </div>
            )}
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => { setIsPrintMenuOpen(!isPrintMenuOpen); setIsCSVMenuOpen(false); }}
              className={`h-[30px] px-2.5 rounded-md text-fg-700 text-[12.5px] font-medium inline-flex items-center gap-[5px] transition-colors hover:bg-surf-btn-hover ${
                isPrintMenuOpen ? 'bg-surf-btn-hover' : 'bg-transparent'
              }`}
            >
              <Printer style={{ width: 13, height: 13 }} className="text-fg-500" />
              <span className="hidden sm:inline">Print</span>
              <ChevronDown
                style={{ width: 11, height: 11, transform: isPrintMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                className="text-fg-400"
              />
            </button>
            {isPrintMenuOpen && (
              <div
                className="absolute right-0 top-[calc(100%+6px)] w-[220px] rounded-[10px] border border-border-soft overflow-hidden z-[60]"
                style={{
                  background: 'var(--surf-card)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {[
                  {
                    icon: Printer,
                    label: 'Standard PDF',
                    sub: `MXN · ${isOptimizerMode ? 'Optimizer pricing' : 'ft² pricing'}`,
                    onClick: () => { onPrint(); closeMenus(); },
                  },
                  {
                    icon: DollarSign,
                    label: 'USD Summary PDF',
                    sub: `USD · ${isOptimizerMode ? 'Optimizer pricing' : 'ft² pricing'}`,
                    onClick: () => { onPrintUSD(); closeMenus(); },
                  },
                  { icon: Layers, label: 'Cut-list PDF (English)', sub: 'Breakdown board layouts',       onClick: () => { onPrintCutListEN(); closeMenus(); } },
                  { icon: Layers, label: 'Cut-list PDF (Español)', sub: 'Breakdown board layouts',       onClick: () => { onPrintCutListES(); closeMenus(); } },
                ].map(({ icon: Icon, label, sub, onClick }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    className="w-full px-3.5 py-2.5 flex items-center gap-2.5 bg-transparent border-0 cursor-pointer text-left hover:bg-accent-tint-soft transition-colors"
                  >
                    <div className="w-[30px] h-[30px] rounded-lg bg-surf-muted flex items-center justify-center shrink-0">
                      <Icon style={{ width: 14, height: 14 }} className="text-fg-600" />
                    </div>
                    <div>
                      <div className="text-[12.5px] font-semibold text-fg-800">{label}</div>
                      <div className="text-[11px] text-fg-400 mt-px">{sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => { setIsCSVMenuOpen(!isCSVMenuOpen); setIsPrintMenuOpen(false); }}
              className={`h-[30px] px-2.5 rounded-md text-fg-700 text-[12.5px] font-medium inline-flex items-center gap-[5px] transition-colors hover:bg-surf-btn-hover ${
                isCSVMenuOpen ? 'bg-surf-btn-hover' : 'bg-transparent'
              }`}
            >
              <FileSpreadsheet style={{ width: 13, height: 13 }} className="text-fg-500" />
              <span className="hidden sm:inline">CSV</span>
              <ChevronDown
                style={{ width: 11, height: 11, transform: isCSVMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                className="text-fg-400"
              />
            </button>
            {isCSVMenuOpen && (
              <div
                className="absolute right-0 top-[calc(100%+6px)] w-[220px] rounded-[10px] border border-border-soft overflow-hidden z-[60]"
                style={{
                  background: 'var(--surf-card)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {[
                  { icon: Download, label: 'Areas Summary', sub: 'Export area totals', onClick: () => { onExportCSV(); closeMenus(); } },
                  { icon: FileSpreadsheet, label: 'Detailed Report', sub: 'All items & details', onClick: () => { onExportDetailedCSV(); closeMenus(); } },
                ].map(({ icon: Icon, label, sub, onClick }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    className="w-full px-3.5 py-2.5 flex items-center gap-2.5 bg-transparent border-0 cursor-pointer text-left hover:bg-accent-tint-soft transition-colors"
                  >
                    <div className="w-[30px] h-[30px] rounded-lg bg-surf-muted flex items-center justify-center shrink-0">
                      <Icon style={{ width: 14, height: 14 }} className="text-fg-600" />
                    </div>
                    <div>
                      <div className="text-[12.5px] font-semibold text-fg-800">{label}</div>
                      <div className="text-[11px] text-fg-400 mt-px">{sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onExportJSON}
            className="h-[30px] px-2.5 rounded-md bg-transparent text-fg-700 text-[12.5px] font-medium inline-flex items-center gap-[5px] shrink-0 transition-colors hover:bg-surf-btn-hover"
          >
            <FileJson style={{ width: 13, height: 13 }} className="text-fg-500" />
            <span className="hidden sm:inline">JSON</span>
          </button>

        </div>
      </div>

      <div style={{ height: '44px' }} />
    </>
  );
}
