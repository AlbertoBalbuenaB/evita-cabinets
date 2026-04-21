// ─────────────────────────────────────────────────────────────
// UNIT UTILITIES
// The engine always stores and computes in mm.
// These helpers convert for display only — no engine code should import this.
// ─────────────────────────────────────────────────────────────

import { UnitSystem } from './types';

export const IN_TO_MM = 25.4;
export const M2_TO_FT2 = 10.7639104;

/** Convert a display-unit value to mm for storage */
export const toMM = (val: number, unit: UnitSystem): number =>
  unit === 'in' ? val * IN_TO_MM : val;

/** Convert a stored mm value to display units */
export const fromMM = (val: number, unit: UnitSystem): number =>
  unit === 'in' ? val / IN_TO_MM : val;

/** Format a stored mm value as a dimension string: "600mm" or "23.622\"" */
export const fmtDim = (val: number, unit: UnitSystem): string =>
  unit === 'in' ? `${(val / IN_TO_MM).toFixed(3)}"` : `${Math.round(val)}mm`;

/** Format a stored mm value as a bare number string for table cells */
export const fmtNum = (val: number, unit: UnitSystem): string =>
  unit === 'in' ? (val / IN_TO_MM).toFixed(3) : Math.round(val).toString();

/** Unit label for input field headers */
export const unitLabel = (unit: UnitSystem): string =>
  unit === 'in' ? '"' : 'mm';

/** Format an area (stored in m²) as "137.39 ft²" or "12.7635 m²" */
export const fmtArea = (m2: number, imperial: boolean): string =>
  imperial
    ? `${(m2 * M2_TO_FT2).toFixed(2)} ft²`
    : `${m2.toFixed(4)} m²`;
