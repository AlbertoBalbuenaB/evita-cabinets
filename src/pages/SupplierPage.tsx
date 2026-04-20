import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Pencil as Edit2, Phone, Mail, Globe, MapPin,
  Star, Package, Clock, Tag, ToggleLeft, ToggleRight,
  ExternalLink, DollarSign, Truck, FileText, ShieldCheck,
  User, Link2
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/calculations';
import { SupplierFormModal } from '../components/SupplierFormModal';
import { SupplierLogSection } from '../components/SupplierLogSection';
import { useCurrentMember } from '../lib/useCurrentMember';
import { usePageChrome } from '../contexts/PageChromeContext';
import type { Supplier, PriceListItem, PriceListSupplier } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type HealthScore = 'green' | 'yellow' | 'red' | 'none';

function computeHealth(supplier: Supplier): HealthScore {
  const q = supplier.quality_score;
  const p = supplier.punctuality;
  if (q == null && p == null) return 'none';
  const goodPunctuality = p === 'Alta' || p === 'Media';
  const badPunctuality = p === 'Baja';
  if ((q != null && q >= 4) && (p == null || goodPunctuality)) return 'green';
  if ((q != null && q <= 2) || badPunctuality) return 'red';
  return 'yellow';
}

const HEALTH_STYLES: Record<HealthScore, { label: string; className: string }> = {
  green:  { label: 'Good',    className: 'bg-green-100 text-green-700 border border-green-200' },
  yellow: { label: 'Average', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  red:    { label: 'Poor',    className: 'bg-red-100 text-red-700 border border-red-200' },
  none:   { label: '',        className: '' },
};

const PUNCTUALITY_STYLES: Record<string, string> = {
  Alta:  'bg-green-100 text-green-700',
  Media: 'bg-amber-100 text-amber-700',
  Baja:  'bg-red-100 text-red-700',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-200/40 last:border-0">
      {icon && <div className="flex-shrink-0 mt-0.5 text-slate-400">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function StarRating({ score }: { score: number | null }) {
  if (score == null) return <span className="text-sm text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= score ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`}
        />
      ))}
      <span className="ml-1.5 text-sm text-slate-600">{score}/5</span>
    </div>
  );
}

// ── Types for product rows ────────────────────────────────────────────────────

type ProductRow = PriceListSupplier & { price_list_item: PriceListItem | null };

// ── Main page ─────────────────────────────────────────────────────────────────

