import type { AreaCabinet, AreaClosetItem, Product } from '../types';
import { isAccessoryPanel } from './cabinetFilters';

export interface BoxesPalletsCalculation {
  boxes: number;
  pallets: number;
  accessoriesSqFt: number;
}

export function calculateBoxesForCabinet(
  cabinet: AreaCabinet,
  product: Product | undefined
): number {
  if (!product) return 0;

  const sku = product.sku;
  const quantity = cabinet.quantity;

  if (isAccessoryPanel(sku)) {
    return 0;
  }

  return (product.boxes_per_unit ?? 1) * quantity;
}

export function calculatePalletsForCabinet(
  cabinet: AreaCabinet,
  boxes: number
): number {
  const divisor = cabinet.is_rta ? 19 : 5.8;
  return boxes / divisor;
}

export function calculateAccessoriesSqFt(
  cabinet: AreaCabinet,
  product: Product | undefined
): number {
  if (!product) return 0;

  const sku = product.sku;

  if (isAccessoryPanel(sku)) {
    const boxSF = product.original_box_sf ?? product.box_sf ?? 0;
    const doorsSF = product.original_doors_fronts_sf ?? product.doors_fronts_sf ?? 0;
    return (boxSF + doorsSF) * cabinet.quantity;
  }

  return 0;
}

export function calculateAreaBoxesAndPallets(
  cabinets: AreaCabinet[],
  products: Product[],
  closetItems: AreaClosetItem[] = []
): BoxesPalletsCalculation {
  let totalBoxes = 0;
  let totalPalletsRaw = 0;
  let totalAccessoriesSqFt = 0;

  cabinets.forEach((cabinet) => {
    const product = products.find((p) => p.sku === cabinet.product_sku);

    const boxes = calculateBoxesForCabinet(cabinet, product);
    totalBoxes += boxes;

    const pallets = calculatePalletsForCabinet(cabinet, boxes);
    totalPalletsRaw += pallets;

    const accessoriesSqFt = calculateAccessoriesSqFt(cabinet, product);
    totalAccessoriesSqFt += accessoriesSqFt;
  });

  closetItems.forEach((ci) => {
    totalBoxes += ci.boxes_count;
    totalPalletsRaw += ci.boxes_count / 19;
  });

  return {
    boxes: totalBoxes,
    pallets: Math.ceil(totalPalletsRaw),
    accessoriesSqFt: totalAccessoriesSqFt,
  };
}
