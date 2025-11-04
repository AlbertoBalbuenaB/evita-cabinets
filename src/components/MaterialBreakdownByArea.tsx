import { useEffect, useState } from 'react';
import { Package, TrendingUp, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/calculations';

interface AreaMaterialBreakdown {
  areaId: string;
  areaName: string;
  projectName?: string;
  materials: {
    boxMaterial: { name: string; cost: number; count: number };
    boxEdgeband: { name: string; cost: number; count: number };
    doorsMaterial: { name: string; cost: number; count: number };
    doorsEdgeband: { name: string; cost: number; count: number };
  };
  totalCost: number;
  cabinetCount: number;
}

interface MaterialBreakdownByAreaProps {
  projectId?: string;
}

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
          projects:project_id (name)
        `);

      if (projectId) {
        areasQuery = areasQuery.eq('project_id', projectId);
      }

      const { data: areas, error: areasError } = await areasQuery;

      if (areasError) throw areasError;

      const { data: cabinets, error: cabinetsError } = await supabase
        .from('area_cabinets')
        .select(`
          area_id,
          box_material_cost,
          box_edgeband_cost,
          doors_material_cost,
          doors_edgeband_cost,
          box_material_id,
          box_edgeband_id,
          doors_material_id,
          doors_edgeband_id,
          subtotal
        `);

      if (cabinetsError) throw cabinetsError;

      const { data: priceList, error: priceListError } = await supabase
        .from('price_list')
        .select('id, concept_description');

      if (priceListError) throw priceListError;

      const priceListMap = new Map(priceList?.map(p => [p.id, p.concept_description]) || []);

      const areaBreakdowns: AreaMaterialBreakdown[] = [];

      areas?.forEach(area => {
        const areaCabinets = cabinets?.filter(c => c.area_id === area.id) || [];

        if (areaCabinets.length === 0) return;

        const materialCounts = {
          boxMaterial: new Map<string, { cost: number; count: number }>(),
          boxEdgeband: new Map<string, { cost: number; count: number }>(),
          doorsMaterial: new Map<string, { cost: number; count: number }>(),
          doorsEdgeband: new Map<string, { cost: number; count: number }>(),
        };

        areaCabinets.forEach(cabinet => {
          if (cabinet.box_material_id) {
            const name = priceListMap.get(cabinet.box_material_id) || 'Unknown';
            const existing = materialCounts.boxMaterial.get(name) || { cost: 0, count: 0 };
            materialCounts.boxMaterial.set(name, {
              cost: existing.cost + (cabinet.box_material_cost || 0),
              count: existing.count + 1,
            });
          }

          if (cabinet.box_edgeband_id) {
            const name = priceListMap.get(cabinet.box_edgeband_id) || 'Unknown';
            const existing = materialCounts.boxEdgeband.get(name) || { cost: 0, count: 0 };
            materialCounts.boxEdgeband.set(name, {
              cost: existing.cost + (cabinet.box_edgeband_cost || 0),
              count: existing.count + 1,
            });
          }

          if (cabinet.doors_material_id) {
            const name = priceListMap.get(cabinet.doors_material_id) || 'Unknown';
            const existing = materialCounts.doorsMaterial.get(name) || { cost: 0, count: 0 };
            materialCounts.doorsMaterial.set(name, {
              cost: existing.cost + (cabinet.doors_material_cost || 0),
              count: existing.count + 1,
            });
          }

          if (cabinet.doors_edgeband_id) {
            const name = priceListMap.get(cabinet.doors_edgeband_id) || 'Unknown';
            const existing = materialCounts.doorsEdgeband.get(name) || { cost: 0, count: 0 };
            materialCounts.doorsEdgeband.set(name, {
              cost: existing.cost + (cabinet.doors_edgeband_cost || 0),
              count: existing.count + 1,
            });
          }
        });

        const getMostUsedMaterial = (map: Map<string, { cost: number; count: number }>) => {
          let maxCount = 0;
          let maxCost = 0;
          let topName = 'None';

          map.forEach((value, key) => {
            if (value.count > maxCount || (value.count === maxCount && value.cost > maxCost)) {
              maxCount = value.count;
              maxCost = value.cost;
              topName = key;
            }
          });

          return { name: topName, cost: maxCost, count: maxCount };
        };

        const totalCost = areaCabinets.reduce((sum, c) => sum + (c.subtotal || 0), 0);

        areaBreakdowns.push({
          areaId: area.id,
          areaName: area.name,
          projectName: projectId ? undefined : ((area.projects as any)?.name || 'Unknown Project'),
          materials: {
            boxMaterial: getMostUsedMaterial(materialCounts.boxMaterial),
            boxEdgeband: getMostUsedMaterial(materialCounts.boxEdgeband),
            doorsMaterial: getMostUsedMaterial(materialCounts.doorsMaterial),
            doorsEdgeband: getMostUsedMaterial(materialCounts.doorsEdgeband),
          },
          totalCost,
          cabinetCount: areaCabinets.length,
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-slate-600">Loading material breakdown...</div>
        </div>
      </div>
    );
  }

  if (breakdownData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
          <Layers className="h-5 w-5 mr-2 text-blue-600" />
          Material Breakdown by Area
        </h2>
        <div className="text-center py-8 text-slate-500">
          <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p>No cabinet data available yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
        <Layers className="h-5 w-5 mr-2 text-blue-600" />
        Material Breakdown by Area
      </h2>

      <div className="space-y-4">
        {breakdownData.map((area) => (
          <div
            key={area.areaId}
            className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-900">{area.areaName}</h3>
                {area.projectName && <p className="text-sm text-slate-600">{area.projectName}</p>}
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs text-slate-500">
                    {area.cabinetCount} cabinet{area.cabinetCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs font-semibold text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {formatCurrency(area.totalCost)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs font-medium text-blue-900 mb-1">Box Material</div>
                <div className="text-sm font-semibold text-blue-700 truncate">
                  {area.materials.boxMaterial.name}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {area.materials.boxMaterial.count} uses • {formatCurrency(area.materials.boxMaterial.cost)}
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs font-medium text-green-900 mb-1">Doors Material</div>
                <div className="text-sm font-semibold text-green-700 truncate">
                  {area.materials.doorsMaterial.name}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {area.materials.doorsMaterial.count} uses • {formatCurrency(area.materials.doorsMaterial.cost)}
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg p-3">
                <div className="text-xs font-medium text-amber-900 mb-1">Box Edgeband</div>
                <div className="text-sm font-semibold text-amber-700 truncate">
                  {area.materials.boxEdgeband.name}
                </div>
                <div className="text-xs text-amber-600 mt-1">
                  {area.materials.boxEdgeband.count} uses • {formatCurrency(area.materials.boxEdgeband.cost)}
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-3">
                <div className="text-xs font-medium text-purple-900 mb-1">Doors Edgeband</div>
                <div className="text-sm font-semibold text-purple-700 truncate">
                  {area.materials.doorsEdgeband.name}
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  {area.materials.doorsEdgeband.count} uses • {formatCurrency(area.materials.doorsEdgeband.cost)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
