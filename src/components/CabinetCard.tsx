import { useState, useEffect, useRef } from 'react';
import { Pencil as Edit2, Trash2, Copy, ChevronDown, ChevronUp, Bookmark, Package, Layers, Ruler, Hash, Wrench, Boxes, MoveRight } from 'lucide-react';
import { Button } from './Button';
import { formatCurrency } from '../lib/calculations';
import { calculateCabinetMaterialSummary, type CabinetMaterialSummary } from '../lib/cabinetMaterialSummary';
import type { AreaCabinet, Product, PriceListItem } from '../types';

interface AreaOption {
  id: string;
  name: string;
}

interface CabinetCardProps {
  cabinet: AreaCabinet;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSaveAsTemplate?: () => void;
  onMove?: (targetAreaId: string) => void;
  availableAreas?: AreaOption[];
  productDescription?: string;
  product?: Product;
  priceList?: PriceListItem[];
}

export function CabinetCard({ cabinet, onEdit, onDelete, onDuplicate, onSaveAsTemplate, onMove, availableAreas, productDescription, product, priceList }: CabinetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMaterialSummary, setShowMaterialSummary] = useState(false);
  const [materialSummary, setMaterialSummary] = useState<CabinetMaterialSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const moveButtonRef = useRef<HTMLDivElement>(null);
  const moveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node) &&
        moveButtonRef.current && !moveButtonRef.current.contains(e.target as Node)
      ) {
        setShowMoveMenu(false);
      }
    }
    if (showMoveMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoveMenu]);

  function handleToggleMoveMenu() {
    if (!showMoveMenu && moveButtonRef.current) {
      const rect = moveButtonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setShowMoveMenu(!showMoveMenu);
  }

  useEffect(() => {
    if (showMaterialSummary && product && priceList && !materialSummary) {
      loadMaterialSummary();
    }
  }, [showMaterialSummary, product, priceList]);

  async function loadMaterialSummary() {
    if (!product || !priceList) return;

    setLoadingSummary(true);
    try {
      const summary = await calculateCabinetMaterialSummary(cabinet, product, priceList);
      setMaterialSummary(summary);
    } catch (error) {
      console.error('Error loading material summary:', error);
    } finally {
      setLoadingSummary(false);
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-slate-50 px-3 sm:px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div className="flex items-center justify-between sm:flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-slate-900 text-sm sm:text-base">{cabinet.product_sku}</span>
                <span className="text-xs sm:text-sm text-slate-600 whitespace-nowrap">Qty: {cabinet.quantity}</span>
              </div>
              {productDescription && (
                <span className="text-xs sm:text-sm text-slate-500 truncate mt-0.5 sm:mt-0">
                  {productDescription}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end sm:space-x-4">

            <div className="flex space-x-1 items-center">
              <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
              {onSaveAsTemplate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSaveAsTemplate}
                  title="Save as Template"
                >
                  <Bookmark className="h-4 w-4 text-blue-600" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDuplicate}>
                <Copy className="h-4 w-4" />
              </Button>
              {onMove && availableAreas && availableAreas.length > 0 && (
                <div ref={moveButtonRef}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleMoveMenu}
                    title="Move to another area"
                  >
                    <MoveRight className="h-4 w-4 text-teal-600" />
                  </Button>
                  {showMoveMenu && menuPos && (
                    <div
                      ref={moveMenuRef}
                      style={{
                        position: 'fixed',
                        top: menuPos.top,
                        right: menuPos.right,
                        zIndex: 9999,
                      }}
                      className="bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[200px] max-h-64 overflow-y-auto"
                    >
                      <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 sticky top-0 bg-white">
                        Move to Area
                      </div>
                      {availableAreas.map((a) => (
                        <button
                          key={a.id}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-800 transition-colors"
                          onClick={() => {
                            setShowMoveMenu(false);
                            onMove(a.id);
                          }}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-white space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            <div>
              <span className="text-slate-600">Box Material Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency((cabinet.box_material_cost ?? 0))}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Box Edgeband Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency((cabinet.box_edgeband_cost ?? 0))}
              </span>
            </div>
            {(cabinet.box_interior_finish_cost ?? 0) > 0 && (
              <div>
                <span className="text-slate-600">Box Interior Finish:</span>
                <span className="float-right font-medium">
                  {formatCurrency((cabinet.box_interior_finish_cost ?? 0))}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-600">Doors Material Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency((cabinet.doors_material_cost ?? 0))}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Doors Edgeband Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency((cabinet.doors_edgeband_cost ?? 0))}
              </span>
            </div>
            {(cabinet.doors_interior_finish_cost ?? 0) > 0 && (
              <div>
                <span className="text-slate-600">Doors Interior Finish:</span>
                <span className="float-right font-medium">
                  {formatCurrency((cabinet.doors_interior_finish_cost ?? 0))}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-600">Hardware Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency((cabinet.hardware_cost ?? 0))}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Accessories Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency(cabinet.accessories_cost || 0)}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Labor Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency((cabinet.labor_cost ?? 0))}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 mt-3">
            <div className="flex justify-between items-center font-semibold">
              <span className="text-slate-900">Cabinet Subtotal:</span>
              <span className="text-lg text-slate-900">
                {formatCurrency(cabinet.subtotal ?? 0)}
              </span>
            </div>
          </div>

          {product && priceList && (
            <div className="border-t border-slate-200 pt-3 mt-3">
              <button
                onClick={() => setShowMaterialSummary(!showMaterialSummary)}
                className="flex items-center justify-between w-full text-left text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span>Material Details</span>
                </div>
                {showMaterialSummary ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showMaterialSummary && (
                <div className="mt-3 space-y-2">
                  {loadingSummary ? (
                    <div className="text-center py-4 text-sm text-slate-500">
                      Loading material details...
                    </div>
                  ) : materialSummary ? (
                    <div className="grid grid-cols-1 gap-2">
                      {materialSummary.boxMaterial && (
                        <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                          <div className="flex items-center gap-1 mb-1">
                            <Package className="h-3 w-3 text-blue-700" />
                            <span className="text-xs font-semibold text-blue-900">Box Material</span>
                          </div>
                          <div className="text-xs text-slate-700 mb-1">{materialSummary.boxMaterial.name}</div>
                          <div className="flex items-center text-xs text-slate-600">
                            <Ruler className="h-3 w-3 inline mr-1" />
                            <span>{materialSummary.boxMaterial.totalSF.toFixed(2)} SF</span>
                          </div>
                        </div>
                      )}

                      {materialSummary.boxInteriorFinish && (
                        <div className="bg-blue-100 rounded-lg p-2 border border-blue-200">
                          <div className="flex items-center gap-1 mb-1">
                            <Layers className="h-3 w-3 text-blue-800" />
                            <span className="text-xs font-semibold text-blue-900">Box Interior Finish</span>
                          </div>
                          <div className="text-xs text-slate-700 mb-1">{materialSummary.boxInteriorFinish.name}</div>
                          <div className="flex items-center text-xs text-slate-600">
                            <Ruler className="h-3 w-3 inline mr-1" />
                            <span>{materialSummary.boxInteriorFinish.totalSF.toFixed(2)} SF</span>
                          </div>
                        </div>
                      )}

                      {materialSummary.boxEdgeband && (
                        <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
                          <div className="flex items-center gap-1 mb-1">
                            <Ruler className="h-3 w-3 text-amber-700" />
                            <span className="text-xs font-semibold text-amber-900">Box Edgeband</span>
                          </div>
                          <div className="text-xs text-slate-700 mb-1">{materialSummary.boxEdgeband.name}</div>
                          <div className="flex items-center text-xs text-slate-600">
                            <span>{materialSummary.boxEdgeband.totalMeters.toFixed(1)} meters</span>
                          </div>
                        </div>
                      )}

                      {materialSummary.doorsMaterial && (
                        <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                          <div className="flex items-center gap-1 mb-1">
                            <Package className="h-3 w-3 text-green-700" />
                            <span className="text-xs font-semibold text-green-900">Doors Material</span>
                          </div>
                          <div className="text-xs text-slate-700 mb-1">{materialSummary.doorsMaterial.name}</div>
                          <div className="flex items-center text-xs text-slate-600">
                            <Ruler className="h-3 w-3 inline mr-1" />
                            <span>{materialSummary.doorsMaterial.totalSF.toFixed(2)} SF</span>
                          </div>
                        </div>
                      )}

                      {materialSummary.doorsInteriorFinish && (
                        <div className="bg-green-100 rounded-lg p-2 border border-green-200">
                          <div className="flex items-center gap-1 mb-1">
                            <Layers className="h-3 w-3 text-green-800" />
                            <span className="text-xs font-semibold text-green-900">Doors Interior Finish</span>
                          </div>
                          <div className="text-xs text-slate-700 mb-1">{materialSummary.doorsInteriorFinish.name}</div>
                          <div className="flex items-center text-xs text-slate-600">
                            <Ruler className="h-3 w-3 inline mr-1" />
                            <span>{materialSummary.doorsInteriorFinish.totalSF.toFixed(2)} SF</span>
                          </div>
                        </div>
                      )}

                      {materialSummary.doorsEdgeband && (
                        <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
                          <div className="flex items-center gap-1 mb-1">
                            <Ruler className="h-3 w-3 text-amber-700" />
                            <span className="text-xs font-semibold text-amber-900">Doors Edgeband</span>
                          </div>
                          <div className="text-xs text-slate-700 mb-1">{materialSummary.doorsEdgeband.name}</div>
                          <div className="flex items-center text-xs text-slate-600">
                            <span>{materialSummary.doorsEdgeband.totalMeters.toFixed(1)} meters</span>
                          </div>
                        </div>
                      )}

                      {materialSummary.hardware.length > 0 && (
                        <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                          <div className="flex items-center gap-1 mb-2">
                            <Wrench className="h-3 w-3 text-slate-700" />
                            <span className="text-xs font-semibold text-slate-900">Hardware</span>
                          </div>
                          <div className="space-y-1">
                            {materialSummary.hardware.map((hw, idx) => (
                              <div key={idx} className="bg-white rounded p-1.5 text-xs">
                                <div className="text-slate-700 mb-0.5">{hw.name}</div>
                                <div className="flex items-center text-slate-600">
                                  <Hash className="h-3 w-3 inline mr-1" />
                                  <span>{hw.quantity} pcs</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {materialSummary.accessories.length > 0 && (
                        <div className="bg-purple-50 rounded-lg p-2 border border-purple-200">
                          <div className="flex items-center gap-1 mb-2">
                            <Boxes className="h-3 w-3 text-purple-700" />
                            <span className="text-xs font-semibold text-purple-900">Accessories</span>
                          </div>
                          <div className="space-y-1">
                            {materialSummary.accessories.map((acc, idx) => (
                              <div key={idx} className="bg-white rounded p-1.5 text-xs">
                                <div className="text-slate-700 mb-0.5">{acc.name}</div>
                                <div className="flex items-center text-slate-600">
                                  <Hash className="h-3 w-3 inline mr-1" />
                                  <span>{acc.quantity} pcs</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-slate-500">
                      Unable to load material details
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
