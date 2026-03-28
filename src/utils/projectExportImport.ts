import { supabase } from '../lib/supabase';
import type { Project, ProjectArea, AreaCabinet, AreaItem, AreaCountertop, AreaClosetItem, HardwareItem, AccessoryItem } from '../types';

export interface ProjectExport {
  exportVersion: "1.0";
  exportDate: string;
  project: Project;
  areas: Array<{
    area: ProjectArea;
    cabinets: AreaCabinet[];
    items: AreaItem[];
    countertops: AreaCountertop[];
    closetItems: AreaClosetItem[];
  }>;
  metadata: {
    totalAreas: number;
    totalCabinets: number;
    totalItems: number;
    totalCountertops: number;
    totalClosetItems: number;
    originalProjectId: string;
  };
}

export interface MaterialWarning {
  materialId: string;
  materialType: 'box_material' | 'doors_material' | 'edgeband' | 'finish' | 'back_panel' | 'hardware' | 'accessory';
  cabinetSku?: string;
  cabinetDescription?: string;
}

export interface ValidationResult {
  isValid: boolean;
  warnings: MaterialWarning[];
  newProjectName: string;
  projectData: ProjectExport | null;
  error?: string;
}

export interface ImportSummary {
  areasImported: number;
  cabinetsImported: number;
  itemsImported: number;
  countertopsImported: number;
  closetItemsImported: number;
}

