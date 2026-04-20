import { supabase } from '../supabase';
import { getNetArea, getCutoutsFor } from './categories';
import { convertUnit } from './geometry';
import type { Measurement, MeasurementUnit } from './types';

export interface SendToQuotationParams {
  measurements: Measurement[];       // all current measurements (needed for net-area calc)
  areaId: string;                     // target project_areas.id
  displayUnit: MeasurementUnit;       // current UI unit; used when choosing qty
}

export interface SendToQuotationResult {
  insertedCount: number;
  skippedCount: number;
  skipped: { measurementId: string; reason: string }[];
}

interface PriceListRow {
  id: string;
  price: number | null;
  concept_description: string;
}

// Creates one area_items row per measurement that has a price_list linkedProduct.
// Rules:
//   - rectangle/polygon → qty = net area in displayUnit (net = gross minus cutouts).
//   - line/multiline    → qty = linear length in displayUnit.
//   - count             → qty = 1 (one pin, one row; user can consolidate later).
//   - angle/cutout      → skipped (no natural qty).
//   - any measurement without linkedProduct → skipped.
// unit_price is read from the price_list row at insert time; subtotal = qty × unit_price.
// item_name = linkedProduct.label; notes points back to the measurement.
export async function sendToQuotation({
  measurements,
  areaId,
  displayUnit,
}: SendToQuotationParams): Promise<SendToQuotationResult> {
  const linked = measurements.filter((m) => m.linkedProduct);
  if (linked.length === 0) return { insertedCount: 0, skippedCount: 0, skipped: [] };

  const priceListIds = Array.from(new Set(linked.map((m) => m.linkedProduct!.id)));
  const { data: priceRows, error: priceError } = await supabase
    .from('price_list')
    .select('id, price, concept_description')
    .in('id', priceListIds);
  if (priceError) throw new Error(`Failed to load price_list: ${priceError.message}`);

  const priceMap = new Map<string, PriceListRow>();
  (priceRows ?? []).forEach((r) => priceMap.set(r.id as string, r as PriceListRow));

  type AreaItemInsert = {
    area_id: string;
    item_name: string;
    price_list_item_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    notes: string;
  };
  const inserts: AreaItemInsert[] = [];
  const skipped: SendToQuotationResult['skipped'] = [];

  for (const m of linked) {
    const qty = deriveQuantity(m, measurements, displayUnit);
    if (qty === null || qty <= 0) {
      skipped.push({ measurementId: m.id, reason: `No quantity could be derived from ${m.type}` });
      continue;
    }
    const priceRow = priceMap.get(m.linkedProduct!.id);
    if (!priceRow) {
      skipped.push({ measurementId: m.id, reason: 'Price list item no longer exists' });
      continue;
    }
    const unitPrice = priceRow.price ?? 0;
    const subtotal = qty * unitPrice;
    inserts.push({
      area_id: areaId,
      item_name: m.linkedProduct!.label,
      price_list_item_id: priceRow.id,
      quantity: qty,
      unit_price: unitPrice,
      subtotal,
      notes: `From takeoff: ${m.name} (${m.type})`,
    });
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('area_items').insert(inserts);
    if (error) throw new Error(`area_items insert failed: ${error.message}`);
  }

  return {
    insertedCount: inserts.length,
    skippedCount: skipped.length,
    skipped,
  };
}

function deriveQuantity(m: Measurement, all: Measurement[], displayUnit: MeasurementUnit): number | null {
  if (m.type === 'line') {
    return toUnit(m.realLength, m.unit, displayUnit);
  }
  if (m.type === 'multiline') {
    return toUnit(m.totalRealLength, m.unit, displayUnit);
  }
  if (m.type === 'rectangle') {
    const net = getNetArea(m, all);
    return toUnitSquared(net, m.unit, displayUnit);
  }
  if (m.type === 'polygon') {
    const net = getNetArea(m, all);
    return toUnitSquared(net, m.unit, displayUnit);
  }
  if (m.type === 'count') {
    return 1;
  }
  return null;
}

function toUnit(value: number, from: MeasurementUnit, to: MeasurementUnit): number {
  if (from === to) return round4(value);
  return round4(convertUnit(value, from, to));
}

function toUnitSquared(value: number, from: MeasurementUnit, to: MeasurementUnit): number {
  if (from === to) return round4(value);
  const f = convertUnit(1, from, to);
  return round4(value * f * f);
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

// Silences the unused-import lint warning when callers ignore the extra cutouts helper.
export { getCutoutsFor };
