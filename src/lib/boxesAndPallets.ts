import type { AreaCabinet, Product } from '../types';
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
  const description = product.description;
  const quantity = cabinet.quantity;

  if (isAccessoryPanel(sku)) {
    const boxSF = product.original_box_sf ?? product.box_sf ?? 0;
    const doorsSF = product.original_doors_fronts_sf ?? product.doors_fronts_sf ?? 0;
    const totalSqFt = (boxSF + doorsSF) * quantity;
    return Math.ceil(totalSqFt / 32);
  }

  if (description.includes('Tall Storage') || description.includes('Double Oven')) {
    return quantity * 2;
  }

  return quantity;
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
  products: Product[]
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

  return {
    boxes: totalBoxes,
    pallets: Math.ceil(totalPalletsRaw),
    accessoriesSqFt: totalAccessoriesSqFt,
  };
}
