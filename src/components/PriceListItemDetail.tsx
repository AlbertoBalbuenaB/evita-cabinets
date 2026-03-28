import { useEffect, useState } from 'react';
import {
  X, Pencil as Edit2, ExternalLink, Tag, Layers, Ruler,
  Grid2x2 as Grid, Hash, Clock, TrendingUp, TrendingDown, Minus, Calendar,
  FileText, ImageOff, Image as ImageIcon
} from 'lucide-react';
import { formatCurrency } from '../lib/calculations';
import { supabase } from '../lib/supabase';
import type { PriceListItem } from '../types';

interface PriceListItemDetailProps {
  item: PriceListItem;
  onClose: () => void;
  onEdit: (item: PriceListItem) => void;
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

interface PriceChangeEntry {
  id: string;
  old_price: number;
  new_price: number;
  price_difference: number;
  changed_at: string;
  changed_by: string | null;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="flex-shrink-0 mt-0.5 text-slate-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function calcChangePercent(oldPrice: number, newPrice: number): string | null {
  if (oldPrice === 0) return null;
  const pct = ((newPrice - oldPrice) / oldPrice) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function PriceListItemDetail({ item, onClose, onEdit }: PriceListItemDetailProps) {
  const [history, setHistory] = useState<PriceChangeEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const { data, error } = await supabase
          .from('price_change_log')
          .select('id, old_price, new_price, price_difference, changed_at, changed_by')
          .eq('price_list_item_id', item.id)
          .order('changed_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setHistory(data || []);
      } catch (err) {
        console.error('Error loading price history:', err);
      } finally {
        setHistoryLoading(false);
      }
    }

