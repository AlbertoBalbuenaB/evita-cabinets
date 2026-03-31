import { supabase } from './supabase';
import { fetchAllProducts } from './fetchAllProducts';
import type { PriceListItem, Product, AreaCabinet } from '../types';
import {
  calculateBoxMaterialCost,
  calculateBoxEdgebandCost,
  calculateDoorsMaterialCost,
  calculateDoorsEdgebandCost,
  calculateInteriorFinishCost,
  calculateHardwareCost,
  calculateLaborCost,
  calculateAccessoriesCost,
  calculateDoorProfileCost,
  parseDimensions,
} from './calculations';
import { getSettings } from './settingsStore';

export type VersionType = 'price_update' | 'material_change' | 'manual_snapshot';
export type ChangeType = 'material_change' | 'price_update' | 'both';

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  version_name: string;
  version_type: VersionType;
  snapshot_data: any;
  total_amount: number;
  change_summary: any;
  notes?: string;
  affected_areas: string[];
  created_at: string;
}

export interface VersionDetail {
  id: string;
  version_id: string;
  area_id: string | null;
  area_name: string;
  previous_subtotal: number;
  new_subtotal: number;
  difference: number;
  difference_percentage: number;
  cabinets_affected_count: number;
  change_type: ChangeType;
  material_changes: any;
  price_changes: any;
  created_at: string;
}

export interface VersionChangeResult {
  version: ProjectVersion;
  details: VersionDetail[];
  cabinetsUpdated: number;
  errors: string[];
}

export async function createProjectVersion(
  projectId: string,
  versionName: string,
  versionType: VersionType,
  affectedAreaIds: string[],
  notes?: string
): Promise<ProjectVersion> {
  const { data: versionNumberData, error: versionError } = await supabase
    .rpc('get_next_version_number', { p_project_id: projectId });

  if (versionError) throw versionError;

  const { data: snapshotData, error: snapshotError } = await supabase
    .rpc('create_project_snapshot', { p_project_id: projectId });

  if (snapshotError) throw snapshotError;

  const { data: project } = await supabase
    .from('quotations')
    .select('total_amount')
    .eq('id', projectId)
    .single();

  const { data: version, error } = await supabase
    .from('project_versions')
    .insert([{
      project_id: projectId,
      version_number: versionNumberData,
      version_name: versionName,
      version_type: versionType,
      snapshot_data: snapshotData,
      total_amount: project?.total_amount || 0,
      affected_areas: affectedAreaIds,
      notes: notes || null,
    }])
    .select()
    .single();

  if (error) throw error;
  return version;
}

