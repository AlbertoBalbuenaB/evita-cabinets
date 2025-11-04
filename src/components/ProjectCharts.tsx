import { useMemo } from 'react';
import { BarChart3, PieChart, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../lib/calculations';
import type { ProjectArea, AreaCabinet, AreaItem } from '../types';

interface ProjectChartsProps {
  areas: (ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[] })[];
}

export function ProjectCharts({ areas }: ProjectChartsProps) {
  const analytics = useMemo(() => {
    const calculateTaxesForArea = (cabinets: AreaCabinet[]) => {
      return cabinets.reduce((sum, cabinet) => {
        const boxMaterialTax = cabinet.box_material_cost * 0;
        const boxEdgebandTax = cabinet.box_edgeband_cost * 0;
        const boxInteriorTax = cabinet.box_interior_finish_cost * 0;
        const doorsMaterialTax = cabinet.doors_material_cost * 0;
        const doorsEdgebandTax = cabinet.doors_edgeband_cost * 0;
        const doorsInteriorTax = cabinet.doors_interior_finish_cost * 0;
        const hardwareTax = cabinet.hardware_cost * 0;

        const totalBaseCost =
          cabinet.box_material_cost + cabinet.box_edgeband_cost + cabinet.box_interior_finish_cost +
          cabinet.doors_material_cost + cabinet.doors_edgeband_cost + cabinet.doors_interior_finish_cost +
          cabinet.hardware_cost;

        const taxAmount = cabinet.subtotal - cabinet.labor_cost - totalBaseCost;
        return sum + Math.max(0, taxAmount);
      }, 0);
    };

    const areasCosts = areas.map((area) => {
      const cabinetsTotal = area.cabinets.reduce((sum, c) => sum + c.subtotal, 0);
      const itemsTotal = area.items.reduce((sum, i) => sum + i.subtotal, 0);
      const cabinetsCount = area.cabinets.reduce((sum, c) => sum + c.quantity, 0);
      return {
        name: area.name,
        total: cabinetsTotal + itemsTotal,
        taxes: calculateTaxesForArea(area.cabinets),
        cabinets: cabinetsCount,
        cabinetEntries: area.cabinets.length,
        items: area.items.length,
      };
    });

    const allCabinets = areas.flatMap((a) => a.cabinets);
    const allItems = areas.flatMap((a) => a.items);
    const totalItemsCost = allItems.reduce((sum, i) => sum + i.subtotal, 0);

    const totalProjectTaxes = areasCosts.reduce((sum, area) => sum + area.taxes, 0);

    const materialsCosts = {
      boxMaterial: allCabinets.reduce((sum, c) => sum + c.box_material_cost, 0),
      boxEdgeband: allCabinets.reduce((sum, c) => sum + c.box_edgeband_cost, 0),
      boxInterior: allCabinets.reduce((sum, c) => sum + c.box_interior_finish_cost, 0),
      doorsMaterial: allCabinets.reduce((sum, c) => sum + c.doors_material_cost, 0),
      doorsEdgeband: allCabinets.reduce((sum, c) => sum + c.doors_edgeband_cost, 0),
      doorsInterior: allCabinets.reduce((sum, c) => sum + c.doors_interior_finish_cost, 0),
      hardware: allCabinets.reduce((sum, c) => sum + c.hardware_cost, 0),
      labor: allCabinets.reduce((sum, c) => sum + c.labor_cost, 0),
      taxes: totalProjectTaxes,
    };

    const materialsBreakdown = [
      { name: 'Box Material', cost: materialsCosts.boxMaterial, color: 'bg-blue-500' },
      { name: 'Box Edgeband', cost: materialsCosts.boxEdgeband, color: 'bg-blue-400' },
      { name: 'Box Interior', cost: materialsCosts.boxInterior, color: 'bg-blue-300' },
      { name: 'Doors Material', cost: materialsCosts.doorsMaterial, color: 'bg-green-500' },
      { name: 'Doors Edgeband', cost: materialsCosts.doorsEdgeband, color: 'bg-green-400' },
      { name: 'Doors Interior', cost: materialsCosts.doorsInterior, color: 'bg-green-300' },
      { name: 'Hardware', cost: materialsCosts.hardware, color: 'bg-amber-500' },
      { name: 'Individual Items', cost: totalItemsCost, color: 'bg-amber-600' },
      { name: 'Taxes', cost: materialsCosts.taxes, color: 'bg-red-500' },
      { name: 'Labor', cost: materialsCosts.labor, color: 'bg-slate-500' },
    ].filter((item) => item.cost > 0);

    const totalCost = materialsBreakdown.reduce((sum, item) => sum + item.cost, 0);

    const maxAreaCost = Math.max(...areasCosts.map((a) => a.total), 1);
    const maxMaterialCost = Math.max(...materialsBreakdown.map((m) => m.cost), 1);

    const totalCabinets = allCabinets.reduce((sum, c) => sum + c.quantity, 0);
    const totalCabinetEntries = allCabinets.length;
    const totalSKUs = new Set(allCabinets.map((c) => c.product_sku)).size;
    const cabinetsCost = allCabinets.reduce((sum, c) => sum + c.subtotal, 0);
    const avgCostPerCabinet = totalCabinets > 0 ? cabinetsCost / totalCabinets : 0;

    return {
      areasCosts,
      materialsBreakdown,
      maxAreaCost,
      maxMaterialCost,
      totalCost,
      totalCabinets,
      totalCabinetEntries,
      totalSKUs,
      totalProjectTaxes,
      cabinetsCost,
      avgCostPerCabinet,
      totalItems: allItems.length,
      itemsCost: totalItemsCost,
    };
  }, [areas]);

  if (areas.length === 0) {
    return null;
  }

  return (
    <div className="no-print space-y-6">
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Project Analytics</h3>
          <TrendingUp className="h-5 w-5 text-slate-400" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Total Cabinets</div>
            <div className="text-3xl font-bold text-blue-600">{analytics.totalCabinets}</div>
            <div className="text-xs text-slate-500 mt-1">{analytics.totalCabinetEntries} entries</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Avg Cost/Cabinet</div>
            <div className="text-3xl font-bold text-purple-600">{formatCurrency(analytics.avgCostPerCabinet)}</div>
            <div className="text-xs text-slate-500 mt-1">Per unit</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Cabinets Value</div>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(analytics.cabinetsCost)}</div>
            <div className="text-xs text-slate-500 mt-1">{analytics.totalSKUs} unique SKUs</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Additional Items</div>
            <div className="text-3xl font-bold text-amber-600">{analytics.totalItems}</div>
            <div className="text-xs text-slate-500 mt-1">{formatCurrency(analytics.itemsCost)} value</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Project Summary</h3>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-slate-600">Total Areas</div>
              <div className="text-3xl font-bold text-slate-900">{areas.length}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Total Project Value</div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(analytics.totalCost)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Total Taxes</div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(analytics.totalProjectTaxes)}</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Cost by Area</h3>
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>
          <div className="space-y-3">
            {analytics.areasCosts.map((area) => {
              const percentage = (area.total / analytics.maxAreaCost) * 100;
              const costPercentage = analytics.totalCost > 0 ? (area.total / analytics.totalCost) * 100 : 0;

              return (
                <div key={area.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-700">{area.name}</span>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-slate-500">
                        {area.cabinets} cabinets
                        {area.items > 0 && ` • ${area.items} items`}
                      </span>
                      <span className="text-xs text-red-600">Tax: {formatCurrency(area.taxes)}</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(area.total)}
                      </span>
                      <span className="text-xs text-slate-500 w-12 text-right">
                        {costPercentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="relative h-8 bg-slate-100 rounded-lg overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-lg transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Cost Distribution by Material</h3>
          <PieChart className="h-5 w-5 text-slate-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            {analytics.materialsBreakdown.map((material) => {
              const percentage = (material.cost / analytics.maxMaterialCost) * 100;
              const totalPercentage = (material.cost / analytics.totalCost) * 100;

              return (
                <div key={material.name}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 ${material.color} rounded mr-2`} />
                      <span className="text-sm font-medium text-slate-700">{material.name}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(material.cost)}
                      </span>
                      <span className="text-xs text-slate-500 w-12 text-right">
                        {totalPercentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="relative h-6 bg-slate-100 rounded overflow-hidden">
                    <div
                      className={`absolute top-0 left-0 h-full ${material.color} transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center">
            <div className="relative w-64 h-64">
              <svg viewBox="0 0 200 200" className="transform -rotate-90">
                {analytics.materialsBreakdown.reduce(
                  (acc, material, index) => {
                    const percentage = (material.cost / analytics.totalCost) * 100;
                    const circumference = 2 * Math.PI * 80;
                    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = -acc.offset;

                    acc.offset += (percentage / 100) * circumference;

                    const colorMap: Record<string, string> = {
                      'bg-blue-500': '#3b82f6',
                      'bg-blue-400': '#60a5fa',
                      'bg-blue-300': '#93c5fd',
                      'bg-green-500': '#22c55e',
                      'bg-green-400': '#4ade80',
                      'bg-green-300': '#86efac',
                      'bg-amber-500': '#f59e0b',
                      'bg-amber-600': '#d97706',
                      'bg-red-500': '#ef4444',
                      'bg-slate-500': '#64748b',
                    };

                    acc.elements.push(
                      <circle
                        key={index}
                        cx="100"
                        cy="100"
                        r="80"
                        fill="none"
                        stroke={colorMap[material.color] || '#3b82f6'}
                        strokeWidth="40"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500"
                      />
                    );

                    return acc;
                  },
                  { offset: 0, elements: [] as JSX.Element[] }
                ).elements}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-sm text-slate-600">Total Cost</div>
                <div className="text-xl font-bold text-slate-900">
                  {formatCurrency(analytics.totalCost)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
        <h3 className="text-lg font-semibold mb-4">Quick Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-blue-100">Most Expensive Area</div>
            <div className="text-xl font-bold">
              {analytics.areasCosts.length > 0
                ? analytics.areasCosts.reduce((max, area) => (area.total > max.total ? area : max))
                    .name
                : 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-sm text-blue-100">Highest Cost Material</div>
            <div className="text-xl font-bold">
              {analytics.materialsBreakdown.length > 0
                ? analytics.materialsBreakdown.reduce((max, mat) => (mat.cost > max.cost ? mat : max))
                    .name
                : 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-sm text-blue-100">Total Taxes</div>
            <div className="text-xl font-bold">
              {formatCurrency(analytics.totalProjectTaxes)}
            </div>
          </div>
          <div>
            <div className="text-sm text-blue-100">Avg Cost per Cabinet</div>
            <div className="text-xl font-bold">
              {formatCurrency(analytics.avgCostPerCabinet)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
