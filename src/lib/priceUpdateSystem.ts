import { supabase } from './supabase';
import type { PriceListItem, Product, AreaCabinet } from '../types';
import {
  calculateBoxMaterialCost,
  calculateBoxEdgebandCost,
  calculateDoorsMaterialCost,
  calculateDoorsEdgebandCost,
  calculateInteriorFinishCost,
  calculateHardwareCost,
  calculateLaborCost,
} from './calculations';
import { getSettings } from './settingsStore';
import { recalculateAreaSheetMaterialCosts } from './sheetMaterials';

export interface MaterialChange {
  materialType: 'box_material' | 'box_edgeband' | 'box_interior_finish' | 'doors_material' | 'doors_edgeband' | 'doors_interior_finish' | 'hardware';
  materialId: string;
  materialName: string;
  oldCost: number;
  newCost: number;
  difference: number;
  percentageChange: number;
}

export interface AffectedCabinet {
  cabinetId: string;
  productSku: string | null;
  quantity: number;
  materialChanges: MaterialChange[];
  totalDifference: number;
}

export interface AffectedArea {
  areaId: string;
  areaName: string;
  affectedCabinets: AffectedCabinet[];
  areaTotalDifference: number;
}

export interface ProjectPriceAnalysis {
  projectId: string;
  hasStalePrices: boolean;
  affectedAreas: AffectedArea[];
  totalPotentialDifference: number;
  affectedCabinetsCount: number;
  affectedMaterialsCount: number;
}