export async function recalculateAllCabinetPrices(
  projectId: string,
  areaIds: string[],
  onProgress?: (message: string, current: number, total: number) => void
): Promise<{ updated: number; errors: string[]; areaChanges: Map<string, { previous: number; new: number }> }> {
  const errors: string[] = [];
  let updated = 0;
  const areaChanges = new Map<string, { previous: number; new: number }>();

  const [priceListResult, products, settingsData] = await Promise.all([
    supabase.from('price_list').select('*').eq('is_active', true),
    fetchAllProducts({ onlyActive: false }),
    getSettings(),
  ]);

  const priceList = priceListResult.data || [];

  const areasQuery = areaIds.length > 0
    ? supabase.from('project_areas').select('*').in('id', areaIds)
    : supabase.from('project_areas').select('*').eq('project_id', projectId);

  const { data: areas } = await areasQuery;

  // Single pass: fetch all cabinets per area and count total
  let processedCount = 0;
  let totalCabinets = 0;
  const areaCabinetsMap = new Map<string, any[]>();

  for (const area of areas || []) {
    const { data: cabinets } = await supabase
      .from('area_cabinets')
      .select('*')
      .eq('area_id', area.id);
    const cabinetList = cabinets || [];
    areaCabinetsMap.set(area.id, cabinetList);
    totalCabinets += cabinetList.length;
  }

  // Build products map for O(1) lookups instead of .find() per cabinet
  const productsMap = new Map(products.map(p => [p.sku, p]));
  const priceListMap = new Map(priceList.map(p => [p.id, p]));

  for (const area of areas || []) {
    const cabinets = areaCabinetsMap.get(area.id) || [];
    const previousAreaTotal = area.subtotal || 0;
    let newAreaTotal = 0;
    const updateBatch: Promise<any>[] = [];

    for (const cabinet of cabinets) {
      processedCount++;
      if (onProgress) {
        onProgress(`Recalculating cabinet ${processedCount} of ${totalCabinets}`, processedCount, totalCabinets);
      }

      const product = productsMap.get(cabinet.product_sku);
      if (!product) {
        errors.push(`Product ${cabinet.product_sku} not found for cabinet ${cabinet.id}`);
        continue;
      }

      try {
        const costs = await recalculateCabinetCosts(cabinet, product, priceList, settingsData);

        const boxMaterial = cabinet.box_material_id ? priceListMap.get(cabinet.box_material_id) : null;
        const boxEdgeband = cabinet.box_edgeband_id ? priceListMap.get(cabinet.box_edgeband_id) : null;
        const boxInteriorFinish = cabinet.box_interior_finish_id ? priceListMap.get(cabinet.box_interior_finish_id) : null;
        const doorsMaterial = cabinet.doors_material_id ? priceListMap.get(cabinet.doors_material_id) : null;
        const doorsEdgeband = cabinet.doors_edgeband_id ? priceListMap.get(cabinet.doors_edgeband_id) : null;
        const doorsInteriorFinish = cabinet.doors_interior_finish_id ? priceListMap.get(cabinet.doors_interior_finish_id) : null;

        const updateData: any = {
          box_material_cost: costs.boxMaterialCost,
          box_edgeband_cost: costs.boxEdgebandCost,
          box_interior_finish_cost: costs.boxInteriorFinishCost,
          doors_material_cost: costs.doorsMaterialCost,
          doors_edgeband_cost: costs.doorsEdgebandCost,
          doors_interior_finish_cost: costs.doorsInteriorFinishCost,
          back_panel_material_cost: costs.backPanelMaterialCost,
          hardware_cost: costs.hardwareCost,
          accessories_cost: costs.accessoriesCost,
          labor_cost: costs.laborCost,
          door_profile_cost: costs.doorProfileCost,
          subtotal: costs.subtotal,
          original_box_material_price: boxMaterial?.price || null,
          original_box_edgeband_price: boxEdgeband?.price || null,
          original_box_interior_finish_price: boxInteriorFinish?.price || null,
          original_doors_material_price: doorsMaterial?.price || null,
          original_doors_edgeband_price: doorsEdgeband?.price || null,
          original_doors_interior_finish_price: doorsInteriorFinish?.price || null,
        };

        updateBatch.push(
          supabase
            .from('area_cabinets')
            .update(updateData)
            .eq('id', cabinet.id)
            .then(({ error }) => {
              if (error) {
                errors.push(`Failed to update cabinet ${cabinet.id}: ${error.message}`);
              } else {
                updated++;
                newAreaTotal += costs.subtotal;
              }
            })
        );

        // Flush batch every 10 updates
        if (updateBatch.length >= 10) {
          await Promise.all(updateBatch);
          updateBatch.length = 0;
        }
      } catch (error: any) {
        errors.push(`Error processing cabinet ${cabinet.id}: ${error.message}`);
      }
    }

    // Flush remaining updates
    if (updateBatch.length > 0) {
      await Promise.all(updateBatch);
    }

    const { data: areaClosetItems } = await supabase
      .from('area_closet_items')
      .select('subtotal_mxn')
      .eq('area_id', area.id);

    const closetItemsTotal = (areaClosetItems || []).reduce((sum: number, ci: any) => sum + (ci.subtotal_mxn || 0), 0);

    areaChanges.set(area.id, { previous: previousAreaTotal, new: newAreaTotal + closetItemsTotal });

    await supabase
      .from('project_areas')
      .update({ subtotal: newAreaTotal + closetItemsTotal })
      .eq('id', area.id);
  }

  const projectTotal = Array.from(areaChanges.values()).reduce((sum, change) => sum + change.new, 0);
  await supabase
    .from('quotations')
    .update({ total_amount: projectTotal })
    .eq('id', projectId);

  return { updated, errors, areaChanges };
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
  const accessories = Array.isArray(cabinet.accessories)
    ? cabinet.accessories as Array<{ accessory_id: string; quantity_per_cabinet: number }>
    : [];
  const accessoriesCost = calculateAccessoriesCost(accessories, cabinet.quantity, priceList);
  const laborCost = calculateLaborCost(product, cabinet.quantity, settings.laborCostNoDrawers, settings.laborCostWithDrawers, settings.laborCostAccessories);

  const doorProfileItem = cabinet.door_profile_id ? priceList.find(p => p.id === cabinet.door_profile_id) : null;
  const doorProfileCost = doorProfileItem && product
    ? calculateDoorProfileCost(product, doorProfileItem, cabinet.quantity)
    : 0;

  const backPanelMaterial = cabinet.use_back_panel_material && cabinet.back_panel_material_id
    ? priceList.find(p => p.id === cabinet.back_panel_material_id)
    : null;
  const backPanelMaterialCost = backPanelMaterial && cabinet.back_panel_sf && cabinet.back_panel_sf > 0
    ? (() => {
        const price = backPanelMaterial.price_with_tax || backPanelMaterial.price;
        const sfPerSheet = backPanelMaterial.sf_per_sheet || parseDimensions(backPanelMaterial.dimensions);
        return cabinet.back_panel_sf * (price / sfPerSheet);
      })()
    : (cabinet.back_panel_material_cost || 0);

  const subtotal = boxMaterialCost + boxEdgebandCost + boxInteriorFinishCost +
                   doorsMaterialCost + doorsEdgebandCost + doorsInteriorFinishCost +
                   backPanelMaterialCost + hardwareCost + accessoriesCost + laborCost + doorProfileCost;

  return {
    boxMaterialCost,
    boxEdgebandCost,
    boxInteriorFinishCost,
    doorsMaterialCost,
    doorsEdgebandCost,
    doorsInteriorFinishCost,
    backPanelMaterialCost,
    hardwareCost,
    accessoriesCost,
    laborCost,
    doorProfileCost,
    subtotal,
  };
}

