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

export interface MaterialImpact {
  materialId: string;
  materialName: string;
  materialType: 'box_material' | 'box_edgeband' | 'box_interior_finish' | 'doors_material' | 'doors_edgeband' | 'doors_interior_finish' | 'hardware';
  currentPrice: number;
  affectedCabinetsCount: number;
  totalOldCost: number;
  totalNewCost: number;
  totalDifference: number;
  percentageChange: number;
  affectedAreas: string[];
}

export interface MaterialUpdateAnalysis {
  projectId: string;
  materials: MaterialImpact[];
  totalDifference: number;
  affectedCabinetsCount: number;
}

export async function analyzeMaterialPriceChanges(projectId: string): Promise<MaterialUpdateAnalysis> {
  const TOLERANCE = 0.01;

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

  const materialImpactMap = new Map<string, MaterialImpact>();
  const affectedCabinetsSet = new Set<string>();

  for (const area of areas) {
    const cabinetsResult = await supabase
      .from('area_cabinets')
      .select('*')
      .eq('area_id', area.id);

    const cabinets = cabinetsResult.data || [];

    for (const cabinet of cabinets) {
      const product = products.find(p => p.sku === cabinet.product_sku);
      if (!product) continue;

      const costs = await recalculateCabinetCosts(cabinet, product, priceList, settingsData);

      // Check box material
      if (Math.abs(costs.boxMaterialCost - cabinet.box_material_cost) > TOLERANCE && cabinet.box_material_id) {
        const material = priceList.find(p => p.id === cabinet.box_material_id);
        if (material) {
          updateMaterialImpact(
            materialImpactMap,
            material.id,
            material.concept_description,
            'box_material',
            material.price,
            cabinet.box_material_cost,
            costs.boxMaterialCost,
            area.name
          );
          affectedCabinetsSet.add(cabinet.id);
        }
      }

      // Check box edgeband
      if (Math.abs(costs.boxEdgebandCost - cabinet.box_edgeband_cost) > TOLERANCE && cabinet.box_edgeband_id) {
        const material = priceList.find(p => p.id === cabinet.box_edgeband_id);
        if (material) {
          updateMaterialImpact(
            materialImpactMap,
            material.id,
            material.concept_description,
            'box_edgeband',
            material.price,
            cabinet.box_edgeband_cost,
            costs.boxEdgebandCost,
            area.name
          );
          affectedCabinetsSet.add(cabinet.id);
        }
      }

      // Check box interior finish
      if (Math.abs(costs.boxInteriorFinishCost - cabinet.box_interior_finish_cost) > TOLERANCE && cabinet.box_interior_finish_id) {
        const material = priceList.find(p => p.id === cabinet.box_interior_finish_id);
        if (material) {
          updateMaterialImpact(
            materialImpactMap,
            material.id,
            material.concept_description,
            'box_interior_finish',
            material.price,
            cabinet.box_interior_finish_cost,
            costs.boxInteriorFinishCost,
            area.name
          );
          affectedCabinetsSet.add(cabinet.id);
        }
      }

      // Check doors material
      if (Math.abs(costs.doorsMaterialCost - cabinet.doors_material_cost) > TOLERANCE && cabinet.doors_material_id) {
        const material = priceList.find(p => p.id === cabinet.doors_material_id);
        if (material) {
          updateMaterialImpact(
            materialImpactMap,
            material.id,
            material.concept_description,
            'doors_material',
            material.price,
            cabinet.doors_material_cost,
            costs.doorsMaterialCost,
            area.name
          );
          affectedCabinetsSet.add(cabinet.id);
        }
      }

      // Check doors edgeband
      if (Math.abs(costs.doorsEdgebandCost - cabinet.doors_edgeband_cost) > TOLERANCE && cabinet.doors_edgeband_id) {
        const material = priceList.find(p => p.id === cabinet.doors_edgeband_id);
        if (material) {
          updateMaterialImpact(
            materialImpactMap,
            material.id,
            material.concept_description,
            'doors_edgeband',
            material.price,
            cabinet.doors_edgeband_cost,
            costs.doorsEdgebandCost,
            area.name
          );
          affectedCabinetsSet.add(cabinet.id);
        }
      }

      // Check doors interior finish
      if (Math.abs(costs.doorsInteriorFinishCost - cabinet.doors_interior_finish_cost) > TOLERANCE && cabinet.doors_interior_finish_id) {
        const material = priceList.find(p => p.id === cabinet.doors_interior_finish_id);
        if (material) {
          updateMaterialImpact(
            materialImpactMap,
            material.id,
            material.concept_description,
            'doors_interior_finish',
            material.price,
            cabinet.doors_interior_finish_cost,
            costs.doorsInteriorFinishCost,
            area.name
          );
          affectedCabinetsSet.add(cabinet.id);
        }
      }
    }
  }

  const materials = Array.from(materialImpactMap.values());
  const totalDifference = materials.reduce((sum, m) => sum + m.totalDifference, 0);

  return {
    projectId,
    materials,
    totalDifference,
    affectedCabinetsCount: affectedCabinetsSet.size,
  };
}

