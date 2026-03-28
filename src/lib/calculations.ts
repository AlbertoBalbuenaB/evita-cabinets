import type { Product, PriceListItem, HardwareItem } from '../types';

export function parseDimensions(dimensions: string | null | undefined): number {
  if (!dimensions) return 32;

  let match = dimensions.match(/(\d+\.?\d*)\s*ft\s*x\s*(\d+\.?\d*)\s*ft/i);
  if (match) {
    return parseFloat(match[1]) * parseFloat(match[2]);
  }

  match = dimensions.match(/(\d+\.?\d*)\s*m\s*x\s*(\d+\.?\d*)\s*m/i);
  if (match) {
    const sqMeters = parseFloat(match[1]) * parseFloat(match[2]);
    return sqMeters * 10.764;
  }

  return 32;
}

export function calculateBackPanelSF(
  widthInches: number,
  heightInches: number
): number {
  return (widthInches * heightInches) / 144;
}

export function calculateBackPanelMaterialCost(
  backPanelSF: number,
  material: PriceListItem
): number {
  const sfPerSheet = material.sf_per_sheet || parseDimensions(material.dimensions);
  const price = material.price_with_tax || material.price;
  const pricePerSF = price / sfPerSheet;
  return backPanelSF * pricePerSF;
}

export function calculateBoxMaterialCost(
  product: Product,
  material: PriceListItem,
  quantity: number,
  backPanelSF: number = 0
): number {
  const sfPerSheet = material.sf_per_sheet || parseDimensions(material.dimensions);
  const price = material.price_with_tax || material.price;
  const pricePerSF = price / sfPerSheet;
  const totalSF = Math.max(0, (product.box_sf * quantity) - backPanelSF);
  const cost = totalSF * pricePerSF;
  return cost;
}

export function calculateEdgebandCost(
  metersNeeded: number,
  edgeband: PriceListItem
): number {
  const price = edgeband.price_with_tax || edgeband.price;
  return metersNeeded * price;
}

export function calculateBoxEdgebandCost(
  product: Product,
  edgeband: PriceListItem,
  quantity: number
): number {
  const totalMeters = product.total_edgeband * quantity;
  return calculateEdgebandCost(totalMeters, edgeband);
}

export function calculateDoorsMaterialCost(
  product: Product,
  material: PriceListItem,
  quantity: number
): number {
  const sfPerSheet = material.sf_per_sheet || parseDimensions(material.dimensions);
  const price = material.price_with_tax || material.price;
  const pricePerSF = price / sfPerSheet;
  const totalSF = product.doors_fronts_sf * quantity;
  const cost = totalSF * pricePerSF;
  return cost;
}

export function calculateDoorsEdgebandCost(
  product: Product,
  edgeband: PriceListItem,
  quantity: number
): number {
  const totalMeters = (product.doors_fronts_edgeband || 0) * quantity;
  return calculateEdgebandCost(totalMeters, edgeband);
}

export function calculateDoorProfileCost(
  product: Product,
  doorProfile: PriceListItem,
  quantity: number
): number {
  const totalMeters = (product.doors_fronts_edgeband || 0) * quantity;
  const price = doorProfile.price_with_tax || doorProfile.price;
  return totalMeters * price;
}

export function calculateInteriorFinishCost(
  product: Product,
  finish: PriceListItem,
  quantity: number,
  isForBox: boolean,
  backPanelSF: number = 0
): number {
  const sfPerSheet = finish.sf_per_sheet || parseDimensions(finish.dimensions);
  const price = finish.price_with_tax || finish.price;
  const pricePerSF = price / sfPerSheet;
  const baseSF = (isForBox ? product.box_sf : product.doors_fronts_sf) * quantity;
  const totalSF = Math.max(0, baseSF - (isForBox ? backPanelSF : 0));
  return totalSF * pricePerSF;
}

export function calculateHardwareCost(
  hardware: HardwareItem[],
  cabinetQuantity: number,
  priceList: PriceListItem[]
): number {
  return hardware.reduce((total, item) => {
    const hardwareItem = priceList.find(p => p.id === item.hardware_id);
    if (!hardwareItem) return total;

    const price = hardwareItem.price_with_tax || hardwareItem.price;
    const totalPieces = item.quantity_per_cabinet * cabinetQuantity;
    return total + (totalPieces * price);
  }, 0);
}

export function calculateAccessoriesCost(
  accessories: Array<{ accessory_id: string; quantity_per_cabinet: number }>,
  cabinetQuantity: number,
  priceList: Array<{ id: string; price: number; price_with_tax?: number | null }>
): number {
  if (!Array.isArray(accessories) || accessories.length === 0) {
    return 0;
  }

  return accessories.reduce((total, accessory) => {
    const priceItem = priceList.find((p) => p.id === accessory.accessory_id);
    if (!priceItem) {
      console.warn(`Accessory with ID ${accessory.accessory_id} not found in price list`);
      return total;
    }
    const price = priceItem.price_with_tax || priceItem.price;
    return total + price * accessory.quantity_per_cabinet * cabinetQuantity;
  }, 0);
}

export function calculateLaborCost(
  product: Product,
  quantity: number,
  laborCostNoDrawers: number = 400,
  laborCostWithDrawers: number = 600,
  laborCostAccessories: number = 100
): number {
  if (product.custom_labor_cost !== null && product.custom_labor_cost !== undefined) {
    return product.custom_labor_cost * quantity;
  }

  if (product.sku.startsWith('460')) {
    return laborCostAccessories * quantity;
  }

  const costPerCabinet = product.has_drawers ? laborCostWithDrawers : laborCostNoDrawers;
  return costPerCabinet * quantity;
}

export function formatCurrency(amount: number, currency: 'MXN' | 'USD' = 'MXN'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}