export async function saveVersionDetails(
  versionId: string,
  areaChanges: Map<string, { previous: number; new: number }>,
  changeType: ChangeType,
  materialChanges?: any,
  priceChanges?: any
): Promise<void> {
  const details: any[] = [];

  for (const [areaId, change] of areaChanges.entries()) {
    const { data: area } = await supabase
      .from('project_areas')
      .select('name')
      .eq('id', areaId)
      .single();

    const { data: cabinets } = await supabase
      .from('area_cabinets')
      .select('id')
      .eq('area_id', areaId);

    const difference = change.new - change.previous;
    const differencePercentage = change.previous !== 0
      ? (difference / change.previous) * 100
      : 0;

    details.push({
      version_id: versionId,
      area_id: areaId,
      area_name: area?.name || 'Unknown Area',
      previous_subtotal: change.previous,
      new_subtotal: change.new,
      difference,
      difference_percentage: differencePercentage,
      cabinets_affected_count: cabinets?.length || 0,
      change_type: changeType,
      material_changes: materialChanges || {},
      price_changes: priceChanges || {},
    });
  }

  if (details.length > 0) {
    const { error } = await supabase
      .from('project_version_details')
      .insert(details);

    if (error) throw error;
  }
}

export async function getVersionHistory(projectId: string): Promise<ProjectVersion[]> {
  const { data, error } = await supabase
    .from('project_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getVersionDetails(versionId: string): Promise<VersionDetail[]> {
  const { data, error } = await supabase
    .from('project_version_details')
    .select('*')
    .eq('version_id', versionId)
    .order('area_name');

  if (error) throw error;
  return data || [];
}

export async function compareVersions(
  versionAId: string,
  versionBId: string | 'current',
  projectId?: string
): Promise<{
  versionA: ProjectVersion;
  versionB: ProjectVersion | null;
  differences: {
    totalDifference: number;
    areaComparisons: Array<{
      areaName: string;
      versionATotal: number;
      versionBTotal: number;
      difference: number;
      percentageChange: number;
    }>;
  };
}> {
  const { data: versionA, error: errorA } = await supabase
    .from('project_versions')
    .select('*')
    .eq('id', versionAId)
    .single();

  if (errorA) throw errorA;

  let versionB: ProjectVersion | null = null;
  let versionBData: any;

  if (versionBId === 'current' && projectId) {
    const { data: currentSnapshot } = await supabase
      .rpc('create_project_snapshot', { p_project_id: projectId });

    const { data: project } = await supabase
      .from('quotations')
      .select('total_amount')
      .eq('id', projectId)
      .single();

    versionBData = currentSnapshot;
    versionB = {
      id: 'current',
      project_id: projectId,
      version_number: 9999,
      version_name: 'Current State',
      version_type: 'manual_snapshot',
      snapshot_data: currentSnapshot,
      total_amount: project?.total_amount || 0,
      change_summary: {},
      affected_areas: [],
      created_at: new Date().toISOString(),
    };
  } else {
    const { data, error: errorB } = await supabase
      .from('project_versions')
      .select('*')
      .eq('id', versionBId)
      .single();

    if (errorB) throw errorB;
    versionB = data;
    versionBData = data.snapshot_data;
  }

  const areaComparisons: Array<{
    areaName: string;
    versionATotal: number;
    versionBTotal: number;
    difference: number;
    percentageChange: number;
  }> = [];

  const areasA = versionA.snapshot_data?.areas || [];
  const areasB = versionBData?.areas || [];

  const areaMapA = new Map(areasA.map((a: any) => [a.area.id, a]));
  const areaMapB = new Map(areasB.map((a: any) => [a.area.id, a]));

  const allAreaIds = new Set([...areaMapA.keys(), ...areaMapB.keys()]);

  for (const areaId of allAreaIds) {
    const areaA = areaMapA.get(areaId);
    const areaB = areaMapB.get(areaId);

    const nameA = areaA?.area?.name || 'Unknown';
    const nameB = areaB?.area?.name || nameA;
    const totalA = areaA?.area?.subtotal || 0;
    const totalB = areaB?.area?.subtotal || 0;

    const difference = totalB - totalA;
    const percentageChange = totalA !== 0 ? (difference / totalA) * 100 : 0;

    areaComparisons.push({
      areaName: nameB,
      versionATotal: totalA,
      versionBTotal: totalB,
      difference,
      percentageChange,
    });
  }

  const totalDifference = (versionB?.total_amount || 0) - versionA.total_amount;

  return {
    versionA,
    versionB,
    differences: {
      totalDifference,
      areaComparisons,
    },
  };
}
