import { supabase } from './supabase';
import type { AreaCabinet, Product, PriceListItem } from '../types';
import { parseDimensions } from './calculations';

export interface SheetMaterialUsage {
  materialId: string;
  materialName: string;
  materialType: 'box' | 'doors';
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
}> {
  const { data: cabinets, error: cabinetsError } = await supabase
    .from('area_cabinets')
    .select('*')
    .eq('area_id', areaId);

  if (cabinetsError || !cabinets) {
    console.error('Error loading cabinets:', cabinetsError);
    return { sheetUsages: [], cabinetCosts: [] };
  }

  const { data: products, error: productsError } = await supabase
    .from('products_catalog')
    .select('*');

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

  cabinets.forEach((cabinet) => {
    const product = products.find((p) => p.sku === cabinet.product_sku);
    if (!product) return;

    if (cabinet.box_material_id) {
      const material = priceList.find((p) => p.id === cabinet.box_material_id);
      if (material && isSheetMaterial(material.type)) {
        const sfPerSheet = material.sf_per_sheet || parseDimensions(material.dimensions);
        const sfNeeded = product.box_sf * cabinet.quantity;

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
      if (material && isSheetMaterial(material.type)) {
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
        });
      }

      const cabinetCost = cabinetCostsMap.get(cabinet.id)!;
      cabinetCost.doorsMaterialCost += cost;
    });
  });

  const cabinetCosts = Array.from(cabinetCostsMap.values());

  return { sheetUsages, cabinetCosts };
}

export async function recalculateAreaSheetMaterialCosts(areaId: string): Promise<boolean> {
  try {
    const { sheetUsages, cabinetCosts } = await calculateAreaSheetMaterials(areaId);

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
        cost.boxMaterialCost +
        cabinet.box_edgeband_cost +
        cabinet.box_interior_finish_cost +
        cost.doorsMaterialCost +
        cabinet.doors_edgeband_cost +
        cabinet.doors_interior_finish_cost +
        cabinet.hardware_cost +
        cabinet.labor_cost;

      const { error: updateError } = await supabase
        .from('area_cabinets')
        .update({
          box_material_cost: cost.boxMaterialCost,
          doors_material_cost: cost.doorsMaterialCost,
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
    console.error('Error recalculating sheet material costs:', error);
    return false;
  }
}
