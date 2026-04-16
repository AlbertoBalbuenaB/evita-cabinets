import { useEffect, useState } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Modal } from '../../Modal';
import { Button } from '../../Button';
import { supabase } from '../../../lib/supabase';
import type { CutPiece, Cubrecanto } from '../../../types';
import type { Json } from '../../../lib/database.types';

interface CutListEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  cabinetId: string;
  cabinetLabel: string;
  initialPieces: CutPiece[];
  hasOverride: boolean;
  onSaved: () => void | Promise<void>;
}

const CUBRECANTO_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Box EB' },
  { value: 2, label: 'Door EB' },
  { value: 3, label: 'Drawer Box EB' },
  { value: 4, label: 'Shelf EB' },
];

const MATERIAL_LABEL: Record<CutPiece['material'], string> = {
  cuerpo: 'Box',
  frente: 'Door',
  back: 'Back',
  drawer_box: 'Drawer Box',
  shelf: 'Shelf',
  custom: 'Custom',
};

function mkBlankPiece(): CutPiece {
  return {
    id: crypto.randomUUID(),
    nombre: '',
    ancho: 100,
    alto: 100,
    cantidad: 1,
    material: 'cuerpo',
    cubrecanto: { sup: 0, inf: 0, izq: 0, der: 0 },
    veta: 'none',
  };
}

function clonePieces(pieces: CutPiece[]): CutPiece[] {
  return pieces.map((p) => ({
    ...p,
    cubrecanto: p.cubrecanto ? { ...p.cubrecanto } : { sup: 0, inf: 0, izq: 0, der: 0 },
  }));
}

export function CutListEditorModal({
  isOpen,
  onClose,
  cabinetId,
  cabinetLabel,
  initialPieces,
  hasOverride,
  onSaved,
}: CutListEditorModalProps) {
  const [pieces, setPieces] = useState<CutPiece[]>(() => clonePieces(initialPieces));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed local state whenever the modal opens for a different cabinet or
  // the parent passes a fresh template (e.g. after a Reset).
  useEffect(() => {
    if (isOpen) {
      setPieces(clonePieces(initialPieces));
      setError(null);
    }
  }, [isOpen, initialPieces]);

  const updatePiece = (idx: number, patch: Partial<CutPiece>) => {
    setPieces((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const updateCubrecanto = (idx: number, side: keyof Cubrecanto, value: number) => {
    setPieces((prev) =>
      prev.map((p, i) =>
        i === idx
          ? {
              ...p,
              cubrecanto: {
                sup: p.cubrecanto?.sup ?? 0,
                inf: p.cubrecanto?.inf ?? 0,
                izq: p.cubrecanto?.izq ?? 0,
                der: p.cubrecanto?.der ?? 0,
                [side]: value,
              },
            }
          : p,
      ),
    );
  };

  const removePiece = (idx: number) => {
    setPieces((prev) => prev.filter((_, i) => i !== idx));
  };

  const addPiece = () => {
    setPieces((prev) => [...prev, mkBlankPiece()]);
  };

  const validate = (): string | null => {
    for (const [i, p] of pieces.entries()) {
      if (!p.nombre.trim()) return `Row ${i + 1}: Name is required.`;
      if (!Number.isFinite(p.ancho) || p.ancho <= 0) return `Row ${i + 1}: Width must be > 0.`;
      if (!Number.isFinite(p.alto) || p.alto <= 0) return `Row ${i + 1}: Height must be > 0.`;
      if (!Number.isInteger(p.cantidad) || p.cantidad < 1) return `Row ${i + 1}: Qty must be a positive integer.`;
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: dbErr } = await supabase
        .from('area_cabinets')
        .update({ cut_piece_overrides: pieces as unknown as Json })
        .eq('id', cabinetId);
      if (dbErr) throw new Error(dbErr.message);
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save overrides.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Discard overrides and revert to the product template?')) return;
    setSaving(true);
    setError(null);
    try {
      const { error: dbErr } = await supabase
        .from('area_cabinets')
        .update({ cut_piece_overrides: null })
        .eq('id', cabinetId);
      if (dbErr) throw new Error(dbErr.message);
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset overrides.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit cut list — ${cabinetLabel}`} size="xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Overrides are saved per cabinet and only affect the optimizer for this quotation.
            They do not change the catalog template.
          </p>
          {hasOverride && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving}
              className="shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset to template
            </Button>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200/60">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/70">
              <tr className="text-slate-600">
                <th className="text-left  px-2 py-2 font-medium">Name</th>
                <th className="text-left  px-2 py-2 font-medium">Material</th>
                <th className="text-right px-2 py-2 font-medium">W (mm)</th>
                <th className="text-right px-2 py-2 font-medium">H (mm)</th>
                <th className="text-right px-2 py-2 font-medium">Qty</th>
                <th className="text-center px-2 py-2 font-medium" colSpan={4}>
                  Cubrecanto
                </th>
                <th className="px-2 py-2"></th>
              </tr>
              <tr className="text-slate-400 text-[10px]">
                <th colSpan={5}></th>
                <th className="text-center px-1 py-0.5 font-normal">Top</th>
                <th className="text-center px-1 py-0.5 font-normal">Bot</th>
                <th className="text-center px-1 py-0.5 font-normal">Left</th>
                <th className="text-center px-1 py-0.5 font-normal">Right</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pieces.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
                    No pieces. Click <span className="font-medium">Add piece</span> below to start.
                  </td>
                </tr>
              )}
              {pieces.map((p, idx) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={p.nombre}
                      onChange={(e) => updatePiece(idx, { nombre: e.target.value })}
                      placeholder="Piece name"
                      className="w-full px-1.5 py-1 rounded border border-slate-200 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1 text-slate-500 text-[11px] whitespace-nowrap">
                    {MATERIAL_LABEL[p.material] ?? p.material}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={p.ancho}
                      onChange={(e) => updatePiece(idx, { ancho: Number(e.target.value) })}
                      className="w-20 px-1.5 py-1 rounded border border-slate-200 text-xs text-right tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={p.alto}
                      onChange={(e) => updatePiece(idx, { alto: Number(e.target.value) })}
                      className="w-20 px-1.5 py-1 rounded border border-slate-200 text-xs text-right tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={p.cantidad}
                      onChange={(e) => updatePiece(idx, { cantidad: Number(e.target.value) })}
                      className="w-16 px-1.5 py-1 rounded border border-slate-200 text-xs text-right tabular-nums"
                    />
                  </td>
                  {(['sup', 'inf', 'izq', 'der'] as const).map((side) => (
                    <td key={side} className="px-1 py-1">
                      <select
                        value={p.cubrecanto?.[side] ?? 0}
                        onChange={(e) => updateCubrecanto(idx, side, Number(e.target.value))}
                        className="w-full px-1 py-1 rounded border border-slate-200 text-[11px]"
                      >
                        {CUBRECANTO_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.value} · {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePiece(idx)}
                      className="!p-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                      title="Delete piece"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={addPiece} disabled={saving}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add piece
          </Button>
          <span className="text-[11px] text-slate-400 tabular-nums">
            {pieces.length} piece{pieces.length !== 1 ? 's' : ''}
          </span>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save overrides'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