export async function exportProjectToJSON(projectId: string): Promise<void> {
  try {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) throw new Error(`Error loading project: ${projectError.message}`);
    if (!project) throw new Error('Project not found');

    const { data: projectAreas, error: areasError } = await supabase
      .from('project_areas')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true });

    if (areasError) throw new Error(`Error loading areas: ${areasError.message}`);

    const areas = await Promise.all(
      (projectAreas || []).map(async (area) => {
        const [cabinetsResult, itemsResult, countertopsResult, closetItemsResult] = await Promise.all([
          supabase.from('area_cabinets').select('*').eq('area_id', area.id),
          supabase.from('area_items').select('*').eq('area_id', area.id),
          supabase.from('area_countertops').select('*').eq('area_id', area.id),
          supabase.from('area_closet_items').select('*').eq('area_id', area.id),
        ]);

        if (cabinetsResult.error) throw new Error(`Error loading cabinets: ${cabinetsResult.error.message}`);
        if (itemsResult.error) throw new Error(`Error loading items: ${itemsResult.error.message}`);
        if (countertopsResult.error) throw new Error(`Error loading countertops: ${countertopsResult.error.message}`);
        if (closetItemsResult.error) throw new Error(`Error loading closet items: ${closetItemsResult.error.message}`);

        return {
          area,
          cabinets: cabinetsResult.data || [],
          items: itemsResult.data || [],
          countertops: countertopsResult.data || [],
          closetItems: (closetItemsResult.data || []) as AreaClosetItem[],
        };
      })
    );

    const exportData: ProjectExport = {
      exportVersion: "1.0",
      exportDate: new Date().toISOString(),
      project,
      areas,
      metadata: {
        totalAreas: areas.length,
        totalCabinets: areas.reduce((sum, a) => sum + a.cabinets.length, 0),
        totalItems: areas.reduce((sum, a) => sum + a.items.length, 0),
        totalCountertops: areas.reduce((sum, a) => sum + a.countertops.length, 0),
        totalClosetItems: areas.reduce((sum, a) => sum + a.closetItems.length, 0),
        originalProjectId: projectId,
      },
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const sanitizedName = sanitizeFileName(project.name);
    const timestamp = formatExportDate();
    link.setAttribute('href', url);
    link.setAttribute('download', `${sanitizedName}_${timestamp}.evita.json`);

    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

export async function validateProjectImport(
  file: File,
  importMode: 'new' | 'version'
): Promise<ValidationResult> {
  try {
    if (file.size > 10 * 1024 * 1024) {
      return {
        isValid: false,
        warnings: [],
        newProjectName: '',
        projectData: null,
        error: 'File size exceeds 10MB limit',
      };
    }

    if (!file.name.endsWith('.evita.json')) {
      return {
        isValid: false,
        warnings: [],
        newProjectName: '',
        projectData: null,
        error: 'Invalid file format. Please select a .evita.json file',
      };
    }

    const jsonString = await readFileAsText(file);
    let projectData: ProjectExport;

    try {
      projectData = JSON.parse(jsonString);
    } catch (parseError) {
      return {
        isValid: false,
        warnings: [],
        newProjectName: '',
        projectData: null,
        error: 'Invalid JSON format',
      };
    }

    if (!validateExportStructure(projectData)) {
      return {
        isValid: false,
        warnings: [],
        newProjectName: '',
        projectData: null,
        error: 'Invalid project structure',
      };
    }

    if (projectData.exportVersion !== "1.0") {
      return {
        isValid: false,
        warnings: [],
        newProjectName: '',
        projectData: null,
        error: `Unsupported export version: ${projectData.exportVersion}`,
      };
    }

    const materialIds = extractMaterialIds(projectData);
    const warnings = await checkMaterialsAvailability(materialIds, projectData);

    const newProjectName = await generateProjectName(projectData.project.name, importMode);

    return {
      isValid: true,
      warnings,
      newProjectName,
      projectData,
    };
  } catch (error) {
    console.error('Validation error:', error);
    return {
      isValid: false,
      warnings: [],
      newProjectName: '',
      projectData: null,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}

export async function performProjectImport(
  projectData: ProjectExport,
  newProjectName: string,
  importMode: 'new' | 'version' = 'new'
): Promise<{ success: boolean; projectId: string; summary: ImportSummary; error?: string }> {
  try {
    const { project, areas } = projectData;

    let groupId: string;

    if (importMode === 'version') {
      const baseName = project.name;
      const { data: existingProjects } = await supabase
        .from('projects')
        .select('group_id')
        .ilike('name', `${baseName}%`)
        .not('group_id', 'is', null)
        .limit(1);

      if (existingProjects && existingProjects.length > 0 && existingProjects[0].group_id) {
        groupId = existingProjects[0].group_id;
      } else {
        groupId = crypto.randomUUID();
      }
    } else {
      groupId = crypto.randomUUID();
    }

    const projectInsert = {
      name: newProjectName,
      customer: project.customer,
      address: project.address,
      project_type: project.project_type,
      status: project.status,
      quote_date: project.quote_date,
      other_expenses: project.other_expenses || 0,
      other_expenses_label: project.other_expenses_label || 'Other Expenses',
      profit_multiplier: project.profit_multiplier || 0,
      tariff_multiplier: project.tariff_multiplier || 0,
      tax_percentage: project.tax_percentage || 0,
      install_delivery: project.install_delivery || 0,
      install_delivery_usd: (project as any).install_delivery_usd || 0,
      install_delivery_per_box_usd: (project as any).install_delivery_per_box_usd || 0,
      referral_currency_rate: project.referral_currency_rate || 0,
      project_brief: project.project_brief,
      disclaimer_tariff_info: project.disclaimer_tariff_info,
      disclaimer_price_validity: project.disclaimer_price_validity,
      group_id: groupId,
    };

    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .insert([projectInsert])
      .select()
      .single();

    if (projectError || !newProject) {
      throw new Error(`Failed to create project: ${projectError?.message || 'Unknown error'}`);
    }

    let totalCabinets = 0;
    let totalItems = 0;
    let totalCountertops = 0;
    let totalClosetItems = 0;

    for (const areaData of areas) {
      const { area, cabinets, items, countertops, closetItems = [] } = areaData;

      const areaInsert = {
        project_id: newProject.id,
        name: area.name,
        display_order: area.display_order,
        applies_tariff: area.applies_tariff ?? true,
        quantity: (area as any).quantity ?? 1,
      };

      const { data: newArea, error: areaError } = await supabase
        .from('project_areas')
        .insert([areaInsert])
        .select()
        .single();

      if (areaError || !newArea) {
        throw new Error(`Failed to create area: ${areaError?.message || 'Unknown error'}`);
      }

      if (cabinets.length > 0) {
        const cabinetInserts = cabinets.map(cabinet => {
          const { id, area_id, created_at, updated_at, ...cabinetData } = cabinet;
          return {
            ...cabinetData,
            area_id: newArea.id,
          };
        });

        const { error: cabinetsError } = await supabase
          .from('area_cabinets')
          .insert(cabinetInserts);

        if (cabinetsError) {
          throw new Error(`Failed to create cabinets: ${cabinetsError.message}`);
        }

        totalCabinets += cabinets.length;
      }

      if (items.length > 0) {
        const itemInserts = items.map(item => {
          const { id, area_id, created_at, updated_at, ...itemData } = item;
          return {
            ...itemData,
            area_id: newArea.id,
          };
        });

        const { error: itemsError } = await supabase
          .from('area_items')
          .insert(itemInserts);

        if (itemsError) {
          throw new Error(`Failed to create items: ${itemsError.message}`);
        }

        totalItems += items.length;
      }

      if (countertops.length > 0) {
        const countertopInserts = countertops.map(countertop => {
          const { id, area_id, created_at, updated_at, ...countertopData } = countertop;
          return {
            ...countertopData,
            area_id: newArea.id,
          };
        });

        const { error: countertopsError } = await supabase
          .from('area_countertops')
          .insert(countertopInserts);

        if (countertopsError) {
          throw new Error(`Failed to create countertops: ${countertopsError.message}`);
        }

        totalCountertops += countertops.length;
      }

      if (closetItems.length > 0) {
        const closetInserts = closetItems.map(ci => {
          const { id, area_id, created_at, updated_at, catalog_item, ...ciData } = ci as any;
          return {
            ...ciData,
            area_id: newArea.id,
          };
        });

        const { error: closetError } = await supabase
          .from('area_closet_items')
          .insert(closetInserts);

        if (closetError) {
          throw new Error(`Failed to create closet items: ${closetError.message}`);
        }

        totalClosetItems += closetItems.length;
      }
    }

    return {
      success: true,
      projectId: newProject.id,
      summary: {
        areasImported: areas.length,
        cabinetsImported: totalCabinets,
        itemsImported: totalItems,
        countertopsImported: totalCountertops,
        closetItemsImported: totalClosetItems,
      },
    };
  } catch (error) {
    console.error('Import error:', error);
    return {
      success: false,
      projectId: '',
      summary: {
        areasImported: 0,
        cabinetsImported: 0,
        itemsImported: 0,
        countertopsImported: 0,
        closetItemsImported: 0,
      },
      error: error instanceof Error ? error.message : 'Unknown import error',
    };
  }
}

function validateExportStructure(data: any): boolean {
  return (
    data &&
    typeof data === 'object' &&
    data.exportVersion &&
    data.exportDate &&
    data.project &&
    Array.isArray(data.areas) &&
    data.metadata &&
    typeof data.metadata.totalAreas === 'number' &&
    typeof data.metadata.originalProjectId === 'string'
  );
}

function extractMaterialIds(projectData: ProjectExport): Set<string> {
  const ids = new Set<string>();

  projectData.areas.forEach(areaData => {
    areaData.cabinets.forEach(cabinet => {
      if (cabinet.box_material_id) ids.add(cabinet.box_material_id);
      if (cabinet.box_edgeband_id) ids.add(cabinet.box_edgeband_id);
      if (cabinet.box_interior_finish_id) ids.add(cabinet.box_interior_finish_id);
      if (cabinet.doors_material_id) ids.add(cabinet.doors_material_id);
      if (cabinet.doors_edgeband_id) ids.add(cabinet.doors_edgeband_id);
      if (cabinet.doors_interior_finish_id) ids.add(cabinet.doors_interior_finish_id);
      if (cabinet.back_panel_material_id) ids.add(cabinet.back_panel_material_id);

      if (Array.isArray(cabinet.hardware)) {
        cabinet.hardware.forEach((hw: HardwareItem) => {
          if (hw.hardware_id) ids.add(hw.hardware_id);
        });
      }

      if (Array.isArray(cabinet.accessories)) {
        cabinet.accessories.forEach((acc: AccessoryItem) => {
          if (acc.accessory_id) ids.add(acc.accessory_id);
        });
      }
    });

    areaData.items.forEach(item => {
      if (item.price_list_item_id) ids.add(item.price_list_item_id);
    });

    areaData.countertops.forEach(countertop => {
      if (countertop.price_list_item_id) ids.add(countertop.price_list_item_id);
    });
  });

  return ids;
}

function extractClosetCatalogIds(projectData: ProjectExport): Set<string> {
  const ids = new Set<string>();
  projectData.areas.forEach(areaData => {
    (areaData.closetItems || []).forEach(ci => {
      if (ci.closet_catalog_id) ids.add(ci.closet_catalog_id);
    });
  });
  return ids;
}

async function checkMaterialsAvailability(
  materialIds: Set<string>,
  projectData: ProjectExport
): Promise<MaterialWarning[]> {
  const warnings: MaterialWarning[] = [];

  if (materialIds.size === 0) return warnings;

  const { data: existingMaterials, error } = await supabase
    .from('price_list')
    .select('id')
    .in('id', Array.from(materialIds));

  if (error) {
    console.error('Error checking materials:', error);
    return warnings;
  }

  const existingIds = new Set(existingMaterials?.map(m => m.id) || []);

  projectData.areas.forEach(areaData => {
    areaData.cabinets.forEach(cabinet => {
      if (cabinet.box_material_id && !existingIds.has(cabinet.box_material_id)) {
        warnings.push({
          materialId: cabinet.box_material_id,
          materialType: 'box_material',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: cabinet.description || undefined,
        });
      }

      if (cabinet.doors_material_id && !existingIds.has(cabinet.doors_material_id)) {
        warnings.push({
          materialId: cabinet.doors_material_id,
          materialType: 'doors_material',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: cabinet.description || undefined,
        });
      }

      if (cabinet.box_edgeband_id && !existingIds.has(cabinet.box_edgeband_id)) {
        warnings.push({
          materialId: cabinet.box_edgeband_id,
          materialType: 'edgeband',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: cabinet.description || undefined,
        });
      }

      if (cabinet.doors_edgeband_id && !existingIds.has(cabinet.doors_edgeband_id)) {
        warnings.push({
          materialId: cabinet.doors_edgeband_id,
          materialType: 'edgeband',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: cabinet.description || undefined,
        });
      }

      if (cabinet.box_interior_finish_id && !existingIds.has(cabinet.box_interior_finish_id)) {
        warnings.push({
          materialId: cabinet.box_interior_finish_id,
          materialType: 'finish',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: cabinet.description || undefined,
        });
      }

      if (cabinet.doors_interior_finish_id && !existingIds.has(cabinet.doors_interior_finish_id)) {
        warnings.push({
          materialId: cabinet.doors_interior_finish_id,
          materialType: 'finish',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: cabinet.description || undefined,
        });
      }

      if (cabinet.back_panel_material_id && !existingIds.has(cabinet.back_panel_material_id)) {
        warnings.push({
          materialId: cabinet.back_panel_material_id,
          materialType: 'back_panel',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: cabinet.description || undefined,
        });
      }

      if (Array.isArray(cabinet.hardware)) {
        cabinet.hardware.forEach((hw: HardwareItem) => {
          if (hw.hardware_id && !existingIds.has(hw.hardware_id)) {
            warnings.push({
              materialId: hw.hardware_id,
              materialType: 'hardware',
              cabinetSku: cabinet.product_sku || undefined,
              cabinetDescription: cabinet.description || undefined,
            });
          }
        });
      }

      if (Array.isArray(cabinet.accessories)) {
        cabinet.accessories.forEach((acc: AccessoryItem) => {
          if (acc.accessory_id && !existingIds.has(acc.accessory_id)) {
            warnings.push({
              materialId: acc.accessory_id,
              materialType: 'accessory',
              cabinetSku: cabinet.product_sku || undefined,
              cabinetDescription: cabinet.description || undefined,
            });
          }
        });
      }
    });
  });

  return warnings;
}

async function generateProjectName(baseName: string, importMode: 'new' | 'version'): Promise<string> {
  if (importMode === 'new') {
    return `${baseName} (Imported)`;
  }

  const { data: existingProjects, error } = await supabase
    .from('projects')
    .select('name')
    .like('name', `${baseName}%`);

  if (error || !existingProjects) {
    return `${baseName} - v2`;
  }

  const versionNumbers: number[] = [];
  const versionRegex = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} - v(\\d+)$`);

  existingProjects.forEach(project => {
    const match = project.name.match(versionRegex);
    if (match) {
      versionNumbers.push(parseInt(match[1], 10));
    }
  });

  if (versionNumbers.length === 0) {
    return `${baseName} - v2`;
  }

  const maxVersion = Math.max(...versionNumbers);
  return `${baseName} - v${maxVersion + 1}`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function formatExportDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('File reading failed'));
    reader.readAsText(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
