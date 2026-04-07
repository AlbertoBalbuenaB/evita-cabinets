import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Trash2, Package, Info, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/calculations';
import type { ProjectPurchaseItemWithDetails } from '../../types';

interface PriceListOption {
  id: string;
  concept_description: string;
  unit: string;
  price: number;
  stock_quantity: number;
  price_list_suppliers?: { supplier_price: number | null; is_primary: boolean }[];
}

interface PurchaseItemRowProps {
  item: ProjectPurchaseItemWithDetails;
  priceListItems: PriceListOption[];
  suppliers: { id: string; name: string }[];
  teamMembers: { id: string; name: string }[];
  projectName: string;
  onUpdate: (id: string, changes: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onConsumeInventory: (item: ProjectPurchaseItemWithDetails) => void;
  onOpenDetail: (item: ProjectPurchaseItemWithDetails) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  Ordered: 'bg-slate-100 text-slate-600',
  Paid: 'bg-blue-100 text-blue-700',
  'In Transit': 'bg-amber-100 text-amber-700',
  'In Warehouse': 'bg-green-100 text-green-700',
  Return: 'bg-red-100 text-red-700',
};

const PRIORITY_DOT: Record<string, string> = {
  High: 'bg-red-500',
  Medium: 'bg-amber-400',
  Low: 'bg-green-500',
};

export function PurchaseItemRow({
  item,
  priceListItems,
  suppliers: _suppliers,
  teamMembers: _teamMembers,
  projectName: _projectName,
  onUpdate,
  onDelete,
  onConsumeInventory,
  onOpenDetail,
  onDragStart,
  onDragOver,
  onDrop,
}: PurchaseItemRowProps) {
  const [conceptSearch, setConceptSearch] = useState(item.concept);
  const [showDropdown, setShowDropdown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const conceptRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync concept from props when item changes externally
  useEffect(() => {
    setConceptSearch(item.concept);
  }, [item.concept]);

  // Recalculate dropdown position whenever it opens
  useEffect(() => {
    if (showDropdown && conceptRef.current) {
      const rect = conceptRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: Math.max(rect.width, 260),
        zIndex: 9999,
      });
    }
  }, [showDropdown]);

  // Close dropdown on scroll or resize to avoid misalignment
  useEffect(() => {
    if (!showDropdown) return;
    function close() { setShowDropdown(false); }
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [showDropdown]);

  const debouncedUpdate = useCallback(
    (id: string, changes: Record<string, any>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onUpdate(id, changes), 500);
    },
    [onUpdate]
  );

  function handleFieldChange(field: string, value: any) {
    debouncedUpdate(item.id, { [field]: value });
  }

  function handleImmediateUpdate(changes: Record<string, any>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onUpdate(item.id, changes);
  }

  function handleConceptChange(value: string) {
    setConceptSearch(value);
    setShowDropdown(value.length > 0);
    debouncedUpdate(item.id, { concept: value, price_list_item_id: null });
  }

  function handleSelectPriceListItem(pli: PriceListOption) {
    setConceptSearch(pli.concept_description);
    setShowDropdown(false);
    const primarySupplier = pli.price_list_suppliers?.find((s) => s.is_primary);
    const price = primarySupplier?.supplier_price ?? pli.price;
    const changes: Record<string, any> = {
      concept: pli.concept_description,
      price_list_item_id: pli.id,
      price: price,
    };
    if (!item.unit) changes.unit = pli.unit;
    handleImmediateUpdate(changes);
  }

  const filteredPLI = conceptSearch
    ? priceListItems.filter((p) =>
        p.concept_description.toLowerCase().includes(conceptSearch.toLowerCase())
      ).slice(0, 10)
    : [];

  // Stock calculations
  const stockQty = item.price_list_item?.stock_quantity ?? 0;
  const hasLinkedItem = !!item.price_list_item_id;
  const toBuy = hasLinkedItem ? Math.max(0, item.quantity - stockQty) : null;

  const canConsume =
    item.status === 'In Warehouse' &&
    !item.inventory_committed &&
    !!item.price_list_item_id;

  // Price pricelist indicator
  const linkedPriceListItem = hasLinkedItem
    ? priceListItems.find((p) => p.id === item.price_list_item_id)
    : null;
  const listPrice = linkedPriceListItem
    ? (linkedPriceListItem.price_list_suppliers?.find((s) => s.is_primary)?.supplier_price ?? linkedPriceListItem.price)
    : null;
  const isPriceOverridden = listPrice !== null && item.price !== null && Math.abs(item.price - listPrice) > 0.001;

