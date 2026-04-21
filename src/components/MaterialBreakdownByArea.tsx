import { useEffect, useState } from 'react';
import { Package, Layers, Hash, Ruler, Hammer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/calculations';

interface AreaMaterialBreakdown {
  areaId: string;
  areaName: string;
  projectName?: string;
  boxMaterialSheets: Map<string, { sheetsNeeded: number; totalSF: number; cost: number }>;
  doorsMaterialSheets: Map<string, { sheetsNeeded: number; totalSF: number; cost: number }>;
  boxEdgebandRolls: Map<string, { rollsNeeded: number; totalMeters: number; cost: number }>;
  doorsEdgebandRolls: Map<string, { rollsNeeded: number; totalMeters: number; cost: number }>;
  hardware: Map<string, { quantity: number; cost: number }>;
  accessories: Map<string, { quantity: number; cost: number }>;
  countertops: Map<string, { quantity: number; cost: number }>;
  totalCost: number;
  cabinetCount: number;
  countertopCount: number;
}

interface MaterialBreakdownByAreaProps {
  projectId?: string;
}

const SHEET_SIZE_SF = 32;
const ROLL_LENGTH_METERS = 100;

export function MaterialBreakdownByArea({ projectId }: MaterialBreakdownByAreaProps = {}) {
  const [breakdownData, setBreakdownData] = useState<AreaMaterialBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaterialBreakdown();
  }, [projectId]);

  async function loadMaterialBreakdown() {
    try {
      let areasQuery = supabase
        .from('project_areas')
        .select(`
          id,
          name,
          quantity,
          projects:project_id (name)
        `);

      if (projectId) {
        areasQuery = areasQuery.eq('project_id', projectId);
      }

      const { data: areas, error: areasError } = await areasQuery;
      if (areasError) throw areasError;

      const { data: cabinets, error: cabinetsError} = await supabase
        .from('area_cabinets')
        .select(`
          area_id,
          quantity,
          product_sku,
          box_material_id,
          box_edgeband_id,
          doors_material_id,
          doors_edgeband_id,
          box_material_cost,
          box_edgeband_cost,
          doors_material_cost,
          doors_edgeband_cost,
          hardware_cost,
          hardware,
          accessories_cost,
          accessories,
          subtotal
        `);

      if (cabinetsError) throw cabinetsError;

      const { data: countertops, error: countertopsError } = await supabase
        .from('area_countertops')
        .select(`
          area_id,
          item_name,
          quantity,
          unit_price,
          subtotal
        `);

      if (countertopsError) throw countertopsError;

      const { data: priceList, error: priceListError } = await supabase
        .from('price_list')
        .select('id, concept_description');

      if (priceListError) throw priceListError;

      const { data: products, error: productsError } = await supabase
        .from('products_catalog')
        .select('sku, box_sf, doors_fronts_sf, total_edgeband, box_edgeband, box_edgeband_color')
        .limit(2000);

      if (productsError) throw productsError;

      const priceListMap = new Map((priceList as any[])?.map((p: any) => [p.id, p.concept_description]) || []);
      const productsMap = new Map((products as any[])?.map((p: any) => [p.sku, p]) || []);

      const areaBreakdowns: AreaMaterialBreakdown[] = [];

      (areas as any[])?.forEach((area: any) => {
        const areaCabinets = (cabinets as any[])?.filter((c: any) => c.area_id === area.id) || [];
        const areaCountertops = (countertops as any[])?.filter((ct: any) => ct.area_id === area.id) || [];

        if (areaCabinets.length === 0 && areaCountertops.length === 0) return;

        const areaQty = area.quantity ?? 1;

        const boxMaterialSheets = new Map<string, { sheetsNeeded: number; totalSF: number; cost: number }>();
        const doorsMaterialSheets = new Map<string, { sheetsNeeded: number; totalSF: number; cost: number }>();
        const boxEdgebandRolls = new Map<string, { rollsNeeded: number; totalMeters: number; cost: number }>();
        const doorsEdgebandRolls = new Map<string, { rollsNeeded: number; totalMeters: number; cost: number }>();
        const hardware = new Map<string, { quantity: number; cost: number }>();
        const accessories = new Map<string, { quantity: number; cost: number }>();
        const countertopsMap = new Map<string, { quantity: number; cost: number }>();

        let totalCost = 0;

        areaCabinets.forEach((cabinet: any) => {
          const product = productsMap.get(cabinet.product_sku || '');
          const qty = (cabinet.quantity || 1) * areaQty;

          if (cabinet.box_material_id && product) {
            const name = priceListMap.get(cabinet.box_material_id) || 'Unknown Box Material';
            if (name.toLowerCase().includes('not apply')) return;
            const totalSF = product.box_sf * qty;
            const existing = boxMaterialSheets.get(name) || { sheetsNeeded: 0, totalSF: 0, cost: 0 };
            boxMaterialSheets.set(name, {
              sheetsNeeded: 0,
              totalSF: existing.totalSF + totalSF,
              cost: existing.cost + (cabinet.box_material_cost || 0) * areaQty,
            });
          }

          if (cabinet.doors_material_id && product) {
            const name = priceListMap.get(cabinet.doors_material_id) || 'Unknown Doors Material';
            if (name.toLowerCase().includes('not apply')) return;
            const totalSF = product.doors_fronts_sf * qty;
            const existing = doorsMaterialSheets.get(name) || { sheetsNeeded: 0, totalSF: 0, cost: 0 };
            doorsMaterialSheets.set(name, {
              sheetsNeeded: 0,
              totalSF: existing.totalSF + totalSF,
              cost: existing.cost + (cabinet.doors_material_cost || 0) * areaQty,
            });
          }

          if (cabinet.box_edgeband_id && product) {
            const name = priceListMap.get(cabinet.box_edgeband_id) || 'Unknown Box Edgeband';
            if (name.toLowerCase().includes('not apply')) return;
            const totalMeters = (product.box_edgeband || 0) * qty;
            const existing = boxEdgebandRolls.get(name) || { rollsNeeded: 0, totalMeters: 0, cost: 0 };
            boxEdgebandRolls.set(name, {
              rollsNeeded: existing.rollsNeeded + Math.ceil(totalMeters / ROLL_LENGTH_METERS),
              totalMeters: existing.totalMeters + totalMeters,
              cost: existing.cost + (cabinet.box_edgeband_cost || 0) * areaQty,
            });
          }

          if (cabinet.doors_edgeband_id && product) {
            const name = priceListMap.get(cabinet.doors_edgeband_id) || 'Unknown Doors Edgeband';
            if (name.toLowerCase().includes('not apply')) return;
            const totalMeters = product.total_edgeband * qty - ((product.box_edgeband || 0) * qty);
            const existing = doorsEdgebandRolls.get(name) || { rollsNeeded: 0, totalMeters: 0, cost: 0 };
            doorsEdgebandRolls.set(name, {
              rollsNeeded: existing.rollsNeeded + Math.ceil(totalMeters / ROLL_LENGTH_METERS),
              totalMeters: existing.totalMeters + totalMeters,
              cost: existing.cost + (cabinet.doors_edgeband_cost || 0) * areaQty,
            });
          }

          if (cabinet.hardware && Array.isArray(cabinet.hardware) && cabinet.hardware.length > 0) {
            const totalHardwareCost = (cabinet.hardware_cost || 0) * areaQty;
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
            const totalAccessoriesCost = (cabinet.accessories_cost || 0) * areaQty;
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

          totalCost += (cabinet.subtotal || 0) * areaQty;
        });

        areaCountertops.forEach((countertop: any) => {
          const name = countertop.item_name || 'Unknown Countertop';
          const qty = (countertop.quantity || 0) * areaQty;
          const cost = (countertop.subtotal || 0) * areaQty;

          const existing = countertopsMap.get(name) || { quantity: 0, cost: 0 };
          countertopsMap.set(name, {
            quantity: existing.quantity + qty,
            cost: existing.cost + cost,
          });

          totalCost += cost;
        });

        boxMaterialSheets.forEach((material) => {
          material.sheetsNeeded = Math.ceil(material.totalSF / SHEET_SIZE_SF);
        });

        doorsMaterialSheets.forEach((material) => {
          material.sheetsNeeded = Math.ceil(material.totalSF / SHEET_SIZE_SF);
        });

        areaBreakdowns.push({
          areaId: area.id,
          areaName: areaQty > 1 ? `${area.name} (×${areaQty})` : area.name,
          projectName: projectId ? undefined : ((area.projects as any)?.name || 'Unknown Project'),
          boxMaterialSheets,
          doorsMaterialSheets,
          boxEdgebandRolls,
          doorsEdgebandRolls,
          hardware,
          accessories,
          countertops: countertopsMap,
          totalCost,
          cabinetCount: areaCabinets.length * areaQty,
          countertopCount: areaCountertops.length * areaQty,
        });
      });

      areaBreakdowns.sort((a, b) => b.totalCost - a.totalCost);

      setBreakdownData(areaBreakdowns);
    } catch (error) {
      console.error('Error loading material breakdown:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-surf-card rounded-xl shadow-sm border border-border-soft p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-fg-600">Loading material breakdown...</div>
        </div>
      </div>
    );
  }

  if (breakdownData.length === 0) {
    return (
      <div className="bg-surf-card rounded-xl shadow-sm border border-border-soft p-6">
        <h2 className="text-xl font-bold text-fg-900 mb-4 flex items-center">
          <Layers className="h-5 w-5 mr-2 text-accent-text" />
          Material Breakdown by Area
        </h2>
        <div className="text-center py-8 text-fg-500">
          <Package className="h-12 w-12 mx-auto mb-3 text-fg-300" />
          <p>No cabinet data available yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surf-card rounded-xl shadow-sm border border-border-soft p-6">
      <h2 className="text-xl font-bold text-fg-900 mb-4 flex items-center">
        <Layers className="h-5 w-5 mr-2 text-accent-text" />
        Material Breakdown by Area
      </h2>

      <div className="space-y-6">
        {breakdownData.map((area) => (
          <div
            key={area.areaId}
            className="border border-border-soft rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-border-soft">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-fg-900">{area.areaName}</h3>
                {area.projectName && <p className="text-sm text-fg-600">{area.projectName}</p>}
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs text-fg-500">
                    {area.cabinetCount} cabinet{area.cabinetCount !== 1 ? 's' : ''}
                    {area.countertopCount > 0 && ` • ${area.countertopCount} countertop${area.countertopCount !== 1 ? 's' : ''}`}
                  </span>
                  <span className="text-xs font-semibold text-status-emerald-fg">
                    Total: {formatCurrency(area.totalCost)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {area.boxMaterialSheets.size > 0 && (
                <div className="bg-accent-tint-soft rounded-lg p-4 border border-blue-100">
                  <div className="flex items-center mb-3">
                    <Package className="h-4 w-4 text-accent-text mr-2" />
                    <h4 className="text-sm font-semibold text-blue-900">Box Materials (Sheets)</h4>
                  </div>
                  <div className="space-y-2">
                    {Array.from(area.boxMaterialSheets.entries()).map(([name, data]) => (
                      <div key={name} className="bg-surf-card rounded p-2 text-xs">
                        <div className="font-medium text-fg-900 truncate mb-1">{name}</div>
                        <div className="flex justify-between text-fg-600">
                          <span><Hash className="h-3 w-3 inline mr-1" />{data.sheetsNeeded} sheets</span>
                          <span><Ruler className="h-3 w-3 inline mr-1" />{data.totalSF.toFixed(1)} SF</span>
                          <span className="font-semibold text-accent-text">{formatCurrency(data.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {area.doorsMaterialSheets.size > 0 && (
                <div className="bg-status-emerald-bg rounded-lg p-4 border border-green-100">
                  <div className="flex items-center mb-3">
                    <Package className="h-4 w-4 text-status-emerald-fg mr-2" />
                    <h4 className="text-sm font-semibold text-green-900">Doors Materials (Sheets)</h4>
                  </div>
                  <div className="space-y-2">
                    {Array.from(area.doorsMaterialSheets.entries()).map(([name, data]) => (
                      <div key={name} className="bg-surf-card rounded p-2 text-xs">
                        <div className="font-medium text-fg-900 truncate mb-1">{name}</div>
                        <div className="flex justify-between text-fg-600">
                          <span><Hash className="h-3 w-3 inline mr-1" />{data.sheetsNeeded} sheets</span>
                          <span><Ruler className="h-3 w-3 inline mr-1" />{data.totalSF.toFixed(1)} SF</span>
                          <span className="font-semibold text-status-emerald-fg">{formatCurrency(data.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {area.boxEdgebandRolls.size > 0 && (
                <div className="bg-status-amber-bg rounded-lg p-4 border border-amber-100">
                  <div className="flex items-center mb-3">
                    <Ruler className="h-4 w-4 text-status-amber-fg mr-2" />
                    <h4 className="text-sm font-semibold text-amber-900">Box Edgeband (Rolls)</h4>
                  </div>
                  <div className="space-y-2">
                    {Array.from(area.boxEdgebandRolls.entries()).map(([name, data]) => (
                      <div key={name} className="bg-surf-card rounded p-2 text-xs">
                        <div className="font-medium text-fg-900 truncate mb-1">{name}</div>
                        <div className="flex justify-between text-fg-600">
                          <span><Hash className="h-3 w-3 inline mr-1" />{data.rollsNeeded} rolls</span>
                          <span><Ruler className="h-3 w-3 inline mr-1" />{data.totalMeters.toFixed(1)} m</span>
                          <span className="font-semibold text-status-amber-fg">{formatCurrency(data.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {area.doorsEdgebandRolls.size > 0 && (
                <div className="bg-accent-tint-soft rounded-lg p-4 border border-purple-100">
                  <div className="flex items-center mb-3">
                    <Ruler className="h-4 w-4 text-accent-text mr-2" />
                    <h4 className="text-sm font-semibold text-purple-900">Doors Edgeband (Rolls)</h4>
                  </div>
                  <div className="space-y-2">
                    {Array.from(area.doorsEdgebandRolls.entries()).map(([name, data]) => (
                      <div key={name} className="bg-surf-card rounded p-2 text-xs">
                        <div className="font-medium text-fg-900 truncate mb-1">{name}</div>
                        <div className="flex justify-between text-fg-600">
                          <span><Hash className="h-3 w-3 inline mr-1" />{data.rollsNeeded} rolls</span>
                          <span><Ruler className="h-3 w-3 inline mr-1" />{data.totalMeters.toFixed(1)} m</span>
                          <span className="font-semibold text-accent-text">{formatCurrency(data.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {area.hardware.size > 0 && (
                <div className="bg-surf-app rounded-lg p-4 border border-border-soft lg:col-span-2">
                  <div className="flex items-center mb-3">
                    <Package className="h-4 w-4 text-fg-700 mr-2" />
                    <h4 className="text-sm font-semibold text-fg-900">Hardware</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Array.from(area.hardware.entries()).map(([name, data]) => (
                      <div key={name} className="bg-surf-card rounded p-2 text-xs">
                        <div className="font-medium text-fg-900 truncate mb-1">{name}</div>
                        <div className="flex justify-between text-fg-600">
                          <span><Hash className="h-3 w-3 inline mr-1" />{data.quantity} pcs</span>
                          <span className="font-semibold text-fg-700">{formatCurrency(data.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {area.accessories.size > 0 && (
                <div className="bg-accent-tint-soft rounded-lg p-4 border border-accent-tint-border lg:col-span-2">
                  <div className="flex items-center mb-3">
                    <Package className="h-4 w-4 text-accent-text mr-2" />
                    <h4 className="text-sm font-semibold text-purple-900">Accessories</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Array.from(area.accessories.entries()).map(([name, data]) => (
                      <div key={name} className="bg-surf-card rounded p-2 text-xs">
                        <div className="font-medium text-fg-900 truncate mb-1">{name}</div>
                        <div className="flex justify-between text-fg-600">
                          <span><Hash className="h-3 w-3 inline mr-1" />{data.quantity} pcs</span>
                          <span className="font-semibold text-accent-text">{formatCurrency(data.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {area.countertops.size > 0 && (
                <div className="bg-status-orange-bg rounded-lg p-4 border border-status-orange-brd lg:col-span-2">
                  <div className="flex items-center mb-3">
                    <Hammer className="h-4 w-4 text-status-orange-fg mr-2" />
                    <h4 className="text-sm font-semibold text-orange-900">Countertops</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Array.from(area.countertops.entries()).map(([name, data]) => (
                      <div key={name} className="bg-surf-card rounded p-2 text-xs">
                        <div className="font-medium text-fg-900 truncate mb-1">{name}</div>
                        <div className="flex justify-between text-fg-600">
                          <span><Hash className="h-3 w-3 inline mr-1" />{data.quantity.toFixed(2)} units</span>
                          <span className="font-semibold text-status-orange-fg">{formatCurrency(data.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
