import type { AreaCabinet, Product, PriceListItem } from '../types';

export interface CabinetMaterialSummary {
  boxMaterial?: {
    name: string;
    totalSF: number;
    cost: number;
  };
  boxEdgeband?: {
    name: string;
    totalMeters: number;
    cost: number;
  };
  boxInteriorFinish?: {
    name: string;
    totalSF: number;
    cost: number;
  };
  doorsMaterial?: {
    name: string;
    totalSF: number;
    cost: number;
  };
  doorsEdgeband?: {
    name: string;
    totalMeters: number;
    cost: number;
  };
  doorsInteriorFinish?: {
    name: string;
    totalSF: number;
    cost: number;
  };
  hardware: Array<{
    name: string;
    quantity: number;
    cost: number;
  }>;
  accessories: Array<{
    name: string;
    quantity: number;
    cost: number;
  }>;
  laborCost: number;
  totalCost: number;
}

export async function calculateCabinetMaterialSummary(
  cabinet: AreaCabinet,
  product: Product | undefined,
  priceList: PriceListItem[]
): Promise<CabinetMaterialSummary> {
  const priceListMap = new Map(priceList.map(p => [p.id, p]));

  const summary: CabinetMaterialSummary = {
    hardware: [],
    accessories: [],
    laborCost: cabinet.labor_cost,
    totalCost: cabinet.subtotal,
  };

  const qty = cabinet.quantity || 1;

  if (cabinet.box_material_id && product) {
    const material = priceListMap.get(cabinet.box_material_id);
    if (material) {
      summary.boxMaterial = {
        name: material.concept_description,
        totalSF: product.box_sf * qty,
        cost: cabinet.box_material_cost,
      };
    }
  }

  if (cabinet.box_edgeband_id && product) {
    const edgeband = priceListMap.get(cabinet.box_edgeband_id);
    if (edgeband && product.box_edgeband) {
      summary.boxEdgeband = {
        name: edgeband.concept_description,
        totalMeters: product.box_edgeband * qty,
        cost: cabinet.box_edgeband_cost,
      };
    }
  }

  if (cabinet.box_interior_finish_id && cabinet.box_interior_finish_cost > 0 && product) {
    const finish = priceListMap.get(cabinet.box_interior_finish_id);
    if (finish) {
      summary.boxInteriorFinish = {
        name: finish.concept_description,
        totalSF: product.box_sf * qty,
        cost: cabinet.box_interior_finish_cost,
      };
    }
  }

  if (cabinet.doors_material_id && product) {
    const material = priceListMap.get(cabinet.doors_material_id);
    if (material) {
      summary.doorsMaterial = {
        name: material.concept_description,
        totalSF: product.doors_fronts_sf * qty,
        cost: cabinet.doors_material_cost,
      };
    }
  }

  if (cabinet.doors_edgeband_id && product) {
    const edgeband = priceListMap.get(cabinet.doors_edgeband_id);
    if (edgeband && product.doors_fronts_edgeband) {
      summary.doorsEdgeband = {
        name: edgeband.concept_description,
        totalMeters: product.doors_fronts_edgeband * qty,
        cost: cabinet.doors_edgeband_cost,
      };
    }
  }

  if (cabinet.doors_interior_finish_id && cabinet.doors_interior_finish_cost > 0 && product) {
    const finish = priceListMap.get(cabinet.doors_interior_finish_id);
    if (finish) {
      summary.doorsInteriorFinish = {
        name: finish.concept_description,
        totalSF: product.doors_fronts_sf * qty,
        cost: cabinet.doors_interior_finish_cost,
      };
    }
  }

  if (cabinet.hardware && Array.isArray(cabinet.hardware) && cabinet.hardware.length > 0) {
    const totalHardwareCost = cabinet.hardware_cost || 0;
    const totalHardwareItems = (cabinet.hardware as any[]).reduce(
      (sum: number, hw: any) => sum + (hw.quantity_per_cabinet || 0),
      0
    );

    for (const hw of cabinet.hardware as any[]) {
      const hardwareId = hw.hardware_id;
      const quantityPerCabinet = hw.quantity_per_cabinet || 0;

      if (!hardwareId || quantityPerCabinet === 0) continue;

      const hardwareItem = priceListMap.get(hardwareId);
      if (!hardwareItem) continue;

      const name = hardwareItem.concept_description;
      if (name.toLowerCase().includes('not apply')) continue;

      const hwQty = quantityPerCabinet * qty;
      const proportionalCost = totalHardwareItems > 0
        ? (quantityPerCabinet / totalHardwareItems) * totalHardwareCost
        : 0;

      summary.hardware.push({
        name,
        quantity: hwQty,
        cost: proportionalCost,
      });
    }
  }

  if (cabinet.accessories && Array.isArray(cabinet.accessories) && cabinet.accessories.length > 0) {
    const totalAccessoriesCost = cabinet.accessories_cost || 0;
    const totalAccessoryItems = (cabinet.accessories as any[]).reduce(
      (sum: number, acc: any) => sum + (acc.quantity_per_cabinet || 0),
      0
    );

    for (const acc of cabinet.accessories as any[]) {
      const accessoryId = acc.accessory_id;
      const quantityPerCabinet = acc.quantity_per_cabinet || 0;

      if (!accessoryId || quantityPerCabinet === 0) continue;

      const accessoryItem = priceListMap.get(accessoryId);
      if (!accessoryItem) continue;

      const name = accessoryItem.concept_description;
      if (name.toLowerCase().includes('not apply')) continue;

      const accQty = quantityPerCabinet * qty;
      const proportionalCost = totalAccessoryItems > 0
        ? (quantityPerCabinet / totalAccessoryItems) * totalAccessoriesCost
        : 0;

      summary.accessories.push({
        name,
        quantity: accQty,
        cost: proportionalCost,
      });
    }
  }

  return summary;
}
