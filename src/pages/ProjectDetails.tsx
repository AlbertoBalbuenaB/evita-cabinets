import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Pencil as Edit2, Trash2, Copy, Package, DollarSign, ListPlus, Calculator, Receipt, Hammer, RefreshCw, Search, X, AlertTriangle, GripVertical, ChevronUp, ChevronDown, Info, RotateCcw, FileText, BarChart3, History, SeparatorHorizontal, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchAllProducts } from '../lib/fetchAllProducts';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { formatCurrency } from '../lib/calculations';
import type { Quotation, Project, ProjectArea, AreaCabinet, ProjectAreaInsert, Product, AreaItem, AreaCountertop, AreaClosetItem, AreaSection, PriceListItem } from '../types';
import { CabinetForm } from '../components/CabinetForm';
import { ItemForm } from '../components/ItemForm';
import { CountertopForm } from '../components/CountertopForm';
import { ClosetForm } from '../components/ClosetForm';
import { CabinetCard } from '../components/CabinetCard';
import { MaterialBreakdown } from '../components/MaterialBreakdown';
import { QuotationBOM } from '../components/QuotationBOM';
import { AreaMaterialBreakdown } from '../components/AreaMaterialBreakdown';
import { ProjectCharts } from '../components/ProjectCharts';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { printQuotation, printQuotationUSD } from '../utils/printQuotation';
import { filterProjectBriefForPDF } from '../utils/filterProjectBrief';
import { BoxesPalletsBreakdown } from '../components/BoxesPalletsBreakdown';
import { calculateAreaBoxesAndPallets } from '../lib/boxesAndPallets';
import { useSettingsStore } from '../lib/settingsStore';
import { recalculateAreaEdgebandCosts } from '../lib/edgebandRolls';
import { recalculateAreaSheetMaterialCosts } from '../lib/sheetMaterials';
import { computeQuotationTotalsSqft } from '../lib/pricing/computeQuotationTotalsSqft';
import { computeOptimizerQuotationTotal } from '../lib/optimizer/quotation/computeOptimizerQuotationTotal';
import type { OptimizerRunSnapshot } from '../lib/optimizer/quotation/types';
import { exportOptimizerPDF, type PdfLang } from '../lib/optimizer/pdfExport';
import { QuotationOptimizerTab } from '../components/optimizer/quotation/QuotationOptimizerTab';
import { OptimizerRunsAnalytics } from '../components/optimizer/quotation/OptimizerRunsAnalytics';
import { SaveTemplateModal } from '../components/SaveTemplateModal';
import { BulkMaterialChangeModal } from '../components/BulkMaterialChangeModal';
import { MaterialPriceUpdateModal } from '../components/MaterialPriceUpdateModal';
import { createTemplateFromCabinet } from '../lib/templateManager';
import { countActualCabinets, countCabinetEntries } from '../lib/cabinetFilters';
import { downloadAreasCSV, downloadDetailedAreasCSV } from '../utils/exportAreasCSV';
import { checkProjectHasStalePrices } from '../lib/priceUpdateSystem';
import { getVersionHistory } from '../lib/versioningSystem';
import { updateProjectBrief } from '../lib/projectBrief';
import { ProjectVersionHistory } from './ProjectVersionHistory';
import { FloatingActionBar } from '../components/FloatingActionBar';
import { ProductFormModal } from '../components/ProductFormModal';
import type { ProductInsert } from '../types';
import { exportQuotationToJSON } from '../utils/projectExportImport';
import { SectionDivider } from '../components/SectionDivider';

import { useAiChatContext } from '../stores/aiChatContext';

interface ProjectDetailsProps {
  project: Quotation;
  parentProject?: Project | null;
  onBack: () => void;
}

