import { describe, it, expect } from 'vitest';
import { snapCabinetOnDrop } from '../snapHelpers';
import type { DrawingElementRow } from '../../types';

/**
 * Minimal unit tests for the snap helpers. We construct partial
 * DrawingElementRow objects via `as DrawingElementRow` because most of the
 * row fields are irrelevant to the snap logic and casting keeps the tests
 * focused on geometry.
 */

function wallRow(
  x: number,
  y: number,
  length: number,
  rotDeg: number,
  id = crypto.randomUUID()
): DrawingElementRow {
  return {
    id,
    drawing_id: 'd1',
    area_id: null,
    elevation_id: null,
    view_type: 'plan',
    element_type: 'wall',
    product_id: null,
    tag: null,
    x_mm: x,
    y_mm: y,
    rotation_deg: rotDeg,
    width_mm: length,
    height_mm: 114.3, // 4.5"
    depth_mm: null,
    props: { type: 'wall', thickness_mm: 114.3 } as unknown as DrawingElementRow['props'],
    z_index: -10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as DrawingElementRow;
}

describe('snapCabinetOnDrop', () => {
  it('returns unsnapped coords when there are no walls in plan view', () => {
    const result = snapCabinetOnDrop(
      100,
      200,
      { family: 'base', width_mm: 600, depth_mm: 600 },
      [],
      'plan'
    );
    expect(result.snapped).toBe(false);
    expect(result.x_mm).toBe(100);
    expect(result.y_mm).toBe(200);
  });

  it('snaps a base cabinet to the floor in elevation view', () => {
    const result = snapCabinetOnDrop(
      500,
      1234,
      { family: 'base', width_mm: 600, depth_mm: 600 },
      [],
      'elevation'
    );
    expect(result.snapped).toBe(true);
    expect(result.y_mm).toBe(0);
  });

  it('snaps a wall cabinet to 54" AFF in elevation view', () => {
    const result = snapCabinetOnDrop(
      500,
      100,
      { family: 'wall', width_mm: 600, depth_mm: 300 },
      [],
      'elevation'
    );
    expect(result.snapped).toBe(true);
    // 54" = 1371.6 mm
    expect(result.y_mm).toBeCloseTo(1371.6, 1);
  });

  it('snaps a cabinet dropped near a horizontal wall to its inside face', () => {
    // Horizontal wall of length 3000mm starting at (0,0), rotation 0°.
    // Interior of the wall is on the +y side.
    const walls = [wallRow(0, 0, 3000, 0)];
    const result = snapCabinetOnDrop(
      1500, // mid-length
      100, // 100mm above the wall (within 304.8mm snap distance)
      { family: 'base', width_mm: 600, depth_mm: 600 },
      walls,
      'plan'
    );
    expect(result.snapped).toBe(true);
    // Rotation matches wall (0°)
    expect(result.rotation_deg).toBeCloseTo(0, 1);
    // y should be ~57.15mm (half of 4.5" thickness)
    expect(result.y_mm).toBeCloseTo(57.15, 0);
  });

  it('does not snap when the cabinet is farther than 12" from any wall', () => {
    const walls = [wallRow(0, 0, 3000, 0)];
    const result = snapCabinetOnDrop(
      1500,
      500, // 500mm above the wall — outside the 304.8mm range
      { family: 'base', width_mm: 600, depth_mm: 600 },
      walls,
      'plan'
    );
    expect(result.snapped).toBe(false);
  });
});
