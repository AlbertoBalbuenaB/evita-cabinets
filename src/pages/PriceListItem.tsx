import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil as Edit2, ExternalLink, Tag, Layers, Ruler,
  Grid2x2 as Grid, Hash, Clock, TrendingUp, TrendingDown, Minus, Calendar,
  FileText, ImageOff, Image as ImageIcon, Package, MapPin, Star, Plus,
  Wrench, Link2
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/calculations';
import { supabase } from '../lib/supabase';
import { InventoryMovementModal } from '../components/inventory/InventoryMovementModal';
import { StockBadge } from '../components/inventory/StockBadge';
import type {
  PriceListItem as PriceListItemType,
  PriceListSupplier,
  Supplier,
  InventoryMovementWithDetails,
} from '../types';

interface PriceChangeEntry {
  id: string;
  old_price: number;
  new_price: number;
  price_difference: number;
  changed_at: string;
  changed_by: string | null;
}

type SupplierRow = PriceListSupplier & { supplier: Supplier };

function formatDate(iso: string | null) {
  if (!iso) return '—';
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
      <div className="flex-shrink-0 mt-0.5 text-fg-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-fg-400 uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm text-fg-800">{value}</div>
      </div>
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surf-app border border-border-soft rounded-xl p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-fg-400">{icon}</span>
        <h3 className="text-xs font-semibold text-fg-500 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const MOVEMENT_TYPE_STYLES: Record<string, string> = {
  IN: 'bg-green-100 text-green-700',
  OUT: 'bg-red-100 text-red-700',
  ADJUSTMENT: 'bg-blue-100 text-blue-700',
  RETURN: 'bg-orange-100 text-orange-700',
};