export async function analyzeProjectPriceChanges(projectId: string): Promise<ProjectPriceAnalysis> {
  const [areasResult, priceListResult, productsResult, settingsData] = await Promise.all([
    supabase
      .from('project_areas')
      .select('id, name')
      .eq('project_id', projectId),
    supabase.from('price_list').select('*').eq('is_active', true),
    supabase.from('products_catalog').select('*'),
    getSettings(),
  ]);

  const areas = areasResult.data || [];
  const priceList = priceListResult.data || [];
  const products = productsResult.data || [];

  const affectedAreas: AffectedArea[] = [];
  let totalDifference = 0;
  let affectedCabinetsCount = 0;
  const affectedMaterialsSet = new Set<string>();

  for (const area of areas) {
    const cabinetsResult = await supabase
      .from('area_cabinets')
      .select('*')
      .eq('area_id', area.id);

    const cabinets = cabinetsResult.data || [];
    const affectedCabinets: AffectedCabinet[] = [];

    for (const cabinet of cabinets) {
      const product = products.find(p => p.sku === cabinet.product_sku);
      if (!product) continue;

      const materialChanges: MaterialChange[] = [];
      const costs = await recalculateCabinetCosts(cabinet, product, priceList, settingsData);

      // Tolerance threshold for rounding differences (1 cent)
      const TOLERANCE = 0.01;

      const hasSignificantDifference = (newCost: number, oldCost: number) => {
        return Math.abs(newCost - oldCost) > TOLERANCE;
      };

      if (hasSignificantDifference(costs.boxMaterialCost, cabinet.box_material_cost) && cabinet.box_material_id) {
        const material = priceList.find(p => p.id === cabinet.box_material_id);
        if (material) {
          materialChanges.push({
            materialType: 'box_material',
            materialId: material.id,
            materialName: material.concept_description,
            oldCost: cabinet.box_material_cost,
            newCost: costs.boxMaterialCost,
            difference: costs.boxMaterialCost - cabinet.box_material_cost,
            percentageChange: ((costs.boxMaterialCost - cabinet.box_material_cost) / cabinet.box_material_cost) * 100,
          });
          affectedMaterialsSet.add(material.id);
        }
      }

      if (hasSignificantDifference(costs.boxEdgebandCost, cabinet.box_edgeband_cost) && cabinet.box_edgeband_id) {
        const material = priceList.find(p => p.id === cabinet.box_edgeband_id);
        if (material) {
          materialChanges.push({
            materialType: 'box_edgeband',
            materialId: material.id,
            materialName: material.concept_description,
            oldCost: cabinet.box_edgeband_cost,
            newCost: costs.boxEdgebandCost,
            difference: costs.boxEdgebandCost - cabinet.box_edgeband_cost,
            percentageChange: ((costs.boxEdgebandCost - cabinet.box_edgeband_cost) / cabinet.box_edgeband_cost) * 100,
          });
          affectedMaterialsSet.add(material.id);
        }
      }

      if (hasSignificantDifference(costs.boxInteriorFinishCost, cabinet.box_interior_finish_cost) && cabinet.box_interior_finish_id) {
        const material = priceList.find(p => p.id === cabinet.box_interior_finish_id);
        if (material) {
          materialChanges.push({
            materialType: 'box_interior_finish',
            materialId: material.id,
            materialName: material.concept_description,
            oldCost: cabinet.box_interior_finish_cost,
            newCost: costs.boxInteriorFinishCost,
            difference: costs.boxInteriorFinishCost - cabinet.box_interior_finish_cost,
            percentageChange: ((costs.boxInteriorFinishCost - cabinet.box_interior_finish_cost) / cabinet.box_interior_finish_cost) * 100,
          });
          affectedMaterialsSet.add(material.id);
        }
      }

      if (hasSignificantDifference(costs.doorsMaterialCost, cabinet.doors_material_cost) && cabinet.doors_material_id) {
        const material = priceList.find(p => p.id === cabinet.doors_material_id);
        if (material) {
          materialChanges.push({
            materialType: 'doors_material',
            materialId: material.id,
            materialName: material.concept_description,
            oldCost: cabinet.doors_material_cost,
            newCost: costs.doorsMaterialCost,
            difference: costs.doorsMaterialCost - cabinet.doors_material_cost,
            percentageChange: ((costs.doorsMaterialCost - cabinet.doors_material_cost) / cabinet.doors_material_cost) * 100,
          });
          affectedMaterialsSet.add(material.id);
        }
      }

      if (hasSignificantDifference(costs.doorsEdgebandCost, cabinet.doors_edgeband_cost) && cabinet.doors_edgeband_id) {
        const material = priceList.find(p => p.id === cabinet.doors_edgeband_id);
        if (material) {
          materialChanges.push({
            materialType: 'doors_edgeband',
            materialId: material.id,
            materialName: material.concept_description,
            oldCost: cabinet.doors_edgeband_cost,
            newCost: costs.doorsEdgebandCost,
            difference: costs.doorsEdgebandCost - cabinet.doors_edgeband_cost,
            percentageChange: ((costs.doorsEdgebandCost - cabinet.doors_edgeband_cost) / cabinet.doors_edgeband_cost) * 100,
          });
          affectedMaterialsSet.add(material.id);
        }
      }

      if (hasSignificantDifference(costs.doorsInteriorFinishCost, cabinet.doors_interior_finish_cost) && cabinet.doors_interior_finish_id) {
        const material = priceList.find(p => p.id === cabinet.doors_interior_finish_id);
        if (material) {
          materialChanges.push({
            materialType: 'doors_interior_finish',
            materialId: material.id,
            materialName: material.concept_description,
            oldCost: cabinet.doors_interior_finish_cost,
            newCost: costs.doorsInteriorFinishCost,
            difference: costs.doorsInteriorFinishCost - cabinet.doors_interior_finish_cost,
            percentageChange: ((costs.doorsInteriorFinishCost - cabinet.doors_interior_finish_cost) / cabinet.doors_interior_finish_cost) * 100,
          });
          affectedMaterialsSet.add(material.id);
        }
      }

      if (hasSignificantDifference(costs.hardwareCost, cabinet.hardware_cost)) {
        const hardware = Array.isArray(cabinet.hardware) ? cabinet.hardware : [];
        if (hardware.length > 0) {
          materialChanges.push({
            materialType: 'hardware',
            materialId: 'hardware_combined',
            materialName: 'Hardware (combined)',
            oldCost: cabinet.hardware_cost,
            newCost: costs.hardwareCost,
            difference: costs.hardwareCost - cabinet.hardware_cost,
            percentageChange: ((costs.hardwareCost - cabinet.hardware_cost) / cabinet.hardware_cost) * 100,
          });
        }
      }

      if (materialChanges.length > 0) {
        const cabinetTotalDifference = materialChanges.reduce((sum, change) => sum + change.difference, 0);
        affectedCabinets.push({
          cabinetId: cabinet.id,
          productSku: cabinet.product_sku,
          quantity: cabinet.quantity,
          materialChanges,
          totalDifference: cabinetTotalDifference,
        });
        affectedCabinetsCount++;
        totalDifference += cabinetTotalDifference;
      }
    }

    if (affectedCabinets.length > 0) {
      const areaTotalDifference = affectedCabinets.reduce((sum, cab) => sum + cab.totalDifference, 0);
      affectedAreas.push({
        areaId: area.id,
        areaName: area.name,
        affectedCabinets,
        areaTotalDifference,
      });
    }
  }

  return {
    projectId,
    hasStalePrices: affectedAreas.length > 0,
    affectedAreas,
    totalPotentialDifference: totalDifference,
    affectedCabinetsCount,
    affectedMaterialsCount: affectedMaterialsSet.size,
  };
}

