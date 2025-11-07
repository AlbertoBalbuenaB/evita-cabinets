import { supabase } from './supabase';
import type { ProjectArea, AreaCabinet, PriceListItem, Product } from '../types';
import { isAccessoryPanel } from './cabinetFilters';

interface HardwareInfo {
  id: string;
  name: string;
  category: string;
  count: number;
}

export async function generateProjectBrief(projectId: string): Promise<string> {
  try {
    const { data: areas } = await supabase
      .from('project_areas')
      .select(`
        *,
        cabinets:area_cabinets(*)
      `)
      .eq('project_id', projectId);

    if (!areas || areas.length === 0) {
      return 'No data available for this project.';
    }

    const allCabinets: AreaCabinet[] = areas.flatMap((area: any) => area.cabinets || []);

    if (allCabinets.length === 0) {
      return 'No cabinets in this project yet.';
    }

    const materialIds = new Set<string>();
    const edgebandIds = new Set<string>();
    const interiorFinishIds = new Set<string>();
    const hardwareIds = new Set<string>();

    allCabinets.forEach(cabinet => {
      if (cabinet.box_material_id) materialIds.add(cabinet.box_material_id);
      if (cabinet.box_edgeband_id) edgebandIds.add(cabinet.box_edgeband_id);
      if (cabinet.box_interior_finish_id) interiorFinishIds.add(cabinet.box_interior_finish_id);
      if (cabinet.doors_material_id) materialIds.add(cabinet.doors_material_id);
      if (cabinet.doors_edgeband_id) edgebandIds.add(cabinet.doors_edgeband_id);
      if (cabinet.doors_interior_finish_id) interiorFinishIds.add(cabinet.doors_interior_finish_id);

      if (cabinet.hardware && Array.isArray(cabinet.hardware)) {
        cabinet.hardware.forEach((hw: any) => {
          if (hw.hardware_id) hardwareIds.add(hw.hardware_id);
        });
      }
    });

    const allIds = [...materialIds, ...edgebandIds, ...interiorFinishIds, ...hardwareIds];

    const { data: priceListItems } = await supabase
      .from('price_list')
      .select('*')
      .in('id', allIds);

    const priceListMap = new Map<string, PriceListItem>(
      priceListItems?.map(item => [item.id, item]) || []
    );

    const { data: products } = await supabase
      .from('products_catalog')
      .select('*');

    const productMap = new Map<string, Product>(
      products?.map(p => [p.sku, p]) || []
    );

    const sections: string[] = [];

    const boxMaterials = new Set<string>();
    const boxEdgebands = new Set<string>();
    const boxInteriorFinishes = new Set<string>();

    allCabinets.forEach(cabinet => {
      if (!isAccessoryPanel(cabinet.product_sku)) {
        if (cabinet.box_material_id) {
          const item = priceListMap.get(cabinet.box_material_id);
          if (item) boxMaterials.add(item.concept_description);
        }
        if (cabinet.box_edgeband_id) {
          const item = priceListMap.get(cabinet.box_edgeband_id);
          if (item && !item.concept_description.toLowerCase().includes('not apply')) {
            boxEdgebands.add(item.concept_description);
          }
        }
        if (cabinet.box_interior_finish_id) {
          const item = priceListMap.get(cabinet.box_interior_finish_id);
          if (item && !item.concept_description.toLowerCase().includes('not apply')) {
            boxInteriorFinishes.add(item.concept_description);
          }
        }
      }
    });

    if (boxMaterials.size > 0 || boxEdgebands.size > 0 || boxInteriorFinishes.size > 0) {
      const boxParts: string[] = [];
      if (boxMaterials.size > 0) {
        boxParts.push(`Materials: ${Array.from(boxMaterials).join(', ')}`);
      }
      if (boxEdgebands.size > 0) {
        boxParts.push(`Edgebanding: ${Array.from(boxEdgebands).join(', ')}`);
      }
      if (boxInteriorFinishes.size > 0) {
        boxParts.push(`Interior Finish: ${Array.from(boxInteriorFinishes).join(', ')}`);
      }
      sections.push(`BOX CONSTRUCTION:\n${boxParts.join('\n')}`);
    }

    const doorsMaterials = new Set<string>();
    const doorsEdgebands = new Set<string>();
    const doorsInteriorFinishes = new Set<string>();

    allCabinets.forEach(cabinet => {
      if (!isAccessoryPanel(cabinet.product_sku)) {
        if (cabinet.doors_material_id) {
          const item = priceListMap.get(cabinet.doors_material_id);
          if (item) doorsMaterials.add(item.concept_description);
        }
        if (cabinet.doors_edgeband_id) {
          const item = priceListMap.get(cabinet.doors_edgeband_id);
          if (item && !item.concept_description.toLowerCase().includes('not apply')) {
            doorsEdgebands.add(item.concept_description);
          }
        }
        if (cabinet.doors_interior_finish_id) {
          const item = priceListMap.get(cabinet.doors_interior_finish_id);
          if (item && !item.concept_description.toLowerCase().includes('not apply')) {
            doorsInteriorFinishes.add(item.concept_description);
          }
        }
      }
    });

    if (doorsMaterials.size > 0 || doorsEdgebands.size > 0 || doorsInteriorFinishes.size > 0) {
      const finishesParts: string[] = [];
      if (doorsMaterials.size > 0) {
        finishesParts.push(`Doors & Drawer Fronts: ${Array.from(doorsMaterials).join(', ')}`);
      }
      if (doorsEdgebands.size > 0) {
        finishesParts.push(`Edgebanding: ${Array.from(doorsEdgebands).join(', ')}`);
      }
      if (doorsInteriorFinishes.size > 0) {
        finishesParts.push(`Interior Finish: ${Array.from(doorsInteriorFinishes).join(', ')}`);
      }
      sections.push(`FINISHES:\n${finishesParts.join('\n')}`);
    }

    const hardwareByCategory = new Map<string, HardwareInfo[]>();

    allCabinets.forEach(cabinet => {
      if (!isAccessoryPanel(cabinet.product_sku) && cabinet.hardware && Array.isArray(cabinet.hardware)) {
        cabinet.hardware.forEach((hw: any) => {
          if (hw.hardware_id) {
            const item = priceListMap.get(hw.hardware_id);
            if (item) {
              const category = item.category || 'Other';
              if (!hardwareByCategory.has(category)) {
                hardwareByCategory.set(category, []);
              }

              const categoryItems = hardwareByCategory.get(category)!;
              const existingItem = categoryItems.find(h => h.id === item.id);

              if (existingItem) {
                existingItem.count += 1;
              } else {
                categoryItems.push({
                  id: item.id,
                  name: item.concept_description,
                  category: category,
                  count: 1,
                });
              }
            }
          }
        });
      }
    });

    if (hardwareByCategory.size > 0) {
      const hardwareParts: string[] = [];
      const categoryOrder = ['Hinges', 'Drawer Slides', 'Special Hardware', 'Other'];

      categoryOrder.forEach(category => {
        if (hardwareByCategory.has(category)) {
          const items = hardwareByCategory.get(category)!;
          hardwareParts.push(`${category}:`);
          items.forEach(item => {
            hardwareParts.push(`  - ${item.name}`);
          });
        }
      });

      hardwareByCategory.forEach((items, category) => {
        if (!categoryOrder.includes(category)) {
          hardwareParts.push(`${category}:`);
          items.forEach(item => {
            hardwareParts.push(`  - ${item.name}`);
          });
        }
      });

      sections.push(`HARDWARE:\n${hardwareParts.join('\n')}`);
    }

    const cabinetTypes = new Map<string, { description: string; quantity: number }>();

    allCabinets.forEach(cabinet => {
      if (!isAccessoryPanel(cabinet.product_sku)) {
        const sku = cabinet.product_sku;
        const product = productMap.get(sku);
        const description = product?.description || sku;

        if (!cabinetTypes.has(sku)) {
          cabinetTypes.set(sku, { description, quantity: 0 });
        }

        const entry = cabinetTypes.get(sku)!;
        entry.quantity += cabinet.quantity || 1;
      }
    });

    if (cabinetTypes.size > 0) {
      const cabinetParts: string[] = [];
      const sortedCabinets = Array.from(cabinetTypes.entries())
        .sort((a, b) => b[1].quantity - a[1].quantity);

      sortedCabinets.forEach(([sku, data]) => {
        cabinetParts.push(`${sku} - ${data.description}: ${data.quantity} units`);
      });

      sections.push(`CABINET TYPES:\n${cabinetParts.join('\n')}`);
    }

    return sections.join('\n\n');
  } catch (error) {
    console.error('Error generating project brief:', error);
    return 'Error generating project brief. Please try again.';
  }
}

export async function updateProjectBrief(projectId: string): Promise<boolean> {
  try {
    const brief = await generateProjectBrief(projectId);

    const { error } = await supabase
      .from('projects')
      .update({ project_brief: brief })
      .eq('id', projectId);

    if (error) {
      console.error('Error updating project brief:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating project brief:', error);
    return false;
  }
}
