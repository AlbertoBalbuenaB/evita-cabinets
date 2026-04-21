import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { formatCurrency } from '../lib/calculations';
import { useSettingsStore } from '../lib/settingsStore';
import { Search, X } from 'lucide-react';
import type { ClosetCatalogItem, AreaClosetItem, HardwareItem, PriceListItem } from '../types';

interface ClosetFormProps {
  areaId: string;
  closetItem: AreaClosetItem | null;
  onClose: () => void;
}

const EVITA_LINES = ['Evita Plus', 'Evita Premium'] as const;

export function ClosetForm({ areaId, closetItem, onClose }: ClosetFormProps) {
  const [catalog, setCatalog] = useState<ClosetCatalogItem[]>([]);
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const exchangeRate = useSettingsStore(s => s.settings.exchangeRateUsdToMxn);
  const fetchSettings = useSettingsStore(s => s.fetchSettings);

  const [selectedLine, setSelectedLine] = useState<string>(closetItem?.catalog_item?.evita_line || 'Evita Plus');
  const [selectedDescription, setSelectedDescription] = useState<string>(closetItem?.catalog_item?.description || '');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(closetItem?.closet_catalog_id || '');
  const [quantity, setQuantity] = useState(closetItem?.quantity || 1);

  const [codeSearch, setCodeSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const codeSearchRef = useRef<HTMLDivElement>(null);
  const [withBacks, setWithBacks] = useState(closetItem?.with_backs ?? true);
  const [hardware, setHardware] = useState<HardwareItem[]>(
    Array.isArray(closetItem?.hardware) ? (closetItem!.hardware as HardwareItem[]) : []
  );
  const [notes, setNotes] = useState(closetItem?.notes || '');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [catalogResult, priceListResult] = await Promise.all([
        supabase.from('closet_catalog').select('*').eq('is_active', true).order('evita_line').order('description').order('width_in').order('height_in'),
        supabase.from('price_list').select('*').eq('is_active', true).in('type', ['Hardware', 'Accessories']).order('concept_description'),
      ]);
      fetchSettings();

      if (catalogResult.error) throw catalogResult.error;
      setCatalog((catalogResult.data || []) as ClosetCatalogItem[]);
      setPriceList(priceListResult.data || []);

      if (closetItem && closetItem.closet_catalog_id) {
        const cat = catalogResult.data?.find(c => c.id === closetItem.closet_catalog_id);
        if (cat) {
          setSelectedLine(cat.evita_line);
          setSelectedDescription(cat.description);
        }
      }
    } catch (error) {
      console.error('Error loading closet catalog:', error);
    } finally {
      setLoading(false);
    }
  }

  const codeSuggestions = useMemo(() => {
    if (!codeSearch.trim()) return [];
    const q = codeSearch.trim().toLowerCase();
    const filtered = catalog.filter(c =>
      c.cabinet_code.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
    const plus = filtered.filter(c => c.evita_line === 'Evita Plus').slice(0, 6);
    const premium = filtered.filter(c => c.evita_line === 'Evita Premium').slice(0, 6);
    const interleaved: typeof filtered = [];
    const max = Math.max(plus.length, premium.length);
    for (let i = 0; i < max; i++) {
      if (i < plus.length) interleaved.push(plus[i]);
      if (i < premium.length) interleaved.push(premium[i]);
    }
    return interleaved;
  }, [catalog, codeSearch]);

  function handleSelectFromCode(item: ClosetCatalogItem) {
    setSelectedLine(item.evita_line);
    setSelectedDescription(item.description);
    setSelectedCatalogId(item.id);
    setCodeSearch(item.cabinet_code);
    setShowSuggestions(false);
  }

  function clearCodeSearch() {
    setCodeSearch('');
    setSelectedLine('Evita Plus');
    setSelectedDescription('');
    setSelectedCatalogId('');
    setShowSuggestions(false);
  }

  function highlightMatch(text: string, query: string) {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-status-amber-bg text-status-amber-fg rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  }

  const availableDescriptions = useMemo(() => {
    const descriptions = new Set(
      catalog.filter(c => c.evita_line === selectedLine).map(c => c.description)
    );
    return Array.from(descriptions).sort();
  }, [catalog, selectedLine]);

  const availableSizes = useMemo(() => {
    return catalog.filter(c => c.evita_line === selectedLine && c.description === selectedDescription);
  }, [catalog, selectedLine, selectedDescription]);

  const selectedItem = useMemo(() => {
    return catalog.find(c => c.id === selectedCatalogId) || null;
  }, [catalog, selectedCatalogId]);

  const unitPriceUSD = useMemo(() => {
    if (!selectedItem) return 0;
    if (selectedItem.has_backs_option && !withBacks && selectedItem.price_without_backs_usd != null) {
      return selectedItem.price_without_backs_usd;
    }
    return selectedItem.price_with_backs_usd || 0;
  }, [selectedItem, withBacks]);

  const unitPriceMXN = unitPriceUSD * exchangeRate;

  const hardwareCost = useMemo(() => {
    return hardware.reduce((sum, hw) => {
      const item = priceList.find(p => p.id === hw.hardware_id);
      if (!item) return sum;
      return sum + (item.price_with_tax || item.price) * hw.quantity_per_cabinet;
    }, 0);
  }, [hardware, priceList]);

  const subtotalMXN = (unitPriceMXN + hardwareCost) * quantity;

  function handleLineChange(line: string) {
    setSelectedLine(line);
    setSelectedDescription('');
    setSelectedCatalogId('');
  }

  function handleDescriptionChange(desc: string) {
    setSelectedDescription(desc);
    setSelectedCatalogId('');
    const sizes = catalog.filter(c => c.evita_line === selectedLine && c.description === desc);
    if (sizes.length === 1) {
      setSelectedCatalogId(sizes[0].id);
    }
  }

  function addHardwareRow() {
    setHardware(prev => [...prev, { hardware_id: '', quantity_per_cabinet: 1 }]);
  }

  function removeHardwareRow(index: number) {
    setHardware(prev => prev.filter((_, i) => i !== index));
  }

  function updateHardware(index: number, field: keyof HardwareItem, value: string | number) {
    setHardware(prev => prev.map((hw, i) => i === index ? { ...hw, [field]: value } : hw));
  }

  async function handleSave() {
    if (!selectedItem) {
      alert('Please select a closet item');
      return;
    }

    const validHardware = hardware.filter(hw => hw.hardware_id);

    const data = {
      area_id: areaId,
      closet_catalog_id: selectedItem.id,
      quantity,
      with_backs: selectedItem.has_backs_option ? withBacks : false,
      unit_price_usd: unitPriceUSD,
      unit_price_mxn: unitPriceMXN,
      hardware: validHardware,
      hardware_cost: hardwareCost * quantity,
      subtotal_mxn: subtotalMXN,
      boxes_count: selectedItem.boxes_count * quantity,
      notes: notes || null,
    };

    try {
      if (closetItem) {
        const { error } = await supabase.from('area_closet_items').update(data as any).eq('id', closetItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('area_closet_items').insert(data as any);
        if (error) throw error;
      }
      onClose();
    } catch (error) {
      console.error('Error saving closet item:', error);
      alert('Failed to save closet item');
    }
  }

  if (loading) {
    return (
      <Modal isOpen={true} onClose={onClose} title={closetItem ? 'Edit Closet Item' : 'Add Closet Item'} size="lg">
        <div className="flex items-center justify-center h-64">
          <div className="text-fg-600">Loading closet catalog...</div>
        </div>
      </Modal>
    );
  }

  if (catalog.length === 0) {
    return (
      <Modal isOpen={true} onClose={onClose} title={closetItem ? 'Edit Closet Item' : 'Add Closet Item'} size="lg">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-fg-600 mb-2">No closet items available in catalog</div>
            <div className="text-sm text-fg-500">Please add items to the closet catalog first.</div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={closetItem ? 'Edit Closet Item' : 'Add Closet Item'} size="xl">
      <div className="space-y-5">

        <div ref={codeSearchRef} className="relative">
          <label className="block text-sm font-medium text-fg-700 mb-1">Quick Search by Code or Description</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-400 pointer-events-none" />
            <input
              type="text"
              value={codeSearch}
              onChange={e => { setCodeSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Type a code (e.g. H183624) or keyword (e.g. Hanging)..."
              className="w-full pl-9 pr-9 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-mono"
            />
            {codeSearch && (
              <button
                type="button"
                onClick={clearCodeSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-400 hover:text-fg-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {showSuggestions && codeSuggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-surf-card border border-border-soft rounded-lg shadow-lg overflow-hidden">
              {codeSuggestions.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={() => handleSelectFromCode(item)}
                  className="w-full text-left px-4 py-2.5 hover:bg-teal-50 flex items-center justify-between gap-4 border-b border-slate-50 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-sm font-semibold text-fg-800 shrink-0">
                      {highlightMatch(item.cabinet_code, codeSearch)}
                    </span>
                    <span className="text-xs text-fg-500 truncate">
                      {highlightMatch(item.description, codeSearch)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-fg-400">
                    <span>{item.width_in}" W × {item.height_in}" H × {item.depth_in}" D</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      item.evita_line === 'Evita Premium' ? 'bg-status-amber-bg text-status-amber-fg' : 'bg-accent-tint-soft text-accent-text'
                    }`}>
                      {item.evita_line === 'Evita Premium' ? 'Premium' : 'Plus'}
                    </span>
                    <span className="font-medium text-fg-600">${Number(item.price_with_backs_usd).toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showSuggestions && codeSearch.trim() && codeSuggestions.length === 0 && (
            <div className="absolute z-50 mt-1 w-full bg-surf-card border border-border-soft rounded-lg shadow-lg px-4 py-3 text-sm text-fg-400">
              No results found for "{codeSearch}"
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-border-soft" />
          <span className="text-xs text-fg-400 shrink-0">or select manually below</span>
          <div className="flex-1 border-t border-border-soft" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-fg-700 mb-1">Evita Line</label>
            <select
              value={selectedLine}
              onChange={e => handleLineChange(e.target.value)}
              className="block w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-surf-card"
            >
              {EVITA_LINES.map(line => (
                <option key={line} value={line}>{line}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-700 mb-1">Cabinet Type</label>
            <select
              value={selectedDescription}
              onChange={e => handleDescriptionChange(e.target.value)}
              className="block w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-surf-card"
            >
              <option value="">Select type...</option>
              {availableDescriptions.map(desc => (
                <option key={desc} value={desc}>{desc}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedDescription && (
          <div>
            <label className="block text-sm font-medium text-fg-700 mb-1">Size (W x H x D inches)</label>
            <select
              value={selectedCatalogId}
              onChange={e => setSelectedCatalogId(e.target.value)}
              className="block w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-surf-card"
            >
              <option value="">Select size...</option>
              {availableSizes.map(item => (
                <option key={item.id} value={item.id}>
                  {item.width_in}" W × {item.height_in}" H × {item.depth_in}" D — {item.cabinet_code}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedItem && (
          <div className="bg-teal-50 border border-teal-200 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-fg-600">Line:</span>
              <span className="font-medium text-teal-700">{selectedItem.evita_line}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fg-600">Code:</span>
              <span className="font-medium font-mono">{selectedItem.cabinet_code}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fg-600">Dimensions:</span>
              <span className="font-medium">{selectedItem.width_in}" W × {selectedItem.height_in}" H × {selectedItem.depth_in}" D</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fg-600">Boxes/unit:</span>
              <span className="font-medium">{selectedItem.boxes_count}</span>
            </div>
            {selectedItem.has_backs_option && (
              <div className="flex justify-between text-sm">
                <span className="text-fg-600">Price w/backs:</span>
                <span className="font-medium">${selectedItem.price_with_backs_usd?.toFixed(2)} USD</span>
              </div>
            )}
            {selectedItem.has_backs_option && selectedItem.price_without_backs_usd != null && (
              <div className="flex justify-between text-sm">
                <span className="text-fg-600">Price w/o backs:</span>
                <span className="font-medium">${selectedItem.price_without_backs_usd.toFixed(2)} USD</span>
              </div>
            )}
            {!selectedItem.has_backs_option && (
              <div className="flex justify-between text-sm">
                <span className="text-fg-600">Price:</span>
                <span className="font-medium">${selectedItem.price_with_backs_usd?.toFixed(2)} USD</span>
              </div>
            )}
          </div>
        )}

        {selectedItem && selectedItem.has_backs_option && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={withBacks}
                onChange={e => setWithBacks(e.target.checked)}
                className="w-4 h-4 rounded border-border-solid text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm font-medium text-fg-700">Include backs</span>
            </label>
            <span className="text-xs text-fg-500">
              {withBacks ? `$${selectedItem.price_with_backs_usd?.toFixed(2)} USD` : `$${selectedItem.price_without_backs_usd?.toFixed(2)} USD`}
            </span>
          </div>
        )}

        <Input
          label="Quantity"
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          required
        />

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-fg-700">Hardware (optional)</label>
            <button
              type="button"
              onClick={addHardwareRow}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              + Add hardware
            </button>
          </div>
          {hardware.map((hw, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <select
                value={hw.hardware_id}
                onChange={e => updateHardware(index, 'hardware_id', e.target.value)}
                className="flex-1 px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-surf-card text-sm"
              >
                <option value="">Select hardware...</option>
                {priceList.map(p => (
                  <option key={p.id} value={p.id}>{p.concept_description} ({formatCurrency(p.price_with_tax || p.price)})</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={hw.quantity_per_cabinet}
                onChange={e => updateHardware(index, 'quantity_per_cabinet', parseInt(e.target.value) || 1)}
                className="w-20 px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                placeholder="Qty"
              />
              <button
                type="button"
                onClick={() => removeHardwareRow(index)}
                className="px-3 py-2 text-red-500 hover:text-status-red-fg"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes..."
            className="block w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            rows={2}
          />
        </div>

        {selectedItem && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="text-sm text-teal-800 font-medium">Price Summary</div>
                <div className="text-xs text-teal-600">
                  Unit: ${unitPriceUSD.toFixed(2)} USD = {formatCurrency(unitPriceMXN)}
                </div>
                {hardwareCost > 0 && (
                  <div className="text-xs text-teal-600">Hardware/unit: {formatCurrency(hardwareCost)}</div>
                )}
                <div className="text-xs text-teal-600">
                  {quantity} × {formatCurrency(unitPriceMXN + hardwareCost)}
                </div>
              </div>
              <div className="text-2xl font-bold text-teal-900">{formatCurrency(subtotalMXN)}</div>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t border-border-soft">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!selectedItem || !selectedCatalogId}>
            {closetItem ? 'Update Closet Item' : 'Add Closet Item'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