async function recalculateCabinetCosts(
  cabinet: AreaCabinet,
  product: Product,
  priceList: PriceListItem[],
  settings: any
) {
  const boxMaterial = cabinet.box_material_id ? priceList.find(p => p.id === cabinet.box_material_id) : null;
  const boxEdgeband = cabinet.box_edgeband_id ? priceList.find(p => p.id === cabinet.box_edgeband_id) : null;
  const boxInteriorFinish = cabinet.box_interior_finish_id ? priceList.find(p => p.id === cabinet.box_interior_finish_id) : null;
  const doorsMaterial = cabinet.doors_material_id ? priceList.find(p => p.id === cabinet.doors_material_id) : null;
  const doorsEdgeband = cabinet.doors_edgeband_id ? priceList.find(p => p.id === cabinet.doors_edgeband_id) : null;
  const doorsInteriorFinish = cabinet.doors_interior_finish_id ? priceList.find(p => p.id === cabinet.doors_interior_finish_id) : null;

  const boxMaterialCost = boxMaterial && boxEdgeband
    ? calculateBoxMaterialCost(product, boxMaterial, cabinet.quantity)
    : 0;
  const boxEdgebandCost = boxMaterial && boxEdgeband
    ? calculateBoxEdgebandCost(product, boxEdgeband, cabinet.quantity)
    : 0;
  const boxInteriorFinishCost = boxInteriorFinish && boxMaterial && boxEdgeband
    ? calculateInteriorFinishCost(product, boxInteriorFinish, cabinet.quantity, true)
    : 0;
  const doorsMaterialCost = doorsMaterial && doorsEdgeband
    ? calculateDoorsMaterialCost(product, doorsMaterial, cabinet.quantity)
    : 0;
  const doorsEdgebandCost = doorsMaterial && doorsEdgeband
    ? calculateDoorsEdgebandCost(product, doorsEdgeband, cabinet.quantity)
    : 0;
  const doorsInteriorFinishCost = doorsInteriorFinish && doorsMaterial && doorsEdgeband
    ? calculateInteriorFinishCost(product, doorsInteriorFinish, cabinet.quantity, false)
    : 0;

  const hardware = Array.isArray(cabinet.hardware) ? cabinet.hardware : [];
  const hardwareCost = calculateHardwareCost(hardware, cabinet.quantity, priceList);
  const laborCost = calculateLaborCost(product, cabinet.quantity, settings.laborCostNoDrawers, settings.laborCostWithDrawers, settings.laborCostAccessories);

  return {
    boxMaterialCost,
    boxEdgebandCost,
    boxInteriorFinishCost,
    doorsMaterialCost,
    doorsEdgebandCost,
    doorsInteriorFinishCost,
    hardwareCost,
    laborCost,
    subtotal:
      boxMaterialCost +
      boxEdgebandCost +
      boxInteriorFinishCost +
      doorsMaterialCost +
      doorsEdgebandCost +
      doorsInteriorFinishCost +
      hardwareCost +
      laborCost,
  };
}

