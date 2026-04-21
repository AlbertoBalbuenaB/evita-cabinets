/**
 * Draft Tool — Overall Specs editor (Step 3.5).
 *
 * A glass-white modal with a dynamic list of finishes plus fixed fields for
 * box construction, toe kick, hinges, slides, shelves, pulls, and special
 * hardware. Values are stored as free-text strings in `drawings.specs`
 * (JSONB); Phase 2 migrates them to FK references to a `finishes` table.
 *
 * Prefill policy: if the current drawing already has specs, we load them;
 * otherwise we start with one empty finish row so the user can start
 * typing immediately. No hard-coded finish strings — every field defaults
 * to the empty string.
 */

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { useDraftStore } from '../store/useDraftStore';
import type { DrawingSpecs, DrawingSpecFinish } from '../types';

interface SpecsEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLES: Array<DrawingSpecFinish['role']> = ['primary', 'accent', 'interior', 'other'];

export function SpecsEditorModal({ isOpen, onClose }: SpecsEditorModalProps) {
  const currentDrawing = useDraftStore((s) => s.currentDrawing);
  const updateSpecs = useDraftStore((s) => s.updateSpecs);

  const initial: DrawingSpecs = (currentDrawing?.specs as DrawingSpecs | null) ?? {};
  const [finishes, setFinishes] = useState<DrawingSpecFinish[]>(
    initial.finishes && initial.finishes.length > 0
      ? initial.finishes
      : [{ label: '', role: 'primary' }]
  );
  const [boxConstruction, setBoxConstruction] = useState(initial.box_construction ?? '');
  const [toeKick, setToeKick] = useState(initial.toe_kick ?? '');
  const [hinges, setHinges] = useState(initial.hinges ?? '');
  const [slides, setSlides] = useState(initial.slides ?? '');
  const [shelves, setShelves] = useState(initial.shelves ?? '');
  const [pulls, setPulls] = useState(initial.pulls ?? '');
  const [specialHardware, setSpecialHardware] = useState(initial.special_hardware ?? '');

  // Re-hydrate when the opened drawing changes.
  useEffect(() => {
    if (!isOpen) return;
    const s = (currentDrawing?.specs as DrawingSpecs | null) ?? {};
    setFinishes(
      s.finishes && s.finishes.length > 0 ? s.finishes : [{ label: '', role: 'primary' }]
    );
    setBoxConstruction(s.box_construction ?? '');
    setToeKick(s.toe_kick ?? '');
    setHinges(s.hinges ?? '');
    setSlides(s.slides ?? '');
    setShelves(s.shelves ?? '');
    setPulls(s.pulls ?? '');
    setSpecialHardware(s.special_hardware ?? '');
  }, [isOpen, currentDrawing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    const cleaned: DrawingSpecs = {
      finishes: finishes.filter((f) => f.label.trim() !== ''),
      box_construction: boxConstruction.trim() || undefined,
      toe_kick: toeKick.trim() || undefined,
      hinges: hinges.trim() || undefined,
      slides: slides.trim() || undefined,
      shelves: shelves.trim() || undefined,
      pulls: pulls.trim() || undefined,
      special_hardware: specialHardware.trim() || undefined,
    };
    updateSpecs(cleaned);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Overall Specifications" size="lg">
      <div className="space-y-6">
        {/* Finishes */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-fg-800">Finishes</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setFinishes([...finishes, { label: '', role: 'other' }])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Add finish
            </Button>
          </div>
          <div className="space-y-2">
            {finishes.map((f, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <input
                  type="text"
                  value={f.label}
                  placeholder='e.g. Evita Elite, Cashmire High Gloss 3/4"'
                  onChange={(e) => {
                    const next = [...finishes];
                    next[idx] = { ...next[idx], label: e.target.value };
                    setFinishes(next);
                  }}
                  className="flex-1 px-3 py-2 rounded-lg border border-border-solid bg-surf-card text-sm text-fg-700 focus:outline-none focus:ring-2 focus-visible:ring-focus"
                />
                <select
                  value={f.role}
                  onChange={(e) => {
                    const next = [...finishes];
                    next[idx] = {
                      ...next[idx],
                      role: e.target.value as DrawingSpecFinish['role'],
                    };
                    setFinishes(next);
                  }}
                  className="px-3 py-2 rounded-lg border border-border-solid bg-surf-card text-sm text-fg-700"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFinishes(finishes.filter((_, i) => i !== idx))}
                  aria-label="Remove finish"
                >
                  <Trash2 className="h-4 w-4 text-fg-500" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* Simple text fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SpecField label="Box Construction" value={boxConstruction} onChange={setBoxConstruction} placeholder='Evita Plus, Lino 5/8"' />
          <SpecField label="Toe Kick" value={toeKick} onChange={setToeKick} placeholder="MATCHING FINISH" />
          <SpecField label="Hinges" value={hinges} onChange={setHinges} placeholder="Blum Soft Close" />
          <SpecField label="Slides" value={slides} onChange={setSlides} placeholder="Undermount Soft Close / Stetik Dark" />
          <SpecField label="Shelves" value={shelves} onChange={setShelves} placeholder="Adjustables" />
          <SpecField label="Pulls" value={pulls} onChange={setPulls} placeholder="N/A" />
        </div>

        <SpecField
          label="Special Hardware"
          value={specialHardware}
          onChange={setSpecialHardware}
          placeholder="TPO, Aluminum Light Channel, ..."
          multiline
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border-soft">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SpecField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-fg-600 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-border-solid bg-surf-card text-sm text-fg-700 focus:outline-none focus:ring-2 focus-visible:ring-focus"
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border-solid bg-surf-card text-sm text-fg-700 focus:outline-none focus:ring-2 focus-visible:ring-focus"
        />
      )}
    </div>
  );
}
