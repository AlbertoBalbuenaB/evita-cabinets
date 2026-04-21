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
        className="fixed top-[288px] lg:top-[192px] right-0 left-0 lg:left-[var(--rail-w)] z-[36] transition-[left,box-shadow] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          boxShadow: scrolled
            ? '0 2px 12px rgba(99,102,241,0.1), 0 1px 0 rgba(0,0,0,0.05)'
            : '0 1px 0 rgba(0,0,0,0.05)',
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.85)',
          borderRadius: 0,
        }}
      >
        <div className="px-4 h-11 flex items-center gap-1">

          <button
            onClick={onSaveChanges}
            style={{
              height: '30px',
              padding: '0 12px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              color: 'white',
              fontSize: '12.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              letterSpacing: '0.01em',
              boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Save style={{ width: 13, height: 13 }} />
            <span>Save</span>
          </button>

          <button
            onClick={onAddArea}
            style={{
              height: '30px',
              padding: '0 12px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              color: 'white',
              fontSize: '12.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              letterSpacing: '0.01em',
              boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Plus style={{ width: 13, height: 13 }} />
            <span className="hidden sm:inline">Add Area</span>
          </button>

          <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.1)', margin: '0 4px', flexShrink: 0 }} />

          <button
            onClick={onAddProduct}
            style={{
              height: '30px',
              padding: '0 10px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.6)',
              color: '#374151',
              fontSize: '12.5px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              border: '1px solid rgba(0,0,0,0.1)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.9)';
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.6)';
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)';
            }}
          >
            <Package style={{ width: 13, height: 13, color: '#6366f1' }} />
            <span className="hidden sm:inline">Create Cabinet</span>
          </button>

          <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.1)', margin: '0 4px', flexShrink: 0 }} />

          {[
            { icon: RefreshCw, label: 'Materials', onClick: onChangeMaterials, color: '#0891b2', disabled: false },
            { icon: TrendingUp, label: 'Prices', onClick: onRecalculatePrices, color: '#7c3aed', disabled: areasEmpty },
          ].map(({ icon: Icon, label, onClick, color, disabled }) => (
            <button
              key={label}
              onClick={onClick}
              disabled={disabled}
              style={{
                height: '30px',
                padding: '0 10px',
                borderRadius: '6px',
                background: 'transparent',
                color: disabled ? '#9ca3af' : '#374151',
                fontSize: '12.5px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                transition: 'background 0.15s',
                opacity: disabled ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon style={{ width: 13, height: 13, color: disabled ? '#9ca3af' : color }} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}

          {hasAreasOrderChanged && onSaveAreasOrder && (
            <button
              onClick={onSaveAreasOrder}
              disabled={savingAreasOrder}
              style={{
                height: '30px',
                padding: '0 10px',
                borderRadius: '6px',
                background: '#f59e0b',
                color: 'white',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <ArrowDownUp style={{ width: 13, height: 13 }} />
              <span className="hidden sm:inline">{savingAreasOrder ? 'Saving...' : 'Save Order'}</span>
            </button>
          )}

          <div style={{ flex: 1 }} />

          <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.1)', margin: '0 4px', flexShrink: 0 }} />

          {/*
            Global Pricing Method switch — flips FT² ↔ Optimizer for the whole
            Quotation section: Info/Pricing/Analytics tabs, Header Card total,
            per-area Material Breakdown, AND the PDF exports. Default is FT²;
            once the first optimizer run is saved, the method auto-switches to
            Optimizer (one-shot — further manual toggles are respected).
          */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <PricingMethodToggle
              value={pricingMethod}
              onChange={(next) => onPricingMethodChange?.(next)}
              canSelectOptimizer={canSelectOptimizer}
              size="sm"
            />
            {isOptimizerMode && optimizerStale && (
              <div
                title="The active optimizer run is stale because cabinets changed after it was saved. Values shown are from the last run. Re-optimize in the Breakdown tab to refresh."
                style={{
                  height: 22,
                  padding: '0 8px',
                  borderRadius: 11,
                  background: 'rgba(245,158,11,0.12)',
                  color: '#b45309',
                  border: '1px solid rgba(245,158,11,0.35)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'help',
                  userSelect: 'none',
                }}
              >
                <AlertTriangle style={{ width: 10, height: 10 }} />
                STALE
              </div>
            )}
          </div>

          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => { setIsPrintMenuOpen(!isPrintMenuOpen); setIsCSVMenuOpen(false); }}
              style={{
                height: '30px',
                padding: '0 10px',
                borderRadius: '6px',
                background: isPrintMenuOpen ? 'rgba(255,255,255,0.8)' : 'transparent',
                color: '#374151',
                fontSize: '12.5px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; }}
              onMouseLeave={e => { if (!isPrintMenuOpen) e.currentTarget.style.background = 'transparent'; }}
            >
              <Printer style={{ width: 13, height: 13, color: '#64748b' }} />
              <span className="hidden sm:inline">Print</span>
              <ChevronDown style={{ width: 11, height: 11, color: '#94a3b8', transform: isPrintMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
            {isPrintMenuOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: 220,
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 8px 24px rgba(99,102,241,0.1), 0 2px 8px rgba(0,0,0,0.08)',
                zIndex: 60,
                overflow: 'hidden',
              }}>
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
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 14, height: 14, color: '#475569' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => { setIsCSVMenuOpen(!isCSVMenuOpen); setIsPrintMenuOpen(false); }}
              style={{
                height: '30px',
                padding: '0 10px',
                borderRadius: '6px',
                background: isCSVMenuOpen ? 'rgba(255,255,255,0.8)' : 'transparent',
                color: '#374151',
                fontSize: '12.5px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; }}
              onMouseLeave={e => { if (!isCSVMenuOpen) e.currentTarget.style.background = 'transparent'; }}
            >
              <FileSpreadsheet style={{ width: 13, height: 13, color: '#64748b' }} />
              <span className="hidden sm:inline">CSV</span>
              <ChevronDown style={{ width: 11, height: 11, color: '#94a3b8', transform: isCSVMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
            {isCSVMenuOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: 220,
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 8px 24px rgba(99,102,241,0.1), 0 2px 8px rgba(0,0,0,0.08)',
                zIndex: 60,
                overflow: 'hidden',
              }}>
                {[
                  { icon: Download, label: 'Areas Summary', sub: 'Export area totals', onClick: () => { onExportCSV(); closeMenus(); } },
                  { icon: FileSpreadsheet, label: 'Detailed Report', sub: 'All items & details', onClick: () => { onExportDetailedCSV(); closeMenus(); } },
                ].map(({ icon: Icon, label, sub, onClick }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 14, height: 14, color: '#475569' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onExportJSON}
            style={{
              height: '30px',
              padding: '0 10px',
              borderRadius: '6px',
              background: 'transparent',
              color: '#374151',
              fontSize: '12.5px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <FileJson style={{ width: 13, height: 13, color: '#64748b' }} />
            <span className="hidden sm:inline">JSON</span>
          </button>

        </div>
      </div>

      <div style={{ height: '44px' }} />
    </>
  );
}