    loadHistory();
  }, [item.id]);

  const hasAdditionalDetails = !!(
    item.product_url || item.image_url || item.material || item.dimensions ||
    item.sf_per_sheet != null || item.sku_code || item.notes
  );

  const hasSpecs = !!(item.material || item.dimensions || item.sf_per_sheet != null || item.sku_code);

  return (
    <div className="fixed inset-0 z-50 md:flex md:items-center md:justify-center md:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — bottom sheet on mobile, centered on desktop */}
      <div className="absolute inset-x-0 bottom-0 md:relative md:inset-auto bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-t-2xl md:rounded-2xl max-h-[90vh] md:max-h-[92vh] w-full md:max-w-lg overflow-hidden flex flex-col">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2 pb-0 md:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-300/60" />
        </div>

        {/* Header with gradient accent */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 mx-3 mt-2 md:mx-0 md:mt-0 rounded-xl md:rounded-none md:rounded-t-2xl px-5 sm:px-6 pt-4 pb-4">
          <div className="flex items-start justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 text-white/90 border border-white/10">
              <Tag className="h-3 w-3" />
              {item.type}
            </span>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white/80 hover:text-white transition-colors backdrop-blur-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-white leading-snug pr-8">
            {item.concept_description}
          </h2>
          {item.sku_code && (
            <p className="mt-1 text-sm text-blue-200/80 font-mono">{item.sku_code}</p>
          )}

          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                {formatCurrency(item.price)}
              </div>
              <span className="text-sm text-blue-200/80">per {item.unit}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-blue-200/60" />
              <span className="text-xs text-blue-200/60">
                {formatDate(item.price_last_updated_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">

          {/* Reference Image */}
          {item.image_url && !imgError && (
            <div className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200/50" style={{ height: '180px' }}>
              <img
                src={item.image_url}
                alt={item.concept_description}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
              <a
                href={item.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-2 right-2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-sm"
                title="Open full image"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" />
                <span className="text-xs font-medium">Reference Image</span>
              </div>
            </div>
          )}

          {/* Specifications section */}
          {hasSpecs && (
            <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Ruler className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Specifications</h3>
              </div>
              <div className="divide-y divide-slate-200/40">
                {item.material && (
                  <DetailRow icon={<Layers className="h-4 w-4" />} label="Material" value={item.material} />
                )}
                {item.dimensions && (
                  <DetailRow icon={<Ruler className="h-4 w-4" />} label="Dimensions" value={item.dimensions} />
                )}
                {item.sf_per_sheet != null && (
                  <DetailRow icon={<Grid className="h-4 w-4" />} label="Sq Ft / Sheet" value={`${item.sf_per_sheet} sf`} />
                )}
                {item.sku_code && (
                  <DetailRow icon={<Hash className="h-4 w-4" />} label="SKU / Code" value={<span className="font-mono text-slate-700">{item.sku_code}</span>} />
                )}
              </div>
            </div>
          )}

          {/* Product Link */}
          {item.product_url && (
            <a
              href={item.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-slate-50/80 border border-slate-200/50 rounded-xl p-4 hover:bg-slate-100/80 transition-colors group"
            >
              <div className="p-2 rounded-lg bg-blue-50 text-blue-500 group-hover:bg-blue-100 transition-colors">
                <ExternalLink className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">View Product Page</p>
                <p className="text-xs text-slate-400 truncate">{item.product_url}</p>
              </div>
            </a>
          )}

          {/* Notes */}
          {item.notes && (
            <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</h3>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.notes}</p>
            </div>
          )}

          {/* Empty state */}
          {!hasAdditionalDetails && (
            <div className="flex flex-col items-center justify-center py-6 text-center bg-slate-50/80 border border-slate-200/50 rounded-xl">
              <div className="w-10 h-10 bg-white/80 rounded-full flex items-center justify-center mb-2 border border-slate-200/50">
                <ImageOff className="h-5 w-5 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">No additional details available.</p>
            </div>
          )}

          {/* Price History */}
          <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Price History</h3>
            </div>

            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-white/60 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 bg-white/60 rounded-xl border border-slate-200/40">
                <TrendingUp className="h-7 w-7 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">No price changes recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {history.map((entry) => {
                  const increased = entry.new_price > entry.old_price;
                  const decreased = entry.new_price < entry.old_price;
                  const pct = calcChangePercent(entry.old_price, entry.new_price);

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 px-3 py-2.5 bg-white/60 rounded-xl border border-slate-200/40 hover:border-slate-300/60 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {increased ? (
                          <div className="p-1.5 rounded-full bg-red-50">
                            <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                          </div>
                        ) : decreased ? (
                          <div className="p-1.5 rounded-full bg-green-50">
                            <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-full bg-slate-100">
                            <Minus className="h-3.5 w-3.5 text-slate-400" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-sm flex-wrap">
                          <span className="text-slate-400 line-through text-xs">
                            {formatCurrency(entry.old_price)}
                          </span>
                          <span className="text-slate-400 text-xs">→</span>
                          <span className={`font-semibold ${increased ? 'text-red-600' : decreased ? 'text-green-600' : 'text-slate-700'}`}>
                            {formatCurrency(entry.new_price)}
                          </span>
                          {pct !== null && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                              increased
                                ? 'bg-red-50 text-red-600'
                                : decreased
                                ? 'bg-green-50 text-green-600'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {pct}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(entry.changed_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-center gap-3 text-xs text-slate-400 pt-1 pb-2">
            <span>Added {formatDate(item.created_at)}</span>
            <span className="text-slate-300">·</span>
            <span>Updated {formatDate(item.updated_at)}</span>
          </div>
        </div>

        {/* Footer actions — sticky on mobile */}
        <div className="sticky bottom-0 px-4 sm:px-5 py-4 border-t border-slate-200/40 flex items-center justify-end gap-2.5 bg-white/80 backdrop-blur-lg pb-safe">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white/60 hover:bg-white/80 border border-slate-200/50 rounded-xl transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => onEdit(item)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600/90 hover:bg-blue-700 rounded-xl transition-colors backdrop-blur-sm shadow-sm"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit Item
          </button>
        </div>
      </div>
    </div>
  );
}
