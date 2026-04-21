/**
 * Draft Tool — Auto Countertop creation modal (Step 7.6).
 *
 * Opens when the user clicks "Auto Countertop" in the canvas toolbar with
 * at least one base/sink/drawer cabinet selected. Collects material,
 * thickness, edge profile, and backsplash settings, then calls the
 * provided `onCreate` callback with a `CountertopProps` object that the
 * caller (DraftCanvas) persists via `addElement`.
 *
 * Free-text material label in Phase 1; Phase 2 replaces this with a
 * picker backed by the `countertop_materials` table.
 */

import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import type { CountertopProps } from '../types';

interface CountertopModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMaterial?: string;
  selectedCount: number;
  onCreate: (settings: {
    materialLabel: string;
    thicknessIn: number;
    edgeProfile: CountertopProps['edge_profile'];
    backsplash?: { present: boolean; height_in: number; material_label: string };
  }) => void;
}

const EDGE_PROFILES: CountertopProps['edge_profile'][] = [
  'eased',
  'bullnose',
  'ogee',
  'square',
  'mitered_waterfall',
];

export function CountertopModal({
  isOpen,
  onClose,
  defaultMaterial = '',
  selectedCount,
  onCreate,
}: CountertopModalProps) {
  const [materialLabel, setMaterialLabel] = useState(defaultMaterial);
  const [thicknessIn, setThicknessIn] = useState(1.5);
  const [edgeProfile, setEdgeProfile] =
    useState<CountertopProps['edge_profile']>('eased');
  const [hasBackplash, setHasBacksplash] = useState(true);
  const [backsplashHeight, setBacksplashHeight] = useState(4);
  const [backsplashMaterial, setBacksplashMaterial] = useState('matching');

  function handleSubmit() {
    if (!materialLabel.trim()) return;
    onCreate({
      materialLabel: materialLabel.trim(),
      thicknessIn,
      edgeProfile,
      backsplash: hasBackplash
        ? {
            present: true,
            height_in: backsplashHeight,
            material_label: backsplashMaterial.trim() || 'matching',
          }
        : undefined,
    });
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Auto Countertop" size="md">
      <div className="space-y-4">
        <div className="text-xs text-fg-500">
          Generating a countertop from{' '}
          <strong className="text-fg-700">{selectedCount}</strong> selected
          cabinet{selectedCount === 1 ? '' : 's'} with a 1" front overhang.
        </div>

        <div>
          <label className="block text-xs font-medium text-fg-600 mb-1">
            Material label
          </label>
          <input
            type="text"
            value={materialLabel}
            onChange={(e) => setMaterialLabel(e.target.value)}
            placeholder="e.g. Evita Elite, Quartz Calacatta"
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-border-solid bg-surf-card text-sm text-fg-700 focus:outline-none focus:ring-2 focus-visible:ring-focus"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-fg-600 mb-1">
              Thickness (in)
            </label>
            <input
              type="number"
              step="0.25"
              min="0.5"
              value={thicknessIn}
              onChange={(e) => setThicknessIn(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border-solid bg-surf-card text-sm text-fg-700 focus:outline-none focus:ring-2 focus-visible:ring-focus"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-600 mb-1">
              Edge profile
            </label>
            <select
              value={edgeProfile}
              onChange={(e) =>
                setEdgeProfile(e.target.value as CountertopProps['edge_profile'])
              }
              className="w-full px-3 py-2 rounded-lg border border-border-solid bg-surf-card text-sm text-fg-700"
            >
              {EDGE_PROFILES.map((p) => (
                <option key={p} value={p}>
                  {p.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="glass-blue rounded-lg p-3 space-y-3">
          <label className="flex items-center gap-2 text-xs font-medium text-fg-700">
            <input
              type="checkbox"
              checked={hasBackplash}
              onChange={(e) => setHasBacksplash(e.target.checked)}
            />
            Include backsplash
          </label>
          {hasBackplash && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-fg-600 mb-1">
                  Height (in)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0.5"
                  value={backsplashHeight}
                  onChange={(e) => setBacksplashHeight(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-border-solid bg-surf-card text-xs text-fg-700"
                />
              </div>
              <div>
                <label className="block text-xs text-fg-600 mb-1">
                  Material
                </label>
                <input
                  type="text"
                  value={backsplashMaterial}
                  placeholder="matching"
                  onChange={(e) => setBacksplashMaterial(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-solid bg-surf-card text-xs text-fg-700"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border-soft">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!materialLabel.trim() || selectedCount === 0}
            onClick={handleSubmit}
          >
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}
