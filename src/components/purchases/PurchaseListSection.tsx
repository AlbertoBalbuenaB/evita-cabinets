import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Printer, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/calculations';
import { Button } from '../Button';
import { PurchaseSummaryCards } from './PurchaseSummaryCards';
import { PurchaseItemRow } from './PurchaseItemRow';
import { ConsumeInventoryModal } from './ConsumeInventoryModal';
import { PurchaseItemDetailPanel } from './PurchaseItemDetailPanel';
import { printPurchaseList } from '../../utils/printPurchaseList';
import type { ProjectPurchaseItemWithDetails } from '../../types';

interface PurchaseListSectionProps {
  projectId: string;
}

interface PriceListOption {
  id: string;
  concept_description: string;
  unit: string;
  price: number;
  stock_quantity: number;
  price_list_suppliers?: { supplier_price: number | null; is_primary: boolean }[];
}

const STATUSES = ['All', 'Ordered', 'Paid', 'In Transit', 'In Warehouse', 'Return'] as const;
const PRIORITIES = ['All', 'High', 'Medium', 'Low'] as const;

export function PurchaseListSection({ projectId }: PurchaseListSectionProps) {
  const [items, setItems] = useState<ProjectPurchaseItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceListItems, setPriceListItems] = useState<PriceListOption[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [projectName, setProjectName] = useState('');

  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [consumeItem, setConsumeItem] = useState<ProjectPurchaseItemWithDetails | null>(null);
  const [detailItem, setDetailItem] = useState<ProjectPurchaseItemWithDetails | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  // Estela Alvarez default assignment
  const estelaId = teamMembers.find((m) => m.name === 'Estela Alvarez')?.id ?? null;

  // Load reference data once
  useEffect(() => {
    async function loadRef() {
      const [pliRes, supRes, tmRes, projRes] = await Promise.all([
        supabase.from('price_list')
          .select('id, concept_description, unit, price, stock_quantity, price_list_suppliers(supplier_price, is_primary)')
          .eq('is_active', true)
          .order('concept_description'),
        supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
        supabase.from('team_members').select('id, name').eq('is_active', true).order('name'),
        supabase.from('projects').select('name').eq('id', projectId).single(),
      ]);
      if (pliRes.data) setPriceListItems(pliRes.data as PriceListOption[]);
      if (supRes.data) setSuppliers(supRes.data);
      if (tmRes.data) setTeamMembers(tmRes.data);
      if (projRes.data) setProjectName(projRes.data.name);
    }
    loadRef();
  }, [projectId]);

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('project_purchase_items')
      .select('*, price_list_item:price_list(id, concept_description, unit, price, stock_quantity, average_cost), supplier:suppliers(name), assigned_member:team_members!assigned_to_member_id(name)')
      .eq('project_id', projectId)
      .order('display_order');
    if (!error && data) setItems(data as ProjectPurchaseItemWithDetails[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleUpdate(id: string, changes: Record<string, any>) {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...changes } : i))
    );
    // Sync detailItem if it's the same item
    setDetailItem((prev) => prev && prev.id === id ? { ...prev, ...changes } : prev);
    const { error } = await supabase
      .from('project_purchase_items')
      .update(changes)
      .eq('id', id);
    if (error) loadItems(); // rollback
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (detailItem?.id === id) setDetailItem(null);
    const { error } = await supabase.from('project_purchase_items').delete().eq('id', id);
    if (error) loadItems();
  }

  async function handleAddItem() {
    const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.display_order)) : 0;
    const { data, error } = await supabase
      .from('project_purchase_items')
      .insert({
        project_id: projectId,
        concept: '',
        quantity: 1,
        price: 0,
        display_order: maxOrder + 1,
        assigned_to_member_id: estelaId,
      })
      .select('*, price_list_item:price_list(id, concept_description, unit, price, stock_quantity, average_cost), supplier:suppliers(name), assigned_member:team_members!assigned_to_member_id(name)')
      .single();
    if (!error && data) {
      setItems((prev) => [...prev, data as ProjectPurchaseItemWithDetails]);
      // Focus concept field after render
      setTimeout(() => {
        const rows = document.querySelectorAll('tr[draggable] input[type="text"]');
        const lastInput = rows[rows.length - 1] as HTMLInputElement | undefined;
        lastInput?.focus();
      }, 100);
    }
  }

  // Drag & drop reorder
  function handleDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;

    const oldItems = [...items];
    const dragIdx = items.findIndex((i) => i.id === dragId);
    const targetIdx = items.findIndex((i) => i.id === targetId);
    if (dragIdx === -1 || targetIdx === -1) return;

    const reordered = [...items];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    const updated = reordered.map((item, idx) => ({ ...item, display_order: idx }));
    setItems(updated);
    setDragId(null);

    for (const item of updated) {
      if (oldItems.find((o) => o.id === item.id)?.display_order !== item.display_order) {
        await supabase
          .from('project_purchase_items')
          .update({ display_order: item.display_order })
          .eq('id', item.id);
      }
    }
  }

  // Filtering
  const filtered = items.filter((i) => {
    if (statusFilter !== 'All' && i.status !== statusFilter) return false;
    if (priorityFilter !== 'All' && i.priority !== priorityFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!i.concept.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const filteredTotal = filtered.reduce((sum, i) => sum + (i.subtotal ?? i.quantity * i.price), 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 skeleton-shimmer rounded-xl" />)}
        </div>
        {[1, 2, 3].map((i) => <div key={i} className="h-12 skeleton-shimmer rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PurchaseSummaryCards items={items} />

      {/* Filter bar — single compact row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Status dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-400">Status:</span>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-2 text-xs font-medium border border-slate-200 bg-white rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition cursor-pointer"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        {/* Priority dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-400">Priority:</span>
          <div className="relative">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-2 text-xs font-medium border border-slate-200 bg-white rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition cursor-pointer"
            >
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition w-44"
          />
        </div>

        {/* Print */}
        <button
          onClick={() => printPurchaseList(filtered, projectName, statusFilter, priorityFilter, teamMembers)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
          title="Print purchase list"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>

        <Button size="sm" onClick={handleAddItem}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Item
        </Button>
      </div>

      {/* Table */}
      <div className="glass-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/60">
                <th className="w-8 px-1 py-2.5"></th>
                <th className="text-left px-2 py-2.5 font-semibold text-slate-600 min-w-[240px]">Concept</th>
                <th className="text-right px-2 py-2.5 font-semibold text-slate-600 w-[72px]">Qty</th>
                <th className="text-center px-2 py-2.5 font-semibold text-slate-600 w-[72px]">In Stock</th>
                <th className="text-center px-2 py-2.5 font-semibold text-slate-600 w-[72px]">To Buy</th>
                <th className="text-left px-2 py-2.5 font-semibold text-slate-600 w-[64px]">Unit</th>
                <th className="text-right px-2 py-2.5 font-semibold text-slate-600 w-[108px]">Price</th>
                <th className="text-right px-2 py-2.5 font-semibold text-slate-600 w-[96px]">Subtotal</th>
                <th className="text-center px-2 py-2.5 font-semibold text-slate-600 w-[88px]">Priority</th>
                <th className="text-center px-2 py-2.5 font-semibold text-slate-600 w-[120px]">Status</th>
                <th className="w-[80px] px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                    <p className="text-sm">No purchase items yet.</p>
                    <button
                      onClick={handleAddItem}
                      className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add your first item
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <PurchaseItemRow
                    key={item.id}
                    item={item}
                    priceListItems={priceListItems}
                    suppliers={suppliers}
                    teamMembers={teamMembers}
                    projectName={projectName}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onConsumeInventory={(i) => setConsumeItem(i)}
                    onOpenDetail={(i) => setDetailItem(i)}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/40">
                  <td colSpan={7} className="px-4 py-3 text-sm font-semibold text-slate-700 text-right">
                    Total
                  </td>
                  <td className="px-2 py-3 text-sm font-bold text-slate-900 text-right tabular-nums">
                    {formatCurrency(filteredTotal)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Consume Inventory Modal */}
      {consumeItem && (
        <ConsumeInventoryModal
          item={consumeItem}
          projectName={projectName}
          onConfirm={() => {
            setConsumeItem(null);
            loadItems();
          }}
          onCancel={() => setConsumeItem(null)}
        />
      )}

      {/* Item Detail Panel */}
      {detailItem && (
        <PurchaseItemDetailPanel
          item={detailItem}
          teamMembers={teamMembers}
          projectId={projectId}
          estelaId={estelaId}
          onUpdate={handleUpdate}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}
