import { Package, Truck, Grid } from 'lucide-react';
import { calculateAreaBoxesAndPallets } from '../lib/boxesAndPallets';
import type { AreaCabinet, Product } from '../types';

interface BoxesPalletsBreakdownProps {
  cabinets: AreaCabinet[];
  products: Product[];
  areaName?: string;
}

export function BoxesPalletsBreakdown({
  cabinets,
  products,
  areaName,
}: BoxesPalletsBreakdownProps) {
  const { boxes, pallets, accessoriesSqFt } = calculateAreaBoxesAndPallets(
    cabinets,
    products
  );

  return (
    <div className="bg-surf-muted rounded-lg border border-border-soft p-4">
      {areaName && (
        <h4 className="text-sm font-semibold text-fg-700 mb-3">{areaName}</h4>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surf-card rounded-lg p-3 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <Package className="h-4 w-4 text-accent-text" />
            <span className="text-xs text-fg-500">Boxes</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-fg-900 break-all">{boxes}</div>
        </div>

        <div className="bg-surf-card rounded-lg p-3 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <Truck className="h-4 w-4 text-status-emerald-fg" />
            <span className="text-xs text-fg-500">Pallets</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-fg-900 break-all">{pallets}</div>
        </div>

        <div className="bg-surf-card rounded-lg p-3 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <Grid className="h-4 w-4 text-accent-text" />
            <span className="text-xs text-fg-500">Acc. ft²</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-fg-900 break-all">
            {accessoriesSqFt.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
