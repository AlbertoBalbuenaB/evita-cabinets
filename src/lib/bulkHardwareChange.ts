import { supabase } from './supabase';
import type { PriceListItem, HardwareItem } from '../types';

export interface BulkHardwareChangeParams {
  projectId: string;
  scope: 'area' | 'selected_areas' | 'project';
  areaIds: string[];
  oldHardwareId: string;
  newHardwareId?: string;
  operationType: 'replace' | 'remove';
  versionId?: string | null;
}

export interface HardwareUsageInfo {
  hardwareId: string;
  hardwareName: string;
  cabinetCount: number;
  totalQuantity: number;
  totalCost: number;
}

export interface BulkHardwareChangePreview {
  affectedCabinets: Array<{
    id: string;
    product_sku: string;
    quantity: number;
    currentCost: number;
    newCost: number;
    areaId: string;
    hardwareQuantity: number;
  }>;
  totalCabinets: number;
  costBefore: number;
  costAfter: number;
  costDifference: number;
  percentageChange: number;
}

export async function getHardwareInUse(
  projectId: string,
  areaIds: string[],
  versionId?: string | null
): Promise<HardwareUsageInfo[]> {
  const tableName = versionId ? 'version_area_cabinets' : 'area_cabinets';
  const areaTableName = versionId ? 'version_project_areas' : 'project_areas';

  let query = supabase
    .from(tableName)
    .select('hardware, hardware_cost, quantity')
    .not('hardware', 'is', null);

  if (areaIds.length > 0) {
    query = query.in('area_id', areaIds);
  } else {
    const { data: areas } = await supabase
      .from(areaTableName)
      .select('id')
      .eq(versionId ? 'version_id' : 'project_id', versionId || projectId);

    if (areas && areas.length > 0) {
      query = query.in('area_id', areas.map(a => a.id));
    }
  }

  const { data: cabinets, error } = await query;

  if (error) throw error;

  const { data: priceList } = await supabase
    .from('price_list')
    .select('id, concept_description, price');

  const priceListMap = new Map(priceList?.map(p => [p.id, p]) || []);
  const hardwareMap = new Map<string, HardwareUsageInfo>();

  cabinets?.forEach((cabinet: any) => {
    const hardwareArray = cabinet.hardware as HardwareItem[];
    if (!hardwareArray || !Array.isArray(hardwareArray)) return;

    hardwareArray.forEach((hw: HardwareItem) => {
      if (!hw.hardware_id) return;

      if (!hardwareMap.has(hw.hardware_id)) {
        const priceItem = priceListMap.get(hw.hardware_id);
        hardwareMap.set(hw.hardware_id, {
          hardwareId: hw.hardware_id,
          hardwareName: priceItem?.concept_description || 'Unknown Hardware',
          cabinetCount: 0,
          totalQuantity: 0,
          totalCost: 0,
        });
      }

      const info = hardwareMap.get(hw.hardware_id)!;
      info.cabinetCount += 1;
      info.totalQuantity += hw.quantity_per_cabinet * cabinet.quantity;

      const priceItem = priceListMap.get(hw.hardware_id);
      if (priceItem) {
        info.totalCost += priceItem.price * hw.quantity_per_cabinet * cabinet.quantity;
      }
    });
  });

  return Array.from(hardwareMap.values()).sort((a, b) => b.cabinetCount - a.cabinetCount);
}

