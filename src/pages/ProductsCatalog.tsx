import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Check, X, Archive, ArchiveRestore, Library } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { CollectionSelector } from '../components/CollectionSelector';
import { SafeEditModal } from '../components/SafeEditModal';
import { checkProductUsage } from '../lib/productUsageChecker';
import { getAllCollections, archiveProduct, restoreProduct } from '../lib/collectionManager';
import type { Product, ProductInsert } from '../types';
import type { ProductUsage } from '../lib/productUsageChecker';

export function ProductsCatalog() {
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
      let query = supabase
        .from('products_catalog')
        .select('*')
        .eq('is_active', true);

      if (!showArchived) {
        query = query.eq('status', 'active');
      }

      const { data, error } = await query.order('sku');

      if (error) throw error;
      setProducts(data || []);
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
          <h1 className="text-3xl font-bold text-slate-900">Products Catalog</h1>
          <p className="mt-2 text-slate-600">
            Manage your cabinet products and organize them into collections
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

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
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
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

interface ProductFormModalProps {
  product: Product | null;
  onSave: (product: ProductInsert) => void;
  onClose: () => void;
  safeEditMode?: boolean;
}

function ProductFormModal({ product, onSave, onClose, safeEditMode }: ProductFormModalProps) {
  const [formData, setFormData] = useState<ProductInsert>({
    sku: product?.sku || '',
    description: product?.description || '',
    box_sf: product?.box_sf || 0,
    box_edgeband: product?.box_edgeband || 0,
    box_edgeband_color: product?.box_edgeband_color || 0,
    doors_fronts_sf: product?.doors_fronts_sf || 0,
    doors_fronts_edgeband: product?.doors_fronts_edgeband || 0,
    total_edgeband: product?.total_edgeband || 0,
    has_drawers: product?.has_drawers || false,
    collection_name: product?.collection_name || 'Standard Catalog',
    status: product?.status || 'active',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={product ? (safeEditMode ? 'Edit Product (In Use)' : 'Edit Product') : 'Add New Product'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="SKU / Code"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            required
            placeholder="301-9x12x12"
            disabled={safeEditMode}
          />

          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_drawers}
                onChange={(e) =>
                  setFormData({ ...formData, has_drawers: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Has Drawers</span>
            </label>
          </div>
        </div>

        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          required
          placeholder="Wall Hung Cabinet | 1 Door"
        />

        <CollectionSelector
          value={formData.collection_name || 'Standard Catalog'}
          onChange={(collection) => setFormData({ ...formData, collection_name: collection })}
        />

        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Box Construction</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Box Square Feet"
              type="number"
              step="0.01"
              value={formData.box_sf}
              onChange={(e) =>
                setFormData({ ...formData, box_sf: parseFloat(e.target.value) || 0 })
              }
              required
            />
            <Input
              label="Box Edgeband (m)"
              type="number"
              step="0.01"
              value={formData.box_edgeband || 0}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  box_edgeband: parseFloat(e.target.value) || 0,
                })
              }
            />
            <Input
              label="Box Edgeband Color (m)"
              type="number"
              step="0.01"
              value={formData.box_edgeband_color || 0}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  box_edgeband_color: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Doors & Drawer Fronts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Doors & Fronts Square Feet"
              type="number"
              step="0.01"
              value={formData.doors_fronts_sf}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  doors_fronts_sf: parseFloat(e.target.value) || 0,
                })
              }
              required
            />
            <Input
              label="Doors Edgeband (m)"
              type="number"
              step="0.01"
              value={formData.doors_fronts_edgeband || 0}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  doors_fronts_edgeband: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <Input
            label="Total Edgeband (m)"
            type="number"
            step="0.01"
            value={formData.total_edgeband}
            onChange={(e) =>
              setFormData({
                ...formData,
                total_edgeband: parseFloat(e.target.value) || 0,
              })
            }
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            This is the total edgeband used for cost calculations
          </p>
        </div>

        {safeEditMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-900">
              <strong>Note:</strong> This product is in use. Changes will create a new version to
              protect historical data.
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {product ? (safeEditMode ? 'Continue to Version' : 'Update Product') : 'Add Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
