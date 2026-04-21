import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { AutocompleteSelect } from './AutocompleteSelect';
import { formatCurrency } from '../lib/calculations';
import type { PriceListItem, AreaItem } from '../types';

interface ItemFormProps {
  areaId: string;
  item: AreaItem | null;
  onClose: () => void;
}

export function ItemForm({ areaId, item, onClose }: ItemFormProps) {
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPriceListItemId, setSelectedPriceListItemId] = useState(
    item?.price_list_item_id || ''
  );
  const [quantity, setQuantity] = useState(item?.quantity || 1);
  const [notes, setNotes] = useState(item?.notes || '');

  useEffect(() => {
    loadPriceList();
  }, []);

  async function loadPriceList() {
    try {
      const { data, error } = await supabase
        .from('price_list')
        .select('*')
        .eq('is_active', true)
        .order('concept_description');

      if (error) throw error;
      setPriceList(data || []);
    } catch (error) {
      console.error('Error loading price list:', error);
    } finally {
      setLoading(false);
    }
  }

  const selectedPriceListItem = priceList.find((p) => p.id === selectedPriceListItemId);

  const unitPrice = selectedPriceListItem
    ? selectedPriceListItem.price_with_tax || selectedPriceListItem.price
    : 0;
  const subtotal = unitPrice * quantity;

  async function handleSave() {
    if (!selectedPriceListItem) {
      alert('Please select an item from the price list');
      return;
    }

    const itemData = {
      area_id: areaId,
      price_list_item_id: selectedPriceListItemId,
      item_name: selectedPriceListItem.concept_description,
      quantity,
      unit_price: unitPrice,
      subtotal,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (item) {
        const { error } = await supabase
          .from('area_items')
          .update(itemData)
          .eq('id', item.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('area_items').insert(itemData as any);

        if (error) throw error;
      }

      onClose();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item');
    }
  }

  if (loading || priceList.length === 0) {
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title={item ? 'Edit Item' : 'Add Item'}
        size="lg"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-fg-600">Loading price list...</div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={item ? 'Edit Item' : 'Add Item'}
      size="lg"
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">
            Select Item from Price List
          </label>
          <AutocompleteSelect
            options={priceList.map((priceItem) => ({
              value: priceItem.id,
              label: `${priceItem.concept_description} (${formatCurrency(
                priceItem.price_with_tax || priceItem.price
              )})`,
            }))}
            value={selectedPriceListItemId}
            onChange={(value) => setSelectedPriceListItemId(value)}
            placeholder="Search by concept or type..."
            required
          />
        </div>

        {selectedPriceListItem && (
          <div className="bg-surf-app p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-fg-600">Description:</span>
              <span className="font-medium text-right ml-2">{selectedPriceListItem.concept_description}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fg-600">Type:</span>
              <span className="font-medium">{selectedPriceListItem.type}</span>
            </div>
            {selectedPriceListItem.dimensions && (
              <div className="flex justify-between text-sm">
                <span className="text-fg-600">Dimensions:</span>
                <span className="font-medium">{selectedPriceListItem.dimensions}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-fg-600">Unit:</span>
              <span className="font-medium">{selectedPriceListItem.unit}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fg-600">Unit Price:</span>
              <span className="font-medium text-blue-600">{formatCurrency(unitPrice)}</span>
            </div>
          </div>
        )}

        <Input
          label="Quantity"
          type="number"
          min="1"
          step="0.01"
          value={quantity}
          onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this item..."
            className="block w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus"
            rows={3}
          />
        </div>

        {selectedPriceListItem && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-blue-800 font-medium">Subtotal</div>
                <div className="text-xs text-blue-600">
                  {quantity} × {formatCurrency(unitPrice)}
                </div>
              </div>
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(subtotal)}</div>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t border-border-soft">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedPriceListItem}>
            {item ? 'Update Item' : 'Add Item'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
