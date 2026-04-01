import { supabase } from './supabase';
import type { AreaCabinet, Product, PriceListItem } from '../types';
import { parseDimensions } from './calculations';

export interface SheetMaterialUsage {
  materialId: string;
  materialName: string;
  materialType: 'box' | 'doors' | 'box_interior_finish' | 'doors_interior_finish' | 'back_panel';
  totalSF: number;
  sfPerSheet: number;
  sheetsNeeded: number;
  totalSFRounded: number;
  pricePerSheet: number;
  totalCost: number;
}

export interface CabinetSheetMaterialCost {
  cabinetId: string;
  boxMaterialCost: number;
  doorsMaterialCost: number;
  boxInteriorFinishCost: number;
  doorsInteriorFinishCost: number;
  backPanelMaterialCost: number;
}

function isSheetMaterial(type: string): boolean {
  const typeLower = type.toLowerCase();
  return (
    typeLower.includes('laminate') ||
    typeLower.includes('melamine') ||
    typeLower.includes('plywood') ||
    typeLower.includes('mdf') ||
    typeLower.includes('veneer')
  );
}

export async function calculateAreaSheetMaterials(
  areaId: string
): Promise<{
  sheetUsages: SheetMaterialUsage[];
  cabinetCosts: CabinetSheetMaterialCost[];
  cabinets: AreaCabinet[];
}> {
  const { data: cabinets, error: cabinetsError } = await supabase
    .from('area_cabinets')
    .select('*')
    .eq('area_id', areaId);

  if (cabinetsError || !cabinets) {
    console.error('Error loading cabinets:', cabinetsError);
    return { sheetUsages: [], cabinetCosts: [], cabinets: [] };
  }

  const { data: products, error: productsError } = await supabase
    .from('products_catalog')
    .select('*')
    .limit(2000);

  if (productsError || !products) {
    console.error('Error loading products:', productsError);
    return { sheetUsages: [], cabinetCosts: [] };
  }

  const { data: priceList, error: priceListError } = await supabase
    .from('price_list')
    .select('*');

  if (priceListError || !priceList) {
    console.error('Error loading price list:', priceListError);
    return { sheetUsages: [], cabinetCosts: [] };
  }

  const boxMaterialsMap = new Map<string, {
    material: PriceListItem;
    cabinetsUsing: Array<{
      cabinet: AreaCabinet;
      product: Product;
      sfNeeded: number;
    }>;
    totalSF: number;
    sfPerSheet: number;
  }>();

  const doorsMaterialsMap = new Map<string, {
    material: PriceListItem;
    cabinetsUsing: Array<{
      cabinet: AreaCabinet;
      product: Product;
      sfNeeded: number;
    }>;
    totalSF: number;
    sfPerSheet: number;
  }>();

  const backPanelMaterialsMap = new Map<string, {
    material: PriceListItem;
    cabinetsUsing: Array<{
      cabinet: AreaCabinet;
      product: Product;
      sfNeeded: number;
    }>;
    totalSF: number;
    sfPerSheet: number;
  }>();

  cabinets.forEach((cabinet) => {
    const product = products.find((p) => p.sku === cabinet.product_sku);
    if (!product) return;

    const backPanelSF = cabinet.use_back_panel_material ? (cabinet.back_panel_sf || 0) : 0;

    if (cabinet.box_material_id) {
      const material = priceList.find((p) => p.id === cabinet.box_material_id);
      if (material && isSheetMaterial(material.type) && !material.concept_description.toLowerCase().includes('not apply')) {
        const sfPerSheet = material.sf_per_sheet || parseDimensions(material.dimensions);
        const sfNeeded = Math.max(0, (product.box_sf * cabinet.quantity) - backPanelSF);

        if (!boxMaterialsMap.has(material.id)) {
          boxMaterialsMap.set(material.id, {
            material,
            cabinetsUsing: [],
            totalSF: 0,
            sfPerSheet,
          });
        }

        const entry = boxMaterialsMap.get(material.id)!;
        entry.cabinetsUsing.push({
          cabinet,
          product,
          sfNeeded,
        });
        entry.totalSF += sfNeeded;
      }
    }

    if (cabinet.doors_material_id) {
      const material = priceList.find((p) => p.id === cabinet.doors_material_id);
      if (material && isSheetMaterial(material.type) && !material.concept_description.toLowerCase().includes('not apply')) {
        const sfPerSheet = material.sf_per_sheet || parseDimensions(material.dimensions);
        const sfNeeded = product.doors_fronts_sf * cabinet.quantity;

        if (!doorsMaterialsMap.has(material.id)) {
          doorsMaterialsMap.set(material.id, {
            material,
            cabinetsUsing: [],
            totalSF: 0,
            sfPerSheet,
          });
        }

        const entry = doorsMaterialsMap.get(material.id)!;
        entry.cabinetsUsing.push({
          cabinet,
          product,
          sfNeeded,
        });
        entry.totalSF += sfNeeded;
      }
    }

    if (cabinet.use_back_panel_material && cabinet.back_panel_material_id && cabinet.back_panel_sf) {
      const material = priceList.find((p) => p.id === cabinet.back_panel_material_id);
      if (material && isSheetMaterial(material.type) && !material.concept_description.toLowerCase().includes('not apply')) {
        const sfPerSheet = material.sf_per_sheet || parseDimensions(material.dimensions);
        const sfNeeded = cabinet.back_panel_sf;

        if (!backPanelMaterialsMap.has(material.id)) {
          backPanelMaterialsMap.set(material.id, {
            material,
            cabinetsUsing: [],
            totalSF: 0,
            sfPerSheet,
          });
        }

        const entry = backPanelMaterialsMap.get(material.id)!;
        entry.cabinetsUsing.push({
          cabinet,
          product,
          sfNeeded,
        });
        entry.totalSF += sfNeeded;
      }
    }
  });

  const sheetUsages: SheetMaterialUsage[] = [];
  const cabinetCostsMap = new Map<string, CabinetSheetMaterialCost>();

  boxMaterialsMap.forEach((entry, materialId) => {
    const sheetsNeeded = Math.ceil(entry.totalSF / entry.sfPerSheet);
    const totalSFRounded = sheetsNeeded * entry.sfPerSheet;
    const pricePerSheet = entry.material.price_with_tax || entry.material.price;
    const totalCost = sheetsNeeded * pricePerSheet;

    sheetUsages.push({
      materialId,
      materialName: entry.material.concept_description,
      materialType: 'box',
      totalSF: entry.totalSF,
      sfPerSheet: entry.sfPerSheet,
      sheetsNeeded,
      totalSFRounded,
      pricePerSheet,
      totalCost,
    });

    const costPerSF = totalCost / entry.totalSF;

    entry.cabinetsUsing.forEach(({ cabinet, sfNeeded }) => {
      const cost = sfNeeded * costPerSF;

      if (!cabinetCostsMap.has(cabinet.id)) {
        cabinetCostsMap.set(cabinet.id, {
          cabinetId: cabinet.id,
          boxMaterialCost: 0,
          doorsMaterialCost: 0,
          boxInteriorFinishCost: 0,
          doorsInteriorFinishCost: 0,
          backPanelMaterialCost: 0,
        });
      }

      const cabinetCost = cabinetCostsMap.get(cabinet.id)!;
      cabinetCost.boxMaterialCost += cost;
    });
  });

  doorsMaterialsMap.forEach((entry, materialId) => {
    const sheetsNeeded = Math.ceil(entry.totalSF / entry.sfPerSheet);
    const totalSFRounded = sheetsNeeded * entry.sfPerSheet;
    const pricePerSheet = entry.material.price_with_tax || entry.material.price;
    const totalCost = sheetsNeeded * pricePerSheet;

    sheetUsages.push({
      materialId,
      materialName: entry.material.concept_description,
      materialType: 'doors',
      totalSF: entry.totalSF,
      sfPerSheet: entry.sfPerSheet,
      sheetsNeeded,
      totalSFRounded,
      pricePerSheet,
      totalCost,
    });

    const costPerSF = totalCost / entry.totalSF;

    entry.cabinetsUsing.forEach(({ cabinet, sfNeeded }) => {
      const cost = sfNeeded * costPerSF;

      if (!cabinetCostsMap.has(cabinet.id)) {
        cabinetCostsMap.set(cabinet.id, {
          cabinetId: cabinet.id,
          boxMaterialCost: 0,
          doorsMaterialCost: 0,
          boxInteriorFinishCost: 0,
          doorsInteriorFinishCost: 0,
          backPanelMaterialCost: 0,
        });
      }

      const cabinetCost = cabinetCostsMap.get(cabinet.id)!;
      cabinetCost.doorsMaterialCost += cost;
    });
  });

  backPanelMaterialsMap.forEach((entry, materialId) => {
    const sheetsNeeded = Math.ceil(entry.totalSF / entry.sfPerSheet);
    const totalSFRounded = sheetsNeeded * entry.sfPerSheet;
    const pricePerSheet = entry.material.price_with_tax || entry.material.price;
    const totalCost = sheetsNeeded * pricePerSheet;

    sheetUsages.push({
      materialId,
      materialName: entry.material.concept_description,
      materialType: 'back_panel',
      totalSF: entry.totalSF,
      sfPerSheet: entry.sfPerSheet,
      sheetsNeeded,
      totalSFRounded,
      pricePerSheet,
      totalCost,
    });

    const costPerSF = totalCost / entry.totalSF;

    entry.cabinetsUsing.forEach(({ cabinet, sfNeeded }) => {
      const cost = sfNeeded * costPerSF;

      if (!cabinetCostsMap.has(cabinet.id)) {
        cabinetCostsMap.set(cabinet.id, {
          cabinetId: cabinet.id,
          boxMaterialCost: 0,
          doorsMaterialCost: 0,
          boxInteriorFinishCost: 0,
          doorsInteriorFinishCost: 0,
          backPanelMaterialCost: 0,
        });
      }

      const cabinetCost = cabinetCostsMap.get(cabinet.id)!;
      cabinetCost.backPanelMaterialCost += cost;
    });
  });

  const boxInteriorFinishMap = new Map<string, {
    material: PriceListItem;
    cabinetsUsing: Array<{
      cabinet: AreaCabinet;
      product: Product;
      sfNeeded: number;
    }>;
    totalSF: number;
    sfPerSheet: number;
  }>();

  const doorsInteriorFinishMap = new Map<string, {
    material: PriceListItem;
    cabinetsUsing: Array<{
      cabinet: AreaCabinet;
      product: Product;
      sfNeeded: number;
    }>;
    totalSF: number;
    sfPerSheet: number;
  }>();

  cabinets.forEach((cabinet) => {
    const product = products.find((p) => p.sku === cabinet.product_sku);
    if (!product) return;

    const backPanelSF = cabinet.use_back_panel_material ? (cabinet.back_panel_sf || 0) : 0;

    if (cabinet.box_interior_finish_id) {
      const material = priceList.find((p) => p.id === cabinet.box_interior_finish_id);
      if (material && isSheetMaterial(material.type) && !material.concept_description.toLowerCase().includes('not apply')) {
        const sfPerSheet = material.sf_per_sheet || parseDimensions(material.dimensions);
        const sfNeeded = Math.max(0, (product.box_sf * cabinet.quantity) - backPanelSF);

        if (!boxInteriorFinishMap.has(material.id)) {
          boxInteriorFinishMap.set(material.id, {
            material,
            cabinetsUsing: [],
            totalSF: 0,
            sfPerSheet,
          });
        }

        const entry = boxInteriorFinishMap.get(material.id)!;
        entry.cabinetsUsing.push({
          cabinet,
          product,
          sfNeeded,
        });
        entry.totalSF += sfNeeded;
      }
    }

    if (cabinet.doors_interior_finish_id) {
      const material = priceList.find((p) => p.id === cabinet.doors_interior_finish_id);
      if (material && isSheetMaterial(material.type) && !material.concept_description.toLowerCase().includes('not apply')) {
        const sfPerSheet = material.sf_per_sheet || parseDimensions(material.dimensions);
        const sfNeeded = product.doors_fronts_sf * cabinet.quantity;

        if (!doorsInteriorFinishMap.has(material.id)) {
          doorsInteriorFinishMap.set(material.id, {
            material,
            cabinetsUsing: [],
            totalSF: 0,
            sfPerSheet,
          });
        }

        const entry = doorsInteriorFinishMap.get(material.id)!;
        entry.cabinetsUsing.push({
          cabinet,
          product,
          sfNeeded,
        });
        entry.totalSF += sfNeeded;
      }
    }
  });

  boxInteriorFinishMap.forEach((entry, materialId) => {
    const sheetsNeeded = Math.ceil(entry.totalSF / entry.sfPerSheet);
    const totalSFRounded = sheetsNeeded * entry.sfPerSheet;
    const pricePerSheet = entry.material.price_with_tax || entry.material.price;
    const totalCost = sheetsNeeded * pricePerSheet;

    sheetUsages.push({
      materialId,
      materialName: entry.material.concept_description,
      materialType: 'box_interior_finish',
      totalSF: entry.totalSF,
      sfPerSheet: entry.sfPerSheet,
      sheetsNeeded,
      totalSFRounded,
      pricePerSheet,
      totalCost,
    });

    const costPerSF = totalCost / entry.totalSF;

    entry.cabinetsUsing.forEach(({ cabinet, sfNeeded }) => {
      const cost = sfNeeded * costPerSF;

      if (!cabinetCostsMap.has(cabinet.id)) {
        cabinetCostsMap.set(cabinet.id, {
          cabinetId: cabinet.id,
          boxMaterialCost: 0,
          doorsMaterialCost: 0,
          boxInteriorFinishCost: 0,
          doorsInteriorFinishCost: 0,
          backPanelMaterialCost: 0,
        });
      }

      const cabinetCost = cabinetCostsMap.get(cabinet.id)!;
      cabinetCost.boxInteriorFinishCost += cost;
    });
  });

  doorsInteriorFinishMap.forEach((entry, materialId) => {
    const sheetsNeeded = Math.ceil(entry.totalSF / entry.sfPerSheet);
    const totalSFRounded = sheetsNeeded * entry.sfPerSheet;
    const pricePerSheet = entry.material.price_with_tax || entry.material.price;
    const totalCost = sheetsNeeded * pricePerSheet;

    sheetUsages.push({
      materialId,
      materialName: entry.material.concept_description,
      materialType: 'doors_interior_finish',
      totalSF: entry.totalSF,
      sfPerSheet: entry.sfPerSheet,
      sheetsNeeded,
      totalSFRounded,
      pricePerSheet,
      totalCost,
    });

    const costPerSF = totalCost / entry.totalSF;

    entry.cabinetsUsing.forEach(({ cabinet, sfNeeded }) => {
      const cost = sfNeeded * costPerSF;

      if (!cabinetCostsMap.has(cabinet.id)) {
        cabinetCostsMap.set(cabinet.id, {
          cabinetId: cabinet.id,
          boxMaterialCost: 0,
          doorsMaterialCost: 0,
          boxInteriorFinishCost: 0,
          doorsInteriorFinishCost: 0,
          backPanelMaterialCost: 0,
        });
      }

      const cabinetCost = cabinetCostsMap.get(cabinet.id)!;
      cabinetCost.doorsInteriorFinishCost += cost;
    });
  });

  const cabinetCosts = Array.from(cabinetCostsMap.values());

  return { sheetUsages, cabinetCosts, cabinets };
}

