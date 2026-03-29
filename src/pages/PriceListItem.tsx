import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil as Edit2, ExternalLink, Tag, Layers, Ruler,
  Grid2x2 as Grid, Hash, Clock, TrendingUp, TrendingDown, Minus, Calendar,
  FileText, ImageOff, Image as ImageIcon
} from 'lucide-react';
import { formatCurrency } from '../lib/calculations';
import { supabase } from '../lib/supabase';
import type { PriceListItem as PriceListItemType } from '../types';

interface PriceChangeEntry {
  id: string;
  old_price: number;
  new_price: number;
  price_difference: number;
  changed_at: string;
  changed_by: string | null;
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

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
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

export function PriceListItem() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<PriceListItemType | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PriceChangeEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!id) { navigate('/prices', { replace: true }); return; }

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('price_list')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        navigate('/prices', { replace: true });
        return;
      }
      setItem(data);
      setLoading(false);

      // Load price history
      setHistoryLoading(true);
      const { data: histData } = await supabase
        .from('price_change_log')
        .select('id, old_price, new_price, price_difference, changed_at, changed_by')
        .eq('price_list_item_id', id)
        .order('changed_at', { ascending: false })
        .limit(50);
      setHistory(histData || []);
      setHistoryLoading(false);
    }

    load();
  }, [id, navigate]);

  if (loading || !item) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  const hasSpecs = !!(item.material || item.dimensions || item.sf_per_sheet != null || item.sku_code);

  return (
    <div className="space-y-5">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/prices')}
            className="flex-shrink-0 p-2 rounded-xl bg-white/60 hover:bg-white/80 border border-slate-200/50 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <button onClick={() => navigate('/prices')} className="hover:text-blue-600 transition-colors">
                Price List
              </button>
              <span>/</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-900 truncate">{item.concept_description}</h1>
          </div>
        </div>
        <button
          onClick={() => navigate(`/prices?edit=${item.id}`)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600/90 hover:bg-blue-700 rounded-xl transition-colors shadow-sm flex-shrink-0"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Edit Item
        </button>
      </div>

      {/* Hero header */}
      <div className="rounded-xl px-5 sm:px-7 py-5 sm:py-6" style={{ background: 'linear-gradient(135deg, rgba(219,234,254,0.4), rgba(224,231,255,0.3), rgba(241,245,249,0.35))', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
        <div className="flex items-start justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-600/10 text-blue-800 border border-blue-600/15">
            <Tag className="h-3 w-3" />
            {item.type}
          </span>
          {item.is_active ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200/50">Active</span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200/50">Inactive</span>
          )}
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
          {item.concept_description}
        </h2>
        {item.sku_code && (
          <p className="mt-1 text-sm text-slate-400 font-mono">{item.sku_code}</p>
        )}

        <div className="mt-4 flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(item.price)}
            </div>
            <span className="text-sm text-slate-500">per {item.unit}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs">Updated {formatDate(item.price_last_updated_at)}</span>
          </div>
        </div>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Specifications */}
          {hasSpecs && (
            <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
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
              className="flex items-center gap-3 bg-slate-50/80 border border-slate-200/50 rounded-xl p-5 hover:bg-slate-100/80 transition-colors group"
            >
              <div className="p-2.5 rounded-lg bg-blue-50 text-blue-500 group-hover:bg-blue-100 transition-colors">
                <ExternalLink className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">View Product Page</p>
                <p className="text-xs text-slate-400 truncate">{item.product_url}</p>
              </div>
            </a>
          )}

          {/* Price History */}
          <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5">
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
              <div className="flex flex-col items-center justify-center py-8 bg-white/60 rounded-xl border border-slate-200/40">
                <TrendingUp className="h-7 w-7 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">No price changes recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
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
                          <span className="text-slate-400 line-through text-xs">{formatCurrency(entry.old_price)}</span>
                          <span className="text-slate-400 text-xs">→</span>
                          <span className={`font-semibold ${increased ? 'text-red-600' : decreased ? 'text-green-600' : 'text-slate-700'}`}>
                            {formatCurrency(entry.new_price)}
                          </span>
                          {pct !== null && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                              increased ? 'bg-red-50 text-red-600' : decreased ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                            }`}>{pct}</span>
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

        {/* Right column */}
        <div className="space-y-4">
          {/* Reference Image */}
          {item.image_url && !imgError ? (
            <div className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200/50" style={{ minHeight: '240px' }}>
              <img
                src={item.image_url}
                alt={item.concept_description}
                className="w-full h-full object-cover"
                style={{ minHeight: '240px' }}
                onError={() => setImgError(true)}
              />
              <a
                href={item.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-3 right-3 p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-sm"
                title="Open full image"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" />
                <span className="text-xs font-medium">Reference Image</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-slate-50/80 border border-slate-200/50 rounded-xl">
              <ImageOff className="h-10 w-10 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No image available</p>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</h3>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Metadata</h3>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Added</span>
                <span>{formatDate(item.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Last Updated</span>
                <span>{formatDate(item.updated_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Price Updated</span>
                <span>{formatDate(item.price_last_updated_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status</span>
                <span className={item.is_active ? 'text-green-600' : 'text-red-500'}>{item.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
