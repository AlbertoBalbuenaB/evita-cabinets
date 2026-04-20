import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Pencil as Edit2, ToggleLeft, ToggleRight, Truck,
  LayoutGrid, LayoutList, Phone, Mail, Package, Tag, Star, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { SupplierFormModal } from '../components/SupplierFormModal';
import { useCurrentMember } from '../lib/useCurrentMember';
import type { Supplier } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface SupplierWithCount extends Supplier {
  item_count: number;
}

type ViewMode = 'list' | 'card';
type HealthScore = 'green' | 'yellow' | 'red' | 'none';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// Generate a deterministic gradient color based on supplier name
function getAvatarGradient(name: string): string {
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-orange-500 to-red-500',
    'from-cyan-500 to-blue-600',
    'from-pink-500 to-rose-600',
    'from-amber-500 to-orange-600',
    'from-teal-500 to-emerald-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

function SupplierAvatar({ name, logoUrl, size = 'sm' }: { name: string; logoUrl?: string | null; size?: 'sm' | 'lg' }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const gradient = getAvatarGradient(name);
  const sizeClass = size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs';
  if (logoUrl) {
    return (
      <div className={`rounded-xl overflow-hidden bg-white border border-slate-200/60 flex-shrink-0 flex items-center justify-center ${sizeClass}`}>
        <img src={logoUrl} alt={name} className="w-full h-full object-contain p-0.5" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.parentElement as HTMLElement).classList.add('bg-gradient-to-br', ...gradient.split(' ')); }} />
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white font-bold flex-shrink-0 ${sizeClass}`}>
      {initials || <Truck className="h-4 w-4" />}
    </div>
  );
}

// ── Supplier Card ─────────────────────────────────────────────────────────────

function SupplierCard({
  supplier,
  isAdmin,
  onEdit,
  onToggle,
  onClick,
}: {
  supplier: SupplierWithCount;
  isAdmin: boolean;
  onEdit: (e: React.MouseEvent) => void;
  onToggle: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const health = computeHealth(supplier);
  const healthStyle = HEALTH_STYLES[health];
  const categories: string[] = supplier.categories ?? [];

  return (
    <div
      onClick={onClick}
      className={`relative group bg-white border rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
        supplier.is_active ? 'border-slate-200/80' : 'border-slate-200/40 opacity-60'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <SupplierAvatar name={supplier.name} logoUrl={supplier.logo_url} size="lg" />
        <div className="flex items-center gap-1.5">
          {health !== 'none' && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${healthStyle.className}`}>
              {healthStyle.label}
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              supplier.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {supplier.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Name */}
      <h3 className="font-semibold text-slate-900 text-sm leading-tight mb-1">{supplier.name}</h3>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {categories.slice(0, 3).map((cat) => (
            <span key={cat} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
              <Tag className="h-2.5 w-2.5" />
              {cat}
            </span>
          ))}
          {categories.length > 3 && (
            <span className="text-xs text-slate-400">+{categories.length - 3}</span>
          )}
        </div>
      )}

      {/* Contact info */}
      <div className="space-y-1 text-xs text-slate-500">
        {supplier.contact_name && (
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-400 text-[10px] uppercase font-semibold tracking-wide w-14 flex-shrink-0">Contact</span>
            <span className="truncate">{supplier.contact_name}</span>
          </div>
        )}
        {supplier.phone && (
          <div className="flex items-center gap-1.5 truncate">
            <Phone className="h-3 w-3 text-slate-300 flex-shrink-0" />
            <span className="truncate">{supplier.phone}</span>
          </div>
        )}
        {supplier.email && (
          <div className="flex items-center gap-1.5 truncate">
            <Mail className="h-3 w-3 text-slate-300 flex-shrink-0" />
            <span className="truncate">{supplier.email}</span>
          </div>
        )}
      </div>

      {/* Footer: item count + quality */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Package className="h-3.5 w-3.5 text-slate-300" />
          <span>{supplier.item_count} item{supplier.item_count !== 1 ? 's' : ''}</span>
        </div>
        {supplier.quality_score != null && (
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${i <= (supplier.quality_score ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Admin quick actions (visible on hover) */}
      {isAdmin && (
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg bg-white shadow-sm border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-colors"
            title="Edit supplier"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onToggle}
            className={`p-1.5 rounded-lg bg-white shadow-sm border border-slate-200 transition-colors ${
              supplier.is_active
                ? 'text-slate-400 hover:text-amber-600 hover:border-amber-200'
                : 'text-slate-400 hover:text-green-600 hover:border-green-200'
            }`}
            title={supplier.is_active ? 'Deactivate' : 'Activate'}
          >
            {supplier.is_active ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Suppliers({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const { member } = useCurrentMember();
  const isAdmin = member?.role === 'admin';

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);
    try {
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      if (supplierError) throw supplierError;

      const { data: countData, error: countError } = await supabase
        .from('price_list_suppliers')
        .select('supplier_id');
      if (countError) throw countError;

      const countMap: Record<string, number> = {};
      for (const row of countData ?? []) {
        countMap[row.supplier_id] = (countMap[row.supplier_id] ?? 0) + 1;
      }

      const withCounts: SupplierWithCount[] = (supplierData ?? []).map((s) => ({
        ...s,
        item_count: countMap[s.id] ?? 0,
      }));

      setSuppliers(withCounts);
    } catch (err) {
      console.error('Error loading suppliers:', err);
    } finally {
      setLoading(false);
    }
  }

  // Collect all unique categories across all suppliers
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    suppliers.forEach((s) => (s.categories ?? []).forEach((c) => cats.add(c)));
    return Array.from(cats).sort();
  }, [suppliers]);

  // Filtered list
  const filtered = useMemo(() => {
    let result = suppliers;

    if (!showInactive) result = result.filter((s) => s.is_active);

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          (s.contact_name && s.contact_name.toLowerCase().includes(term)) ||
          (s.email && s.email.toLowerCase().includes(term)) ||
          (s.categories ?? []).some((c) => c.toLowerCase().includes(term))
      );
    }

    if (selectedCategories.length > 0) {
      result = result.filter((s) =>
        selectedCategories.some((cat) => (s.categories ?? []).includes(cat))
      );
    }

    return result;
  }, [suppliers, searchTerm, showInactive, selectedCategories]);

  function handleAddNew() {
    setEditingSupplier(null);
    setIsModalOpen(true);
  }

  function handleEdit(supplier: Supplier) {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  }

  async function handleToggleActive(supplier: Supplier) {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active: !supplier.is_active })
        .eq('id', supplier.id);
      if (error) throw error;
      loadSuppliers();
    } catch (err) {
      console.error('Error toggling supplier status:', err);
    }
  }

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 page-enter">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-2">
            <div className="h-8 w-36 skeleton-shimmer" />
            <div className="h-4 w-52 skeleton-shimmer" />
          </div>
          <div className="h-10 w-32 skeleton-shimmer" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1 h-11 skeleton-shimmer" />
          <div className="h-11 w-40 skeleton-shimmer" />
        </div>
        <div className="glass-white rounded-2xl overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 skeleton-shimmer m-4 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-enter">
        {/* Header */}
        {!embedded && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hero-enter">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Suppliers</h1>
              <p className="mt-1 text-slate-500 text-sm">
                {suppliers.filter((s) => s.is_active).length} active supplier
                {suppliers.filter((s) => s.is_active).length !== 1 ? 's' : ''}
                {' '}· Manage vendor contacts and purchase sources
              </p>
            </div>
            {isAdmin && (
              <Button onClick={handleAddNew} className="self-start sm:self-auto">
                <Plus className="h-4 w-4 mr-2" />
                New Supplier
              </Button>
            )}
          </div>
        )}

        {/* Filters toolbar */}
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, contact, email, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
              />
            </div>

            {/* Show inactive */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600 whitespace-nowrap">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Show inactive
            </label>

            {/* View mode toggle */}
            <div className="flex p-1 bg-slate-100 rounded-lg flex-shrink-0">
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'card' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Card view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="List view"
              >
                <LayoutList className="h-4 w-4" />
              </button>
            </div>

            {/* New supplier in embedded mode */}
            {embedded && isAdmin && (
              <Button onClick={handleAddNew} size="sm" className="self-start sm:self-auto whitespace-nowrap">
                <Plus className="h-4 w-4 mr-2" />
                New Supplier
              </Button>
            )}
          </div>

          {/* Category filter chips */}
          {allCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Filter by type:</span>
              {allCategories.map((cat) => {
                const active = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-500 border border-transparent hover:bg-slate-200'
                    }`}
                  >
                    <Tag className="h-3 w-3" />
                    {cat}
                    {active && <X className="h-3 w-3 ml-0.5" />}
                  </button>
                );
              })}
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="glass-white rounded-2xl flex flex-col items-center justify-center py-20 text-center">
            <Truck className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">
              {searchTerm || showInactive || selectedCategories.length > 0
                ? 'No suppliers match your filters.'
                : 'No suppliers yet.'}
            </p>
            {!searchTerm && selectedCategories.length === 0 && isAdmin && (
              <Button onClick={handleAddNew} className="mt-4" variant="secondary">
                <Plus className="h-4 w-4 mr-2" />
                Add your first supplier
              </Button>
            )}
          </div>
        ) : viewMode === 'card' ? (
          /* ── Card View ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                isAdmin={isAdmin}
                onClick={() => navigate(`/suppliers/${supplier.id}`, {
                  state: embedded ? { from: '/prices?tab=suppliers' } : undefined,
                })}
                onEdit={(e) => { e.stopPropagation(); handleEdit(supplier); }}
                onToggle={(e) => { e.stopPropagation(); handleToggleActive(supplier); }}
              />
            ))}
          </div>
        ) : (
          /* ── List View ── */
          <div className="glass-white rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200/60 bg-slate-50/60">
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Phone</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Categories</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Lead Time</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600"># Items</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                    {isAdmin && (
                      <th className="text-right px-5 py-3 font-semibold text-slate-600">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((supplier) => {
                    const health = computeHealth(supplier);
                    const healthStyle = HEALTH_STYLES[health];
                    const categories: string[] = supplier.categories ?? [];

                    return (
                      <tr
                        key={supplier.id}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/suppliers/${supplier.id}`, {
                          state: embedded ? { from: '/prices?tab=suppliers' } : undefined,
                        })}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <SupplierAvatar name={supplier.name} logoUrl={supplier.logo_url} />
                            <div>
                              <p className="font-medium text-slate-900">{supplier.name}</p>
                              {supplier.payment_terms && (
                                <p className="text-xs text-slate-400 mt-0.5">{supplier.payment_terms}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 hidden sm:table-cell">
                          {supplier.contact_name || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 hidden md:table-cell">
                          {supplier.phone || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          {categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {categories.slice(0, 3).map((cat) => (
                                <span
                                  key={cat}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600"
                                >
                                  {cat}
                                </span>
                              ))}
                              {categories.length > 3 && (
                                <span className="text-xs text-slate-400">+{categories.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center text-slate-600 hidden lg:table-cell">
                          {supplier.lead_time_days != null ? (
                            <span>{supplier.lead_time_days}d</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                            {supplier.item_count}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                supplier.is_active
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {supplier.is_active ? 'Active' : 'Inactive'}
                            </span>
                            {health !== 'none' && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${healthStyle.className}`}>
                                {healthStyle.label}
                              </span>
                            )}
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleEdit(supplier)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Edit supplier"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleToggleActive(supplier)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  supplier.is_active
                                    ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                                }`}
                                title={supplier.is_active ? 'Deactivate supplier' : 'Activate supplier'}
                              >
                                {supplier.is_active ? (
                                  <ToggleRight className="h-4 w-4" />
                                ) : (
                                  <ToggleLeft className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <SupplierFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingSupplier(null); }}
        onSuccess={loadSuppliers}
        supplier={editingSupplier}
      />
    </>
  );
}