export async function updateCabinetPrices(
  cabinetIds: string[],
  onProgress?: (current: number, total: number) => void
): Promise<{ updated: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;
  let failed = 0;

  const [priceListResult, productsResult, settingsData] = await Promise.all([
    supabase.from('price_list').select('*').eq('is_active', true),
    supabase.from('products_catalog').select('*'),
    getSettings(),
  ]);

  const priceList = priceListResult.data || [];
  const products = productsResult.data || [];

  for (let i = 0; i < cabinetIds.length; i++) {
    const cabinetId = cabinetIds[i];

    if (onProgress) {
      onProgress(i + 1, cabinetIds.length);
    }

    try {
      const { data: cabinet, error: fetchError } = await supabase
        .from('area_cabinets')
        .select('*')
        .eq('id', cabinetId)
        .single();

      if (fetchError || !cabinet) {
        errors.push(`Failed to fetch cabinet ${cabinetId}`);
        failed++;
        continue;
      }

      const product = products.find(p => p.sku === cabinet.product_sku);
      if (!product) {
        errors.push(`Product not found for cabinet ${cabinetId}`);
        failed++;
        continue;
      }

      const costs = await recalculateCabinetCosts(cabinet, product, priceList, settingsData);

      const { error: updateError } = await supabase
        .from('area_cabinets')
        .update({
          box_material_cost: costs.boxMaterialCost,
          box_edgeband_cost: costs.boxEdgebandCost,
          box_interior_finish_cost: costs.boxInteriorFinishCost,
          doors_material_cost: costs.doorsMaterialCost,
          doors_edgeband_cost: costs.doorsEdgebandCost,
          doors_interior_finish_cost: costs.doorsInteriorFinishCost,
          hardware_cost: costs.hardwareCost,
          labor_cost: costs.laborCost,
          subtotal: costs.subtotal,
        })
        .eq('id', cabinetId);

      if (updateError) {
        errors.push(`Failed to update cabinet ${cabinetId}: ${updateError.message}`);
        failed++;
      } else {
        updated++;
      }
    } catch (error: any) {
      errors.push(`Error processing cabinet ${cabinetId}: ${error.message}`);
      failed++;
    }
  }

  return { updated, failed, errors };
}

export async function updateProjectPrices(
  projectId: string,
  areaIds?: string[],
  onProgress?: (message: string, current: number, total: number) => void
): Promise<{ success: boolean; updated: number; errors: string[] }> {
  try {
    let query = supabase
      .from('area_cabinets')
      .select('id, area_id')
      .in('area_id',
        supabase
          .from('project_areas')
          .select('id')
          .eq('project_id', projectId)
      );

    if (areaIds && areaIds.length > 0) {
      query = query.in('area_id', areaIds);
    }

    const { data: cabinets, error } = await query;

    if (error) {
      return { success: false, updated: 0, errors: [error.message] };
    }

    const cabinetIds = (cabinets || []).map(c => c.id);

    const result = await updateCabinetPrices(cabinetIds, (current, total) => {
      if (onProgress) {
        onProgress(`Updating cabinet ${current} of ${total}`, current, total);
      }
    });

    if (result.updated > 0) {
      const uniqueAreaIds = Array.from(new Set((cabinets || []).map(c => c.area_id)));

      for (const areaId of uniqueAreaIds) {
        if (onProgress) {
          onProgress(`Recalculating sheet materials for area...`, 0, 0);
        }
        await recalculateAreaSheetMaterialCosts(areaId);
      }

      await supabase
        .from('project_price_staleness')
        .update({ has_stale_prices: false, affected_material_count: 0, last_checked_at: new Date().toISOString() })
        .eq('project_id', projectId);
    }

    return {
      success: result.failed === 0,
      updated: result.updated,
      errors: result.errors,
    };
  } catch (error: any) {
    return {
      success: false,
      updated: 0,
      errors: [error.message],
    };
  }
}

export async function checkProjectHasStalePrices(projectId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('project_price_staleness')
    .select('has_stale_prices')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return data.has_stale_prices;
}

export async function getProjectsWithStalePrices(): Promise<string[]> {
  const { data, error } = await supabase
    .from('project_price_staleness')
    .select('project_id')
    .eq('has_stale_prices', true);

  if (error || !data) {
    return [];
  }

  return data.map(row => row.project_id);
}
