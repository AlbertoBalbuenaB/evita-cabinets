import { supabase } from './supabase';
import { fetchAllProducts } from './fetchAllProducts';
import {
  calculateBoxMaterialCost,
  calculateBoxEdgebandCost,
  calculateDoorsMaterialCost,
  calculateDoorsEdgebandCost,
  calculateInteriorFinishCost,
  calculateDoorProfileCost,
  calculateBackPanelMaterialCost,
} from './calculations';
export type MaterialChangeType =
  | 'box_material'
  | 'box_edgeband'
  | 'doors_material'
  | 'doors_edgeband'
  | 'box_interior_finish'
  | 'doors_interior_finish'
  | 'door_profile'
  | 'drawer_box_material'
  | 'shelf_material';
  // Note: hardware is intentionally excluded — hardware is a JSON array, not a single ID.
  // Hardware bulk changes are handled by the dedicated bulkHardwareChange module.

export type ChangeScope = 'area' | 'selected_areas' | 'project';

export interface BulkMaterialChangeParams {
  projectId: string;
  scope: ChangeScope;
  areaIds: string[];
  changeType: MaterialChangeType;
  oldMaterialId: string;
  newMaterialId: string;
  updateMatchingInteriorFinish?: boolean;
  versionId?: string | null;
}

export interface MaterialUsageInfo {
  materialId: string;
  materialName: string;
  cabinetCount: number;
  totalCost: number;
}

export interface BulkChangePreview {
  affectedCabinets: Array<{
    id: string;
    product_sku: string;
    quantity: number;
    currentCost: number;
    newCost: number;
    areaId: string;
  }>;
  totalCabinets: number;
  costBefore: number;
  costAfter: number;
  costDifference: number;
  percentageChange: number;
}