export async function previewBulkHardwareChange(
  params: BulkHardwareChangeParams
): Promise<BulkHardwareChangePreview> {
  const { projectId, areaIds, oldHardwareId, newHardwareId, operationType, versionId } = params;
  const tableName = versionId ? 'version_area_cabinets' : 'area_cabinets';
  const areaTableName = versionId ? 'version_project_areas' : 'project_areas';

  let areaIdsToQuery = areaIds;
  if (areaIds.length === 0) {
    const { data: areas } = await supabase
      .from(areaTableName)
      .select('id')
      .eq(versionId ? 'version_id' : 'project_id', versionId || projectId);

    areaIdsToQuery = areas?.map(a => a.id) || [];
  }

  if (areaIdsToQuery.length === 0) {
    return {
      affectedCabinets: [],
      totalCabinets: 0,
      costBefore: 0,
      costAfter: 0,
      costDifference: 0,
      percentageChange: 0,
    };
  }

  const { data: cabinets, error } = await supabase
    .from(tableName)
    .select('*')
    .in('area_id', areaIdsToQuery);

  if (error) throw error;

  const affectedCabinets = (cabinets || []).filter((cabinet: any) => {
    const hardwareArray = cabinet.hardware as HardwareItem[];
    if (!hardwareArray || !Array.isArray(hardwareArray)) return false;
    return hardwareArray.some(hw => hw.hardware_id === oldHardwareId);
  });

  const [{ data: oldHardware }, { data: newHardware }, { data: priceList }] = await Promise.all([
    supabase.from('price_list').select('*').eq('id', oldHardwareId).single(),
    newHardwareId ? supabase.from('price_list').select('*').eq('id', newHardwareId).single() : Promise.resolve({ data: null }),
    supabase.from('price_list').select('*'),
  ]);

  if (!oldHardware) {
    throw new Error('Old hardware not found');
  }

  if (operationType === 'replace' && !newHardware) {
    throw new Error('New hardware not found');
  }

  const priceListMap = new Map(priceList?.map(p => [p.id, p]) || []);

  let totalCostBefore = 0;
  let totalCostAfter = 0;

  const previewCabinets = affectedCabinets.map((cabinet: any) => {
    const hardwareArray = cabinet.hardware as HardwareItem[];
    const currentHardware = hardwareArray.find(hw => hw.hardware_id === oldHardwareId);
    const hardwareQuantity = currentHardware?.quantity_per_cabinet || 0;

    const currentCost = cabinet.hardware_cost || 0;
    let newCost = currentCost;

    if (operationType === 'replace' && newHardware) {
      const oldCostPerCabinet = oldHardware.price * hardwareQuantity;
      const newCostPerCabinet = newHardware.price * hardwareQuantity;
      const costDifference = (newCostPerCabinet - oldCostPerCabinet) * cabinet.quantity;
      newCost = currentCost + costDifference;
    } else if (operationType === 'remove') {
      const removedCost = oldHardware.price * hardwareQuantity * cabinet.quantity;
      newCost = currentCost - removedCost;
    }

    totalCostBefore += currentCost;
    totalCostAfter += newCost;

    return {
      id: cabinet.id,
      product_sku: cabinet.product_sku,
      quantity: cabinet.quantity,
      currentCost,
      newCost,
      areaId: cabinet.area_id,
      hardwareQuantity,
    };
  });

  const costDifference = totalCostAfter - totalCostBefore;
  const percentageChange = totalCostBefore > 0 ? (costDifference / totalCostBefore) * 100 : 0;

  return {
    affectedCabinets: previewCabinets,
    totalCabinets: previewCabinets.length,
    costBefore: totalCostBefore,
    costAfter: totalCostAfter,
    costDifference,
    percentageChange,
  };
}