export function SupplierPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as { from?: string } | null)?.from ?? '/suppliers';
  const { member } = useCurrentMember();
  const isAdmin = member?.role === 'admin';

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [itemCount, setItemCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  usePageChrome(
    {
      title: supplier?.name ?? 'Supplier',
      crumbs: [
        { label: 'Suppliers', to: '/suppliers' },
        { label: supplier?.name ?? '…' },
      ],
    },
    [supplier?.id, supplier?.name],
  );

  const loadSupplier = useCallback(async () => {
    if (!id) { navigate(backTo, { replace: true }); return; }
    setLoading(true);
    const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).single();
    if (error || !data) { navigate(backTo, { replace: true }); return; }
    setSupplier(data);
    setLoading(false);
  }, [id, navigate, backTo]);

  const loadProducts = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('price_list_suppliers')
      .select('*, price_list_item:price_list(*)')
      .eq('supplier_id', id)
      .order('is_primary', { ascending: false });
    const rows = (data ?? []) as ProductRow[];
    setProducts(rows);
    setItemCount(rows.length);
  }, [id]);

  useEffect(() => {
    loadSupplier();
    loadProducts();
  }, [loadSupplier, loadProducts]);

  async function handleToggleActive() {
    if (!supplier) return;
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active: !supplier.is_active })
        .eq('id', supplier.id);
      if (error) throw error;
      loadSupplier();
    } catch (err) {
      console.error('Error toggling supplier status:', err);
    }
  }

  if (loading || !supplier) {
    return (
      <div className="space-y-5 page-enter">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 skeleton-shimmer rounded-xl" />
          <div className="space-y-1">
            <div className="h-3 w-20 skeleton-shimmer" />
            <div className="h-5 w-48 skeleton-shimmer" />
          </div>
        </div>
        <div className="h-40 skeleton-shimmer rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="h-40 skeleton-shimmer rounded-xl" />
            <div className="h-40 skeleton-shimmer rounded-xl" />
          </div>
          <div className="space-y-4">
            <div className="h-64 skeleton-shimmer rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const health = computeHealth(supplier);
  const healthStyle = HEALTH_STYLES[health];
  const categories: string[] = supplier.categories ?? [];
  const mapsUrl = supplier.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supplier.address)}`
    : null;

  return (
    <div className="space-y-5 page-enter">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-4 hero-enter">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(backTo)}
            className="flex-shrink-0 p-2 rounded-xl bg-white/60 hover:bg-white/80 border border-slate-200/50 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <button onClick={() => navigate(backTo)} className="hover:text-blue-600 transition-colors">
                {backTo.startsWith('/prices') ? 'Inventory / Suppliers' : 'Suppliers'}
              </button>
              <span>/</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-900 truncate">{supplier.name}</h1>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleToggleActive}
              className={`p-2 rounded-xl border transition-colors ${
                supplier.is_active
                  ? 'bg-white/60 hover:bg-amber-50 border-slate-200/50 text-slate-400 hover:text-amber-600 hover:border-amber-200'
                  : 'bg-white/60 hover:bg-green-50 border-slate-200/50 text-slate-400 hover:text-green-600 hover:border-green-200'
              }`}
              title={supplier.is_active ? 'Deactivate supplier' : 'Activate supplier'}
            >
              {supplier.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600/90 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Hero header */}
      <div
        className="rounded-xl px-5 sm:px-7 py-5 sm:py-6"
        style={{
          background: 'linear-gradient(135deg, rgba(219,234,254,0.4), rgba(224,231,255,0.3), rgba(241,245,249,0.35))',
          borderBottom: '1px solid rgba(148,163,184,0.2)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status badge */}
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                supplier.is_active
                  ? 'bg-green-50 text-green-700 border-green-200/50'
                  : 'bg-red-50 text-red-600 border-red-200/50'
              }`}
            >
              {supplier.is_active ? 'Active' : 'Inactive'}
            </span>

            {/* Health score */}
            {health !== 'none' && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${healthStyle.className}`}>
                {healthStyle.label}
              </span>
            )}
          </div>

          {/* Item count */}
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Package className="h-4 w-4 text-slate-400" />
            <span>{itemCount} linked item{itemCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Supplier name + logo */}
        <div className="flex items-center gap-4">
          {supplier.logo_url && (
            <div className="h-14 w-14 rounded-xl border border-slate-200/70 bg-white flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
              <img
                src={supplier.logo_url}
                alt={`${supplier.name} logo`}
                className="w-full h-full object-contain p-1"
                onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
              />
            </div>
          )}
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{supplier.name}</h2>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50/80 text-blue-700 border border-blue-100"
              >
                <Tag className="h-3 w-3" />
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Added {formatDate(supplier.created_at)}
          </span>
          {supplier.updated_at && (
            <span>Updated {format(new Date(supplier.updated_at), 'd MMM yyyy')}</span>
          )}
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 section-enter" style={{ animationDelay: '0.1s' }}>
        {/* ── Left column ── */}
        <div className="space-y-4">
          {/* 1. Contact Information */}
          <SectionCard icon={<User className="h-4 w-4" />} title="Contact Information">
            {!supplier.contact_name && !supplier.phone && !supplier.email && !supplier.website && !supplier.address ? (
              <p className="text-sm text-slate-400 py-1">No contact information added yet.</p>
            ) : (
              <div className="divide-y divide-slate-200/40">
                {supplier.contact_name && (
                  <DetailRow icon={<User className="h-4 w-4" />} label="Contact" value={supplier.contact_name} />
                )}
                {supplier.phone && (
                  <DetailRow
                    icon={<Phone className="h-4 w-4" />}
                    label="Phone"
                    value={
                      <a href={`tel:${supplier.phone}`} className="text-blue-600 hover:text-blue-700 hover:underline">
                        {supplier.phone}
                      </a>
                    }
                  />
                )}
                {supplier.email && (
                  <DetailRow
                    icon={<Mail className="h-4 w-4" />}
                    label="Email"
                    value={
                      <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:text-blue-700 hover:underline">
                        {supplier.email}
                      </a>
                    }
                  />
                )}
                {supplier.website && (
                  <DetailRow
                    icon={<Globe className="h-4 w-4" />}
                    label="Website"
                    value={
                      <a
                        href={supplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                      >
                        {supplier.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    }
                  />
                )}
                {supplier.address && (
                  <DetailRow
                    icon={<MapPin className="h-4 w-4" />}
                    label="Address"
                    value={
                      mapsUrl ? (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 hover:underline flex items-start gap-1"
                        >
                          <span className="whitespace-pre-wrap">{supplier.address}</span>
                          <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="whitespace-pre-wrap">{supplier.address}</span>
                      )
                    }
                  />
                )}
              </div>
            )}
          </SectionCard>

          {/* 2. Supplier Evaluation */}
          <SectionCard icon={<ShieldCheck className="h-4 w-4" />} title="Supplier Evaluation">
            {supplier.quality_score == null && supplier.punctuality == null && !supplier.last_evaluation_date ? (
              <div className="text-center py-4">
                <p className="text-sm text-slate-400">No evaluation data yet.</p>
                {isAdmin && (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    Edit supplier to add evaluation
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-200/40">
                <DetailRow
                  icon={<Star className="h-4 w-4" />}
                  label="Quality Score"
                  value={<StarRating score={supplier.quality_score} />}
                />
                <DetailRow
                  icon={<Truck className="h-4 w-4" />}
                  label="Punctuality"
                  value={
                    supplier.punctuality ? (
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${PUNCTUALITY_STYLES[supplier.punctuality] ?? 'bg-slate-100 text-slate-600'}`}>
                        {supplier.punctuality}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )
                  }
                />
                <DetailRow
                  icon={<Clock className="h-4 w-4" />}
                  label="Last Evaluation"
                  value={formatDate(supplier.last_evaluation_date)}
                />
              </div>
            )}
          </SectionCard>

          {/* 3. Commercial Terms */}
          <SectionCard icon={<DollarSign className="h-4 w-4" />} title="Commercial Terms">
            {!supplier.payment_terms && supplier.lead_time_days == null && !supplier.delivery_terms && !supplier.special_discounts && supplier.min_purchase_amount == null ? (
              <p className="text-sm text-slate-400 py-1">No commercial terms added yet.</p>
            ) : (
              <div className="divide-y divide-slate-200/40">
                {supplier.payment_terms && (
                  <DetailRow icon={<FileText className="h-4 w-4" />} label="Terms of Payment" value={supplier.payment_terms} />
                )}
                {supplier.lead_time_days != null && (
                  <DetailRow icon={<Clock className="h-4 w-4" />} label="Lead Time" value={`${supplier.lead_time_days} day${supplier.lead_time_days !== 1 ? 's' : ''}`} />
                )}
                {supplier.delivery_terms && (
                  <DetailRow icon={<Truck className="h-4 w-4" />} label="Delivery Terms" value={supplier.delivery_terms} />
                )}
                {supplier.special_discounts && (
                  <DetailRow icon={<Tag className="h-4 w-4" />} label="Special Discounts" value={supplier.special_discounts} />
                )}
                {supplier.min_purchase_amount != null && (
                  <DetailRow
                    icon={<DollarSign className="h-4 w-4" />}
                    label="Min. Purchase Amount"
                    value={formatCurrency(supplier.min_purchase_amount)}
                  />
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">
          {/* Notes */}
          {supplier.notes && (
            <SectionCard icon={<FileText className="h-4 w-4" />} title="Notes">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{supplier.notes}</p>
            </SectionCard>
          )}

          {/* 4. Products */}
          <SectionCard icon={<Link2 className="h-4 w-4" />} title="Catalog Products">
            {products.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No catalog items linked to this supplier yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/40">
                      <th className="text-left py-2 pr-2 font-semibold text-slate-400">Item</th>
                      <th className="text-left py-2 px-2 font-semibold text-slate-400">SKU</th>
                      <th className="text-right py-2 px-2 font-semibold text-slate-400">Price</th>
                      <th className="text-center py-2 pl-2 font-semibold text-slate-400">Primary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-100/50 cursor-pointer transition-colors"
                        onClick={() => p.price_list_item && navigate(`/prices/${p.price_list_item.id}`)}
                      >
                        <td className="py-2 pr-2 text-slate-700 font-medium">
                          {p.price_list_item?.concept_description ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-slate-500 font-mono">{p.supplier_sku ?? '—'}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-700">
                          {p.supplier_price != null ? formatCurrency(p.supplier_price) : '—'}
                        </td>
                        <td className="py-2 pl-2 text-center">
                          {p.is_primary && (
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
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Added</span>
                <span>{formatDate(supplier.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Last Updated</span>
                <span>{formatDate(supplier.updated_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status</span>
                <span className={supplier.is_active ? 'text-green-600' : 'text-red-500'}>
                  {supplier.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* 5. Activity Log — full width */}
      <div className="section-enter" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Activity Log</h3>
        </div>
        <SupplierLogSection supplierId={supplier.id} />
      </div>

      {/* Edit Modal */}
      <SupplierFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { loadSupplier(); loadProducts(); }}
        supplier={supplier}
      />
    </div>
  );
}
