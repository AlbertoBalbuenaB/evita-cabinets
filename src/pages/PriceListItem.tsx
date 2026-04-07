import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil as Edit2, ExternalLink, Tag, Layers, Ruler,
  Grid2x2 as Grid, Hash, Clock, TrendingUp, TrendingDown, Minus, Calendar,
  FileText, ImageOff, Image as ImageIcon, Package, MapPin, Star, Plus,
  Trash2, Save, Box, Wrench, Link2
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/calculations';
import { supabase } from '../lib/supabase';
import { useCurrentMember } from '../lib/useCurrentMember';
import { Button } from '../components/Button';
import { AutocompleteSelect } from '../components/AutocompleteSelect';
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
      <div className="flex-shrink-0 mt-0.5 text-slate-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
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
  const { member } = useCurrentMember();
  const [item, setItem] = useState<PriceListItemType | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PriceChangeEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  // Technical info editable state
  const [techFields, setTechFields] = useState({
    technical_width_mm: '',
    technical_height_mm: '',
    technical_depth_mm: '',
    technical_thickness_mm: '',
    weight: '',
    weight_unit: 'kg',
    technical_material: '',
    technical_finish: '',
  });

  // Inventory editable state
  const [invFields, setInvFields] = useState({
    stock_quantity: '',
    min_stock_level: '',
    stock_location: '',
  });
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [recentMovements, setRecentMovements] = useState<InventoryMovementWithDetails[]>([]);

  // Suppliers state
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<{ value: string; label: string }[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingSupplierRow, setEditingSupplierRow] = useState<SupplierRow | null>(null);
  const [linkForm, setLinkForm] = useState({ supplier_id: '', supplier_sku: '', supplier_price: '', is_primary: false });
  const [linkSaving, setLinkSaving] = useState(false);

  const loadItem = useCallback(async () => {
    if (!id) { navigate('/prices', { replace: true }); return; }
    setLoading(true);
    const { data, error } = await supabase.from('price_list').select('*').eq('id', id).single();
    if (error || !data) { navigate('/prices', { replace: true }); return; }
    setItem(data);
    setLoading(false);

    // Sync editable fields
    setTechFields({
      technical_width_mm: data.technical_width_mm?.toString() ?? '',
      technical_height_mm: data.technical_height_mm?.toString() ?? '',
      technical_depth_mm: data.technical_depth_mm?.toString() ?? '',
      technical_thickness_mm: data.technical_thickness_mm?.toString() ?? '',
      weight: data.weight?.toString() ?? '',
      weight_unit: data.weight_unit ?? 'kg',
      technical_material: data.technical_material ?? '',
      technical_finish: data.technical_finish ?? '',
    });
    setInvFields({
      stock_quantity: data.stock_quantity?.toString() ?? '0',
      min_stock_level: data.min_stock_level?.toString() ?? '0',
      stock_location: data.stock_location ?? '',
    });
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
    setHistory(data || []);
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

  const loadAllSuppliers = useCallback(async () => {
    const { data } = await supabase.from('suppliers').select('id, name').eq('is_active', true).order('name');
    if (data) setAllSuppliers(data.map((s) => ({ value: s.id, label: s.name })));
  }, []);

  useEffect(() => {
    loadItem();
    loadHistory();
    loadMovements();
    loadSuppliers();
    loadAllSuppliers();
  }, [loadItem, loadHistory, loadMovements, loadSuppliers, loadAllSuppliers]);

  async function saveTechField(field: string) {
    if (!item) return;
    const numFields = ['technical_width_mm', 'technical_height_mm', 'technical_depth_mm', 'technical_thickness_mm', 'weight'];
    const raw = techFields[field as keyof typeof techFields];
    const value = numFields.includes(field) ? (raw ? parseFloat(raw) : null) : (raw || null);
    const { error } = await supabase.from('price_list').update({ [field]: value }).eq('id', item.id);
    if (!error) setItem((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  async function saveInvField(field: string) {
    if (!item) return;
    const raw = invFields[field as keyof typeof invFields];
    const value = field === 'stock_location' ? (raw || null) : (parseFloat(raw) || 0);
    const { error } = await supabase.from('price_list').update({ [field]: value }).eq('id', item.id);
    if (!error) setItem((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  async function handleLinkSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !linkForm.supplier_id) return;
    setLinkSaving(true);
    try {
      if (editingSupplierRow) {
        const { error } = await supabase.from('price_list_suppliers').update({
          supplier_sku: linkForm.supplier_sku || null,
          supplier_price: linkForm.supplier_price ? parseFloat(linkForm.supplier_price) : null,
          is_primary: linkForm.is_primary,
        }).eq('id', editingSupplierRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('price_list_suppliers').insert({
          price_list_item_id: id,
          supplier_id: linkForm.supplier_id,
          supplier_sku: linkForm.supplier_sku || null,
          supplier_price: linkForm.supplier_price ? parseFloat(linkForm.supplier_price) : null,
          is_primary: linkForm.is_primary,
        });
        if (error) throw error;
      }
      setShowLinkForm(false);
      setEditingSupplierRow(null);
      setLinkForm({ supplier_id: '', supplier_sku: '', supplier_price: '', is_primary: false });
      loadSuppliers();
    } catch (err: any) {
      alert(err.message || 'Failed to save supplier.');
    } finally {
      setLinkSaving(false);
    }
  }

  async function removeSupplier(supplierId: string) {
    const { error } = await supabase.from('price_list_suppliers').delete().eq('id', supplierId);
    if (!error) loadSuppliers();
  }

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
            className="flex-shrink-0 p-2 rounded-xl bg-white/60 hover:bg-white/80 border border-slate-200/50 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <button onClick={() => navigate('/prices')} className="hover:text-blue-600 transition-colors">
                Inventory
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
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">{item.concept_description}</h2>
        {item.sku_code && <p className="mt-1 text-sm text-slate-400 font-mono">{item.sku_code}</p>}
        <div className="mt-4 flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums">{formatCurrency(item.price)}</div>
            <span className="text-sm text-slate-500">per {item.unit}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
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
              <div className="divide-y divide-slate-200/40">
                {item.material && <DetailRow icon={<Layers className="h-4 w-4" />} label="Material" value={item.material} />}
                {item.dimensions && <DetailRow icon={<Ruler className="h-4 w-4" />} label="Dimensions" value={item.dimensions} />}
                {item.sf_per_sheet != null && <DetailRow icon={<Grid className="h-4 w-4" />} label="Sq Ft / Sheet" value={`${item.sf_per_sheet} sf`} />}
                {item.sku_code && <DetailRow icon={<Hash className="h-4 w-4" />} label="SKU / Code" value={<span className="font-mono text-slate-700">{item.sku_code}</span>} />}
              </div>
            </SectionCard>
          )}

          {/* Section 3: Technical Information */}
          <SectionCard icon={<Wrench className="h-4 w-4" />} title="Technical Information">
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'technical_width_mm', label: 'Width (mm)' },
                { key: 'technical_height_mm', label: 'Height (mm)' },
                { key: 'technical_depth_mm', label: 'Depth (mm)' },
                { key: 'technical_thickness_mm', label: 'Thickness (mm)' },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                  <input
                    type="number"
                    step="any"
                    value={techFields[key]}
                    onChange={(e) => setTechFields((p) => ({ ...p, [key]: e.target.value }))}
                    onBlur={() => saveTechField(key)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
                    placeholder="—"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Weight</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    step="any"
                    value={techFields.weight}
                    onChange={(e) => setTechFields((p) => ({ ...p, weight: e.target.value }))}
                    onBlur={() => saveTechField('weight')}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
                    placeholder="—"
                  />
                  <select
                    value={techFields.weight_unit}
                    onChange={(e) => {
                      setTechFields((p) => ({ ...p, weight_unit: e.target.value }));
                      // save immediately
                      supabase.from('price_list').update({ weight_unit: e.target.value }).eq('id', item.id).then(() => {
                        setItem((prev) => prev ? { ...prev, weight_unit: e.target.value } : prev);
                      });
                    }}
                    className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="lb">lb</option>
                    <option value="oz">oz</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Material</label>
                <input
                  type="text"
                  value={techFields.technical_material}
                  onChange={(e) => setTechFields((p) => ({ ...p, technical_material: e.target.value }))}
                  onBlur={() => saveTechField('technical_material')}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  placeholder="—"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Finish</label>
                <input
                  type="text"
                  value={techFields.technical_finish}
                  onChange={(e) => setTechFields((p) => ({ ...p, technical_finish: e.target.value }))}
                  onBlur={() => saveTechField('technical_finish')}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  placeholder="—"
                />
              </div>
            </div>
          </SectionCard>

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

          {/* Section 4: Pricing / Price History */}
          <SectionCard icon={<Clock className="h-4 w-4" />} title="Price History">
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
                    <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 bg-white/60 rounded-xl border border-slate-200/40 hover:border-slate-300/60 transition-colors">
                      <div className="flex-shrink-0">
                        {increased ? (
                          <div className="p-1.5 rounded-full bg-red-50"><TrendingUp className="h-3.5 w-3.5 text-red-500" /></div>
                        ) : decreased ? (
                          <div className="p-1.5 rounded-full bg-green-50"><TrendingDown className="h-3.5 w-3.5 text-green-500" /></div>
                        ) : (
                          <div className="p-1.5 rounded-full bg-slate-100"><Minus className="h-3.5 w-3.5 text-slate-400" /></div>
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
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Reference Image */}
          {item.image_url && !imgError ? (
            <div className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200/50" style={{ minHeight: '240px' }}>
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
            <div className="flex flex-col items-center justify-center py-16 bg-slate-50/80 border border-slate-200/50 rounded-xl">
              <ImageOff className="h-10 w-10 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No image available</p>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <SectionCard icon={<FileText className="h-4 w-4" />} title="Notes">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.notes}</p>
            </SectionCard>
          )}

          {/* Section 5: Inventory */}
          <SectionCard icon={<Package className="h-4 w-4" />} title="Inventory">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Current Stock</label>
                  <input
                    type="number"
                    step="any"
                    value={invFields.stock_quantity}
                    onChange={(e) => setInvFields((p) => ({ ...p, stock_quantity: e.target.value }))}
                    onBlur={() => saveInvField('stock_quantity')}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                  <p className="mt-0.5 text-xs text-slate-400">Use movements for accurate tracking</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Min Stock Level</label>
                  <input
                    type="number"
                    step="any"
                    value={invFields.min_stock_level}
                    onChange={(e) => setInvFields((p) => ({ ...p, min_stock_level: e.target.value }))}
                    onBlur={() => saveInvField('min_stock_level')}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Location</label>
                <input
                  type="text"
                  value={invFields.stock_location}
                  onChange={(e) => setInvFields((p) => ({ ...p, stock_location: e.target.value }))}
                  onBlur={() => saveInvField('stock_location')}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  placeholder="e.g. Warehouse A, Shelf 3"
                />
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-xs text-slate-400">Weighted Avg. Cost</span>
                  <p className="font-medium text-slate-700">{item.average_cost ? formatCurrency(item.average_cost) : '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Last Purchase Cost</span>
                  <p className="font-medium text-slate-700">{item.last_purchase_cost ? formatCurrency(item.last_purchase_cost) : '—'}</p>
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
                  <p className="text-xs font-medium text-slate-400 mb-2">Recent Movements</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/40">
                          <th className="text-left py-1.5 pr-3 font-medium text-slate-400">Date</th>
                          <th className="text-center py-1.5 px-2 font-medium text-slate-400">Type</th>
                          <th className="text-right py-1.5 px-2 font-medium text-slate-400">Qty</th>
                          <th className="text-left py-1.5 pl-2 font-medium text-slate-400">Done by</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recentMovements.map((m) => (
                          <tr key={m.id}>
                            <td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap">
                              {format(new Date(m.created_at), 'MMM dd, HH:mm')}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${MOVEMENT_TYPE_STYLES[m.movement_type] ?? 'bg-slate-100 text-slate-600'}`}>
                                {m.movement_type}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums text-slate-700">
                              {m.movement_type === 'IN' ? '+' : m.movement_type === 'ADJUSTMENT' ? '~' : '-'}{m.quantity}
                            </td>
                            <td className="py-1.5 pl-2 text-slate-500">{m.created_by_member?.name ?? 'System'}</td>
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
            <div className="space-y-3">
              {suppliers.length === 0 && !showLinkForm && (
                <p className="text-sm text-slate-400 py-2">No suppliers linked yet.</p>
              )}

              {suppliers.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/40">
                        <th className="text-left py-1.5 pr-2 font-medium text-slate-400">Supplier</th>
                        <th className="text-left py-1.5 px-2 font-medium text-slate-400">SKU</th>
                        <th className="text-right py-1.5 px-2 font-medium text-slate-400">Price</th>
                        <th className="text-center py-1.5 px-2 font-medium text-slate-400">Primary</th>
                        <th className="text-center py-1.5 pl-2 font-medium text-slate-400"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {suppliers.map((s) => (
                        <tr key={s.id}>
                          <td className="py-1.5 pr-2 text-slate-700 font-medium">{s.supplier?.name ?? '—'}</td>
                          <td className="py-1.5 px-2 text-slate-500 font-mono">{s.supplier_sku ?? '—'}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-slate-700">
                            {s.supplier_price != null ? formatCurrency(s.supplier_price) : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {s.is_primary && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                <Star className="h-3 w-3" />
                                Primary
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 pl-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingSupplierRow(s);
                                  setLinkForm({
                                    supplier_id: s.supplier_id,
                                    supplier_sku: s.supplier_sku ?? '',
                                    supplier_price: s.supplier_price?.toString() ?? '',
                                    is_primary: s.is_primary,
                                  });
                                  setShowLinkForm(true);
                                }}
                                className="p-1 text-slate-400 hover:text-blue-500 transition-colors rounded"
                                title="Edit"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => removeSupplier(s.id)}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded"
                                title="Remove"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {showLinkForm ? (
                <form onSubmit={handleLinkSupplier} className="space-y-3 p-3 bg-white/60 rounded-lg border border-slate-200/40">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {editingSupplierRow ? 'Edit Supplier' : 'Link Supplier'}
                  </p>
                  {editingSupplierRow ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Supplier</label>
                      <div className="px-3 py-1.5 text-sm bg-slate-100 rounded-lg text-slate-700 font-medium">
                        {editingSupplierRow.supplier?.name ?? '—'}
                      </div>
                    </div>
                  ) : (
                    <AutocompleteSelect
                      label="Supplier"
                      required
                      options={allSuppliers}
                      value={linkForm.supplier_id}
                      onChange={(v) => setLinkForm((p) => ({ ...p, supplier_id: v }))}
                      placeholder="Select supplier..."
                    />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Supplier SKU</label>
                      <input
                        type="text"
                        value={linkForm.supplier_sku}
                        onChange={(e) => setLinkForm((p) => ({ ...p, supplier_sku: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
                        placeholder="SKU"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Purchase Price</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={linkForm.supplier_price}
                        onChange={(e) => setLinkForm((p) => ({ ...p, supplier_price: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={linkForm.is_primary}
                      onChange={(e) => setLinkForm((p) => ({ ...p, is_primary: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-600">Set as Primary Supplier</span>
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={linkSaving}>
                      {linkSaving ? 'Saving...' : editingSupplierRow ? 'Save Changes' : 'Link Supplier'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                      setShowLinkForm(false);
                      setEditingSupplierRow(null);
                      setLinkForm({ supplier_id: '', supplier_sku: '', supplier_price: '', is_primary: false });
                    }}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowLinkForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Link Supplier
                </button>
              )}
            </div>
          </SectionCard>

          {/* Metadata */}
          <SectionCard icon={<Clock className="h-4 w-4" />} title="Metadata">
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
