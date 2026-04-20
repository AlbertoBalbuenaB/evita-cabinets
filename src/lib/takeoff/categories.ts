import type { Category, Measurement, RectangleMeasurement, PolygonMeasurement, CutoutMeasurement } from './types';

// Preset palette — matches the measurement color palette used by the store.
// First color is reused as default when the user creates a category without picking one.
export const CATEGORY_PALETTE = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#be185d', // pink
  '#4f46e5', // indigo
  '#ca8a04', // amber
  '#059669', // emerald
];

export function findCategory(id: string | null | undefined, categories: Category[]): Category | null {
  if (!id) return null;
  return categories.find((c) => c.id === id) ?? null;
}

// Color resolution for a measurement — prefer its category color, fall back to the measurement's own color.
export function resolveMeasurementColor(m: Measurement, categories: Category[]): string {
  const cat = findCategory(m.categoryId, categories);
  return cat?.color ?? m.color;
}

// Net area for a parent rectangle/polygon, subtracting any cutouts that reference it.
// Returned in the parent's own unit (assumes cutouts were drawn against the same calibration).
export function getNetArea(parent: RectangleMeasurement | PolygonMeasurement, all: Measurement[]): number {
  const cutouts = all.filter(
    (m): m is CutoutMeasurement => m.type === 'cutout' && m.parentId === parent.id,
  );
  const subtracted = cutouts.reduce((sum, c) => sum + c.realArea, 0);
  return Math.max(0, parent.realArea - subtracted);
}

export function getCutoutsFor(parentId: string, all: Measurement[]): CutoutMeasurement[] {
  return all.filter((m): m is CutoutMeasurement => m.type === 'cutout' && m.parentId === parentId);
}
