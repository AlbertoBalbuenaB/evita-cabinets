import { useEffect, useState } from 'react';
import { Package, Layers, Hash, Ruler, Hammer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/calculations';
import { calculateAreaEdgebandRolls } from '../lib/edgebandRolls';
import { calculateAreaSheetMaterials } from '../lib/sheetMaterials';

interface MaterialData {
  boxMaterialSheets: Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>;
  doorsMaterialSheets: Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>;
  boxEdgebandRolls: Map<string, { rollsNeeded: number; totalMeters: number; cost: number; totalMetersRounded: number }>;
  doorsEdgebandRolls: Map<string, { rollsNeeded: number; totalMeters: number; cost: number; totalMetersRounded: number }>;
  hardware: Map<string, { quantity: number; cost: number }>;
  countertops: Map<string, { quantity: number; cost: number }>;
  totalCost: number;
}

interface AreaMaterialBreakdownProps {
  areaId: string;
  isVersion?: boolean;
}

export function AreaMaterialBreakdown({ areaId, isVersion = false }: AreaMaterialBreakdownProps) {
  const [data, setData] = useState<MaterialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaterialData();
  }, [areaId, isVersion]);

  async function loadMaterialData() {
    try {
      if (!isVersion) {
        await loadNonVersionMaterialData();
      } else {
        await loadVersionMaterialData();
      }
    } catch (error) {
      console.error('Error loading material breakdown:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadNonVersionMaterialData() {
    const [sheetResult, edgebandResult] = await Promise.all([
      calculateAreaSheetMaterials(areaId),
      calculateAreaEdgebandRolls(areaId),
    ]);

    const boxMaterialSheets = new Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>();
    const doorsMaterialSheets = new Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>();

    sheetResult.sheetUsages.forEach(usage => {
      const target = usage.materialType === 'box' ? boxMaterialSheets : doorsMaterialSheets;
      target.set(usage.materialName, {
        sheetsNeeded: usage.sheetsNeeded,
        totalSF: usage.totalSF,
        cost: usage.totalCost,
        sfPerSheet: usage.sfPerSheet,
      });
    });

    const boxEdgebandRolls = new Map<string, { rollsNeeded: number; totalMeters: number; cost: number; totalMetersRounded: number }>();
    const doorsEdgebandRolls = new Map<string, { rollsNeeded: number; totalMeters: number; cost: number; totalMetersRounded: number }>();

    const { data: priceList } = await supabase
      .from('price_list')
      .select('id, concept_description');

    const priceListMap = new Map(priceList?.map(p => [p.id, p.concept_description]) || []);

    const { data: cabinets } = await supabase
      .from('area_cabinets')
      .select('box_edgeband_id, doors_edgeband_id')
      .eq('area_id', areaId);

    const boxEdgebandIds = new Set(cabinets?.map(c => c.box_edgeband_id).filter(Boolean) || []);
    const doorsEdgebandIds = new Set(cabinets?.map(c => c.doors_edgeband_id).filter(Boolean) || []);

    edgebandResult.edgebandUsages.forEach(usage => {
      const data = {
        rollsNeeded: usage.rollsNeeded,
        totalMeters: usage.totalMeters,
        cost: usage.totalCost,
        totalMetersRounded: usage.totalMetersRounded,
      };

      if (boxEdgebandIds.has(usage.edgebandId)) {
        boxEdgebandRolls.set(usage.edgebandName, data);
      }
      if (doorsEdgebandIds.has(usage.edgebandId)) {
        doorsEdgebandRolls.set(usage.edgebandName, data);
      }
    });

    const { hardware, countertops, totalCost } = await loadHardwareAndCountertops('area_cabinets', 'area_countertops');

    setData({
      boxMaterialSheets,
      doorsMaterialSheets,
      boxEdgebandRolls,
      doorsEdgebandRolls,
      hardware,
      countertops,
      totalCost,
    });
  }

  async function loadVersionMaterialData() {
    const { data: cabinets } = await supabase
      .from('version_area_cabinets')
      .select(`
        quantity,
        box_material_id,
        doors_material_id,
        box_edgeband_id,
        doors_edgeband_id,
        box_material_cost,
        doors_material_cost,
        box_edgeband_cost,
        doors_edgeband_cost,
        hardware_cost,
        hardware,
        subtotal,
        box_sf,
        doors_fronts_sf,
        box_edgeband,
        doors_fronts_edgeband
      `)
      .eq('area_id', areaId);

    const { data: priceList } = await supabase
      .from('price_list')
      .select('id, concept_description, sf_per_sheet, dimensions, type');

    const priceListMap = new Map(priceList?.map(p => [p.id, p]) || []);

    const boxMaterialSheets = new Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>();
    const doorsMaterialSheets = new Map<string, { sheetsNeeded: number; totalSF: number; cost: number; sfPerSheet: number }>();
    const boxEdgebandRolls = new Map<string, { rollsNeeded: number; totalMeters: number; cost: number; totalMetersRounded: number }>();
    const doorsEdgebandRolls = new Map<string, { rollsNeeded: number; totalMeters: number; cost: number; totalMetersRounded: number }>();

    const boxMaterialsAgg = new Map<string, { totalSF: number; totalCost: number; sfPerSheet: number }>();
    const doorsMaterialsAgg = new Map<string, { totalSF: number; totalCost: number; sfPerSheet: number }>();
    const boxEdgebandAgg = new Map<string, { totalMeters: number; totalCost: number }>();
    const doorsEdgebandAgg = new Map<string, { totalMeters: number; totalCost: number }>();

    cabinets?.forEach(cabinet => {
      const qty = cabinet.quantity || 1;

      if (cabinet.box_material_id) {
        const material = priceListMap.get(cabinet.box_material_id);
        if (material) {
          const name = material.concept_description;
          const sf = (cabinet.box_sf || 0) * qty;
          const sfPerSheet = material.sf_per_sheet || 32;
          const existing = boxMaterialsAgg.get(name) || { totalSF: 0, totalCost: 0, sfPerSheet };
          boxMaterialsAgg.set(name, {
            totalSF: existing.totalSF + sf,
            totalCost: existing.totalCost + (cabinet.box_material_cost || 0),
            sfPerSheet,
          });
        }
      }

      if (cabinet.doors_material_id) {
        const material = priceListMap.get(cabinet.doors_material_id);
        if (material) {
          const name = material.concept_description;
          const sf = (cabinet.doors_fronts_sf || 0) * qty;
          const sfPerSheet = material.sf_per_sheet || 32;
          const existing = doorsMaterialsAgg.get(name) || { totalSF: 0, totalCost: 0, sfPerSheet };
          doorsMaterialsAgg.set(name, {
            totalSF: existing.totalSF + sf,
            totalCost: existing.totalCost + (cabinet.doors_material_cost || 0),
            sfPerSheet,
          });
        }
      }

      if (cabinet.box_edgeband_id) {
        const material = priceListMap.get(cabinet.box_edgeband_id);
        if (material) {
          const name = material.concept_description;
          const meters = (cabinet.box_edgeband || 0) * qty;
          const existing = boxEdgebandAgg.get(name) || { totalMeters: 0, totalCost: 0 };
          boxEdgebandAgg.set(name, {
            totalMeters: existing.totalMeters + meters,
            totalCost: existing.totalCost + (cabinet.box_edgeband_cost || 0),
          });
        }
      }

      if (cabinet.doors_edgeband_id) {
        const material = priceListMap.get(cabinet.doors_edgeband_id);
        if (material) {
          const name = material.concept_description;
          const meters = (cabinet.doors_fronts_edgeband || 0) * qty;
          const existing = doorsEdgebandAgg.get(name) || { totalMeters: 0, totalCost: 0 };
          doorsEdgebandAgg.set(name, {
            totalMeters: existing.totalMeters + meters,
            totalCost: existing.totalCost + (cabinet.doors_edgeband_cost || 0),
          });
        }
      }
    });

    boxMaterialsAgg.forEach((agg, name) => {
      const sheetsNeeded = Math.ceil(agg.totalSF / agg.sfPerSheet);
      boxMaterialSheets.set(name, {
        sheetsNeeded,
        totalSF: agg.totalSF,
        cost: agg.totalCost,
        sfPerSheet: agg.sfPerSheet,
      });
    });

    doorsMaterialsAgg.forEach((agg, name) => {
      const sheetsNeeded = Math.ceil(agg.totalSF / agg.sfPerSheet);
      doorsMaterialSheets.set(name, {
        sheetsNeeded,
        totalSF: agg.totalSF,
        cost: agg.totalCost,
        sfPerSheet: agg.sfPerSheet,
      });
    });

    const ROLL_LENGTH_METERS = 150;

    boxEdgebandAgg.forEach((agg, name) => {
      const rollsNeeded = Math.ceil(agg.totalMeters / ROLL_LENGTH_METERS);
      boxEdgebandRolls.set(name, {
        rollsNeeded,
        totalMeters: agg.totalMeters,
        cost: agg.totalCost,
        totalMetersRounded: rollsNeeded * ROLL_LENGTH_METERS,
      });
    });

    doorsEdgebandAgg.forEach((agg, name) => {
      const rollsNeeded = Math.ceil(agg.totalMeters / ROLL_LENGTH_METERS);
      doorsEdgebandRolls.set(name, {
        rollsNeeded,
        totalMeters: agg.totalMeters,
        cost: agg.totalCost,
        totalMetersRounded: rollsNeeded * ROLL_LENGTH_METERS,
      });
    });

    const { hardware, countertops, totalCost } = await loadHardwareAndCountertops('version_area_cabinets', 'version_area_countertops');

    setData({
      boxMaterialSheets,
      doorsMaterialSheets,
      boxEdgebandRolls,
      doorsEdgebandRolls,
      hardware,
      countertops,
      totalCost,
    });
  }

  async function loadHardwareAndCountertops(cabinetsTable: string, countertopsTable: string) {
    const { data: cabinets } = await supabase
      .from(cabinetsTable)
      .select('quantity, hardware, hardware_cost, subtotal')
      .eq('area_id', areaId);

    const { data: countertops } = await supabase
      .from(countertopsTable)
      .select('item_name, quantity, subtotal')
      .eq('area_id', areaId);

    const { data: priceList } = await supabase
      .from('price_list')
      .select('id, concept_description');

    const priceListMap = new Map(priceList?.map(p => [p.id, p.concept_description]) || []);

    const hardware = new Map<string, { quantity: number; cost: number }>();
    let totalCost = 0;

    cabinets?.forEach(cabinet => {
      const qty = cabinet.quantity || 1;

      if (cabinet.hardware && Array.isArray(cabinet.hardware) && cabinet.hardware.length > 0) {
        const totalHardwareCost = cabinet.hardware_cost || 0;
        const totalHardwareItems = cabinet.hardware.reduce((sum: number, hw: any) => sum + (hw.quantity_per_cabinet || 0), 0);

        (cabinet.hardware as any[]).forEach((hw: any) => {
          const hardwareId = hw.hardware_id;
          const quantityPerCabinet = hw.quantity_per_cabinet || 0;

          if (!hardwareId || quantityPerCabinet === 0) return;

          const name = priceListMap.get(hardwareId) || 'Unknown Hardware';
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

      totalCost += cabinet.subtotal || 0;
    });

    const countertopsMap = new Map<string, { quantity: number; cost: number }>();

    countertops?.forEach(countertop => {
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

    return { hardware, countertops: countertopsMap, totalCost };
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
    data.boxEdgebandRolls.size === 0 &&
    data.doorsEdgebandRolls.size === 0 &&
    data.hardware.size === 0 &&
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
          </div>
        )}

        {data.boxEdgebandRolls.size > 0 && (
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <div className="flex items-center mb-2">
              <Ruler className="h-3 w-3 text-amber-700 mr-1.5" />
              <h5 className="text-xs font-semibold text-amber-900">Box Edgeband (Rolls 150m)</h5>
            </div>
            <div className="space-y-1.5">
              {Array.from(data.boxEdgebandRolls.entries()).map(([name, rollData]) => (
                <div key={name} className="bg-white rounded p-2 text-xs">
                  <div className="font-medium text-slate-900 truncate mb-1">{name}</div>
                  <div className="flex justify-between text-slate-600">
                    <span><Hash className="h-3 w-3 inline mr-1" />{rollData.rollsNeeded} rolls</span>
                    <span><Ruler className="h-3 w-3 inline mr-1" />{rollData.totalMeters.toFixed(1)}m ({rollData.totalMetersRounded}m)</span>
                    <span className="font-semibold text-amber-700">{formatCurrency(rollData.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.doorsEdgebandRolls.size > 0 && (
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
            <div className="flex items-center mb-2">
              <Ruler className="h-3 w-3 text-purple-700 mr-1.5" />
              <h5 className="text-xs font-semibold text-purple-900">Doors Edgeband (Rolls 150m)</h5>
            </div>
            <div className="space-y-1.5">
              {Array.from(data.doorsEdgebandRolls.entries()).map(([name, rollData]) => (
                <div key={name} className="bg-white rounded p-2 text-xs">
                  <div className="font-medium text-slate-900 truncate mb-1">{name}</div>
                  <div className="flex justify-between text-slate-600">
                    <span><Hash className="h-3 w-3 inline mr-1" />{rollData.rollsNeeded} rolls</span>
                    <span><Ruler className="h-3 w-3 inline mr-1" />{rollData.totalMeters.toFixed(1)}m ({rollData.totalMetersRounded}m)</span>
                    <span className="font-semibold text-purple-700">{formatCurrency(rollData.cost)}</span>
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
