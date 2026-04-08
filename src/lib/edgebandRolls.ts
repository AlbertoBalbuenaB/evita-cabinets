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
  cabinets: AreaCabinet[];
}> {
  const { data: cabinets, error: cabinetsError } = await supabase
    .from('area_cabinets')
    .select('*')
    .eq('area_id', areaId);

  if (cabinetsError || !cabinets) {
    console.error('Error loading cabinets:', cabinetsError);
    return { edgebandUsages: [], cabinetCosts: [], cabinets: [] };
  }

  const { data: products, error: productsError } = await supabase
    .from('products_catalog')
    .select('*')
    .limit(2000);

  if (productsError || !products) {
    console.error('Error loading products:', productsError);
    return { edgebandUsages: [], cabinetCosts: [], cabinets: [] };
  }

  const { data: priceList, error: priceListError } = await supabase
    .from('price_list')
    .select('*');

  if (priceListError || !priceList) {
    console.error('Error loading price list:', priceListError);
    return { edgebandUsages: [], cabinetCosts: [], cabinets: [] };
  }

  // Map to aggregate total meters per edgeband finish
  const edgebandMap = new Map<string, {
    edgeband: PriceListItem;
    totalMeters: number;
    cabinetUsages: Array<{
      cabinetId: string;
      cabinet: AreaCabinet;
      product: Product;
      boxMeters: number;
      doorsMeters: number;
    }>;
  }>();

  // First pass: calculate all meters per cabinet and aggregate by edgeband
  cabinets.forEach((cabinet) => {
    const product = products.find((p) => p.sku === cabinet.product_sku);
    if (!product) return;

    const qty = cabinet.quantity;
    const boxMeters = (product.box_edgeband || 0) * qty;
    const doorsMeters = (product.doors_fronts_edgeband || 0) * qty;

    // Process box edgeband
    if (cabinet.box_edgeband_id && boxMeters > 0) {
      const edgeband = priceList.find((p) => p.id === cabinet.box_edgeband_id);
      if (edgeband && !edgeband.concept_description.toLowerCase().includes('not apply')) {
        if (!edgebandMap.has(edgeband.id)) {
          edgebandMap.set(edgeband.id, {
            edgeband,
            totalMeters: 0,
            cabinetUsages: [],
          });
        }

        const entry = edgebandMap.get(edgeband.id)!;
        const existingUsage = entry.cabinetUsages.find(u => u.cabinetId === cabinet.id);

        if (existingUsage) {
          // Cabinet already exists, add box meters
          existingUsage.boxMeters = boxMeters;
        } else {
          // New cabinet
          entry.cabinetUsages.push({
            cabinetId: cabinet.id,
            cabinet,
            product,
            boxMeters,
            doorsMeters: 0,
          });
        }
      }
    }

    // Process doors edgeband
    if (cabinet.doors_edgeband_id && doorsMeters > 0) {
      const edgeband = priceList.find((p) => p.id === cabinet.doors_edgeband_id);
      if (edgeband && !edgeband.concept_description.toLowerCase().includes('not apply')) {
        if (!edgebandMap.has(edgeband.id)) {
          edgebandMap.set(edgeband.id, {
            edgeband,
            totalMeters: 0,
            cabinetUsages: [],
          });
        }

        const entry = edgebandMap.get(edgeband.id)!;
        const existingUsage = entry.cabinetUsages.find(u => u.cabinetId === cabinet.id);

        if (existingUsage) {
          // Cabinet already exists, add doors meters
          existingUsage.doorsMeters = doorsMeters;
        } else {
          // New cabinet
          entry.cabinetUsages.push({
            cabinetId: cabinet.id,
            cabinet,
            product,
            boxMeters: 0,
            doorsMeters,
          });
        }
      }
    }
  });

  // Second pass: calculate total meters per edgeband
  edgebandMap.forEach((entry) => {
    entry.totalMeters = entry.cabinetUsages.reduce(
      (sum, usage) => sum + usage.boxMeters + usage.doorsMeters,
      0
    );
  });

  const edgebandUsages: EdgebandUsage[] = [];
  const cabinetCostsMap = new Map<string, CabinetEdgebandCost>();

  // Third pass: calculate costs based on full rolls
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

    // Calculate cost per meter based on full rolls
    const costPerMeter = totalCost / entry.totalMeters;

    // Distribute cost to each cabinet proportionally
    entry.cabinetUsages.forEach(({ cabinetId, boxMeters, doorsMeters }) => {
      const boxCost = boxMeters * costPerMeter;
      const doorsCost = doorsMeters * costPerMeter;

      if (!cabinetCostsMap.has(cabinetId)) {
        cabinetCostsMap.set(cabinetId, {
          cabinetId,
          boxEdgebandCost: 0,
          doorsEdgebandCost: 0,
        });
      }

      const cabinetCost = cabinetCostsMap.get(cabinetId)!;
      cabinetCost.boxEdgebandCost += boxCost;
      cabinetCost.doorsEdgebandCost += doorsCost;
    });
  });

  const cabinetCosts = Array.from(cabinetCostsMap.values());

  return { edgebandUsages, cabinetCosts, cabinets };
}

export async function recalculateAreaEdgebandCosts(areaId: string): Promise<boolean> {
  try {
    const { cabinetCosts, cabinets } = await calculateAreaEdgebandRolls(areaId);

    const cabinetsMap = new Map(cabinets.map(c => [c.id, c]));
    const updateResults = await Promise.all(cabinetCosts.map(cost => {
      const cabinet = cabinetsMap.get(cost.cabinetId);
      if (!cabinet) return Promise.resolve({ error: null });
      const newSubtotal =
        (cabinet.box_material_cost ?? 0) +
        cost.boxEdgebandCost +
        (cabinet.box_interior_finish_cost ?? 0) +
        (cabinet.doors_material_cost ?? 0) +
        cost.doorsEdgebandCost +
        (cabinet.doors_interior_finish_cost ?? 0) +
        (cabinet.back_panel_material_cost || 0) +
        (cabinet.hardware_cost ?? 0) +
        cabinet.accessories_cost +
        (cabinet.labor_cost ?? 0) +
        (cabinet.door_profile_cost || 0);
      return supabase
        .from('area_cabinets')
        .update({
          box_edgeband_cost: cost.boxEdgebandCost,
          doors_edgeband_cost: cost.doorsEdgebandCost,
          subtotal: newSubtotal,
        })
        .eq('id', cost.cabinetId);
    }));

    if (updateResults.some(r => r.error)) {
      console.error('Error updating cabinet costs');
      return false;
    }

    const [
      { data: updatedCabinets, error: cabinetsError },
      { data: items, error: itemsError },
      { data: countertops, error: countertopsError },
    ] = await Promise.all([
      supabase.from('area_cabinets').select('subtotal').eq('area_id', areaId),
      supabase.from('area_items').select('subtotal').eq('area_id', areaId),
      supabase.from('area_countertops').select('subtotal').eq('area_id', areaId),
    ]);

    if (cabinetsError || !updatedCabinets) {
      console.error('Error loading cabinets for area subtotal:', cabinetsError);
      return false;
    }
    if (itemsError) {
      console.error('Error loading items for area subtotal:', itemsError);
      return false;
    }
    if (countertopsError) {
      console.error('Error loading countertops for area subtotal:', countertopsError);
      return false;
    }

    const areaSubtotal =
      updatedCabinets.reduce((sum, c) => sum + (c.subtotal ?? 0), 0) +
      (items || []).reduce((sum, i) => sum + i.subtotal, 0) +
      (countertops || []).reduce((sum, ct) => sum + ct.subtotal, 0);

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
