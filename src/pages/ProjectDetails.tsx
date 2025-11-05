import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Copy, Printer, BarChart3, Package, Truck, DollarSign, ListPlus, Calculator, Receipt, TrendingUp, Save, Hammer, RefreshCw, Search, X, Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { formatCurrency } from '../lib/calculations';
import type { Project, ProjectArea, AreaCabinet, ProjectAreaInsert, Product, AreaItem, AreaCountertop, PriceListItem } from '../types';
import { CabinetForm } from '../components/CabinetForm';
import { ItemForm } from '../components/ItemForm';
import { CountertopForm } from '../components/CountertopForm';
import { CabinetCard } from '../components/CabinetCard';
import { MaterialBreakdown } from '../components/MaterialBreakdown';
import { AreaMaterialBreakdown } from '../components/AreaMaterialBreakdown';
import { ProjectCharts } from '../components/ProjectCharts';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { printQuotation } from '../utils/printQuotation';
import { BoxesPalletsBreakdown } from '../components/BoxesPalletsBreakdown';
import { calculateAreaBoxesAndPallets } from '../lib/boxesAndPallets';
import { getSettings } from '../lib/settingsStore';
import { recalculateAreaEdgebandCosts } from '../lib/edgebandRolls';
import { recalculateAreaSheetMaterialCosts } from '../lib/sheetMaterials';
import { VersionManager } from '../components/VersionManager';
import { VersionComparison } from '../components/VersionComparison';
import { SaveTemplateModal } from '../components/SaveTemplateModal';
import { BulkMaterialChangeModal } from '../components/BulkMaterialChangeModal';
import { createTemplateFromCabinet } from '../lib/templateManager';
import { countActualCabinets, countCabinetEntries } from '../lib/cabinetFilters';
import { downloadAreasCSV, downloadDetailedAreasCSV } from '../utils/exportAreasCSV';
import {
  getCurrentVersion,
  getVersionData,
  addVersionArea,
  deleteVersionArea,
  duplicateVersionCabinet,
  deleteVersionCabinet,
  deleteVersionItem,
  recalculateVersionTotal,
} from '../lib/versioningSystem';

interface ProjectDetailsProps {
  project: Project;
  onBack: () => void;
}

