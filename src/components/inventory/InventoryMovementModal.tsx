import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input } from '../Input';
import { AutocompleteSelect } from '../AutocompleteSelect';
import { supabase } from '../../lib/supabase';
import { useCurrentMember } from '../../lib/useCurrentMember';

interface InventoryMovementModalProps {
  priceListItemId?: string;
  priceListItemName?: string;
  onClose: () => void;
  onSaved: () => void;
}

type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

interface FormState {
  itemId: string;
  movementType: MovementType;
  quantity: string;
  unitCost: string;
  notes: string;
}

const defaultForm: FormState = {
  itemId: '',
  movementType: 'IN',
  quantity: '',
  unitCost: '',
  notes: '',
};

export function InventoryMovementModal({
  priceListItemId,
  priceListItemName,
  onClose,
  onSaved,
}: InventoryMovementModalProps) {
  const { member } = useCurrentMember();
  const [form, setForm] = useState<FormState>({
    ...defaultForm,
    itemId: priceListItemId ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!priceListItemId) {
      loadItems();
    }
  }, [priceListItemId]);

  async function loadItems() {
    const { data } = await supabase
      .from('price_list')
      .select('id, concept_description')
      .eq('is_active', true)
      .order('concept_description');
    if (data) {
      setItems(data.map((i) => ({ value: i.id, label: i.concept_description })));
    }
  }

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const itemId = priceListItemId || form.itemId;
    if (!itemId) {
      setError('Please select an item.');
      return;
    }

    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }

    if (form.movementType === 'IN' && form.unitCost) {
      const cost = parseFloat(form.unitCost);
      if (isNaN(cost) || cost < 0) {
        setError('Unit cost must be a valid number.');
        return;
      }
    }

    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('inventory_movements').insert({
        price_list_item_id: itemId,
        movement_type: form.movementType,
        quantity: qty,
        unit_cost: form.movementType === 'IN' && form.unitCost ? parseFloat(form.unitCost) : null,
        notes: form.notes.trim() || null,
        created_by_member_id: member?.id ?? null,
      });
      if (insertError) throw insertError;
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save movement.');
    } finally {
      setSaving(false);
    }
  }

  const typeOptions: { value: MovementType; label: string; color: string }[] = [
    { value: 'IN', label: 'IN', color: 'bg-status-emerald-bg text-status-emerald-fg border-status-emerald-brd' },
    { value: 'OUT', label: 'OUT', color: 'bg-status-red-bg text-status-red-fg border-status-red-brd' },
    { value: 'ADJUSTMENT', label: 'ADJUSTMENT', color: 'bg-accent-tint-soft text-accent-text border-accent-tint-border' },
  ];

  return (
    <Modal isOpen onClose={onClose} title="Record Inventory Movement" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-status-red-bg border border-status-red-brd px-4 py-3 text-sm text-status-red-fg">
            {error}
          </div>
        )}

        {/* Item selection */}
        {priceListItemId ? (
          <div>
            <label className="block text-sm font-medium text-fg-700 mb-1">Item</label>
            <div className="px-3 py-2 bg-surf-app border border-border-soft rounded-lg text-sm text-fg-700">
              {priceListItemName || priceListItemId}
            </div>
          </div>
        ) : (
          <AutocompleteSelect
            label="Item"
            required
            options={items}
            value={form.itemId}
            onChange={(v) => set('itemId', v)}
            placeholder="Search items..."
          />
        )}

        {/* Movement type */}
        <div>
          <label className="block text-sm font-medium text-fg-700 mb-2">Movement Type</label>
          <div className="flex gap-2">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('movementType', opt.value)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.movementType === opt.value
                    ? opt.color + ' border-current'
                    : 'bg-surf-card text-fg-500 border-border-soft hover:bg-surf-app'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <Input
            label="Quantity"
            type="number"
            min="0.001"
            step="any"
            required
            value={form.quantity}
            onChange={(e) => set('quantity', e.target.value)}
            placeholder="0"
          />
          {form.movementType === 'ADJUSTMENT' && (
            <p className="mt-1 text-xs text-accent-text">
              This value will replace the current stock level.
            </p>
          )}
        </div>

        {/* Unit cost (IN only) */}
        {form.movementType === 'IN' && (
          <Input
            label="Unit Cost (MXN)"
            type="number"
            min="0"
            step="0.01"
            value={form.unitCost}
            onChange={(e) => set('unitCost', e.target.value)}
            placeholder="0.00"
          />
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border-soft bg-surf-card px-3 py-2 text-sm text-fg-800 placeholder:text-fg-400 focus:border-accent-tint-border focus:ring-2 focus:ring-blue-100 outline-none transition"
            placeholder="Optional notes..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Record Movement'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
