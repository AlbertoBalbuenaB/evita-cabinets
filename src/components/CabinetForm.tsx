import { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Info, Bookmark, Layers, AlertCircle, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { AutocompleteSelect } from './AutocompleteSelect';
import { TemplateSelectorModal } from './TemplateSelectorModal';
import { logTemplateUsage } from '../lib/templateManager';
import type { CabinetTemplate } from '../types';
import { getSettings } from '../lib/settingsStore';
import {
  calculateBoxMaterialCost,
  calculateBoxEdgebandCost,
  calculateDoorsMaterialCost,
  calculateDoorsEdgebandCost,
  calculateInteriorFinishCost,
  calculateHardwareCost,
  calculateAccessoriesCost,
  calculateLaborCost,
  formatCurrency,
} from '../lib/calculations';
import type {
  Product,
  PriceListItem,
  AreaCabinet,
  HardwareItem,
  AccessoryItem,
} from '../types';

interface CabinetFormProps {
  areaId: string;
  cabinet: AreaCabinet | null;
  onClose: () => void;
}

export function CabinetForm({ areaId, cabinet, onClose }: CabinetFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ laborCostNoDrawers: 400, laborCostWithDrawers: 600, laborCostAccessories: 100, wastePercentageBox: 10, wastePercentageDoors: 10 });
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(cabinet?.quantity || 1);

  const [boxSectionExpanded, setBoxSectionExpanded] = useState(true);
  const [doorsSectionExpanded, setDoorsSectionExpanded] = useState(true);
  const [hardwareSectionExpanded, setHardwareSectionExpanded] = useState(false);
  const [accessoriesSectionExpanded, setAccessoriesSectionExpanded] = useState(false);

  const [boxMaterialId, setBoxMaterialId] = useState(cabinet?.box_material_id || '');
  const [boxEdgebandId, setBoxEdgebandId] = useState(cabinet?.box_edgeband_id || '');
  const [boxInteriorFinishId, setBoxInteriorFinishId] = useState(
    cabinet?.box_interior_finish_id || ''
  );
  const [useBoxInteriorFinish, setUseBoxInteriorFinish] = useState(
    !!cabinet?.box_interior_finish_id
  );

  const [doorsMaterialId, setDoorsMaterialId] = useState(cabinet?.doors_material_id || '');
  const [doorsEdgebandId, setDoorsEdgebandId] = useState(cabinet?.doors_edgeband_id || '');
  const [doorsInteriorFinishId, setDoorsInteriorFinishId] = useState(
    cabinet?.doors_interior_finish_id || ''
  );
  const [useDoorsInteriorFinish, setUseDoorsInteriorFinish] = useState(
    !!cabinet?.doors_interior_finish_id
  );

  const [hardware, setHardware] = useState<HardwareItem[]>(
    cabinet?.hardware ? (JSON.parse(JSON.stringify(cabinet.hardware)) as HardwareItem[]) : []
  );

  const [accessories, setAccessories] = useState<AccessoryItem[]>(
    cabinet?.accessories ? (JSON.parse(JSON.stringify(cabinet.accessories)) as AccessoryItem[]) : []
  );

  const [isRta, setIsRta] = useState(cabinet?.is_rta ?? true);

  useEffect(() => {
    if (selectedProduct) {
      const hasDrawers = selectedProduct.description.toLowerCase().includes('drawer');
      if (cabinet === null) {
        setIsRta(!hasDrawers);
      }
    }
  }, [selectedProduct, cabinet]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [productsRes, pricesRes, settingsData] = await Promise.all([
        supabase.from('products_catalog').select('*').eq('is_active', true).order('sku'),
        supabase.from('price_list').select('*').eq('is_active', true).order('concept_description'),
        getSettings(),
      ]);

      setProducts(productsRes.data || []);
      setPriceList(pricesRes.data || []);
      setSettings(settingsData);

      if (cabinet?.product_sku) {
        const product = (productsRes.data as any[])?.find((p: any) => p.sku === cabinet.product_sku);
        setSelectedProduct(product || null);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateCosts() {
    if (!selectedProduct) return null;

    const boxMaterial = boxMaterialId ? priceList.find((p) => p.id === boxMaterialId) : null;
    const boxEdgeband = boxEdgebandId ? priceList.find((p) => p.id === boxEdgebandId) : null;
    const boxInteriorFinish = boxInteriorFinishId
      ? priceList.find((p) => p.id === boxInteriorFinishId)
      : null;

    const doorsMaterial = doorsMaterialId ? priceList.find((p) => p.id === doorsMaterialId) : null;
    const doorsEdgeband = doorsEdgebandId ? priceList.find((p) => p.id === doorsEdgebandId) : null;
    const doorsInteriorFinish = doorsInteriorFinishId
      ? priceList.find((p) => p.id === doorsInteriorFinishId)
      : null;

    const boxMaterialCost = boxMaterial && boxEdgeband
      ? calculateBoxMaterialCost(selectedProduct, boxMaterial, quantity)
      : 0;
    const boxEdgebandCost = boxMaterial && boxEdgeband
      ? calculateBoxEdgebandCost(selectedProduct, boxEdgeband, quantity)
      : 0;
    const boxInteriorFinishCost = boxInteriorFinish && boxMaterial && boxEdgeband
      ? calculateInteriorFinishCost(selectedProduct, boxInteriorFinish, quantity, true)
      : 0;

    const doorsMaterialCost = doorsMaterial && doorsEdgeband
      ? calculateDoorsMaterialCost(selectedProduct, doorsMaterial, quantity)
      : 0;
    const doorsEdgebandCost = doorsMaterial && doorsEdgeband
      ? calculateDoorsEdgebandCost(selectedProduct, doorsEdgeband, quantity)
      : 0;
    const doorsInteriorFinishCost = doorsInteriorFinish && doorsMaterial && doorsEdgeband
      ? calculateInteriorFinishCost(selectedProduct, doorsInteriorFinish, quantity, false)
      : 0;

    const hardwareCost = calculateHardwareCost(hardware, quantity, priceList);
    const accessoriesCost = calculateAccessoriesCost(accessories, quantity, priceList);
    const laborCost = calculateLaborCost(selectedProduct, quantity, settings.laborCostNoDrawers, settings.laborCostWithDrawers, settings.laborCostAccessories);

    const subtotal =
      boxMaterialCost +
      boxEdgebandCost +
      boxInteriorFinishCost +
      doorsMaterialCost +
      doorsEdgebandCost +
      doorsInteriorFinishCost +
      hardwareCost +
      accessoriesCost +
      laborCost;

    return {
      boxMaterialCost,
      boxEdgebandCost,
      boxInteriorFinishCost,
      doorsMaterialCost,
      doorsEdgebandCost,
      doorsInteriorFinishCost,
      hardwareCost,
      accessoriesCost,
      laborCost,
      subtotal,
    };
  }

  function handleLoadTemplate(template: CabinetTemplate) {
    const product = products.find(p => p.sku === template.product_sku);
    if (product) {
      setSelectedProduct(product);
    }

    setBoxMaterialId(template.box_material_id || '');
    setBoxEdgebandId(template.box_edgeband_id || '');
    setBoxInteriorFinishId(template.box_interior_finish_id || '');
    setUseBoxInteriorFinish(template.use_box_interior_finish);

    setDoorsMaterialId(template.doors_material_id || '');
    setDoorsEdgebandId(template.doors_edgeband_id || '');
    setDoorsInteriorFinishId(template.doors_interior_finish_id || '');
    setUseDoorsInteriorFinish(template.use_doors_interior_finish);

    setHardware(Array.isArray(template.hardware) ? template.hardware : []);
    setAccessories(Array.isArray(template.accessories) ? template.accessories : []);
    setIsRta(template.is_rta);

    setLoadedTemplateId(template.id);
    setShowTemplateSelector(false);
    setQuantity(1);
  }

  async function handleSave() {
    if (!selectedProduct) {
      alert('Please select a product');
      return;
    }

    const costs = calculateCosts();
    if (!costs) {
      alert('Please fill in all required material selections');
      return;
    }

    setLoading(true);

    const boxMaterial = priceList.find(p => p.id === boxMaterialId);
    const boxEdgeband = priceList.find(p => p.id === boxEdgebandId);
    const boxInteriorFinish = useBoxInteriorFinish ? priceList.find(p => p.id === boxInteriorFinishId) : null;
    const doorsMaterial = priceList.find(p => p.id === doorsMaterialId);
    const doorsEdgeband = priceList.find(p => p.id === doorsEdgebandId);
    const doorsInteriorFinish = useDoorsInteriorFinish ? priceList.find(p => p.id === doorsInteriorFinishId) : null;

    const cabinetData: any = {
      area_id: areaId,
      product_sku: selectedProduct.sku,
      quantity,
      box_material_id: boxMaterialId,
      box_edgeband_id: boxEdgebandId,
      box_interior_finish_id: useBoxInteriorFinish ? boxInteriorFinishId : null,
      doors_material_id: doorsMaterialId,
      doors_edgeband_id: doorsEdgebandId,
      doors_interior_finish_id: useDoorsInteriorFinish ? doorsInteriorFinishId : null,
      hardware: hardware as any,
      accessories: accessories as any,
      is_rta: isRta,
      box_material_cost: costs.boxMaterialCost,
      box_edgeband_cost: costs.boxEdgebandCost,
      box_interior_finish_cost: costs.boxInteriorFinishCost,
      doors_material_cost: costs.doorsMaterialCost,
      doors_edgeband_cost: costs.doorsEdgebandCost,
      doors_interior_finish_cost: costs.doorsInteriorFinishCost,
      hardware_cost: costs.hardwareCost,
      accessories_cost: costs.accessoriesCost,
      labor_cost: costs.laborCost,
      subtotal: costs.subtotal,
      original_box_material_price: boxMaterial?.price || null,
      original_box_edgeband_price: boxEdgeband?.price || null,
      original_box_interior_finish_price: boxInteriorFinish?.price || null,
      original_doors_material_price: doorsMaterial?.price || null,
      original_doors_edgeband_price: doorsEdgeband?.price || null,
      original_doors_interior_finish_price: doorsInteriorFinish?.price || null,
    };


    try {
      if (cabinet) {
        const { error } = await supabase
          .from('area_cabinets')
          .update(cabinetData)
          .eq('id', cabinet.id)
          .select();

        if (error) {
          console.error('Update error details:', error);
          throw error;
        }
      } else {
        const { data, error } = await supabase.from('area_cabinets').insert([cabinetData as any]).select();

        if (error) {
          console.error('Insert error details:', error);
          throw error;
        }

        if (loadedTemplateId && data && data.length > 0) {
          const cabinetId = data[0].id;
          const projectIdResult = await supabase
            .from('project_areas')
            .select('project_id')
            .eq('id', areaId)
            .single();

          if (projectIdResult.data) {
            await logTemplateUsage(
              loadedTemplateId,
              projectIdResult.data.project_id,
              areaId,
              cabinetId,
              quantity
            );
          }
        }
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving cabinet:', error);
      const errorMessage = error?.message || 'Failed to save cabinet';
      const errorDetails = error?.details || '';
      const errorHint = error?.hint || '';
      alert(`Failed to save cabinet\n\n${errorMessage}\n${errorDetails}\n${errorHint}`);
    } finally {
      setLoading(false);
    }
  }

  const sheetMaterials = priceList.filter(
    (p) =>
      p.type.toLowerCase().includes('melamine') ||
      p.type.toLowerCase().includes('mdf') ||
      p.type.toLowerCase().includes('plywood') ||
      p.type.toLowerCase().includes('laminate')
  );

  const edgebandMaterials = priceList.filter((p) =>
    p.type.toLowerCase().includes('edgeband')
  );

  const hardwareMaterials = priceList.filter(
    (p) =>
      p.type.toLowerCase().includes('hinge') ||
      p.type.toLowerCase().includes('slide') ||
      p.type.toLowerCase().includes('handle') ||
      p.type.toLowerCase().includes('hardware')
  );

  const accessoryMaterials = priceList.filter((p) => {
    const typeLower = p.type.toLowerCase();
    const isSheetMaterial =
      typeLower.includes('melamine') ||
      typeLower.includes('mdf') ||
      typeLower.includes('plywood') ||
      typeLower.includes('laminate') ||
      typeLower.includes('veneer');
    const isEdgeband = typeLower.includes('edgeband');

    return !isSheetMaterial && !isEdgeband;
  });

  const costs = calculateCosts();

  if (loading) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Loading..." size="xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-600">Loading form data...</div>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={cabinet ? 'Edit Cabinet' : 'Add New Cabinet'}
        size="xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {!cabinet && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center">
                  <Bookmark className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-sm text-blue-800">Start with a template to save time</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowTemplateSelector(true)}
                >
                  Load from Template
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Select Product
            </label>
            <AutocompleteSelect
              options={products.map((product) => ({
                value: product.sku,
                label: `${product.sku} - ${product.description}`,
              }))}
              value={selectedProduct?.sku || ''}
              onChange={(value) => {
                const product = products.find((p) => p.sku === value);
                setSelectedProduct(product || null);
              }}
              placeholder="Search by SKU or description..."
              required
            />
          </div>

          <Input
            label="Quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            required
          />
        </div>

        {selectedProduct && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_rta"
              checked={isRta}
              onChange={(e) => setIsRta(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
            />
            <label htmlFor="is_rta" className="ml-2 block text-sm text-slate-700">
              Ready To Assemble (RTA) - Affects pallet calculations
            </label>
          </div>
        )}

        {selectedProduct && (
          <>
            <div className="border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => setBoxSectionExpanded(!boxSectionExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {boxSectionExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-600" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-600" />
                  )}
                  <h3 className="text-lg font-semibold text-slate-900">Box Construction</h3>
                  {costs && costs.boxMaterialCost > 0 && (
                    <span className="ml-2 text-sm font-medium text-blue-600">
                      {formatCurrency(costs.boxMaterialCost + costs.boxEdgebandCost + costs.boxInteriorFinishCost)}
                    </span>
                  )}
                </div>
                {!boxMaterialId && !boxEdgebandId && (
                  <span className="text-xs text-red-600 font-medium">Required</span>
                )}
              </button>

              {boxSectionExpanded && (
                <div className="p-4 pt-0 space-y-4">
                <AutocompleteSelect
                  label="Material"
                  placeholder="Select material..."
                  value={boxMaterialId}
                  onChange={setBoxMaterialId}
                  options={sheetMaterials.map((item) => ({
                    value: item.id,
                    label: `${item.concept_description} - ${item.dimensions} - ${formatCurrency(item.price)}/${item.unit}`,
                  }))}
                  required
                />

                <AutocompleteSelect
                  label="Edgeband"
                  placeholder="Select edgeband..."
                  value={boxEdgebandId}
                  onChange={setBoxEdgebandId}
                  options={edgebandMaterials.map((item) => ({
                    value: item.id,
                    label: `${item.concept_description} - ${item.dimensions} - ${formatCurrency(item.price)}/${item.unit}`,
                  }))}
                  required
                />

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <label className="flex items-start space-x-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={useBoxInteriorFinish}
                      onChange={(e) => setUseBoxInteriorFinish(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium text-slate-700">
                          Add Surface Layer Material
                        </span>
                        <Info className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        For laminate, veneer, or other materials applied over the base material.
                        Both materials will use the same square footage.
                      </p>
                    </div>
                  </label>
                </div>

                {useBoxInteriorFinish && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-900">Surface Layer Material</span>
                      <span className="text-xs text-blue-600">(Applied over base material)</span>
                    </div>
                    <AutocompleteSelect
                      label="Surface Layer (e.g., Laminate, Veneer)"
                      placeholder="Select surface layer material..."
                      value={boxInteriorFinishId}
                      onChange={setBoxInteriorFinishId}
                      options={sheetMaterials.map((item) => ({
                        value: item.id,
                        label: `${item.concept_description} - ${formatCurrency(item.price)}/${item.unit}`,
                      }))}
                    />
                    <div className="flex items-start gap-2 mt-2 text-xs text-blue-700">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>
                        The surface layer will require the same number of sheets as the base material.
                        Cost is calculated at area level by aggregating all cabinets, rounding up to full sheets.
                      </span>
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => setDoorsSectionExpanded(!doorsSectionExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {doorsSectionExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-600" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-600" />
                  )}
                  <h3 className="text-lg font-semibold text-slate-900">Doors & Drawer Fronts</h3>
                  {costs && costs.doorsMaterialCost > 0 && (
                    <span className="ml-2 text-sm font-medium text-blue-600">
                      {formatCurrency(costs.doorsMaterialCost + costs.doorsEdgebandCost + costs.doorsInteriorFinishCost)}
                    </span>
                  )}
                </div>
                {!doorsMaterialId && !doorsEdgebandId && (
                  <span className="text-xs text-red-600 font-medium">Required</span>
                )}
              </button>

              {doorsSectionExpanded && (
                <div className="p-4 pt-0 space-y-4">
                <AutocompleteSelect
                  label="Material"
                  placeholder="Select material..."
                  value={doorsMaterialId}
                  onChange={setDoorsMaterialId}
                  options={sheetMaterials.map((item) => ({
                    value: item.id,
                    label: `${item.concept_description} - ${item.dimensions} - ${formatCurrency(item.price)}/${item.unit}`,
                  }))}
                  required
                />

                <AutocompleteSelect
                  label="Edgeband"
                  placeholder="Select edgeband..."
                  value={doorsEdgebandId}
                  onChange={setDoorsEdgebandId}
                  options={edgebandMaterials.map((item) => ({
                    value: item.id,
                    label: `${item.concept_description} - ${item.dimensions} - ${formatCurrency(item.price)}/${item.unit}`,
                  }))}
                  required
                />

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <label className="flex items-start space-x-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={useDoorsInteriorFinish}
                      onChange={(e) => setUseDoorsInteriorFinish(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium text-slate-700">
                          Add Surface Layer Material
                        </span>
                        <Info className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        For laminate, veneer, or other materials applied over the base material.
                        Both materials will use the same square footage.
                      </p>
                    </div>
                  </label>
                </div>

                {useDoorsInteriorFinish && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-semibold text-green-900">Surface Layer Material</span>
                      <span className="text-xs text-green-600">(Applied over base material)</span>
                    </div>
                    <AutocompleteSelect
                      label="Surface Layer (e.g., Laminate, Veneer)"
                      placeholder="Select surface layer material..."
                      value={doorsInteriorFinishId}
                      onChange={setDoorsInteriorFinishId}
                      options={sheetMaterials.map((item) => ({
                        value: item.id,
                        label: `${item.concept_description} - ${formatCurrency(item.price)}/${item.unit}`,
                      }))}
                    />
                    <div className="flex items-start gap-2 mt-2 text-xs text-green-700">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>
                        The surface layer will require the same number of sheets as the base material.
                        Cost is calculated at area level by aggregating all cabinets, rounding up to full sheets.
                      </span>
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => setHardwareSectionExpanded(!hardwareSectionExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {hardwareSectionExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-600" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-600" />
                  )}
                  <h3 className="text-lg font-semibold text-slate-900">Hardware</h3>
                  {costs && costs.hardwareCost > 0 && (
                    <span className="ml-2 text-sm font-medium text-blue-600">
                      {formatCurrency(costs.hardwareCost)}
                    </span>
                  )}
                  <span className="ml-2 text-xs text-slate-500">({hardware.length} items)</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHardware([...hardware, { hardware_id: '', quantity_per_cabinet: 1 }]);
                    setHardwareSectionExpanded(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </button>

              {hardwareSectionExpanded && (
                <div className="p-4 pt-0 space-y-3">
                {hardware.map((item, index) => (
                  <div key={index} className="flex space-x-2 items-start">
                    <div className="flex-1">
                      <AutocompleteSelect
                        placeholder="Select hardware..."
                        value={item.hardware_id}
                        onChange={(value) => {
                          const newHardware = [...hardware];
                          newHardware[index].hardware_id = value;
                          setHardware(newHardware);
                        }}
                        options={hardwareMaterials.map((hw) => ({
                          value: hw.id,
                          label: `${hw.concept_description} - ${formatCurrency(hw.price)}/${hw.unit}`,
                        }))}
                      />
                    </div>

                    <input
                      type="number"
                      min="1"
                      value={item.quantity_per_cabinet}
                      onChange={(e) => {
                        const newHardware = [...hardware];
                        newHardware[index].quantity_per_cabinet =
                          parseInt(e.target.value) || 1;
                        setHardware(newHardware);
                      }}
                      className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Qty"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newHardware = hardware.filter((_, i) => i !== index);
                        setHardware(newHardware);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}

                  {hardware.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">
                      No hardware added yet
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => setAccessoriesSectionExpanded(!accessoriesSectionExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {accessoriesSectionExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-600" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-600" />
                  )}
                  <Package className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Accessories</h3>
                  {costs && costs.accessoriesCost > 0 && (
                    <span className="ml-2 text-sm font-medium text-purple-600">
                      {formatCurrency(costs.accessoriesCost)}
                    </span>
                  )}
                  <span className="ml-2 text-xs text-slate-500">({accessories.length} items)</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAccessories([...accessories, { accessory_id: '', quantity_per_cabinet: 1 }]);
                    setAccessoriesSectionExpanded(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </button>

              {accessoriesSectionExpanded && (
                <div className="p-4 pt-0 space-y-3">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-purple-900">
                        <p className="font-medium mb-1">Add accessories like glass, fabric, lighting, decorative items, etc.</p>
                        <p className="text-purple-700">Accessories do not affect shipping or labor calculations.</p>
                      </div>
                    </div>
                  </div>

                  {accessories.map((item, index) => (
                    <div key={index} className="flex space-x-2 items-start">
                      <div className="flex-1">
                        <AutocompleteSelect
                          placeholder="Select accessory..."
                          value={item.accessory_id}
                          onChange={(value) => {
                            const newAccessories = [...accessories];
                            newAccessories[index].accessory_id = value;
                            setAccessories(newAccessories);
                          }}
                          options={accessoryMaterials.map((acc) => ({
                            value: acc.id,
                            label: `${acc.concept_description} - ${formatCurrency(acc.price)}/${acc.unit}`,
                          }))}
                        />
                      </div>

                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={item.quantity_per_cabinet}
                        onChange={(e) => {
                          const newAccessories = [...accessories];
                          newAccessories[index].quantity_per_cabinet =
                            parseFloat(e.target.value) || 1;
                          setAccessories(newAccessories);
                        }}
                        className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Qty"
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newAccessories = accessories.filter((_, i) => i !== index);
                          setAccessories(newAccessories);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}

                  {accessories.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">
                      No accessories added yet
                    </p>
                  )}
                </div>
              )}
            </div>

            {costs && (
              <div className="border-t border-slate-200 pt-6 bg-slate-50 -mx-6 px-6 -mb-6 pb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Cost Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Box Material:</span>
                    <span className="font-medium">{formatCurrency(costs.boxMaterialCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Box Edgeband:</span>
                    <span className="font-medium">{formatCurrency(costs.boxEdgebandCost)}</span>
                  </div>
                  {costs.boxInteriorFinishCost > 0 && (
                    <div className="flex justify-between bg-blue-50 -mx-2 px-2 py-1 rounded">
                      <span className="text-slate-600 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-blue-600" />
                        Box Surface Layer:
                      </span>
                      <span className="font-medium">
                        {formatCurrency(costs.boxInteriorFinishCost)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Doors Material:</span>
                    <span className="font-medium">{formatCurrency(costs.doorsMaterialCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Doors Edgeband:</span>
                    <span className="font-medium">{formatCurrency(costs.doorsEdgebandCost)}</span>
                  </div>
                  {costs.doorsInteriorFinishCost > 0 && (
                    <div className="flex justify-between bg-green-50 -mx-2 px-2 py-1 rounded">
                      <span className="text-slate-600 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-green-600" />
                        Doors Surface Layer:
                      </span>
                      <span className="font-medium">
                        {formatCurrency(costs.doorsInteriorFinishCost)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Hardware:</span>
                    <span className="font-medium">{formatCurrency(costs.hardwareCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Accessories:</span>
                    <span className="font-medium">{formatCurrency(costs.accessoriesCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      Labor (${selectedProduct.has_drawers ? settings.laborCostWithDrawers : settings.laborCostNoDrawers} per cabinet):
                    </span>
                    <span className="font-medium">{formatCurrency(costs.laborCost)}</span>
                  </div>

                  <div className="border-t border-slate-300 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-slate-900">Total:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {formatCurrency(costs.subtotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!costs || loading}>
              {loading ? 'Saving...' : cabinet ? 'Update Cabinet' : 'Add Cabinet'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>

    {showTemplateSelector && (
      <TemplateSelectorModal
        isOpen={true}
        onClose={() => setShowTemplateSelector(false)}
        onSelectTemplate={handleLoadTemplate}
        priceList={priceList}
        products={products}
      />
    )}
    </>
  );
}
