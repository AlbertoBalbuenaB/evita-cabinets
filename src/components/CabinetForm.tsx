import { useEffect, useState } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronRight, DollarSign, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { AutocompleteSelect } from './AutocompleteSelect';
import { getSettings } from '../lib/settingsStore';
import { recalculateAreaEdgebandCosts } from '../lib/edgebandRolls';
import { recalculateAreaSheetMaterialCosts } from '../lib/sheetMaterials';
import {
  calculateBoxMaterialCost,
  calculateBoxEdgebandCost,
  calculateDoorsMaterialCost,
  calculateDoorsEdgebandCost,
  calculateInteriorFinishCost,
  calculateHardwareCost,
  calculateLaborCost,
  formatCurrency,
  parseDimensions,
} from '../lib/calculations';
import type {
  Product,
  PriceListItem,
  AreaCabinet,
  AreaCabinetInsert,
  HardwareItem,
} from '../types';

interface CabinetFormProps {
  areaId: string;
  cabinet: AreaCabinet | null;
  onClose: () => void;
  versionId?: string | null;
}

export function CabinetForm({ areaId, cabinet, onClose, versionId }: CabinetFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ laborCostNoDrawers: 400, laborCostWithDrawers: 600, laborCostAccessories: 100, wastePercentageBox: 10, wastePercentageDoors: 10 });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(cabinet?.quantity || 1);

  const [boxSectionExpanded, setBoxSectionExpanded] = useState(true);
  const [doorsSectionExpanded, setDoorsSectionExpanded] = useState(true);
  const [hardwareSectionExpanded, setHardwareSectionExpanded] = useState(false);

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
        const product = productsRes.data?.find((p) => p.sku === cabinet.product_sku);
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
    const laborCost = calculateLaborCost(selectedProduct, quantity, settings.laborCostNoDrawers, settings.laborCostWithDrawers, settings.laborCostAccessories);

    const subtotal =
      boxMaterialCost +
      boxEdgebandCost +
      boxInteriorFinishCost +
      doorsMaterialCost +
      doorsEdgebandCost +
      doorsInteriorFinishCost +
      hardwareCost +
      laborCost;

    return {
      boxMaterialCost,
      boxEdgebandCost,
      boxInteriorFinishCost,
      doorsMaterialCost,
      doorsEdgebandCost,
      doorsInteriorFinishCost,
      hardwareCost,
      laborCost,
      subtotal,
    };
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

    const cabinetData: AreaCabinetInsert = {
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
      is_rta: isRta,
      box_material_cost: costs.boxMaterialCost,
      box_edgeband_cost: costs.boxEdgebandCost,
      box_interior_finish_cost: costs.boxInteriorFinishCost,
      doors_material_cost: costs.doorsMaterialCost,
      doors_edgeband_cost: costs.doorsEdgebandCost,
      doors_interior_finish_cost: costs.doorsInteriorFinishCost,
      hardware_cost: costs.hardwareCost,
      labor_cost: costs.laborCost,
      subtotal: costs.subtotal,
    };

    try {
      const tableName = versionId ? 'version_area_cabinets' : 'area_cabinets';

      if (cabinet) {
        const { error } = await supabase
          .from(tableName)
          .update(cabinetData)
          .eq('id', cabinet.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from(tableName).insert([cabinetData]);

        if (error) throw error;
      }

      if (!versionId) {
        await recalculateAreaSheetMaterialCosts(areaId);
        await recalculateAreaEdgebandCosts(areaId);
      }

      onClose();
    } catch (error) {
      console.error('Error saving cabinet:', error);
      alert('Failed to save cabinet');
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
    <Modal
      isOpen={true}
      onClose={onClose}
      title={cabinet ? 'Edit Cabinet' : 'Add New Cabinet'}
      size="xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
                  {costs.boxMaterial > 0 && (
                    <span className="ml-2 text-sm font-medium text-blue-600">
                      {formatCurrency(costs.boxMaterial + costs.boxEdgeband + costs.boxInteriorFinish)}
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

                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useBoxInteriorFinish}
                      onChange={(e) => setUseBoxInteriorFinish(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Different interior finish
                    </span>
                  </label>
                </div>

                {useBoxInteriorFinish && (
                  <AutocompleteSelect
                    label="Interior Finish"
                    placeholder="Select interior finish..."
                    value={boxInteriorFinishId}
                    onChange={setBoxInteriorFinishId}
                    options={sheetMaterials.map((item) => ({
                      value: item.id,
                      label: `${item.concept_description} - ${formatCurrency(item.price)}/${item.unit}`,
                    }))}
                  />
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
                  {costs.doorsMaterial > 0 && (
                    <span className="ml-2 text-sm font-medium text-blue-600">
                      {formatCurrency(costs.doorsMaterial + costs.doorsEdgeband + costs.doorsInteriorFinish)}
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

                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useDoorsInteriorFinish}
                      onChange={(e) => setUseDoorsInteriorFinish(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Different interior finish
                    </span>
                  </label>
                </div>

                {useDoorsInteriorFinish && (
                  <AutocompleteSelect
                    label="Interior Finish"
                    placeholder="Select interior finish..."
                    value={doorsInteriorFinishId}
                    onChange={setDoorsInteriorFinishId}
                    options={sheetMaterials.map((item) => ({
                      value: item.id,
                      label: `${item.concept_description} - ${formatCurrency(item.price)}/${item.unit}`,
                    }))}
                  />
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
                  {costs.hardware > 0 && (
                    <span className="ml-2 text-sm font-medium text-blue-600">
                      {formatCurrency(costs.hardware)}
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
                    <div className="flex justify-between">
                      <span className="text-slate-600">Box Interior Finish:</span>
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
                    <div className="flex justify-between">
                      <span className="text-slate-600">Doors Interior Finish:</span>
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
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!costs}>
              {cabinet ? 'Update Cabinet' : 'Add Cabinet'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
