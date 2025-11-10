import { useState } from 'react';
import { X, Menu, Plus, RefreshCw, TrendingUp, History, Printer, FileSpreadsheet, Save, BarChart3, DollarSign, Download } from 'lucide-react';
import { Button } from './Button';

interface FloatingActionBarProps {
  onAddArea: () => void;
  onChangeMaterials: () => void;
  onRecalculatePrices: () => void;
  onVersionHistory: () => void;
  onPrintMXN: () => void;
  onPrintUSD: () => void;
  onExportAreasSummary: () => void;
  onExportDetailed: () => void;
  onSaveChanges: () => void;
  onToggleAnalytics: () => void;
  showAnalytics: boolean;
  versionCount: number;
  areasEmpty: boolean;
}

export function FloatingActionBar({
  onAddArea,
  onChangeMaterials,
  onRecalculatePrices,
  onVersionHistory,
  onPrintMXN,
  onPrintUSD,
  onExportAreasSummary,
  onExportDetailed,
  onSaveChanges,
  onToggleAnalytics,
  showAnalytics,
  versionCount,
  areasEmpty,
}: FloatingActionBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  return (
    <>
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center group hover:scale-110"
          aria-label="Open actions menu"
        >
          <Menu className="h-6 w-6 transition-transform group-hover:rotate-90" />
        </button>
      )}

      {isExpanded && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsExpanded(false);
              setIsPrintMenuOpen(false);
              setIsExportMenuOpen(false);
            }}
          />

          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 animate-in slide-in-from-bottom-4">
            <div className="bg-white rounded-full shadow-2xl border border-slate-200 px-4 py-3 flex items-center gap-2 max-w-[95vw] overflow-x-auto">
              <button
                onClick={() => setIsExpanded(false)}
                className="flex-shrink-0 h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>

              <div className="h-8 w-px bg-slate-200 flex-shrink-0" />

              <button
                onClick={() => {
                  onAddArea();
                  setIsExpanded(false);
                }}
                className="flex-shrink-0 h-10 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-colors font-medium text-sm"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Area</span>
              </button>

              <button
                onClick={() => {
                  onChangeMaterials();
                  setIsExpanded(false);
                }}
                className="flex-shrink-0 h-10 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 transition-colors font-medium text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Materials</span>
              </button>

              <button
                onClick={() => {
                  onRecalculatePrices();
                  setIsExpanded(false);
                }}
                disabled={areasEmpty}
                className="flex-shrink-0 h-10 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Prices</span>
              </button>

              <button
                onClick={() => {
                  onVersionHistory();
                  setIsExpanded(false);
                }}
                className="flex-shrink-0 h-10 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 transition-colors font-medium text-sm relative"
              >
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
                {versionCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {versionCount}
                  </span>
                )}
              </button>

              <div className="h-8 w-px bg-slate-200 flex-shrink-0" />

              <div className="relative flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPrintMenuOpen(!isPrintMenuOpen);
                  }}
                  disabled={areasEmpty}
                  className="h-10 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                {isPrintMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg shadow-xl bg-white border border-slate-200 z-10">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          onPrintMXN();
                          setIsPrintMenuOpen(false);
                          setIsExpanded(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                      >
                        <Printer className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Standard PDF</div>
                          <div className="text-xs text-slate-500">MXN with all details</div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          onPrintUSD();
                          setIsPrintMenuOpen(false);
                          setIsExpanded(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                      >
                        <DollarSign className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <div>
                          <div className="font-medium">USD Summary PDF</div>
                          <div className="text-xs text-slate-500">Price, tariff, profit & tax by area</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExportMenuOpen(!isExportMenuOpen);
                  }}
                  disabled={areasEmpty}
                  className="h-10 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                {isExportMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg shadow-xl bg-white border border-slate-200 z-10">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          onExportAreasSummary();
                          setIsExportMenuOpen(false);
                          setIsExpanded(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                      >
                        <Download className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Areas Summary</div>
                          <div className="text-xs text-slate-500">Export area totals</div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          onExportDetailed();
                          setIsExportMenuOpen(false);
                          setIsExpanded(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Detailed Report</div>
                          <div className="text-xs text-slate-500">Export all items & details</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-8 w-px bg-slate-200 flex-shrink-0" />

              <button
                onClick={() => {
                  onSaveChanges();
                  setIsExpanded(false);
                }}
                className="flex-shrink-0 h-10 px-4 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 transition-colors font-medium text-sm"
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">Save</span>
              </button>

              <button
                onClick={() => {
                  onToggleAnalytics();
                  setIsExpanded(false);
                }}
                className={`flex-shrink-0 h-10 px-4 rounded-full flex items-center gap-2 transition-colors font-medium text-sm ${
                  showAnalytics
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
