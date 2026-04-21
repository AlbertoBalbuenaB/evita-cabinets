import { useEffect, useState, useCallback } from 'react';
import { Search, ArrowUpDown, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/calculations';
import type { InventoryMovementWithDetails } from '../../types';

const MOVEMENT_TYPES = ['All', 'IN', 'OUT', 'ADJUSTMENT', 'RETURN'] as const;

const TYPE_STYLES: Record<string, string> = {
  IN: 'bg-status-emerald-bg text-status-emerald-fg',
  OUT: 'bg-status-red-bg text-status-red-fg',
  ADJUSTMENT: 'bg-accent-tint-soft text-accent-text',
  RETURN: 'bg-status-orange-bg text-status-orange-fg',
};

function qtyPrefix(type: string): string {
  if (type === 'IN') return '+';
  if (type === 'OUT' || type === 'RETURN') return '-';
  return '~';
}

export function InventoryMovementsTable() {
  const navigate = useNavigate();
  const [movements, setMovements] = useState<InventoryMovementWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const loadMovements = useCallback(async () => {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*, price_list_item:price_list(concept_description, unit), created_by_member:team_members(name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) {
      setMovements(data as InventoryMovementWithDetails[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const filtered = movements.filter((m) => {
    if (typeFilter !== 'All' && m.movement_type !== typeFilter) return false;
    if (dateFrom && m.created_at < dateFrom) return false;
    if (dateTo && m.created_at > dateTo + 'T23:59:59') return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const itemName = m.price_list_item?.concept_description?.toLowerCase() ?? '';
      if (!itemName.includes(term)) return false;
    }
    return true;
  });

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
      {/* Filter bar */}
      <div className="flex flex-col gap-3">
        {/* Type chips */}
        <div className="flex flex-wrap gap-2">
          {MOVEMENT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                typeFilter === type
                  ? type === 'All'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : (TYPE_STYLES[type] || '') + ' border-current'
                  : 'bg-surf-card text-fg-500 border-border-soft hover:bg-surf-app'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Date range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-fg-400 flex-shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-border-soft bg-surf-card focus:border-accent-tint-border focus:ring-2 focus:ring-blue-100 outline-none transition"
              placeholder="From"
            />
            <span className="text-fg-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-border-soft bg-surf-card focus:border-accent-tint-border focus:ring-2 focus:ring-blue-100 outline-none transition"
              placeholder="To"
            />
          </div>

          {/* Item search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by item name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border-soft bg-surf-card placeholder:text-fg-400 focus:border-accent-tint-border focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft bg-surf-app">
                <th className="text-left px-5 py-3 font-semibold text-fg-600">Date/Time</th>
                <th className="text-left px-5 py-3 font-semibold text-fg-600">Item</th>
                <th className="text-center px-5 py-3 font-semibold text-fg-600">Type</th>
                <th className="text-right px-5 py-3 font-semibold text-fg-600">Qty</th>
                <th className="text-right px-5 py-3 font-semibold text-fg-600 hidden sm:table-cell">Unit Cost</th>
                <th className="text-right px-5 py-3 font-semibold text-fg-600 hidden md:table-cell">WAC</th>
                <th className="text-left px-5 py-3 font-semibold text-fg-600 hidden lg:table-cell">Reference</th>
                <th className="text-left px-5 py-3 font-semibold text-fg-600 hidden lg:table-cell">Done by</th>
                <th className="text-left px-5 py-3 font-semibold text-fg-600 hidden xl:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-fg-400">
                    <ArrowUpDown className="h-8 w-8 mx-auto mb-2 text-fg-300" />
                    <p>No movements found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-surf-app transition-colors">
                    <td className="px-5 py-3.5 text-fg-500 whitespace-nowrap">
                      {format(new Date(m.created_at), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      <button
                        onClick={() => navigate(`/prices/${m.price_list_item_id}`)}
                        className="text-accent-text hover:text-blue-800 hover:underline truncate block text-left font-medium"
                      >
                        {m.price_list_item?.concept_description ?? '—'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          TYPE_STYLES[m.movement_type] ?? 'bg-surf-muted text-fg-600'
                        }`}
                      >
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-medium text-fg-700">
                      {qtyPrefix(m.movement_type)}{m.quantity}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-fg-600 hidden sm:table-cell">
                      {m.unit_cost != null ? formatCurrency(m.unit_cost) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-fg-600 hidden md:table-cell">
                      {m.running_average_cost != null ? formatCurrency(m.running_average_cost) : '—'}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      {m.reference_type ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surf-muted text-fg-600">
                            {m.reference_type}
                          </span>
                          {m.reference_type === 'PROJECT' && m.reference_id && (
                            <button
                              onClick={() => navigate(`/projects/${m.reference_id}`)}
                              className="text-accent-text hover:underline text-xs"
                            >
                              View
                            </button>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-fg-500 hidden lg:table-cell">
                      {m.created_by_member?.name ?? 'System'}
                    </td>
                    <td className="px-5 py-3.5 text-fg-400 hidden xl:table-cell max-w-[150px] truncate">
                      {m.notes ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