export async function getMaterialsInUse(
  projectId: string,
  areaIds: string[],
  changeType: MaterialChangeType,
  versionId?: string | null
): Promise<MaterialUsageInfo[]> {
  const tableName = versionId ? 'version_area_cabinets' : 'area_cabinets';
  const areaTableName = versionId ? 'version_project_areas' : 'project_areas';

  let materialColumn: string;
  let costColumn: string;

  switch (changeType) {
    case 'box_material':
      materialColumn = 'box_material_id';
      costColumn = 'box_material_cost';
      break;
    case 'box_edgeband':
      materialColumn = 'box_edgeband_id';
      costColumn = 'box_edgeband_cost';
      break;
    case 'doors_material':
      materialColumn = 'doors_material_id';
      costColumn = 'doors_material_cost';
      break;
    case 'doors_edgeband':
      materialColumn = 'doors_edgeband_id';
      costColumn = 'doors_edgeband_cost';
      break;
    case 'box_interior_finish':
      materialColumn = 'box_interior_finish_id';
      costColumn = 'box_interior_finish_cost';
      break;
    case 'doors_interior_finish':
      materialColumn = 'doors_interior_finish_id';
      costColumn = 'doors_interior_finish_cost';
      break;
    case 'door_profile':
      materialColumn = 'door_profile_id';
      costColumn = 'door_profile_cost';
      break;
    case 'drawer_box_material':
      materialColumn = 'drawer_box_material_id';
      costColumn = 'drawer_box_material_cost';
      break;
    case 'shelf_material':
      materialColumn = 'shelf_material_id';
      costColumn = 'shelf_material_cost';
      break;
    default:
      throw new Error(`Unknown change type: ${changeType}`);
  }

  let query = supabase
    .from(tableName as 'area_cabinets')
    .select(`${materialColumn}, ${costColumn}, quantity`)
    .not(materialColumn, 'is', null);

  if (areaIds.length > 0) {
    query = query.in('area_id', areaIds);
  } else {
    const { data: areas } = await supabase
      .from(areaTableName as 'project_areas')
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
    .select('id, concept_description');

  const priceListMap = new Map(priceList?.map(p => [p.id, p.concept_description]) || []);
  const materialsMap = new Map<string, MaterialUsageInfo>();

  cabinets?.forEach((cabinet: any) => {
    const matId = cabinet[materialColumn];
    if (!matId) return;

    if (!materialsMap.has(matId)) {
      materialsMap.set(matId, {
        materialId: matId,
        materialName: priceListMap.get(matId) || 'Unknown Material',
        cabinetCount: 0,
        totalCost: 0,
      });
    }

    const info = materialsMap.get(matId)!;
    info.cabinetCount += 1;
    info.totalCost += cabinet[costColumn] || 0;
  });

  return Array.from(materialsMap.values()).sort((a, b) => b.cabinetCount - a.cabinetCount);
}

export async function previewBulkMaterialChange(
  params: BulkMaterialChangeParams
): Promise<BulkChangePreview> {
  const { projectId, areaIds, changeType, oldMaterialId, newMaterialId, versionId } = params;
  const tableName = versionId ? 'version_area_cabinets' : 'area_cabinets';
  const areaTableName = versionId ? 'version_project_areas' : 'project_areas';

  let materialColumn: string;
  let costColumn: string;

  switch (changeType) {
    case 'box_material':
      materialColumn = 'box_material_id';
      costColumn = 'box_material_cost';
      break;
    case 'box_edgeband':
      materialColumn = 'box_edgeband_id';
      costColumn = 'box_edgeband_cost';
      break;
    case 'doors_material':
      materialColumn = 'doors_material_id';
      costColumn = 'doors_material_cost';
      break;
    case 'doors_edgeband':
      materialColumn = 'doors_edgeband_id';
      costColumn = 'doors_edgeband_cost';
      break;
    case 'box_interior_finish':
      materialColumn = 'box_interior_finish_id';
      costColumn = 'box_interior_finish_cost';
      break;
    case 'doors_interior_finish':
      materialColumn = 'doors_interior_finish_id';
      costColumn = 'doors_interior_finish_cost';
      break;
    case 'door_profile':
      materialColumn = 'door_profile_id';
      costColumn = 'door_profile_cost';
      break;
    case 'drawer_box_material':
      materialColumn = 'drawer_box_material_id';
      costColumn = 'drawer_box_material_cost';
      break;
    case 'shelf_material':
      materialColumn = 'shelf_material_id';
      costColumn = 'shelf_material_cost';
      break;
    default:
      throw new Error(`Unknown change type: ${changeType}`);
  }

  let query = supabase
    .from(tableName as 'area_cabinets')
    .select('*')
    .eq(materialColumn, oldMaterialId);

  if (areaIds.length > 0) {
    query = query.in('area_id', areaIds);
  } else {
    const { data: areas } = await supabase
      .from(areaTableName as 'project_areas')
      .select('id')
      .eq(versionId ? 'version_id' : 'project_id', versionId || projectId);

    if (areas && areas.length > 0) {
      query = query.in('area_id', areas.map(a => a.id));
    }
  }

  const { data: cabinets, error } = await query;

  if (error) throw error;

  const [{ data: newMaterial }, products] = await Promise.all([
    supabase.from('price_list').select('*').eq('id', newMaterialId).single(),
    fetchAllProducts({ onlyActive: false }),
  ]);

  if (!newMaterial) {
    throw new Error('New material not found');
  }

  const productsMap = new Map(products.map(p => [p.sku, p]));

  let totalCostBefore = 0;
  let totalCostAfter = 0;

  const affectedCabinets = (cabinets || []).map((cabinet: any) => {
    const product = productsMap.get(cabinet.product_sku);
    if (!product) {
      return {
        id: cabinet.id,
        product_sku: cabinet.product_sku,
        quantity: cabinet.quantity,
        currentCost: cabinet[costColumn] || 0,
        newCost: cabinet[costColumn] || 0,
        areaId: cabinet.area_id,
      };
    }

    const currentCost = cabinet[costColumn] || 0;
    let newCost = currentCost;

    try {
      switch (changeType) {
        case 'box_material':
          newCost = calculateBoxMaterialCost(product, newMaterial, cabinet.quantity);
          break;
        case 'box_edgeband':
          newCost = calculateBoxEdgebandCost(product, newMaterial, cabinet.quantity);
          break;
        case 'doors_material':
          newCost = calculateDoorsMaterialCost(product, newMaterial, cabinet.quantity);
          break;
        case 'doors_edgeband':
          newCost = calculateDoorsEdgebandCost(product, newMaterial, cabinet.quantity);
          break;
        case 'box_interior_finish':
        case 'doors_interior_finish':
          const isBox = changeType === 'box_interior_finish';
          newCost = calculateInteriorFinishCost(product, newMaterial, cabinet.quantity, isBox);
          break;
        case 'door_profile':
          newCost = calculateDoorProfileCost(product, newMaterial, cabinet.quantity);
          break;
        case 'drawer_box_material': {
          const dbxPieces = ((product as any).cut_pieces as any[] | null)?.filter((cp: any) => cp.material === 'drawer_box') ?? [];
          const dbxSF = dbxPieces.reduce((s: number, cp: any) => s + (cp.ancho * cp.alto * cp.cantidad) / 92903.04, 0);
          newCost = dbxSF > 0 ? calculateBackPanelMaterialCost(dbxSF * cabinet.quantity, newMaterial) : 0;
          break;
        }
        case 'shelf_material': {
          const shelfPieces = ((product as any).cut_pieces as any[] | null)?.filter((cp: any) => cp.material === 'shelf') ?? [];
          const shelfSF = shelfPieces.reduce((s: number, cp: any) => s + (cp.ancho * cp.alto * cp.cantidad) / 92903.04, 0);
          const extra = ((cabinet as any).extra_shelves ?? 0);
          const extraSF = extra > 0 && shelfPieces.length > 0 ? (shelfPieces[0].ancho * shelfPieces[0].alto * extra) / 92903.04 : 0;
          newCost = (shelfSF + extraSF) > 0 ? calculateBackPanelMaterialCost((shelfSF + extraSF) * cabinet.quantity, newMaterial) : 0;
          break;
        }
      }
    } catch (error) {
      console.error(`Error calculating cost for cabinet ${cabinet.id}:`, error);
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
    };
  });

  const costDifference = totalCostAfter - totalCostBefore;
  const percentageChange = totalCostBefore > 0 ? (costDifference / totalCostBefore) * 100 : 0;

  return {
    affectedCabinets,
    totalCabinets: affectedCabinets.length,
    costBefore: totalCostBefore,
    costAfter: totalCostAfter,
    costDifference,
    percentageChange,
  };
}

export async function executeBulkMaterialChange(
  params: BulkMaterialChangeParams,
  previewData?: BulkChangePreview
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  const {
    projectId,
    areaIds,
    changeType,
    oldMaterialId,
    newMaterialId,
    updateMatchingInteriorFinish,
    versionId,
  } = params;

  try {
    const preview = previewData || await previewBulkMaterialChange(params);

    if (preview.totalCabinets === 0) {
      return {
        success: false,
        updatedCount: 0,
        error: 'No cabinets found with the selected material',
      };
    }

    const tableName = versionId ? 'version_area_cabinets' : 'area_cabinets';

    // Batch fetch: get all affected cabinets and material info in parallel
    const cabinetIds = preview.affectedCabinets.map(c => c.id);
    const [{ data: oldMaterial }, { data: newMaterial }, { data: fullCabinets }] = await Promise.all([
      supabase.from('price_list').select('concept_description').eq('id', oldMaterialId).single(),
      supabase.from('price_list').select('concept_description, price').eq('id', newMaterialId).single(),
      supabase.from(tableName as 'area_cabinets').select('*').in('id', cabinetIds),
    ]);

    const cabinetMap = new Map((fullCabinets || []).map((c: any) => [c.id, c]));
    let updatePromises: Promise<any>[] = [];

    for (const cabinet of preview.affectedCabinets) {
      const updates: any = {};
      const currentCabinet = cabinetMap.get(cabinet.id);

      switch (changeType) {
        case 'box_material':
          updates.box_material_id = newMaterialId;
          updates.box_material_cost = cabinet.newCost;
          updates.original_box_material_price = newMaterial?.price || null;
          if (updateMatchingInteriorFinish && currentCabinet) {
            if (currentCabinet.box_interior_finish_id === oldMaterialId) {
              updates.box_interior_finish_id = newMaterialId;
              updates.original_box_interior_finish_price = newMaterial?.price || null;
            }
          }
          break;
        case 'box_edgeband':
          updates.box_edgeband_id = newMaterialId;
          updates.box_edgeband_cost = cabinet.newCost;
          updates.original_box_edgeband_price = newMaterial?.price || null;
          break;
        case 'doors_material':
          updates.doors_material_id = newMaterialId;
          updates.doors_material_cost = cabinet.newCost;
          updates.original_doors_material_price = newMaterial?.price || null;
          if (updateMatchingInteriorFinish && currentCabinet) {
            if (currentCabinet.doors_interior_finish_id === oldMaterialId) {
              updates.doors_interior_finish_id = newMaterialId;
              updates.original_doors_interior_finish_price = newMaterial?.price || null;
            }
          }
          break;
        case 'doors_edgeband':
          updates.doors_edgeband_id = newMaterialId;
          updates.doors_edgeband_cost = cabinet.newCost;
          updates.original_doors_edgeband_price = newMaterial?.price || null;
          break;
        case 'box_interior_finish':
          updates.box_interior_finish_id = newMaterialId;
          updates.box_interior_finish_cost = cabinet.newCost;
          updates.original_box_interior_finish_price = newMaterial?.price || null;
          break;
        case 'doors_interior_finish':
          updates.doors_interior_finish_id = newMaterialId;
          updates.doors_interior_finish_cost = cabinet.newCost;
          updates.original_doors_interior_finish_price = newMaterial?.price || null;
          break;
        case 'door_profile':
          updates.door_profile_id = newMaterialId;
          updates.door_profile_cost = cabinet.newCost;
          break;
        case 'drawer_box_material':
          updates.drawer_box_material_id = newMaterialId;
          updates.drawer_box_material_cost = cabinet.newCost;
          updates.use_drawer_box_material = true;
          break;
        case 'shelf_material':
          updates.shelf_material_id = newMaterialId;
          updates.shelf_material_cost = cabinet.newCost;
          updates.use_shelf_material = true;
          break;
      }

      if (currentCabinet) {
        const newSubtotal =
          (changeType === 'box_material' ? updates.box_material_cost : currentCabinet.box_material_cost || 0) +
          (changeType === 'box_edgeband' ? updates.box_edgeband_cost : currentCabinet.box_edgeband_cost || 0) +
          (changeType === 'box_interior_finish' ? updates.box_interior_finish_cost : currentCabinet.box_interior_finish_cost || 0) +
          (changeType === 'doors_material' ? updates.doors_material_cost : currentCabinet.doors_material_cost || 0) +
          (changeType === 'doors_edgeband' ? updates.doors_edgeband_cost : currentCabinet.doors_edgeband_cost || 0) +
          (changeType === 'doors_interior_finish' ? updates.doors_interior_finish_cost : currentCabinet.doors_interior_finish_cost || 0) +
          (changeType === 'door_profile' ? updates.door_profile_cost : currentCabinet.door_profile_cost || 0) +
          (currentCabinet.back_panel_material_cost || 0) +
          (currentCabinet.drawer_box_material_cost || 0) +
          (currentCabinet.shelf_material_cost || 0) +
          (currentCabinet.hardware_cost || 0) +
          (currentCabinet.accessories_cost || 0) +
          (currentCabinet.labor_cost || 0);

        updates.subtotal = newSubtotal;
      }

      updatePromises.push(
        supabase.from(tableName as 'area_cabinets').update(updates).eq('id', cabinet.id) as unknown as Promise<any>
      );
    }

    await Promise.all(updatePromises);

    // material_change_log exists in DB but is missing from generated types.
    // Regenerate database.types.ts via Supabase CLI to remove the cast.
    await supabase.from('material_change_log' as any).insert({
      project_id: projectId,
      user_action: `Changed ${changeType.replace('_', ' ')} from ${oldMaterial?.concept_description || 'Unknown'} to ${newMaterial?.concept_description || 'Unknown'}`,
      change_type: changeType,
      scope: params.scope,
      scope_details: areaIds,
      affected_cabinets_count: preview.totalCabinets,
      old_material_id: oldMaterialId,
      new_material_id: newMaterialId,
      old_material_name: oldMaterial?.concept_description,
      new_material_name: newMaterial?.concept_description,
      cost_before: preview.costBefore,
      cost_after: preview.costAfter,
      cost_difference: preview.costDifference,
    });

    return {
      success: true,
      updatedCount: preview.totalCabinets,
    };
  } catch (error: any) {
    console.error('Error executing bulk material change:', error);
    return {
      success: false,
      updatedCount: 0,
      error: error.message || 'Unknown error occurred',
    };
  }
}

export async function validateMaterialReplacement(
  oldMaterialId: string,
  newMaterialId: string
): Promise<{ valid: boolean; error?: string }> {
  const [{ data: oldMaterial }, { data: newMaterial }] = await Promise.all([
    supabase.from('price_list').select('*').eq('id', oldMaterialId).single(),
    supabase.from('price_list').select('*').eq('id', newMaterialId).single(),
  ]);

  if (!oldMaterial) {
    return { valid: false, error: 'Old material not found' };
  }

  if (!newMaterial) {
    return { valid: false, error: 'New material not found' };
  }

  if (!newMaterial.is_active) {
    return { valid: false, error: 'New material is not active' };
  }

  const oldType = oldMaterial.type.toLowerCase();
  const newType = newMaterial.type.toLowerCase();

  const isSheetMaterial = (type: string) =>
    type.includes('melamine') || type.includes('mdf') || type.includes('plywood') || type.includes('laminate');

  const isEdgeband = (type: string) => type.includes('edgeband');

  const isDoorProfile = (type: string) => type.includes('door profile');

  if (isSheetMaterial(oldType) && !isSheetMaterial(newType)) {
    return { valid: false, error: 'Cannot replace sheet material with non-sheet material' };
  }

  if (isEdgeband(oldType) && !isEdgeband(newType)) {
    return { valid: false, error: 'Cannot replace edgeband with non-edgeband material' };
  }

  if (isDoorProfile(oldType) && !isDoorProfile(newType)) {
    return { valid: false, error: 'Cannot replace door profile with a non-door profile item' };
  }

  return { valid: true };
}
