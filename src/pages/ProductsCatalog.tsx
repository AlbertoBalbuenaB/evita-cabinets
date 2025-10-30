import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import type { Product, ProductInsert } from '../types';

export function ProductsCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = products.filter(
        (p) =>
          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchTerm, products]);

  async function loadProducts() {
    try {
      const { data, error } = await supabase
        .from('products_catalog')
        .select('*')
        .eq('is_active', true)
        .order('sku');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleAddNew() {
    setEditingProduct(null);
    setIsModalOpen(true);
  }

  function handleEdit(product: Product) {
    setEditingProduct(product);
    setIsModalOpen(true);
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Delete product ${product.sku}?`)) return;

    try {
      const { error } = await supabase
        .from('products_catalog')
        .update({ is_active: false })
        .eq('id', product.id);

      if (error) throw error;
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingProduct(null);
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
        const { error } = await supabase
          .from('products_catalog')
          .insert([product]);

        if (error) throw error;
      }

      loadProducts();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product');
    }
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
            Manage your cabinet products and specifications
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="mb-6">
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
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Box SF
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Doors SF
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Total Edgeband (m)
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Has Drawers
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    No products found. Add your first product to get started.
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(product)}
                        className="mr-2"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product)}
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
        <ProductFormModal
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

interface ProductFormModalProps {
  product: Product | null;
  onSave: (product: ProductInsert) => void;
  onClose: () => void;
}

function ProductFormModal({ product, onSave, onClose }: ProductFormModalProps) {
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
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={product ? 'Edit Product' : 'Add New Product'}
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

        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Box Construction
          </h3>
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

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {product ? 'Update Product' : 'Add Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