export async function executeBulkHardwareChange(
  params: BulkHardwareChangeParams
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  const {
    projectId,
    areaIds,
    oldHardwareId,
    newHardwareId,
    operationType,
    versionId,
  } = params;

  try {
    const preview = await previewBulkHardwareChange(params);

    if (preview.totalCabinets === 0) {
      return {
        success: false,
        updatedCount: 0,
        error: 'No cabinets found with the selected hardware',
      };
    }

    const tableName = versionId ? 'version_area_cabinets' : 'area_cabinets';
    const [{ data: oldHardware }, { data: newHardware }] = await Promise.all([
      supabase.from('price_list').select('concept_description').eq('id', oldHardwareId).single(),
      newHardwareId ? supabase.from('price_list').select('concept_description').eq('id', newHardwareId).single() : Promise.resolve({ data: null }),
    ]);

    // Batch-fetch all cabinets in one query (avoids N+1)
    const cabinetIds = preview.affectedCabinets.map(c => c.id);
    const { data: allCabinets } = await supabase
      .from(tableName)
      .select('*')
      .in('id', cabinetIds);
    const cabinetsMap = new Map((allCabinets || []).map(c => [c.id, c]));

    const updatePromises: Promise<any>[] = [];

    for (const cabinet of preview.affectedCabinets) {
      const currentCabinet = cabinetsMap.get(cabinet.id);
      if (!currentCabinet) continue;

      const hardwareArray = currentCabinet.hardware as HardwareItem[];
      let newHardwareArray: HardwareItem[];

      if (operationType === 'replace' && newHardwareId) {
        newHardwareArray = hardwareArray.map(hw => {
          if (hw.hardware_id === oldHardwareId) {
            return {
              hardware_id: newHardwareId,
              quantity_per_cabinet: hw.quantity_per_cabinet,
            };
          }
          return hw;
        });
      } else {
        newHardwareArray = hardwareArray.filter(hw => hw.hardware_id !== oldHardwareId);
      }

      const newSubtotal =
        (currentCabinet.box_material_cost || 0) +
        (currentCabinet.box_edgeband_cost || 0) +
        (currentCabinet.box_interior_finish_cost || 0) +
        (currentCabinet.doors_material_cost || 0) +
        (currentCabinet.doors_edgeband_cost || 0) +
        (currentCabinet.doors_interior_finish_cost || 0) +
        (currentCabinet.back_panel_material_cost || 0) +
        cabinet.newCost +
        (currentCabinet.accessories_cost || 0) +
        (currentCabinet.door_profile_cost || 0) +
        (currentCabinet.labor_cost || 0);

      updatePromises.push(
        supabase.from(tableName).update({
          hardware: newHardwareArray as any,
          hardware_cost: cabinet.newCost,
          subtotal: newSubtotal,
        }).eq('id', cabinet.id)
      );
    }

    await Promise.all(updatePromises);

    await supabase.from('material_change_log').insert({
      project_id: projectId,
      user_action: operationType === 'replace'
        ? `Replaced hardware from ${oldHardware?.concept_description || 'Unknown'} to ${newHardware?.concept_description || 'Unknown'}`
        : `Removed hardware ${oldHardware?.concept_description || 'Unknown'}`,
      change_type: 'hardware',
      operation_type: operationType,
      scope: params.scope,
      scope_details: areaIds,
      affected_cabinets_count: preview.totalCabinets,
      old_material_id: oldHardwareId,
      new_material_id: newHardwareId || null,
      old_material_name: oldHardware?.concept_description,
      new_material_name: newHardware?.concept_description || null,
      cost_before: preview.costBefore,
      cost_after: preview.costAfter,
      cost_difference: preview.costDifference,
    });

    return {
      success: true,
      updatedCount: preview.totalCabinets,
    };
  } catch (error: any) {
    console.error('Error executing bulk hardware change:', error);
    return {
      success: false,
      updatedCount: 0,
      error: error.message || 'Unknown error occurred',
    };
  }
}

export async function validateHardwareReplacement(
  oldHardwareId: string,
  newHardwareId: string
): Promise<{ valid: boolean; error?: string }> {
  const [{ data: oldHardware }, { data: newHardware }] = await Promise.all([
    supabase.from('price_list').select('*').eq('id', oldHardwareId).single(),
    supabase.from('price_list').select('*').eq('id', newHardwareId).single(),
  ]);

  if (!oldHardware) {
    return { valid: false, error: 'Old hardware not found' };
  }

  if (!newHardware) {
    return { valid: false, error: 'New hardware not found' };
  }

  if (!newHardware.is_active) {
    return { valid: false, error: 'New hardware is not active' };
  }

  const oldCategory = getHardwareCategory(oldHardware);
  const newCategory = getHardwareCategory(newHardware);

  if (oldCategory !== newCategory) {
    return {
      valid: false,
      error: `Cannot replace ${oldCategory} with ${newCategory}. Hardware must be of the same category.`
    };
  }

  return { valid: true };
}

function getHardwareCategory(hardware: PriceListItem): string {
  const type = hardware.type.toLowerCase();
  const description = hardware.concept_description.toLowerCase();

  if (type.includes('hinge') || description.includes('hinge')) {
    return 'hinge';
  } else if (type.includes('slide') || description.includes('slide') || description.includes('drawer')) {
    return 'slide';
  } else if (type.includes('pull') || description.includes('pull') || description.includes('knob')) {
    return 'pull';
  } else if (type.includes('handle') || description.includes('handle')) {
    return 'handle';
  } else if (type.includes('hardware')) {
    return 'hardware';
  }

  return 'other';
}
