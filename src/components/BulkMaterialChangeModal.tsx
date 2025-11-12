import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, ArrowRight, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AutocompleteSelect } from './AutocompleteSelect';
import { formatCurrency } from '../lib/calculations';
import { supabase } from '../lib/supabase';
import {
  createProjectVersion,
  recalculateAllCabinetPrices,
  saveVersionDetails,
} from '../lib/versioningSystem';
import { recalculateAreaSheetMaterialCosts } from '../lib/sheetMaterials';
import { recalculateAreaEdgebandCosts } from '../lib/edgebandRolls';
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
import {
  getHardwareInUse,
  previewBulkHardwareChange,
  executeBulkHardwareChange,
  validateHardwareReplacement,
  type HardwareUsageInfo,
  type BulkHardwareChangePreview,
} from '../lib/bulkHardwareChange';
import type { ProjectArea, PriceListItem } from '../types';

interface BulkMaterialChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
  areas: ProjectArea[];
  preselectedAreaId?: string;
}

export function BulkMaterialChangeModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  areas,
  preselectedAreaId,
}: BulkMaterialChangeModalProps) {
  const [scope, setScope] = useState<ChangeScope>(preselectedAreaId ? 'area' : 'project');
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>(preselectedAreaId ? [preselectedAreaId] : []);
  const [changeType, setChangeType] = useState<MaterialChangeType>('box_material');
  const [materialsInUse, setMaterialsInUse] = useState<MaterialUsageInfo[]>([]);
  const [hardwareInUse, setHardwareInUse] = useState<HardwareUsageInfo[]>([]);
  const [allMaterials, setAllMaterials] = useState<PriceListItem[]>([]);
  const [oldMaterialId, setOldMaterialId] = useState('');
  const [newMaterialId, setNewMaterialId] = useState('');
  const [operationType, setOperationType] = useState<'replace' | 'remove'>('replace');
  const [updateMatchingInteriorFinish, setUpdateMatchingInteriorFinish] = useState(false);
  const [preview, setPreview] = useState<BulkChangePreview | BulkHardwareChangePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [step, setStep] = useState<'setup' | 'preview'>('setup');
  const [autoRecalculate, setAutoRecalculate] = useState(true);
  const [versionName, setVersionName] = useState('');
  const [notes, setNotes] = useState('');
  const [recalculateProgress, setRecalculateProgress] = useState({ current: 0, total: 0, message: '' });
  const [showResults, setShowResults] = useState(false);
  const [finalResults, setFinalResults] = useState<{
    materialChange: { updated: number; costDifference: number };
    priceRecalc?: { updated: number; areaChanges: any[]; totalDifference: number };
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAllMaterials();
      if (scope && changeType) {
        if (changeType === 'hardware') {
          loadHardwareInUse();
        } else {
          loadMaterialsInUse();
        }
      }
    }
  }, [isOpen, scope, selectedAreaIds, changeType]);

  useEffect(() => {
    setPreview(null);
    setOldMaterialId('');
    setNewMaterialId('');
    setOperationType('replace');
    setValidationError('');
    const defaultName = `Material Change - ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
    setVersionName(defaultName);
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
      const materials = await getMaterialsInUse(projectId, areaIds, changeType);
      setMaterialsInUse(materials);
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadHardwareInUse() {
    try {
      setLoading(true);
      const areaIds = scope === 'project' ? [] : selectedAreaIds;
      const hardware = await getHardwareInUse(projectId, areaIds);
      setHardwareInUse(hardware);
    } catch (error) {
      console.error('Error loading hardware:', error);
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
        case 'hardware':
          return isHardware(materialType);
        default:
          return true;
      }
    });
  }

  async function handlePreview() {
    if (!oldMaterialId) {
      setValidationError('Please select current ' + (changeType === 'hardware' ? 'hardware' : 'material'));
      return;
    }

    if (operationType === 'replace' && !newMaterialId) {
      setValidationError('Please select new ' + (changeType === 'hardware' ? 'hardware' : 'material'));
      return;
    }

    setValidationError('');
    setLoading(true);

    try {
      if (changeType === 'hardware') {
        if (operationType === 'replace' && newMaterialId) {
          const validation = await validateHardwareReplacement(oldMaterialId, newMaterialId);
          if (!validation.valid) {
            setValidationError(validation.error || 'Invalid hardware replacement');
            setLoading(false);
            return;
          }
        }

        const areaIds = scope === 'project' ? [] : selectedAreaIds;
        const previewData = await previewBulkHardwareChange({
          projectId,
          scope,
          areaIds,
          oldHardwareId: oldMaterialId,
          newHardwareId: operationType === 'replace' ? newMaterialId : undefined,
          operationType,
        });

        setPreview(previewData);
        setStep('preview');
      } else {
        if (!newMaterialId) {
          setValidationError('Please select new material');
          setLoading(false);
          return;
        }

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
        });

        setPreview(previewData);
        setStep('preview');
      }
    } catch (error: any) {
      console.error('Error generating preview:', error);
      setValidationError(error.message || 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute() {
    if (!preview) return;

    if (Math.abs(preview.percentageChange) > 20) {
      const changeWord = preview.percentageChange > 0 ? 'increase' : 'decrease';
      const confirmed = window.confirm(
        `This change will ${changeWord} costs by ${Math.abs(preview.percentageChange).toFixed(1)}%. Are you sure you want to continue?`
      );
      if (!confirmed) return;
    }

    if (changeType === 'hardware' && operationType === 'remove') {
      const confirmed = window.confirm(
        `You are about to remove hardware from ${preview.totalCabinets} cabinets. This action cannot be undone. Continue?`
      );
      if (!confirmed) return;
    }

    setExecuting(true);
    setShowResults(false);

    try {
      const areaIds = scope === 'project' ? [] : selectedAreaIds;
      const affectedAreas = scope === 'project' ? areas.map(a => a.id) : selectedAreaIds;

      const version = await createProjectVersion(
        projectId,
        versionName,
        'material_change',
        affectedAreas,
        notes || undefined
      );

      let result;

      if (changeType === 'hardware') {
        result = await executeBulkHardwareChange({
          projectId,
          scope,
          areaIds,
          oldHardwareId: oldMaterialId,
          newHardwareId: operationType === 'replace' ? newMaterialId : undefined,
          operationType,
        });
      } else {
        result = await executeBulkMaterialChange({
          projectId,
          scope,
          areaIds,
          changeType,
          oldMaterialId,
          newMaterialId,
          updateMatchingInteriorFinish,
        });
      }

      if (!result.success) {
        setValidationError(result.error || 'Failed to update cabinets');
        setExecuting(false);
        return;
      }

      const materialResult = {
        updated: result.updatedCount,
        costDifference: preview.costDifference,
      };

      let priceRecalcResult = undefined;

      if (autoRecalculate) {
        const recalcResult = await recalculateAllCabinetPrices(
          projectId,
          affectedAreas,
          (message, current, total) => {
            setRecalculateProgress({ message, current, total });
          }
        );

        for (const areaId of affectedAreas) {
          await recalculateAreaSheetMaterialCosts(areaId);
          await recalculateAreaEdgebandCosts(areaId);
        }

        const areaChangesArray = [];
        for (const [areaId, change] of recalcResult.areaChanges.entries()) {
          const area = areas.find(a => a.id === areaId);
          const difference = change.new - change.previous;
          areaChangesArray.push({
            areaName: area?.name || 'Unknown Area',
            previous: change.previous,
            new: change.new,
            difference,
          });
        }

        const totalDifference = areaChangesArray.reduce((sum, a) => sum + a.difference, 0);

        priceRecalcResult = {
          updated: recalcResult.updated,
          areaChanges: areaChangesArray,
          totalDifference,
        };

        await saveVersionDetails(
          version.id,
          recalcResult.areaChanges,
          'both',
          {
            changeType,
            oldMaterialId,
            newMaterialId,
            operationType,
          },
          { recalculated_at: new Date().toISOString() }
        );
      } else {
        const basicChanges = new Map();
        for (const areaId of affectedAreas) {
          const { data: area } = await supabase
            .from('project_areas')
            .select('subtotal')
            .eq('id', areaId)
            .single();
          basicChanges.set(areaId, { previous: (area as any)?.subtotal || 0, new: (area as any)?.subtotal || 0 });
        }

        await saveVersionDetails(
          version.id,
          basicChanges,
          'material_change',
          {
            changeType,
            oldMaterialId,
            newMaterialId,
            operationType,
          },
          undefined
        );
      }

      setFinalResults({
        materialChange: materialResult,
        priceRecalc: priceRecalcResult,
      });
      setShowResults(true);

      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 4000);
    } catch (error: any) {
      console.error('Error executing change:', error);
      setValidationError(error.message || 'Failed to execute bulk change');
      setExecuting(false);
    }
  }

  function handleClose() {
    if (executing) return;
    setStep('setup');
    setScope(preselectedAreaId ? 'area' : 'project');
    setSelectedAreaIds(preselectedAreaId ? [preselectedAreaId] : []);
    setChangeType('box_material');
    setOldMaterialId('');
    setNewMaterialId('');
    setOperationType('replace');
    setPreview(null);
    setValidationError('');
    setUpdateMatchingInteriorFinish(false);
    setAutoRecalculate(true);
    setVersionName('');
    setNotes('');
    setShowResults(false);
    setFinalResults(null);
    onClose();
  }

  const canPreview = oldMaterialId &&
    (operationType === 'remove' || newMaterialId) &&
    (scope === 'project' || selectedAreaIds.length > 0);

  const showInteriorFinishOption = (changeType === 'box_material' || changeType === 'doors_material') && oldMaterialId && operationType === 'replace';
  const isHardwareChange = changeType === 'hardware';

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
              <option value="hardware">Hardware</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Current {isHardwareChange ? 'Hardware' : 'Material'}
              </label>
              <select
                value={oldMaterialId}
                onChange={(e) => setOldMaterialId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">Select current {isHardwareChange ? 'hardware' : 'material'}...</option>
                {isHardwareChange
                  ? hardwareInUse.map((hw) => (
                      <option key={hw.hardwareId} value={hw.hardwareId}>
                        {hw.hardwareName} ({hw.cabinetCount} cabinet{hw.cabinetCount !== 1 ? 's' : ''})
                      </option>
                    ))
                  : materialsInUse.map((mat) => (
                      <option key={mat.materialId} value={mat.materialId}>
                        {mat.materialName} ({mat.cabinetCount} cabinet{mat.cabinetCount !== 1 ? 's' : ''})
                      </option>
                    ))
                }
              </select>
              {oldMaterialId && (
                <div className="mt-2 text-xs text-slate-600">
                  {isHardwareChange
                    ? `${hardwareInUse.find(h => h.hardwareId === oldMaterialId)?.cabinetCount || 0} cabinets use this hardware`
                    : `${materialsInUse.find(m => m.materialId === oldMaterialId)?.cabinetCount || 0} cabinets use this material`
                  }
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  New {isHardwareChange ? 'Hardware' : 'Material'}
                </label>
                {isHardwareChange && (
                  <Button
                    variant={operationType === 'remove' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setOperationType(operationType === 'remove' ? 'replace' : 'remove');
                      if (operationType === 'replace') {
                        setNewMaterialId('');
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {operationType === 'remove' ? 'Removing' : 'Remove Instead'}
                  </Button>
                )}
              </div>
              {operationType === 'replace' ? (
                <>
                  <AutocompleteSelect
                    value={newMaterialId}
                    onChange={setNewMaterialId}
                    options={getCompatibleMaterials()
                      .filter(m => m.id !== oldMaterialId)
                      .map((mat) => ({
                        value: mat.id,
                        label: `${mat.concept_description} - ${mat.dimensions || ''} - ${formatCurrency(mat.price)}/${mat.unit}`,
                      }))}
                    placeholder={`Search for new ${isHardwareChange ? 'hardware' : 'material'}...`}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {getCompatibleMaterials().length} compatible {isHardwareChange ? 'hardware items' : 'materials'} available
                  </p>
                </>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-900 font-medium">Hardware will be removed</p>
                  <p className="text-xs text-red-700 mt-1">
                    The selected hardware will be deleted from all affected cabinets. This is useful when clients provide their own hardware.
                  </p>
                </div>
              )}
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

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRecalculate}
                onChange={(e) => setAutoRecalculate(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-green-600 focus:ring-green-500 rounded"
              />
              <div className="flex-1">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-green-900">
                    Automatically recalculate prices after material change
                  </span>
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  After changing materials, all affected cabinets will be recalculated using current price list values. This ensures costs are always up to date.
                </p>
              </div>
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Version Name <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="e.g., Switch to Premium Melamine"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notes <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Add any notes about this material change..."
              />
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

          {!executing && !showResults && (
            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <Button variant="ghost" onClick={() => setStep('setup')}>
                Back to Setup
              </Button>
              <div className="flex space-x-3">
                <Button variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleExecute}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Apply Changes
                </Button>
              </div>
            </div>
          )}

          {executing && !showResults && (
            <div className="text-center py-8">
              <RefreshCw className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {autoRecalculate ? 'Applying Changes & Recalculating Prices...' : 'Applying Material Changes...'}
              </h3>
              {autoRecalculate && recalculateProgress.total > 0 && (
                <>
                  <p className="text-slate-600 mb-4">{recalculateProgress.message}</p>
                  <div className="max-w-md mx-auto">
                    <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${(recalculateProgress.current / recalculateProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-slate-600 mt-2">
                      {recalculateProgress.current} of {recalculateProgress.total} cabinets
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {showResults && finalResults && (
            <div className="space-y-6">
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Changes Applied Successfully</h3>
                <p className="text-slate-600">
                  {autoRecalculate
                    ? 'Materials changed and prices recalculated'
                    : 'Materials changed successfully'}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">Material Change</h4>
                <div className="text-sm text-blue-800">
                  <div>Updated {finalResults.materialChange.updated} cabinet{finalResults.materialChange.updated !== 1 ? 's' : ''}</div>
                  <div className="mt-1">
                    Cost impact: <span className={`font-semibold ${
                      finalResults.materialChange.costDifference >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {finalResults.materialChange.costDifference >= 0 ? '+' : ''}
                      {formatCurrency(finalResults.materialChange.costDifference)}
                    </span>
                  </div>
                </div>
              </div>

              {finalResults.priceRecalc && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3">Price Recalculation</h4>
                  <div className="text-sm text-green-800 space-y-2">
                    <div>Recalculated {finalResults.priceRecalc.updated} cabinet{finalResults.priceRecalc.updated !== 1 ? 's' : ''}</div>

                    {finalResults.priceRecalc.areaChanges.map((change, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-t border-green-200">
                        <span className="font-medium">{change.areaName}</span>
                        <span className={`font-semibold ${
                          change.difference >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {change.difference >= 0 ? '+' : ''}{formatCurrency(change.difference)}
                        </span>
                      </div>
                    ))}

                    <div className="pt-2 border-t-2 border-green-300 flex justify-between items-center">
                      <span className="font-semibold">Total Change:</span>
                      <span className={`text-lg font-bold ${
                        finalResults.priceRecalc.totalDifference >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {finalResults.priceRecalc.totalDifference >= 0 ? '+' : ''}
                        {formatCurrency(finalResults.priceRecalc.totalDifference)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <Button onClick={handleClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
