import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { AutocompleteSelect } from './AutocompleteSelect';
import { formatCurrency } from '../lib/calculations';
import type { PriceListItem, AreaCountertop } from '../types';

interface CountertopFormProps {
  areaId: string;
  countertop: AreaCountertop | null;
  onClose: () => void;
}

const COUNTERTOP_TYPES = ['Quartz', 'Solid Surface', 'Plastic Laminate', 'Marble', 'Granite'];

export function CountertopForm({ areaId, countertop, onClose }: CountertopFormProps) {
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPriceListItemId, setSelectedPriceListItemId] = useState(
    countertop?.price_list_item_id || ''
  );
  const [quantity, setQuantity] = useState(countertop?.quantity || 1);
  const [notes, setNotes] = useState(countertop?.notes || '');

  useEffect(() => {
    loadPriceList();
  }, []);

  async function loadPriceList() {
    try {
      const { data, error } = await supabase
        .from('price_list')
        .select('*')
        .eq('is_active', true)
        .in('type', COUNTERTOP_TYPES)
        .order('concept_description');

      if (error) throw error;
      setPriceList(data || []);
    } catch (error) {
      console.error('Error loading countertop price list:', error);
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
      alert('Please select a countertop from the price list');
      return;
    }

    const countertopData: any = {
      area_id: areaId,
      price_list_item_id: selectedPriceListItemId,
      item_name: selectedPriceListItem.concept_description,
      quantity,
      unit_price: unitPrice,
      subtotal,
      notes: notes || null,
    };

    try {

      if (countertop) {
        const { error } = await supabase
          .from('area_countertops')
          .update(countertopData)
          .eq('id', countertop.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('area_countertops').insert(countertopData as any);

        if (error) throw error;
      }

      onClose();
    } catch (error) {
      console.error('Error saving countertop:', error);
      alert('Failed to save countertop');
    }
  }

  if (loading) {
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title={countertop ? 'Edit Countertop' : 'Add Countertop'}
        size="lg"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-fg-600">Loading countertop options...</div>
        </div>
      </Modal>
    );
  }

  if (priceList.length === 0) {
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title={countertop ? 'Edit Countertop' : 'Add Countertop'}
        size="lg"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-fg-600 mb-2">No countertops available in price list</div>
            <div className="text-sm text-fg-500">
              Please add countertop items (Quartz, Granite, Marble, Solid Surface, or Plastic Laminate) to the price list first.
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={countertop ? 'Edit Countertop' : 'Add Countertop'}
      size="lg"
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">
            Select Countertop from Price List
          </label>
          <AutocompleteSelect
            options={priceList.map((priceItem) => ({
              value: priceItem.id,
              label: `${priceItem.concept_description} - ${priceItem.type} (${formatCurrency(
                priceItem.price_with_tax || priceItem.price
              )})`,
            }))}
            value={selectedPriceListItemId}
            onChange={(value) => setSelectedPriceListItemId(value)}
            placeholder="Search countertops by type or description..."
            required
          />
        </div>

        {selectedPriceListItem && (
          <div className="bg-status-orange-bg border border-status-orange-brd p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-fg-600">Description:</span>
              <span className="font-medium text-right ml-2">{selectedPriceListItem.concept_description}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fg-600">Type:</span>
              <span className="font-medium text-status-orange-fg">{selectedPriceListItem.type}</span>
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
              <span className="font-medium text-status-orange-fg">{formatCurrency(unitPrice)}</span>
            </div>
          </div>
        )}

        <Input
          label="Quantity"
          type="number"
          min="0.01"
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
            placeholder="Optional notes about this countertop..."
            className="block w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            rows={3}
          />
        </div>

        {selectedPriceListItem && (
          <div className="bg-status-orange-bg border border-status-orange-brd rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-status-orange-fg font-medium">Subtotal</div>
                <div className="text-xs text-status-orange-fg">
                  {quantity} × {formatCurrency(unitPrice)}
                </div>
              </div>
              <div className="text-2xl font-bold text-status-orange-fg">{formatCurrency(subtotal)}</div>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t border-border-soft">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedPriceListItem}>
            {countertop ? 'Update Countertop' : 'Add Countertop'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
