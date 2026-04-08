import { supabase } from '../lib/supabase';
import type { Quotation, ProjectArea, AreaCabinet, AreaItem, AreaCountertop, AreaClosetItem, HardwareItem, AccessoryItem } from '../types';

export interface ProjectExport {
  exportVersion: "1.0";
  exportDate: string;
  project: Quotation;
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

export async function exportQuotationToJSON(quotationId: string): Promise<void> {
  return exportProjectToJSON(quotationId);
}

async function exportProjectToJSON(projectId: string): Promise<void> {
  try {
    const { data: project, error: projectError } = await supabase
      .from('quotations')
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
          closetItems: (closetItemsResult.data || []) as unknown as AreaClosetItem[],
        };
      })
    );

    const exportData: ProjectExport = {
      exportVersion: "1.0",
      exportDate: new Date().toISOString(),
      project,
      areas: areas as unknown as ProjectExport['areas'],
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

export async function validateQuotationImport(
  file: File
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

    const newProjectName = projectData.project.name;

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

export async function performQuotationImport(
  projectData: ProjectExport,
  projectId: string,
  versionLabel?: string
): Promise<{ success: boolean; quotationId: string; summary: ImportSummary; error?: string }> {
  try {
    const { project, areas } = projectData;

    // Auto-calculate version number
    const { data: existing } = await supabase
      .from('quotations')
      .select('version_number')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (existing?.[0]?.version_number ?? 0) + 1;
    const label = versionLabel || `v${nextVersion}`;

    // Get project hub for name
    const { data: hub } = await supabase.from('projects').select('name').eq('id', projectId).single();
    const hubName = hub?.name || project.name;

    const quotationInsert = {
      project_id: projectId,
      name: `${hubName} - ${label}`,
      version_label: label,
      version_number: nextVersion,
      customer: project.customer,
      address: project.address,
      project_type: project.project_type,
      status: 'Estimating',
      quote_date: new Date().toISOString().split('T')[0],
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
    };

    const { data: newQuotation, error: quotationError } = await supabase
      .from('quotations')
      .insert([quotationInsert])
      .select()
      .single();

    if (quotationError || !newQuotation) {
      throw new Error(`Failed to create quotation: ${quotationError?.message || 'Unknown error'}`);
    }

    let totalCabinets = 0;
    let totalItems = 0;
    let totalCountertops = 0;
    let totalClosetItems = 0;

    for (const areaData of areas) {
      const { area, cabinets, items, countertops, closetItems = [] } = areaData;

      const areaInsert = {
        project_id: newQuotation.id,
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
          const { id, area_id, created_at, updated_at, ...cabinetData } = cabinet as typeof cabinet & { updated_at?: string | null };
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
      quotationId: newQuotation.id,
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
      quotationId: '',
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

/** Creates a project hub + imports the first quotation into it */
export async function createProjectWithFirstQuotation(
  projectData: ProjectExport,
  projectName: string
): Promise<{ success: boolean; projectId: string; quotationId: string; summary: ImportSummary; error?: string }> {
  try {
    const srcProject = projectData.project;

    const { data: hub, error: hubError } = await supabase
      .from('projects')
      .insert({
        name: projectName,
        customer: srcProject.customer,
        address: srcProject.address,
        project_type: srcProject.project_type,
        project_details: srcProject.project_details,
        project_brief: srcProject.project_brief,
      })
      .select('id')
      .single();

    if (hubError || !hub) {
      throw new Error(`Failed to create project: ${hubError?.message || 'Unknown error'}`);
    }

    const result = await performQuotationImport(projectData, hub.id, 'Original');

    return {
      success: result.success,
      projectId: hub.id,
      quotationId: result.quotationId,
      summary: result.summary,
      error: result.error,
    };
  } catch (error) {
    console.error('Create project + import error:', error);
    return {
      success: false,
      projectId: '',
      quotationId: '',
      summary: { areasImported: 0, cabinetsImported: 0, itemsImported: 0, countertopsImported: 0, closetItemsImported: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** @deprecated Use performQuotationImport */
export const performProjectImport = performQuotationImport as any;

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
        (cabinet.hardware as unknown as HardwareItem[]).forEach((hw) => {
          if (hw.hardware_id) ids.add(hw.hardware_id);
        });
      }

      if (Array.isArray(cabinet.accessories)) {
        (cabinet.accessories as unknown as AccessoryItem[]).forEach((acc) => {
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
          cabinetDescription: (cabinet as { description?: string }).description || undefined,
        });
      }

      if (cabinet.doors_material_id && !existingIds.has(cabinet.doors_material_id)) {
        warnings.push({
          materialId: cabinet.doors_material_id,
          materialType: 'doors_material',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: (cabinet as { description?: string }).description || undefined,
        });
      }

      if (cabinet.box_edgeband_id && !existingIds.has(cabinet.box_edgeband_id)) {
        warnings.push({
          materialId: cabinet.box_edgeband_id,
          materialType: 'edgeband',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: (cabinet as { description?: string }).description || undefined,
        });
      }

      if (cabinet.doors_edgeband_id && !existingIds.has(cabinet.doors_edgeband_id)) {
        warnings.push({
          materialId: cabinet.doors_edgeband_id,
          materialType: 'edgeband',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: (cabinet as { description?: string }).description || undefined,
        });
      }

      if (cabinet.box_interior_finish_id && !existingIds.has(cabinet.box_interior_finish_id)) {
        warnings.push({
          materialId: cabinet.box_interior_finish_id,
          materialType: 'finish',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: (cabinet as { description?: string }).description || undefined,
        });
      }

      if (cabinet.doors_interior_finish_id && !existingIds.has(cabinet.doors_interior_finish_id)) {
        warnings.push({
          materialId: cabinet.doors_interior_finish_id,
          materialType: 'finish',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: (cabinet as { description?: string }).description || undefined,
        });
      }

      if (cabinet.back_panel_material_id && !existingIds.has(cabinet.back_panel_material_id)) {
        warnings.push({
          materialId: cabinet.back_panel_material_id,
          materialType: 'back_panel',
          cabinetSku: cabinet.product_sku || undefined,
          cabinetDescription: (cabinet as { description?: string }).description || undefined,
        });
      }

      if (Array.isArray(cabinet.hardware)) {
        (cabinet.hardware as unknown as HardwareItem[]).forEach((hw) => {
          if (hw.hardware_id && !existingIds.has(hw.hardware_id)) {
            warnings.push({
              materialId: hw.hardware_id,
              materialType: 'hardware',
              cabinetSku: cabinet.product_sku || undefined,
              cabinetDescription: (cabinet as { description?: string }).description || undefined,
            });
          }
        });
      }

      if (Array.isArray(cabinet.accessories)) {
        (cabinet.accessories as unknown as AccessoryItem[]).forEach((acc) => {
          if (acc.accessory_id && !existingIds.has(acc.accessory_id)) {
            warnings.push({
              materialId: acc.accessory_id,
              materialType: 'accessory',
              cabinetSku: cabinet.product_sku || undefined,
              cabinetDescription: (cabinet as { description?: string }).description || undefined,
            });
          }
        });
      }
    });
  });

  return warnings;
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

/** @deprecated Use validateQuotationImport */
export const validateProjectImport = validateQuotationImport;
