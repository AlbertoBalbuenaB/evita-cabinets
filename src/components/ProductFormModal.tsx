import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { CollectionSelector } from './CollectionSelector';
import type { Product, ProductInsert, CutPiece } from '../types';
import { calculateDespiece } from '../lib/despieceCalculator';
import { EdgeBandCell } from './EdgeBandPopover';

interface ProductFormModalProps {
  product: Product | null;
  onSave: (product: ProductInsert) => void;
  onClose: () => void;
  safeEditMode?: boolean;
}

export function ProductFormModal({ product, onSave, onClose, safeEditMode }: ProductFormModalProps) {
  const [formData, setFormData] = useState<ProductInsert>({
    sku: product?.sku || '',
    description: product?.description || '',
    box_sf: product?.box_sf || 0,
    box_edgeband: product?.box_edgeband || 0,
    box_edgeband_color: product?.box_edgeband_color || 0,
    doors_fronts_sf: product?.doors_fronts_sf || 0,
    doors_fronts_edgeband: product?.doors_fronts_edgeband || 0,
    total_edgeband: product?.total_edgeband || 0,
    has_drawers: product?.has_drawers || false,
    collection_name: product?.collection_name || 'Standard Catalog',
    status: product?.status || 'active',
    custom_labor_cost: product?.custom_labor_cost ?? null,
    boxes_per_unit: product?.boxes_per_unit ?? 1,
    default_is_rta: product?.default_is_rta ?? false,
  });

  const [customLaborCostInput, setCustomLaborCostInput] = useState<string>(
    product?.custom_labor_cost !== null && product?.custom_labor_cost !== undefined
      ? String(product.custom_labor_cost)
      : ''
  );

  const [calcOpen, setCalcOpen] = useState(false);
  const [calcH, setCalcH] = useState<number | ''>(product?.height_in ?? '');
  const [calcW, setCalcW] = useState<number | ''>(product?.width_in ?? '');
  const [calcD, setCalcD] = useState<number | ''>(product?.depth_in ?? '');
  const [calcCostados, setCalcCostados] = useState<number>(2);
  const [calcShelves, setCalcShelves] = useState<number>(0);
  const [calcCabinetType, setCalcCabinetType] = useState<'base' | 'wall' | 'tall'>('base');
  const [calcBodyThickness, setCalcBodyThickness] = useState<number>(18);
  const [calcHasDoors, setCalcHasDoors] = useState(false);
  const [calcDoors, setCalcDoors] = useState<number>(1);
  const [calcDoorSectionH, setCalcDoorSectionH] = useState<number>(0);
  const [calcHasDrawers, setCalcHasDrawers] = useState<boolean>(formData.has_drawers ?? false);
  const [calcDrawers, setCalcDrawers] = useState<number>(3);
  const [calcDrawerSectionH, setCalcDrawerSectionH] = useState<number>(0);
  const [calcError, setCalcError] = useState<string>('');
  const [flashFields, setFlashFields] = useState<Set<string>>(new Set());
  const [despieceOpen, setDespieceOpen] = useState(false);
  const [cutPieces, setCutPieces] = useState<CutPiece[]>(
    Array.isArray(product?.cut_pieces) ? (product.cut_pieces as unknown as CutPiece[]) : []
  );

  function syncCalcHasDrawers(val: boolean) {
    setCalcHasDrawers(val);
    setFormData((prev) => ({ ...prev, has_drawers: val }));
  }

  function syncFormHasDrawers(val: boolean) {
    setFormData((prev) => ({ ...prev, has_drawers: val }));
    setCalcHasDrawers(val);
  }

  function flashField(field: string) {
    setFlashFields((prev) => new Set(prev).add(field));
    setTimeout(() => {
      setFlashFields((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }, 1000);
  }

  function calculateCabinetMaterials({
    H, W, D,
    costados, shelves,
    hasDoors, doors, doorSectionH,
    hasDrawers, drawers, drawerSectionH,
  }: {
    H: number; W: number; D: number;
    costados: number; shelves: number;
    hasDoors: boolean; doors: number; doorSectionH: number;
    hasDrawers: boolean; drawers: number; drawerSectionH: number;
  }) {
    const EBO = 1.9;
    const DRAWER_BOX_H = 7;
    const CCONTRAS_W = 30;
    const ARMADOR_D = 3;

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const ft2 = (a: number, b: number, q: number) => r2((a * b / 144) * q);
    const toM = (dim: number, q: number) => r2(((dim + EBO * 2) * 2.54 / 100) * q);

    const H_door_sec = (hasDoors && doorSectionH > 0) ? doorSectionH : H;
    const H_drawer_sec = (hasDrawers && drawerSectionH > 0) ? drawerSectionH : H;

    const costados_ft2 = ft2(H, D, costados);
    const costados_eb_clr = toM(H, costados);
    const costados_eb_box = hasDrawers
      ? r2(((H + EBO * 2) + (W + EBO * 2) * 2) * 2.54 / 100 * costados)
      : 13;

    const back_ft2 = ft2(H, W, 1);
    const back_eb = r2((W + EBO * 2) * 2 * 2.54 / 100);

    const tp_ft2 = ft2(W, D, 2);
    const tp_eb_clr = toM(W, 2);

    const shelf_ft2 = ft2(W, D - 2, shelves);
    const shelf_eb = r2(
      (((W + EBO * 2) * 2) + (((D - 2) + EBO * 2) * 2)) * 2.54 / 100 * shelves
    );

    let drw_ft2 = 0;
    let drw_eb = 0;

    if (hasDrawers && drawers > 0) {
      const arm_ft2 = ft2(W, ARMADOR_D, 2);
      const arm_eb = r2(
        (((W + EBO * 2) * 2) + ((ARMADOR_D + EBO * 2) * 2)) * 2.54 / 100 * 2
      );
      const cc_qty = drawers * 2;
      const cc_ft2 = ft2(DRAWER_BOX_H, D, cc_qty);
      const cc_eb = r2(
        (D + EBO * 2 + DRAWER_BOX_H + EBO * 2) * 2.54 / 100 * cc_qty
      );
      const cco_qty = drawers * 2;
      const cco_ft2 = ft2(DRAWER_BOX_H, CCONTRAS_W, cco_qty);
      const cco_eb = r2((CCONTRAS_W + EBO * 2) * 2.54 / 100 * cco_qty);
      const cp_ft2 = ft2(W, D, drawers);
      drw_ft2 = r2(arm_ft2 + cc_ft2 + cco_ft2 + cp_ft2);
      drw_eb = r2(arm_eb + cc_eb + cco_eb);
    }

    let door_ft2 = 0;
    let door_eb = 0;

    if (hasDoors && doors > 0) {
      const Wd = r2(W / doors);
      const Hd_door = H_door_sec;
      door_ft2 = r2(door_ft2 + ft2(Hd_door, Wd, doors));
      const d_eb_1mm = r2(
        (((Hd_door + EBO * 2) * 2) + ((Wd + EBO * 2) * 2)) * 2.54 / 100 * doors
      );
      const d_eb_045 = r2((Wd + EBO * 2) * 2.54 / 100 * doors);
      door_eb = r2(door_eb + d_eb_1mm + d_eb_045);
    }

    if (hasDrawers && drawers > 0) {
      const H_front = r2(H_drawer_sec / drawers);
      door_ft2 = r2(door_ft2 + ft2(H_front, W, drawers));
      const f_eb_1mm = r2(
        (((H_front + EBO * 2) * 2) + ((W + EBO * 2) * 2)) * 2.54 / 100 * drawers
      );
      const f_eb_045 = r2((W + EBO * 2) * 2.54 / 100 * drawers);
      door_eb = r2(door_eb + f_eb_1mm + f_eb_045);
    }

    const boxSF = r2(costados_ft2 + back_ft2 + tp_ft2 + shelf_ft2 + drw_ft2);
    const boxEBClr = r2(costados_eb_clr + tp_eb_clr);
    const boxEB = r2(back_eb + shelf_eb + costados_eb_box + drw_eb);
    const doorsSF = door_ft2;
    const doorsEB = door_eb;
    const totalEB = r2(boxEBClr + boxEB + doorsEB);

    return { boxSF, boxEBClr, boxEB, doorsSF, doorsEB, totalEB };
  }

  function handleCalculate() {
    setCalcError('');
    const H = calcH === '' ? 0 : calcH;
    const W = calcW === '' ? 0 : calcW;
    const D = calcD === '' ? 0 : calcD;

    if (H === 0 || W === 0 || D === 0) {
      setCalcError('Height, Width and Depth are required.');
      return;
    }
    if (W > 98.43) {
      setCalcError('Width exceeds maximum 98.43" (2.5 m).');
      return;
    }
    const H_drawer_sec = (calcHasDrawers && calcDrawerSectionH > 0) ? calcDrawerSectionH : H;
    if (calcHasDrawers && calcDrawers > 0 && H_drawer_sec / calcDrawers < 7) {
      setCalcError('Cabinet too short for drawer count — front height would be under 7". Reduce drawers or increase Drawer Section Height.');
      return;
    }
    if (calcHasDoors && calcHasDrawers && calcDoorSectionH + calcDrawerSectionH > H) {
      setCalcError('Door section + Drawer section heights exceed cabinet height.');
      return;
    }

    const result = calculateCabinetMaterials({
      H, W, D,
      costados: calcCostados,
      shelves: calcShelves,
      hasDoors: calcHasDoors,
      doors: calcDoors,
      doorSectionH: calcDoorSectionH,
      hasDrawers: calcHasDrawers,
      drawers: calcDrawers,
      drawerSectionH: calcDrawerSectionH,
    });

    setFormData((prev) => ({
      ...prev,
      box_sf: result.boxSF,
      box_edgeband: result.boxEB,
      box_edgeband_color: result.boxEBClr,
      doors_fronts_sf: result.doorsSF,
      doors_fronts_edgeband: result.doorsEB,
      total_edgeband: result.totalEB,
    }));

    ['box_sf', 'box_edgeband', 'box_edgeband_color', 'doors_fronts_sf', 'doors_fronts_edgeband', 'total_edgeband'].forEach(flashField);
  }

  function handleGenerateDespiece() {
    const H = calcH === '' ? 0 : calcH;
    const W = calcW === '' ? 0 : calcW;
    const D = calcD === '' ? 0 : calcD;
    if (H === 0 || W === 0 || D === 0) {
      setCalcError('Height, Width and Depth are required to generate the despiece.');
      return;
    }
    if (cutPieces.length > 0) {
      if (!window.confirm('This will replace the current despiece. Continue?')) return;
    }
    const pieces = calculateDespiece({
      heightIn: H,
      widthIn: W,
      depthIn: D,
      cabinetType: calcCabinetType,
      bodyThickness: calcBodyThickness,
      shelves: calcShelves,
      hasDoors: calcHasDoors,
      numDoors: calcDoors,
      doorSectionHeightIn: calcDoorSectionH,
      hasDrawers: calcHasDrawers,
      numDrawers: calcDrawers,
      drawerSectionHeightIn: calcDrawerSectionH,
    });
    setCutPieces(pieces);
    setDespieceOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const customLaborCost = customLaborCostInput.trim() === ''
      ? null
      : parseFloat(customLaborCostInput);
    onSave({
      ...formData,
      custom_labor_cost: customLaborCost,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cut_pieces: cutPieces.length > 0 ? (cutPieces as any) : null,
      height_in: calcH === '' ? null : calcH,
      width_in:  calcW === '' ? null : calcW,
      depth_in:  calcD === '' ? null : calcD,
    });
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={product ? (safeEditMode ? 'Edit Product (In Use)' : 'Edit Product') : 'Add New Product'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="SKU / Code"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            required
            placeholder="301-9x12x12"
            disabled={safeEditMode}
          />

          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_drawers ?? false}
                onChange={(e) => syncFormHasDrawers(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Has Drawers</span>
            </label>
          </div>
        </div>

        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          required
          placeholder="Wall Hung Cabinet | 1 Door"
        />

        <CollectionSelector
          value={formData.collection_name || 'Standard Catalog'}
          onChange={(collection) => setFormData({ ...formData, collection_name: collection })}
        />

        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Shipping & Labor</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Labor Cost (MXN)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={customLaborCostInput}
                onChange={(e) => setCustomLaborCostInput(e.target.value)}
                placeholder="Leave empty to use global setting"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                Leave empty to use the global settings. Set a value to override for this product only.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Boxes per Unit
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.boxes_per_unit ?? 1}
                onChange={(e) =>
                  setFormData({ ...formData, boxes_per_unit: parseInt(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                How many shipping boxes this product occupies
              </p>
            </div>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.default_is_rta ?? false}
                onChange={(e) =>
                  setFormData({ ...formData, default_is_rta: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Default RTA</span>
                <p className="text-xs text-slate-500">New cabinets using this product will default to RTA</p>
              </div>
            </label>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setCalcOpen((o) => !o)}
            className="flex items-center gap-2 w-full text-left text-sm font-semibold text-blue-700 hover:text-blue-800 transition-colors"
          >
            <span>📐 Auto-calculate from dimensions</span>
            <svg
              className={`ml-auto w-4 h-4 transition-transform duration-200 ${calcOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {calcOpen && (
            <div className="mt-4 space-y-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Height (in)</label>
                  <input
                    type="number" min="0" step="0.25"
                    value={calcH}
                    onChange={(e) => setCalcH(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Width (in)</label>
                  <input
                    type="number" min="0" step="0.25"
                    value={calcW}
                    onChange={(e) => setCalcW(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Depth (in)</label>
                  <input
                    type="number" min="0" step="0.25"
                    value={calcD}
                    onChange={(e) => setCalcD(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Costados (Side Panels)</label>
                  <input
                    type="number" min="0"
                    value={calcCostados}
                    onChange={(e) => setCalcCostados(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <p className="mt-1 text-xs text-slate-500">Standard box = 2. Add interior dividers if needed.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Shelves</label>
                  <input
                    type="number" min="0"
                    value={calcShelves}
                    onChange={(e) => setCalcShelves(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Cabinet Type</label>
                  <select
                    value={calcCabinetType}
                    onChange={(e) => setCalcCabinetType(e.target.value as 'base' | 'wall' | 'tall')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="base">Base Cabinet</option>
                    <option value="wall">Wall / Upper Cabinet</option>
                    <option value="tall">Tall / Tower Cabinet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Body Thickness (mm)</label>
                  <input
                    type="number" min="1" step="1"
                    value={calcBodyThickness}
                    onChange={(e) => setCalcBodyThickness(parseInt(e.target.value) || 18)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <p className="mt-1 text-xs text-slate-500">Panel thickness for despiece calc (typically 18mm)</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={calcHasDoors}
                    onChange={(e) => setCalcHasDoors(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  Has Doors (Puertas)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={calcHasDrawers}
                    onChange={(e) => syncCalcHasDrawers(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  Has Drawers (Cajones)
                </label>
              </div>

              {calcHasDoors && (
                <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-blue-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Number of Doors</label>
                    <input
                      type="number" min="1"
                      value={calcDoors}
                      onChange={(e) => setCalcDoors(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">Door panels spanning the full door section height.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Door Section Height (in)</label>
                    <input
                      type="number" min="0" step="0.25"
                      value={calcDoorSectionH}
                      onChange={(e) => setCalcDoorSectionH(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">Height of the door area. Leave 0 to use full cabinet height.</p>
                  </div>
                </div>
              )}

              {calcHasDrawers && (
                <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-amber-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Number of Drawers</label>
                    <input
                      type="number" min="1"
                      value={calcDrawers}
                      onChange={(e) => setCalcDrawers(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">Each drawer gets 1 front panel automatically.</p>
                    <p className="mt-1 text-xs text-amber-700">ℹ️ Drawer box height is fixed at 7" (Blum standard). Front height = Drawer section height ÷ number of drawers.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Drawer Section Height (in)</label>
                    <input
                      type="number" min="0" step="0.25"
                      value={calcDrawerSectionH}
                      onChange={(e) => setCalcDrawerSectionH(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">Height of the drawer stack. Leave 0 to use full cabinet height.</p>
                  </div>
                </div>
              )}

              {calcError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{calcError}</p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCalculate}
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  ⚡ Calculate &amp; Fill Fields
                </button>
                <button
                  type="button"
                  onClick={handleGenerateDespiece}
                  className="py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  🪚 Generate Cut List
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Box Construction</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className={`rounded-lg transition-colors duration-700 ${flashFields.has('box_sf') ? 'bg-green-50 ring-1 ring-green-300' : ''}`}>
              <Input
                label="Box Square Feet"
                type="number"
                step="0.01"
                value={formData.box_sf}
                onChange={(e) =>
                  setFormData({ ...formData, box_sf: parseFloat(e.target.value) || 0 })
                }
                required
              />
            </div>
            <div className={`rounded-lg transition-colors duration-700 ${flashFields.has('box_edgeband') ? 'bg-green-50 ring-1 ring-green-300' : ''}`}>
              <Input
                label="Box Edgeband (m)"
                type="number"
                step="0.01"
                value={formData.box_edgeband || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    box_edgeband: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className={`rounded-lg transition-colors duration-700 ${flashFields.has('box_edgeband_color') ? 'bg-green-50 ring-1 ring-green-300' : ''}`}>
              <Input
                label="Box Edgeband Color (m)"
                type="number"
                step="0.01"
                value={formData.box_edgeband_color || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    box_edgeband_color: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Doors & Drawer Fronts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`rounded-lg transition-colors duration-700 ${flashFields.has('doors_fronts_sf') ? 'bg-green-50 ring-1 ring-green-300' : ''}`}>
              <Input
                label="Doors & Fronts Square Feet"
                type="number"
                step="0.01"
                value={formData.doors_fronts_sf}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    doors_fronts_sf: parseFloat(e.target.value) || 0,
                  })
                }
                required
              />
            </div>
            <div className={`rounded-lg transition-colors duration-700 ${flashFields.has('doors_fronts_edgeband') ? 'bg-green-50 ring-1 ring-green-300' : ''}`}>
              <Input
                label="Doors Edgeband (m)"
                type="number"
                step="0.01"
                value={formData.doors_fronts_edgeband || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    doors_fronts_edgeband: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className={`rounded-lg transition-colors duration-700 ${flashFields.has('total_edgeband') ? 'bg-green-50 ring-1 ring-green-300' : ''}`}>
            <Input
              label="Total Edgeband (m)"
              type="number"
              step="0.01"
              value={formData.total_edgeband}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  total_edgeband: parseFloat(e.target.value) || 0,
                })
              }
              required
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            This is the total edgeband used for cost calculations
          </p>
        </div>

        {/* ── Cut List ────────────────────────────────────────────────── */}
        <div className="border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setDespieceOpen((o) => !o)}
            className="flex items-center gap-2 w-full text-left text-sm font-semibold text-amber-700 hover:text-amber-800 transition-colors"
          >
            <span>🪚 Cut List</span>
            {cutPieces.length > 0 && (
              <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                {cutPieces.length} {cutPieces.length === 1 ? 'piece' : 'pieces'}
              </span>
            )}
            <svg
              className={`ml-auto w-4 h-4 transition-transform duration-200 ${despieceOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {despieceOpen && (
            <div className="mt-3 space-y-2">
              {cutPieces.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4 bg-slate-50 rounded-lg border border-slate-200">
                  No pieces yet. Use "🪚 Generate Cut List" in the dimensions calculator above, or add pieces manually.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-medium">Part</th>
                        <th className="text-center px-2 py-1.5 font-medium">Width (mm)</th>
                        <th className="text-center px-2 py-1.5 font-medium">Height (mm)</th>
                        <th className="text-center px-2 py-1.5 font-medium">Qty</th>
                        <th className="text-center px-2 py-1.5 font-medium">Material</th>
                        <th className="text-center px-1 py-1.5 font-medium text-slate-400" title="Top">T</th>
                        <th className="text-center px-1 py-1.5 font-medium text-slate-400" title="Bottom">B</th>
                        <th className="text-center px-1 py-1.5 font-medium text-slate-400" title="Left">L</th>
                        <th className="text-center px-1 py-1.5 font-medium text-slate-400" title="Right">R</th>
                        <th className="px-1 py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cutPieces.map((piece) => (
                        <tr key={piece.id} className="hover:bg-slate-50">
                          <td className="px-1 py-1">
                            <input
                              type="text"
                              value={piece.nombre}
                              onChange={(e) => setCutPieces((prev) =>
                                prev.map((p) => p.id === piece.id ? { ...p, nombre: e.target.value } : p)
                              )}
                              className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="number" min="0" step="1"
                              value={piece.ancho}
                              onChange={(e) => setCutPieces((prev) =>
                                prev.map((p) => p.id === piece.id ? { ...p, ancho: parseInt(e.target.value) || 0 } : p)
                              )}
                              className="w-20 px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs text-center"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="number" min="0" step="1"
                              value={piece.alto}
                              onChange={(e) => setCutPieces((prev) =>
                                prev.map((p) => p.id === piece.id ? { ...p, alto: parseInt(e.target.value) || 0 } : p)
                              )}
                              className="w-20 px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs text-center"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="number" min="1" step="1"
                              value={piece.cantidad}
                              onChange={(e) => setCutPieces((prev) =>
                                prev.map((p) => p.id === piece.id ? { ...p, cantidad: parseInt(e.target.value) || 1 } : p)
                              )}
                              className="w-12 px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs text-center"
                            />
                          </td>
                          <td className="px-1 py-1 text-center">
                            <select
                              value={piece.material}
                              onChange={(e) => setCutPieces((prev) =>
                                prev.map((p) => p.id === piece.id ? { ...p, material: e.target.value as CutPiece['material'] } : p)
                              )}
                              className={`px-1.5 py-0.5 rounded text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                                piece.material === 'cuerpo'  ? 'bg-blue-100 text-blue-800' :
                                piece.material === 'frente'  ? 'bg-amber-100 text-amber-800' :
                                piece.material === 'back'    ? 'bg-emerald-100 text-emerald-800' :
                                                               'bg-slate-100 text-slate-700'
                              }`}
                            >
                              <option value="cuerpo">Box Construction</option>
                              <option value="frente">Doors &amp; Fronts</option>
                              <option value="back">Back Panel</option>
                              <option value="custom">Custom</option>
                            </select>
                          </td>
                          {(['sup', 'inf', 'izq', 'der'] as const).map(side => {
                            const cb = piece.cubrecanto ?? { sup: 0, inf: 0, izq: 0, der: 0 };
                            const sideLabel = { sup: 'Top', inf: 'Bottom', izq: 'Left', der: 'Right' }[side];
                            return (
                              <td key={side} className="px-0.5 py-1 text-center">
                                <EdgeBandCell value={cb[side]} side={sideLabel}
                                  onChange={v => setCutPieces(prev =>
                                    prev.map(p => p.id === piece.id ? { ...p, cubrecanto: { ...cb, [side]: v } } : p)
                                  )} />
                              </td>
                            );
                          })}
                          <td className="px-1 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => setCutPieces((prev) => prev.filter((p) => p.id !== piece.id))}
                              className="text-red-400 hover:text-red-600 transition-colors"
                              title="Remove piece"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  setCutPieces((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), nombre: '', ancho: 0, alto: 0, cantidad: 1, material: 'custom', cubrecanto: { sup: 0, inf: 0, izq: 0, der: 0 } },
                  ])
                }
                className="w-full py-1.5 px-3 border border-dashed border-slate-300 hover:border-slate-400 text-slate-500 hover:text-slate-700 text-xs rounded-lg transition-colors"
              >
                + Add Piece
              </button>
            </div>
          )}
        </div>

        {safeEditMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-900">
              <strong>Note:</strong> This product is in use. Changes will create a new version to
              protect historical data.
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {product ? (safeEditMode ? 'Continue to Version' : 'Update Product') : 'Add Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
