import { supabase } from './supabase';
import type { ProjectVersion, VersionProjectArea, VersionAreaCabinet, VersionAreaItem } from '../types/versioning';

export async function getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
  const { data, error } = await supabase
    .from('project_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getCurrentVersion(projectId: string): Promise<ProjectVersion | null> {
  const { data, error } = await supabase
    .from('project_versions')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_current', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getVersionById(versionId: string): Promise<ProjectVersion | null> {
  const { data, error } = await supabase
    .from('project_versions')
    .select('*')
    .eq('id', versionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function setCurrentVersion(versionId: string, projectId: string): Promise<void> {
  const { error: resetError } = await supabase
    .from('project_versions')
    .update({ is_current: false })
    .eq('project_id', projectId);

  if (resetError) throw resetError;

  const { error: setError } = await supabase
    .from('project_versions')
    .update({ is_current: true })
    .eq('id', versionId)
    .eq('project_id', projectId);

  if (setError) throw setError;
}

export async function createEmptyVersion(
  projectId: string,
  versionName: string,
  notes: string = ''
): Promise<ProjectVersion> {
  const versions = await getProjectVersions(projectId);
  const nextNumber = versions.length + 1;
  const versionNumber = `v${nextNumber}.0`;

  const { data, error } = await supabase
    .from('project_versions')
    .insert([{
      project_id: projectId,
      version_number: versionNumber,
      version_name: versionName,
      is_current: false,
      notes,
      total_amount: 0,
      created_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function duplicateVersion(
  sourceVersionId: string,
  projectId: string,
  versionName: string,
  notes: string = '',
  updatePrices: boolean = false
): Promise<ProjectVersion> {
  const sourceVersion = await getVersionById(sourceVersionId);
  if (!sourceVersion) throw new Error('Source version not found');

  const versions = await getProjectVersions(projectId);
  const nextNumber = versions.length + 1;
  const versionNumber = `v${nextNumber}.0`;

  const { data: newVersion, error: versionError } = await supabase
    .from('project_versions')
    .insert([{
      project_id: projectId,
      version_number: versionNumber,
      version_name: versionName,
      is_current: false,
      notes,
      total_amount: 0,
      based_on_version_id: sourceVersionId,
      created_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (versionError) throw versionError;

  const { data: sourceAreas, error: areasError } = await supabase
    .from('version_project_areas')
    .select('*')
    .eq('version_id', sourceVersionId);

  if (areasError) throw areasError;

  if (sourceAreas && sourceAreas.length > 0) {
    const areaIdMap = new Map<string, string>();

    for (const area of sourceAreas) {
      const { id: oldId, version_id, created_at, ...areaData } = area;
      const { data: newArea, error: newAreaError } = await supabase
        .from('version_project_areas')
        .insert([{
          ...areaData,
          version_id: newVersion.id,
        }])
        .select()
        .single();

      if (newAreaError) throw newAreaError;
      areaIdMap.set(oldId, newArea.id);
    }

    const { data: sourceCabinets, error: cabinetsError } = await supabase
      .from('version_area_cabinets')
      .select('*')
      .in('area_id', Array.from(areaIdMap.keys()));

    if (cabinetsError) throw cabinetsError;

    if (sourceCabinets && sourceCabinets.length > 0) {
      let cabinetsToInsert = sourceCabinets.map(cabinet => {
        const { id, area_id, created_at, updated_at, ...cabinetData } = cabinet;
        return {
          ...cabinetData,
          area_id: areaIdMap.get(area_id)!,
        };
      });

      if (updatePrices) {
        cabinetsToInsert = await updateCabinetPrices(cabinetsToInsert);
      }

      const { error: insertCabinetsError } = await supabase
        .from('version_area_cabinets')
        .insert(cabinetsToInsert);

      if (insertCabinetsError) throw insertCabinetsError;
    }

    const { data: sourceItems, error: itemsError } = await supabase
      .from('version_area_items')
      .select('*')
      .in('area_id', Array.from(areaIdMap.keys()));

    if (itemsError) throw itemsError;

    if (sourceItems && sourceItems.length > 0) {
      let itemsToInsert = sourceItems.map(item => {
        const { id, area_id, created_at, updated_at, ...itemData } = item;
        return {
          ...itemData,
          area_id: areaIdMap.get(area_id)!,
        };
      });

      if (updatePrices) {
        itemsToInsert = await updateItemPrices(itemsToInsert);
      }

      const { error: insertItemsError } = await supabase
        .from('version_area_items')
        .insert(itemsToInsert);

      if (insertItemsError) throw insertItemsError;
    }

    const { data: sourceCountertops, error: countertopsError } = await supabase
      .from('version_area_countertops')
      .select('*')
      .in('area_id', Array.from(areaIdMap.keys()));

    if (countertopsError) throw countertopsError;

    if (sourceCountertops && sourceCountertops.length > 0) {
      let countertopsToInsert = sourceCountertops.map(countertop => {
        const { id, area_id, created_at, ...countertopData } = countertop;
        return {
          ...countertopData,
          version_id: newVersion.id,
          area_id: areaIdMap.get(area_id)!,
        };
      });

      if (updatePrices) {
        countertopsToInsert = await updateCountertopPrices(countertopsToInsert);
      }

      const { error: insertCountertopsError } = await supabase
        .from('version_area_countertops')
        .insert(countertopsToInsert);

      if (insertCountertopsError) throw insertCountertopsError;
    }
  }

  await recalculateVersionTotal(newVersion.id);

  const updatedVersion = await getVersionById(newVersion.id);
  return updatedVersion!;
}

async function updateCabinetPrices(cabinets: any[]): Promise<any[]> {
  const priceIds = [
    ...cabinets.map(c => c.box_material_id),
    ...cabinets.map(c => c.box_edgeband_id),
    ...cabinets.map(c => c.box_interior_finish_id),
    ...cabinets.map(c => c.doors_material_id),
    ...cabinets.map(c => c.doors_edgeband_id),
    ...cabinets.map(c => c.doors_interior_finish_id),
  ].filter(Boolean);

  if (priceIds.length === 0) return cabinets;

  const { data: priceList, error } = await supabase
    .from('price_list')
    .select('*')
    .in('id', priceIds);

  if (error) throw error;

  const priceMap = new Map(priceList?.map(p => [p.id, p]) || []);

  return cabinets.map(cabinet => {
    const updated = { ...cabinet };

    if (cabinet.box_material_id && priceMap.has(cabinet.box_material_id)) {
      const material = priceMap.get(cabinet.box_material_id);
      const boxSf = cabinet.box_sf || 0;
      updated.box_material_cost = (boxSf * material.price * (1 + (cabinet.wastePercentageBox || 10) / 100));
    }

    if (cabinet.box_edgeband_id && priceMap.has(cabinet.box_edgeband_id)) {
      const edgeband = priceMap.get(cabinet.box_edgeband_id);
      const totalEdgeband = cabinet.total_edgeband || 0;
      updated.box_edgeband_cost = (totalEdgeband * edgeband.price);
    }

    if (cabinet.doors_material_id && priceMap.has(cabinet.doors_material_id)) {
      const material = priceMap.get(cabinet.doors_material_id);
      const doorsSf = cabinet.doors_fronts_sf || 0;
      updated.doors_material_cost = (doorsSf * material.price * (1 + (cabinet.wastePercentageDoors || 10) / 100));
    }

    if (cabinet.doors_edgeband_id && priceMap.has(cabinet.doors_edgeband_id)) {
      const edgeband = priceMap.get(cabinet.doors_edgeband_id);
      const totalEdgeband = cabinet.total_edgeband || 0;
      updated.doors_edgeband_cost = (totalEdgeband * edgeband.price);
    }

    updated.subtotal = (
      (updated.box_material_cost || 0) +
      (updated.box_edgeband_cost || 0) +
      (updated.box_interior_finish_cost || 0) +
      (updated.doors_material_cost || 0) +
      (updated.doors_edgeband_cost || 0) +
      (updated.doors_interior_finish_cost || 0) +
      (updated.hardware_cost || 0) +
      (updated.labor_cost || 0)
    ) * (updated.quantity || 1);

    return updated;
  });
}

async function updateItemPrices(items: any[]): Promise<any[]> {
  const priceIds = items.map(i => i.price_list_item_id).filter(Boolean);

  if (priceIds.length === 0) return items;

  const { data: priceList, error } = await supabase
    .from('price_list')
    .select('*')
    .in('id', priceIds);

  if (error) throw error;

  const priceMap = new Map(priceList?.map(p => [p.id, p]) || []);

  return items.map(item => {
    const updated = { ...item };

    if (item.price_list_item_id && priceMap.has(item.price_list_item_id)) {
      const priceItem = priceMap.get(item.price_list_item_id);
      updated.unit_price = priceItem.price;
      updated.subtotal = priceItem.price * (item.quantity || 1);
    }

    return updated;
  });
}

async function updateCountertopPrices(countertops: any[]): Promise<any[]> {
  const priceIds = countertops.map(ct => ct.price_list_item_id).filter(Boolean);

  if (priceIds.length === 0) return countertops;

  const { data: priceList, error } = await supabase
    .from('price_list')
    .select('*')
    .in('id', priceIds);

  if (error) throw error;

  const priceMap = new Map(priceList?.map(p => [p.id, p]) || []);

  return countertops.map(countertop => {
    const updated = { ...countertop };

    if (countertop.price_list_item_id && priceMap.has(countertop.price_list_item_id)) {
      const priceItem = priceMap.get(countertop.price_list_item_id);
      updated.unit_price = priceItem.price;
      updated.subtotal = priceItem.price * (countertop.quantity || 1);
    }

    return updated;
  });
}

export async function recalculateVersionTotal(versionId: string): Promise<void> {
  const { data: areas, error: areasError } = await supabase
    .from('version_project_areas')
    .select(`
      *,
      cabinets:version_area_cabinets(subtotal),
      items:version_area_items(subtotal),
      countertops:version_area_countertops(subtotal)
    `)
    .eq('version_id', versionId);

  if (areasError) throw areasError;

  let total = 0;
  if (areas) {
    for (const area of areas) {
      const cabinetsTotal = (area.cabinets || []).reduce((sum: number, c: any) => sum + (c.subtotal || 0), 0);
      const itemsTotal = (area.items || []).reduce((sum: number, i: any) => sum + (i.subtotal || 0), 0);
      const countertopsTotal = (area.countertops || []).reduce((sum: number, ct: any) => sum + (ct.subtotal || 0), 0);
      const areaTotal = cabinetsTotal + itemsTotal + countertopsTotal;
      total += areaTotal;

      await supabase
        .from('version_project_areas')
        .update({ subtotal: areaTotal })
        .eq('id', area.id);
    }
  }

  await supabase
    .from('project_versions')
    .update({ total_amount: total })
    .eq('id', versionId);
}

export async function deleteVersion(versionId: string): Promise<void> {
  const version = await getVersionById(versionId);
  if (!version) throw new Error('Version not found');

  if (version.is_current) {
    throw new Error('Cannot delete the current version');
  }

  const { error } = await supabase
    .from('project_versions')
    .delete()
    .eq('id', versionId);

  if (error) throw error;
}

export async function getVersionData(versionId: string) {
  const { data: areas, error } = await supabase
    .from('version_project_areas')
    .select(`
      *,
      cabinets:version_area_cabinets(*),
      items:version_area_items(*),
      countertops:version_area_countertops(*)
    `)
    .eq('version_id', versionId)
    .order('display_order');

  if (error) throw error;
  return areas || [];
}

export interface VersionComparison {
  version1: ProjectVersion;
  version2: ProjectVersion;
  data1: any[];
  data2: any[];
  differences: {
    totalDiff: number;
    areasDiff: {
      added: string[];
      removed: string[];
      modified: string[];
    };
    cabinetsDiff: {
      added: number;
      removed: number;
      modified: number;
    };
    itemsDiff: {
      added: number;
      removed: number;
      modified: number;
    };
  };
}

export async function compareVersions(
  versionId1: string,
  versionId2: string
): Promise<VersionComparison> {
  const [version1, version2, data1, data2] = await Promise.all([
    getVersionById(versionId1),
    getVersionById(versionId2),
    getVersionData(versionId1),
    getVersionData(versionId2),
  ]);

  if (!version1 || !version2) throw new Error('Version not found');

  const totalDiff = (version2.total_amount || 0) - (version1.total_amount || 0);

  const area1Names = new Set(data1.map(a => a.name));
  const area2Names = new Set(data2.map(a => a.name));

  const areasAdded = data2.filter(a => !area1Names.has(a.name)).map(a => a.name);
  const areasRemoved = data1.filter(a => !area2Names.has(a.name)).map(a => a.name);
  const areasModified = data2
    .filter(a => area1Names.has(a.name))
    .filter(a2 => {
      const a1 = data1.find(a => a.name === a2.name);
      return a1 && a1.subtotal !== a2.subtotal;
    })
    .map(a => a.name);

  const cabinets1 = data1.flatMap(a => a.cabinets || []);
  const cabinets2 = data2.flatMap(a => a.cabinets || []);

  const items1 = data1.flatMap(a => a.items || []);
  const items2 = data2.flatMap(a => a.items || []);

  return {
    version1,
    version2,
    data1,
    data2,
    differences: {
      totalDiff,
      areasDiff: {
        added: areasAdded,
        removed: areasRemoved,
        modified: areasModified,
      },
      cabinetsDiff: {
        added: cabinets2.length - cabinets1.length > 0 ? cabinets2.length - cabinets1.length : 0,
        removed: cabinets1.length - cabinets2.length > 0 ? cabinets1.length - cabinets2.length : 0,
        modified: areasModified.length,
      },
      itemsDiff: {
        added: items2.length - items1.length > 0 ? items2.length - items1.length : 0,
        removed: items1.length - items2.length > 0 ? items1.length - items2.length : 0,
        modified: 0,
      },
    },
  };
}

export async function addVersionArea(versionId: string, areaName: string): Promise<string> {
  const { data, error } = await supabase
    .from('version_project_areas')
    .insert([{
      version_id: versionId,
      name: areaName,
      display_order: 0,
      subtotal: 0,
    }])
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

export async function updateVersionArea(areaId: string, data: { name?: string; subtotal?: number }): Promise<void> {
  const { error } = await supabase
    .from('version_project_areas')
    .update(data)
    .eq('id', areaId);

  if (error) throw error;
}

export async function deleteVersionArea(areaId: string): Promise<void> {
  const { error } = await supabase
    .from('version_project_areas')
    .delete()
    .eq('id', areaId);

  if (error) throw error;
}

export async function addVersionCabinet(cabinetData: any): Promise<void> {
  const { error } = await supabase
    .from('version_area_cabinets')
    .insert([cabinetData]);

  if (error) throw error;
}

export async function updateVersionCabinet(cabinetId: string, cabinetData: any): Promise<void> {
  const { error } = await supabase
    .from('version_area_cabinets')
    .update(cabinetData)
    .eq('id', cabinetId);

  if (error) throw error;
}

export async function deleteVersionCabinet(cabinetId: string): Promise<void> {
  const { error } = await supabase
    .from('version_area_cabinets')
    .delete()
    .eq('id', cabinetId);

  if (error) throw error;
}

export async function duplicateVersionCabinet(cabinetId: string): Promise<void> {
  const { data: cabinet, error: fetchError } = await supabase
    .from('version_area_cabinets')
    .select('*')
    .eq('id', cabinetId)
    .single();

  if (fetchError) throw fetchError;

  const { id, created_at, updated_at, ...cabinetData } = cabinet;

  const { error: insertError } = await supabase
    .from('version_area_cabinets')
    .insert([cabinetData]);

  if (insertError) throw insertError;
}

export async function addVersionItem(itemData: any): Promise<void> {
  const { error } = await supabase
    .from('version_area_items')
    .insert([itemData]);

  if (error) throw error;
}

export async function updateVersionItem(itemId: string, itemData: any): Promise<void> {
  const { error } = await supabase
    .from('version_area_items')
    .update(itemData)
    .eq('id', itemId);

  if (error) throw error;
}

export async function deleteVersionItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('version_area_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
}