  const dropdown = showDropdown && filteredPLI.length > 0
    ? createPortal(
        <div
          style={dropdownStyle}
          className="max-h-52 overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-xl"
        >
          {filteredPLI.map((pli) => (
            <button
              key={pli.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelectPriceListItem(pli); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
            >
              <span className="truncate">{pli.concept_description}</span>
              <span className="text-xs text-slate-400 ml-2 flex-shrink-0">{pli.unit}</span>
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <tr
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, item.id)}
      className="hover:bg-slate-50/50 transition-colors group border-b border-slate-100"
    >
      {/* Drag handle */}
      <td className="w-8 px-1 py-2">
        <div className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </div>
      </td>

      {/* Concept */}
      <td className="px-2 py-2 min-w-[240px]">
        <div className="relative">
          <input
            ref={conceptRef}
            type="text"
            value={conceptSearch}
            onChange={(e) => handleConceptChange(e.target.value)}
            onFocus={() => conceptSearch && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            className="w-full px-2 py-1.5 text-sm border border-transparent hover:border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-md outline-none transition bg-transparent"
            placeholder="Type to search items..."
          />
        </div>
        {dropdown}
      </td>

      {/* Qty */}
      <td className="px-2 py-2 w-[72px]">
        <input
          type="number"
          min="0.001"
          step="1"
          defaultValue={item.quantity}
          onBlur={(e) => handleFieldChange('quantity', parseFloat(e.target.value) || 1)}
          className="w-full px-2 py-1.5 text-sm text-right tabular-nums border border-transparent hover:border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-md outline-none transition bg-transparent"
        />
      </td>

      {/* In Stock */}
      <td className="px-2 py-2 w-[72px] text-center">
        {hasLinkedItem ? (
          <span
            className={`text-sm tabular-nums font-medium ${
              stockQty >= item.quantity ? 'text-green-600' : stockQty > 0 ? 'text-amber-600' : 'text-red-500'
            }`}
            title="Current inventory stock"
          >
            {stockQty}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* To Buy */}
      <td className="px-2 py-2 w-[72px] text-center">
        {hasLinkedItem ? (
          toBuy! > 0 ? (
            <span className="text-sm tabular-nums font-medium text-red-500">{toBuy}</span>
          ) : (
            <span className="text-sm text-green-600 font-medium">&#10003;</span>
          )
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* Unit */}
      <td className="px-2 py-2 w-[64px]">
        <input
          type="text"
          defaultValue={item.unit ?? ''}
          onBlur={(e) => handleFieldChange('unit', e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-transparent hover:border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-md outline-none transition bg-transparent"
        />
      </td>

      {/* Price */}
      <td className="px-2 py-2 w-[108px]">
        <div className="relative flex items-center">
          <input
            type="number"
            min="0"
            step="0.01"
            defaultValue={item.price}
            onBlur={(e) => handleFieldChange('price', parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1.5 text-sm text-right tabular-nums border border-transparent hover:border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-md outline-none transition bg-transparent"
          />
          {isPriceOverridden && (
            <AlertCircle
              className="absolute -right-0.5 -top-0.5 h-3 w-3 text-amber-400 flex-shrink-0 pointer-events-none"
              title={`Manually overridden (list price: ${formatCurrency(listPrice!)})`}
            />
          )}
        </div>
      </td>

      {/* Subtotal */}
      <td className="px-2 py-2 w-[96px] text-right text-sm tabular-nums text-slate-700 font-medium">
        {formatCurrency(item.subtotal ?? item.quantity * item.price)}
      </td>

      {/* Priority */}
      <td className="px-2 py-2 w-[88px]">
        <div className="relative">
          <select
            value={item.priority ?? 'Medium'}
            onChange={(e) => handleImmediateUpdate({ priority: e.target.value })}
            className="w-full appearance-none pl-5 pr-6 py-1.5 text-xs font-medium border border-transparent hover:border-slate-200 focus:border-blue-300 rounded-md outline-none transition bg-transparent cursor-pointer"
          >
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <span className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[item.priority ?? 'Medium']}`} />
        </div>
      </td>

      {/* Status */}
      <td className="px-2 py-2 w-[120px]">
        <select
          value={item.status ?? 'Ordered'}
          onChange={(e) => handleImmediateUpdate({ status: e.target.value })}
          className={`w-full appearance-none px-2.5 py-1.5 text-xs font-medium rounded-full cursor-pointer outline-none transition ${STATUS_STYLES[item.status ?? 'Ordered']}`}
        >
          <option value="Ordered">Ordered</option>
          <option value="Paid">Paid</option>
          <option value="In Transit">In Transit</option>
          <option value="In Warehouse">In Warehouse</option>
          <option value="Return">Return</option>
        </select>
      </td>

      {/* Actions */}
      <td className="px-2 py-2 w-[80px]">
        <div className="flex items-center gap-1">
          {/* Info / detail panel button */}
          <button
            onClick={() => onOpenDetail(item)}
            className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
            title="More info (assigned, comments)"
          >
            <Info className="h-3.5 w-3.5" />
          </button>

          {canConsume && (
            <button
              onClick={() => onConsumeInventory(item)}
              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
              title="Consume Inventory"
            >
              <Package className="h-3.5 w-3.5" />
            </button>
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onDelete(item.id)}
                className="px-1.5 py-0.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-1.5 py-0.5 text-xs font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 rounded transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
