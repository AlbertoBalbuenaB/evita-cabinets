import { useState } from 'react';
import { Edit2, Trash2, Copy, ChevronDown, ChevronUp, Bookmark } from 'lucide-react';
import { Button } from './Button';
import { formatCurrency, formatNumber } from '../lib/calculations';
import type { AreaCabinet } from '../types';

interface CabinetCardProps {
  cabinet: AreaCabinet;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSaveAsTemplate?: () => void;
  productDescription?: string;
}

export function CabinetCard({ cabinet, onEdit, onDelete, onDuplicate, onSaveAsTemplate, productDescription }: CabinetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

            <div className="flex space-x-1">
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
                {formatCurrency(cabinet.box_material_cost)}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Box Edgeband Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency(cabinet.box_edgeband_cost)}
              </span>
            </div>
            {cabinet.box_interior_finish_cost > 0 && (
              <div>
                <span className="text-slate-600">Box Interior Finish:</span>
                <span className="float-right font-medium">
                  {formatCurrency(cabinet.box_interior_finish_cost)}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-600">Doors Material Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency(cabinet.doors_material_cost)}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Doors Edgeband Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency(cabinet.doors_edgeband_cost)}
              </span>
            </div>
            {cabinet.doors_interior_finish_cost > 0 && (
              <div>
                <span className="text-slate-600">Doors Interior Finish:</span>
                <span className="float-right font-medium">
                  {formatCurrency(cabinet.doors_interior_finish_cost)}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-600">Hardware Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency(cabinet.hardware_cost)}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Labor Cost:</span>
              <span className="float-right font-medium">
                {formatCurrency(cabinet.labor_cost)}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 mt-3">
            <div className="flex justify-between items-center font-semibold">
              <span className="text-slate-900">Cabinet Subtotal:</span>
              <span className="text-lg text-slate-900">
                {formatCurrency(cabinet.subtotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
