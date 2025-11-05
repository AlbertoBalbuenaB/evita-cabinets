import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AutocompleteSelect } from './AutocompleteSelect';
import { formatCurrency } from '../lib/calculations';
import { supabase } from '../lib/supabase';
import {
  getMaterialsInUse,
  previewBulkMaterialChange,
  executeBulkMaterialChange,
  validateMaterialReplacement,
  type MaterialChangeType,
  type ChangeScope,
  type MaterialUsageInfo,
  type BulkChangePreview,
} from '../lib/bulkMaterialChange';
import type { ProjectArea, PriceListItem } from '../types';

interface BulkMaterialChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
  areas: ProjectArea[];
  preselectedAreaId?: string;
  versionId?: string | null;
}

export function BulkMaterialChangeModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  areas,
  preselectedAreaId,
  versionId,
}: BulkMaterialChangeModalProps) {
  const [scope, setScope] = useState<ChangeScope>(preselectedAreaId ? 'area' : 'project');
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>(preselectedAreaId ? [preselectedAreaId] : []);
  const [changeType, setChangeType] = useState<MaterialChangeType>('box_material');
  const [materialsInUse, setMaterialsInUse] = useState<MaterialUsageInfo[]>([]);
  const [allMaterials, setAllMaterials] = useState<PriceListItem[]>([]);
  const [oldMaterialId, setOldMaterialId] = useState('');
  const [newMaterialId, setNewMaterialId] = useState('');
  const [updateMatchingInteriorFinish, setUpdateMatchingInteriorFinish] = useState(false);
  const [preview, setPreview] = useState<BulkChangePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [step, setStep] = useState<'setup' | 'preview'>('setup');

  useEffect(() => {
    if (isOpen) {
      loadAllMaterials();
      if (scope && changeType) {
        loadMaterialsInUse();
      }
    }
  }, [isOpen, scope, selectedAreaIds, changeType, versionId]);

  useEffect(() => {
    setPreview(null);
    setOldMaterialId('');
    setNewMaterialId('');
    setValidationError('');
  }, [scope, selectedAreaIds, changeType]);

  async function loadAllMaterials() {
    try {
      const { data, error } = await supabase
        .from('price_list')
        .select('*')
        .eq('is_active', true)
        .order('concept_description');

      if (error) throw error;
      setAllMaterials(data || []);
    } catch (error) {
      console.error('Error loading all materials:', error);
    }
  }

  async function loadMaterialsInUse() {
    try {
      setLoading(true);
      const areaIds = scope === 'project' ? [] : selectedAreaIds;
      const materials = await getMaterialsInUse(projectId, areaIds, changeType, versionId);
      setMaterialsInUse(materials);
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  }

  function getCompatibleMaterials(): PriceListItem[] {
    const isSheetMaterial = (type: string) =>
      type.toLowerCase().includes('melamine') ||
      type.toLowerCase().includes('mdf') ||
      type.toLowerCase().includes('plywood') ||
      type.toLowerCase().includes('laminate');

    const isEdgeband = (type: string) => type.toLowerCase().includes('edgeband');

    const isHardware = (type: string) =>
      type.toLowerCase().includes('hinge') ||
      type.toLowerCase().includes('slide') ||
      type.toLowerCase().includes('handle') ||
      type.toLowerCase().includes('hardware');

    return allMaterials.filter((material) => {
      const materialType = material.type.toLowerCase();

      switch (changeType) {
        case 'box_material':
        case 'doors_material':
        case 'box_interior_finish':
        case 'doors_interior_finish':
          return isSheetMaterial(materialType);
        case 'box_edgeband':
        case 'doors_edgeband':
          return isEdgeband(materialType);
        default:
          return true;
      }
    });
  }

  async function handlePreview() {
    if (!oldMaterialId || !newMaterialId) {
      setValidationError('Please select both current and new materials');
      return;
    }

    setValidationError('');
    setLoading(true);

    try {
      const validation = await validateMaterialReplacement(oldMaterialId, newMaterialId);
      if (!validation.valid) {
        setValidationError(validation.error || 'Invalid material replacement');
        setLoading(false);
        return;
      }

      const areaIds = scope === 'project' ? [] : selectedAreaIds;
      const previewData = await previewBulkMaterialChange({
        projectId,
        scope,
        areaIds,
        changeType,
        oldMaterialId,
        newMaterialId,
        updateMatchingInteriorFinish,
        versionId,
      });

      setPreview(previewData);
      setStep('preview');
    } catch (error: any) {
      console.error('Error generating preview:', error);
      setValidationError(error.message || 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute() {
    if (!preview) return;

    if (preview.percentageChange > 20) {
      const confirmed = window.confirm(
        `This change will increase costs by ${preview.percentageChange.toFixed(1)}%. Are you sure you want to continue?`
      );
      if (!confirmed) return;
    }

    setExecuting(true);

    try {
      const areaIds = scope === 'project' ? [] : selectedAreaIds;
      const result = await executeBulkMaterialChange({
        projectId,
        scope,
        areaIds,
        changeType,
        oldMaterialId,
        newMaterialId,
        updateMatchingInteriorFinish,
        versionId,
      });

      if (result.success) {
        const costDiff = preview.costDifference;
        const diffText = costDiff > 0
          ? `increase of ${formatCurrency(Math.abs(costDiff))}`
          : `reduction of ${formatCurrency(Math.abs(costDiff))}`;

        alert(
          `✓ ${result.updatedCount} cabinets updated successfully.\n\nCost changed from ${formatCurrency(preview.costBefore)} to ${formatCurrency(preview.costAfter)} (${diffText}, ${preview.percentageChange.toFixed(1)}%)`
        );
        onSuccess();
        handleClose();
      } else {
        setValidationError(result.error || 'Failed to update cabinets');
      }
    } catch (error: any) {
      console.error('Error executing change:', error);
      setValidationError(error.message || 'Failed to execute bulk change');
    } finally {
      setExecuting(false);
    }
  }

  function handleClose() {
    setStep('setup');
    setScope(preselectedAreaId ? 'area' : 'project');
    setSelectedAreaIds(preselectedAreaId ? [preselectedAreaId] : []);
    setChangeType('box_material');
    setOldMaterialId('');
    setNewMaterialId('');
    setPreview(null);
    setValidationError('');
    setUpdateMatchingInteriorFinish(false);
    onClose();
  }

  const canPreview = oldMaterialId && newMaterialId && (scope === 'project' || selectedAreaIds.length > 0);

  const showInteriorFinishOption = (changeType === 'box_material' || changeType === 'doors_material') && oldMaterialId;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Material Change" size="xl">
      {step === 'setup' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Scope</label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                <input
                  type="radio"
                  value="project"
                  checked={scope === 'project'}
                  onChange={(e) => {
                    setScope(e.target.value as ChangeScope);
                    setSelectedAreaIds([]);
                  }}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex-1 text-sm text-slate-900">Entire Project</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                <input
                  type="radio"
                  value="area"
                  checked={scope === 'area'}
                  onChange={(e) => {
                    setScope(e.target.value as ChangeScope);
                    if (preselectedAreaId) {
                      setSelectedAreaIds([preselectedAreaId]);
                    }
                  }}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex-1 text-sm text-slate-900">Single Area</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                <input
                  type="radio"
                  value="selected_areas"
                  checked={scope === 'selected_areas'}
                  onChange={(e) => {
                    setScope(e.target.value as ChangeScope);
                    setSelectedAreaIds([]);
                  }}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex-1 text-sm text-slate-900">Selected Areas</span>
              </label>
            </div>

            {(scope === 'area' || scope === 'selected_areas') && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  {scope === 'area' ? 'Select Area' : 'Select Areas'}
                </label>
                {scope === 'area' ? (
                  <select
                    value={selectedAreaIds[0] || ''}
                    onChange={(e) => setSelectedAreaIds(e.target.value ? [e.target.value] : [])}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select an area...</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {areas.map((area) => (
                      <label key={area.id} className="flex items-center space-x-2 cursor-pointer hover:bg-white p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedAreaIds.includes(area.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAreaIds([...selectedAreaIds, area.id]);
                            } else {
                              setSelectedAreaIds(selectedAreaIds.filter((id) => id !== area.id));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                        />
                        <span className="text-sm text-slate-700">{area.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Material Type to Change</label>
            <select
              value={changeType}
              onChange={(e) => setChangeType(e.target.value as MaterialChangeType)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="box_material">Box Construction Material</option>
              <option value="box_edgeband">Box Edgeband</option>
              <option value="doors_material">Doors & Drawer Fronts Material</option>
              <option value="doors_edgeband">Doors Edgeband</option>
              <option value="box_interior_finish">Box Interior Finish</option>
              <option value="doors_interior_finish">Doors Interior Finish</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Current Material</label>
              <select
                value={oldMaterialId}
                onChange={(e) => setOldMaterialId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">Select current material...</option>
                {materialsInUse.map((mat) => (
                  <option key={mat.materialId} value={mat.materialId}>
                    {mat.materialName} ({mat.cabinetCount} cabinet{mat.cabinetCount !== 1 ? 's' : ''})
                  </option>
                ))}
              </select>
              {oldMaterialId && (
                <div className="mt-2 text-xs text-slate-600">
                  {materialsInUse.find(m => m.materialId === oldMaterialId)?.cabinetCount || 0} cabinets use this material
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">New Material</label>
              <AutocompleteSelect
                value={newMaterialId}
                onChange={setNewMaterialId}
                options={getCompatibleMaterials()
                  .filter(m => m.id !== oldMaterialId)
                  .map((mat) => ({
                    value: mat.id,
                    label: `${mat.concept_description} - ${mat.dimensions || ''} - ${formatCurrency(mat.price)}/${mat.unit}`,
                  }))}
                placeholder="Search for new material..."
              />
              <p className="mt-1 text-xs text-slate-500">
                {getCompatibleMaterials().length} compatible materials available
              </p>
            </div>
          </div>

          {showInteriorFinishOption && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateMatchingInteriorFinish}
                  onChange={(e) => setUpdateMatchingInteriorFinish(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                />
                <div>
                  <span className="text-sm font-medium text-blue-900">
                    Update matching interior finish
                  </span>
                  <p className="text-xs text-blue-700 mt-1">
                    If a cabinet's interior finish matches the current material, update it to the new material as well.
                  </p>
                </div>
              </label>
            </div>
          )}

          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-xs text-red-700 mt-1">{validationError}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handlePreview} disabled={!canPreview || loading}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Preview Changes
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Change Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-blue-700 mb-1">Cabinets Affected</p>
                <p className="text-2xl font-bold text-blue-900">{preview.totalCabinets}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700 mb-1">Cost Change</p>
                <p className={`text-2xl font-bold ${preview.costDifference > 0 ? 'text-red-600' : preview.costDifference < 0 ? 'text-green-600' : 'text-slate-700'}`}>
                  {preview.costDifference > 0 ? '+' : ''}{formatCurrency(preview.costDifference)}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {preview.percentageChange > 0 ? '+' : ''}{preview.percentageChange.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-blue-300">
              <div className="flex justify-between text-sm">
                <span className="text-blue-800">Current Total:</span>
                <span className="font-semibold text-blue-900">{formatCurrency(preview.costBefore)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-blue-800">New Total:</span>
                <span className="font-semibold text-blue-900">{formatCurrency(preview.costAfter)}</span>
              </div>
            </div>
          </div>

          {Math.abs(preview.percentageChange) > 20 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">Significant Cost Change</p>
                <p className="text-xs text-amber-700 mt-1">
                  This change will {preview.costDifference > 0 ? 'increase' : 'decrease'} costs by more than 20%. Please verify this is correct.
                </p>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Affected Cabinets</h4>
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-700">SKU</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-slate-700">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-700">Current</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-700">New</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-700">Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {preview.affectedCabinets.map((cabinet, idx) => {
                    const diff = cabinet.newCost - cabinet.currentCost;
                    return (
                      <tr key={cabinet.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-3 py-2 text-slate-900 font-medium">{cabinet.product_sku}</td>
                        <td className="px-3 py-2 text-center text-slate-700">{cabinet.quantity}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(cabinet.currentCost)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(cabinet.newCost)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-slate-600'}`}>
                          {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-xs text-red-700 mt-1">{validationError}</p>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-slate-200">
            <Button variant="ghost" onClick={() => setStep('setup')} disabled={executing}>
              Back to Setup
            </Button>
            <div className="flex space-x-3">
              <Button variant="secondary" onClick={handleClose} disabled={executing}>
                Cancel
              </Button>
              <Button onClick={handleExecute} disabled={executing}>
                {executing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Apply Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
