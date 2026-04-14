import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Modal } from './Modal';
import { Input } from './Input';
import { formatCurrency } from '../lib/calculations';
import { useSettingsStore } from '../lib/settingsStore';
import { Search } from 'lucide-react';
import type {
  PrefabBrand,
  PrefabCatalogItem,
  PrefabCatalogPrice,
  AreaPrefabItem,
} from '../types';

/**
 * Add or edit a prefab line inside a project area.
 *
 * Flow:
 *   1. Pick brand (defaults to the first active brand, or the one the user
 *      already has lines of in this area).
 *   2. Search by code/description → pick a SKU (catalog row).
 *   3. Pick a finish from the rows marked `is_current=true` for that SKU.
 *   4. Set quantity + optional notes.
 *
 * Snapshot at save time (immutable in historical quotations):
 *   - cost_usd   = selected price.cost_usd
 *   - fx_rate    = settings store value at insert time
 *   - cost_mxn   = quantity * cost_usd * fx_rate
 */

interface PrefabItemFormProps {
  areaId: string;
  prefabItem: AreaPrefabItem | null;
  onClose: () => void;
}

interface EnrichedCatalogItem extends PrefabCatalogItem {
  prices: PrefabCatalogPrice[];
}

export function PrefabItemForm({ areaId, prefabItem, onClose }: PrefabItemFormProps) {
  const [brands, setBrands] = useState<PrefabBrand[]>([]);
  const [catalog, setCatalog] = useState<EnrichedCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const exchangeRate = useSettingsStore((s) => s.settings.exchangeRateUsdToMxn);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);

  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(
    prefabItem?.prefab_catalog_id || '',
  );
  const [selectedFinish, setSelectedFinish] = useState<string>(prefabItem?.finish || '');
  const [quantity, setQuantity] = useState<number>(prefabItem?.quantity || 1);
  const [notes, setNotes] = useState<string>(prefabItem?.notes || '');

  useEffect(() => { void loadData(); }, []);

  async function loadData() {
    try {
      fetchSettings();
      // Use the view so prices are aggregated server-side (one row per SKU).
      // The naive two-query pattern (prefab_catalog + prefab_catalog_price) hits
      // PostgREST's max-rows cap: with 6 400+ current prices across both brands,
      // only the first 1 000 rows were returned, leaving most SKUs with 0 finishes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [brandsRes, catalogRes] = await Promise.all([
        supabase.from('prefab_brand').select('*').eq('is_active', true).order('name'),
        (supabase as any)
          .from('prefab_catalog_with_prices')
          .select('*')
          .eq('is_active', true)
          .order('cabinet_code'),
      ]);
      if (brandsRes.error) throw brandsRes.error;
      if (catalogRes.error) throw catalogRes.error;

      const brandList = (brandsRes.data || []) as PrefabBrand[];
      setBrands(brandList);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enriched: EnrichedCatalogItem[] = ((catalogRes.data || []) as any[]).map((c: any) => ({
        ...(c as PrefabCatalogItem),
        // prices is a JSONB array pre-sorted by finish in the view
        prices: (c.prices ?? []) as PrefabCatalogPrice[],
      }));
      setCatalog(enriched);

      // If editing an existing line, seed the selected brand from its catalog row.
      if (prefabItem?.prefab_catalog_id) {
        const cat = enriched.find((c) => c.id === prefabItem.prefab_catalog_id);
        if (cat) setSelectedBrandId(cat.brand_id);
      } else if (brandList.length > 0) {
        setSelectedBrandId(brandList[0].id);
      }
    } catch (error) {
      console.error('Error loading prefab catalog:', error);
    } finally {
      setLoading(false);
    }
  }

  const brandCatalog = useMemo(
    () => catalog.filter((c) => c.brand_id === selectedBrandId),
    [catalog, selectedBrandId],
  );

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as EnrichedCatalogItem[];
    return brandCatalog
      .filter((c) =>
        c.cabinet_code.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [brandCatalog, search]);

  const selectedItem = useMemo(
    () => catalog.find((c) => c.id === selectedCatalogId) ?? null,
    [catalog, selectedCatalogId],
  );

  const availableFinishes = selectedItem?.prices ?? [];
  const selectedPrice = availableFinishes.find((p) => p.finish === selectedFinish);

  // Reset finish when switching SKUs — unless editing an existing row.
  useEffect(() => {
    if (!selectedItem) return;
    if (prefabItem && selectedItem.id === prefabItem.prefab_catalog_id) return;
    if (availableFinishes.length === 1) {
      setSelectedFinish(availableFinishes[0].finish);
    } else if (!availableFinishes.some((p) => p.finish === selectedFinish)) {
      setSelectedFinish('');
    }
  }, [selectedItem]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickCatalogItem(c: EnrichedCatalogItem) {
    setSelectedCatalogId(c.id);
    setSearch(`${c.cabinet_code} — ${c.description ?? c.category}`);
    setShowSuggestions(false);
  }

  const costUsd = selectedPrice?.cost_usd ?? 0;
  const costMxn = costUsd * exchangeRate * quantity;

  async function handleSave() {
    if (!selectedItem) { alert('Please select a prefab item.'); return; }
    if (!selectedFinish) { alert('Please select a finish.'); return; }
    if (!selectedPrice) { alert('No current price found for that finish.'); return; }
    if (quantity <= 0) { alert('Quantity must be greater than zero.'); return; }

    setSaving(true);
    try {
      const payload = {
        area_id: areaId,
        prefab_catalog_id: selectedItem.id,
        finish: selectedFinish,
        quantity,
        cost_usd: selectedPrice.cost_usd,
        fx_rate: exchangeRate,
        cost_mxn: selectedPrice.cost_usd * exchangeRate * quantity,
        notes: notes.trim() || null,
      };
      if (prefabItem) {
        const { error } = await supabase
          .from('area_prefab_items')
          .update(payload)
          .eq('id', prefabItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('area_prefab_items').insert(payload);
        if (error) throw error;
      }
      onClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      alert('Failed to save prefab item: ' + msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Modal isOpen onClose={onClose} title={prefabItem ? 'Edit Prefab Item' : 'Add Prefab Item'} size="lg">
        <div className="flex items-center justify-center h-40 text-slate-400">Loading catalog…</div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={prefabItem ? 'Edit Prefab Item' : 'Add Prefab Item'}
      size="lg"
    >
      <div className="space-y-4">
        {/* Brand pills */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
          <div className="flex items-center gap-2">
            {brands.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSelectedBrandId(b.id);
                  setSelectedCatalogId('');
                  setSelectedFinish('');
                  setSearch('');
                }}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
                  selectedBrandId === b.id
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* SKU search */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            SKU <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search by code, description, or category"
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickCatalogItem(s)}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-slate-700">{s.cabinet_code}</span>
                      <span className="text-[10px] text-slate-500">{s.category}</span>
                    </div>
                    {s.description && (
                      <div className="text-xs text-slate-500 mt-0.5">{s.description}</div>
                    )}
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {s.width_in ?? '—'}" W × {s.height_in ?? '—'}" H × {s.depth_in ?? '—'}" D · {s.prices.length} finishes
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected item summary */}
        {selectedItem && (
          <div className="border border-indigo-200 bg-indigo-50/50 rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-slate-700">{selectedItem.cabinet_code}</span>
                {selectedItem.description && (
                  <span className="text-slate-500 ml-2">— {selectedItem.description}</span>
                )}
              </div>
              <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {selectedItem.item_type}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {selectedItem.category} · {selectedItem.width_in ?? '—'}" W × {selectedItem.height_in ?? '—'}" H × {selectedItem.depth_in ?? '—'}" D
            </div>
          </div>
        )}

        {/* Finish + quantity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Finish <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedFinish}
              onChange={(e) => setSelectedFinish(e.target.value)}
              disabled={!selectedItem}
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Select finish…</option>
              {availableFinishes.map((p) => (
                <option key={p.id} value={p.finish}>
                  {p.finish} — ${p.cost_usd.toFixed(2)} USD
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Quantity *"
            type="number"
            min="0.01"
            step="0.01"
            value={String(quantity)}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Live subtotal */}
        {selectedPrice && (
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Unit cost (USD):</span>
              <span className="font-medium">${selectedPrice.cost_usd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">FX (settings):</span>
              <span className="font-medium">{exchangeRate.toFixed(2)} MXN/USD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Quantity:</span>
              <span className="font-medium">{quantity}</span>
            </div>
            <div className="flex justify-between pt-2 mt-1 border-t border-slate-200">
              <span className="font-medium text-slate-700">Subtotal (MXN):</span>
              <span className="font-semibold text-indigo-700">{formatCurrency(costMxn)}</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Optional"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !selectedItem || !selectedFinish}>
            {saving ? 'Saving…' : prefabItem ? 'Update' : 'Add Prefab'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
