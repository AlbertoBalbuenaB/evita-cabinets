import { useState, useEffect, useMemo } from 'react';
import { Search, Package, Loader2 } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { fetchAllProducts } from '../../lib/fetchAllProducts';
import { useOptimizerStore } from '../../hooks/useOptimizerStore';
import type { Product, CutPiece } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportCabinetsModal({ isOpen, onClose }: Props) {
  const store = useOptimizerStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Map<string, number>>(new Map()); // productId → qty
  const [importArea, setImportArea] = useState(''); // '' = auto (use product name)

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchAllProducts({ onlyActive: true }).then(data => {
      // Only show products that have cut_pieces
      setProducts(data.filter(p => Array.isArray(p.cut_pieces) && (p.cut_pieces as unknown as CutPiece[]).length > 0));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.sku.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.collection_name || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const toggleProduct = (id: string) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, 1);
      return next;
    });
  };

  const setQty = (id: string, qty: number) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(id);
      else next.set(id, qty);
      return next;
    });
  };

  const totalPieces = useMemo(() => {
    let count = 0;
    selected.forEach((qty, id) => {
      const product = products.find(p => p.id === id);
      if (!product) return;
      const pieces = product.cut_pieces as unknown as CutPiece[];
      pieces.forEach(cp => { count += cp.cantidad * qty; });
    });
    return count;
  }, [selected, products]);

  const handleImport = () => {
    const stockName = store.stocks[0]?.nombre ?? 'Melamina';
    let importedCount = 0;

    selected.forEach((cabinetQty, productId) => {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      const pieces = product.cut_pieces as unknown as CutPiece[];
      const areaName = importArea || product.description || product.sku;

      // Add area if it doesn't exist
      if (areaName && !store.areas.includes(areaName)) {
        store.addArea(areaName);
      }

      pieces.forEach(cp => {
        store.addPiece({
          nombre: cp.nombre,
          material: stockName,
          grosor: 18,
          ancho: cp.ancho,
          alto: cp.alto,
          cantidad: cp.cantidad * cabinetQty,
          veta: 'none',
          cubrecanto: cp.cubrecanto || { sup: 0, inf: 0, izq: 0, der: 0 },
          area: areaName,
        });
        importedCount++;
      });
    });

    onClose();
    setSelected(new Map());
    setSearch('');
    setImportArea('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import from Cabinets" size="lg">
      <div className="space-y-4">
        {/* Search + Area selector */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by SKU, description, or collection..."
              className="w-full pl-9 pr-4 py-2.5 border border-border-soft rounded-lg bg-surf-card backdrop-blur-sm focus:outline-none focus:ring-2 focus-visible:ring-focus focus:border-blue-500 text-sm"
            />
          </div>
          <div className="shrink-0">
            <label className="block text-xs font-medium text-fg-500 mb-1">Import to area</label>
            <select value={importArea} onChange={e => setImportArea(e.target.value)}
              className="w-48 py-2 px-3 border border-border-soft rounded-lg bg-surf-card backdrop-blur-sm focus:outline-none focus:ring-2 focus-visible:ring-focus focus:border-blue-500 text-sm">
              <option value="">Auto (product name)</option>
              {store.areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* Product list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-fg-500">Loading products...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-fg-400">
            {search ? 'No products match your search.' : 'No products with cut lists found.'}
          </div>
        ) : (
          <div className="border border-border-soft rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surf-app z-10">
                <tr className="border-b border-border-soft">
                  <th className="py-2.5 px-3 w-10"></th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-fg-500 uppercase tracking-wide">SKU</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-fg-500 uppercase tracking-wide">Description</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-fg-500 uppercase tracking-wide">Collection</th>
                  <th className="py-2.5 px-3 text-center text-xs font-medium text-fg-500 uppercase tracking-wide">Pieces</th>
                  <th className="py-2.5 px-3 text-center text-xs font-medium text-fg-500 uppercase tracking-wide w-20">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {filtered.map(product => {
                  const pieces = product.cut_pieces as unknown as CutPiece[];
                  const isSelected = selected.has(product.id);
                  const qty = selected.get(product.id) || 0;
                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors cursor-pointer ${isSelected ? 'bg-accent-tint-soft' : 'hover:bg-surf-app'}`}
                      onClick={() => toggleProduct(product.id)}
                    >
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleProduct(product.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 rounded border-border-solid text-accent-text focus-visible:ring-focus"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-fg-600">{product.sku}</td>
                      <td className="py-2 px-3 text-fg-800 font-medium">{product.description}</td>
                      <td className="py-2 px-3 text-fg-500 text-xs">{product.collection_name || '—'}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs bg-status-amber-bg text-status-amber-fg px-2 py-0.5 rounded-full font-medium">
                          <Package className="h-3 w-3" />{pieces.length}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center" onClick={e => e.stopPropagation()}>
                        {isSelected ? (
                          <input
                            type="number"
                            min="1"
                            value={qty}
                            onChange={e => setQty(product.id, parseInt(e.target.value) || 0)}
                            className="w-16 text-sm text-center border border-accent-tint-border rounded-md bg-surf-card py-0.5 focus:outline-none focus:ring-2 focus-visible:ring-focus tabular-nums"
                          />
                        ) : (
                          <span className="text-fg-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border-soft">
          <div className="text-sm text-fg-500">
            {selected.size > 0 ? (
              <span>
                <span className="font-semibold text-fg-700">{selected.size}</span> cabinet{selected.size !== 1 ? 's' : ''} selected
                {totalPieces > 0 && <span> · <span className="font-semibold text-accent-text">{totalPieces}</span> total pieces</span>}
              </span>
            ) : (
              'Select cabinets to import their cut lists'
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleImport} disabled={selected.size === 0}>
              Import {totalPieces > 0 ? `${totalPieces} pieces` : ''}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
