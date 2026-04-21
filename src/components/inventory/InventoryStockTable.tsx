import { useEffect, useState, useCallback } from 'react';
import { Search, AlertTriangle, PackageX, Package, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/calculations';
import { StockBadge } from './StockBadge';
import { InventoryMovementModal } from './InventoryMovementModal';
import type { PriceListItem, PriceListSupplier, Supplier } from '../../types';

type StockItem = PriceListItem & {
  price_list_suppliers: (PriceListSupplier & { supplier: Supplier })[];
};

export function InventoryStockTable() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [adjustItem, setAdjustItem] = useState<{ id: string; name: string } | null>(null);

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('price_list')
      .select('*, price_list_suppliers(*, supplier:suppliers(*))')
      .eq('is_active', true)
      .order('concept_description');
    if (!error && data) {
      setItems(data as StockItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filtered = items.filter((item) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!item.concept_description.toLowerCase().includes(term)) return false;
    }
    if (showLowOnly) {
      if (item.stock_quantity > item.min_stock_level && item.stock_quantity > 0) return false;
    }
    return true;
  });

  const totalItems = items.length;
  const lowStockCount = items.filter(
    (i) => i.stock_quantity > 0 && i.stock_quantity <= i.min_stock_level
  ).length;
  const noStockCount = items.filter((i) => i.stock_quantity === 0).length;

  function startEdit(id: string, field: string, currentValue: string | number | null) {
    setEditingCell({ id, field });
    setEditValue(String(currentValue ?? ''));
  }

  async function saveEdit(id: string, field: string) {
    setEditingCell(null);
    const value = field === 'stock_location' ? editValue.trim() || null : parseFloat(editValue) || 0;
    const { error } = await supabase
      .from('price_list')
      .update({ [field]: value })
      .eq('id', id);
    if (!error) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
    }
  }

  function getPrimarySupplier(item: StockItem): string {
    const primary = item.price_list_suppliers?.find((s) => s.is_primary);
    return primary?.supplier?.name ?? '—';
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 skeleton-shimmer rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-surf-app border border-border-soft rounded-xl">
          <Package className="h-4 w-4 text-fg-400" />
          <span className="text-sm text-fg-600">
            <strong className="text-fg-800">{totalItems}</strong> items
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50/80 border border-amber-200/50 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-amber-700">
            <strong>{lowStockCount}</strong> low stock
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50/80 border border-red-200/50 rounded-xl">
          <PackageX className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700">
            <strong>{noStockCount}</strong> no stock
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by item name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border-soft bg-surf-card placeholder:text-fg-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
          />
        </div>
        <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-surf-card border border-border-soft rounded-xl cursor-pointer hover:bg-surf-app transition-colors">
          <Filter className="h-4 w-4 text-fg-400" />
          <input
            type="checkbox"
            checked={showLowOnly}
            onChange={(e) => setShowLowOnly(e.target.checked)}
            className="rounded border-border-solid text-blue-600 focus-visible:ring-focus"
          />
          <span className="text-sm text-fg-600">Show only low/no stock items</span>
        </label>
      </div>

      {/* Table */}
      <div className="glass-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft bg-surf-app">
                <th className="text-left px-5 py-3 font-semibold text-fg-600">Item</th>
                <th className="text-left px-5 py-3 font-semibold text-fg-600 hidden md:table-cell">Type</th>
                <th className="text-left px-5 py-3 font-semibold text-fg-600 hidden lg:table-cell">Location</th>
                <th className="text-right px-5 py-3 font-semibold text-fg-600">Current Stock</th>
                <th className="text-right px-5 py-3 font-semibold text-fg-600 hidden sm:table-cell">Min Stock</th>
                <th className="text-right px-5 py-3 font-semibold text-fg-600 hidden lg:table-cell">WAC</th>
                <th className="text-right px-5 py-3 font-semibold text-fg-600 hidden xl:table-cell">Last Cost</th>
                <th className="text-left px-5 py-3 font-semibold text-fg-600 hidden xl:table-cell">Primary Supplier</th>
                <th className="text-center px-5 py-3 font-semibold text-fg-600">Status</th>
                <th className="text-center px-5 py-3 font-semibold text-fg-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-fg-400">
                    <Package className="h-8 w-8 mx-auto mb-2 text-fg-300" />
                    <p>No items found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-surf-app transition-colors">
                    <td className="px-5 py-3.5 font-medium text-fg-800 max-w-[200px] truncate">
                      {item.concept_description}
                    </td>
                    <td className="px-5 py-3.5 text-fg-500 hidden md:table-cell">{item.type}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      {editingCell?.id === item.id && editingCell.field === 'stock_location' ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(item.id, 'stock_location')}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(item.id, 'stock_location')}
                          className="w-full px-2 py-1 text-sm border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(item.id, 'stock_location', item.stock_location)}
                          className="text-fg-500 hover:text-fg-700 hover:bg-surf-muted px-2 py-1 rounded-md transition-colors text-left w-full"
                          title="Click to edit"
                        >
                          {item.stock_location || '—'}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-fg-700">
                      {item.stock_quantity} {item.unit}
                    </td>
                    <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                      {editingCell?.id === item.id && editingCell.field === 'min_stock_level' ? (
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="any"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(item.id, 'min_stock_level')}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(item.id, 'min_stock_level')}
                          className="w-20 px-2 py-1 text-sm text-right border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-100 outline-none ml-auto"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(item.id, 'min_stock_level', item.min_stock_level)}
                          className="text-fg-500 hover:text-fg-700 hover:bg-surf-muted px-2 py-1 rounded-md transition-colors tabular-nums"
                          title="Click to edit"
                        >
                          {item.min_stock_level}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-fg-700 hidden lg:table-cell">
                      {item.average_cost ? formatCurrency(item.average_cost) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-fg-700 hidden xl:table-cell">
                      {item.last_purchase_cost ? formatCurrency(item.last_purchase_cost) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-fg-500 hidden xl:table-cell">
                      {getPrimarySupplier(item)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <StockBadge
                        stock_quantity={item.stock_quantity}
                        min_stock_level={item.min_stock_level}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => setAdjustItem({ id: item.id, name: item.concept_description })}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement modal */}
      {adjustItem && (
        <InventoryMovementModal
          priceListItemId={adjustItem.id}
          priceListItemName={adjustItem.name}
          onClose={() => setAdjustItem(null)}
          onSaved={() => {
            setAdjustItem(null);
            loadItems();
          }}
        />
      )}
    </div>
  );
}
