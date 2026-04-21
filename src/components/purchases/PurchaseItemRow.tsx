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
  colSpan?: number;
  onUpdate: (id: string, changes: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onConsumeInventory: (item: ProjectPurchaseItemWithDetails) => void;
  onOpenDetail: (item: ProjectPurchaseItemWithDetails) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  Ordered: 'bg-surf-muted text-fg-600',
  Paid: 'bg-blue-100 text-blue-700',
  'In Transit': 'bg-amber-100 text-amber-700',
  'In Warehouse': 'bg-green-100 text-green-700',
  Return: 'bg-red-100 text-red-700',
  Delay: 'bg-orange-100 text-orange-700',
  Pending: 'bg-yellow-100 text-yellow-700',
};

const PRIORITY_DOT: Record<string, string> = {
  Urgent: 'bg-red-600',
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
  // Controlled numeric states — sync from props when changed externally
  const [localQty, setLocalQty] = useState<number>(item.quantity);
  const [localPrice, setLocalPrice] = useState<number>(item.price ?? 0);
  // Controlled unit state — syncs when pricelist item auto-fills unit
  const [localUnit, setLocalUnit] = useState<string>(item.unit ?? '');

  const conceptRef = useRef<HTMLInputElement>(null);
  const dropdownPortalRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync concept from props when changed externally
  useEffect(() => {
    setConceptSearch(item.concept);
  }, [item.concept]);

  // Sync quantity when changed from outside (e.g. BOM re-export)
  useEffect(() => {
    setLocalQty(item.quantity);
  }, [item.quantity]);

  // Sync price whenever the linked pricelist item changes OR price changes from outside
  useEffect(() => {
    setLocalPrice(item.price ?? 0);
  }, [item.price_list_item_id, item.price]);

  // Sync unit whenever the linked pricelist item auto-fills it
  useEffect(() => {
    setLocalUnit(item.unit ?? '');
  }, [item.price_list_item_id, item.unit]);

  // Recompute dropdown position
  function updateDropdownPosition() {
    if (conceptRef.current) {
      const rect = conceptRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: Math.max(rect.width, 280),
        zIndex: 9999,
      });
    }
  }

  // Open dropdown → set initial position
  useEffect(() => {
    if (showDropdown) updateDropdownPosition();
  }, [showDropdown]);

  // Reposition (not close) on scroll/resize
  useEffect(() => {
    if (!showDropdown) return;
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [showDropdown]);

  // Click-outside closes dropdown (checks both input and portal div)
  useEffect(() => {
    if (!showDropdown) return;
    function handleMouseDown(e: MouseEvent) {
      const inInput = conceptRef.current?.contains(e.target as Node) ?? false;
      const inDropdown = dropdownPortalRef.current?.contains(e.target as Node) ?? false;
      if (!inInput && !inDropdown) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
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
    // Always set price from pricelist; update local state immediately for controlled input
    setLocalPrice(price);
    const changes: Record<string, any> = {
      concept: pli.concept_description,
      price_list_item_id: pli.id,
      price,
    };
    if (!item.unit) changes.unit = pli.unit;
    handleImmediateUpdate(changes);
  }

  const filteredPLI = conceptSearch
    ? priceListItems
        .filter((p) => p.concept_description.toLowerCase().includes(conceptSearch.toLowerCase()))
        .slice(0, 10)
    : [];

  // Stock calculations
  const stockQty = item.price_list_item?.stock_quantity ?? 0;
  const hasLinkedItem = !!item.price_list_item_id;
  const toBuy = hasLinkedItem ? Math.max(0, item.quantity - stockQty) : null;

  const canConsume =
    item.status === 'In Warehouse' && !item.inventory_committed && !!item.price_list_item_id;

  // Price override indicator
  const linkedPLI = hasLinkedItem ? priceListItems.find((p) => p.id === item.price_list_item_id) : null;
  const listPrice = linkedPLI
    ? (linkedPLI.price_list_suppliers?.find((s) => s.is_primary)?.supplier_price ?? linkedPLI.price)
    : null;
  const isPriceOverridden = listPrice !== null && item.price !== null && Math.abs(item.price - listPrice) > 0.001;

  const dropdownPortal =
    showDropdown && filteredPLI.length > 0
      ? createPortal(
          <div ref={dropdownPortalRef} style={dropdownStyle} className="max-h-52 overflow-y-auto bg-surf-card rounded-lg border border-border-soft shadow-xl">
            {filteredPLI.map((pli) => (
              <button
                key={pli.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectPriceListItem(pli);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
              >
                <span className="flex-1 truncate pr-2">{pli.concept_description}</span>
                <span className="text-xs text-fg-400 flex-shrink-0">{pli.unit}</span>
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
      className="hover:bg-surf-app transition-colors group border-b border-border-soft"
    >
      {/* Drag handle */}
      <td className="w-8 px-1 py-2">
        <div className="cursor-grab text-fg-300 hover:text-fg-500 active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </div>
      </td>

      {/* Concept */}
      <td className="px-2 py-2 min-w-[200px]">
        <input
          ref={conceptRef}
          type="text"
          value={conceptSearch}
          onChange={(e) => handleConceptChange(e.target.value)}
          onFocus={() => conceptSearch && setShowDropdown(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowDropdown(false); }}
          className="w-full px-2 py-1.5 text-sm border border-transparent hover:border-border-soft focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-md outline-none transition bg-transparent"
          placeholder="Type to search items..."
        />
        {dropdownPortal}
      </td>

      {/* Qty */}
      <td className="px-2 py-2 w-[60px]">
        <input
          type="number"
          min="0.001"
          step="1"
          value={localQty}
          onChange={(e) => setLocalQty(parseFloat(e.target.value) || 1)}
          onBlur={() => handleFieldChange('quantity', localQty)}
          className="w-full px-1.5 py-1.5 text-sm text-right tabular-nums border border-transparent hover:border-border-soft focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-md outline-none transition bg-transparent"
        />
      </td>

      {/* In Stock */}
      <td className="px-2 py-2 w-[64px] text-center">
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
          <span className="text-fg-300">—</span>
        )}
      </td>

      {/* To Buy */}
      <td className="px-2 py-2 w-[64px] text-center">
        {hasLinkedItem ? (
          toBuy! > 0 ? (
            <span className="text-sm tabular-nums font-medium text-red-500">{toBuy}</span>
          ) : (
            <span className="text-sm text-green-600 font-medium">&#10003;</span>
          )
        ) : (
          <span className="text-fg-300">—</span>
        )}
      </td>

      {/* Unit */}
      <td className="px-2 py-2 w-[72px]">
        <input
          type="text"
          value={localUnit}
          onChange={(e) => setLocalUnit(e.target.value)}
          onBlur={() => handleFieldChange('unit', localUnit)}
          title={localUnit}
          className="w-full px-1.5 py-1.5 text-sm border border-transparent hover:border-border-soft focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-md outline-none transition bg-transparent"
        />
      </td>

      {/* Price — controlled input */}
      <td className="px-2 py-2 w-[96px]">
        <div className="relative flex items-center">
          <input
            type="number"
            min="0"
            step="0.01"
            value={localPrice}
            onChange={(e) => setLocalPrice(parseFloat(e.target.value) || 0)}
            onBlur={() => handleFieldChange('price', localPrice)}
            className="w-full px-1.5 py-1.5 text-sm text-right tabular-nums border border-transparent hover:border-border-soft focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-md outline-none transition bg-transparent"
          />
          {isPriceOverridden && (
            <span title={`Manually overridden (list price: ${formatCurrency(listPrice!)})`}>
              <AlertCircle className="absolute -right-0.5 -top-0.5 h-3 w-3 text-amber-400 pointer-events-none" />
            </span>
          )}
        </div>
      </td>

      {/* Subtotal */}
      <td className="px-2 py-2 w-[88px] text-right text-sm tabular-nums text-fg-700 font-medium">
        {formatCurrency(item.subtotal ?? item.quantity * (item.price ?? 0))}
      </td>

      {/* Priority */}
      <td className="px-2 py-2 w-[108px]">
        <div className="relative">
          <select
            value={item.priority ?? 'Medium'}
            onChange={(e) => handleImmediateUpdate({ priority: e.target.value })}
            className="w-full appearance-none pl-5 pr-2 py-1.5 text-xs font-medium border border-transparent hover:border-border-soft focus:border-blue-300 rounded-md outline-none transition bg-transparent cursor-pointer"
          >
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <span className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none ${PRIORITY_DOT[item.priority ?? 'Medium']}`} />
        </div>
      </td>

      {/* Status */}
      <td className="px-2 py-2 w-[124px]">
        <select
          value={item.status ?? 'Pending'}
          onChange={(e) => handleImmediateUpdate({ status: e.target.value })}
          className={`w-full appearance-none px-2 py-1.5 text-[11px] font-medium rounded-full cursor-pointer outline-none transition ${STATUS_STYLES[item.status ?? 'Pending']}`}
        >
          <option value="Ordered">Ordered</option>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="In Transit">In Transit</option>
          <option value="In Warehouse">In Warehouse</option>
          <option value="Delay">Delay</option>
          <option value="Return">Return</option>
        </select>
      </td>

      {/* Deadline */}
      <td className="px-2 py-2 w-[110px]">
        <input
          type="date"
          defaultValue={item.deadline ?? ''}
          onChange={(e) => handleImmediateUpdate({ deadline: e.target.value || null })}
          className="w-full px-1 py-1.5 text-xs border border-transparent hover:border-border-soft focus:border-blue-300 rounded-md outline-none transition bg-transparent"
        />
      </td>

      {/* Actions */}
      <td className="px-2 py-2 w-[72px]">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onOpenDetail(item)}
            className="p-1.5 text-fg-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
            title="More info (assigned, provider, comments)"
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
                className="px-1.5 py-0.5 text-xs font-medium text-fg-500 bg-surf-app hover:bg-surf-muted rounded transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-fg-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
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
