import { supabase } from './supabase';
import type { AreaCabinet, Product, PriceListItem } from '../types';

const ROLL_LENGTH_METERS = 150;

export interface EdgebandUsage {
  edgebandId: string;
  edgebandName: string;
  totalMeters: number;
  rollsNeeded: number;
  totalMetersRounded: number;
  pricePerMeter: number;
  totalCost: number;
}

export interface CabinetEdgebandCost {
  cabinetId: string;
  boxEdgebandCost: number;
  doorsEdgebandCost: number;
}

export async function calculateAreaEdgebandRolls(
  areaId: string
): Promise<{
  edgebandUsages: EdgebandUsage[];
  cabinetCosts: CabinetEdgebandCost[];
}> {
  const { data: cabinets, error: cabinetsError } = await supabase
    .from('area_cabinets')
    .select('*')
    .eq('area_id', areaId);

  if (cabinetsError || !cabinets) {
    console.error('Error loading cabinets:', cabinetsError);
    return { edgebandUsages: [], cabinetCosts: [] };
  }

  const { data: products, error: productsError } = await supabase
    .from('products_catalog')
    .select('*');

  if (productsError || !products) {
    console.error('Error loading products:', productsError);
    return { edgebandUsages: [], cabinetCosts: [] };
  }

  const { data: priceList, error: priceListError } = await supabase
    .from('price_list')
    .select('*');

  if (priceListError || !priceList) {
    console.error('Error loading price list:', priceListError);
    return { edgebandUsages: [], cabinetCosts: [] };
  }

  const edgebandMap = new Map<string, {
    edgeband: PriceListItem;
    cabinetsUsing: Array<{
      cabinet: AreaCabinet;
      product: Product;
      boxMeters: number;
      doorsMeters: number;
    }>;
    totalMeters: number;
  }>();

  cabinets.forEach((cabinet) => {
    const product = products.find((p) => p.sku === cabinet.product_sku);
    if (!product) return;

    const boxMeters = (product.box_edgeband || 0) * cabinet.quantity;
    const doorsMeters = (product.doors_fronts_edgeband || 0) * cabinet.quantity;

    if (cabinet.box_edgeband_id && boxMeters > 0) {
      const edgeband = priceList.find((p) => p.id === cabinet.box_edgeband_id);
      if (edgeband) {
        if (!edgebandMap.has(edgeband.id)) {
          edgebandMap.set(edgeband.id, {
            edgeband,
            cabinetsUsing: [],
            totalMeters: 0,
          });
        }
        const entry = edgebandMap.get(edgeband.id)!;
        entry.cabinetsUsing.push({
          cabinet,
          product,
          boxMeters,
          doorsMeters: 0,
        });
        entry.totalMeters += boxMeters;
      }
    }

    if (cabinet.doors_edgeband_id && doorsMeters > 0) {
      const edgeband = priceList.find((p) => p.id === cabinet.doors_edgeband_id);
      if (edgeband) {
        if (!edgebandMap.has(edgeband.id)) {
          edgebandMap.set(edgeband.id, {
            edgeband,
            cabinetsUsing: [],
            totalMeters: 0,
          });
        }
        const entry = edgebandMap.get(edgeband.id)!;

        const existingCabinet = entry.cabinetsUsing.find(
          (c) => c.cabinet.id === cabinet.id
        );
        if (existingCabinet) {
          existingCabinet.doorsMeters = doorsMeters;
        } else {
          entry.cabinetsUsing.push({
            cabinet,
            product,
            boxMeters: 0,
            doorsMeters,
          });
        }
        entry.totalMeters += doorsMeters;
      }
    }
  });

  const edgebandUsages: EdgebandUsage[] = [];
  const cabinetCostsMap = new Map<string, CabinetEdgebandCost>();

  edgebandMap.forEach((entry, edgebandId) => {
    const rollsNeeded = Math.ceil(entry.totalMeters / ROLL_LENGTH_METERS);
    const totalMetersRounded = rollsNeeded * ROLL_LENGTH_METERS;
    const pricePerMeter = entry.edgeband.price_with_tax || entry.edgeband.price;
    const totalCost = totalMetersRounded * pricePerMeter;

    edgebandUsages.push({
      edgebandId,
      edgebandName: entry.edgeband.concept_description,
      totalMeters: entry.totalMeters,
      rollsNeeded,
      totalMetersRounded,
      pricePerMeter,
      totalCost,
    });

    const costPerMeter = totalCost / entry.totalMeters;

    entry.cabinetsUsing.forEach(({ cabinet, boxMeters, doorsMeters }) => {
      const boxCost = boxMeters * costPerMeter;
      const doorsCost = doorsMeters * costPerMeter;

      if (!cabinetCostsMap.has(cabinet.id)) {
        cabinetCostsMap.set(cabinet.id, {
          cabinetId: cabinet.id,
          boxEdgebandCost: 0,
          doorsEdgebandCost: 0,
        });
      }

      const cabinetCost = cabinetCostsMap.get(cabinet.id)!;
      cabinetCost.boxEdgebandCost += boxCost;
      cabinetCost.doorsEdgebandCost += doorsCost;
    });
  });

  const cabinetCosts = Array.from(cabinetCostsMap.values());

  return { edgebandUsages, cabinetCosts };
}

export async function recalculateAreaEdgebandCosts(areaId: string): Promise<boolean> {
  try {
    const { edgebandUsages, cabinetCosts } = await calculateAreaEdgebandRolls(areaId);

    for (const cost of cabinetCosts) {
      const { data: cabinet, error: fetchError } = await supabase
        .from('area_cabinets')
        .select('*')
        .eq('id', cost.cabinetId)
        .single();

      if (fetchError || !cabinet) {
        console.error('Error fetching cabinet:', fetchError);
        continue;
      }

      const newSubtotal =
        cabinet.box_material_cost +
        cost.boxEdgebandCost +
        cabinet.box_interior_finish_cost +
        cabinet.doors_material_cost +
        cost.doorsEdgebandCost +
        cabinet.doors_interior_finish_cost +
        cabinet.hardware_cost +
        cabinet.labor_cost;

      const { error: updateError } = await supabase
        .from('area_cabinets')
        .update({
          box_edgeband_cost: cost.boxEdgebandCost,
          doors_edgeband_cost: cost.doorsEdgebandCost,
          subtotal: newSubtotal,
        })
        .eq('id', cost.cabinetId);

      if (updateError) {
        console.error('Error updating cabinet costs:', updateError);
        return false;
      }
    }

    const { data: cabinets, error: cabinetsError } = await supabase
      .from('area_cabinets')
      .select('subtotal')
      .eq('area_id', areaId);

    if (cabinetsError || !cabinets) {
      console.error('Error loading cabinets for area subtotal:', cabinetsError);
      return false;
    }

    const { data: items, error: itemsError } = await supabase
      .from('area_items')
      .select('subtotal')
      .eq('area_id', areaId);

    if (itemsError) {
      console.error('Error loading items for area subtotal:', itemsError);
      return false;
    }

    const areaSubtotal =
      cabinets.reduce((sum, c) => sum + c.subtotal, 0) +
      (items || []).reduce((sum, i) => sum + i.subtotal, 0);

    const { error: areaUpdateError } = await supabase
      .from('project_areas')
      .update({ subtotal: areaSubtotal })
      .eq('id', areaId);

    if (areaUpdateError) {
      console.error('Error updating area subtotal:', areaUpdateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error recalculating edgeband costs:', error);
    return false;
  }
}
