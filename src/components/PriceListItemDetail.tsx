import { useEffect, useState } from 'react';
import {
  X, Pencil as Edit2, ExternalLink, Tag, Layers, Ruler, Package, DollarSign,
  Grid2x2 as Grid, Hash, Link, Clock, TrendingUp, TrendingDown, Minus, Calendar,
  FileText, ImageOff, Image as ImageIcon
} from 'lucide-react';
import { formatCurrency } from '../lib/calculations';
import { Button } from './Button';
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
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-5 pb-4">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Price List Item</p>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <h2 className="text-xl font-bold text-white leading-snug pr-4">
            {item.concept_description}
          </h2>
          {item.sku_code && (
            <p className="mt-1 text-sm text-slate-400 font-mono">{item.sku_code}</p>
          )}

          <div className="mt-4 flex items-end justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-slate-200 border border-white/10">
              <Tag className="h-3 w-3" />
              {item.type}
            </span>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {formatCurrency(item.price)}
                <span className="text-sm font-normal text-slate-400 ml-1">/ {item.unit}</span>
              </div>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <Calendar className="h-3 w-3 text-slate-500" />
                <span className="text-xs text-slate-500">
                  Updated {formatDate(item.price_last_updated_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {item.image_url && !imgError && (
          <div className="relative bg-slate-100 border-b border-slate-200" style={{ height: '180px' }}>
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
              className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-sm"
              title="Open full image"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/40 text-white backdrop-blur-sm flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              <span className="text-xs">Reference Image</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {item.material && (
            <DetailRow
              icon={<Layers className="h-4 w-4" />}
              label="Material"
              value={item.material}
            />
          )}

          {item.dimensions && (
            <DetailRow
              icon={<Ruler className="h-4 w-4" />}
              label="Dimensions"
              value={item.dimensions}
            />
          )}

          <DetailRow
            icon={<Package className="h-4 w-4" />}
            label="Unit"
            value={item.unit}
          />

          <DetailRow
            icon={<DollarSign className="h-4 w-4" />}
            label="Price"
            value={<span className="font-semibold text-slate-900">{formatCurrency(item.price)}</span>}
          />

          {item.sf_per_sheet != null && (
            <DetailRow
              icon={<Grid className="h-4 w-4" />}
              label="Square Feet per Sheet"
              value={`${item.sf_per_sheet} sf`}
            />
          )}

          {item.sku_code && (
            <DetailRow
              icon={<Hash className="h-4 w-4" />}
              label="SKU / Code"
              value={<span className="font-mono text-slate-700">{item.sku_code}</span>}
            />
          )}

          {item.product_url && (
            <DetailRow
              icon={<Link className="h-4 w-4" />}
              label="Product Link"
              value={
                <a
                  href={item.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline transition-colors break-all"
                >
                  <span className="truncate max-w-xs">{item.product_url}</span>
                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                </a>
              }
            />
          )}

          {item.notes && (
            <DetailRow
              icon={<FileText className="h-4 w-4" />}
              label="Notes / Observations"
              value={<span className="whitespace-pre-wrap leading-relaxed">{item.notes}</span>}
            />
          )}

          {!hasAdditionalDetails && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                <ImageOff className="h-5 w-5 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">No additional details available.</p>
            </div>
          )}

          <div className="mt-4 mb-2">
            <div className="flex items-center gap-2 mb-3 pt-2 border-t border-slate-100">
              <Clock className="h-4 w-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Price History</h3>
            </div>

            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-xl border border-slate-100">
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
                      className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
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
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-white">
          {item.product_url ? (
            <a
              href={item.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Visit Product Page
            </a>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" onClick={() => onEdit(item)}>
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />
              Edit Item
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
