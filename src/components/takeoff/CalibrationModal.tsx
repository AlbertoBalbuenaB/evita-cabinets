import { useState } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import type { MeasurementUnit, PdfPoint, Calibration } from '../../lib/takeoff/types';
import { euclideanDistance } from '../../lib/takeoff/geometry';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pointA: PdfPoint;
  pointB: PdfPoint;
  onConfirm: (cal: Calibration) => void;
}

const units: { value: MeasurementUnit; label: string }[] = [
  { value: 'in', label: 'Inches' },
  { value: 'ft', label: 'Feet' },
  { value: 'cm', label: 'Centimeters' },
  { value: 'mm', label: 'Millimeters' },
];

export function CalibrationModal({ isOpen, onClose, pointA, pointB, onConfirm }: CalibrationModalProps) {
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<MeasurementUnit>('in');

  const pxDistance = euclideanDistance(pointA, pointB);

  const handleConfirm = () => {
    const realDistance = parseFloat(distance);
    if (!realDistance || realDistance <= 0) return;
    onConfirm({
      pointA,
      pointB,
      pxDistance,
      realDistance,
      unit,
      pixelsPerUnit: pxDistance / realDistance,
    });
    setDistance('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Calibrate Scale" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-fg-600">
          Enter the real-world distance between the two points you selected on the drawing.
        </p>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label="Known distance"
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 12"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
            />
          </div>
          <div className="w-36">
            <label className="block text-sm font-medium text-fg-700 mb-1">Unit</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as MeasurementUnit)}
              className="block w-full px-3 py-2 border border-border-solid rounded-lg shadow-sm focus:outline-none focus:ring-2 focus-visible:ring-focus focus:border-blue-500 text-sm"
            >
              {units.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={!distance || parseFloat(distance) <= 0}
          >
            Set Scale
          </Button>
        </div>
      </div>
    </Modal>
  );
}