export async function recalculateAreaSheetMaterialCosts(areaId: string): Promise<boolean> {
  try {
    const { sheetUsages, cabinetCosts, cabinets } = await calculateAreaSheetMaterials(areaId);

    const cabinetsMap = new Map(cabinets.map(c => [c.id, c]));
    const updateResults = await Promise.all(cabinetCosts.map(cost => {
      const cabinet = cabinetsMap.get(cost.cabinetId);
      if (!cabinet) return Promise.resolve({ error: null });
      const newSubtotal =
        cost.boxMaterialCost +
        cabinet.box_edgeband_cost +
        cost.boxInteriorFinishCost +
        cost.doorsMaterialCost +
        cabinet.doors_edgeband_cost +
        cost.doorsInteriorFinishCost +
        cost.backPanelMaterialCost +
        cabinet.hardware_cost +
        cabinet.accessories_cost +
        cabinet.labor_cost +
        (cabinet.door_profile_cost || 0);
      return supabase
        .from('area_cabinets')
        .update({
          box_material_cost: cost.boxMaterialCost,
          doors_material_cost: cost.doorsMaterialCost,
          box_interior_finish_cost: cost.boxInteriorFinishCost,
          doors_interior_finish_cost: cost.doorsInteriorFinishCost,
          back_panel_material_cost: cost.backPanelMaterialCost,
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
      updatedCabinets.reduce((sum, c) => sum + c.subtotal, 0) +
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
    console.error('Error recalculating sheet material costs:', error);
    return false;
  }
}
