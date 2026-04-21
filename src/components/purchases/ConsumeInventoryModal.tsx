import { useState } from 'react';
import { AlertTriangle, Package } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { formatCurrency } from '../../lib/calculations';
import { supabase } from '../../lib/supabase';
import { useCurrentMember } from '../../lib/useCurrentMember';
import type { ProjectPurchaseItemWithDetails } from '../../types';

interface ConsumeInventoryModalProps {
  item: ProjectPurchaseItemWithDetails;
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConsumeInventoryModal({ item, projectName, onConfirm, onCancel }: ConsumeInventoryModalProps) {
  const { member } = useCurrentMember();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stockQty = item.price_list_item?.stock_quantity ?? 0;
  const unit = item.price_list_item?.unit ?? item.unit ?? '';
  const avgCost = item.price_list_item?.average_cost ?? 0;
  const exceedsStock = item.quantity > stockQty;

  async function handleConfirm() {
    if (!item.price_list_item_id) return;
    setSaving(true);
    setError(null);

    try {
      // 1. Insert inventory movement (OUT)
      const { error: movErr } = await supabase.from('inventory_movements').insert({
        price_list_item_id: item.price_list_item_id,
        movement_type: 'OUT',
        quantity: item.quantity,
        reference_type: 'PROJECT',
        reference_id: item.id,
        unit_cost: item.price,
        notes: `Consumed by project: ${projectName}`,
        created_by_member_id: member?.id ?? null,
      });
      if (movErr) throw movErr;

      // 2. Mark purchase item as inventory committed
      const { error: upErr } = await supabase
        .from('project_purchase_items')
        .update({ inventory_committed: true })
        .eq('id', item.id);
      if (upErr) throw upErr;

      onConfirm();
    } catch (err: any) {
      setError(err.message || 'Failed to consume inventory.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onCancel} title="Consume from Inventory" size="sm">
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200/60 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-fg-400">Item</span>
            <span className="text-fg-800 font-medium">{item.concept}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fg-400">Quantity to consume</span>
            <span className="text-fg-800 font-medium">{item.quantity} {unit}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fg-400">Current stock</span>
            <span className="text-fg-800 font-medium">{stockQty} {unit}</span>
          </div>
          {avgCost > 0 && (
            <div className="flex justify-between">
              <span className="text-fg-400">WAC</span>
              <span className="text-fg-800 font-medium">{formatCurrency(avgCost)}</span>
            </div>
          )}
        </div>

        {exceedsStock && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200/60">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              Quantity exceeds current stock ({stockQty} available). Stock will be set to 0.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={saving}>
            <Package className="h-4 w-4 mr-1.5" />
            {saving ? 'Processing...' : 'Confirm'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
