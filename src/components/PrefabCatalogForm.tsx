import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import type { PrefabCatalogItem, PrefabItemType } from '../types';

/**
 * Edits a single prefab catalog row. Saving sets `dims_locked=true` so future
 * xlsx re-imports don't overwrite the user's manual corrections. Prices are
 * NOT editable here — they live in `prefab_catalog_price` and flow through
 * the "Import price list" button.
 */
interface PrefabCatalogFormProps {
  item: PrefabCatalogItem | null;
  brandId: string;
  brandName: string;
  onClose: () => void;
  onSaved: () => void;
}

const ITEM_TYPES: PrefabItemType[] = ['cabinet', 'accessory', 'linear', 'panel'];

export function PrefabCatalogForm({
  item,
  brandId,
  brandName,
  onClose,
  onSaved,
}: PrefabCatalogFormProps) {
  const [saving, setSaving] = useState(false);
  const [cabinetCode, setCabinetCode] = useState(item?.cabinet_code || '');
  const [category, setCategory] = useState(item?.category || '');
  const [description, setDescription] = useState(item?.description || '');
  const [itemType, setItemType] = useState<PrefabItemType>(item?.item_type || 'cabinet');
  const [widthIn, setWidthIn] = useState(item?.width_in?.toString() || '');
  const [heightIn, setHeightIn] = useState(item?.height_in?.toString() || '');
  const [depthIn, setDepthIn] = useState(item?.depth_in?.toString() || '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [isActive, setIsActive] = useState(item?.is_active ?? true);

  const isEdit = !!item;

  const dimsChanged = useMemo(() => {
    if (!item) return true;
    const w = widthIn === '' ? null : parseFloat(widthIn);
    const h = heightIn === '' ? null : parseFloat(heightIn);
    const d = depthIn === '' ? null : parseFloat(depthIn);
    return w !== item.width_in || h !== item.height_in || d !== item.depth_in;
  }, [item, widthIn, heightIn, depthIn]);

  async function handleSave() {
    if (!cabinetCode.trim()) { alert('Cabinet code is required'); return; }
    if (!category.trim()) { alert('Category is required'); return; }

    setSaving(true);
    try {
      const base = {
        brand_id: brandId,
        category: category.trim(),
        cabinet_code: cabinetCode.trim().toUpperCase(),
        description: description.trim() || null,
        item_type: itemType,
        width_in: widthIn === '' ? null : parseFloat(widthIn),
        height_in: heightIn === '' ? null : parseFloat(heightIn),
        depth_in: depthIn === '' ? null : parseFloat(depthIn),
        notes: notes.trim() || null,
        is_active: isActive,
        // Lock dims the moment the user touches the form so the xlsx
        // importer stops auto-overwriting them on re-import.
        dims_locked: isEdit ? (item!.dims_locked || dimsChanged) : false,
      };

      if (item) {
        const { error } = await supabase
          .from('prefab_catalog')
          .update(base)
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('prefab_catalog')
          .insert({ ...base, dims_auto_parsed: false });
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
      title={isEdit ? `Edit ${brandName} Prefab` : `Add New ${brandName} Prefab`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Cabinet Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cabinetCode}
              onChange={(e) => setCabinetCode(e.target.value.toUpperCase())}
              placeholder="e.g. B24, W3030, SB36"
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              readOnly={isEdit}
            />
            {isEdit && (
              <p className="text-xs text-slate-400 mt-0.5">Code is immutable after creation</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. BASE CABINETS"
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional human-friendly name"
            className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Item Type</label>
          <select
            value={itemType}
            onChange={(e) => setItemType(e.target.value as PrefabItemType)}
            className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-0.5">
            cabinet = standard box; linear = molding / filler / toe kick (no full dims);
            panel = decorative; accessory = singleton
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label='Width (in)'
            type="number"
            step="0.1"
            min="0"
            value={widthIn}
            onChange={(e) => setWidthIn(e.target.value)}
            placeholder="e.g. 24"
          />
          <Input
            label='Height (in)'
            type="number"
            step="0.1"
            min="0"
            value={heightIn}
            onChange={(e) => setHeightIn(e.target.value)}
            placeholder="e.g. 34.5"
          />
          <Input
            label='Depth (in)'
            type="number"
            step="0.1"
            min="0"
            value={depthIn}
            onChange={(e) => setDepthIn(e.target.value)}
            placeholder="e.g. 24"
          />
        </div>
        {isEdit && dimsChanged && (
          <p className="text-xs text-indigo-600">
            Dimensions changed — this row will be locked and won't be overwritten on
            future price-list re-imports.
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes"
            className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="prefab-is-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="prefab-is-active" className="text-sm text-slate-700">
            Active (show in "Add Prefab" picker and in importer diffs)
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Add Prefab'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
