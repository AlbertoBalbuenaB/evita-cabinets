import { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Pencil as Edit2, Trash2, Check, X, Archive, ArchiveRestore, Library, Package, ToggleLeft, ToggleRight, Bookmark } from 'lucide-react';
import { ClosetCatalogForm } from '../components/ClosetCatalogForm';
import { ProductFormModal } from '../components/ProductFormModal';
import { supabase } from '../lib/supabase';
import { fetchAllProducts } from '../lib/fetchAllProducts';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { CollectionSelector } from '../components/CollectionSelector';
import { SafeEditModal } from '../components/SafeEditModal';
import { checkProductUsage } from '../lib/productUsageChecker';
import { getAllCollections, archiveProduct, restoreProduct } from '../lib/collectionManager';
import { Templates } from './Templates';
import type { Product, ProductInsert, ClosetCatalogItem } from '../types';
import type { ProductUsage } from '../lib/productUsageChecker';

export function ProductsCatalog() {
  const [activeTab, setActiveTab] = useState<'products' | 'closets' | 'templates'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [safeEditMode, setSafeEditMode] = useState(false);
  const [productUsage, setProductUsage] = useState<ProductUsage | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Partial<ProductInsert> | null>(null);

  useEffect(() => {
    loadProducts();
    loadCollections();
  }, [showArchived]);

  useEffect(() => {
    filterProducts();
  }, [searchTerm, products, selectedCollection]);

  async function loadProducts() {
    try {
      const data = await fetchAllProducts({ onlyActive: !showArchived });
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCollections() {
    try {
      const data = await getAllCollections();
      setCollections(data);
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  }

  function filterProducts() {
    let filtered = products;

    if (selectedCollection !== 'all') {
      filtered = filtered.filter((p) => p.collection_name === selectedCollection);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  }

  function handleAddNew() {
    setEditingProduct(null);
    setSafeEditMode(false);
    setIsModalOpen(true);
  }

  async function handleEdit(product: Product) {
    setEditingProduct(product);

    const usage = await checkProductUsage(product.sku);
    if (usage.usageCount > 0) {
      setProductUsage(usage);
      setSafeEditMode(true);
    } else {
      setSafeEditMode(false);
      setIsModalOpen(true);
    }
  }

  async function handleArchive(product: Product) {
    if (!confirm(`Archive product ${product.sku}? It will be hidden from new projects.`)) return;

    try {
      await archiveProduct(product.id);
      loadProducts();
      loadCollections();
    } catch (error) {
      console.error('Error archiving product:', error);
      alert('Failed to archive product');
    }
  }

  async function handleRestore(product: Product) {
    try {
      await restoreProduct(product.id);
      loadProducts();
      loadCollections();
    } catch (error) {
      console.error('Error restoring product:', error);
      alert('Failed to restore product');
    }
  }

  async function handleDelete(product: Product) {
    const usage = await checkProductUsage(product.sku);
    if (usage.usageCount > 0) {
      alert(
        `Cannot delete product ${product.sku}. It is used in ${usage.usageCount} cabinet(s) across ${usage.projectNames.length} project(s). Consider archiving it instead.`
      );
      return;
    }

    if (!confirm(`Permanently delete product ${product.sku}?`)) return;

    try {
      const { error } = await supabase
        .from('products_catalog')
        .update({ is_active: false })
        .eq('id', product.id);

      if (error) throw error;
      loadProducts();
      loadCollections();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingProduct(null);
    setSafeEditMode(false);
    setProductUsage(null);
    setPendingUpdates(null);
  }

  async function handleSaveProduct(product: ProductInsert) {
    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products_catalog')
          .update(product)
          .eq('id', editingProduct.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('products_catalog').insert([product]);

        if (error) throw error;
      }

      loadProducts();
      loadCollections();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product');
    }
  }

  function handleSafeEditRequest(updates: Partial<ProductInsert>) {
    setPendingUpdates(updates);
  }

  function handleSafeEditSuccess() {
    loadProducts();
    loadCollections();
    handleCloseModal();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading products...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Cabinets Catalog</h1>
          <p className="mt-2 text-slate-600">
            Manage cabinet products, closet library and reusable templates
          </p>
        </div>
        {activeTab === 'products' && (
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        )}
      </div>

      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <Library className="h-4 w-4" />
          Cabinet Catalog
        </button>
        <button
          onClick={() => setActiveTab('closets')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'closets' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <Package className="h-4 w-4" />
          Closet Library
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'templates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <Bookmark className="h-4 w-4" />
          Templates
        </button>
      </div>

      {activeTab === 'closets' && <ClosetLibraryTab />}

      {activeTab === 'templates' && <Templates embedded />}

      {activeTab === 'products' && <div>

      <div className="mb-6 space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Library className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Collections</option>
              {collections.map((collection) => (
                <option key={collection} value={collection}>
                  {collection}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center space-x-2 cursor-pointer px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <Archive className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Show Archived</span>
          </label>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by SKU or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Collection
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Box SF
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Doors SF
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Total EB (m)
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Drawers
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Labor Cost
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Boxes
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                  RTA Default
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-8 text-center text-slate-500">
                    No products found. {searchTerm ? 'Try a different search.' : 'Add your first product to get started.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {product.sku}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {product.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {product.collection_name || 'Standard Catalog'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-900">
                      {product.box_sf.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-900">
                      {product.doors_fronts_sf.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-900">
                      {product.total_edgeband.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {product.has_drawers ? (
                        <Check className="h-5 w-5 text-green-600 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {product.custom_labor_cost !== null && product.custom_labor_cost !== undefined ? (
                        <span className="text-slate-900">${product.custom_labor_cost.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-400">Global</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-slate-900">
                      {product.boxes_per_unit ?? 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {product.default_is_rta ? (
                        <Check className="h-5 w-5 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {product.status === 'archived' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          Archived
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(product)}
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {product.status === 'active' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(product)}
                          title="Archive"
                        >
                          <Archive className="h-4 w-4 text-amber-600" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(product)}
                          title="Restore"
                        >
                          <ArchiveRestore className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product)}
                        title="Delete"
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

      {isModalOpen && !safeEditMode && (
        <ProductFormModal
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={handleCloseModal}
        />
      )}

      {safeEditMode && editingProduct && productUsage && (
        <SafeEditWrapper
          product={editingProduct}
          usage={productUsage}
          onSave={handleSafeEditRequest}
          onSuccess={handleSafeEditSuccess}
          onClose={handleCloseModal}
          pendingUpdates={pendingUpdates}
        />
      )}
    </div>}
    </div>
  );
}

function ClosetLibraryTab() {
  const [closetItems, setClosetItems] = useState<ClosetCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLine, setFilterLine] = useState<'all' | 'Evita Plus' | 'Evita Premium'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClosetCatalogItem | null>(null);

  useEffect(() => {
    loadClosetItems();
  }, [showInactive]);

  async function loadClosetItems() {
    setLoading(true);
    try {
      let query = supabase.from('closet_catalog').select('*').order('evita_line').order('description').order('height_in').order('width_in');
      if (!showInactive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (error) throw error;
      setClosetItems((data || []) as ClosetCatalogItem[]);
    } catch (error) {
      console.error('Error loading closet catalog:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(item: ClosetCatalogItem) {
    const { error } = await supabase
      .from('closet_catalog')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    if (!error) {
      setClosetItems(prev => prev.map(ci => ci.id === item.id ? { ...ci, is_active: !ci.is_active } : ci));
    }
  }

  const filtered = useMemo(() => {
    let result = closetItems;
    if (filterLine !== 'all') result = result.filter(ci => ci.evita_line === filterLine);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(ci =>
        ci.description.toLowerCase().includes(q) ||
        ci.cabinet_code.toLowerCase().includes(q)
      );
    }
    return result;
  }, [closetItems, filterLine, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-slate-500">Loading closet catalog...</div>
      </div>
    );
  }

  function openAdd() {
    setEditingItem(null);
    setFormOpen(true);
  }

  function openEdit(item: ClosetCatalogItem) {
    setEditingItem(item);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingItem(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">{filtered.length} items</div>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Cabinet
        </Button>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by description or code..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={filterLine}
          onChange={e => setFilterLine(e.target.value as any)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
        >
          <option value="all">All Lines</option>
          <option value="Evita Plus">Evita Plus</option>
          <option value="Evita Premium">Evita Premium</option>
        </select>
        <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-sm">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-4 h-4 text-teal-600 border-slate-300 rounded" />
          <span className="text-slate-700">Show Inactive</span>
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-teal-50 border-b border-teal-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-teal-900">Code</th>
              <th className="text-left px-4 py-3 font-semibold text-teal-900">Line</th>
              <th className="text-left px-4 py-3 font-semibold text-teal-900">Description</th>
              <th className="text-right px-4 py-3 font-semibold text-teal-900">W"</th>
              <th className="text-right px-4 py-3 font-semibold text-teal-900">H"</th>
              <th className="text-right px-4 py-3 font-semibold text-teal-900">D"</th>
              <th className="text-right px-4 py-3 font-semibold text-teal-900">Price w/ Backs</th>
              <th className="text-right px-4 py-3 font-semibold text-teal-900">Price w/o Backs</th>
              <th className="text-right px-4 py-3 font-semibold text-teal-900">Boxes</th>
              <th className="text-center px-4 py-3 font-semibold text-teal-900">Active</th>
              <th className="text-center px-4 py-3 font-semibold text-teal-900">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-10 text-slate-400">No items found</td>
              </tr>
            ) : (
              filtered.map(item => (
                <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{item.cabinet_code}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${item.evita_line === 'Evita Premium' ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'}`}>
                      {item.evita_line}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-900">{item.description}</td>
                  <td className="px-4 py-2 text-right text-slate-700">{item.width_in}"</td>
                  <td className="px-4 py-2 text-right text-slate-700">{item.height_in}"</td>
                  <td className="px-4 py-2 text-right text-slate-700">{item.depth_in}"</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900">
                    {item.price_with_backs_usd != null ? `$${item.price_with_backs_usd.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900">
                    {item.price_without_backs_usd != null ? `$${item.price_without_backs_usd.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700">{item.boxes_count}</td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => toggleActive(item)} className="text-slate-400 hover:text-teal-600 transition-colors" title={item.is_active ? 'Deactivate' : 'Activate'}>
                      {item.is_active ? <ToggleRight className="h-5 w-5 text-teal-600" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => openEdit(item)} className="text-slate-400 hover:text-teal-700 transition-colors" title="Edit">
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <ClosetCatalogForm
          item={editingItem}
          onClose={closeForm}
          onSaved={() => { closeForm(); loadClosetItems(); }}
        />
      )}
    </div>
  );
}

interface SafeEditWrapperProps {
  product: Product;
  usage: ProductUsage;
  onSave: (updates: Partial<ProductInsert>) => void;
  onSuccess: () => void;
  onClose: () => void;
  pendingUpdates: Partial<ProductInsert> | null;
}

function SafeEditWrapper({
  product,
  usage,
  onSave,
  onSuccess,
  onClose,
  pendingUpdates,
}: SafeEditWrapperProps) {
  const [showForm, setShowForm] = useState(!pendingUpdates);

  function handleFormSave(updates: Partial<ProductInsert>) {
    onSave(updates);
    setShowForm(false);
  }

  if (showForm) {
    return (
      <ProductFormModal
        product={product}
        onSave={handleFormSave}
        onClose={onClose}
        safeEditMode={true}
      />
    );
  }

  if (pendingUpdates) {
    return (
      <SafeEditModal
        product={product}
        usage={usage}
        updates={pendingUpdates}
        onSuccess={onSuccess}
        onCancel={onClose}
      />
    );
  }

  return null;
}
