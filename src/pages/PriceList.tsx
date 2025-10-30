import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { formatCurrency } from '../lib/calculations';
import type { PriceListItem, PriceListInsert } from '../types';

export function PriceList() {
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null);

  useEffect(() => {
    loadPriceList();
  }, []);

  useEffect(() => {
    let filtered = items;

    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.concept_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.sku_code && item.sku_code.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (typeFilter) {
      filtered = filtered.filter((item) => item.type === typeFilter);
    }

    setFilteredItems(filtered);
  }, [searchTerm, typeFilter, items]);

  async function loadPriceList() {
    try {
      const { data, error } = await supabase
        .from('price_list')
        .select('*')
        .eq('is_active', true)
        .order('type')
        .order('concept_description');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading price list:', error);
    } finally {
      setLoading(false);
    }
  }

  const uniqueTypes = Array.from(new Set(items.map((item) => item.type))).sort();

  function handleAddNew() {
    setEditingItem(null);
    setIsModalOpen(true);
  }

  function handleEdit(item: PriceListItem) {
    setEditingItem(item);
    setIsModalOpen(true);
  }

  async function handleDelete(item: PriceListItem) {
    if (!confirm(`Delete ${item.concept_description}?`)) return;

    try {
      const { error } = await supabase
        .from('price_list')
        .update({ is_active: false })
        .eq('id', item.id);

      if (error) throw error;
      loadPriceList();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingItem(null);
  }

  async function handleSaveItem(item: PriceListInsert) {
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('price_list')
          .update(item)
          .eq('id', editingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('price_list').insert([item]);

        if (error) throw error;
      }

      loadPriceList();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading price list...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Price List</h1>
          <p className="mt-2 text-slate-600">
            Manage materials, hardware, and pricing
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by description, type, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Material
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Dimensions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    No items found. Add your first price list item to get started.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {item.concept_description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {item.material || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {item.dimensions || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-slate-900">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(item)}
                        className="mr-2"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <PriceListFormModal
          item={editingItem}
          onSave={handleSaveItem}
          onClose={handleCloseModal}
          existingTypes={uniqueTypes}
        />
      )}
    </div>
  );
}

interface PriceListFormModalProps {
  item: PriceListItem | null;
  onSave: (item: PriceListInsert) => void;
  onClose: () => void;
  existingTypes: string[];
}

function PriceListFormModal({
  item,
  onSave,
  onClose,
  existingTypes,
}: PriceListFormModalProps) {
  const [formData, setFormData] = useState<PriceListInsert>({
    sku_code: item?.sku_code || '',
    concept_description: item?.concept_description || '',
    type: item?.type || '',
    material: item?.material || '',
    dimensions: item?.dimensions || '',
    unit: item?.unit || 'Sheet',
    price: item?.price || 0,
    sf_per_sheet: item?.sf_per_sheet || null,
  });

  const [useCustomType, setUseCustomType] = useState(
    !existingTypes.includes(item?.type || '')
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={item ? 'Edit Price List Item' : 'Add New Price List Item'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="SKU / Code (Optional)"
            value={formData.sku_code || ''}
            onChange={(e) => setFormData({ ...formData, sku_code: e.target.value })}
            placeholder="MEL-001"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Type
            </label>
            {useCustomType ? (
              <Input
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
                placeholder="Melamine, Edgeband, etc."
              />
            ) : (
              <select
                value={formData.type}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setUseCustomType(true);
                    setFormData({ ...formData, type: '' });
                  } else {
                    setFormData({ ...formData, type: e.target.value });
                  }
                }}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select type...</option>
                {existingTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
                <option value="__custom__">+ Add Custom Type</option>
              </select>
            )}
          </div>
        </div>

        <Input
          label="Concept / Description"
          value={formData.concept_description}
          onChange={(e) =>
            setFormData({ ...formData, concept_description: e.target.value })
          }
          required
          placeholder="Melamine Evita Plus TBD 15mm x 4ft x 8ft"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input
            label="Material (Optional)"
            value={formData.material || ''}
            onChange={(e) => setFormData({ ...formData, material: e.target.value })}
            placeholder="MDF, PVC, Wood"
          />

          <Input
            label="Dimensions"
            value={formData.dimensions || ''}
            onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
            placeholder="4ft x 8ft, 19x1mm"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Unit
            </label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="Sheet">Sheet</option>
              <option value="Meter">Meter</option>
              <option value="Piece">Piece</option>
              <option value="Roll">Roll</option>
              <option value="Box">Box</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Price (MXN)"
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) =>
              setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
            }
            required
          />

          <Input
            label="Square Feet Per Sheet (Optional)"
            type="number"
            step="0.01"
            value={formData.sf_per_sheet || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                sf_per_sheet: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            placeholder="Auto-calculated from dimensions"
          />
        </div>

        <p className="text-xs text-slate-500">
          For sheet materials, if Square Feet Per Sheet is not provided, it will be
          calculated from dimensions (e.g., "4ft x 8ft" = 32 sq ft)
        </p>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{item ? 'Update Item' : 'Add Item'}</Button>
        </div>
      </form>
    </Modal>
  );
}