function updateMaterialImpact(
  map: Map<string, MaterialImpact>,
  materialId: string,
  materialName: string,
  materialType: MaterialImpact['materialType'],
  currentPrice: number,
  oldCost: number,
  newCost: number,
  areaName: string
) {
  if (!map.has(materialId)) {
    map.set(materialId, {
      materialId,
      materialName,
      materialType,
      currentPrice,
      affectedCabinetsCount: 0,
      totalOldCost: 0,
      totalNewCost: 0,
      totalDifference: 0,
      percentageChange: 0,
      affectedAreas: [],
    });
  }

  const impact = map.get(materialId)!;
  impact.affectedCabinetsCount++;
  impact.totalOldCost += oldCost;
  impact.totalNewCost += newCost;
  impact.totalDifference += (newCost - oldCost);

  if (!impact.affectedAreas.includes(areaName)) {
    impact.affectedAreas.push(areaName);
  }

  if (impact.totalOldCost !== 0) {
    impact.percentageChange = ((impact.totalNewCost - impact.totalOldCost) / impact.totalOldCost) * 100;
  }
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
  };
}

export async function updateSelectedMaterials(
  projectId: string,
  selectedMaterialIds: string[],
  onProgress?: (message: string, current: number, total: number) => void
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  const [priceListResult, productsResult, settingsData, areasResult] = await Promise.all([
    supabase.from('price_list').select('*').eq('is_active', true),
    supabase.from('products_catalog').select('*'),
    getSettings(),
    supabase.from('project_areas').select('id').eq('project_id', projectId),
  ]);

  const priceList = priceListResult.data || [];
  const products = productsResult.data || [];
  const areas = areasResult.data || [];

  let processedCount = 0;
  let totalCabinets = 0;

  // First, count total cabinets to update
  for (const area of areas) {
    const { data: cabinets } = await supabase
      .from('area_cabinets')
      .select('id')
      .eq('area_id', area.id);
    totalCabinets += (cabinets || []).length;
  }

  for (const area of areas) {
    const { data: cabinets } = await supabase
      .from('area_cabinets')
      .select('*')
      .eq('area_id', area.id);

    for (const cabinet of cabinets || []) {
      processedCount++;
      if (onProgress) {
        onProgress(`Updating cabinet ${processedCount} of ${totalCabinets}`, processedCount, totalCabinets);
      }

      const product = products.find(p => p.sku === cabinet.product_sku);
      if (!product) continue;

      // Check if this cabinet uses any of the selected materials
      const usesSelectedMaterial = selectedMaterialIds.some(id =>
        cabinet.box_material_id === id ||
        cabinet.box_edgeband_id === id ||
        cabinet.box_interior_finish_id === id ||
        cabinet.doors_material_id === id ||
        cabinet.doors_edgeband_id === id ||
        cabinet.doors_interior_finish_id === id
      );

      if (!usesSelectedMaterial) continue;

      try {
        const costs = await recalculateCabinetCosts(cabinet, product, priceList, settingsData);

        const updateData: any = {};

        if (selectedMaterialIds.includes(cabinet.box_material_id || '')) {
          updateData.box_material_cost = costs.boxMaterialCost;
        }
        if (selectedMaterialIds.includes(cabinet.box_edgeband_id || '')) {
          updateData.box_edgeband_cost = costs.boxEdgebandCost;
        }
        if (selectedMaterialIds.includes(cabinet.box_interior_finish_id || '')) {
          updateData.box_interior_finish_cost = costs.boxInteriorFinishCost;
        }
        if (selectedMaterialIds.includes(cabinet.doors_material_id || '')) {
          updateData.doors_material_cost = costs.doorsMaterialCost;
        }
        if (selectedMaterialIds.includes(cabinet.doors_edgeband_id || '')) {
          updateData.doors_edgeband_cost = costs.doorsEdgebandCost;
        }
        if (selectedMaterialIds.includes(cabinet.doors_interior_finish_id || '')) {
          updateData.doors_interior_finish_cost = costs.doorsInteriorFinishCost;
        }

        // Recalculate subtotal
        const subtotal = (
          (updateData.box_material_cost ?? cabinet.box_material_cost) +
          (updateData.box_edgeband_cost ?? cabinet.box_edgeband_cost) +
          (updateData.box_interior_finish_cost ?? cabinet.box_interior_finish_cost) +
          (updateData.doors_material_cost ?? cabinet.doors_material_cost) +
          (updateData.doors_edgeband_cost ?? cabinet.doors_edgeband_cost) +
          (updateData.doors_interior_finish_cost ?? cabinet.doors_interior_finish_cost) +
          cabinet.hardware_cost +
          cabinet.labor_cost
        );

        updateData.subtotal = subtotal;

        const { error } = await supabase
          .from('area_cabinets')
          .update(updateData)
          .eq('id', cabinet.id);

        if (error) {
          errors.push(`Failed to update cabinet ${cabinet.id}: ${error.message}`);
        } else {
          updated++;
        }
      } catch (error: any) {
        errors.push(`Error processing cabinet ${cabinet.id}: ${error.message}`);
      }
    }
  }

  return { updated, errors };
}
