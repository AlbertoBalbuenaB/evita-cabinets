import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import type { ClosetCatalogItem } from '../types';

interface ClosetCatalogFormProps {
  item: ClosetCatalogItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const EVITA_LINES = ['Evita Plus', 'Evita Premium'] as const;

const DESCRIPTIONS = [
  'Back Panel',
  'Closet Adjustable Shelves',
  'Closet Shelves Shoes',
  'Double Hanging',
  'Drawers',
  'Hanging',
  'Hanging With One Shelf',
  'Hanging With Two Shelves',
  'Jewelry',
  'One Drawer Closet',
  'Open Closet Cabinet',
  'Pants Pull Out',
  'Tall Hanging',
  'Wall Pantrie',
  'Doors',
  'Glass Doors',
  'Garage Doors',
  'Garage Drawers',
  'Garage Wall Cabinet',
  'Office Doors Cabinet',
  'Office Drawers',
  'Office Open Cabinet',
  'Toe Kick',
  'Wall Filler',
];

export function ClosetCatalogForm({ item, onClose, onSaved }: ClosetCatalogFormProps) {
  const [saving, setSaving] = useState(false);
  const [customDescription, setCustomDescription] = useState(false);

  const [cabinetCode, setCabinetCode] = useState(item?.cabinet_code || '');
  const [evitaLine, setEvitaLine] = useState<string>(item?.evita_line || 'Evita Plus');
  const [description, setDescription] = useState(item?.description || '');
  const [heightIn, setHeightIn] = useState(item?.height_in?.toString() || '');
  const [widthIn, setWidthIn] = useState(item?.width_in?.toString() || '');
  const [depthIn, setDepthIn] = useState(item?.depth_in?.toString() || '');
  const [priceWithBacks, setPriceWithBacks] = useState(item?.price_with_backs_usd?.toString() || '');
  const [priceWithoutBacks, setPriceWithoutBacks] = useState(item?.price_without_backs_usd?.toString() || '');
  const [hasBacksOption, setHasBacksOption] = useState(item?.has_backs_option ?? true);
  const [boxesCount, setBoxesCount] = useState(item?.boxes_count?.toString() || '1');

  useEffect(() => {
    if (item?.description && !DESCRIPTIONS.includes(item.description)) {
      setCustomDescription(true);
    }
  }, [item]);

  async function handleSave() {
    if (!cabinetCode.trim()) { alert('Cabinet code is required'); return; }
    if (!description.trim()) { alert('Description is required'); return; }
    if (!heightIn || !widthIn || !depthIn) { alert('All dimensions are required'); return; }
    if (!priceWithBacks) { alert('Price with backs is required'); return; }

    setSaving(true);
    try {
      const data = {
        cabinet_code: cabinetCode.trim().toUpperCase(),
        evita_line: evitaLine,
        description: description.trim(),
        height_in: parseFloat(heightIn),
        width_in: parseFloat(widthIn),
        depth_in: parseFloat(depthIn),
        price_with_backs_usd: parseFloat(priceWithBacks),
        price_without_backs_usd: hasBacksOption && priceWithoutBacks ? parseFloat(priceWithoutBacks) : null,
        has_backs_option: hasBacksOption,
        boxes_count: parseInt(boxesCount) || 1,
      };

      if (item) {
        const { error } = await supabase.from('closet_catalog').update(data).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('closet_catalog').insert(data);
        if (error) throw error;
      }
      onSaved();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      alert('Error saving: ' + msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={item ? 'Edit Closet Cabinet' : 'Add New Closet Cabinet'}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cabinet Code <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={cabinetCode}
              onChange={e => setCabinetCode(e.target.value.toUpperCase())}
              placeholder="e.g. H183624"
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm"
            />
            <p className="text-xs text-slate-400 mt-0.5">Must be unique across all catalog</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Evita Line <span className="text-red-500">*</span></label>
            <select
              value={evitaLine}
              onChange={e => setEvitaLine(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              {EVITA_LINES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">Description / Type <span className="text-red-500">*</span></label>
            <button
              type="button"
              onClick={() => { setCustomDescription(!customDescription); setDescription(''); }}
              className="text-xs text-teal-600 hover:text-teal-700"
            >
              {customDescription ? 'Use predefined' : 'Enter custom'}
            </button>
          </div>
          {customDescription ? (
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Enter custom description"
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          ) : (
            <select
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="">Select type...</option>
              {DESCRIPTIONS.sort().map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Height (in) *"
            type="number"
            step="0.1"
            min="0"
            value={heightIn}
            onChange={e => setHeightIn(e.target.value)}
            placeholder="e.g. 36"
          />
          <Input
            label="Width (in) *"
            type="number"
            step="0.1"
            min="0"
            value={widthIn}
            onChange={e => setWidthIn(e.target.value)}
            placeholder="e.g. 18"
          />
          <Input
            label="Depth (in) *"
            type="number"
            step="0.1"
            min="0"
            value={depthIn}
            onChange={e => setDepthIn(e.target.value)}
            placeholder="e.g. 16"
          />
        </div>

        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasBacksOption}
                onChange={e => setHasBacksOption(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm font-medium text-slate-700">Has with/without backs pricing option</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={hasBacksOption ? 'Price With Backs (USD) *' : 'Price (USD) *'}
              type="number"
              step="0.01"
              min="0"
              value={priceWithBacks}
              onChange={e => setPriceWithBacks(e.target.value)}
              placeholder="0.00"
            />
            {hasBacksOption && (
              <Input
                label="Price Without Backs (USD)"
                type="number"
                step="0.01"
                min="0"
                value={priceWithoutBacks}
                onChange={e => setPriceWithoutBacks(e.target.value)}
                placeholder="0.00"
              />
            )}
          </div>
        </div>

        <Input
          label="Boxes per Unit"
          type="number"
          min="1"
          step="1"
          value={boxesCount}
          onChange={e => setBoxesCount(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : item ? 'Update Cabinet' : 'Add Cabinet'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
