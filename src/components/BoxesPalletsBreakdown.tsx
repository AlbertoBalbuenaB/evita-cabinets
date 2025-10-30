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
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-4">
      {areaName && (
        <h4 className="text-sm font-semibold text-slate-700 mb-3">{areaName}</h4>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-slate-500">Boxes</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{boxes}</div>
        </div>

        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <Truck className="h-4 w-4 text-green-600" />
            <span className="text-xs text-slate-500">Pallets</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{pallets}</div>
        </div>

        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <Grid className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-slate-500">Acc. ft²</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {accessoriesSqFt.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
