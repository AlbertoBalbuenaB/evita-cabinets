import { useEffect, useState } from 'react';
import { Plus, Search, Pencil as Edit2, ToggleLeft, ToggleRight, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { SupplierFormModal } from '../components/SupplierFormModal';
import { useCurrentMember } from '../lib/useCurrentMember';
import type { Supplier } from '../types';

interface SupplierWithCount extends Supplier {
  item_count: number;
}

export function Suppliers({ embedded = false }: { embedded?: boolean }) {
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([]);
  const [filtered, setFiltered] = useState<SupplierWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const { member } = useCurrentMember();
  const isAdmin = member?.role === 'admin';

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    let result = suppliers;

    if (!showInactive) {
      result = result.filter((s) => s.is_active);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          (s.contact_name && s.contact_name.toLowerCase().includes(term)) ||
          (s.email && s.email.toLowerCase().includes(term))
      );
    }

    setFiltered(result);
  }, [suppliers, searchTerm, showInactive]);

  async function loadSuppliers() {
    setLoading(true);
    try {
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (supplierError) throw supplierError;

      // Fetch item counts per supplier
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
        {/* Header — hidden when embedded as a tab */}
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

        {/* Filters */}
        <div className="mb-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, contact, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Show inactive
          </label>
          {embedded && isAdmin && (
            <Button onClick={handleAddNew} size="sm" className="self-start sm:self-auto whitespace-nowrap">
              <Plus className="h-4 w-4 mr-2" />
              New Supplier
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="glass-white rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Truck className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">
                {searchTerm || showInactive
                  ? 'No suppliers match your search.'
                  : 'No suppliers yet.'}
              </p>
              {!searchTerm && isAdmin && (
                <Button onClick={handleAddNew} className="mt-4" variant="secondary">
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first supplier
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200/60 bg-slate-50/60">
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Phone</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Email</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Lead Time</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600"># Items</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                    {isAdmin && (
                      <th className="text-right px-5 py-3 font-semibold text-slate-600">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((supplier) => (
                    <tr
                      key={supplier.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900">{supplier.name}</p>
                        {supplier.payment_terms && (
                          <p className="text-xs text-slate-400 mt-0.5">{supplier.payment_terms}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 hidden sm:table-cell">
                        {supplier.contact_name || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 hidden md:table-cell">
                        {supplier.phone || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {supplier.email ? (
                          <a
                            href={`mailto:${supplier.email}`}
                            className="text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {supplier.email}
                          </a>
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
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            supplier.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {supplier.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
