import { supabase } from './supabase';
import type { ProjectArea, AreaCabinet, AreaItem, AreaCountertop, PriceListItem, Product } from '../types';
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
        cabinets:area_cabinets(*),
        items:area_items(*),
        countertops:area_countertops(*)
      `)
      .eq('project_id', projectId);

    if (!areas || areas.length === 0) {
      return 'No data available for this project.';
    }

    const allCabinets: AreaCabinet[] = areas.flatMap((area: any) => area.cabinets || []);
    const allItems: AreaItem[] = areas.flatMap((area: any) => area.items || []);
    const allCountertops: AreaCountertop[] = areas.flatMap((area: any) => area.countertops || []);

    const materialIds = new Set<string>();
    const edgebandIds = new Set<string>();
    const interiorFinishIds = new Set<string>();
    const hardwareIds = new Set<string>();
    const itemIds = new Set<string>();
    const countertopIds = new Set<string>();

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

    allItems.forEach(item => {
      if (item.price_list_item_id) itemIds.add(item.price_list_item_id);
    });

    allCountertops.forEach(ct => {
      if (ct.price_list_item_id) countertopIds.add(ct.price_list_item_id);
    });

    const allIds = [...materialIds, ...edgebandIds, ...interiorFinishIds, ...hardwareIds, ...itemIds, ...countertopIds];

    const { data: priceListItems } = await supabase
      .from('price_list')
      .select('*')
      .in('id', allIds);

    const priceListMap = new Map<string, PriceListItem>(
      priceListItems?.map(item => [item.id, item]) || []
    );

    const { data: products } = await supabase
      .from('products_catalog')
      .select('*')
      .limit(2000);

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
      const categoryOrder = ['Hinges', 'Drawer Slides', 'Special Hardware'];

      categoryOrder.forEach(category => {
        if (hardwareByCategory.has(category)) {
          const items = hardwareByCategory.get(category)!;
          const itemNames = Array.from(new Set(items.map(item => item.name)));
          hardwareParts.push(`${category}: ${itemNames.join(', ')}`);
        }
      });

      hardwareByCategory.forEach((items, category) => {
        if (!categoryOrder.includes(category)) {
          const itemNames = Array.from(new Set(items.map(item => item.name)));
          hardwareParts.push(`${category}: ${itemNames.join(', ')}`);
        }
      });

      sections.push(`HARDWARE:\n${hardwareParts.join('\n')}`);
    }

    const cabinetAccessories = new Map<string, { name: string; totalQuantity: number }>();

    allCabinets.forEach(cabinet => {
      if (!isAccessoryPanel(cabinet.product_sku) && cabinet.accessories && Array.isArray(cabinet.accessories)) {
        cabinet.accessories.forEach((acc: any) => {
          if (acc.accessory_id) {
            const item = priceListMap.get(acc.accessory_id);
            if (item) {
              const key = acc.accessory_id;
              if (!cabinetAccessories.has(key)) {
                cabinetAccessories.set(key, {
                  name: item.concept_description,
                  totalQuantity: 0,
                });
              }
              const entry = cabinetAccessories.get(key)!;
              entry.totalQuantity += acc.quantity_per_cabinet * (cabinet.quantity || 1);
            }
          }
        });
      }
    });

    if (cabinetAccessories.size > 0) {
      const accessoryParts: string[] = [];
      const sortedAccessories = Array.from(cabinetAccessories.entries())
        .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity);

      sortedAccessories.forEach(([id, data]) => {
        accessoryParts.push(`${data.name}: ${data.totalQuantity} units`);
      });

      sections.push(`CABINET ACCESSORIES:\n${accessoryParts.join('\n')}`);
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

    const accessoryTypes = new Map<string, { description: string; quantity: number }>();

    allCabinets.forEach(cabinet => {
      if (isAccessoryPanel(cabinet.product_sku)) {
        const sku = cabinet.product_sku;
        const product = productMap.get(sku);
        const description = product?.description || sku;

        if (!accessoryTypes.has(sku)) {
          accessoryTypes.set(sku, { description, quantity: 0 });
        }

        const entry = accessoryTypes.get(sku)!;
        entry.quantity += cabinet.quantity || 1;
      }
    });

    if (accessoryTypes.size > 0) {
      const accessoryParts: string[] = [];
      const sortedAccessories = Array.from(accessoryTypes.entries())
        .sort((a, b) => b[1].quantity - a[1].quantity);

      sortedAccessories.forEach(([sku, data]) => {
        accessoryParts.push(`${sku} - ${data.description}: ${data.quantity} units`);
      });

      sections.push(`ACCESSORIES:\n${accessoryParts.join('\n')}`);
    }

    if (allCountertops.length > 0) {
      const countertopSummary = new Map<string, number>();

      allCountertops.forEach(ct => {
        const name = ct.item_name;
        const qty = ct.quantity || 0;
        countertopSummary.set(name, (countertopSummary.get(name) || 0) + qty);
      });

      const countertopParts: string[] = [];
      countertopSummary.forEach((qty, name) => {
        countertopParts.push(`${name}: ${qty.toFixed(2)} units`);
      });

      sections.push(`COUNTERTOPS:\n${countertopParts.join('\n')}`);
    }

    if (allItems.length > 0) {
      const itemSummary = new Map<string, number>();

      allItems.forEach(item => {
        const name = item.item_name;
        const qty = item.quantity || 0;
        itemSummary.set(name, (itemSummary.get(name) || 0) + qty);
      });

      const itemParts: string[] = [];
      itemSummary.forEach((qty, name) => {
        itemParts.push(`${name}: ${qty} units`);
      });

      sections.push(`OTHER:\n${itemParts.join('\n')}`);
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
      .from('quotations')
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
