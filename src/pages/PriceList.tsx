import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Pencil as Edit2, Trash2, Copy, ChevronsUpDown, ChevronUp, ChevronDown,
  LayoutList, LayoutGrid, ImageOff, ExternalLink, Calendar, Tag
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { AutocompleteSelect } from '../components/AutocompleteSelect';
import { formatCurrency } from '../lib/calculations';
import type { PriceListItem, PriceListInsert } from '../types';

type SortField = 'concept_description' | 'type' | 'unit' | 'price' | 'price_last_updated_at';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'card';

export function PriceList() {
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('price_last_updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    loadPriceList();
  }, []);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && items.length > 0) {
      const item = items.find(i => i.id === editId);
      if (item) {
        handleEdit(item);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, items]);

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

    filtered = [...filtered].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      if (sortField === 'price') {
        aVal = a.price;
        bVal = b.price;
      } else if (sortField === 'price_last_updated_at') {
        aVal = new Date(a.price_last_updated_at).getTime();
        bVal = new Date(b.price_last_updated_at).getTime();
      } else {
        aVal = (a[sortField] ?? '').toString().toLowerCase();
        bVal = (b[sortField] ?? '').toString().toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredItems(filtered);
  }, [searchTerm, typeFilter, sortField, sortDirection, items]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  async function loadPriceList() {
    try {
      const { data, error } = await supabase
        .from('price_list')
        .select('*')
        .eq('is_active', true);

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

  function handleOpenDetail(item: PriceListItem) {
    navigate(`/prices/${item.id}`);
  }

  async function handleDelete(item: PriceListItem) {
    if (!confirm(`Delete ${item.concept_description}?`)) return;

    try {
      const { error } = await supabase
        .from('price_list')
        .update({ is_active: false })
        .eq('id', item.id);

      if (error) {
        console.error('Supabase error:', error);
        alert(`Failed to delete item: ${error.message}`);
        return;
      }

      loadPriceList();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert(`Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleDuplicate(item: PriceListItem) {
    try {
      const newItem: PriceListInsert = {
        sku_code: item.sku_code ? `${item.sku_code}-copy` : '',
        concept_description: `${item.concept_description} (Copy)`,
        type: item.type,
        material: item.material,
        dimensions: item.dimensions,
        unit: item.unit,
        price: item.price,
        sf_per_sheet: item.sf_per_sheet,
        product_url: item.product_url,
        image_url: item.image_url,
        notes: item.notes,
      };

      const { error } = await supabase
        .from('price_list')
        .insert(newItem);

      if (error) throw error;
      loadPriceList();
    } catch (error) {
      console.error('Error duplicating item:', error);
      alert('Failed to duplicate item');
    }
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingItem(null);
  }

  async function handleSaveItem(item: PriceListInsert) {
    try {
      if (editingItem) {
        const updateData = {
          sku_code: item.sku_code,
          concept_description: item.concept_description,
          type: item.type,
          material: item.material,
          dimensions: item.dimensions,
          unit: item.unit,
          price: item.price,
          base_price: item.price,
          price_with_tax: editingItem.tax_rate && editingItem.tax_rate > 0
            ? parseFloat((item.price * (1 + editingItem.tax_rate / 100)).toFixed(2))
            : item.price,
          price_last_updated_at: new Date().toISOString(),
          sf_per_sheet: item.sf_per_sheet,
          product_url: item.product_url || null,
          image_url: item.image_url || null,
          notes: item.notes || null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('price_list')
          .update(updateData)
          .eq('id', editingItem.id);

        if (error) throw error;

      } else {
        const { error } = await supabase.from('price_list').insert([item]);
        if (error) throw error;
      }

      loadPriceList();
      handleCloseModal();
    } catch (error: any) {
      console.error('Error saving item:', error);
      alert(`Failed to save item: ${error.message || 'Unknown error'}`);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 page-enter">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-2">
            <div className="h-8 w-40 skeleton-shimmer" />
            <div className="h-4 w-64 skeleton-shimmer" />
          </div>
          <div className="h-10 w-28 skeleton-shimmer" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1 h-11 skeleton-shimmer" />
          <div className="h-11 w-40 skeleton-shimmer" />
          <div className="h-11 w-24 skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-48 skeleton-shimmer" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hero-enter">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Price List</h1>
          <p className="mt-1 text-slate-500 text-sm">
            {items.length} item{items.length !== 1 ? 's' : ''} &middot; Manage materials, hardware, and pricing
          </p>
        </div>
        <Button onClick={handleAddNew} className="self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      <div className="mb-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by description, type, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2.5 w-full text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 shadow-sm"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-slate-700 min-w-[160px]"
        >
          <option value="">All Types</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            title="List view"
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            title="Card view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-20 px-6">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Search className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-slate-700 font-medium mb-1">No items found</p>
          <p className="text-sm text-slate-400 text-center max-w-xs">
            {searchTerm || typeFilter
              ? 'Try adjusting your search or filters.'
              : 'Add your first price list item to get started.'}
          </p>
          {!searchTerm && !typeFilter && (
            <button
              onClick={handleAddNew}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <ListView
          items={filteredItems}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onOpenDetail={handleOpenDetail}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      ) : (
        <CardView
          items={filteredItems}
          onOpenDetail={handleOpenDetail}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      )}

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

interface SortableHeaderProps {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  align?: 'left' | 'right';
}

function SortableHeader({ field, label, sortField, sortDirection, onSort, align = 'left' }: SortableHeaderProps) {
  const isActive = sortField === field;

  const Icon = isActive
    ? sortDirection === 'asc'
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;

  return (
    <th
      className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group transition-colors hover:bg-slate-100 ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(field)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''} ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
        {label}
        <Icon className={`h-3.5 w-3.5 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
      </span>
    </th>
  );
}

interface ViewProps {
  items: PriceListItem[];
  onOpenDetail: (item: PriceListItem) => void;
  onEdit: (item: PriceListItem) => void;
  onDuplicate: (item: PriceListItem) => void;
  onDelete: (item: PriceListItem) => void;
}

interface ListViewProps extends ViewProps {
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

function ListView({ items, sortField, sortDirection, onSort, onOpenDetail, onEdit, onDuplicate, onDelete }: ListViewProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3.5 text-left w-10" />
              <SortableHeader field="concept_description" label="Description" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader field="type" label="Type" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Material</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Dimensions</th>
              <SortableHeader field="unit" label="Unit" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <SortableHeader field="price" label="Price" sortField={sortField} sortDirection={sortDirection} onSort={onSort} align="right" />
              <SortableHeader field="price_last_updated_at" label="Updated" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                onClick={() => onOpenDetail(item)}
              >
                <td className="pl-5 py-3" onClick={(e) => e.stopPropagation()}>
                  {item.image_url ? (
                    <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0">
                      <img
                        src={item.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <ImageOff className="h-3.5 w-3.5 text-slate-300" />
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5 text-sm font-medium text-slate-900 max-w-xs">
                  <span className="line-clamp-2 leading-snug">{item.concept_description}</span>
                  {item.sku_code && (
                    <span className="block text-xs text-slate-400 font-mono mt-0.5">{item.sku_code}</span>
                  )}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-sm">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {item.type}
                  </span>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-500">
                  {item.material || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-500">
                  {item.dimensions || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-600">
                  {item.unit}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-right font-semibold text-slate-900">
                  {formatCurrency(item.price)}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-400">
                  {new Date(item.price_last_updated_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ActionButton onClick={() => onEdit(item)} title="Edit" className="hover:text-blue-600 hover:bg-blue-50">
                      <Edit2 className="h-3.5 w-3.5" />
                    </ActionButton>
                    <ActionButton onClick={() => onDuplicate(item)} title="Duplicate" className="hover:text-blue-600 hover:bg-blue-50">
                      <Copy className="h-3.5 w-3.5" />
                    </ActionButton>
                    <ActionButton onClick={() => onDelete(item)} title="Delete" className="hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </ActionButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardView({ items, onOpenDetail, onEdit, onDuplicate, onDelete }: ViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((item, idx) => (
        <div
          key={item.id}
          className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer group hover:shadow-lg hover:border-blue-300/60 hover:-translate-y-0.5 transition-all duration-200 card-enter stagger-${Math.min(idx + 1, 12)}`}
          onClick={() => onOpenDetail(item)}
        >
          <div className="relative h-40 bg-slate-50 overflow-hidden">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.concept_description}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span class="text-xs text-slate-400">Image unavailable</span></div>`;
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <ImageOff className="h-8 w-8 text-slate-300" />
                <span className="text-xs text-slate-400">No image</span>
              </div>
            )}

            <div className="absolute top-2 left-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-white/90 backdrop-blur-sm text-blue-700 border border-blue-100 shadow-sm">
                <Tag className="h-2.5 w-2.5" />
                {item.type}
              </span>
            </div>

            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onEdit(item)}
                className="p-1.5 rounded-lg bg-white/90 backdrop-blur-sm text-slate-600 hover:text-blue-600 hover:bg-white shadow-sm transition-colors"
                title="Edit"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDuplicate(item)}
                className="p-1.5 rounded-lg bg-white/90 backdrop-blur-sm text-slate-600 hover:text-blue-600 hover:bg-white shadow-sm transition-colors"
                title="Duplicate"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(item)}
                className="p-1.5 rounded-lg bg-white/90 backdrop-blur-sm text-slate-600 hover:text-red-600 hover:bg-white shadow-sm transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="p-4">
            <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug mb-0.5">
              {item.concept_description}
            </p>
            {item.sku_code && (
              <p className="text-xs text-slate-400 font-mono mb-2">{item.sku_code}</p>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <div>
                <p className="text-base font-bold text-slate-900">{formatCurrency(item.price)}</p>
                <p className="text-xs text-slate-400">per {item.unit}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-slate-400 justify-end">
                  <Calendar className="h-3 w-3" />
                  {new Date(item.price_last_updated_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                {item.product_url && (
                  <a
                    href={item.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700 mt-1 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Link
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionButton({ onClick, title, className, children }: {
  onClick: () => void;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md text-slate-400 transition-colors ${className}`}
    >
      {children}
    </button>
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
    product_url: item?.product_url || '',
    image_url: item?.image_url || '',
    notes: item?.notes || '',
  });

  const [imageError, setImageError] = useState(false);
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [customUnits, setCustomUnits] = useState<string[]>([]);

  useEffect(() => {
    loadCustomOptions();
  }, []);

  useEffect(() => {
    setImageError(false);
  }, [formData.image_url]);

  async function loadCustomOptions() {
    try {
      const [typesRes, unitsRes] = await Promise.all([
        supabase.from('custom_types').select('type_name').order('type_name'),
        supabase.from('custom_units').select('unit_name').order('unit_name'),
      ]);

      if (typesRes.data) setCustomTypes(typesRes.data.map(t => t.type_name));
      if (unitsRes.data) setCustomUnits(unitsRes.data.map(u => u.unit_name));
    } catch (error) {
      console.error('Error loading custom options:', error);
    }
  }

  async function handleCreateType(typeName: string) {
    try {
      const { error } = await supabase
        .from('custom_types')
        .insert([{ type_name: typeName }]);

      if (error) throw error;
      setCustomTypes(prev => [...prev, typeName].sort());
    } catch (error) {
      console.error('Error creating type:', error);
      alert('Failed to create type');
    }
  }

  async function handleCreateUnit(unitName: string) {
    try {
      const { error } = await supabase
        .from('custom_units')
        .insert([{ unit_name: unitName }]);

      if (error) throw error;
      setCustomUnits(prev => [...prev, unitName].sort());
    } catch (error) {
      console.error('Error creating unit:', error);
      alert('Failed to create unit');
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(formData);
  }

  const showImagePreview = !!(formData.image_url && formData.image_url.trim() && !imageError);

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

          <AutocompleteSelect
            label="Type"
            required
            value={formData.type}
            onChange={(value) => setFormData({ ...formData, type: value })}
            options={customTypes.map(type => ({ value: type, label: type }))}
            placeholder="Melamine, Edgeband, etc."
            allowCreate={true}
            onCreateOption={handleCreateType}
          />
        </div>

        <Input
          label="Concept / Description"
          value={formData.concept_description}
          onChange={(e) => setFormData({ ...formData, concept_description: e.target.value })}
          required
          placeholder="Melamine Evita Plus TBD 15mm x 4ft x 8ft"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Product URL (Optional)"
            type="url"
            value={formData.product_url || ''}
            onChange={(e) => setFormData({ ...formData, product_url: e.target.value || null })}
            placeholder="https://supplier.com/product-page"
          />

          <div>
            <Input
              label="Image Reference URL (Optional)"
              type="url"
              value={formData.image_url || ''}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value || null })}
              placeholder="https://example.com/image.jpg"
            />
            {showImagePreview && (
              <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-28 relative">
                <img
                  src={formData.image_url!}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
                <div className="absolute bottom-1 right-1">
                  <span className="text-xs px-1.5 py-0.5 bg-black/50 text-white rounded backdrop-blur-sm">Preview</span>
                </div>
              </div>
            )}
            {imageError && formData.image_url && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <ImageOff className="h-3 w-3" />
                Image could not be loaded
              </p>
            )}
          </div>
        </div>

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

          <AutocompleteSelect
            label="Unit"
            required
            value={formData.unit}
            onChange={(value) => setFormData({ ...formData, unit: value })}
            options={customUnits.map(unit => ({ value: unit, label: unit }))}
            placeholder="Sheet, Meter, Piece..."
            allowCreate={true}
            onCreateOption={handleCreateUnit}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Price (MXN)"
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
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

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Notes / Observations <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
            rows={3}
            placeholder="Add any relevant notes, observations, or supplier details..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{item ? 'Update Item' : 'Add Item'}</Button>
        </div>
      </form>
    </Modal>
  );
}