export function ProjectDetails({ project, onBack }: ProjectDetailsProps) {
  const [areas, setAreas] = useState<(ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[] })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<ProjectArea | null>(null);
  const [selectedAreaForCabinet, setSelectedAreaForCabinet] = useState<string | null>(null);
  const [editingCabinet, setEditingCabinet] = useState<AreaCabinet | null>(null);
  const [selectedAreaForItem, setSelectedAreaForItem] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<AreaItem | null>(null);
  const [selectedAreaForCountertop, setSelectedAreaForCountertop] = useState<string | null>(null);
  const [editingCountertop, setEditingCountertop] = useState<AreaCountertop | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [currencyDisplay, setCurrencyDisplay] = useState<'USD' | 'MXN' | 'BOTH'>('MXN');
  const [exchangeRate, setExchangeRate] = useState(18);
  const [otherExpenses, setOtherExpenses] = useState(project.other_expenses || 0);
  const [tariffPercentage, setTariffPercentage] = useState(project.tariff_percentage || 0);
  const [taxesPercentage, setTaxesPercentage] = useState(project.taxes_percentage || 0);
  const [installDelivery, setInstallDelivery] = useState(project.install_delivery || 0);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [compareVersions, setCompareVersions] = useState<{ v1: string; v2: string } | null>(null);
  const [savingTemplateCabinet, setSavingTemplateCabinet] = useState<AreaCabinet | null>(null);
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [areaMaterialsVisible, setAreaMaterialsVisible] = useState<Record<string, boolean>>({});
  const [isBulkMaterialChangeOpen, setIsBulkMaterialChangeOpen] = useState(false);
  const [bulkChangePreselectedAreaId, setBulkChangePreselectedAreaId] = useState<string | undefined>();
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  useEffect(() => {
    loadCurrentVersion();
  }, [project.id]);

  async function loadCurrentVersion() {
    try {
      const version = await getCurrentVersion(project.id);
      if (version) {
        setCurrentVersionId(version.id);
        await loadVersionAreas(version.id);
      } else {
        await loadAreas();
      }
    } catch (error) {
      console.error('Error loading version:', error);
      await loadAreas();
    }
  }

  async function loadVersionAreas(versionId: string) {
    try {
      const [areasData, productsResult, settingsData] = await Promise.all([
        getVersionData(versionId),
        supabase.from('products_catalog').select('*'),
        getSettings(),
      ]);

      setProducts(productsResult.data || []);
      setExchangeRate(settingsData.exchangeRateUsdToMxn);
      setAreas(areasData as any);
    } catch (error) {
      console.error('Error loading version areas:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleVersionChange(versionId: string) {
    setCurrentVersionId(versionId);
    setLoading(true);
    loadVersionAreas(versionId);
  }

  function handleCompareVersions(versionId1: string, versionId2: string) {
    setCompareVersions({ v1: versionId1, v2: versionId2 });
  }

  async function loadAreas() {
    try {
      const [areasResult, productsResult, priceListResult, settingsData] = await Promise.all([
        supabase
          .from('project_areas')
          .select('*')
          .eq('project_id', project.id)
          .order('display_order'),
        supabase.from('products_catalog').select('*'),
        supabase.from('price_list').select('*').eq('is_active', true),
        getSettings(),
      ]);

      const { data: areasData, error: areasError } = areasResult;
      if (areasError) throw areasError;

      setProducts(productsResult.data || []);
      setPriceList(priceListResult.data || []);
      setExchangeRate(settingsData.exchangeRateUsdToMxn);

      const areasWithCabinetsAndItems = await Promise.all(
        (areasData || []).map(async (area) => {
          const [cabinetsResult, itemsResult, countertopsResult] = await Promise.all([
            supabase
              .from('area_cabinets')
              .select('*')
              .eq('area_id', area.id)
              .order('created_at'),
            supabase
              .from('area_items')
              .select('*')
              .eq('area_id', area.id)
              .order('created_at'),
            supabase
              .from('area_countertops')
              .select('*')
              .eq('area_id', area.id)
              .order('created_at'),
          ]);

          return {
            ...area,
            cabinets: cabinetsResult.data || [],
            items: itemsResult.data || [],
            countertops: countertopsResult.data || [],
          };
        })
      );

      setAreas(areasWithCabinetsAndItems);
      await updateProjectTotal(areasWithCabinetsAndItems);
    } catch (error) {
      console.error('Error loading areas:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateProjectTotal(areasData: (ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[] })[]) {
    const total = areasData.reduce((sum, area) => {
      const cabinetsTotal = area.cabinets.reduce((s, c) => s + c.subtotal, 0);
      const itemsTotal = area.items.reduce((s, i) => s + i.subtotal, 0);
      const countertopsTotal = area.countertops.reduce((s, ct) => s + ct.subtotal, 0);
      return sum + cabinetsTotal + itemsTotal + countertopsTotal;
    }, 0);

    try {
      await supabase
        .from('projects')
        .update({ total_amount: total })
        .eq('id', project.id);

      for (const area of areasData) {
        const cabinetsTotal = area.cabinets.reduce((s, c) => s + c.subtotal, 0);
        const itemsTotal = area.items.reduce((s, i) => s + i.subtotal, 0);
        const countertopsTotal = area.countertops.reduce((s, ct) => s + ct.subtotal, 0);
        const areaTotal = cabinetsTotal + itemsTotal + countertopsTotal;
        await supabase
          .from('project_areas')
          .update({ subtotal: areaTotal })
          .eq('id', area.id);
      }
    } catch (error) {
      console.error('Error updating totals:', error);
    }
  }

  async function handleSaveArea(areaData: ProjectAreaInsert) {
    try {
      const tableName = currentVersionId ? 'version_project_areas' : 'project_areas';
      const refField = currentVersionId ? { version_id: currentVersionId } : { project_id: project.id };

      if (editingArea) {
        const { error } = await supabase
          .from(tableName)
          .update(areaData)
          .eq('id', editingArea.id);

        if (error) throw error;
      } else {
        const maxOrder = Math.max(...areas.map((a) => a.display_order), -1);
        const { error } = await supabase.from(tableName).insert([
          {
            ...areaData,
            ...refField,
            display_order: maxOrder + 1,
          },
        ]);

        if (error) throw error;
      }

      if (currentVersionId) {
        await loadVersionAreas(currentVersionId);
      } else {
        await loadAreas();
      }
      setIsAreaModalOpen(false);
      setEditingArea(null);
    } catch (error) {
      console.error('Error saving area:', error);
      alert('Failed to save area');
    }
  }

  async function handleDeleteArea(area: ProjectArea) {
    if (!confirm(`Delete area "${area.name}" and all its cabinets?`)) return;

    try {
      const tableName = currentVersionId ? 'version_project_areas' : 'project_areas';
      const { error } = await supabase.from(tableName).delete().eq('id', area.id);

      if (error) throw error;

      if (currentVersionId) {
        await loadVersionAreas(currentVersionId);
      } else {
        await loadAreas();
      }
    } catch (error) {
      console.error('Error deleting area:', error);
      alert('Failed to delete area');
    }
  }

  async function handleDeleteCabinet(cabinet: AreaCabinet) {
    if (!confirm('Delete this cabinet?')) return;

    try {
      if (currentVersionId) {
        await deleteVersionCabinet(cabinet.id);
        await recalculateVersionTotal(currentVersionId);
        await loadVersionAreas(currentVersionId);
      } else {
        const areaId = cabinet.area_id;
        const { error } = await supabase
          .from('area_cabinets')
          .delete()
          .eq('id', cabinet.id);

        if (error) throw error;

        await recalculateAreaSheetMaterialCosts(areaId);
        await recalculateAreaEdgebandCosts(areaId);
        await loadAreas();
      }
    } catch (error) {
      console.error('Error deleting cabinet:', error);
      alert('Failed to delete cabinet');
    }
  }

  async function handleDuplicateCabinet(cabinet: AreaCabinet) {
    try {
      if (currentVersionId) {
        await duplicateVersionCabinet(cabinet.id);
        await recalculateVersionTotal(currentVersionId);
        await loadVersionAreas(currentVersionId);
      } else {
        const { id, created_at, ...cabinetData } = cabinet;
        const { error } = await supabase.from('area_cabinets').insert([cabinetData]);

        if (error) throw error;
        await loadAreas();
      }
    } catch (error) {
      console.error('Error duplicating cabinet:', error);
      alert('Failed to duplicate cabinet');
    }
  }

  function handleAddCabinet(areaId: string) {
    setSelectedAreaForCabinet(areaId);
    setEditingCabinet(null);
  }

  function handleEditCabinet(cabinet: AreaCabinet) {
    setSelectedAreaForCabinet(cabinet.area_id);
    setEditingCabinet(cabinet);
  }

  async function handleCloseCabinetForm() {
    setSelectedAreaForCabinet(null);
    setEditingCabinet(null);
    if (currentVersionId) {
      await recalculateVersionTotal(currentVersionId);
      await loadVersionAreas(currentVersionId);
    } else {
      await loadAreas();
    }
  }

  function handleEditItem(item: AreaItem) {
    setSelectedAreaForItem(item.area_id);
    setEditingItem(item);
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      if (currentVersionId) {
        await deleteVersionItem(itemId);
        await recalculateVersionTotal(currentVersionId);
        await loadVersionAreas(currentVersionId);
      } else {
        const { error } = await supabase.from('area_items').delete().eq('id', itemId);

        if (error) throw error;
        await loadAreas();
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  }

  async function handleDeleteCountertop(countertopId: string) {
    if (!confirm('Are you sure you want to delete this countertop?')) return;

    try {
      if (currentVersionId) {
        const { error } = await supabase.from('version_area_countertops').delete().eq('id', countertopId);
        if (error) throw error;
        await recalculateVersionTotal(currentVersionId);
        await loadVersionAreas(currentVersionId);
      } else {
        const { error } = await supabase.from('area_countertops').delete().eq('id', countertopId);
        if (error) throw error;
        await loadAreas();
      }
    } catch (error) {
      console.error('Error deleting countertop:', error);
      alert('Failed to delete countertop');
    }
  }

  async function handleCloseItemForm() {
    setSelectedAreaForItem(null);
    setEditingItem(null);
    if (currentVersionId) {
      await recalculateVersionTotal(currentVersionId);
      await loadVersionAreas(currentVersionId);
    } else {
      await loadAreas();
    }
  }

  async function handleCloseCountertopForm() {
    setSelectedAreaForCountertop(null);
    setEditingCountertop(null);
    if (currentVersionId) {
      await recalculateVersionTotal(currentVersionId);
      await loadVersionAreas(currentVersionId);
    } else {
      await loadAreas();
    }
  }

  function handleSaveAsTemplate(cabinet: AreaCabinet) {
    setSavingTemplateCabinet(cabinet);
  }

  async function handleCreateTemplate(name: string, description: string, category: string) {
    if (!savingTemplateCabinet) return;

    try {
      const product = products.find(p => p.sku === savingTemplateCabinet.product_sku);
      if (!product) {
        throw new Error('Product not found');
      }

      await createTemplateFromCabinet(
        savingTemplateCabinet,
        product,
        priceList,
        name,
        description,
        category
      );

      alert('Template saved successfully!');
    } catch (error: any) {
      throw error;
    }
  }

  async function handlePrint() {
    await printQuotation(project, areas, products);
  }

  async function handleSaveChanges() {
    try {
      if (currentVersionId) {
        await recalculateVersionTotal(currentVersionId);
        await loadVersionAreas(currentVersionId);
      } else {
        await loadAreas();
      }
      alert('Changes saved successfully');
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes');
    }
  }

  function handleExportAreasCSV() {
    if (areas.length === 0) {
      alert('No areas to export');
      return;
    }
    downloadAreasCSV(areas, project.name);
  }

  function handleExportDetailedAreasCSV() {
    if (areas.length === 0) {
      alert('No areas to export');
      return;
    }
    downloadDetailedAreasCSV(areas, project.name);
  }

  const cabinetsSubtotal = areas.reduce(
    (sum, area) => sum + area.cabinets.reduce((s, c) => s + c.subtotal, 0),
    0
  );

  const itemsSubtotal = areas.reduce(
    (sum, area) => sum + area.items.reduce((s, i) => s + i.subtotal, 0),
    0
  );

  const countertopsSubtotal = areas.reduce(
    (sum, area) => sum + area.countertops.reduce((s, ct) => s + ct.subtotal, 0),
    0
  );

  const materialsSubtotal = cabinetsSubtotal + itemsSubtotal + countertopsSubtotal;

  const subtotalBeforeTariff = materialsSubtotal + otherExpenses + installDelivery;
  const tariffAmount = (subtotalBeforeTariff * tariffPercentage) / 100;
  const subtotalWithTariff = subtotalBeforeTariff + tariffAmount;
  const taxesAmount = (subtotalWithTariff * taxesPercentage) / 100;
  const projectTotal = subtotalWithTariff + taxesAmount;

  const formatPrice = (amount: number) => {
    const amountInUSD = amount / exchangeRate;
    const formattedUSD = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountInUSD);
    const formattedMXN = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    if (currencyDisplay === 'USD') {
      return `$${formattedUSD} USD`;
    } else if (currencyDisplay === 'MXN') {
      return `$${formattedMXN} MXN`;
    } else {
      return `$${formattedUSD} USD / $${formattedMXN} MXN`;
    }
  };

  async function updateProjectCosts() {
    try {
      await supabase
        .from('projects')
        .update({
          other_expenses: otherExpenses,
          tariff_percentage: tariffPercentage,
          taxes_percentage: taxesPercentage,
          install_delivery: installDelivery,
          total_amount: projectTotal,
        })
        .eq('id', project.id);
    } catch (error) {
      console.error('Error updating project costs:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading project details...</div>
      </div>
    );
  }

  return (
    <div>
      {compareVersions && (
        <VersionComparison
          versionId1={compareVersions.v1}
          versionId2={compareVersions.v2}
          onClose={() => setCompareVersions(null)}
        />
      )}

      <div className="mb-6">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm mb-6">
          <div className="mb-4">
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{project.name}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block w-fit ${
                  project.status === 'won' ? 'bg-green-100 text-green-700' :
                  project.status === 'pending' ? 'bg-blue-100 text-blue-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {project.status.toUpperCase()}
                </span>
              </div>
              {project.address && (
                <p className="text-slate-600 flex items-center gap-2 text-sm sm:text-base">
                  <span className="text-slate-400">📍</span> {project.address}
                </p>
              )}
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Quote Date: {new Date(project.quote_date).toLocaleDateString()} • Type: {project.project_type}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4">
            <div className="flex flex-col lg:flex-row items-start gap-4">
              <div className="flex-1 w-full">
                <VersionManager
                  projectId={project.id}
                  onVersionChange={handleVersionChange}
                  onCompare={handleCompareVersions}
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 w-full lg:w-auto lg:min-w-[200px]">
                <div className="text-xs text-slate-600 mb-2 font-medium">Display Currency</div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant={currencyDisplay === 'USD' ? 'primary' : 'secondary'}
                    onClick={() => setCurrencyDisplay('USD')}
                    className="flex-1 lg:flex-none"
                  >
                    USD
                  </Button>
                  <Button
                    size="sm"
                    variant={currencyDisplay === 'MXN' ? 'primary' : 'secondary'}
                    onClick={() => setCurrencyDisplay('MXN')}
                    className="flex-1 lg:flex-none"
                  >
                    MXN
                  </Button>
                  <Button
                    size="sm"
                    variant={currencyDisplay === 'BOTH' ? 'primary' : 'secondary'}
                    onClick={() => setCurrencyDisplay('BOTH')}
                    className="flex-1 lg:flex-none"
                  >
                    Both
                  </Button>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">Project Total</div>
                  <div className="text-lg sm:text-xl font-bold text-slate-900">
                    {formatPrice(projectTotal)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {project.project_details && (
            <div className="mt-4 p-4 bg-white border border-slate-200 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Project Notes
              </h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{project.project_details}</p>
            </div>
          )}
        </div>

      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:space-x-3 sm:gap-0">
          <Button onClick={() => setIsAreaModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Area</span>
            <span className="sm:hidden">Area</span>
          </Button>
          <Button variant="secondary" onClick={() => {
            setBulkChangePreselectedAreaId(undefined);
            setIsBulkMaterialChangeOpen(true);
          }} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Change Materials</span>
            <span className="md:hidden">Materials</span>
          </Button>
          <Button variant="secondary" onClick={handlePrint} className="w-full sm:w-auto">
            <Printer className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Print / Export PDF</span>
            <span className="md:hidden">Print</span>
          </Button>
          <div className="relative w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="w-full sm:w-auto"
              disabled={areas.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Export CSV</span>
              <span className="md:hidden">CSV</span>
            </Button>
            {isExportMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsExportMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white border border-slate-200 z-20">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleExportAreasCSV();
                        setIsExportMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center"
                    >
                      <Download className="h-4 w-4 mr-2 text-slate-500" />
                      <div>
                        <div className="font-medium">Areas Summary</div>
                        <div className="text-xs text-slate-500">Export area totals</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        handleExportDetailedAreasCSV();
                        setIsExportMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2 text-slate-500" />
                      <div>
                        <div className="font-medium">Detailed Report</div>
                        <div className="text-xs text-slate-500">Export all items & details</div>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <Button variant="secondary" onClick={handleSaveChanges} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Save Changes</span>
            <span className="sm:hidden">Save</span>
          </Button>
          <Button
            variant={showAnalytics ? 'primary' : 'secondary'}
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="w-full sm:w-auto"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">{showAnalytics ? 'Hide Analytics' : 'Show Analytics'}</span>
            <span className="md:hidden">Analytics</span>
          </Button>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center mb-4">
            <DollarSign className="h-5 w-5 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold text-slate-900">Additional Costs</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Other Expenses
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={otherExpenses}
                onChange={(e) => setOtherExpenses(parseFloat(e.target.value) || 0)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-slate-500">Flat amount</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Install & Delivery
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={installDelivery}
                onChange={(e) => setInstallDelivery(parseFloat(e.target.value) || 0)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-slate-500">Flat amount</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tariff (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={tariffPercentage}
                onChange={(e) => setTariffPercentage(parseFloat(e.target.value) || 0)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-slate-500">
                {tariffPercentage > 0 ? formatPrice(tariffAmount) : 'Percentage of subtotal'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Taxes (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxesPercentage}
                onChange={(e) => setTaxesPercentage(parseFloat(e.target.value) || 0)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-slate-500">
                {taxesPercentage > 0 ? formatPrice(taxesAmount) : 'Percentage of subtotal + tariff'}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-600">Cabinets Subtotal:</p>
                <p className="text-sm text-slate-600">Countertops Subtotal:</p>
                <p className="text-sm text-slate-600">Individual Items Subtotal:</p>
                <p className="text-sm text-slate-600 mt-2 pt-2 border-t border-slate-300">Materials Subtotal:</p>
                <p className="text-sm text-slate-600">Other Expenses:</p>
                <p className="text-sm text-slate-600">Install & Delivery:</p>
                {tariffPercentage > 0 && <p className="text-sm text-slate-600">Tariff ({tariffPercentage}%):</p>}
                <p className="text-sm text-slate-600">Taxes ({taxesPercentage}%):</p>
                <p className="text-base font-semibold text-slate-900 mt-2">Total:</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-700">{formatPrice(cabinetsSubtotal)}</p>
                <p className="text-sm font-medium text-slate-700">{formatPrice(countertopsSubtotal)}</p>
                <p className="text-sm font-medium text-slate-700">{formatPrice(itemsSubtotal)}</p>
                <p className="text-sm font-semibold text-slate-900 mt-2 pt-2 border-t border-slate-300">{formatPrice(materialsSubtotal)}</p>
                <p className="text-sm font-medium text-slate-700">{formatPrice(otherExpenses)}</p>
                <p className="text-sm font-medium text-slate-700">{formatPrice(installDelivery)}</p>
                {tariffPercentage > 0 && <p className="text-sm font-medium text-slate-700">{formatPrice(tariffAmount)}</p>}
                <p className="text-sm font-medium text-slate-700">{formatPrice(taxesAmount)}</p>
                <p className="text-base font-bold text-slate-900 mt-2">{formatPrice(projectTotal)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAnalytics && areas.length > 0 && (
        <ErrorBoundary>
          <div className="mb-6 space-y-6">
            {loading ? (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Loading analytics...</p>
              </div>
            ) : (
              <>
            <ProjectCharts areas={areas} />

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Shipping - Boxes & Pallets
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <span className="text-sm text-slate-500">Total Boxes</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 break-all">
                  {areas.reduce((sum, area) => {
                    const { boxes } = calculateAreaBoxesAndPallets(area.cabinets, products);
                    return sum + boxes;
                  }, 0)}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <Truck className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-slate-500">Total Pallets</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 break-all">
                  {areas.reduce((sum, area) => {
                    const { pallets } = calculateAreaBoxesAndPallets(area.cabinets, products);
                    return sum + pallets;
                  }, 0)}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <Package className="h-5 w-5 text-purple-600" />
                  <span className="text-sm text-slate-500">Total Acc. ft²</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 break-all">
                  {areas.reduce((sum, area) => {
                    const { accessoriesSqFt } = calculateAreaBoxesAndPallets(area.cabinets, products);
                    return sum + accessoriesSqFt;
                  }, 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <MaterialBreakdown
            cabinets={areas.flatMap(a => a.cabinets || [])}
            items={areas.flatMap(a => a.items || [])}
            countertops={areas.flatMap(a => a.countertops || [])}
          />
              </>
            )}
          </div>
        </ErrorBoundary>
      )}

      <div className="space-y-6">
        {areas.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-slate-600 mb-4">
              No areas yet. Add your first area to start building the quotation.
            </p>
            <Button onClick={() => setIsAreaModalOpen(true)}>Add First Area</Button>
          </div>
        ) : (
          <>
            {areas.length > 3 && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={areaSearchQuery}
                    onChange={(e) => setAreaSearchQuery(e.target.value)}
                    placeholder="Search areas by name..."
                    className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  {areaSearchQuery && (
                    <button
                      onClick={() => setAreaSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
                {areaSearchQuery && (
                  <p className="mt-2 text-xs text-slate-600">
                    Found {areas.filter(area => area.name.toLowerCase().includes(areaSearchQuery.toLowerCase())).length} area(s) matching "{areaSearchQuery}"
                  </p>
                )}
              </div>
            )}
            {(() => {
              const filteredAreas = areas.filter(area =>
                area.name.toLowerCase().includes(areaSearchQuery.toLowerCase())
              );

              if (filteredAreas.length === 0 && areaSearchQuery) {
                return (
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
                    <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600 mb-2">
                      No areas found matching "{areaSearchQuery}"
                    </p>
                    <button
                      onClick={() => setAreaSearchQuery('')}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Clear search
                    </button>
                  </div>
                );
              }

              return filteredAreas.map((area) => (
            <div key={area.id} className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="border-b border-slate-200 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div className="flex-1">
                    <h2 className="text-lg sm:text-xl font-semibold text-slate-900">{area.name}</h2>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600">
                      {countActualCabinets(area.cabinets)} cabinet{countActualCabinets(area.cabinets) !== 1 ? 's' : ''} ({countCabinetEntries(area.cabinets)} {countCabinetEntries(area.cabinets) !== 1 ? 'entries' : 'entry'})
                      {area.cabinets.length !== countCabinetEntries(area.cabinets) && (
                        <span className="ml-2 text-purple-600">+ {area.cabinets.length - countCabinetEntries(area.cabinets)} accessories</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:space-x-4 sm:gap-0">
                    <div className="text-left sm:text-right">
                      <div className="text-xs sm:text-sm text-slate-600">Area Total</div>
                      <div className="text-base sm:text-xl font-bold text-slate-900">
                        {formatCurrency(
                          area.cabinets.reduce((sum, c) => sum + c.subtotal, 0) +
                          area.countertops.reduce((sum, ct) => sum + ct.subtotal, 0) +
                          area.items.reduce((sum, i) => sum + i.subtotal, 0)
                        )}
                      </div>
                    </div>

                    <div className="flex space-x-1 sm:space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAreaMaterialsVisible(prev => ({ ...prev, [area.id]: !prev[area.id] }))}
                        title={areaMaterialsVisible[area.id] ? 'Hide Materials' : 'Show Materials'}
                      >
                        <Calculator className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBulkChangePreselectedAreaId(area.id);
                          setIsBulkMaterialChangeOpen(true);
                        }}
                        title="Change Materials in This Area"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddCabinet(area.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingArea(area);
                          setIsAreaModalOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteArea(area)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <Button size="sm" onClick={() => handleAddCabinet(area.id)} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Cabinet
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedAreaForCountertop(area.id)} className="w-full sm:w-auto border-orange-300 hover:bg-orange-50">
                    <Hammer className="h-4 w-4 mr-2" />
                    Add Countertop
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedAreaForItem(area.id)} className="w-full sm:w-auto">
                    <ListPlus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                {area.cabinets.length === 0 && area.items.length === 0 && area.countertops.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600 mb-3">No cabinets, countertops, or items in this area</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {area.cabinets.length > 0 && (
                      <>
                        <BoxesPalletsBreakdown
                          cabinets={area.cabinets}
                          products={products}
                          areaName={`${area.name} - Shipping Summary`}
                        />

                        {areaMaterialsVisible[area.id] && (
                          <AreaMaterialBreakdown areaId={area.id} />
                        )}

                        {area.cabinets.map((cabinet) => (
                          <CabinetCard
                            key={cabinet.id}
                            cabinet={cabinet}
                            onEdit={() => handleEditCabinet(cabinet)}
                            onDelete={() => handleDeleteCabinet(cabinet)}
                            onDuplicate={() => handleDuplicateCabinet(cabinet)}
                            onSaveAsTemplate={() => handleSaveAsTemplate(cabinet)}
                          />
                        ))}
                      </>
                    )}

                    {area.countertops.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-slate-700 text-sm">Countertops</h4>
                        <div className="space-y-2">
                          {area.countertops.map((countertop) => (
                            <div
                              key={countertop.id}
                              className="bg-orange-50 border border-orange-200 rounded-lg p-4"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <h4 className="font-semibold text-slate-900">{countertop.item_name}</h4>
                                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                                      Countertop
                                    </span>
                                  </div>
                                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-slate-600">Quantity:</span>
                                      <span className="font-medium">{countertop.quantity}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-600">Unit Price:</span>
                                      <span className="font-medium">{formatPrice(countertop.unit_price)}</span>
                                    </div>
                                    <div className="flex justify-between col-span-2 pt-1 border-t border-orange-200">
                                      <span className="text-slate-600 font-medium">Subtotal:</span>
                                      <span className="font-semibold text-orange-900">
                                        {formatPrice(countertop.subtotal)}
                                      </span>
                                    </div>
                                  </div>
                                  {countertop.notes && (
                                    <div className="mt-2 text-xs text-slate-600 italic">
                                      Note: {countertop.notes}
                                    </div>
                                  )}
                                </div>
                                <div className="flex space-x-1 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedAreaForCountertop(countertop.area_id);
                                      setEditingCountertop(countertop);
                                    }}
                                  >
                                    <Edit2 className="h-4 w-4 text-slate-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteCountertop(countertop.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {area.items.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-slate-700 text-sm">Individual Items</h4>
                        <div className="space-y-2">
                          {area.items.map((item) => (
                            <div
                              key={item.id}
                              className="bg-amber-50 border border-amber-200 rounded-lg p-4"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <h4 className="font-semibold text-slate-900">{item.item_name}</h4>
                                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                                      Item
                                    </span>
                                  </div>
                                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-slate-600">Quantity:</span>
                                      <span className="font-medium">{item.quantity}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-600">Unit Price:</span>
                                      <span className="font-medium">{formatPrice(item.unit_price)}</span>
                                    </div>
                                    <div className="flex justify-between col-span-2 pt-1 border-t border-amber-200">
                                      <span className="text-slate-600 font-medium">Subtotal:</span>
                                      <span className="font-semibold text-amber-900">
                                        {formatPrice(item.subtotal)}
                                      </span>
                                    </div>
                                  </div>
                                  {item.notes && (
                                    <div className="mt-2 text-xs text-slate-600 italic">
                                      Note: {item.notes}
                                    </div>
                                  )}
                                </div>
                                <div className="flex space-x-1 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditItem(item)}
                                  >
                                    <Edit2 className="h-4 w-4 text-slate-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteItem(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ));
            })()}
          </>
        )}
      </div>

      {isAreaModalOpen && (
        <AreaFormModal
          area={editingArea}
          onSave={handleSaveArea}
          onClose={() => {
            setIsAreaModalOpen(false);
            setEditingArea(null);
          }}
        />
      )}

      {selectedAreaForCabinet && (
        <CabinetForm
          areaId={selectedAreaForCabinet}
          cabinet={editingCabinet}
          onClose={handleCloseCabinetForm}
          versionId={currentVersionId}
        />
      )}

      {selectedAreaForItem && (
        <ItemForm
          areaId={selectedAreaForItem}
          item={editingItem}
          onClose={handleCloseItemForm}
          versionId={currentVersionId}
        />
      )}

      {selectedAreaForCountertop && (
        <CountertopForm
          areaId={selectedAreaForCountertop}
          countertop={editingCountertop}
          onClose={handleCloseCountertopForm}
          versionId={currentVersionId}
        />
      )}

      {savingTemplateCabinet && (
        <SaveTemplateModal
          isOpen={true}
          onClose={() => setSavingTemplateCabinet(null)}
          onSave={handleCreateTemplate}
          defaultName={savingTemplateCabinet.product_sku || ''}
        />
      )}

      <BulkMaterialChangeModal
        isOpen={isBulkMaterialChangeOpen}
        onClose={() => {
          setIsBulkMaterialChangeOpen(false);
          setBulkChangePreselectedAreaId(undefined);
        }}
        onSuccess={async () => {
          if (currentVersionId) {
            await recalculateVersionTotal(currentVersionId);
            await loadVersionAreas(currentVersionId);
          } else {
            await loadAreas();
          }
        }}
        projectId={project.id}
        areas={areas}
        preselectedAreaId={bulkChangePreselectedAreaId}
        versionId={currentVersionId}
      />
    </div>
  );
}

interface AreaFormModalProps {
  area: ProjectArea | null;
  onSave: (area: ProjectAreaInsert) => void;
  onClose: () => void;
}

function AreaFormModal({ area, onSave, onClose }: AreaFormModalProps) {
  const [name, setName] = useState(area?.name || '');

  const areaPresets = [
    'Kitchen',
    'Dining Room',
    'Living Room',
    'Master Bedroom',
    'Bedroom',
    'Closet',
    'Bathroom',
    'Laundry Room',
    'Office',
    'Garage',
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ name });
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={area ? 'Edit Area' : 'Add New Area'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Area Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Kitchen, Dining, Closet, etc."
        />

        {!area && (
          <div>
            <p className="text-sm text-slate-600 mb-2">Or choose a preset:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {areaPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setName(preset)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-left"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{area ? 'Update Area' : 'Add Area'}</Button>
        </div>
      </form>
    </Modal>
  );
}
