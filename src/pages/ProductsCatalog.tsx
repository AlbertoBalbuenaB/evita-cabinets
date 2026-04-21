import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Pencil as Edit2, Trash2, Check, X, Archive, ArchiveRestore, Library, Package, ToggleLeft, ToggleRight, LayoutList, LayoutGrid, Layers, Box, Upload } from 'lucide-react';
import { ClosetCatalogForm } from '../components/ClosetCatalogForm';
import { PrefabCatalogForm } from '../components/PrefabCatalogForm';
import { Modal } from '../components/Modal';
import { ProductFormModal } from '../components/ProductFormModal';
import { supabase } from '../lib/supabase';
import { fetchAllProducts } from '../lib/fetchAllProducts';
import { Button } from '../components/Button';
import { SafeEditModal } from '../components/SafeEditModal';
import { checkProductUsage } from '../lib/productUsageChecker';
import { getAllCollections, archiveProduct, restoreProduct } from '../lib/collectionManager';
import { Templates } from './Templates';
import { importPrefabPriceList, type PrefabImportReport } from '../lib/prefabImport';
import { useSettingsStore } from '../lib/settingsStore';
import type { Product, ProductInsert, ClosetCatalogItem, PrefabCatalogItem, PrefabBrand, PrefabCatalogPrice } from '../types';
import type { ProductUsage } from '../lib/productUsageChecker';
import { usePageChrome } from '../contexts/PageChromeContext';

