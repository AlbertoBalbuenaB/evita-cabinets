import { useEffect, useMemo, useState } from 'react';
import { Package, Ruler, Wrench, Hammer as HammerIcon, ListChecks, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../lib/calculations';
import { supabase } from '../lib/supabase';
import { fetchAllProducts } from '../lib/fetchAllProducts';
import type { AreaCabinet, Product, PriceListItem, AreaItem, AreaCountertop, ProjectArea, AreaClosetItem } from '../types';

type EnrichedArea = ProjectArea & {
  cabinets: AreaCabinet[];
  items: AreaItem[];
  countertops: AreaCountertop[];
  closetItems?: AreaClosetItem[];
};

interface MaterialBreakdownProps {
  areas: EnrichedArea[];
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

interface AccessoryDetail {
  name: string;
  quantity: number;
  cost: number;
}

function SectionHeader({
  icon,
  title,
  total,
  open,
  onToggle,
  color = 'text-slate-700',
}: {
  icon: React.ReactNode;
  title: string;
  total: number;
  open: boolean;
  onToggle: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
    >
      <div className={`flex items-center gap-2 font-semibold text-sm ${color}`}>
        {icon}
        {title}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-slate-900">{formatCurrency(total)}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </div>
    </button>
  );
}

export function MaterialBreakdown({ areas }: MaterialBreakdownProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [openBox, setOpenBox] = useState(true);
  const [openDoors, setOpenDoors] = useState(true);
  const [openBackPanel, setOpenBackPanel] = useState(false);
  const [openEdgeband, setOpenEdgeband] = useState(true);
  const [openHardware, setOpenHardware] = useState(false);
  const [openAccessories, setOpenAccessories] = useState(false);
  const [openCountertops, setOpenCountertops] = useState(true);
  const [openItems, setOpenItems] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [productsData, pricesRes] = await Promise.all([
          fetchAllProducts({ onlyActive: false }),
          supabase.from('price_list').select('*'),
        ]);
        setProducts(productsData);
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
    if (loading || products.length === 0 || priceList.length === 0) return null;

    const boxMaterialsMap = new Map<string, MaterialDetail>();
    const doorsMaterialsMap = new Map<string, MaterialDetail>();
    const backPanelMaterialsMap = new Map<string, MaterialDetail>();
    const boxInteriorFinishMap = new Map<string, MaterialDetail>();
    const doorsInteriorFinishMap = new Map<string, MaterialDetail>();
    const boxEdgebandMap = new Map<string, EdgebandDetail>();
    const doorsEdgebandMap = new Map<string, EdgebandDetail>();
    const hardwareMap = new Map<string, HardwareDetail>();
    const accessoriesMap = new Map<string, AccessoryDetail>();

    let totalLaborCost = 0;
    let totalCountertopsCost = 0;
    let totalItemsCost = 0;
    let totalClosetItemsCost = 0;

    const allCountertops: AreaCountertop[] = [];
    const allItems: AreaItem[] = [];

    areas.forEach((area) => {
      const areaQty = area.quantity ?? 1;

      area.cabinets.forEach((cabinet) => {
        const product = products.find((p) => p.sku === cabinet.product_sku);
        if (!product) return;

        const effectiveQty = cabinet.quantity * areaQty;

        if (cabinet.box_material_id) {
          const material = priceList.find((p) => p.id === cabinet.box_material_id);
          if (material) {
            const sfPerSheet = material.sf_per_sheet || 32;
            const totalSF = product.box_sf * effectiveQty;
            const key = material.id;
            if (!boxMaterialsMap.has(key)) {
              boxMaterialsMap.set(key, { materialName: material.concept_description, totalSF, sheetsNeeded: Math.ceil(totalSF / sfPerSheet), sfPerSheet, cost: (cabinet.box_material_cost ?? 0) * areaQty });
            } else {
              const existing = boxMaterialsMap.get(key)!;
              existing.totalSF += totalSF;
              existing.sheetsNeeded = Math.ceil(existing.totalSF / sfPerSheet);
              existing.cost += (cabinet.box_material_cost ?? 0) * areaQty;
            }
          }
        }

        if (cabinet.box_interior_finish_id && (cabinet.box_interior_finish_cost ?? 0) > 0) {
          const interiorMaterial = priceList.find((p) => p.id === cabinet.box_interior_finish_id);
          if (interiorMaterial) {
            const sfPerSheet = interiorMaterial.sf_per_sheet || 32;
            const totalSF = product.box_sf * effectiveQty;
            const key = interiorMaterial.id;
            if (!boxInteriorFinishMap.has(key)) {
              boxInteriorFinishMap.set(key, { materialName: interiorMaterial.concept_description, totalSF, sheetsNeeded: Math.ceil(totalSF / sfPerSheet), sfPerSheet, cost: (cabinet.box_interior_finish_cost ?? 0) * areaQty });
            } else {
              const existing = boxInteriorFinishMap.get(key)!;
              existing.totalSF += totalSF;
              existing.sheetsNeeded = Math.ceil(existing.totalSF / sfPerSheet);
              existing.cost += (cabinet.box_interior_finish_cost ?? 0) * areaQty;
            }
          }
        }

        if (cabinet.doors_material_id) {
          const material = priceList.find((p) => p.id === cabinet.doors_material_id);
          if (material) {
            const sfPerSheet = material.sf_per_sheet || 32;
            const totalSF = product.doors_fronts_sf * effectiveQty;
            const key = material.id;
            if (!doorsMaterialsMap.has(key)) {
              doorsMaterialsMap.set(key, { materialName: material.concept_description, totalSF, sheetsNeeded: Math.ceil(totalSF / sfPerSheet), sfPerSheet, cost: (cabinet.doors_material_cost ?? 0) * areaQty });
            } else {
              const existing = doorsMaterialsMap.get(key)!;
              existing.totalSF += totalSF;
              existing.sheetsNeeded = Math.ceil(existing.totalSF / sfPerSheet);
              existing.cost += (cabinet.doors_material_cost ?? 0) * areaQty;
            }
          }
        }

        if (cabinet.doors_interior_finish_id && (cabinet.doors_interior_finish_cost ?? 0) > 0) {
          const interiorMaterial = priceList.find((p) => p.id === cabinet.doors_interior_finish_id);
          if (interiorMaterial) {
            const sfPerSheet = interiorMaterial.sf_per_sheet || 32;
            const totalSF = product.doors_fronts_sf * effectiveQty;
            const key = interiorMaterial.id;
            if (!doorsInteriorFinishMap.has(key)) {
              doorsInteriorFinishMap.set(key, { materialName: interiorMaterial.concept_description, totalSF, sheetsNeeded: Math.ceil(totalSF / sfPerSheet), sfPerSheet, cost: (cabinet.doors_interior_finish_cost ?? 0) * areaQty });
            } else {
              const existing = doorsInteriorFinishMap.get(key)!;
              existing.totalSF += totalSF;
              existing.sheetsNeeded = Math.ceil(existing.totalSF / sfPerSheet);
              existing.cost += (cabinet.doors_interior_finish_cost ?? 0) * areaQty;
            }
          }
        }

        if (cabinet.use_back_panel_material && cabinet.back_panel_material_id && cabinet.back_panel_sf && (cabinet.back_panel_material_cost ?? 0) > 0) {
          const material = priceList.find((p) => p.id === cabinet.back_panel_material_id);
          if (material) {
            const sfPerSheet = material.sf_per_sheet || 32;
            const totalSF = cabinet.back_panel_sf * areaQty;
            const key = material.id;
            if (!backPanelMaterialsMap.has(key)) {
              backPanelMaterialsMap.set(key, { materialName: material.concept_description, totalSF, sheetsNeeded: Math.ceil(totalSF / sfPerSheet), sfPerSheet, cost: (cabinet.back_panel_material_cost ?? 0) * areaQty });
            } else {
              const existing = backPanelMaterialsMap.get(key)!;
              existing.totalSF += totalSF;
              existing.sheetsNeeded = Math.ceil(existing.totalSF / sfPerSheet);
              existing.cost += (cabinet.back_panel_material_cost ?? 0) * areaQty;
            }
          }
        }

        if (cabinet.box_edgeband_id) {
          const edgeband = priceList.find((p) => p.id === cabinet.box_edgeband_id);
          if (edgeband) {
            const totalMeters = (product.box_edgeband ?? 0) * effectiveQty;
            const key = edgeband.id;
            if (!boxEdgebandMap.has(key)) {
              boxEdgebandMap.set(key, { edgebandName: edgeband.concept_description, totalMeters, rollsNeeded: 0, totalMetersRounded: 0, cost: (cabinet.box_edgeband_cost ?? 0) * areaQty });
            } else {
              const existing = boxEdgebandMap.get(key)!;
              existing.totalMeters += totalMeters;
              existing.cost += (cabinet.box_edgeband_cost ?? 0) * areaQty;
            }
          }
        }

        if (cabinet.doors_edgeband_id) {
          const edgeband = priceList.find((p) => p.id === cabinet.doors_edgeband_id);
          if (edgeband) {
            const totalMeters = (product.doors_fronts_edgeband ?? 0) * effectiveQty;
            const key = edgeband.id;
            if (!doorsEdgebandMap.has(key)) {
              doorsEdgebandMap.set(key, { edgebandName: edgeband.concept_description, totalMeters, rollsNeeded: 0, totalMetersRounded: 0, cost: (cabinet.doors_edgeband_cost ?? 0) * areaQty });
            } else {
              const existing = doorsEdgebandMap.get(key)!;
              existing.totalMeters += totalMeters;
              existing.cost += (cabinet.doors_edgeband_cost ?? 0) * areaQty;
            }
          }
        }

        if (cabinet.hardware && Array.isArray(cabinet.hardware)) {
          (cabinet.hardware as any[]).forEach((hw: any) => {
            const hardwareId = hw.hardware_id || hw.priceListId;
            if (hardwareId) {
              const hardwareItem = priceList.find((p) => p.id === hardwareId);
              if (hardwareItem) {
                const hwQuantity = (hw.quantity_per_cabinet || hw.quantity || 1) * effectiveQty;
                const hwCost = hardwareItem.price * hwQuantity;
                const key = hardwareId;
                if (!hardwareMap.has(key)) {
                  hardwareMap.set(key, { name: hardwareItem.concept_description, quantity: hwQuantity, cost: hwCost });
                } else {
                  const existing = hardwareMap.get(key)!;
                  existing.quantity += hwQuantity;
                  existing.cost += hwCost;
                }
              }
            }
          });
        }

        if (cabinet.accessories && Array.isArray(cabinet.accessories)) {
          (cabinet.accessories as any[]).forEach((acc: any) => {
            const accessoryId = acc.accessory_id;
            if (accessoryId) {
              const accessoryItem = priceList.find((p) => p.id === accessoryId);
              if (accessoryItem) {
                const accQuantity = (acc.quantity_per_cabinet || 1) * effectiveQty;
                const accCost = accessoryItem.price * accQuantity;
                const key = accessoryId;
                if (!accessoriesMap.has(key)) {
                  accessoriesMap.set(key, { name: accessoryItem.concept_description, quantity: accQuantity, cost: accCost });
                } else {
                  const existing = accessoriesMap.get(key)!;
                  existing.quantity += accQuantity;
                  existing.cost += accCost;
                }
              }
            }
          });
        }

        totalLaborCost += (cabinet.labor_cost ?? 0) * areaQty;
      });

      area.countertops.forEach((ct) => {
        const scaledCt = { ...ct, subtotal: ct.subtotal * areaQty, quantity: ct.quantity * areaQty };
        allCountertops.push(scaledCt);
        totalCountertopsCost += ct.subtotal * areaQty;
      });

      area.items.forEach((item) => {
        const scaledItem = { ...item, subtotal: item.subtotal * areaQty, quantity: item.quantity * areaQty };
        allItems.push(scaledItem);
        totalItemsCost += item.subtotal * areaQty;
      });

      (area.closetItems || []).forEach((ci) => {
        totalClosetItemsCost += ci.subtotal_mxn * areaQty;
      });
    });

    const boxMaterials = Array.from(boxMaterialsMap.values()).filter(
      (m) => m.cost > 0 && !m.materialName.toLowerCase().includes('not apply')
    );
    const doorsMaterials = Array.from(doorsMaterialsMap.values()).filter(
      (m) => m.cost > 0 && !m.materialName.toLowerCase().includes('not apply')
    );
    const boxInteriorFinishes = Array.from(boxInteriorFinishMap.values()).filter(
      (m) => m.cost > 0 && !m.materialName.toLowerCase().includes('not apply')
    );
    const doorsInteriorFinishes = Array.from(doorsInteriorFinishMap.values()).filter(
      (m) => m.cost > 0 && !m.materialName.toLowerCase().includes('not apply')
    );
    const backPanelMaterials = Array.from(backPanelMaterialsMap.values()).filter(
      (m) => m.cost > 0 && !m.materialName.toLowerCase().includes('not apply')
    );

    const ROLL_LENGTH_METERS = 150;
    const mergedEdgebands = new Map<string, EdgebandDetail>();
    [...Array.from(boxEdgebandMap.values()), ...Array.from(doorsEdgebandMap.values())].forEach((eb) => {
      if (mergedEdgebands.has(eb.edgebandName)) {
        const existing = mergedEdgebands.get(eb.edgebandName)!;
        existing.totalMeters += eb.totalMeters;
        existing.cost += eb.cost;
      } else {
        mergedEdgebands.set(eb.edgebandName, { ...eb });
      }
    });
    mergedEdgebands.forEach((eb) => {
      if (eb.edgebandName.toLowerCase().includes('not apply') || eb.cost <= 0) {
        mergedEdgebands.delete(eb.edgebandName);
        return;
      }
      eb.rollsNeeded = Math.ceil(eb.totalMeters / ROLL_LENGTH_METERS);
      eb.totalMetersRounded = eb.rollsNeeded * ROLL_LENGTH_METERS;
    });

    const hardware = Array.from(hardwareMap.values()).filter(
      (h) => h.cost > 0 && !h.name.toLowerCase().includes('not apply')
    );
    const accessories = Array.from(accessoriesMap.values()).filter(
      (a) => a.cost > 0 && !a.name.toLowerCase().includes('not apply')
    );

    const totalBoxCost = boxMaterials.reduce((s, m) => s + m.cost, 0) + boxInteriorFinishes.reduce((s, m) => s + m.cost, 0);
    const totalDoorsCost = doorsMaterials.reduce((s, m) => s + m.cost, 0) + doorsInteriorFinishes.reduce((s, m) => s + m.cost, 0);
    const totalBackPanelCost = backPanelMaterials.reduce((s, m) => s + m.cost, 0);
    const totalEdgebandCost = Array.from(mergedEdgebands.values()).reduce((s, e) => s + e.cost, 0);
    const totalHardwareCost = hardware.reduce((s, h) => s + h.cost, 0);
    const totalAccessoriesCost = accessories.reduce((s, a) => s + a.cost, 0);

    const grandTotal =
      totalBoxCost + totalDoorsCost + totalBackPanelCost + totalEdgebandCost +
      totalHardwareCost + totalAccessoriesCost + totalLaborCost +
      totalCountertopsCost + totalItemsCost + totalClosetItemsCost;

    return {
      boxMaterials,
      doorsMaterials,
      backPanelMaterials,
      boxInteriorFinishes,
      doorsInteriorFinishes,
      edgebands: Array.from(mergedEdgebands.values()),
      hardware,
      accessories,
      countertops: allCountertops,
      items: allItems,
      totals: {
        box: totalBoxCost,
        doors: totalDoorsCost,
        backPanel: totalBackPanelCost,
        edgeband: totalEdgebandCost,
        hardware: totalHardwareCost,
        accessories: totalAccessoriesCost,
        labor: totalLaborCost,
        countertops: totalCountertopsCost,
        items: totalItemsCost,
        closetItems: totalClosetItemsCost,
        grand: grandTotal,
      },
    };
  }, [areas, products, priceList, loading]);

  if (loading) {
    return (
      <div className="no-print bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="text-center text-slate-600">Loading breakdown...</div>
      </div>
    );
  }

  if (!breakdown) return null;

  const { totals } = breakdown;
  const grandTotal = totals.grand;

  function pct(val: number) {
    return grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) + '%' : '0%';
  }

  return (
    <div className="no-print space-y-3">
      <SectionHeader
        icon={<Package className="h-4 w-4 text-blue-600" />}
        title="Box Materials"
        total={totals.box}
        open={openBox}
        onToggle={() => setOpenBox((v) => !v)}
        color="text-blue-800"
      />
      {openBox && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          {breakdown.boxMaterials.length === 0 && breakdown.boxInteriorFinishes.length === 0 ? (
            <p className="text-sm text-blue-600">No box materials</p>
          ) : (
            <>
              {breakdown.boxMaterials.map((mat, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="flex justify-between text-sm font-medium text-blue-900 mb-1">
                    <span>{mat.materialName}</span>
                    <span>{formatCurrency(mat.cost)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-blue-700">
                    <span>{mat.totalSF.toFixed(1)} ft² needed</span>
                    <span>{mat.sheetsNeeded} × {mat.sfPerSheet} ft² sheets</span>
                    <span className="text-right">{(mat.sheetsNeeded * mat.sfPerSheet).toFixed(1)} ft² to order</span>
                  </div>
                </div>
              ))}
              {breakdown.boxInteriorFinishes.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center gap-1 mb-2 text-xs font-semibold text-blue-800">
                    <Layers className="h-3.5 w-3.5" />
                    Surface Layer (Applied Over Base)
                  </div>
                  {breakdown.boxInteriorFinishes.map((mat, idx) => (
                    <div key={idx} className="bg-blue-100 rounded-lg p-3 border border-blue-200 mb-2">
                      <div className="flex justify-between text-sm font-medium text-blue-900 mb-1">
                        <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{mat.materialName}</span>
                        <span>{formatCurrency(mat.cost)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                        <span>{mat.totalSF.toFixed(1)} ft² needed</span>
                        <span className="text-amber-700">Same sheets as base material</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-blue-900 pt-2 border-t border-blue-200">
                <span>Total Box</span>
                <span>{formatCurrency(totals.box)}</span>
              </div>
            </>
          )}
        </div>
      )}

      <SectionHeader
        icon={<Package className="h-4 w-4 text-green-600" />}
        title="Doors Materials"
        total={totals.doors}
        open={openDoors}
        onToggle={() => setOpenDoors((v) => !v)}
        color="text-green-800"
      />
      {openDoors && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
          {breakdown.doorsMaterials.length === 0 && breakdown.doorsInteriorFinishes.length === 0 ? (
            <p className="text-sm text-green-600">No doors materials</p>
          ) : (
            <>
              {breakdown.doorsMaterials.map((mat, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-green-100">
                  <div className="flex justify-between text-sm font-medium text-green-900 mb-1">
                    <span>{mat.materialName}</span>
                    <span>{formatCurrency(mat.cost)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-green-700">
                    <span>{mat.totalSF.toFixed(1)} ft² needed</span>
                    <span>{mat.sheetsNeeded} × {mat.sfPerSheet} ft² sheets</span>
                    <span className="text-right">{(mat.sheetsNeeded * mat.sfPerSheet).toFixed(1)} ft² to order</span>
                  </div>
                </div>
              ))}
              {breakdown.doorsInteriorFinishes.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center gap-1 mb-2 text-xs font-semibold text-green-800">
                    <Layers className="h-3.5 w-3.5" />
                    Surface Layer (Applied Over Base)
                  </div>
                  {breakdown.doorsInteriorFinishes.map((mat, idx) => (
                    <div key={idx} className="bg-green-100 rounded-lg p-3 border border-green-200 mb-2">
                      <div className="flex justify-between text-sm font-medium text-green-900 mb-1">
                        <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{mat.materialName}</span>
                        <span>{formatCurrency(mat.cost)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                        <span>{mat.totalSF.toFixed(1)} ft² needed</span>
                        <span className="text-amber-700">Same sheets as base material</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-green-900 pt-2 border-t border-green-200">
                <span>Total Doors</span>
                <span>{formatCurrency(totals.doors)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {breakdown.backPanelMaterials.length > 0 && (
        <>
          <SectionHeader
            icon={<Package className="h-4 w-4 text-orange-600" />}
            title="Back Panel Materials"
            total={totals.backPanel}
            open={openBackPanel}
            onToggle={() => setOpenBackPanel((v) => !v)}
            color="text-orange-800"
          />
          {openBackPanel && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
              {breakdown.backPanelMaterials.map((mat, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-orange-100">
                  <div className="flex justify-between text-sm font-medium text-orange-900 mb-1">
                    <span>{mat.materialName}</span>
                    <span>{formatCurrency(mat.cost)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-orange-700">
                    <span>{mat.totalSF.toFixed(1)} ft² needed</span>
                    <span>{mat.sheetsNeeded} × {mat.sfPerSheet} ft² sheets</span>
                    <span className="text-right">{(mat.sheetsNeeded * mat.sfPerSheet).toFixed(1)} ft² to order</span>
                  </div>
                  <div className="text-xs text-amber-700 mt-1">Subtracted from box material calculation</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <SectionHeader
        icon={<Ruler className="h-4 w-4 text-amber-600" />}
        title="Edgeband"
        total={totals.edgeband}
        open={openEdgeband}
        onToggle={() => setOpenEdgeband((v) => !v)}
        color="text-amber-800"
      />
      {openEdgeband && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          {breakdown.edgebands.length === 0 ? (
            <p className="text-sm text-amber-600">No edgeband</p>
          ) : (
            <>
              {breakdown.edgebands.map((eb, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-amber-100">
                  <div className="flex justify-between text-sm font-medium text-amber-900 mb-1">
                    <span>{eb.edgebandName}</span>
                    <span>{formatCurrency(eb.cost)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-amber-700">
                    <span>{eb.totalMeters.toFixed(1)} m needed</span>
                    <span>{eb.rollsNeeded} × 150 m rolls</span>
                    <span className="text-right">{eb.totalMetersRounded} m to order</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold text-amber-900 pt-2 border-t border-amber-200">
                <span>Total Edgeband</span>
                <span>{formatCurrency(totals.edgeband)}</span>
              </div>
            </>
          )}
        </div>
      )}

      <SectionHeader
        icon={<Wrench className="h-4 w-4 text-slate-600" />}
        title="Hardware"
        total={totals.hardware}
        open={openHardware}
        onToggle={() => setOpenHardware((v) => !v)}
        color="text-slate-700"
      />
      {openHardware && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          {breakdown.hardware.length === 0 ? (
            <p className="text-sm text-slate-600">No hardware</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {breakdown.hardware.map((hw, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-slate-100">
                  <div className="flex justify-between text-sm font-medium text-slate-900 mb-1">
                    <span className="truncate pr-2">{hw.name}</span>
                    <span className="shrink-0">{formatCurrency(hw.cost)}</span>
                  </div>
                  <div className="text-xs text-slate-500">{hw.quantity} units</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {breakdown.accessories.length > 0 && (
        <>
          <SectionHeader
            icon={<Package className="h-4 w-4 text-teal-600" />}
            title="Accessories"
            total={totals.accessories}
            open={openAccessories}
            onToggle={() => setOpenAccessories((v) => !v)}
            color="text-teal-800"
          />
          {openAccessories && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {breakdown.accessories.map((acc, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border border-teal-100">
                    <div className="flex justify-between text-sm font-medium text-teal-900 mb-1">
                      <span className="truncate pr-2">{acc.name}</span>
                      <span className="shrink-0">{formatCurrency(acc.cost)}</span>
                    </div>
                    <div className="text-xs text-teal-600">{acc.quantity} units</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {breakdown.countertops.length > 0 && (
        <>
          <SectionHeader
            icon={<HammerIcon className="h-4 w-4 text-orange-600" />}
            title="Countertops"
            total={totals.countertops}
            open={openCountertops}
            onToggle={() => setOpenCountertops((v) => !v)}
            color="text-orange-800"
          />
          {openCountertops && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2">
              {breakdown.countertops.map((ct, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-orange-100">
                  <div className="flex justify-between text-sm font-medium text-orange-900 mb-1">
                    <span>{ct.item_name}</span>
                    <span>{formatCurrency(ct.subtotal)}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-orange-700">
                    <span>Qty: {ct.quantity}</span>
                    <span>Unit: {formatCurrency(ct.unit_price)}</span>
                  </div>
                  {ct.notes && <div className="text-xs text-orange-600 italic mt-1">{ct.notes}</div>}
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold text-orange-900 pt-2 border-t border-orange-200">
                <span>Total Countertops</span>
                <span>{formatCurrency(totals.countertops)}</span>
              </div>
            </div>
          )}
        </>
      )}

      {breakdown.items.length > 0 && (
        <>
          <SectionHeader
            icon={<ListChecks className="h-4 w-4 text-amber-600" />}
            title="Individual Items"
            total={totals.items}
            open={openItems}
            onToggle={() => setOpenItems((v) => !v)}
            color="text-amber-800"
          />
          {openItems && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              {breakdown.items.map((item, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-amber-100">
                  <div className="flex justify-between text-sm font-medium text-amber-900 mb-1">
                    <span>{item.item_name}</span>
                    <span>{formatCurrency(item.subtotal)}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-amber-700">
                    <span>Qty: {item.quantity}</span>
                    <span>Unit: {formatCurrency(item.unit_price)}</span>
                  </div>
                  {item.notes && <div className="text-xs text-amber-600 italic mt-1">{item.notes}</div>}
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold text-amber-900 pt-2 border-t border-amber-200">
                <span>Total Items</span>
                <span>{formatCurrency(totals.items)}</span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white mt-2">
        <h4 className="text-base font-semibold mb-4 text-slate-200">Cost Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { label: 'Box Materials', value: totals.box },
            { label: 'Doors Materials', value: totals.doors },
            ...(totals.backPanel > 0 ? [{ label: 'Back Panel', value: totals.backPanel }] : []),
            { label: 'Edgeband', value: totals.edgeband },
            { label: 'Hardware', value: totals.hardware },
            ...(totals.accessories > 0 ? [{ label: 'Accessories', value: totals.accessories }] : []),
            { label: 'Labor', value: totals.labor },
            ...(totals.countertops > 0 ? [{ label: 'Countertops', value: totals.countertops }] : []),
            ...(totals.items > 0 ? [{ label: 'Individual Items', value: totals.items }] : []),
            ...(totals.closetItems > 0 ? [{ label: 'Prefab Closets', value: totals.closetItems }] : []),
          ].map((row, idx) => (
            <div key={idx}>
              <div className="text-xs text-slate-400 mb-0.5">{row.label}</div>
              <div className="text-lg font-bold">{formatCurrency(row.value)}</div>
              <div className="text-xs text-slate-500">{pct(row.value)}</div>
            </div>
          ))}
          <div className="col-span-2 md:col-span-1 border-t border-slate-600 pt-3 mt-1 md:border-t-0 md:border-l md:pl-4 md:pt-0 md:mt-0">
            <div className="text-xs text-slate-400 mb-0.5">Grand Total</div>
            <div className="text-2xl font-bold text-white">{formatCurrency(grandTotal)}</div>
            <div className="text-xs text-slate-400">100%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
