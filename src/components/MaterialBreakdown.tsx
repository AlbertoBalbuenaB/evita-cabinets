import { useEffect, useMemo, useState } from 'react';
import { Package, Ruler, Wrench, Hammer as HammerIcon, ListChecks } from 'lucide-react';
import { formatCurrency } from '../lib/calculations';
import { supabase } from '../lib/supabase';
import type { AreaCabinet, Product, PriceListItem, AreaItem, AreaCountertop } from '../types';

interface MaterialBreakdownProps {
  cabinets: AreaCabinet[];
  items: AreaItem[];
  countertops: AreaCountertop[];
}

interface MaterialDetail {
  materialName: string;
  totalSF: number;
  sheetsNeeded: number;
  sfPerSheet: number;
  cost: number;
}

interface EdgebandDetail {
  edgebandName: string;
  totalMeters: number;
  rollsNeeded: number;
  totalMetersRounded: number;
  cost: number;
}

interface HardwareDetail {
  name: string;
  quantity: number;
  cost: number;
}

export function MaterialBreakdown({ cabinets, items, countertops }: MaterialBreakdownProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [productsRes, pricesRes] = await Promise.all([
          supabase.from('products_catalog').select('*'),
          supabase.from('price_list').select('*'),
        ]);

        setProducts(productsRes.data || []);
        setPriceList(pricesRes.data || []);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const breakdown = useMemo(() => {
    if (loading || products.length === 0 || priceList.length === 0) {
      return null;
    }

    const boxMaterialsMap = new Map<string, MaterialDetail>();
    const doorsMaterialsMap = new Map<string, MaterialDetail>();
    const boxEdgebandMap = new Map<string, EdgebandDetail>();
    const doorsEdgebandMap = new Map<string, EdgebandDetail>();
    const hardwareMap = new Map<string, HardwareDetail>();

    let totalLaborCost = 0;

    cabinets.forEach((cabinet) => {
      const product = products.find((p) => p.sku === cabinet.product_sku);
      if (!product) return;

      if (cabinet.box_material_id) {
        const material = priceList.find((p) => p.id === cabinet.box_material_id);
        if (material) {
          const sfPerSheet = material.sf_per_sheet || 32;
          const totalSF = product.box_sf * cabinet.quantity;

          const key = material.id;
          if (!boxMaterialsMap.has(key)) {
            boxMaterialsMap.set(key, {
              materialName: material.concept_description,
              totalSF: totalSF,
              sheetsNeeded: Math.ceil(totalSF / sfPerSheet),
              sfPerSheet: sfPerSheet,
              cost: cabinet.box_material_cost,
            });
          } else {
            const existing = boxMaterialsMap.get(key)!;
            existing.totalSF += totalSF;
            existing.sheetsNeeded = Math.ceil(existing.totalSF / sfPerSheet);
            existing.cost += cabinet.box_material_cost;
          }
        }
      }

      if (cabinet.doors_material_id) {
        const material = priceList.find((p) => p.id === cabinet.doors_material_id);
        if (material) {
          const sfPerSheet = material.sf_per_sheet || 32;
          const totalSF = product.doors_fronts_sf * cabinet.quantity;

          const key = material.id;
          if (!doorsMaterialsMap.has(key)) {
            doorsMaterialsMap.set(key, {
              materialName: material.concept_description,
              totalSF: totalSF,
              sheetsNeeded: Math.ceil(totalSF / sfPerSheet),
              sfPerSheet: sfPerSheet,
              cost: cabinet.doors_material_cost,
            });
          } else {
            const existing = doorsMaterialsMap.get(key)!;
            existing.totalSF += totalSF;
            existing.sheetsNeeded = Math.ceil(existing.totalSF / sfPerSheet);
            existing.cost += cabinet.doors_material_cost;
          }
        }
      }

      if (cabinet.box_edgeband_id) {
        const edgeband = priceList.find((p) => p.id === cabinet.box_edgeband_id);
        if (edgeband) {
          const totalMeters = product.box_edgeband * cabinet.quantity;
          const key = edgeband.id;

          if (!boxEdgebandMap.has(key)) {
            boxEdgebandMap.set(key, {
              edgebandName: edgeband.concept_description,
              totalMeters: totalMeters,
              rollsNeeded: 0,
              totalMetersRounded: 0,
              cost: cabinet.box_edgeband_cost,
            });
          } else {
            const existing = boxEdgebandMap.get(key)!;
            existing.totalMeters += totalMeters;
            existing.cost += cabinet.box_edgeband_cost;
          }
        }
      }

      if (cabinet.doors_edgeband_id) {
        const edgeband = priceList.find((p) => p.id === cabinet.doors_edgeband_id);
        if (edgeband) {
          const totalMeters = product.doors_fronts_edgeband * cabinet.quantity;
          const key = edgeband.id;

          if (!doorsEdgebandMap.has(key)) {
            doorsEdgebandMap.set(key, {
              edgebandName: edgeband.concept_description,
              totalMeters: totalMeters,
              rollsNeeded: 0,
              totalMetersRounded: 0,
              cost: cabinet.doors_edgeband_cost,
            });
          } else {
            const existing = doorsEdgebandMap.get(key)!;
            existing.totalMeters += totalMeters;
            existing.cost += cabinet.doors_edgeband_cost;
          }
        }
      }

      if (cabinet.hardware && Array.isArray(cabinet.hardware)) {
        cabinet.hardware.forEach((hw: any) => {
          const hardwareId = hw.hardware_id || hw.priceListId;
          if (hardwareId) {
            const hardwareItem = priceList.find((p) => p.id === hardwareId);
            if (hardwareItem) {
              const hwQuantity = (hw.quantity_per_cabinet || hw.quantity || 1) * cabinet.quantity;
              const hwCost = hardwareItem.price * hwQuantity;
              const key = hardwareId;

              if (!hardwareMap.has(key)) {
                hardwareMap.set(key, {
                  name: hardwareItem.concept_description,
                  quantity: hwQuantity,
                  cost: hwCost,
                });
              } else {
                const existing = hardwareMap.get(key)!;
                existing.quantity += hwQuantity;
                existing.cost += hwCost;
              }
            }
          }
        });
      }

      totalLaborCost += cabinet.labor_cost;
    });

    const boxMaterials = Array.from(boxMaterialsMap.values()).filter(
      (m) => m.cost > 0 && !m.materialName.toLowerCase().includes('not apply')
    );
    const doorsMaterials = Array.from(doorsMaterialsMap.values()).filter(
      (m) => m.cost > 0 && !m.materialName.toLowerCase().includes('not apply')
    );
    const allEdgebands = [
      ...Array.from(boxEdgebandMap.values()),
      ...Array.from(doorsEdgebandMap.values()),
    ].filter((e) => e.cost > 0 && !e.edgebandName.toLowerCase().includes('not apply'));
    const hardware = Array.from(hardwareMap.values()).filter(
      (h) => h.cost > 0 && !h.name.toLowerCase().includes('not apply')
    );

    const totalBoxCost = boxMaterials.reduce((sum, m) => sum + m.cost, 0);
    const totalDoorsCost = doorsMaterials.reduce((sum, m) => sum + m.cost, 0);
    const totalEdgebandCost = allEdgebands.reduce((sum, e) => sum + e.cost, 0);
    const totalHardwareCost = hardware.reduce((sum, h) => sum + h.cost, 0);

    const ROLL_LENGTH_METERS = 150;
    const mergedEdgebands = new Map<string, EdgebandDetail>();
    allEdgebands.forEach((eb) => {
      if (mergedEdgebands.has(eb.edgebandName)) {
        const existing = mergedEdgebands.get(eb.edgebandName)!;
        existing.totalMeters += eb.totalMeters;
        existing.cost += eb.cost;
      } else {
        mergedEdgebands.set(eb.edgebandName, { ...eb });
      }
    });

    mergedEdgebands.forEach((eb) => {
      eb.rollsNeeded = Math.ceil(eb.totalMeters / ROLL_LENGTH_METERS);
      eb.totalMetersRounded = eb.rollsNeeded * ROLL_LENGTH_METERS;
    });

    return {
      boxMaterials,
      doorsMaterials,
      edgebands: Array.from(mergedEdgebands.values()),
      hardware,
      totals: {
        box: totalBoxCost,
        doors: totalDoorsCost,
        edgeband: totalEdgebandCost,
        hardware: totalHardwareCost,
        labor: totalLaborCost,
        total: totalBoxCost + totalDoorsCost + totalEdgebandCost + totalHardwareCost + totalLaborCost,
      },
    };
  }, [cabinets, products, priceList, loading]);

  if (loading) {
    return (
      <div className="no-print bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="text-center text-slate-600">Loading breakdown...</div>
      </div>
    );
  }

  if (!breakdown) {
    return null;
  }

  return (
    <div className="no-print space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Package className="h-5 w-5 mr-2 text-blue-600" />
          Materials Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-3">Box Materials</h4>
            <div className="space-y-2">
              {breakdown.boxMaterials.length > 0 ? (
                breakdown.boxMaterials.map((mat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-800 font-medium">{mat.materialName}</span>
                      <span className="font-medium text-blue-900">{formatCurrency(mat.cost)}</span>
                    </div>
                    <div className="text-xs text-blue-700 space-y-0.5">
                      <div className="flex justify-between">
                        <span>SF needed:</span>
                        <span className="font-medium">{mat.totalSF.toFixed(2)} ft²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sheets to order:</span>
                        <span className="font-medium">{mat.sheetsNeeded} × {mat.sfPerSheet} ft²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total SF to order:</span>
                        <span className="font-medium">{(mat.sheetsNeeded * mat.sfPerSheet).toFixed(2)} ft²</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-blue-600">No box materials</p>
              )}
              <div className="pt-2 border-t border-blue-300 flex justify-between font-semibold text-blue-900">
                <span>Total</span>
                <span>{formatCurrency(breakdown.totals.box)}</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-3">Doors Materials</h4>
            <div className="space-y-2">
              {breakdown.doorsMaterials.length > 0 ? (
                breakdown.doorsMaterials.map((mat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-800 font-medium">{mat.materialName}</span>
                      <span className="font-medium text-green-900">{formatCurrency(mat.cost)}</span>
                    </div>
                    <div className="text-xs text-green-700 space-y-0.5">
                      <div className="flex justify-between">
                        <span>SF needed:</span>
                        <span className="font-medium">{mat.totalSF.toFixed(2)} ft²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sheets to order:</span>
                        <span className="font-medium">{mat.sheetsNeeded} × {mat.sfPerSheet} ft²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total SF to order:</span>
                        <span className="font-medium">{(mat.sheetsNeeded * mat.sfPerSheet).toFixed(2)} ft²</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-green-600">No doors materials</p>
              )}
              <div className="pt-2 border-t border-green-300 flex justify-between font-semibold text-green-900">
                <span>Total</span>
                <span>{formatCurrency(breakdown.totals.doors)}</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-3 flex items-center">
              <Ruler className="h-4 w-4 mr-1" />
              Edgeband
            </h4>
            <div className="space-y-2">
              {breakdown.edgebands.length > 0 ? (
                breakdown.edgebands.map((eb, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-800 font-medium">{eb.edgebandName}</span>
                      <span className="font-medium text-amber-900">{formatCurrency(eb.cost)}</span>
                    </div>
                    <div className="text-xs text-amber-700 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Meters needed:</span>
                        <span className="font-medium">{eb.totalMeters.toFixed(2)} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rolls needed:</span>
                        <span className="font-medium">{eb.rollsNeeded} × 150m</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total to order:</span>
                        <span className="font-medium">{eb.totalMetersRounded} m</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-amber-600">No edgeband</p>
              )}
              <div className="pt-2 border-t border-amber-300 flex justify-between font-semibold text-amber-900">
                <span>Total</span>
                <span>{formatCurrency(breakdown.totals.edgeband)}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h4 className="font-medium text-slate-900 mb-3 flex items-center">
              <Wrench className="h-4 w-4 mr-1" />
              Hardware
            </h4>
            <div className="space-y-2">
              {breakdown.hardware.length > 0 ? (
                breakdown.hardware.map((hw, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-800 font-medium">{hw.name}</span>
                      <span className="font-medium text-slate-900">{formatCurrency(hw.cost)}</span>
                    </div>
                    <div className="text-xs text-slate-600">{hw.quantity} units</div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No hardware</p>
              )}
              <div className="pt-2 border-t border-slate-300 flex justify-between font-semibold text-slate-900">
                <span>Total</span>
                <span>{formatCurrency(breakdown.totals.hardware)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {countertops.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <HammerIcon className="h-5 w-5 mr-2 text-orange-600" />
            Countertops Breakdown
          </h3>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="space-y-2">
              {countertops.map((countertop, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-800 font-medium">{countertop.item_name}</span>
                    <span className="font-medium text-orange-900">{formatCurrency(countertop.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-orange-700">
                    <span>Quantity: {countertop.quantity}</span>
                    <span>Unit Price: {formatCurrency(countertop.unit_price)}</span>
                  </div>
                  {countertop.notes && (
                    <div className="text-xs text-orange-600 italic">Note: {countertop.notes}</div>
                  )}
                </div>
              ))}
              <div className="pt-2 border-t border-orange-300 flex justify-between font-semibold text-orange-900">
                <span>Total Countertops</span>
                <span>{formatCurrency(countertops.reduce((sum, ct) => sum + ct.subtotal, 0))}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <ListChecks className="h-5 w-5 mr-2 text-amber-600" />
            Individual Items Breakdown
          </h3>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-800 font-medium">{item.item_name}</span>
                    <span className="font-medium text-amber-900">{formatCurrency(item.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-amber-700">
                    <span>Quantity: {item.quantity}</span>
                    <span>Unit Price: {formatCurrency(item.unit_price)}</span>
                  </div>
                  {item.notes && (
                    <div className="text-xs text-amber-600 italic">Note: {item.notes}</div>
                  )}
                </div>
              ))}
              <div className="pt-2 border-t border-amber-300 flex justify-between font-semibold text-amber-900">
                <span>Total Individual Items</span>
                <span>{formatCurrency(items.reduce((sum, item) => sum + item.subtotal, 0))}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-6 text-white">
        <h4 className="text-lg font-semibold mb-4">Cost Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-slate-300">Box Materials</div>
            <div className="text-xl font-bold">{formatCurrency(breakdown.totals.box)}</div>
          </div>
          <div>
            <div className="text-sm text-slate-300">Doors Materials</div>
            <div className="text-xl font-bold">{formatCurrency(breakdown.totals.doors)}</div>
          </div>
          <div>
            <div className="text-sm text-slate-300">Edgeband</div>
            <div className="text-xl font-bold">{formatCurrency(breakdown.totals.edgeband)}</div>
          </div>
          <div>
            <div className="text-sm text-slate-300">Hardware</div>
            <div className="text-xl font-bold">{formatCurrency(breakdown.totals.hardware)}</div>
          </div>
          <div>
            <div className="text-sm text-slate-300 flex items-center">
              <Hammer className="h-4 w-4 mr-1" />
              Labor
            </div>
            <div className="text-xl font-bold">{formatCurrency(breakdown.totals.labor)}</div>
          </div>
          {countertops.length > 0 && (
            <div>
              <div className="text-sm text-slate-300 flex items-center">
                <HammerIcon className="h-4 w-4 mr-1" />
                Countertops
              </div>
              <div className="text-xl font-bold">{formatCurrency(countertops.reduce((sum, ct) => sum + ct.subtotal, 0))}</div>
            </div>
          )}
          {items.length > 0 && (
            <div>
              <div className="text-sm text-slate-300 flex items-center">
                <ListChecks className="h-4 w-4 mr-1" />
                Individual Items
              </div>
              <div className="text-xl font-bold">{formatCurrency(items.reduce((sum, item) => sum + item.subtotal, 0))}</div>
            </div>
          )}
          <div className="border-l border-slate-500 pl-4">
            <div className="text-sm text-slate-300">Total Cost</div>
            <div className="text-2xl font-bold">{formatCurrency(breakdown.totals.total + countertops.reduce((sum, ct) => sum + ct.subtotal, 0) + items.reduce((sum, item) => sum + item.subtotal, 0))}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
