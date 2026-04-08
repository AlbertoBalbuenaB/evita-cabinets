import { supabase } from './supabase';
import type {
  CabinetTemplate,
  CabinetTemplateInsert,
  TemplateUsageLogInsert,
  TemplateAnalytics,
  AreaCabinet,
  PriceListItem,
  Product,
  HardwareItem,
  AccessoryItem,
} from '../types';

export async function getAllTemplates(): Promise<CabinetTemplate[]> {
  const { data, error } = await supabase
    .from('cabinet_templates')
    .select('*')
    .order('usage_count', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as CabinetTemplate[];
}

export async function getTemplatesByCategory(category: string): Promise<CabinetTemplate[]> {
  const { data, error } = await supabase
    .from('cabinet_templates')
    .select('*')
    .eq('category', category)
    .order('usage_count', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as CabinetTemplate[];
}

export async function searchTemplates(searchTerm: string): Promise<CabinetTemplate[]> {
  const { data, error } = await supabase
    .from('cabinet_templates')
    .select('*')
    .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,product_sku.ilike.%${searchTerm}%`)
    .order('usage_count', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as CabinetTemplate[];
}

export async function getTemplateById(id: string): Promise<CabinetTemplate | null> {
  const { data, error } = await supabase
    .from('cabinet_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as CabinetTemplate;
}

export async function createTemplateFromCabinet(
  cabinet: AreaCabinet,
  product: Product,
  priceList: PriceListItem[],
  templateName: string,
  templateDescription: string | null,
  templateCategory: string
): Promise<CabinetTemplate> {
  const boxMaterial = cabinet.box_material_id
    ? priceList.find(p => p.id === cabinet.box_material_id)
    : null;
  const boxEdgeband = cabinet.box_edgeband_id
    ? priceList.find(p => p.id === cabinet.box_edgeband_id)
    : null;
  const boxInteriorFinish = cabinet.box_interior_finish_id
    ? priceList.find(p => p.id === cabinet.box_interior_finish_id)
    : null;
  const doorsMaterial = cabinet.doors_material_id
    ? priceList.find(p => p.id === cabinet.doors_material_id)
    : null;
  const doorsEdgeband = cabinet.doors_edgeband_id
    ? priceList.find(p => p.id === cabinet.doors_edgeband_id)
    : null;
  const doorsInteriorFinish = cabinet.doors_interior_finish_id
    ? priceList.find(p => p.id === cabinet.doors_interior_finish_id)
    : null;
  const doorProfile = cabinet.door_profile_id
    ? priceList.find(p => p.id === cabinet.door_profile_id)
    : null;

  const templateData: CabinetTemplateInsert = {
    name: templateName,
    description: templateDescription,
    category: templateCategory,
    product_sku: cabinet.product_sku,
    product_description: product.description,
    box_material_id: cabinet.box_material_id,
    box_material_name: boxMaterial?.concept_description || null,
    box_edgeband_id: cabinet.box_edgeband_id,
    box_edgeband_name: boxEdgeband?.concept_description || null,
    box_interior_finish_id: cabinet.box_interior_finish_id,
    box_interior_finish_name: boxInteriorFinish?.concept_description || null,
    use_box_interior_finish: !!cabinet.box_interior_finish_id,
    doors_material_id: cabinet.doors_material_id,
    doors_material_name: doorsMaterial?.concept_description || null,
    doors_edgeband_id: cabinet.doors_edgeband_id,
    doors_edgeband_name: doorsEdgeband?.concept_description || null,
    doors_interior_finish_id: cabinet.doors_interior_finish_id,
    doors_interior_finish_name: doorsInteriorFinish?.concept_description || null,
    use_doors_interior_finish: !!cabinet.doors_interior_finish_id,
    hardware: (Array.isArray(cabinet.hardware) ? cabinet.hardware : []) as unknown as HardwareItem[],
    accessories: (Array.isArray(cabinet.accessories) ? cabinet.accessories : []) as unknown as AccessoryItem[],
    is_rta: cabinet.is_rta,
    original_box_material_price: boxMaterial?.price || null,
    original_box_edgeband_price: boxEdgeband?.price || null,
    original_box_interior_finish_price: boxInteriorFinish?.price || null,
    original_doors_material_price: doorsMaterial?.price || null,
    original_doors_edgeband_price: doorsEdgeband?.price || null,
    original_doors_interior_finish_price: doorsInteriorFinish?.price || null,
    door_profile_id: cabinet.door_profile_id || null,
    door_profile_name: doorProfile?.concept_description || null,
    use_back_panel_material: cabinet.use_back_panel_material ?? false,
  };

  const { data, error } = await supabase
    .from('cabinet_templates')
    .insert([templateData as any])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`A template named "${templateName}" already exists. Please choose a different name.`);
    }
    throw error;
  }

  return data as unknown as CabinetTemplate;
}

export async function updateTemplate(
  id: string,
  updates: Partial<CabinetTemplateInsert>
): Promise<CabinetTemplate> {
  const { data, error } = await supabase
    .from('cabinet_templates')
    .update(updates as any)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`A template with that name already exists. Please choose a different name.`);
    }
    throw error;
  }

  return data as unknown as CabinetTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('cabinet_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function duplicateTemplate(
  id: string,
  newName: string
): Promise<CabinetTemplate> {
  const original = await getTemplateById(id);
  if (!original) throw new Error('Template not found');

  const { id: _, usage_count, last_used_at, created_at, updated_at, ...templateData } = original;

  const duplicateData: CabinetTemplateInsert = {
    ...templateData,
    name: newName,
  };

  const { data, error } = await supabase
    .from('cabinet_templates')
    .insert([duplicateData as any])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`A template named "${newName}" already exists. Please choose a different name.`);
    }
    throw error;
  }

  return data as unknown as CabinetTemplate;
}

export async function logTemplateUsage(
  templateId: string,
  projectId: string,
  areaId: string,
  cabinetId: string | null,
  quantityUsed: number
): Promise<void> {
  const usageData: TemplateUsageLogInsert = {
    template_id: templateId,
    project_id: projectId,
    area_id: areaId,
    cabinet_id: cabinetId,
    quantity_used: quantityUsed,
  };

  const { error } = await supabase
    .from('template_usage_log')
    .insert([usageData]);

  if (error) throw error;
}

export async function validateTemplateAvailability(
  template: CabinetTemplate,
  priceList: PriceListItem[],
  products: Product[]
): Promise<{
  isValid: boolean;
  missingMaterials: string[];
  inactiveProduct: boolean;
}> {
  const missingMaterials: string[] = [];
  let inactiveProduct = false;

  if (template.product_sku) {
    const product = products.find(p => p.sku === template.product_sku);
    if (!product || !product.is_active) {
      inactiveProduct = true;
    }
  }

  const materialChecks = [
    { id: template.box_material_id, name: template.box_material_name, label: 'Box Material' },
    { id: template.box_edgeband_id, name: template.box_edgeband_name, label: 'Box Edgeband' },
    { id: template.box_interior_finish_id, name: template.box_interior_finish_name, label: 'Box Interior Finish' },
    { id: template.doors_material_id, name: template.doors_material_name, label: 'Doors Material' },
    { id: template.doors_edgeband_id, name: template.doors_edgeband_name, label: 'Doors Edgeband' },
    { id: template.doors_interior_finish_id, name: template.doors_interior_finish_name, label: 'Doors Interior Finish' },
  ];

  for (const check of materialChecks) {
    if (check.id) {
      const material = priceList.find(p => p.id === check.id);
      if (!material || !material.is_active) {
        missingMaterials.push(`${check.label}: ${check.name || 'Unknown'}`);
      }
    }
  }

  if (Array.isArray(template.hardware)) {
    for (const hw of template.hardware) {
      const hardware = priceList.find(p => p.id === hw.hardware_id);
      if (!hardware || !hardware.is_active) {
        missingMaterials.push(`Hardware item (ID: ${hw.hardware_id})`);
      }
    }
  }

  if (Array.isArray(template.accessories)) {
    for (const acc of template.accessories) {
      const accessory = priceList.find(p => p.id === acc.accessory_id);
      if (!accessory || !accessory.is_active) {
        missingMaterials.push(`Accessory item (ID: ${acc.accessory_id})`);
      }
    }
  }

  const isValid = missingMaterials.length === 0 && !inactiveProduct;

  return { isValid, missingMaterials, inactiveProduct };
}

export async function getTemplateAnalytics(): Promise<TemplateAnalytics> {
  const [templatesResult, mostUsedResult, categoryResult, timelineResult] = await Promise.all([
    supabase.from('cabinet_templates').select('id, usage_count'),
    supabase.rpc('get_most_used_templates', { limit_count: 10 }),
    supabase.rpc('get_template_usage_by_category'),
    supabase.rpc('get_template_usage_timeline', { days_back: 30 }),
  ]);

  const templates = templatesResult.data || [];
  const totalTemplates = templates.length;
  const totalUses = templates.reduce((sum, t) => sum + (t.usage_count || 0), 0);
  const averageUsesPerTemplate = totalTemplates > 0 ? totalUses / totalTemplates : 0;

  return {
    totalTemplates,
    totalUses,
    averageUsesPerTemplate: Math.round(averageUsesPerTemplate * 10) / 10,
    mostUsedTemplates: mostUsedResult.data || [],
    usageByCategory: categoryResult.data || [],
    usageTimeline: timelineResult.data || [],
  };
}

export async function getRecentlyUsedTemplates(limit: number = 5): Promise<CabinetTemplate[]> {
  const { data, error } = await supabase
    .from('cabinet_templates')
    .select('*')
    .not('last_used_at', 'is', null)
    .order('last_used_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as unknown as CabinetTemplate[];
}

export function generateUniqueTemplateName(baseName: string, existingNames: string[]): string {
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  let counter = 2;
  let newName = `${baseName} (${counter})`;

  while (existingNames.includes(newName)) {
    counter++;
    newName = `${baseName} (${counter})`;
  }

  return newName;
}
