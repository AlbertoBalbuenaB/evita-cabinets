import { describe, it, expect } from 'vitest';
import {
  generateCountertopOutlines,
  buildCountertopProps,
} from '../countertopGeometry';
import type { DrawingElementRow } from '../../types';
import { inToMm } from '../../utils/format';

function cabRow(
  x: number,
  y: number,
  width: number,
  depth: number,
  rotDeg = 0,
  id = crypto.randomUUID()
): DrawingElementRow {
  return {
    id,
    drawing_id: 'd1',
    area_id: null,
    elevation_id: null,
    view_type: 'plan',
    element_type: 'cabinet',
    product_id: null,
    tag: null,
    x_mm: x,
    y_mm: y,
    rotation_deg: rotDeg,
    width_mm: width,
    height_mm: 762, // 30"
    depth_mm: depth,
    props: { type: 'cabinet' } as unknown as DrawingElementRow['props'],
    z_index: 0,
    created_at: null,
    updated_at: null,
  } as DrawingElementRow;
}

describe('generateCountertopOutlines', () => {
  it('returns empty when there are no cabinets', () => {
    expect(generateCountertopOutlines([])).toEqual([]);
  });

  it('produces a single outline for a straight run of 3 base cabinets', () => {
    // Three 24"D × 36"W cabinets lined up along y=0, x=0, 914, 1828
    const w = inToMm(36);
    const d = inToMm(24);
    const cabs = [
      cabRow(0, 0, w, d),
      cabRow(w, 0, w, d),
      cabRow(2 * w, 0, w, d),
    ];
    const outlines = generateCountertopOutlines(cabs);
    expect(outlines).toHaveLength(1);
    expect(outlines[0].associated_cabinet_ids).toHaveLength(3);
    // localDepth should equal cabinet depth + 1" overhang
    expect(outlines[0].localDepth).toBeCloseTo(d + inToMm(1), 1);
    // localWidth should equal total run + 2×run_end offset (2")
    expect(outlines[0].localWidth).toBeCloseTo(3 * w + 2 * inToMm(2), 0);
    // Outline is a 4-vertex rectangle
    expect(outlines[0].outline_mm).toHaveLength(4);
  });

  it('groups cabinets with different rotations into separate outlines', () => {
    const w = inToMm(30);
    const d = inToMm(24);
    const cabs = [
      cabRow(0, 0, w, d, 0),
      cabRow(0, 0, w, d, 90),
    ];
    const outlines = generateCountertopOutlines(cabs);
    expect(outlines).toHaveLength(2);
  });
});

describe('buildCountertopProps', () => {
  it('preserves material + edge + backsplash settings', () => {
    const outline = {
      outline_mm: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 600 },
        { x: 0, y: 600 },
      ],
      associated_cabinet_ids: ['a', 'b'],
      rotation_deg: 0,
      origin: { x: 0, y: 0 },
      localWidth: 1000,
      localDepth: 600,
    };
    const props = buildCountertopProps(
      outline,
      'Quartz Calacatta',
      1.5,
      'eased',
      { present: true, height_in: 4, material_label: 'matching' }
    );
    expect(props.type).toBe('countertop');
    expect(props.material_label).toBe('Quartz Calacatta');
    expect(props.thickness_in).toBe(1.5);
    expect(props.edge_profile).toBe('eased');
    expect(props.backsplash?.height_in).toBe(4);
    expect(props.associated_cabinet_ids).toEqual(['a', 'b']);
    expect(props.outline_mm).toHaveLength(4);
  });
});