export function ProductsCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'products' | 'closets' | 'prefab' | 'templates'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');
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

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && products.length > 0) {
      const product = products.find(p => p.id === editId);
      if (product) {
        handleEdit(product);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, products]);

  // Deep-link from evita-ia prefab links: ?tab=prefab&prefabId=UUID
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'prefab' || tab === 'closets' || tab === 'templates' || tab === 'products') {
      setActiveTab(tab);
    }
  }, [searchParams]);

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

  usePageChrome(
    {
      title: 'Cabinets',
      crumbs: [{ label: 'Cabinets' }],
      tabs: [
        { id: 'products', label: 'Cabinet Catalog', count: products.length, onClick: () => setActiveTab('products') },
        { id: 'closets', label: 'Closet Library', onClick: () => setActiveTab('closets') },
        { id: 'prefab', label: 'Prefab Library', onClick: () => setActiveTab('prefab') },
        { id: 'templates', label: 'Templates', onClick: () => setActiveTab('templates') },
      ],
      activeTabId: activeTab,
      primaryAction:
        activeTab === 'products'
          ? { label: 'New Cabinet', icon: Plus, onClick: handleAddNew }
          : undefined,
    },
    [activeTab, products.length],
  );

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
      <div className="space-y-6 page-enter">
        <div className="space-y-2 mb-6">
          <div className="h-8 w-56 skeleton-shimmer" />
          <div className="h-4 w-80 skeleton-shimmer" />
        </div>
        <div className="flex border-b border-border-soft mb-6 gap-1">
          {[1,2,3].map(i => <div key={i} className="h-10 w-32 skeleton-shimmer" style={{ borderRadius: '8px' }} />)}
        </div>
        <div className="glass-white h-14 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="glass-white h-52 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="page-enter">
      <div className="mb-6 hero-enter">
        <h1 className="text-3xl font-bold text-fg-900">Cabinets Catalog</h1>
        <p className="mt-2 text-fg-600">
          Manage cabinet products, closet library and reusable templates
        </p>
      </div>

      {activeTab === 'closets' && <ClosetLibraryTab />}

      {activeTab === 'prefab' && <PrefabLibraryTab />}

      {activeTab === 'templates' && <Templates embedded />}

      {activeTab === 'products' && <div>

      {/* Filter bar */}
      <div className="glass-white p-4 mb-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-fg-400" />
            <input
              type="text"
              placeholder="Search by SKU or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full px-4 py-2 text-sm border border-border-soft rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus bg-surf-card"
            />
          </div>
          <div className="relative">
            <Library className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-fg-400 pointer-events-none" />
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="pl-9 pr-8 py-2 text-sm border border-border-soft rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus bg-surf-card appearance-none"
            >
              <option value="all">All Collections</option>
              {collections.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-border-soft rounded-lg hover:bg-surf-app text-sm">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="w-3.5 h-3.5 text-blue-600 border-border-solid rounded" />
            <Archive className="h-3.5 w-3.5 text-fg-500" />
            <span className="text-fg-600">Archived</span>
          </label>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-fg-400 hidden sm:inline">{filteredProducts.length} items</span>
            <div className="flex p-1 bg-surf-muted rounded-lg">
              <button onClick={() => setViewMode('card')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-surf-card text-blue-600 shadow-sm' : 'text-fg-400 hover:text-fg-600'}`}><LayoutGrid className="h-4 w-4" /></button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-surf-card text-blue-600 shadow-sm' : 'text-fg-400 hover:text-fg-600'}`}><LayoutList className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Products display */}
      {filteredProducts.length === 0 ? (
        <div className="glass-white p-12 text-center">
          <Package className="h-12 w-12 text-fg-300 mx-auto mb-3" />
          <p className="text-fg-500">{searchTerm ? 'No products found. Try a different search.' : 'Add your first product to get started.'}</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product, idx) => (
            <div
              key={product.id}
              onClick={() => navigate(`/products/${product.id}`)}
              className={`glass-white p-0 overflow-hidden cursor-pointer group hover:shadow-lg hover:border-blue-300/60 hover:-translate-y-0.5 transition-all duration-200 card-enter stagger-${Math.min(idx + 1, 12)}`}
            >
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{product.sku}</span>
                  {product.status === 'archived' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surf-muted text-fg-500">Archived</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">Active</span>
                  )}
                </div>
                <p className="text-sm font-medium text-fg-800 line-clamp-2 mb-2 min-h-[2.5rem]">{product.description}</p>
                <span className="text-xs text-fg-400">{product.collection_name || 'Standard Catalog'}</span>
              </div>
              <div className="px-4 py-3 bg-surf-app border-t border-border-soft">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm font-semibold text-fg-800 tabular-nums">{product.box_sf.toFixed(1)}</div>
                    <div className="text-[10px] text-fg-400 uppercase">Box SF</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-fg-800 tabular-nums">{product.doors_fronts_sf.toFixed(1)}</div>
                    <div className="text-[10px] text-fg-400 uppercase">Doors SF</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-fg-800 tabular-nums">{product.total_edgeband.toFixed(1)}</div>
                    <div className="text-[10px] text-fg-400 uppercase">EB (m)</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-soft">
                  <div className="flex items-center gap-2 text-xs text-fg-500">
                    {product.has_drawers && <span className="flex items-center gap-0.5"><Layers className="h-3 w-3 text-amber-500" /> Drawers</span>}
                    <span className="flex items-center gap-0.5"><Box className="h-3 w-3" /> {product.boxes_per_unit ?? 1} box</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(product); }} className="p-1 rounded hover:bg-surf-card text-fg-400 hover:text-blue-600"><Edit2 className="h-3.5 w-3.5" /></button>
                    {product.status === 'active' ? (
                      <button onClick={(e) => { e.stopPropagation(); handleArchive(product); }} className="p-1 rounded hover:bg-surf-card text-fg-400 hover:text-amber-600"><Archive className="h-3.5 w-3.5" /></button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); handleRestore(product); }} className="p-1 rounded hover:bg-surf-card text-fg-400 hover:text-green-600"><ArchiveRestore className="h-3.5 w-3.5" /></button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(product); }} className="p-1 rounded hover:bg-surf-card text-fg-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-soft">
              <thead>
                <tr className="bg-surf-app">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-fg-500 uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-fg-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-fg-500 uppercase tracking-wider hidden md:table-cell">Collection</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-fg-500 uppercase tracking-wider">Box SF</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-fg-500 uppercase tracking-wider">Doors SF</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-fg-500 uppercase tracking-wider hidden lg:table-cell">Drawers</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-fg-500 uppercase tracking-wider hidden lg:table-cell">Boxes</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-fg-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-fg-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} onClick={() => navigate(`/products/${product.id}`)} className="hover:bg-blue-50/40 cursor-pointer transition-colors group">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-blue-700">{product.sku}</td>
                    <td className="px-4 py-3 text-sm text-fg-700 max-w-xs truncate">{product.description}</td>
                    <td className="px-4 py-3 hidden md:table-cell"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{product.collection_name || 'Standard'}</span></td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-fg-800">{product.box_sf.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-fg-800">{product.doors_fronts_sf.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">{product.has_drawers ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-fg-300 mx-auto" />}</td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell text-sm text-fg-700">{product.boxes_per_unit ?? 1}</td>
                    <td className="px-4 py-3 text-center">{product.status === 'archived' ? <span className="text-xs px-2 py-0.5 rounded-full bg-surf-muted text-fg-500">Archived</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">Active</span>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(product); }} className="p-1.5 rounded-md hover:bg-surf-card text-fg-400 hover:text-blue-600"><Edit2 className="h-3.5 w-3.5" /></button>
                        {product.status === 'active' ? (
                          <button onClick={(e) => { e.stopPropagation(); handleArchive(product); }} className="p-1.5 rounded-md hover:bg-surf-card text-fg-400 hover:text-amber-600"><Archive className="h-3.5 w-3.5" /></button>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleRestore(product); }} className="p-1.5 rounded-md hover:bg-surf-card text-fg-400 hover:text-green-600"><ArchiveRestore className="h-3.5 w-3.5" /></button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(product); }} className="p-1.5 rounded-md hover:bg-surf-card text-fg-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>}
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
    </>
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
      <div className="space-y-4 page-enter">
        <div className="glass-white h-14 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-40 skeleton-shimmer" />)}
        </div>
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
        <div className="text-xs text-fg-500">{filtered.length} items</div>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Cabinet
        </Button>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by description or code..."
            className="w-full pl-9 pr-4 py-2 border border-border-solid rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={filterLine}
          onChange={e => setFilterLine(e.target.value as any)}
          className="px-3 py-2 border border-border-solid rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-surf-card"
        >
          <option value="all">All Lines</option>
          <option value="Evita Plus">Evita Plus</option>
          <option value="Evita Premium">Evita Premium</option>
        </select>
        <label className="flex items-center gap-2 px-3 py-2 border border-border-solid rounded-lg cursor-pointer hover:bg-surf-app text-sm">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-4 h-4 text-teal-600 border-border-solid rounded" />
          <span className="text-fg-700">Show Inactive</span>
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-soft">
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
                <td colSpan={11} className="text-center py-10 text-fg-400">No items found</td>
              </tr>
            ) : (
              filtered.map(item => (
                <tr key={item.id} className={`hover:bg-surf-app transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2 font-mono text-xs text-fg-600">{item.cabinet_code}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${item.evita_line === 'Evita Premium' ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'}`}>
                      {item.evita_line}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-fg-900">{item.description}</td>
                  <td className="px-4 py-2 text-right text-fg-700">{item.width_in}"</td>
                  <td className="px-4 py-2 text-right text-fg-700">{item.height_in}"</td>
                  <td className="px-4 py-2 text-right text-fg-700">{item.depth_in}"</td>
                  <td className="px-4 py-2 text-right font-medium text-fg-900">
                    {item.price_with_backs_usd != null ? `$${item.price_with_backs_usd.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-fg-900">
                    {item.price_without_backs_usd != null ? `$${item.price_without_backs_usd.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-fg-700">{item.boxes_count}</td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => toggleActive(item)} className="text-fg-400 hover:text-teal-600 transition-colors" title={item.is_active ? 'Deactivate' : 'Activate'}>
                      {item.is_active ? <ToggleRight className="h-5 w-5 text-teal-600" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => openEdit(item)} className="text-fg-400 hover:text-teal-700 transition-colors" title="Edit">
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

// ─────────────────────────── Prefab Library Tab ───────────────────────────

interface PrefabRowWithPrices extends PrefabCatalogItem {
  prices: PrefabCatalogPrice[];
}

function PrefabLibraryTab() {
  const [brands, setBrands] = useState<PrefabBrand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [rows, setRows] = useState<PrefabRowWithPrices[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [finishFilter, setFinishFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PrefabCatalogItem | null>(null);
  const [importReport, setImportReport] = useState<PrefabImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const exchangeRate = useSettingsStore(s => s.settings.exchangeRateUsdToMxn);
  const fetchSettings = useSettingsStore(s => s.fetchSettings);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    if (selectedBrandId) loadCatalog();
  }, [selectedBrandId, showInactive]);

  async function loadBrands() {
    const { data, error } = await supabase
      .from('prefab_brand')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) { console.error(error); return; }
    const list = (data || []) as PrefabBrand[];
    setBrands(list);
    if (list.length > 0 && !selectedBrandId) setSelectedBrandId(list[0].id);
  }

  async function loadCatalog() {
    setLoading(true);
    try {
      // Query the view instead of two separate tables. The view aggregates all
      // current prices as a JSONB array server-side, returning one row per SKU.
      // This avoids the PostgREST per-request row cap that silently truncates
      // when is_current prices exceed max-rows (Northville: ~2 338, Venus: ~4 084).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from('prefab_catalog_with_prices')
        .select('*')
        .eq('brand_id', selectedBrandId)
        .order('category')
        .order('cabinet_code');
      if (!showInactive) q = q.eq('is_active', true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await q as { data: any[] | null; error: any };
      if (error) throw error;

      const withPrices: PrefabRowWithPrices[] = (data || []).map((r: any) => ({
        ...(r as PrefabCatalogItem),
        // prices is a JSONB array pre-sorted by finish in the view
        prices: (r.prices ?? []) as PrefabCatalogPrice[],
      }));
      setRows(withPrices);
    } catch (error) {
      console.error('Error loading prefab catalog:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(item: PrefabCatalogItem) {
    const { error } = await supabase
      .from('prefab_catalog')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    if (!error) {
      setRows(prev => prev.map(r => r.id === item.id ? { ...r, is_active: !r.is_active } : r));
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.category);
    return Array.from(set).sort();
  }, [rows]);

  const finishes = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) for (const p of r.prices) set.add(p.finish);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (categoryFilter !== 'all') result = result.filter(r => r.category === categoryFilter);
    if (finishFilter !== 'all') {
      result = result.filter(r => r.prices.some(p => p.finish === finishFilter));
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.cabinet_code.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, categoryFilter, finishFilter, searchTerm]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const brand = brands.find(b => b.id === selectedBrandId);
    if (!brand) return;

    setImporting(true);
    try {
      const report = await importPrefabPriceList(file, { brandName: brand.name });
      setImportReport(report);
      await loadCatalog();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      alert('Import failed: ' + msg);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function openAdd() { setEditingItem(null); setFormOpen(true); }
  function openEdit(item: PrefabCatalogItem) { setEditingItem(item); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(null); }

  const selectedBrand = brands.find(b => b.id === selectedBrandId);

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-4 page-enter">
        <div className="glass-white h-14 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-40 skeleton-shimmer" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Brand pills */}
      <div className="mb-4 flex items-center gap-2">
        {brands.map(b => (
          <button
            key={b.id}
            onClick={() => setSelectedBrandId(b.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              selectedBrandId === b.id
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-surf-card border-border-solid text-fg-700 hover:bg-surf-app'
            }`}
          >
            {b.name}
          </button>
        ))}
        <div className="ml-auto text-xs text-fg-500">{filtered.length} items</div>
      </div>

      {/* Action row */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Prefab
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <Upload className="h-4 w-4 mr-1" />
            {importing ? 'Importing…' : 'Import price list'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>
        <div className="text-xs text-fg-500">
          FX: ${exchangeRate.toFixed(2)} MXN/USD
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by code or description..."
            className="w-full pl-9 pr-4 py-2 border border-border-solid rounded-lg text-sm focus:outline-none focus:ring-2 focus-visible:ring-focus"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-border-solid rounded-lg text-sm focus:outline-none focus:ring-2 focus-visible:ring-focus bg-surf-card"
        >
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={finishFilter}
          onChange={e => setFinishFilter(e.target.value)}
          className="px-3 py-2 border border-border-solid rounded-lg text-sm focus:outline-none focus:ring-2 focus-visible:ring-focus bg-surf-card"
        >
          <option value="all">All Finishes</option>
          {finishes.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <label className="flex items-center gap-2 px-3 py-2 border border-border-solid rounded-lg cursor-pointer hover:bg-surf-app text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="w-4 h-4 text-accent-text border-border-solid rounded"
          />
          <span className="text-fg-700">Show Inactive</span>
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border-soft">
        <table className="w-full text-sm">
          <thead className="bg-accent-tint-soft border-b border-accent-tint-border">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-indigo-900">Code</th>
              <th className="text-left px-4 py-3 font-semibold text-indigo-900">Category</th>
              <th className="text-left px-4 py-3 font-semibold text-indigo-900">Type</th>
              <th className="text-right px-4 py-3 font-semibold text-indigo-900">W"</th>
              <th className="text-right px-4 py-3 font-semibold text-indigo-900">H"</th>
              <th className="text-right px-4 py-3 font-semibold text-indigo-900">D"</th>
              <th className="text-left px-4 py-3 font-semibold text-indigo-900">
                {finishFilter === 'all' ? 'Finishes' : finishFilter}
              </th>
              <th className="text-right px-4 py-3 font-semibold text-indigo-900">Price USD</th>
              <th className="text-right px-4 py-3 font-semibold text-indigo-900">Price MXN</th>
              <th className="text-center px-4 py-3 font-semibold text-indigo-900">Flags</th>
              <th className="text-center px-4 py-3 font-semibold text-indigo-900">Active</th>
              <th className="text-center px-4 py-3 font-semibold text-indigo-900">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center py-10 text-fg-400">
                  {rows.length === 0 && loading
                    ? 'Loading…'
                    : rows.length === 0
                      ? 'No rows. Run scripts/seedPrefabLibrary.mjs or use "Import price list".'
                      : 'No items match the current filters.'}
                </td>
              </tr>
            ) : (
              filtered.map(item => {
                const displayPrice =
                  finishFilter !== 'all'
                    ? item.prices.find(p => p.finish === finishFilter)
                    : item.prices[0];
                const usd = displayPrice?.cost_usd;
                const mxn = usd != null ? usd * exchangeRate : null;
                const finishLabel =
                  finishFilter !== 'all'
                    ? displayPrice
                      ? '1 finish'
                      : '—'
                    : `${item.prices.length} finish${item.prices.length === 1 ? '' : 'es'}`;
                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-surf-app transition-colors ${!item.is_active ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-fg-700">
                      {item.cabinet_code}
                      {item.description && (
                        <div className="text-[11px] text-fg-400 font-sans">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-fg-600">{item.category}</td>
                    <td className="px-4 py-2">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-surf-muted text-fg-700">
                        {item.item_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-fg-700">{item.width_in ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-fg-700">{item.height_in ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-fg-700">{item.depth_in ?? '—'}</td>
                    <td className="px-4 py-2 text-fg-600 text-xs">{finishLabel}</td>
                    <td className="px-4 py-2 text-right font-medium text-fg-900">
                      {usd != null ? `$${usd.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-fg-700">
                      {mxn != null ? `$${mxn.toFixed(0)}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-center space-x-1">
                      {item.dims_locked && (
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800"
                          title="User-edited dimensions (importer won't overwrite)"
                        >
                          locked
                        </span>
                      )}
                      {item.dims_auto_parsed && !item.dims_locked && (
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 text-sky-800"
                          title="Dimensions decoded from cabinet code"
                        >
                          auto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => toggleActive(item)}
                        className="text-fg-400 hover:text-accent-text transition-colors"
                        title={item.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {item.is_active
                          ? <ToggleRight className="h-5 w-5 text-accent-text" />
                          : <ToggleLeft className="h-5 w-5" />}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => openEdit(item)}
                        className="text-fg-400 hover:text-accent-text transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {formOpen && selectedBrand && (
        <PrefabCatalogForm
          item={editingItem}
          brandId={selectedBrandId}
          brandName={selectedBrand.name}
          onClose={closeForm}
          onSaved={() => { closeForm(); loadCatalog(); }}
        />
      )}

      {importReport && (
        <Modal
          isOpen={true}
          onClose={() => setImportReport(null)}
          title={`Import report — ${importReport.brand}`}
          size="lg"
        >
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>Sheet: <span className="font-mono">{importReport.sheetName}</span></div>
              <div>Rows parsed: <b>{importReport.rowsParsed}</b></div>
              <div>SKUs parsed: <b>{importReport.skusParsed}</b></div>
              <div>Catalog inserted: <b className="text-green-700">{importReport.catalogInserted}</b></div>
              <div>Catalog updated: <b>{importReport.catalogUpdated}</b></div>
              <div>Catalog deactivated: <b className="text-red-700">{importReport.catalogDeactivated}</b></div>
              <div>Prices archived: <b>{importReport.pricesArchived}</b></div>
              <div>Prices inserted: <b className="text-green-700">{importReport.pricesInserted}</b></div>
            </div>
            {importReport.priceChanges.length > 0 && (
              <div>
                <h4 className="font-semibold text-fg-700 mt-3 mb-1">
                  Price changes ({importReport.priceChanges.length})
                </h4>
                <div className="max-h-60 overflow-y-auto border border-border-soft rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-surf-app sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">Code</th>
                        <th className="px-2 py-1 text-left">Finish</th>
                        <th className="px-2 py-1 text-right">Old</th>
                        <th className="px-2 py-1 text-right">New</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importReport.priceChanges.slice(0, 200).map((c, i) => (
                        <tr key={i} className="border-t border-border-soft">
                          <td className="px-2 py-0.5 font-mono">{c.code}</td>
                          <td className="px-2 py-0.5">{c.finish}</td>
                          <td className="px-2 py-0.5 text-right text-fg-500">
                            {c.oldUsd != null ? `$${c.oldUsd.toFixed(2)}` : 'new'}
                          </td>
                          <td className="px-2 py-0.5 text-right">${c.newUsd.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {importReport.errors.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-700 mt-3 mb-1">
                  Errors ({importReport.errors.length})
                </h4>
                <ul className="max-h-40 overflow-y-auto text-xs text-red-700 list-disc pl-5">
                  {importReport.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-end pt-3 border-t border-border-soft">
              <Button onClick={() => setImportReport(null)}>Close</Button>
            </div>
          </div>
        </Modal>
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
