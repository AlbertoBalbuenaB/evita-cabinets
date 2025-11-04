import { useEffect, useState } from 'react';
import {
  FolderOpen,
  DollarSign,
  Package,
  TrendingUp,
  Database,
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
  Tag,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/calculations';
import { seedSampleData } from '../utils/seedData';
import { Button } from '../components/Button';
import { MaterialBreakdownByArea } from '../components/MaterialBreakdownByArea';

interface DashboardStats {
  totalProjects: number;
  wonProjects: number;
  pendingProjects: number;
  lostProjects: number;
  totalValue: number;
  wonValue: number;
  totalProducts: number;
  totalPriceItems: number;
  totalCabinets: number;
  totalCabinetQuantity: number;
  avgCostPerCabinet: number;
  totalCabinetValue: number;
}

interface RecentProject {
  id: string;
  name: string;
  quote_date: string;
  total_amount: number;
  status: string;
  project_type: string;
  updated_at: string;
}

interface ProjectTypeStats {
  projectType: string;
  totalProjects: number;
  wonProjects: number;
  totalValue: number;
  wonValue: number;
  conversionRate: number;
}

interface MonthlyData {
  month: string;
  year: number;
  totalProjects: number;
  wonProjects: number;
  totalValue: number;
  wonValue: number;
}

interface TopCabinet {
  product_sku: string;
  product_description: string;
  total_quantity: number;
  times_quoted: number;
  avg_quantity: number;
}

interface MaterialTrend {
  material_id: string;
  material_name: string;
  usage_count: number;
  percentage: number;
}

interface HardwareTrend {
  hardware_name: string;
  usage_count: number;
  total_quantity: number;
}

interface DashboardProps {
  onNavigate: (page: string) => void;
  onNavigateToProject: (projectId: string) => void;
}

export function Dashboard({ onNavigate, onNavigateToProject }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    wonProjects: 0,
    pendingProjects: 0,
    lostProjects: 0,
    totalValue: 0,
    wonValue: 0,
    totalProducts: 0,
    totalPriceItems: 0,
    totalCabinets: 0,
    totalCabinetQuantity: 0,
    avgCostPerCabinet: 0,
    totalCabinetValue: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [projectTypeStats, setProjectTypeStats] = useState<ProjectTypeStats[]>([]);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [topCabinets, setTopCabinets] = useState<TopCabinet[]>([]);
  const [doorMaterialTrends, setDoorMaterialTrends] = useState<MaterialTrend[]>([]);
  const [boxMaterialTrends, setBoxMaterialTrends] = useState<MaterialTrend[]>([]);
  const [hardwareTrends, setHardwareTrends] = useState<HardwareTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    loadTrends();
  }, []);

  async function loadStats() {
    try {
      const [projectsRes, productsRes, pricesRes, recentRes, cabinetsRes] = await Promise.all([
        supabase.from('projects').select('status, total_amount, quote_date, project_type'),
        supabase.from('products_catalog').select('id', { count: 'exact', head: true }),
        supabase.from('price_list').select('id', { count: 'exact', head: true }),
        supabase
          .from('projects')
          .select('id, name, quote_date, total_amount, status, project_type, updated_at')
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase.from('area_cabinets').select('quantity, subtotal'),
      ]);

      const projects = projectsRes.data || [];
      const cabinets = cabinetsRes.data || [];

      const wonProjects = projects.filter(p => p.status === 'won');
      const pendingProjects = projects.filter(p => p.status === 'pending');
      const lostProjects = projects.filter(p => p.status === 'lost');

      const totalValue = projects.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const wonValue = wonProjects.reduce((sum, p) => sum + (p.total_amount || 0), 0);

      const totalCabinets = cabinets.length;
      const totalCabinetQuantity = cabinets.reduce((sum, c) => sum + c.quantity, 0);
      const totalCabinetValue = cabinets.reduce((sum, c) => sum + (c.subtotal || 0), 0);
      const avgCostPerCabinet = totalCabinets > 0 ? totalCabinetValue / totalCabinets : 0;

      setStats({
        totalProjects: projects.length,
        wonProjects: wonProjects.length,
        pendingProjects: pendingProjects.length,
        lostProjects: lostProjects.length,
        totalValue,
        wonValue,
        totalProducts: productsRes.count || 0,
        totalPriceItems: pricesRes.count || 0,
        totalCabinets,
        totalCabinetQuantity,
        avgCostPerCabinet,
        totalCabinetValue,
      });

      const monthlyMap = new Map<string, MonthlyData>();

      projects.forEach(project => {
        const date = new Date(project.quote_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, {
            month: monthName,
            year: date.getFullYear(),
            totalProjects: 0,
            wonProjects: 0,
            totalValue: 0,
            wonValue: 0,
          });
        }

        const monthData = monthlyMap.get(monthKey)!;
        monthData.totalProjects += 1;
        monthData.totalValue += project.total_amount || 0;

        if (project.status === 'won') {
          monthData.wonProjects += 1;
          monthData.wonValue += project.total_amount || 0;
        }
      });

      const sortedMonthly = Array.from(monthlyMap.values())
        .sort((a, b) => {
          const dateA = new Date(a.month);
          const dateB = new Date(b.month);
          return dateA.getTime() - dateB.getTime();
        })
        .slice(-6);

      setMonthlyData(sortedMonthly);

      const typeStatsMap = new Map<string, ProjectTypeStats>();
      const projectTypes = ['Custom', 'Bids', 'Prefab', 'Stores'];

      projectTypes.forEach(type => {
        const typeProjects = projects.filter(p => p.project_type === type);
        const typeWonProjects = typeProjects.filter(p => p.status === 'won');
        const typeTotalValue = typeProjects.reduce((sum, p) => sum + (p.total_amount || 0), 0);
        const typeWonValue = typeWonProjects.reduce((sum, p) => sum + (p.total_amount || 0), 0);
        const conversionRate = typeProjects.length > 0
          ? (typeWonProjects.length / typeProjects.length) * 100
          : 0;

        typeStatsMap.set(type, {
          projectType: type,
          totalProjects: typeProjects.length,
          wonProjects: typeWonProjects.length,
          totalValue: typeTotalValue,
          wonValue: typeWonValue,
          conversionRate,
        });
      });

      setProjectTypeStats(Array.from(typeStatsMap.values()).filter(stat => stat.totalProjects > 0));

      setRecentProjects(recentRes.data || []);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTrends() {
    try {
      const topCabinetsQuery = await supabase.rpc('get_top_cabinets', { limit_count: 5 });

      if (topCabinetsQuery.data) {
        setTopCabinets(topCabinetsQuery.data);
      } else {
        await loadTopCabinetsManually();
      }

      const doorMaterialsQuery = await supabase.rpc('get_door_material_trends', { limit_count: 5 });

      if (doorMaterialsQuery.data) {
        setDoorMaterialTrends(doorMaterialsQuery.data);
      } else {
        await loadDoorMaterialsManually();
      }

      const boxMaterialsQuery = await supabase.rpc('get_box_material_trends', { limit_count: 5 });

      if (boxMaterialsQuery.data) {
        setBoxMaterialTrends(boxMaterialsQuery.data);
      } else {
        await loadBoxMaterialsManually();
      }

      await loadHardwareTrendsManually();

    } catch (error) {
      console.error('Error loading trends:', error);
      await loadTrendsManually();
    }
  }

  async function loadTopCabinetsManually() {
    try {
      const { data: currentVersions } = await supabase
        .from('project_versions')
        .select('id')
        .eq('is_current', true);

      if (!currentVersions || currentVersions.length === 0) return;

      const versionIds = currentVersions.map(v => v.id);

      const { data: cabinets } = await supabase
        .from('version_area_cabinets')
        .select('product_sku, product_description, quantity, area_id')
        .in('area_id',
          (await supabase
            .from('version_project_areas')
            .select('id')
            .in('version_id', versionIds)
          ).data?.map(a => a.id) || []
        );

      if (!cabinets) return;

      const cabinetMap = new Map<string, { description: string; totalQty: number; count: number }>();

      cabinets.forEach(cabinet => {
        const sku = cabinet.product_sku;
        if (!sku) return;

        if (sku.includes('460')) return;

        if (!cabinetMap.has(sku)) {
          cabinetMap.set(sku, {
            description: cabinet.product_description || sku,
            totalQty: 0,
            count: 0,
          });
        }

        const entry = cabinetMap.get(sku)!;
        entry.totalQty += cabinet.quantity || 0;
        entry.count += 1;
      });

      const topCabs: TopCabinet[] = Array.from(cabinetMap.entries())
        .map(([sku, data]) => ({
          product_sku: sku,
          product_description: data.description,
          total_quantity: data.totalQty,
          times_quoted: data.count,
          avg_quantity: data.count > 0 ? data.totalQty / data.count : 0,
        }))
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, 5);

      setTopCabinets(topCabs);
    } catch (error) {
      console.error('Error loading top cabinets manually:', error);
    }
  }

  async function loadDoorMaterialsManually() {
    try {
      const { data: currentVersions } = await supabase
        .from('project_versions')
        .select('id')
        .eq('is_current', true);

      if (!currentVersions || currentVersions.length === 0) return;

      const versionIds = currentVersions.map(v => v.id);

      const { data: areas } = await supabase
        .from('version_project_areas')
        .select('id')
        .in('version_id', versionIds);

      if (!areas || areas.length === 0) return;

      const areaIds = areas.map(a => a.id);

      const { data: cabinets } = await supabase
        .from('version_area_cabinets')
        .select('doors_material_id, product_sku')
        .in('area_id', areaIds);

      if (!cabinets) return;

      const filteredCabinets = cabinets.filter(c => !c.product_sku?.includes('460'));

      const materialIds = [...new Set(filteredCabinets.map(c => c.doors_material_id).filter(Boolean))];

      if (materialIds.length === 0) return;

      const { data: materials } = await supabase
        .from('price_list')
        .select('id, concept_description')
        .in('id', materialIds);

      const materialNameMap = new Map(materials?.map(m => [m.id, m.concept_description]) || []);
      const materialMap = new Map<string, { name: string; count: number }>();

      filteredCabinets.forEach(cabinet => {
        const id = cabinet.doors_material_id;
        if (!id) return;

        if (!materialMap.has(id)) {
          materialMap.set(id, {
            name: materialNameMap.get(id) || 'Unknown Material',
            count: 0,
          });
        }

        materialMap.get(id)!.count += 1;
      });

      const total = filteredCabinets.filter(c => c.doors_material_id).length;
      const trends: MaterialTrend[] = Array.from(materialMap.entries())
        .map(([id, data]) => ({
          material_id: id,
          material_name: data.name,
          usage_count: data.count,
          percentage: total > 0 ? (data.count / total) * 100 : 0,
        }))
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 5);

      setDoorMaterialTrends(trends);
    } catch (error) {
      console.error('Error loading door materials manually:', error);
    }
  }

  async function loadBoxMaterialsManually() {
    try {
      const { data: currentVersions } = await supabase
        .from('project_versions')
        .select('id')
        .eq('is_current', true);

      if (!currentVersions || currentVersions.length === 0) return;

      const versionIds = currentVersions.map(v => v.id);

      const { data: areas } = await supabase
        .from('version_project_areas')
        .select('id')
        .in('version_id', versionIds);

      if (!areas || areas.length === 0) return;

      const areaIds = areas.map(a => a.id);

      const { data: cabinets } = await supabase
        .from('version_area_cabinets')
        .select('box_material_id, product_sku')
        .in('area_id', areaIds);

      if (!cabinets) return;

      const filteredCabinets = cabinets.filter(c => !c.product_sku?.includes('460'));

      const materialIds = [...new Set(filteredCabinets.map(c => c.box_material_id).filter(Boolean))];

      if (materialIds.length === 0) return;

      const { data: materials } = await supabase
        .from('price_list')
        .select('id, concept_description')
        .in('id', materialIds);

      const materialNameMap = new Map(materials?.map(m => [m.id, m.concept_description]) || []);
      const materialMap = new Map<string, { name: string; count: number }>();

      filteredCabinets.forEach(cabinet => {
        const id = cabinet.box_material_id;
        if (!id) return;

        if (!materialMap.has(id)) {
          materialMap.set(id, {
            name: materialNameMap.get(id) || 'Unknown Material',
            count: 0,
          });
        }

        materialMap.get(id)!.count += 1;
      });

      const total = filteredCabinets.filter(c => c.box_material_id).length;
      const trends: MaterialTrend[] = Array.from(materialMap.entries())
        .map(([id, data]) => ({
          material_id: id,
          material_name: data.name,
          usage_count: data.count,
          percentage: total > 0 ? (data.count / total) * 100 : 0,
        }))
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 5);

      setBoxMaterialTrends(trends);
    } catch (error) {
      console.error('Error loading box materials manually:', error);
    }
  }

  async function loadHardwareTrendsManually() {
    try {
      const { data: currentVersions } = await supabase
        .from('project_versions')
        .select('id')
        .eq('is_current', true);

      if (!currentVersions || currentVersions.length === 0) return;

      const versionIds = currentVersions.map(v => v.id);

      const { data: areas } = await supabase
        .from('version_project_areas')
        .select('id')
        .in('version_id', versionIds);

      if (!areas || areas.length === 0) return;

      const areaIds = areas.map(a => a.id);

      const { data: cabinets } = await supabase
        .from('version_area_cabinets')
        .select('hardware, product_sku')
        .in('area_id', areaIds);

      if (!cabinets) return;

      const filteredCabinets = cabinets.filter(c => !c.product_sku?.includes('460'));

      const hardwareIds = new Set<string>();
      filteredCabinets.forEach(cabinet => {
        const hardware = cabinet.hardware as any[];
        if (!hardware || !Array.isArray(hardware)) return;
        hardware.forEach((hw: any) => {
          if (hw.hardware_id) hardwareIds.add(hw.hardware_id);
        });
      });

      if (hardwareIds.size === 0) return;

      const { data: hardwareItems } = await supabase
        .from('price_list')
        .select('id, concept_description')
        .in('id', Array.from(hardwareIds));

      const hardwareNameMap = new Map(hardwareItems?.map(h => [h.id, h.concept_description]) || []);
      const hardwareMap = new Map<string, { name: string; count: number; totalQty: number }>();

      filteredCabinets.forEach(cabinet => {
        const hardware = cabinet.hardware as any[];
        if (!hardware || !Array.isArray(hardware)) return;

        hardware.forEach((hw: any) => {
          const id = hw.hardware_id;
          if (!id) return;

          const name = hardwareNameMap.get(id) || 'Unknown Hardware';
          const qty = hw.quantity_per_cabinet || 0;

          if (!hardwareMap.has(id)) {
            hardwareMap.set(id, { name, count: 0, totalQty: 0 });
          }

          const entry = hardwareMap.get(id)!;
          entry.count += 1;
          entry.totalQty += qty;
        });
      });

      const trends: HardwareTrend[] = Array.from(hardwareMap.entries())
        .map(([id, data]) => ({
          hardware_name: data.name,
          usage_count: data.count,
          total_quantity: data.totalQty,
        }))
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 5);

      setHardwareTrends(trends);
    } catch (error) {
      console.error('Error loading hardware trends manually:', error);
    }
  }

  async function loadTrendsManually() {
    await Promise.all([
      loadTopCabinetsManually(),
      loadDoorMaterialsManually(),
      loadBoxMaterialsManually(),
      loadHardwareTrendsManually(),
    ]);
  }

  const conversionRate = stats.totalProjects > 0
    ? (stats.wonProjects / stats.totalProjects) * 100
    : 0;

  const currentMonthData = monthlyData[monthlyData.length - 1];
  const currentMonthConversion = currentMonthData && currentMonthData.totalProjects > 0
    ? (currentMonthData.wonProjects / currentMonthData.totalProjects) * 100
    : 0;

  const maxProjects = Math.max(...monthlyData.map(m => m.totalProjects), 1);
  const maxValue = Math.max(...monthlyData.map(m => m.totalValue), 1);

  const statCards = [
    {
      label: 'Total Conversion Rate',
      value: `${conversionRate.toFixed(1)}%`,
      subtext: `${stats.wonProjects} won / ${stats.totalProjects} total`,
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      label: 'Total Cabinets',
      value: `${stats.totalCabinets}`,
      subtext: `${stats.totalCabinetQuantity} units quoted`,
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      label: 'Avg Cost per Cabinet',
      value: formatCurrency(stats.avgCostPerCabinet),
      subtext: `${stats.totalCabinets} cabinets total`,
      icon: BarChart3,
      color: 'bg-purple-500',
    },
    {
      label: 'Total Quoted Value',
      value: formatCurrency(stats.totalValue),
      subtext: `${stats.totalProjects} projects`,
      icon: DollarSign,
      color: 'bg-amber-500',
    },
    {
      label: 'Won Value',
      value: formatCurrency(stats.wonValue),
      subtext: `${stats.wonProjects} projects won`,
      icon: CheckCircle2,
      color: 'bg-emerald-500',
    },
  ];

  const statusCards = [
    {
      label: 'Won',
      value: stats.wonProjects,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Pending',
      value: stats.pendingProjects,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Lost',
      value: stats.lostProjects,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  async function handleSeedData() {
    if (!confirm('This will add sample products and prices to test the system. Continue?')) return;
    const success = await seedSampleData();
    if (success) {
      alert('Sample data added successfully!');
      loadStats();
    } else {
      alert('Failed to add sample data. Check console for errors.');
    }
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-2 text-slate-600">
            Performance metrics and conversion analytics
          </p>
        </div>
        {stats.totalProducts === 0 && stats.totalPriceItems === 0 && (
          <Button onClick={handleSeedData} variant="secondary">
            <Database className="h-4 w-4 mr-2" />
            Load Sample Data
          </Button>
        )}
      </div>

      <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <FolderOpen className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-slate-900">Recent Projects</h2>
          </div>
          <button
            onClick={() => onNavigate('projects')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
          >
            View all
            <ArrowRight className="h-4 w-4 ml-1" />
          </button>
        </div>
        {recentProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentProjects.map((project) => {
              const statusColors = {
                won: 'bg-green-100 text-green-700 border-green-200',
                pending: 'bg-blue-100 text-blue-700 border-blue-200',
                lost: 'bg-red-100 text-red-700 border-red-200',
              };

              return (
                <div
                  key={project.id}
                  onClick={() => onNavigateToProject(project.id)}
                  className="group p-4 rounded-lg border-2 border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all bg-white"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-900 truncate flex-1 mr-2">
                      {project.name}
                    </h3>
                    <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium capitalize border ${
                        statusColors[project.status as keyof typeof statusColors]
                      }`}
                    >
                      {project.status}
                    </span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {project.project_type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {new Date(project.quote_date).toLocaleDateString()}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {formatCurrency(project.total_amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No projects yet</p>
            <button
              onClick={() => onNavigate('projects')}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first project
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600">{card.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {card.value}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{card.subtext}</p>
                </div>
                <div className={`${card.color} rounded-lg p-3`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Project Status</h2>
          <div className="space-y-3">
            {statusCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className={`${card.bgColor} rounded-lg p-4 flex items-center justify-between`}
                >
                  <div className="flex items-center">
                    <Icon className={`h-5 w-5 ${card.color}`} />
                    <span className={`ml-3 font-medium ${card.color}`}>
                      {card.label}
                    </span>
                  </div>
                  <span className={`text-2xl font-bold ${card.color}`}>
                    {card.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Monthly Projects (Last 6 Months)
          </h2>
          {monthlyData.length > 0 ? (
            <div className="space-y-4">
              {monthlyData.map((data) => {
                const percentage = (data.totalProjects / maxProjects) * 100;
                const convRate = data.totalProjects > 0
                  ? (data.wonProjects / data.totalProjects) * 100
                  : 0;

                return (
                  <div key={data.month}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        {data.month}
                      </span>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-slate-500">
                          {data.wonProjects}/{data.totalProjects} projects
                        </span>
                        <span className="text-sm font-semibold text-green-600">
                          {convRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="relative h-8 bg-slate-100 rounded-lg overflow-hidden">
                      <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-lg transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                      <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 to-green-500 rounded-lg transition-all duration-500"
                        style={{ width: `${(data.wonProjects / maxProjects) * 100}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-slate-700">
                          {data.totalProjects} total
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              No project data available yet
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Monthly Quoted Value (Last 6 Months)
        </h2>
        {monthlyData.length > 0 ? (
          <div className="space-y-4">
            {monthlyData.map((data) => {
              const percentage = (data.totalValue / maxValue) * 100;
              const wonPercentage = (data.wonValue / maxValue) * 100;

              return (
                <div key={`value-${data.month}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">
                      {data.month}
                    </span>
                    <div className="flex items-center space-x-4">
                      <span className="text-xs text-slate-500">
                        Total: {formatCurrency(data.totalValue)}
                      </span>
                      <span className="text-xs font-semibold text-green-600">
                        Won: {formatCurrency(data.wonValue)}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-10 bg-slate-100 rounded-lg overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-slate-300 to-slate-400 rounded-lg transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-lg transition-all duration-500"
                      style={{ width: `${wonPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            No value data available yet
          </div>
        )}
      </div>

      {(topCabinets.length > 0 || doorMaterialTrends.length > 0 || boxMaterialTrends.length > 0 || hardwareTrends.length > 0) && (
        <div className="mt-6 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center">
            <TrendingUp className="h-6 w-6 text-blue-600 mr-3" />
            Quotation Trends & Analytics
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {topCabinets.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center mb-4">
                  <Package className="h-5 w-5 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-slate-900">Top 5 Most Quoted Cabinets</h3>
                </div>
                <div className="space-y-3">
                  {topCabinets.map((cabinet, index) => (
                    <div
                      key={cabinet.product_sku}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mr-3 ${
                          index === 0 ? 'bg-amber-500 text-white' :
                          index === 1 ? 'bg-slate-400 text-white' :
                          index === 2 ? 'bg-orange-600 text-white' :
                          'bg-slate-300 text-slate-700'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900 text-sm">
                            {cabinet.product_sku}
                          </div>
                          <div className="text-xs text-slate-600 truncate">
                            {cabinet.product_description}
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-3">
                        <div className="text-lg font-bold text-blue-600">
                          {cabinet.total_quantity}
                        </div>
                        <div className="text-xs text-slate-500">
                          {cabinet.times_quoted} {cabinet.times_quoted === 1 ? 'quote' : 'quotes'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {doorMaterialTrends.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center mb-4">
                  <Package className="h-5 w-5 text-purple-600 mr-2" />
                  <h3 className="text-lg font-semibold text-slate-900">Popular Door Materials</h3>
                </div>
                <div className="space-y-3">
                  {doorMaterialTrends.map((material, index) => (
                    <div key={material.material_id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 truncate flex-1">
                          {material.material_name}
                        </span>
                        <div className="flex items-center ml-3">
                          <span className="text-sm font-bold text-purple-600">
                            {material.percentage.toFixed(1)}%
                          </span>
                          <span className="text-xs text-slate-500 ml-2">
                            ({material.usage_count})
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            index === 0 ? 'bg-purple-600' :
                            index === 1 ? 'bg-purple-500' :
                            index === 2 ? 'bg-purple-400' :
                            'bg-purple-300'
                          }`}
                          style={{ width: `${material.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {boxMaterialTrends.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center mb-4">
                  <Package className="h-5 w-5 text-orange-600 mr-2" />
                  <h3 className="text-lg font-semibold text-slate-900">Popular Box Materials</h3>
                </div>
                <div className="space-y-3">
                  {boxMaterialTrends.map((material, index) => (
                    <div key={material.material_id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 truncate flex-1">
                          {material.material_name}
                        </span>
                        <div className="flex items-center ml-3">
                          <span className="text-sm font-bold text-orange-600">
                            {material.percentage.toFixed(1)}%
                          </span>
                          <span className="text-xs text-slate-500 ml-2">
                            ({material.usage_count})
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            index === 0 ? 'bg-orange-600' :
                            index === 1 ? 'bg-orange-500' :
                            index === 2 ? 'bg-orange-400' :
                            'bg-orange-300'
                          }`}
                          style={{ width: `${material.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hardwareTrends.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center mb-4">
                  <Package className="h-5 w-5 text-teal-600 mr-2" />
                  <h3 className="text-lg font-semibold text-slate-900">Most Used Hardware</h3>
                </div>
                <div className="space-y-3">
                  {hardwareTrends.map((hardware, index) => (
                    <div
                      key={hardware.hardware_name}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50"
                    >
                      <div className="flex items-center flex-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs mr-3 ${
                          index === 0 ? 'bg-teal-600 text-white' :
                          index === 1 ? 'bg-teal-500 text-white' :
                          'bg-teal-400 text-white'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="text-sm font-medium text-slate-700 truncate">
                          {hardware.hardware_name}
                        </span>
                      </div>
                      <div className="text-right ml-3">
                        <div className="text-lg font-bold text-teal-600">
                          {hardware.usage_count}
                        </div>
                        <div className="text-xs text-slate-500">
                          {hardware.total_quantity} total
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <MaterialBreakdownByArea />
      </div>

      {projectTypeStats.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center mb-4">
            <Tag className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-slate-900">Project Type Analytics</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {projectTypeStats.map((typeData) => {
              const typeColors: Record<string, string> = {
                Custom: 'from-blue-500 to-blue-600',
                Bids: 'from-purple-500 to-purple-600',
                Prefab: 'from-orange-500 to-orange-600',
                Stores: 'from-teal-500 to-teal-600',
              };

              return (
                <div
                  key={typeData.projectType}
                  className={`bg-gradient-to-br ${typeColors[typeData.projectType]} rounded-lg p-5 text-white`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide">
                      {typeData.projectType}
                    </h3>
                    <Tag className="h-4 w-4 opacity-70" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs opacity-90">Projects</span>
                      <span className="text-2xl font-bold">{typeData.totalProjects}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs opacity-90">Won</span>
                      <span className="text-lg font-semibold">{typeData.wonProjects}</span>
                    </div>
                    <div className="pt-2 border-t border-white/30">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs opacity-90">Conversion</span>
                        <span className="text-xl font-bold">{typeData.conversionRate.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="pt-2">
                      <div className="text-xs opacity-90">Total Value</div>
                      <div className="text-lg font-bold">{formatCurrency(typeData.totalValue)}</div>
                    </div>
                    <div>
                      <div className="text-xs opacity-90">Won Value</div>
                      <div className="text-base font-semibold">{formatCurrency(typeData.wonValue)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Catalog Status</h2>
            <Package className="h-5 w-5 text-slate-400" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Products in Catalog</span>
              <span className="text-2xl font-bold text-slate-900">{stats.totalProducts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Price List Items</span>
              <span className="text-2xl font-bold text-slate-900">{stats.totalPriceItems}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
          <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
          <p className="text-sm text-blue-100 mb-4">
            Get started with your quotation system
          </p>
          <div className="space-y-2">
            <button
              onClick={() => onNavigate('projects')}
              className="w-full text-left bg-white/20 hover:bg-white/30 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Create New Project
            </button>
            <button
              onClick={() => onNavigate('products')}
              className="w-full text-left bg-white/20 hover:bg-white/30 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Manage Products
            </button>
            <button
              onClick={() => onNavigate('prices')}
              className="w-full text-left bg-white/20 hover:bg-white/30 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Update Prices
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
