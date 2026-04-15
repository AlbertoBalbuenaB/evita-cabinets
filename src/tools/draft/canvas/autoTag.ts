/**
 * Draft Tool — auto-tagging helpers (Step 10).
 *
 * Sorts the cabinets + custom-pieces of an elevation by X and assigns
 * position tags of the form `{area.prefix}-{elevation.letter}{index}`,
 * e.g. `K-A1`, `K-A2`, `K-A3`. Countertops and dimensions are skipped.
 *
 * Respects `drawings.lock_tags`: if locked, the returned plan is empty
 * (no mutations). The caller is responsible for checking
 * `show_position_tags` at render time.
 */

import type {
  DrawingElementRow,
  DrawingAreaRow,
  DrawingElevationRow,
} from '../types';

export interface TagPlan {
  updates: Array<{ id: string; tag: string }>;
}

export function generateAutoTags(
  elements: DrawingElementRow[],
  context: {
    area: DrawingAreaRow | null;
    elevation: DrawingElevationRow | null;
    lockTags: boolean;
  }
): TagPlan {
  if (context.lockTags || !context.area || !context.elevation) {
    return { updates: [] };
  }
  const prefix = context.area.prefix;
  const letter = context.elevation.letter;

  const taggable = elements
    .filter(
      (e) =>
        e.view_type === 'elevation' &&
        e.elevation_id === context.elevation!.id &&
        (e.element_type === 'cabinet' || e.element_type === 'custom_piece')
    )
    .sort((a, b) => Number(a.x_mm) - Number(b.x_mm));

  return {
    updates: taggable.map((el, idx) => ({
      id: el.id,
      tag: `${prefix}-${letter}${idx + 1}`,
    })),
  };
}