export function ProjectDetails({ project: initialProject, parentProject, onBack }: ProjectDetailsProps) {
  const setActiveProjectTab = useAiChatContext(s => s.setActiveProjectTab);
  const [project, setProject] = useState<Quotation>(initialProject);
  const [areas, setAreas] = useState<(ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[]; closetItems: AreaClosetItem[]; sections: AreaSection[] })[]>([]);
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
  const [selectedAreaForCloset, setSelectedAreaForCloset] = useState<string | null>(null);
  const [editingClosetItem, setEditingClosetItem] = useState<AreaClosetItem | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'pricing' | 'cutlist' | 'analytics' | 'history'>('info');

  useEffect(() => {
    setActiveProjectTab(activeTab);
  }, [activeTab, setActiveProjectTab]);

  useEffect(() => {
    setActiveProjectTab('info');
    return () => { setActiveProjectTab(null); };
  }, [setActiveProjectTab]);

  const [currencyDisplay, setCurrencyDisplay] = useState<'USD' | 'MXN' | 'BOTH'>('MXN');
  const exchangeRate = useSettingsStore(s => s.settings.exchangeRateUsdToMxn);
  const fetchSettings = useSettingsStore(s => s.fetchSettings);
  const [otherExpenses, setOtherExpenses] = useState(project.other_expenses || 0);
  const [otherExpensesLabel, setOtherExpensesLabel] = useState(project.other_expenses_label || 'Other Expenses');
  const [profitMultiplier, setProfitMultiplier] = useState(project.profit_multiplier || 0);
  const [tariffMultiplier, setTariffMultiplier] = useState(project.tariff_multiplier || 0);
  const [taxPercentage, setTaxPercentage] = useState(project.tax_percentage || 0);
  const [installDelivery, setInstallDelivery] = useState((project as any).install_delivery_usd || 0);
  const [installDeliveryPerBox, setInstallDeliveryPerBox] = useState((project as any).install_delivery_per_box_usd || 0);
  const [referralRate, setReferralRate] = useState(project.referral_currency_rate || 0);
  const [savingTemplateCabinet, setSavingTemplateCabinet] = useState<AreaCabinet | null>(null);
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [areaMaterialsVisible, setAreaMaterialsVisible] = useState<Record<string, boolean>>({});
  const [isBulkMaterialChangeOpen, setIsBulkMaterialChangeOpen] = useState(false);
  const [bulkChangePreselectedAreaId, setBulkChangePreselectedAreaId] = useState<string | undefined>();
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [hasStalePrices, setHasStalePrices] = useState(false);
  const [isBulkPriceUpdateOpen, setIsBulkPriceUpdateOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [, setVersionCount] = useState(0);
const [isEditingDate, setIsEditingDate] = useState(false);
  const [editedQuoteDate, setEditedQuoteDate] = useState(project.quote_date);
  const [hasAreasOrderChanged, setHasAreasOrderChanged] = useState(false);
  const [savingAreasOrder, setSavingAreasOrder] = useState(false);
  const [draggedMerged, setDraggedMerged] = useState<{ areaId: string; mergedIndex: number } | null>(null);
  const [mergedDropTarget, setMergedDropTarget] = useState<{ areaId: string; mergedIndex: number; position: 'before' | 'after' } | null>(null);
  const DEFAULT_TARIFF_INFO = 'Grand Total includes design services, delivery costs, installation and tax.';
  const DEFAULT_PRICE_VALIDITY = '*Price is valid for 15 days.\n*Preliminary quote, based off of our best interpretation of the provided plans. Pricing is subject to change once final layout and finishes have been approved.\n*A Design Retainer is required prior to commencing drawings. The design retainer will be credited back to the purchase of cabinets.';
  const [disclaimerTariffInfo, setDisclaimerTariffInfo] = useState(project.disclaimer_tariff_info || DEFAULT_TARIFF_INFO);
  const [disclaimerPriceValidity, setDisclaimerPriceValidity] = useState(project.disclaimer_price_validity || DEFAULT_PRICE_VALIDITY);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

  const [pdfProjectName, setPdfProjectName] = useState(project.pdf_project_name ?? project.name);
  const [pdfCustomer, setPdfCustomer] = useState(project.pdf_customer ?? (project.customer || ''));
  const [pdfAddress, setPdfAddress] = useState(project.pdf_address ?? (project.address || ''));
  const [pdfProjectBrief, setPdfProjectBrief] = useState(
    project.pdf_project_brief ?? filterProjectBriefForPDF(project.project_brief || '')
  );

  const isPdfNameModified = pdfProjectName !== project.name;
  const isPdfCustomerModified = pdfCustomer !== (project.customer || '');
  const isPdfAddressModified = pdfAddress !== (project.address || '');
  const isPdfBriefModified = pdfProjectBrief !== filterProjectBriefForPDF(project.project_brief || '');
  const isAnyPdfFieldModified = isPdfNameModified || isPdfCustomerModified || isPdfAddressModified || isPdfBriefModified;

  useEffect(() => {
    setProject(initialProject);
    setEditedQuoteDate(initialProject.quote_date);
    setDisclaimerTariffInfo(initialProject.disclaimer_tariff_info || DEFAULT_TARIFF_INFO);
    setDisclaimerPriceValidity(initialProject.disclaimer_price_validity || DEFAULT_PRICE_VALIDITY);
    setPdfProjectName(initialProject.pdf_project_name ?? initialProject.name);
    setPdfCustomer(initialProject.pdf_customer ?? (initialProject.customer || ''));
    setPdfAddress(initialProject.pdf_address ?? (initialProject.address || ''));
    setPdfProjectBrief(initialProject.pdf_project_brief ?? filterProjectBriefForPDF(initialProject.project_brief || ''));
  }, [initialProject]);

  useEffect(() => {
    loadAreas();
    checkStalePrices();
    loadVersionCount();
  }, [project.id]);

  useEffect(() => {
    if (installDeliveryPerBox > 0) {
      const boxes = areas.reduce((sum, area) => {
        const { boxes: b } = calculateAreaBoxesAndPallets(area.cabinets, products, area.closetItems || []);
        return sum + b * (area.quantity ?? 1);
      }, 0);
      setInstallDelivery(installDeliveryPerBox * boxes);
    }
  }, [installDeliveryPerBox, areas, products]);

  async function loadProject() {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .eq('id', project.id)
        .single();

      if (error) throw error;
      if (data) setProject(data);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  }

  async function checkStalePrices() {
    const stale = await checkProjectHasStalePrices(project.id);
    setHasStalePrices(stale);
  }

  async function loadVersionCount() {
    try {
      const versions = await getVersionHistory(project.id);
      setVersionCount(versions.length);
    } catch (error) {
      console.error('Error loading version count:', error);
    }
  }


  async function loadAreas() {
    try {
      const [areasResult, allProducts, priceListResult] = await Promise.all([
        supabase
          .from('project_areas')
          .select('*')
          .eq('project_id', project.id)
          .order('display_order'),
        fetchAllProducts({ onlyActive: false }),
        supabase.from('price_list').select('*').eq('is_active', true),
      ]);
      fetchSettings();

      const { data: areasData, error: areasError } = areasResult;
      if (areasError) throw areasError;

      setProducts(allProducts);
      setPriceList(priceListResult.data || []);

      const areaIds = (areasData || []).map((a) => a.id);

      const [allCabinetsResult, allItemsResult, allCountertopsResult, allClosetItemsResult, allSectionsResult] = areaIds.length > 0
        ? await Promise.all([
            supabase.from('area_cabinets').select('*').in('area_id', areaIds).order('display_order').order('created_at'),
            supabase.from('area_items').select('*').in('area_id', areaIds).order('created_at'),
            supabase.from('area_countertops').select('*').in('area_id', areaIds).order('created_at'),
            supabase.from('area_closet_items').select('*, catalog_item:closet_catalog(*)').in('area_id', areaIds).order('created_at'),
            supabase.from('area_sections').select('*').in('area_id', areaIds).order('display_order'),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

      const allCabinets: AreaCabinet[] = allCabinetsResult.data || [];
      const allItems: AreaItem[] = (allItemsResult.data || []) as unknown as AreaItem[];
      const allCountertops: AreaCountertop[] = (allCountertopsResult.data || []) as unknown as AreaCountertop[];
      const allClosetItems: AreaClosetItem[] = (allClosetItemsResult.data || []) as unknown as AreaClosetItem[];
      const allSections: AreaSection[] = (allSectionsResult.data || []) as AreaSection[];

      const areasWithCabinetsAndItems = (areasData || []).map((area) => {
        const result = {
          ...area,
          cabinets: allCabinets.filter((c) => c.area_id === area.id),
          items: allItems.filter((i) => i.area_id === area.id),
          countertops: allCountertops.filter((ct) => ct.area_id === area.id),
          closetItems: allClosetItems.filter((ci) => ci.area_id === area.id),
          sections: allSections.filter((s) => s.area_id === area.id),
        };
        console.log('[loadAreas] area sample:', { id: area.id, name: area.name, cabinetCount: result.cabinets.length, itemCount: result.items.length, countertopCount: result.countertops.length, closetCount: result.closetItems.length, firstCabinet: result.cabinets[0] ?? null });
        return result;
      });

      setAreas(areasWithCabinetsAndItems);
      await updateProjectTotal(areasWithCabinetsAndItems);
    } catch (error) {
      console.error('Error loading areas:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateProjectTotal(
    areasData: (ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[]; closetItems: AreaClosetItem[]; sections: AreaSection[] })[],
    opts?: {
      profitMultiplier?: number;
      tariffMultiplier?: number;
      taxPercentage?: number;
      installDelivery?: number;
      referralRate?: number;
      otherExpenses?: number;
    }
  ) {
    const _profitMultiplier = opts?.profitMultiplier ?? profitMultiplier;
    const _tariffMultiplier = opts?.tariffMultiplier ?? tariffMultiplier;
    const _taxPercentage = opts?.taxPercentage ?? taxPercentage;
    // installDelivery state is in USD — convert to MXN for all calculations
    const _installDeliveryUsd = opts?.installDelivery ?? installDelivery;
    const _installDeliveryMxn = _installDeliveryUsd * exchangeRate;
    const _referralRate = opts?.referralRate ?? referralRate;
    const _otherExpenses = opts?.otherExpenses ?? otherExpenses;

    // Math is delegated to a pure helper to keep the rollup testable and
    // to share it with the optimizer-pricing path (Phase 7). The wrapper
    // remains responsible for Supabase writes.
    const totals = computeQuotationTotalsSqft(areasData, {
      profitMultiplier:  _profitMultiplier,
      tariffMultiplier:  _tariffMultiplier,
      referralRate:      _referralRate,
      taxPercentage:     _taxPercentage,
      installDeliveryMxn: _installDeliveryMxn,
      otherExpenses:     _otherExpenses,
    });
    const sqftProjectTotal = totals.fullProjectTotal;

    // ── Phase 7: optimizer-pricing rollup branch ────────────────────────
    // Whenever the quotation has an active optimizer run, recompute the
    // optimizer grand total in parallel so the ft²-vs-optimizer comparison
    // card always stays fresh. The fresh value is written to
    // `optimizer_total_amount`.
    //
    // Which value ends up in `total_amount` (the "official" total read by
    // PDF, dashboards, etc.) depends on `quotations.pricing_method`:
    //   - 'sqft'      → sqft total (legacy behavior, unchanged)
    //   - 'optimizer' → optimizer grand total, OR fall back to sqft if the
    //                    active run is stale / missing (safety net)
    //
    // Both the mode and the active_run_id are re-fetched from DB here to
    // bypass React prop staleness (the user may have toggled the method
    // from within the Breakdown tab without remounting ProjectDetails).
    let optimizerGrandTotal: number | null = null;
    let writeTotal = sqftProjectTotal;

    try {
      const { data: q } = await supabase
        .from('quotations')
        .select('pricing_method, active_optimizer_run_id')
        .eq('id', project.id)
        .maybeSingle();

      const pricingMethod: 'sqft' | 'optimizer' =
        (q?.pricing_method as 'sqft' | 'optimizer') ?? 'sqft';
      const activeRunId = q?.active_optimizer_run_id ?? null;

      if (activeRunId) {
        const { data: run } = await supabase
          .from('quotation_optimizer_runs')
          .select('material_cost, edgeband_cost, is_stale, snapshot')
          .eq('id', activeRunId)
          .maybeSingle();

        if (run && !run.is_stale) {
          const snapshot = run.snapshot as unknown as OptimizerRunSnapshot;
          const cabinetsCovered = new Set<string>(snapshot?.cabinetsCovered ?? []);

          const optTotals = computeOptimizerQuotationTotal({
            materialCost: Number(run.material_cost ?? 0),
            edgebandCost: Number(run.edgeband_cost ?? 0),
            areasData,
            cabinetsCovered,
            multipliers: {
              profitMultiplier:  _profitMultiplier,
              tariffMultiplier:  _tariffMultiplier,
              referralRate:      _referralRate,
              taxPercentage:     _taxPercentage,
              installDeliveryMxn: _installDeliveryMxn,
              otherExpenses:     _otherExpenses,
            },
          });
          optimizerGrandTotal = optTotals.fullProjectTotal;
          if (pricingMethod === 'optimizer') {
            writeTotal = optimizerGrandTotal;
          }
        } else if (run?.is_stale && pricingMethod === 'optimizer') {
          console.warn(
            `[updateProjectTotal] Active optimizer run for quotation ${project.id} is stale; falling back to ft² total.`,
          );
        }
      }
    } catch (err) {
      console.error('[updateProjectTotal] optimizer branch failed; keeping sqft total:', err);
    }

    try {
      const updatePayload: { total_amount: number; optimizer_total_amount?: number } = {
        total_amount: writeTotal,
      };
      if (optimizerGrandTotal !== null) {
        updatePayload.optimizer_total_amount = optimizerGrandTotal;
      }

      await supabase
        .from('quotations')
        .update(updatePayload)
        .eq('id', project.id);

      for (const area of areasData) {
        const areaTotal = totals.perAreaTotal[area.id] ?? 0;
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
      if (editingArea) {
        const { error } = await supabase
          .from('project_areas')
          .update(areaData)
          .eq('id', editingArea.id);

        if (error) throw error;
      } else {
        const maxOrder = Math.max(...areas.map((a) => a.display_order ?? 0), -1);
        const { error } = await supabase.from('project_areas').insert([
          {
            ...areaData,
            project_id: project.id,
            display_order: maxOrder + 1,
          },
        ]);

        if (error) throw error;
      }

      await loadAreas();
      setIsAreaModalOpen(false);
      setEditingArea(null);
    } catch (error) {
      console.error('Error saving area:', error);
      alert('Failed to save area');
    }
  }

  async function handleDuplicateArea(area: ProjectArea & { cabinets: AreaCabinet[]; items: AreaItem[]; countertops: AreaCountertop[]; closetItems: AreaClosetItem[]; sections: AreaSection[] }) {
    if (!confirm(`Duplicate area "${area.name}" with all its cabinets and items?`)) return;

    try {
      const maxOrder = Math.max(...areas.map((a) => a.display_order ?? 0), -1);
      const { data: newArea, error: areaError } = await supabase
        .from('project_areas')
        .insert([{
          project_id: area.project_id,
          name: `${area.name} (Copy)`,
          display_order: maxOrder + 1,
          applies_tariff: area.applies_tariff,
        }])
        .select()
        .single();

      if (areaError || !newArea) throw areaError ?? new Error('Failed to create area');

      if (area.cabinets.length > 0) {
        const cabinetsToInsert = area.cabinets.map(({ id, created_at, ...rest }) => ({
          ...rest,
          area_id: newArea.id,
        }));
        const { error: cabinetsError } = await supabase.from('area_cabinets').insert(cabinetsToInsert);
        if (cabinetsError) throw cabinetsError;
      }

      if (area.items.length > 0) {
        const itemsToInsert = area.items.map(({ id, created_at, updated_at, ...rest }) => ({
          ...rest,
          area_id: newArea.id,
        }));
        const { error: itemsError } = await supabase.from('area_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      if (area.countertops.length > 0) {
        const countertopsToInsert = area.countertops.map(({ id, created_at, updated_at, ...rest }) => ({
          ...rest,
          area_id: newArea.id,
        }));
        const { error: countertopsError } = await supabase.from('area_countertops').insert(countertopsToInsert);
        if (countertopsError) throw countertopsError;
      }

      if (area.closetItems.length > 0) {
        const closetItemsToInsert = area.closetItems.map(({ id, created_at, updated_at, catalog_item, ...rest }) => ({
          ...rest,
          area_id: newArea.id,
        }));
        const { error: closetError } = await supabase.from('area_closet_items').insert(closetItemsToInsert as any);
        if (closetError) throw closetError;
      }

      if (area.sections.length > 0) {
        const sectionsToInsert = area.sections.map(({ id, created_at, updated_at, ...rest }) => ({
          ...rest,
          area_id: newArea.id,
        }));
        const { error: sectionsError } = await supabase.from('area_sections').insert(sectionsToInsert);
        if (sectionsError) throw sectionsError;
      }

      await loadAreas();
    } catch (error) {
      console.error('Error duplicating area:', error);
      alert('Failed to duplicate area');
    }
  }

  async function handleDeleteArea(area: ProjectArea) {
    if (!confirm(`Delete area "${area.name}" and all its cabinets?`)) return;

    try {
      const { error } = await supabase.from('project_areas').delete().eq('id', area.id);

      if (error) throw error;

      await loadAreas();
    } catch (error) {
      console.error('Error deleting area:', error);
      alert('Failed to delete area');
    }
  }

  async function handleAddSection(areaId: string) {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;
    const maxCabinetOrder = area.cabinets.length > 0 ? Math.max(...area.cabinets.map(c => c.display_order ?? 0)) : -1;
    const maxSectionOrder = area.sections.length > 0 ? Math.max(...area.sections.map(s => s.display_order)) : -1;
    const newOrder = Math.max(maxCabinetOrder, maxSectionOrder) + 1;
    try {
      const { error } = await supabase.from('area_sections').insert([{ area_id: areaId, name: 'New Section', display_order: newOrder }]);
      if (error) throw error;
      await loadAreas();
    } catch (error) {
      console.error('Error adding section:', error);
    }
  }

  async function handleRenameSection(section: AreaSection, newName: string) {
    if (!newName.trim()) return;
    try {
      const { error } = await supabase.from('area_sections').update({ name: newName.trim() }).eq('id', section.id);
      if (error) throw error;
      setAreas(prev => prev.map(a =>
        a.id === section.area_id
          ? { ...a, sections: a.sections.map(s => s.id === section.id ? { ...s, name: newName.trim() } : s) }
          : a
      ));
    } catch (error) {
      console.error('Error renaming section:', error);
    }
  }

  async function handleDeleteSection(section: AreaSection) {
    try {
      const { error } = await supabase.from('area_sections').delete().eq('id', section.id);
      if (error) throw error;
      setAreas(prev => prev.map(a =>
        a.id === section.area_id
          ? { ...a, sections: a.sections.filter(s => s.id !== section.id) }
          : a
      ));
    } catch (error) {
      console.error('Error deleting section:', error);
    }
  }

  async function handleDeleteCabinet(cabinet: AreaCabinet) {
    if (!confirm('Delete this cabinet?')) return;

    try {
      const areaId = cabinet.area_id;
      const { error } = await supabase
        .from('area_cabinets')
        .delete()
        .eq('id', cabinet.id);

      if (error) throw error;

      await recalculateAreaSheetMaterialCosts(areaId);
      await recalculateAreaEdgebandCosts(areaId);
      await loadAreas();
    } catch (error) {
      console.error('Error deleting cabinet:', error);
      alert('Failed to delete cabinet');
    }
  }

  async function handleDuplicateCabinet(cabinet: AreaCabinet) {
    try {
      const { id, created_at, ...cabinetData } = cabinet;
      const area = areas.find(a => a.id === cabinet.area_id);
      const maxOrder = area ? Math.max(...area.cabinets.map(c => (c as any).display_order ?? 0), -1) : -1;
      const { error } = await supabase.from('area_cabinets').insert([{ ...cabinetData, display_order: maxOrder + 1 }]);

      if (error) throw error;
      await loadAreas();
    } catch (error) {
      console.error('Error duplicating cabinet:', error);
      alert('Failed to duplicate cabinet');
    }
  }

  async function handleMoveCabinet(cabinet: AreaCabinet, targetAreaId: string) {
    if (cabinet.area_id === targetAreaId) return;

    const sourceAreaId = cabinet.area_id;

    try {
      const { error } = await supabase
        .from('area_cabinets')
        .update({ area_id: targetAreaId })
        .eq('id', cabinet.id);

      if (error) throw error;

      await Promise.all([
        (async () => {
          await recalculateAreaSheetMaterialCosts(sourceAreaId);
          await recalculateAreaEdgebandCosts(sourceAreaId);
        })(),
        (async () => {
          await recalculateAreaSheetMaterialCosts(targetAreaId);
          await recalculateAreaEdgebandCosts(targetAreaId);
        })(),
      ]);
      await loadAreas();
    } catch (error) {
      console.error('Error moving cabinet:', error);
      alert('Failed to move cabinet');
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
    await loadAreas();
  }

  function handleEditItem(item: AreaItem) {
    setSelectedAreaForItem(item.area_id);
    setEditingItem(item);
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await supabase.from('area_items').delete().eq('id', itemId);

      if (error) throw error;
      await loadAreas();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  }

  async function handleDeleteCountertop(countertopId: string) {
    if (!confirm('Are you sure you want to delete this countertop?')) return;

    try {
      const { error } = await supabase.from('area_countertops').delete().eq('id', countertopId);
      if (error) throw error;
      await loadAreas();
    } catch (error) {
      console.error('Error deleting countertop:', error);
      alert('Failed to delete countertop');
    }
  }

  async function handleCloseItemForm() {
    setSelectedAreaForItem(null);
    setEditingItem(null);
    await loadAreas();
  }

  async function handleDeleteClosetItem(closetItemId: string) {
    if (!confirm('Are you sure you want to delete this closet item?')) return;

    try {
      const { error } = await supabase.from('area_closet_items').delete().eq('id', closetItemId);
      if (error) throw error;
      await loadAreas();
    } catch (error) {
      console.error('Error deleting closet item:', error);
      alert('Failed to delete closet item');
    }
  }

  async function handleCloseCountertopForm() {
    setSelectedAreaForCountertop(null);
    setEditingCountertop(null);
    await loadAreas();
  }

  async function handleCloseClosetForm() {
    setSelectedAreaForCloset(null);
    setEditingClosetItem(null);
    await loadAreas();
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
    await printQuotation(project, areas, products, priceList, {
      pdfProjectName: isPdfNameModified ? pdfProjectName : undefined,
      pdfCustomer: isPdfCustomerModified ? pdfCustomer : undefined,
      pdfAddress: isPdfAddressModified ? pdfAddress : undefined,
      pdfProjectBrief: isPdfBriefModified ? pdfProjectBrief : undefined,
    });
  }

  async function handlePrintUSD() {
    await printQuotationUSD(project, areas, exchangeRate, products, priceList, disclaimerTariffInfo, disclaimerPriceValidity, {
      pdfProjectName: isPdfNameModified ? pdfProjectName : undefined,
      pdfCustomer: isPdfCustomerModified ? pdfCustomer : undefined,
      pdfAddress: isPdfAddressModified ? pdfAddress : undefined,
      pdfProjectBrief: isPdfBriefModified ? pdfProjectBrief : undefined,
    });
  }

  // Cut-list (Breakdown) PDF export — generates a board-layout PDF from the
  // currently active optimizer run for this quotation. Always queries fresh
  // from DB to bypass any stale React prop state on `project`.
  async function handlePrintCutList(lang: PdfLang) {
    try {
      const { data: run, error } = await supabase
        .from('quotation_optimizer_runs')
        .select('snapshot, result, name')
        .eq('quotation_id', project.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('[handlePrintCutList] failed to load active run:', error);
        alert('Failed to load the active optimizer run. Please try again.');
        return;
      }

      if (!run) {
        alert('No active optimizer run for this quotation. Save and activate one in the Breakdown tab first.');
        return;
      }

      const snapshot = run.snapshot as unknown as OptimizerRunSnapshot;
      const result   = run.result   as unknown as Parameters<typeof exportOptimizerPDF>[0];

      // Derive area name list from tagged pieces.
      const areaNames = Array.from(new Set(
        snapshot.pieces.map((p) => p.area).filter((a): a is string => !!a),
      ));

      const projectName = (isPdfNameModified ? pdfProjectName : null) ?? project.pdf_project_name ?? project.name;
      const clientName  = (isPdfCustomerModified ? pdfCustomer : null) ?? project.pdf_customer ?? (project.customer ?? '');

      await exportOptimizerPDF(
        result,
        projectName,
        clientName,
        'mm',
        snapshot.ebConfig,
        areaNames,
        1.0,
        lang,
      );
    } catch (err) {
      console.error('[handlePrintCutList] export failed:', err);
      alert('Failed to export the cut-list PDF: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  const handlePrintCutListEN = () => handlePrintCutList('en');
  const handlePrintCutListES = () => handlePrintCutList('es');

  async function handleSaveChanges() {
    try {
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0];

      const { error } = await supabase
        .from('quotations')
        .update({
          quote_date: formattedDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (error) throw error;

      await updateProjectBrief(project.id);
      await loadProject();
      await loadAreas();
      alert('Changes saved successfully and quote date updated to today');
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes');
    }
  }

  async function handleSaveDateChange() {
    try {
      const { error } = await supabase
        .from('quotations')
        .update({
          quote_date: editedQuoteDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (error) throw error;

      await loadProject();
      setIsEditingDate(false);
      alert('Quote date updated successfully');
    } catch (error) {
      console.error('Error updating date:', error);
      alert('Failed to update date');
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

  async function handleExportJSON() {
    if (areas.length === 0) {
      alert('No areas to export. Please add areas to the project first.');
      return;
    }

    try {
      await exportQuotationToJSON(project.id);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export project. Please try again.');
    }
  }

  async function handleSaveNewProduct(product: ProductInsert) {
    try {
      const { error } = await supabase
        .from('products_catalog')
        .insert([product]);
      if (error) throw error;
      const { data } = await supabase
        .from('products_catalog')
        .select('*')
        .order('sku');
      if (data) setProducts(data);
      setIsAddProductOpen(false);
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Failed to save product');
    }
  }


  async function saveAreasOrder() {
    if (!hasAreasOrderChanged) return;

    try {
      setSavingAreasOrder(true);

      for (let i = 0; i < areas.length; i++) {
        const { error } = await supabase
          .from('project_areas')
          .update({
            display_order: i,
            updated_at: new Date().toISOString()
          })
          .eq('id', areas[i].id);

        if (error) throw error;
      }

      setHasAreasOrderChanged(false);
      await loadAreas();
      alert('Areas order saved successfully!');
    } catch (error) {
      console.error('Error saving areas order:', error);
      alert('Failed to save areas order');
    } finally {
      setSavingAreasOrder(false);
    }
  }

  function moveAreaUp(index: number) {
    if (index === 0) return;

    const newAreas = [...areas];
    [newAreas[index - 1], newAreas[index]] = [newAreas[index], newAreas[index - 1]];

    setAreas(newAreas);
    setHasAreasOrderChanged(true);
  }

  function moveAreaDown(index: number) {
    if (index === areas.length - 1) return;

    const newAreas = [...areas];
    [newAreas[index], newAreas[index + 1]] = [newAreas[index + 1], newAreas[index]];

    setAreas(newAreas);
    setHasAreasOrderChanged(true);
  }

  type MergedAreaItem =
    | { type: 'cabinet'; data: AreaCabinet; index: number; display_order: number }
    | { type: 'section'; data: AreaSection; display_order: number };

  function getMergedItems(area: { cabinets: AreaCabinet[]; sections: AreaSection[] }): MergedAreaItem[] {
    const cabinets: MergedAreaItem[] = area.cabinets.map((c, i) => ({ type: 'cabinet', data: c, index: i, display_order: c.display_order ?? i }));
    const sections: MergedAreaItem[] = area.sections.map(s => ({ type: 'section', data: s, display_order: s.display_order }));
    return [...cabinets, ...sections].sort((a, b) => a.display_order - b.display_order);
  }

  function handleMergedDragStart(e: React.DragEvent<HTMLDivElement>, areaId: string, mergedIndex: number) {
    setDraggedMerged({ areaId, mergedIndex });
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  }

  function handleMergedDragEnd(e: React.DragEvent<HTMLDivElement>) {
    e.currentTarget.style.opacity = '1';
    setDraggedMerged(null);
    setMergedDropTarget(null);
  }

  function handleMergedDragOver(e: React.DragEvent<HTMLDivElement>, areaId: string, mergedIndex: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedMerged && draggedMerged.areaId === areaId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      setMergedDropTarget({ areaId, mergedIndex, position });
    }
  }

  async function handleMergedDrop(e: React.DragEvent<HTMLDivElement>, areaId: string, dropMergedIndex: number) {
    e.preventDefault();
    setMergedDropTarget(null);

    if (!draggedMerged || draggedMerged.areaId !== areaId || draggedMerged.mergedIndex === dropMergedIndex) {
      setDraggedMerged(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const dropAfter = e.clientY >= rect.top + rect.height / 2;

    const areaIndex = areas.findIndex(a => a.id === areaId);
    if (areaIndex === -1) { setDraggedMerged(null); return; }

    const area = areas[areaIndex];
    const merged = getMergedItems(area);

    const fromIndex = draggedMerged.mergedIndex;
    const newMerged = [...merged];
    const [moved] = newMerged.splice(fromIndex, 1);
    let insertAt: number;
    if (fromIndex < dropMergedIndex) insertAt = dropAfter ? dropMergedIndex : dropMergedIndex - 1;
    else insertAt = dropAfter ? dropMergedIndex + 1 : dropMergedIndex;
    newMerged.splice(Math.max(0, Math.min(insertAt, newMerged.length)), 0, moved);

    // Assign new sequential display_orders across the full merged list
    const newCabinets = area.cabinets.map(c => ({ ...c }));
    const newSections = area.sections.map(s => ({ ...s }));
    newMerged.forEach((item, i) => {
      if (item.type === 'cabinet') {
        const cab = newCabinets.find(c => c.id === item.data.id);
        if (cab) cab.display_order = i;
      } else {
        const sec = newSections.find(s => s.id === item.data.id);
        if (sec) sec.display_order = i;
      }
    });

    setAreas(prev => prev.map((a, i) =>
      i === areaIndex ? { ...a, cabinets: newCabinets, sections: newSections } : a
    ));
    setDraggedMerged(null);

    for (const item of newMerged) {
      if (item.type === 'cabinet') {
        await supabase.from('area_cabinets').update({ display_order: newCabinets.find(c => c.id === item.data.id)!.display_order }).eq('id', item.data.id);
      } else {
        await supabase.from('area_sections').update({ display_order: newSections.find(s => s.id === item.data.id)!.display_order }).eq('id', item.data.id);
      }
    }
  }

  const cabinetsSubtotal = areas.reduce(
    (sum, area) => sum + area.cabinets.reduce((s, c) => s + (c.subtotal ?? 0), 0) * (area.quantity ?? 1),
    0
  );

  const itemsSubtotal = areas.reduce(
    (sum, area) => sum + area.items.reduce((s, i) => s + i.subtotal, 0) * (area.quantity ?? 1),
    0
  );

  const countertopsSubtotal = areas.reduce(
    (sum, area) => sum + area.countertops.reduce((s, ct) => s + ct.subtotal, 0) * (area.quantity ?? 1),
    0
  );

  const closetItemsSubtotal = areas.reduce(
    (sum, area) => sum + (area.closetItems || []).reduce((s, ci) => s + ci.subtotal_mxn, 0) * (area.quantity ?? 1),
    0
  );

  const materialsSubtotal = cabinetsSubtotal + itemsSubtotal + countertopsSubtotal + closetItemsSubtotal;

  const totalProjectBoxes = areas.reduce((sum, area) => {
    const { boxes } = calculateAreaBoxesAndPallets(area.cabinets, products, area.closetItems || []);
    return sum + boxes * (area.quantity ?? 1);
  }, 0);

  // Price (Sale Price of Materials)
  const price = profitMultiplier > 0 && profitMultiplier < 1
    ? materialsSubtotal / (1 - profitMultiplier)
    : materialsSubtotal;
  const profitAmount = price - materialsSubtotal;

  // Tariff - Calculated on Material Cost only for areas where applies_tariff is enabled
  const tariffableSubtotal = areas.reduce((sum, area) => {
    if (area.applies_tariff !== true) return sum;
    const qty = area.quantity ?? 1;
    return sum + (
      area.cabinets.reduce((s, c) => s + (c.subtotal ?? 0), 0) +
      area.items.reduce((s, i) => s + i.subtotal, 0) +
      area.countertops.reduce((s, ct) => s + ct.subtotal, 0) +
      (area.closetItems || []).reduce((s, ci) => s + ci.subtotal_mxn, 0)
    ) * qty;
  }, 0);
  const tariffAmount = tariffableSubtotal * tariffMultiplier;

  const installDeliveryMxn = installDelivery * exchangeRate;

  // Referral Fee - Applied to (Price + Install Cost)
  const referralAmount = (price + installDeliveryMxn) * referralRate;

  // Tax - Applied to (Price + Tariff)
  const taxAmount = (price + tariffAmount + referralAmount) * (taxPercentage / 100);

  // Grand Total
  const projectTotal = price + tariffAmount + referralAmount + taxAmount + installDeliveryMxn + otherExpenses;

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
    const filteredOriginalBrief = filterProjectBriefForPDF(project.project_brief || '');
    try {
      await supabase
        .from('quotations')
        .update({
          other_expenses: otherExpenses,
          other_expenses_label: otherExpensesLabel || 'Other Expenses',
          profit_multiplier: profitMultiplier,
          tariff_multiplier: tariffMultiplier,
          tax_percentage: taxPercentage,
          install_delivery_usd: installDelivery,
          install_delivery_per_box_usd: installDeliveryPerBox,
          install_delivery: installDeliveryMxn,
          referral_currency_rate: referralRate,
          total_amount: projectTotal,
          disclaimer_tariff_info: disclaimerTariffInfo,
          disclaimer_price_validity: disclaimerPriceValidity,
          pdf_project_name: pdfProjectName !== project.name ? pdfProjectName : null,
          pdf_customer: pdfCustomer !== (project.customer || '') ? pdfCustomer : null,
          pdf_address: pdfAddress !== (project.address || '') ? pdfAddress : null,
          pdf_project_brief: pdfProjectBrief !== filteredOriginalBrief ? pdfProjectBrief : null,
        })
        .eq('id', project.id);
      setProject(prev => ({
        ...prev,
        install_delivery: installDeliveryMxn,
        install_delivery_usd: installDelivery,
        install_delivery_per_box_usd: installDeliveryPerBox,
        profit_multiplier: profitMultiplier,
        tariff_multiplier: tariffMultiplier,
        tax_percentage: taxPercentage,
        other_expenses: otherExpenses,
        other_expenses_label: otherExpensesLabel,
        referral_currency_rate: referralRate,
        total_amount: projectTotal,
        disclaimer_tariff_info: disclaimerTariffInfo,
        disclaimer_price_validity: disclaimerPriceValidity,
        pdf_project_name: pdfProjectName !== project.name ? pdfProjectName : null,
        pdf_customer: pdfCustomer !== (project.customer || '') ? pdfCustomer : null,
        pdf_address: pdfAddress !== (project.address || '') ? pdfAddress : null,
        pdf_project_brief: pdfProjectBrief !== filteredOriginalBrief ? pdfProjectBrief : null,
      }));
    } catch (error) {
      console.error('Error updating project costs:', error);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 page-enter">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 skeleton-shimmer" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-32 skeleton-shimmer" />
            <div className="h-6 w-64 skeleton-shimmer" />
          </div>
        </div>
        <div className="h-48 skeleton-shimmer" />
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-10 w-20 skeleton-shimmer" />)}
        </div>
        <div className="glass-white h-[500px] animate-pulse" />
      </div>
    );
  }

  const tabs = [
    { id: 'info' as const, label: 'Info', icon: Receipt },
    { id: 'pricing' as const, label: 'Pricing', icon: Calculator },
    { id: 'cutlist' as const, label: 'Breakdown', icon: Layers },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
    { id: 'history' as const, label: 'History', icon: History },
  ];

  return (
    <div>
      <div style={{ position: 'fixed', top: '56px', left: 0, right: 0, zIndex: 40, background: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-7xl mx-auto flex items-center h-12 px-4 sm:px-6 lg:px-8" style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', alignItems: 'center', height: '48px', padding: '0 24px' }}>
          <button
            onClick={onBack}
            className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 text-sm text-slate-400 mr-4 flex-shrink-0 hidden sm:flex">
            {parentProject ? (
              <>
                <button onClick={onBack} className="hover:text-blue-600 transition-colors truncate max-w-[140px]">{parentProject.name}</button>
                <span>/</span>
                <span className="text-slate-700 font-medium truncate max-w-[160px]">{project.version_label || project.name}</span>
              </>
            ) : (
              <span className="text-slate-700 font-medium truncate max-w-[200px]">{project.name}</span>
            )}
          </div>
          <div className="flex flex-1 items-center overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 justify-center items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ height: '48px' }} />

      <FloatingActionBar
        onAddArea={() => setIsAreaModalOpen(true)}
        onChangeMaterials={() => {
          setBulkChangePreselectedAreaId(undefined);
          setIsBulkMaterialChangeOpen(true);
        }}
        onRecalculatePrices={() => setIsBulkPriceUpdateOpen(true)}
        onSaveChanges={handleSaveChanges}
        onPrint={handlePrint}
        onPrintUSD={handlePrintUSD}
        onPrintCutListEN={handlePrintCutListEN}
        onPrintCutListES={handlePrintCutListES}
        onExportCSV={handleExportAreasCSV}
        onExportDetailedCSV={handleExportDetailedAreasCSV}
        onExportJSON={handleExportJSON}
        onAddProduct={() => setIsAddProductOpen(true)}
        onSaveAreasOrder={saveAreasOrder}
        hasAreasOrderChanged={hasAreasOrderChanged}
        savingAreasOrder={savingAreasOrder}
        areasEmpty={areas.length === 0}
      />

      <div className="mb-6 mt-6 page-enter">

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm mb-6">
          <div className="flex justify-between items-start gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{project.name}</h1>
                <div className="relative inline-block">
                  {isStatusMenuOpen && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsStatusMenuOpen(false)}
                    />
                  )}
                  <button
                    onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer select-none transition-opacity hover:opacity-80 ${
                      project.status === 'Awarded' ? 'bg-green-100 text-green-700' :
                      project.status === 'Pending' ? 'bg-blue-100 text-blue-700' :
                      project.status === 'Estimating' ? 'bg-orange-100 text-orange-700' :
                      project.status === 'Sent' ? 'bg-cyan-100 text-cyan-700' :
                      project.status === 'Lost' ? 'bg-red-100 text-red-700' :
                      project.status === 'Discarded' ? 'bg-slate-100 text-slate-600' :
                      project.status === 'Cancelled' ? 'bg-gray-100 text-gray-600' :
                      'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {project.status ? project.status.toUpperCase() : 'NO STATUS'}
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </button>
                  {isStatusMenuOpen && (
                    <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                      {(['Pending', 'Estimating', 'Sent', 'Lost', 'Awarded', 'Discarded', 'Cancelled'] as const).map((status) => (
                        <button
                          key={status}
                          onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from('quotations')
                                .update({ status, updated_at: new Date().toISOString() })
                                .eq('id', project.id);
                              if (error) throw error;
                              setProject(prev => ({ ...prev, status }));
                              setIsStatusMenuOpen(false);
                            } catch (err) {
                              console.error('Error updating status:', err);
                            }
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 text-left"
                        >
                          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                            status === 'Awarded' ? 'bg-green-500' :
                            status === 'Pending' ? 'bg-blue-500' :
                            status === 'Estimating' ? 'bg-orange-500' :
                            status === 'Sent' ? 'bg-cyan-500' :
                            status === 'Lost' ? 'bg-red-500' :
                            status === 'Discarded' ? 'bg-slate-400' :
                            'bg-gray-400'
                          }`} />
                          {status}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {project.address && (
                <p className="text-slate-600 flex items-center gap-2 text-sm sm:text-base">
                  <span className="text-slate-400">📍</span> {project.address}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                {isEditingDate ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={editedQuoteDate}
                      onChange={(e) => setEditedQuoteDate(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveDateChange}
                      className="!px-2 !py-1 !text-xs"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsEditingDate(false);
                        setEditedQuoteDate(project.quote_date);
                      }}
                      className="!px-2 !py-1 !text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs sm:text-sm text-slate-500">
                      Quote Date: {new Date(project.quote_date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                        year: 'numeric'
                      })}
                    </p>
                    <button
                      onClick={async () => {
                        const today = new Date().toISOString().split('T')[0];
                        try {
                          const { error } = await supabase
                            .from('quotations')
                            .update({
                              quote_date: today,
                              updated_at: new Date().toISOString()
                            })
                            .eq('id', project.id);
                          if (error) throw error;
                          window.location.reload();
                        } catch (error) {
                          console.error('Error updating date:', error);
                          alert('Failed to update date: ' + (error instanceof Error ? error.message : String(error)));
                        }
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                    >
                      Update to Today
                    </button>
                    <button
                      onClick={() => setIsEditingDate(true)}
                      className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium"
                    >
                      Edit
                    </button>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Type: {project.project_type}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 text-right">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Project Total</div>
              <div className="text-2xl font-bold text-slate-900 leading-tight">
                {formatPrice(projectTotal)}{' '}
                <span className="text-sm font-normal text-slate-500">
                  {currencyDisplay === 'BOTH' ? 'MXN + USD' : currencyDisplay}
                </span>
              </div>
              <div className="mt-3 flex justify-end">
                <div
                  style={{
                    display: 'inline-flex',
                    background: '#e9ecef',
                    borderRadius: '7px',
                    padding: '3px',
                    gap: '2px',
                  }}
                >
                  {(['USD', 'MXN', 'BOTH'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrencyDisplay(c)}
                      style={{
                        fontSize: '11px',
                        padding: '4px 12px',
                        borderRadius: '5px',
                        border: currencyDisplay === c ? '0.5px solid #d1d5db' : 'none',
                        background: currencyDisplay === c ? 'white' : 'transparent',
                        color: currencyDisplay === c ? '#0f172a' : '#64748b',
                        cursor: 'pointer',
                        fontWeight: currencyDisplay === c ? 600 : 400,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {c === 'BOTH' ? 'Both' : c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {project.project_details && (
            <div className="mt-4 p-4 bg-white border border-slate-200 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Notes
              </h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{project.project_details}</p>
            </div>
          )}
        </div>

      </div>

      {activeTab === 'pricing' && hasStalePrices && (
        <div className="mb-6 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-yellow-900 mb-1">Price Updates Available</h3>
              <p className="text-sm text-yellow-800 mb-3">
                Some materials in this project have outdated prices. Your price list has been updated since these cabinets were created.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  size="sm"
                  onClick={() => setIsBulkPriceUpdateOpen(true)}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Review & Update Prices
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setHasStalePrices(false)}
                  className="text-yellow-800 hover:bg-yellow-100"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'info' && (
      <div className="mb-6 space-y-4">

        <div className="glass-indigo p-4">
          <div className="flex items-center mb-4">
            <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-slate-900">Additional Costs</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Other Expenses Label
              </label>
              <input
                type="text"
                value={otherExpensesLabel}
                onChange={(e) => setOtherExpensesLabel(e.target.value)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                placeholder="Other Expenses"
              />
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {otherExpensesLabel || 'Other Expenses'} Amount
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
              <p className="mt-1 text-xs text-slate-500">
                Flat amount{otherExpenses > 0 && exchangeRate > 0 ? ` · $${(otherExpenses / exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD` : ''}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Design services, Install & Delivery (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={installDelivery}
                onChange={(e) => {
                  setInstallDelivery(parseFloat(e.target.value) || 0);
                  if (installDeliveryPerBox > 0) setInstallDeliveryPerBox(0);
                }}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-slate-500">
                Flat amount in USD{installDelivery > 0 && exchangeRate > 0 ? ` · $${(installDelivery * exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN` : ''}
              </p>
              <label className="block text-sm font-medium text-slate-700 mb-1 mt-3">
                Per-box rate (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={installDeliveryPerBox}
                onChange={(e) => setInstallDeliveryPerBox(parseFloat(e.target.value) || 0)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-slate-500">
                {installDeliveryPerBox > 0 && exchangeRate > 0
                  ? `$${installDeliveryPerBox.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD/box × ${totalProjectBoxes} boxes = $${(installDeliveryPerBox * totalProjectBoxes).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD (≈ $${(installDeliveryPerBox * totalProjectBoxes * exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN)`
                  : 'Multiplied by total project boxes'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Profit Multiplier
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={profitMultiplier}
                onChange={(e) => setProfitMultiplier(parseFloat(e.target.value) || 0)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.50"
              />
              <p className="mt-1 text-xs text-slate-500">
                {profitMultiplier > 0 ? `${formatPrice(profitAmount)} (${(profitMultiplier * 100).toFixed(1)}%)` : 'e.g., 0.5 = 50% markup'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tariff Multiplier
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={tariffMultiplier}
                onChange={(e) => setTariffMultiplier(parseFloat(e.target.value) || 0)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.11"
              />
              <p className="mt-1 text-xs text-slate-500">
                {tariffMultiplier > 0 ? `${formatPrice(tariffAmount)} (${(tariffMultiplier * 100).toFixed(2)}%)` : 'e.g., 0.11 = 11% of cost'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tax (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={taxPercentage}
                onChange={(e) => setTaxPercentage(parseFloat(e.target.value) || 0)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="8.25"
              />
              <p className="mt-1 text-xs text-slate-500">
                {taxPercentage > 0 ? formatPrice(taxAmount) : 'e.g., 8.25 for 8.25% tax'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Referral %
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={referralRate}
                onChange={(e) => setReferralRate(parseFloat(e.target.value) || 0)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.06"
              />
              <p className="mt-1 text-xs text-slate-500">
                {referralRate > 0 ? `${formatPrice(referralAmount)} (${(referralRate * 100).toFixed(2)}%) on Price + Install` : 'e.g., 0.06 = 6% of (Price + Install)'}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-600">Cabinets Subtotal:</p>
                <p className="text-sm text-slate-600">Countertops Subtotal:</p>
                <p className="text-sm text-slate-600">Prefab Closets Subtotal:</p>
                <p className="text-sm text-slate-600">Individual Items Subtotal:</p>
                <p className="text-sm text-slate-600 mt-2 pt-2 border-t border-slate-300">Materials Subtotal:</p>
                {profitMultiplier > 0 && <p className="text-sm text-slate-600">Profit ({(profitMultiplier * 100).toFixed(1)}%):</p>}
                <p className="text-sm font-semibold text-slate-900 mt-2 pt-2 border-t border-slate-300">Price:</p>
                {tariffMultiplier > 0 && <p className="text-sm text-slate-600">Tariff ({(tariffMultiplier * 100).toFixed(2)}%):</p>}
                {referralRate > 0 && <p className="text-sm text-slate-600">Referral Fee ({(referralRate * 100).toFixed(2)}%):</p>}
                {taxPercentage > 0 && <p className="text-sm text-slate-600">Tax ({taxPercentage}%):</p>}
                <p className="text-sm text-slate-600">Design services, Install & Delivery:</p>
                <p className="text-sm text-slate-600">{otherExpensesLabel || 'Other Expenses'}:</p>
                <p className="text-base font-semibold text-slate-900 mt-2 pt-2 border-t border-slate-300">Total:</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-700">{formatPrice(cabinetsSubtotal)}</p>
                <p className="text-sm font-medium text-slate-700">{formatPrice(countertopsSubtotal)}</p>
                <p className="text-sm font-medium text-slate-700">{formatPrice(closetItemsSubtotal)}</p>
                <p className="text-sm font-medium text-slate-700">{formatPrice(itemsSubtotal)}</p>
                <p className="text-sm font-semibold text-slate-900 mt-2 pt-2 border-t border-slate-300">{formatPrice(materialsSubtotal)}</p>
                {profitMultiplier > 0 && <p className="text-sm font-medium text-slate-700">{formatPrice(profitAmount)}</p>}
                <p className="text-sm font-bold text-blue-900 mt-2 pt-2 border-t border-slate-300">{formatPrice(price)}</p>
                {tariffMultiplier > 0 && <p className="text-sm font-medium text-slate-700">{formatPrice(tariffAmount)}</p>}
                {referralRate > 0 && <p className="text-sm font-medium text-slate-700">{formatPrice(referralAmount)}</p>}
                {taxPercentage > 0 && <p className="text-sm font-medium text-slate-700">{formatPrice(taxAmount)}</p>}
                <p className="text-sm font-medium text-slate-700">{formatPrice(installDeliveryMxn)}</p>
                <p className="text-sm font-medium text-slate-700">{formatPrice(otherExpenses)}</p>
                <p className="text-base font-bold text-slate-900 mt-2 pt-2 border-t border-slate-300">{formatPrice(projectTotal)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center mb-4">
            <Receipt className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-slate-900">PDF Disclaimers</h3>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Customize the disclaimer text that appears in the USD Summary PDF below the pricing table.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tariff Information Disclaimer
              </label>
              <textarea
                value={disclaimerTariffInfo}
                onChange={(e) => setDisclaimerTariffInfo(e.target.value)}
                onBlur={updateProjectCosts}
                rows={2}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="e.g., Please note that the international tariff..."
              />
              <p className="mt-1 text-xs text-slate-500">
                Information about tariff percentages and impact
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Price Validity & Conditions Disclaimer
              </label>
              <textarea
                value={disclaimerPriceValidity}
                onChange={(e) => setDisclaimerPriceValidity(e.target.value)}
                onBlur={updateProjectCosts}
                rows={3}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="e.g., Grand Total includes delivery cost and tax..."
              />
              <p className="mt-1 text-xs text-slate-500">
                What's included/excluded and price validity period
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-slate-900">PDF Project Details</h3>
            </div>
            {isAnyPdfFieldModified && (
              <button
                onClick={() => {
                  setPdfProjectName(project.name);
                  setPdfCustomer(project.customer || '');
                  setPdfAddress(project.address || '');
                  setPdfProjectBrief(filterProjectBriefForPDF(project.project_brief || ''));
                  setTimeout(updateProjectCosts, 0);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset All
              </button>
            )}
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg mb-4">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              These values default to your Project Brief. Changes here only affect PDF output and will not modify your original Project Brief.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">Project Name</label>
                  {isPdfNameModified && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                      Modified
                    </span>
                  )}
                </div>
                {isPdfNameModified && (
                  <button
                    onClick={() => { setPdfProjectName(project.name); setTimeout(updateProjectCosts, 0); }}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>
              <input
                type="text"
                value={pdfProjectName}
                onChange={(e) => setPdfProjectName(e.target.value)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Project name as it appears on PDFs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">Customer</label>
                  {isPdfCustomerModified && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                      Modified
                    </span>
                  )}
                </div>
                {isPdfCustomerModified && (
                  <button
                    onClick={() => { setPdfCustomer(project.customer || ''); setTimeout(updateProjectCosts, 0); }}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>
              <input
                type="text"
                value={pdfCustomer}
                onChange={(e) => setPdfCustomer(e.target.value)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Customer name as it appears on PDFs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">Address</label>
                  {isPdfAddressModified && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                      Modified
                    </span>
                  )}
                </div>
                {isPdfAddressModified && (
                  <button
                    onClick={() => { setPdfAddress(project.address || ''); setTimeout(updateProjectCosts, 0); }}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>
              <input
                type="text"
                value={pdfAddress}
                onChange={(e) => setPdfAddress(e.target.value)}
                onBlur={updateProjectCosts}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Address as it appears on PDFs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">Project Brief / Details</label>
                  {isPdfBriefModified && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                      Modified
                    </span>
                  )}
                </div>
                {isPdfBriefModified && (
                  <button
                    onClick={() => { setPdfProjectBrief(filterProjectBriefForPDF(project.project_brief || '')); setTimeout(updateProjectCosts, 0); }}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>
              <textarea
                value={pdfProjectBrief}
                onChange={(e) => setPdfProjectBrief(e.target.value)}
                onBlur={updateProjectCosts}
                rows={6}
                className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                placeholder="Project details as they appear on PDFs (CABINET TYPES, ACCESSORIES, and OTHER sections are excluded automatically)"
              />
              <p className="mt-1 text-xs text-slate-500">
                This is the filtered version shown in PDFs — CABINET TYPES, ACCESSORIES, and OTHER sections are excluded.
              </p>
            </div>
          </div>
        </div>

        {project.project_brief && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2 mb-3">
              <Package className="h-4 w-4" />
              Project Brief
            </h3>
            <p className="text-sm text-blue-900 whitespace-pre-wrap font-mono">{project.project_brief}</p>
          </div>
        )}
      </div>
      )}

      {activeTab === 'analytics' && (
        <ErrorBoundary>
          <div className="mb-6 space-y-6">
            {loading ? (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Loading analytics...</p>
              </div>
            ) : areas.length > 0 ? (
              <>
                <ProjectCharts areas={areas} products={products} />

                <MaterialBreakdown areas={areas} />

                <OptimizerRunsAnalytics quotationId={project.id} />

                <QuotationBOM
                  areas={areas}
                  projectId={project.id}
                  quotation={project}
                />
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 font-medium">No data yet</p>
                <p className="text-sm text-slate-400 mt-1">Add areas and cabinets to see analytics</p>
              </div>
            )}
          </div>
        </ErrorBoundary>
      )}

      {activeTab === 'cutlist' && (
        <QuotationOptimizerTab
          quotationId={project.id}
          totalCabinetsCount={areas.reduce((s, a) => s + a.cabinets.length, 0)}
          areasById={Object.fromEntries(areas.map((a) => [a.id, a.name]))}
          onRecomputeRollup={() => updateProjectTotal(areas)}
        />
      )}

      {activeTab === 'history' && (
        <ProjectVersionHistory
          projectId={project.id}
          projectName={project.name}
          onBack={() => {
            setActiveTab('pricing');
            loadVersionCount();
          }}
        />
      )}

      {activeTab === 'pricing' && (
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

              return filteredAreas.map((area, index) => (
            <div
              key={area.id}
              className="bg-white rounded-lg shadow-sm border border-slate-200 transition-all duration-200 relative"
            >
              <div className="border-b border-slate-200 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div className="flex items-start gap-2 flex-1">
                    {areas.length > 1 && (
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col gap-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveAreaUp(index);
                            }}
                            disabled={index === 0}
                            className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            aria-label={`Move ${area.name} up`}
                            title="Move area up"
                          >
                            <ChevronUp className="h-3.5 w-3.5 text-slate-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveAreaDown(index);
                            }}
                            disabled={index === filteredAreas.length - 1}
                            className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            aria-label={`Move ${area.name} down`}
                            title="Move area down"
                          >
                            <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex-1">
                      <h2 className="text-lg sm:text-xl font-semibold text-slate-900">{area.name}</h2>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600">
                      {countActualCabinets(area.cabinets)} cabinet{countActualCabinets(area.cabinets) !== 1 ? 's' : ''} ({countCabinetEntries(area.cabinets)} {countCabinetEntries(area.cabinets) !== 1 ? 'entries' : 'entry'})
                      {area.cabinets.length !== countCabinetEntries(area.cabinets) && (
                        <span className="ml-2 text-purple-600">+ {area.cabinets.length - countCabinetEntries(area.cabinets)} accessories</span>
                      )}
                    </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:space-x-4 sm:gap-0">
                    {tariffMultiplier > 0 && (
                      <button
                        onClick={async () => {
                          const newValue = !(area.applies_tariff === true);
                          setAreas(prev => prev.map(a => a.id === area.id ? { ...a, applies_tariff: newValue } : a));
                          const { error } = await supabase
                            .from('project_areas')
                            .update({ applies_tariff: newValue })
                            .eq('id', area.id);
                          if (error) {
                            setAreas(prev => prev.map(a => a.id === area.id ? { ...a, applies_tariff: !newValue } : a));
                          }
                        }}
                        title={area.applies_tariff === true ? 'Tariff applied to this area — click to disable' : 'Tariff not applied — click to enable'}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          area.applies_tariff === true
                            ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                            : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${area.applies_tariff === true ? 'bg-amber-500' : 'bg-slate-300'}`} />
                        Tariff
                      </button>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-slate-500 font-medium whitespace-nowrap">Qty</label>
                        <input
                          type="number"
                          min={1}
                          value={area.quantity ?? 1}
                          onChange={async (e) => {
                            const newQty = Math.max(1, parseInt(e.target.value) || 1);
                            setAreas(prev => prev.map(a => a.id === area.id ? { ...a, quantity: newQty } : a));
                            await supabase.from('project_areas').update({ quantity: newQty }).eq('id', area.id);
                            await updateProjectTotal(
                              areas.map(a => a.id === area.id ? { ...a, quantity: newQty } : a)
                            );
                          }}
                          className={`w-14 px-1.5 py-1 text-sm text-center border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            (area.quantity ?? 1) > 1
                              ? 'border-blue-300 bg-blue-50 text-blue-800 font-semibold'
                              : 'border-slate-200 bg-slate-50 text-slate-400'
                          }`}
                          title="Area quantity multiplier — all subtotals are multiplied by this number"
                        />
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-xs sm:text-sm text-slate-600">Area Total</div>
                        {(() => {
                          const rawTotal =
                            area.cabinets.reduce((sum, c) => sum + (c.subtotal ?? 0), 0) +
                            area.countertops.reduce((sum, ct) => sum + ct.subtotal, 0) +
                            area.items.reduce((sum, i) => sum + i.subtotal, 0) +
                            (area.closetItems || []).reduce((sum, ci) => sum + ci.subtotal_mxn, 0);
                          const qty = area.quantity ?? 1;
                          return qty > 1 ? (
                            <div>
                              <div className="text-xs text-slate-500">{formatCurrency(rawTotal)} × {qty}</div>
                              <div className="text-base sm:text-xl font-bold text-blue-900">{formatCurrency(rawTotal * qty)}</div>
                            </div>
                          ) : (
                            <div className="text-base sm:text-xl font-bold text-slate-900">{formatCurrency(rawTotal)}</div>
                          );
                        })()}
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
                        onClick={() => handleDuplicateArea(area)}
                        title="Duplicate area"
                      >
                        <Copy className="h-4 w-4 text-slate-600" />
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
                  <Button size="sm" variant="outline" onClick={() => handleAddSection(area.id)} className="w-full sm:w-auto border-purple-300 hover:bg-purple-50 text-purple-700">
                    <SeparatorHorizontal className="h-4 w-4 mr-2" />
                    Add Section
                  </Button>
                  {/* TEMP_DISABLED: Remove this comment block to re-enable the Add Closet button
                  <Button size="sm" variant="outline" onClick={() => { setSelectedAreaForCloset(area.id); setEditingClosetItem(null); }} className="w-full sm:w-auto border-teal-300 hover:bg-teal-50">
                    <Package className="h-4 w-4 mr-2" />
                    Add Closet
                  </Button>
                  */}
                </div>

                {area.cabinets.length === 0 && area.items.length === 0 && area.countertops.length === 0 && (area.closetItems || []).length === 0 && (area.sections || []).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600 mb-3">No cabinets, countertops, items, or closets in this area</p>
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
                      </>
                    )}

                    {(area.cabinets.length > 0 || area.sections.length > 0) && (
                      <div className="space-y-2">
                        {getMergedItems(area).map((item, mergedIndex) => {
                          const totalMerged = getMergedItems(area).length;
                          const isDropBefore = mergedDropTarget?.areaId === area.id && mergedDropTarget?.mergedIndex === mergedIndex && mergedDropTarget?.position === 'before';
                          const isDropAfter = mergedDropTarget?.areaId === area.id && mergedDropTarget?.mergedIndex === mergedIndex && mergedDropTarget?.position === 'after';

                          if (item.type === 'section') {
                            return (
                              <SectionDivider
                                key={item.data.id}
                                section={item.data}
                                onRename={(name) => handleRenameSection(item.data, name)}
                                onDelete={() => handleDeleteSection(item.data)}
                                draggable={totalMerged > 1}
                                onDragStart={(e) => handleMergedDragStart(e, area.id, mergedIndex)}
                                onDragEnd={handleMergedDragEnd}
                                onDragOver={(e) => handleMergedDragOver(e, area.id, mergedIndex)}
                                onDrop={(e) => handleMergedDrop(e, area.id, mergedIndex)}
                                isDropBefore={isDropBefore}
                                isDropAfter={isDropAfter}
                              />
                            );
                          }
                          const cabinet = item.data;
                          const product = products.find(p => p.sku === cabinet.product_sku);
                          const otherAreas = areas.filter(a => a.id !== area.id).map(a => ({ id: a.id, name: a.name }));
                          return (
                            <div
                              key={cabinet.id}
                              className="relative"
                              draggable={totalMerged > 1}
                              onDragStart={(e) => handleMergedDragStart(e, area.id, mergedIndex)}
                              onDragEnd={handleMergedDragEnd}
                              onDragOver={(e) => handleMergedDragOver(e, area.id, mergedIndex)}
                              onDrop={(e) => handleMergedDrop(e, area.id, mergedIndex)}
                            >
                              {isDropBefore && (
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-green-500 z-10" style={{ marginTop: '-1px' }} />
                              )}
                              {isDropAfter && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-green-500 z-10" style={{ marginBottom: '-1px' }} />
                              )}
                              <div className="flex items-start gap-2">
                                {totalMerged > 1 && (
                                  <div
                                    className="flex-shrink-0 mt-3 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-slate-100 transition-colors"
                                    title="Drag to reorder"
                                  >
                                    <GripVertical className="h-4 w-4 text-slate-300" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <CabinetCard
                                    cabinet={cabinet}
                                    onEdit={() => handleEditCabinet(cabinet)}
                                    onDelete={() => handleDeleteCabinet(cabinet)}
                                    onDuplicate={() => handleDuplicateCabinet(cabinet)}
                                    onSaveAsTemplate={() => handleSaveAsTemplate(cabinet)}
                                    onMove={otherAreas.length > 0 ? (targetAreaId) => handleMoveCabinet(cabinet, targetAreaId) : undefined}
                                    availableAreas={otherAreas}
                                    productDescription={product?.description}
                                    product={product}
                                    priceList={priceList}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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

                    {(area.closetItems || []).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-slate-700 text-sm">Prefab Closets</h4>
                        <div className="space-y-2">
                          {(area.closetItems || []).map((closetItem) => (
                            <div
                              key={closetItem.id}
                              className="bg-teal-50 border border-teal-200 rounded-lg p-4"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 flex-wrap gap-1">
                                    <h4 className="font-semibold text-slate-900">
                                      {closetItem.catalog_item
                                        ? `${closetItem.catalog_item.evita_line} — ${closetItem.catalog_item.description}`
                                        : 'Closet Item'}
                                    </h4>
                                    <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                                      Prefab Closet
                                    </span>
                                    {closetItem.catalog_item && (
                                      <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                        {closetItem.catalog_item.cabinet_code}
                                      </span>
                                    )}
                                  </div>
                                  {closetItem.catalog_item && (
                                    <div className="mt-1 text-xs text-teal-700">
                                      {closetItem.catalog_item.width_in}" W × {closetItem.catalog_item.height_in}" H × {closetItem.catalog_item.depth_in}" D
                                      {closetItem.catalog_item.has_backs_option && (
                                        <span className="ml-2">{closetItem.with_backs ? '(with backs)' : '(no backs)'}</span>
                                      )}
                                    </div>
                                  )}
                                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-slate-600">Quantity:</span>
                                      <span className="font-medium">{closetItem.quantity}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-600">Unit Price:</span>
                                      <span className="font-medium">${closetItem.unit_price_usd.toFixed(2)} USD</span>
                                    </div>
                                    <div className="flex justify-between col-span-2 pt-1 border-t border-teal-200">
                                      <span className="text-slate-600 font-medium">Subtotal:</span>
                                      <span className="font-semibold text-teal-900">
                                        {formatPrice(closetItem.subtotal_mxn)}
                                      </span>
                                    </div>
                                  </div>
                                  {closetItem.notes && (
                                    <div className="mt-2 text-xs text-slate-600 italic">
                                      Note: {closetItem.notes}
                                    </div>
                                  )}
                                </div>
                                <div className="flex space-x-1 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedAreaForCloset(closetItem.area_id);
                                      setEditingClosetItem(closetItem);
                                    }}
                                  >
                                    <Edit2 className="h-4 w-4 text-slate-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteClosetItem(closetItem.id)}
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
      )}

      {isAreaModalOpen && (
        <AreaFormModal
          area={editingArea}
          onSave={handleSaveArea}
          onClose={() => {
            setIsAreaModalOpen(false);
            setEditingArea(null);
          }}
          tariffMultiplier={tariffMultiplier}
        />
      )}

      {selectedAreaForCabinet && (
        <CabinetForm
          areaId={selectedAreaForCabinet}
          cabinet={editingCabinet}
          onClose={handleCloseCabinetForm}
        />
      )}

      {selectedAreaForItem && (
        <ItemForm
          areaId={selectedAreaForItem}
          item={editingItem}
          onClose={handleCloseItemForm}
        />
      )}

      {selectedAreaForCountertop && (
        <CountertopForm
          areaId={selectedAreaForCountertop}
          countertop={editingCountertop}
          onClose={handleCloseCountertopForm}
        />
      )}

      {selectedAreaForCloset && (
        <ClosetForm
          areaId={selectedAreaForCloset}
          closetItem={editingClosetItem}
          onClose={handleCloseClosetForm}
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
          await loadAreas();
          await loadVersionCount();
        }}
        projectId={project.id}
        areas={areas}
        preselectedAreaId={bulkChangePreselectedAreaId}
      />

      <MaterialPriceUpdateModal
        isOpen={isBulkPriceUpdateOpen}
        onClose={() => setIsBulkPriceUpdateOpen(false)}
        projectId={project.id}
        onSuccess={async () => {
          await loadAreas();
          await checkStalePrices();
          await loadVersionCount();
        }}
      />

      {isAddProductOpen && (
        <ProductFormModal
          product={null}
          onSave={handleSaveNewProduct}
          onClose={() => setIsAddProductOpen(false)}
        />
      )}
    </div>
  );
}

interface AreaFormModalProps {
  area: ProjectArea | null;
  onSave: (area: ProjectAreaInsert) => void;
  onClose: () => void;
  tariffMultiplier: number;
}

function AreaFormModal({ area, onSave, onClose, tariffMultiplier }: AreaFormModalProps) {
  const [name, setName] = useState(area?.name || '');
  const [appliesTariff, setAppliesTariff] = useState(area ? (area.applies_tariff ?? true) : true);

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
    onSave({ name, applies_tariff: appliesTariff } as ProjectAreaInsert);
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

        {tariffMultiplier > 0 && (
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <button
              type="button"
              onClick={() => setAppliesTariff((v) => !v)}
              className="flex items-center gap-3 w-full text-left"
            >
              <div
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                  appliesTariff ? 'bg-amber-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    appliesTariff ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Apply Tariff to this area</p>
                <p className="text-xs text-slate-500">
                  {appliesTariff
                    ? 'Tariff will be included in this area\'s total'
                    : 'Tariff will not be applied to this area'}
                </p>
              </div>
            </button>
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