export function PriceListItem() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<PriceListItemType | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PriceChangeEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [recentMovements, setRecentMovements] = useState<InventoryMovementWithDetails[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);

  const loadItem = useCallback(async () => {
    if (!id) { navigate('/prices', { replace: true }); return; }
    setLoading(true);
    const { data, error } = await supabase.from('price_list').select('*').eq('id', id).single();
    if (error || !data) { navigate('/prices', { replace: true }); return; }
    setItem(data);
    setLoading(false);
  }, [id, navigate]);

  const loadHistory = useCallback(async () => {
    if (!id) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from('price_change_log')
      .select('id, old_price, new_price, price_difference, changed_at, changed_by')
      .eq('price_list_item_id', id)
      .order('changed_at', { ascending: false })
      .limit(50);
    setHistory((data || []) as any);
    setHistoryLoading(false);
  }, [id]);

  const loadMovements = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('inventory_movements')
      .select('*, created_by_member:team_members(name)')
      .eq('price_list_item_id', id)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentMovements((data as InventoryMovementWithDetails[]) || []);
  }, [id]);

  const loadSuppliers = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('price_list_suppliers')
      .select('*, supplier:suppliers(*)')
      .eq('price_list_item_id', id)
      .order('is_primary', { ascending: false });
    setSuppliers((data as SupplierRow[]) || []);
  }, [id]);

  useEffect(() => {
    loadItem();
    loadHistory();
    loadMovements();
    loadSuppliers();
  }, [loadItem, loadHistory, loadMovements, loadSuppliers]);

  if (loading || !item) {
    return (
      <div className="space-y-5 page-enter">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 skeleton-shimmer" />
          <div className="space-y-1">
            <div className="h-3 w-20 skeleton-shimmer" />
            <div className="h-5 w-48 skeleton-shimmer" />
          </div>
        </div>
        <div className="h-44 skeleton-shimmer" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="h-40 skeleton-shimmer" />
            <div className="h-48 skeleton-shimmer" />
          </div>
          <div className="h-64 skeleton-shimmer" />
        </div>
      </div>
    );
  }

  const hasSpecs = !!(item.material || item.dimensions || item.sf_per_sheet != null || item.sku_code);

  return (
    <div className="space-y-5 page-enter">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-4 hero-enter">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/prices')}
            className="flex-shrink-0 p-2 rounded-xl bg-surf-card hover:bg-surf-card border border-border-soft text-fg-600 hover:text-fg-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-fg-400">
              <button onClick={() => navigate('/prices')} className="hover:text-blue-600 transition-colors">
                Inventory
              </button>
              <span>/</span>
            </div>
            <h1 className="text-lg font-semibold text-fg-900 truncate">{item.concept_description}</h1>
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

      {/* Section 1: General Info — Hero header */}
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
        <h2 className="text-xl sm:text-2xl font-bold text-fg-900 leading-snug">{item.concept_description}</h2>
        {item.sku_code && <p className="mt-1 text-sm text-fg-400 font-mono">{item.sku_code}</p>}
        <div className="mt-4 flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-3xl sm:text-4xl font-bold text-fg-900 tabular-nums">{formatCurrency(item.price)}</div>
            <span className="text-sm text-fg-500">per {item.unit}</span>
          </div>
          <div className="flex items-center gap-1.5 text-fg-400">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs">Updated {formatDate(item.price_last_updated_at)}</span>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 section-enter" style={{ animationDelay: '0.1s' }}>
        {/* Left column */}
        <div className="space-y-4">
          {/* Section 2: General Dimensions */}
          {hasSpecs && (
            <SectionCard icon={<Ruler className="h-4 w-4" />} title="General Dimensions">
              <div className="divide-y divide-border-soft">
                {item.material && <DetailRow icon={<Layers className="h-4 w-4" />} label="Material" value={item.material} />}
                {item.dimensions && <DetailRow icon={<Ruler className="h-4 w-4" />} label="Dimensions" value={item.dimensions} />}
                {item.sf_per_sheet != null && <DetailRow icon={<Grid className="h-4 w-4" />} label="Sq Ft / Sheet" value={`${item.sf_per_sheet} sf`} />}
                {item.sku_code && <DetailRow icon={<Hash className="h-4 w-4" />} label="SKU / Code" value={<span className="font-mono text-fg-700">{item.sku_code}</span>} />}
              </div>
            </SectionCard>
          )}

          {/* Section 3: Technical Information */}
          <SectionCard icon={<Wrench className="h-4 w-4" />} title="Technical Information">
            {!item.technical_width_mm && !item.technical_height_mm && !item.technical_depth_mm &&
             !item.technical_thickness_mm && !item.weight && !item.technical_material && !item.technical_finish ? (
              <p className="text-sm text-fg-400 py-2">No technical specifications added yet.</p>
            ) : (
              <div className="divide-y divide-border-soft">
                {item.technical_width_mm != null && <DetailRow icon={<Ruler className="h-4 w-4" />} label="Width" value={`${item.technical_width_mm} mm`} />}
                {item.technical_height_mm != null && <DetailRow icon={<Ruler className="h-4 w-4" />} label="Height" value={`${item.technical_height_mm} mm`} />}
                {item.technical_depth_mm != null && <DetailRow icon={<Ruler className="h-4 w-4" />} label="Depth" value={`${item.technical_depth_mm} mm`} />}
                {item.technical_thickness_mm != null && <DetailRow icon={<Ruler className="h-4 w-4" />} label="Thickness" value={`${item.technical_thickness_mm} mm`} />}
                {item.weight != null && <DetailRow icon={<Package className="h-4 w-4" />} label="Weight" value={`${item.weight} ${item.weight_unit ?? 'kg'}`} />}
                {item.technical_material && <DetailRow icon={<Layers className="h-4 w-4" />} label="Material" value={item.technical_material} />}
                {item.technical_finish && <DetailRow icon={<Wrench className="h-4 w-4" />} label="Finish" value={item.technical_finish} />}
              </div>
            )}
          </SectionCard>

          {/* Product Link */}
          {item.product_url && (
            <a
              href={item.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-surf-app border border-border-soft rounded-xl p-5 hover:bg-surf-muted transition-colors group"
            >
              <div className="p-2.5 rounded-lg bg-blue-50 text-blue-500 group-hover:bg-blue-100 transition-colors">
                <ExternalLink className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-fg-700">View Product Page</p>
                <p className="text-xs text-fg-400 truncate">{item.product_url}</p>
              </div>
            </a>
          )}

          {/* Section 4: Pricing / Price History */}
          <SectionCard icon={<Clock className="h-4 w-4" />} title="Price History">
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-surf-card rounded-xl animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 bg-surf-card rounded-xl border border-border-soft">
                <TrendingUp className="h-7 w-7 text-fg-300 mb-2" />
                <p className="text-sm text-fg-400">No price changes recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {history.map((entry) => {
                  const increased = entry.new_price > entry.old_price;
                  const decreased = entry.new_price < entry.old_price;
                  const pct = calcChangePercent(entry.old_price, entry.new_price);
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 bg-surf-card rounded-xl border border-border-soft hover:border-border-solid transition-colors">
                      <div className="flex-shrink-0">
                        {increased ? (
                          <div className="p-1.5 rounded-full bg-red-50"><TrendingUp className="h-3.5 w-3.5 text-red-500" /></div>
                        ) : decreased ? (
                          <div className="p-1.5 rounded-full bg-green-50"><TrendingDown className="h-3.5 w-3.5 text-green-500" /></div>
                        ) : (
                          <div className="p-1.5 rounded-full bg-surf-muted"><Minus className="h-3.5 w-3.5 text-fg-400" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-sm flex-wrap">
                          <span className="text-fg-400 line-through text-xs">{formatCurrency(entry.old_price)}</span>
                          <span className="text-fg-400 text-xs">→</span>
                          <span className={`font-semibold ${increased ? 'text-red-600' : decreased ? 'text-green-600' : 'text-fg-700'}`}>
                            {formatCurrency(entry.new_price)}
                          </span>
                          {pct !== null && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                              increased ? 'bg-red-50 text-red-600' : decreased ? 'bg-green-50 text-green-600' : 'bg-surf-muted text-fg-500'
                            }`}>{pct}</span>
                          )}
                        </div>
                        <p className="text-xs text-fg-400 mt-0.5">{formatDate(entry.changed_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Reference Image */}
          {item.image_url && !imgError ? (
            <div className="relative rounded-xl overflow-hidden bg-surf-muted border border-border-soft" style={{ minHeight: '240px' }}>
              <img src={item.image_url} alt={item.concept_description} className="w-full h-full object-cover" style={{ minHeight: '240px' }} onError={() => setImgError(true)} />
              <a href={item.image_url} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 right-3 p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-sm" title="Open full image">
                <ExternalLink className="h-4 w-4" />
              </a>
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" />
                <span className="text-xs font-medium">Reference Image</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-surf-app border border-border-soft rounded-xl">
              <ImageOff className="h-10 w-10 text-fg-400 mb-2" />
              <p className="text-sm text-fg-400">No image available</p>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <SectionCard icon={<FileText className="h-4 w-4" />} title="Notes">
              <p className="text-sm text-fg-700 whitespace-pre-wrap leading-relaxed">{item.notes}</p>
            </SectionCard>
          )}

          {/* Section 5: Inventory */}
          <SectionCard icon={<Package className="h-4 w-4" />} title="Inventory">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-fg-400 mb-1">Current Stock</p>
                  <p className="text-sm font-semibold text-fg-800">{item.stock_quantity ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-fg-400 mb-1">Min Stock Level</p>
                  <p className="text-sm text-fg-700">{item.min_stock_level ?? 0}</p>
                </div>
              </div>
              {item.stock_location && (
                <div>
                  <p className="text-xs font-medium text-fg-400 mb-1">Location</p>
                  <p className="text-sm text-fg-700 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-fg-400 flex-shrink-0" />
                    {item.stock_location}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-xs text-fg-400">Weighted Avg. Cost</span>
                  <p className="font-medium text-fg-700">{item.average_cost ? formatCurrency(item.average_cost) : '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-fg-400">Last Purchase Cost</span>
                  <p className="font-medium text-fg-700">{item.last_purchase_cost ? formatCurrency(item.last_purchase_cost) : '—'}</p>
                </div>
                <div className="ml-auto">
                  <StockBadge stock_quantity={item.stock_quantity} min_stock_level={item.min_stock_level} />
                </div>
              </div>

              <button
                onClick={() => setShowMovementModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Record Movement
              </button>

              {/* Recent movements mini table */}
              {recentMovements.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-fg-400 mb-2">Recent Movements</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border-soft">
                          <th className="text-left py-1.5 pr-3 font-medium text-fg-400">Date</th>
                          <th className="text-center py-1.5 px-2 font-medium text-fg-400">Type</th>
                          <th className="text-right py-1.5 px-2 font-medium text-fg-400">Qty</th>
                          <th className="text-left py-1.5 pl-2 font-medium text-fg-400">Done by</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recentMovements.map((m) => (
                          <tr key={m.id}>
                            <td className="py-1.5 pr-3 text-fg-500 whitespace-nowrap">
                              {format(new Date(m.created_at), 'MMM dd, HH:mm')}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${MOVEMENT_TYPE_STYLES[m.movement_type] ?? 'bg-surf-muted text-fg-600'}`}>
                                {m.movement_type}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums text-fg-700">
                              {m.movement_type === 'IN' ? '+' : m.movement_type === 'ADJUSTMENT' ? '~' : '-'}{m.quantity}
                            </td>
                            <td className="py-1.5 pl-2 text-fg-500">{m.created_by_member?.name ?? 'System'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Section 6: Suppliers */}
          <SectionCard icon={<Link2 className="h-4 w-4" />} title="Suppliers">
            {suppliers.length === 0 ? (
              <p className="text-sm text-fg-400 py-2">No suppliers linked.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-soft">
                      <th className="text-left py-1.5 pr-2 font-medium text-fg-400">Supplier</th>
                      <th className="text-left py-1.5 px-2 font-medium text-fg-400">SKU</th>
                      <th className="text-right py-1.5 px-2 font-medium text-fg-400">Price</th>
                      <th className="text-center py-1.5 pl-2 font-medium text-fg-400">Primary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {suppliers.map((s) => (
                      <tr key={s.id}>
                        <td className="py-1.5 pr-2 text-fg-700 font-medium">{s.supplier?.name ?? '—'}</td>
                        <td className="py-1.5 px-2 text-fg-500 font-mono">{s.supplier_sku ?? '—'}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-fg-700">
                          {s.supplier_price != null ? formatCurrency(s.supplier_price) : '—'}
                        </td>
                        <td className="py-1.5 pl-2 text-center">
                          {s.is_primary && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              <Star className="h-3 w-3" />
                              Primary
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Metadata */}
          <SectionCard icon={<Clock className="h-4 w-4" />} title="Metadata">
            <div className="space-y-2 text-sm text-fg-600">
              <div className="flex items-center justify-between">
                <span className="text-fg-400">Added</span>
                <span>{formatDate(item.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg-400">Last Updated</span>
                <span>{formatDate(item.updated_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg-400">Price Updated</span>
                <span>{formatDate(item.price_last_updated_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg-400">Status</span>
                <span className={item.is_active ? 'text-green-600' : 'text-red-500'}>{item.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Movement modal */}
      {showMovementModal && (
        <InventoryMovementModal
          priceListItemId={item.id}
          priceListItemName={item.concept_description}
          onClose={() => setShowMovementModal(false)}
          onSaved={() => {
            setShowMovementModal(false);
            loadItem();
            loadMovements();
          }}
        />
      )}
    </div>
  );
}
