import { useEffect, useState } from 'react';
import { Package, Layers, Hash, Ruler, Hammer, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/calculations';
import { calculateAreaEdgebandRolls } from '../lib/edgebandRolls';
import { calculateAreaSheetMaterials } from '../lib/sheetMaterials';

interface MaterialData {
  boxMaterialSheets: Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>;
  doorsMaterialSheets: Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>;
  boxInteriorFinishSheets: Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>;
  doorsInteriorFinishSheets: Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>;
  edgebandRolls: Map<string, { rollsNeeded: number; totalMeters: number; cost: number; totalMetersRounded: number }>;
  hardware: Map<string, { quantity: number; cost: number }>;
  accessories: Map<string, { quantity: number; cost: number }>;
  countertops: Map<string, { quantity: number; cost: number }>;
  totalCost: number;
}

interface AreaMaterialBreakdownProps {
  areaId: string;
}

export function AreaMaterialBreakdown({ areaId }: AreaMaterialBreakdownProps) {
  const [data, setData] = useState<MaterialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaterialData();
  }, [areaId]);

  async function loadMaterialData() {
    try {
    const [sheetResult, edgebandResult] = await Promise.all([
      calculateAreaSheetMaterials(areaId),
      calculateAreaEdgebandRolls(areaId),
    ]);

    const boxMaterialSheets = new Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>();
    const doorsMaterialSheets = new Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>();
    const boxInteriorFinishSheets = new Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>();
    const doorsInteriorFinishSheets = new Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>();

    sheetResult.sheetUsages.forEach(usage => {
      if (usage.materialType === 'box') {
        boxMaterialSheets.set(usage.materialName, {
          sheetsNeeded: usage.sheetsNeeded,
          totalSF: usage.totalSF,
          cost: usage.totalCost,
          sfPerSheet: usage.sfPerSheet,
        });
      } else if (usage.materialType === 'doors') {
        doorsMaterialSheets.set(usage.materialName, {
          sheetsNeeded: usage.sheetsNeeded,
          totalSF: usage.totalSF,
          cost: usage.totalCost,
          sfPerSheet: usage.sfPerSheet,
        });
      } else if (usage.materialType === 'box_interior_finish') {
        boxInteriorFinishSheets.set(usage.materialName, {
          sheetsNeeded: usage.sheetsNeeded,
          totalSF: usage.totalSF,
          cost: usage.totalCost,
          sfPerSheet: usage.sfPerSheet,
        });
      } else if (usage.materialType === 'doors_interior_finish') {
        doorsInteriorFinishSheets.set(usage.materialName, {
          sheetsNeeded: usage.sheetsNeeded,
          totalSF: usage.totalSF,
          cost: usage.totalCost,
          sfPerSheet: usage.sfPerSheet,
        });
      }
    });

    const edgebandRolls = new Map<string, { rollsNeeded: number; totalMeters: number; cost: number; totalMetersRounded: number }>();

    edgebandResult.edgebandUsages.forEach(usage => {
      edgebandRolls.set(usage.edgebandName, {
        rollsNeeded: usage.rollsNeeded,
        totalMeters: usage.totalMeters,
        cost: usage.totalCost,
        totalMetersRounded: usage.totalMetersRounded,
      });
    });

    const { hardware, accessories, countertops, totalCost } = await loadHardwareAndCountertops();

    setData({
      boxMaterialSheets,
      doorsMaterialSheets,
      boxInteriorFinishSheets,
      doorsInteriorFinishSheets,
      edgebandRolls,
      hardware,
      accessories,
      countertops,
      totalCost,
    });
    } catch (error) {
      console.error('Error loading material breakdown:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadHardwareAndCountertops() {
    const { data: cabinets } = await supabase
      .from('area_cabinets')
      .select('quantity, hardware, hardware_cost, accessories, accessories_cost, subtotal')
      .eq('area_id', areaId);

    const { data: countertops } = await supabase
      .from('area_countertops')
      .select('item_name, quantity, subtotal')
      .eq('area_id', areaId);

    const { data: priceList } = await supabase
      .from('price_list')
      .select('id, concept_description');

    const priceListMap = new Map(priceList?.map((p: any) => [p.id, p.concept_description]) || []);

    const hardware = new Map<string, { quantity: number; cost: number }>();
    const accessories = new Map<string, { quantity: number; cost: number }>();
    let totalCost = 0;

    (cabinets as any[])?.forEach((cabinet: any) => {
      const qty = cabinet.quantity || 1;

      if (cabinet.hardware && Array.isArray(cabinet.hardware) && cabinet.hardware.length > 0) {
        const totalHardwareCost = cabinet.hardware_cost || 0;
        const totalHardwareItems = cabinet.hardware.reduce((sum: number, hw: any) => sum + (hw.quantity_per_cabinet || 0), 0);

        (cabinet.hardware as any[]).forEach((hw: any) => {
          const hardwareId = hw.hardware_id;
          const quantityPerCabinet = hw.quantity_per_cabinet || 0;

          if (!hardwareId || quantityPerCabinet === 0) return;

          const name = priceListMap.get(hardwareId) || 'Unknown Hardware';

          if (name.toLowerCase().includes('not apply')) return;

          const hwQty = quantityPerCabinet * qty;
          const proportionalCost = totalHardwareItems > 0
            ? (quantityPerCabinet / totalHardwareItems) * totalHardwareCost
            : 0;

          const existing = hardware.get(name) || { quantity: 0, cost: 0 };
          hardware.set(name, {
            quantity: existing.quantity + hwQty,
            cost: existing.cost + proportionalCost,
          });
        });
      }

      if (cabinet.accessories && Array.isArray(cabinet.accessories) && cabinet.accessories.length > 0) {
        const totalAccessoriesCost = cabinet.accessories_cost || 0;
        const totalAccessoryItems = cabinet.accessories.reduce((sum: number, acc: any) => sum + (acc.quantity_per_cabinet || 0), 0);

        (cabinet.accessories as any[]).forEach((acc: any) => {
          const accessoryId = acc.accessory_id;
          const quantityPerCabinet = acc.quantity_per_cabinet || 0;

          if (!accessoryId || quantityPerCabinet === 0) return;

          const name = priceListMap.get(accessoryId) || 'Unknown Accessory';

          if (name.toLowerCase().includes('not apply')) return;

          const accQty = quantityPerCabinet * qty;
          const proportionalCost = totalAccessoryItems > 0
            ? (quantityPerCabinet / totalAccessoryItems) * totalAccessoriesCost
            : 0;

          const existing = accessories.get(name) || { quantity: 0, cost: 0 };
          accessories.set(name, {
            quantity: existing.quantity + accQty,
            cost: existing.cost + proportionalCost,
          });
        });
      }

      totalCost += cabinet.subtotal || 0;
    });

    const countertopsMap = new Map<string, { quantity: number; cost: number }>();

    (countertops as any[])?.forEach((countertop: any) => {
      const name = countertop.item_name || 'Unknown Countertop';
      const qty = countertop.quantity || 0;
      const cost = countertop.subtotal || 0;

      const existing = countertopsMap.get(name) || { quantity: 0, cost: 0 };
      countertopsMap.set(name, {
        quantity: existing.quantity + qty,
        cost: existing.cost + cost,
      });

      totalCost += cost;
    });

    return { hardware, accessories, countertops: countertopsMap, totalCost };
  }

  if (loading) {
    return (
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-center py-4">
          <div className="text-sm text-slate-600">Loading materials...</div>
        </div>
      </div>
    );
  }

  if (!data || (
    data.boxMaterialSheets.size === 0 &&
    data.doorsMaterialSheets.size === 0 &&
    data.boxInteriorFinishSheets.size === 0 &&
    data.doorsInteriorFinishSheets.size === 0 &&
    data.edgebandRolls.size === 0 &&
    data.hardware.size === 0 &&
    data.accessories.size === 0 &&
    data.countertops.size === 0
  )) {
    return (
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
        <div className="text-center py-4 text-sm text-slate-500">
          No material data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-4">
      <div className="flex items-center mb-3">
        <Layers className="h-4 w-4 text-slate-600 mr-2" />
        <h4 className="text-sm font-semibold text-slate-900">Material Breakdown</h4>
        <span className="ml-auto text-xs font-semibold text-green-600">
          Total: {formatCurrency(data.totalCost)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {data.boxMaterialSheets.size > 0 && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center mb-2">
              <Package className="h-3 w-3 text-blue-700 mr-1.5" />
              <h5 className="text-xs font-semibold text-blue-900">Box Materials (Sheets)</h5>
            </div>
            <div className="space-y-1.5">
              {Array.from(data.boxMaterialSheets.entries()).map(([name, matData]) => (
                <div key={name} className="bg-white rounded p-2 text-xs">
                  <div className="font-medium text-slate-900 truncate mb-1">{name}</div>
                  <div className="flex justify-between text-slate-600">
                    <span><Hash className="h-3 w-3 inline mr-1" />{matData.sheetsNeeded} sheets</span>
                    <span><Ruler className="h-3 w-3 inline mr-1" />{matData.totalSF.toFixed(1)} SF</span>
                    <span className="font-semibold text-blue-700">{formatCurrency(matData.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
            {data.boxInteriorFinishSheets.size > 0 && (
              <div className="mt-2 pt-2 border-t border-blue-200">
                <div className="flex items-center gap-1 mb-1.5">
                  <Layers className="h-3 w-3 text-blue-700" />
                  <span className="text-xs font-semibold text-blue-800">Surface Layers</span>
                </div>
                {Array.from(data.boxInteriorFinishSheets.entries()).map(([name, matData]) => (
                  <div key={name} className="bg-blue-100 rounded p-2 text-xs mb-1.5">
                    <div className="font-medium text-slate-900 truncate mb-1 flex items-center gap-1">
                      <Layers className="h-3 w-3 text-blue-600" />
                      {name}
                    </div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span><Hash className="h-3 w-3 inline mr-1" />{matData.sheetsNeeded} sheets</span>
                      <span><Ruler className="h-3 w-3 inline mr-1" />{matData.totalSF.toFixed(1)} SF</span>
                      <span className="font-semibold text-blue-700">{formatCurrency(matData.cost)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-700">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-xs">Same sheets as base</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {data.doorsMaterialSheets.size > 0 && (
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="flex items-center mb-2">
              <Package className="h-3 w-3 text-green-700 mr-1.5" />
              <h5 className="text-xs font-semibold text-green-900">Doors Materials (Sheets)</h5>
            </div>
            <div className="space-y-1.5">
              {Array.from(data.doorsMaterialSheets.entries()).map(([name, matData]) => (
                <div key={name} className="bg-white rounded p-2 text-xs">
                  <div className="font-medium text-slate-900 truncate mb-1">{name}</div>
                  <div className="flex justify-between text-slate-600">
                    <span><Hash className="h-3 w-3 inline mr-1" />{matData.sheetsNeeded} sheets</span>
                    <span><Ruler className="h-3 w-3 inline mr-1" />{matData.totalSF.toFixed(1)} SF</span>
                    <span className="font-semibold text-green-700">{formatCurrency(matData.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
            {data.doorsInteriorFinishSheets.size > 0 && (
              <div className="mt-2 pt-2 border-t border-green-200">
                <div className="flex items-center gap-1 mb-1.5">
                  <Layers className="h-3 w-3 text-green-700" />
                  <span className="text-xs font-semibold text-green-800">Surface Layers</span>
                </div>
                {Array.from(data.doorsInteriorFinishSheets.entries()).map(([name, matData]) => (
                  <div key={name} className="bg-green-100 rounded p-2 text-xs mb-1.5">
                    <div className="font-medium text-slate-900 truncate mb-1 flex items-center gap-1">
                      <Layers className="h-3 w-3 text-green-600" />
                      {name}
                    </div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span><Hash className="h-3 w-3 inline mr-1" />{matData.sheetsNeeded} sheets</span>
                      <span><Ruler className="h-3 w-3 inline mr-1" />{matData.totalSF.toFixed(1)} SF</span>
                      <span className="font-semibold text-green-700">{formatCurrency(matData.cost)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-700">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-xs">Same sheets as base</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {data.edgebandRolls.size > 0 && (
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100 lg:col-span-2">
            <div className="flex items-center mb-2">
              <Ruler className="h-3 w-3 text-amber-700 mr-1.5" />
              <h5 className="text-xs font-semibold text-amber-900">Edgeband (Rolls 150m)</h5>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {Array.from(data.edgebandRolls.entries()).map(([name, rollData]) => (
                <div key={name} className="bg-white rounded p-2 text-xs">
                  <div className="font-medium text-slate-900 truncate mb-1">{name}</div>
                  <div className="flex justify-between text-slate-600">
                    <span><Hash className="h-3 w-3 inline mr-1" />{rollData.rollsNeeded} rolls</span>
                    <span><Ruler className="h-3 w-3 inline mr-1" />{rollData.totalMeters.toFixed(1)}m / {rollData.totalMetersRounded}m</span>
                    <span className="font-semibold text-amber-700">{formatCurrency(rollData.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.hardware.size > 0 && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 lg:col-span-2">
            <div className="flex items-center mb-2">
              <Package className="h-3 w-3 text-slate-700 mr-1.5" />
              <h5 className="text-xs font-semibold text-slate-900">Hardware</h5>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {Array.from(data.hardware.entries()).map(([name, hwData]) => (
                <div key={name} className="bg-white rounded p-2 text-xs">
                  <div className="font-medium text-slate-900 truncate mb-1">{name}</div>
                  <div className="flex justify-between text-slate-600">
                    <span><Hash className="h-3 w-3 inline mr-1" />{hwData.quantity} pcs</span>
                    <span className="font-semibold text-slate-700">{formatCurrency(hwData.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.accessories.size > 0 && (
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 lg:col-span-2">
            <div className="flex items-center mb-2">
              <Package className="h-3 w-3 text-purple-700 mr-1.5" />
              <h5 className="text-xs font-semibold text-purple-900">Accessories</h5>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {Array.from(data.accessories.entries()).map(([name, accData]) => (
                <div key={name} className="bg-white rounded p-2 text-xs">
                  <div className="font-medium text-slate-900 truncate mb-1">{name}</div>
                  <div className="flex justify-between text-slate-600">
                    <span><Hash className="h-3 w-3 inline mr-1" />{accData.quantity} pcs</span>
                    <span className="font-semibold text-purple-700">{formatCurrency(accData.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.countertops.size > 0 && (
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-200 lg:col-span-2">
            <div className="flex items-center mb-2">
              <Hammer className="h-3 w-3 text-orange-700 mr-1.5" />
              <h5 className="text-xs font-semibold text-orange-900">Countertops</h5>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {Array.from(data.countertops.entries()).map(([name, ctData]) => (
                <div key={name} className="bg-white rounded p-2 text-xs">
                  <div className="font-medium text-slate-900 truncate mb-1">{name}</div>
                  <div className="flex justify-between text-slate-600">
                    <span><Hash className="h-3 w-3 inline mr-1" />{ctData.quantity.toFixed(2)} units</span>
                    <span className="font-semibold text-orange-700">{formatCurrency(ctData.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
