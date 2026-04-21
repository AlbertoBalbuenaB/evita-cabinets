import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, ArrowRight } from 'lucide-react';
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
  const [changeType, setChangeType] = useState<MaterialChangeType | 'hardware'>('box_material');
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
  const [autoRecalculate, setAutoRecalculate] = useState(true);
  const [versionName, setVersionName] = useState('');
  const [notes, setNotes] = useState('');
  const [recalculateProgress, setRecalculateProgress] = useState({ current: 0, total: 0, message: '' });
  const [showResults, setShowResults] = useState(false);
  const [finalResults, setFinalResults] = useState<{
    materialChange: { updated: number; costDifference: number };
    priceRecalc?: { updated: number; areaChanges: any[]; totalDifference: number };
  } | null>(null);

  const isHardwareMode = changeType === 'hardware';
  const [hardwareInUse, setHardwareInUse] = useState<HardwareUsageInfo[]>([]);
  const [hardwareOperationType, setHardwareOperationType] = useState<'replace' | 'remove'>('replace');
  const [hardwarePreview, setHardwarePreview] = useState<BulkHardwareChangePreview | null>(null);
  const [allHardware, setAllHardware] = useState<PriceListItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (changeType === 'hardware') {
        loadAllHardware();
        loadHardwareInUse();
      } else {
        loadAllMaterials();
        if (scope && changeType) {
          loadMaterialsInUse();
        }
      }
    }
  }, [isOpen, scope, selectedAreaIds, changeType]);

  useEffect(() => {
    setPreview(null);
    setOldMaterialId('');
    setNewMaterialId('');
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
      const materials = await getMaterialsInUse(projectId, areaIds, changeType as MaterialChangeType);
      setMaterialsInUse(materials);
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllHardware() {
    try {
      const { data, error } = await supabase
        .from('price_list')
        .select('*')
        .eq('is_active', true)
        .order('concept_description');
      if (error) throw error;
      const hw = (data || []).filter((item: PriceListItem) => {
        const t = item.type.toLowerCase();
        const d = item.concept_description.toLowerCase();
        return t.includes('hinge') || t.includes('slide') || t.includes('pull') ||
          t.includes('handle') || t.includes('hardware') ||
          d.includes('hinge') || d.includes('slide') || d.includes('drawer') ||
          d.includes('pull') || d.includes('knob') || d.includes('handle');
      });
      setAllHardware(hw);
    } catch (error) {
      console.error('Error loading hardware:', error);
    }
  }

  async function loadHardwareInUse() {
    try {
      setLoading(true);
      const areaIds = scope === 'project' ? [] : selectedAreaIds;
      const hardware = await getHardwareInUse(projectId, areaIds);
      setHardwareInUse(hardware);
    } catch (error) {
      console.error('Error loading hardware in use:', error);
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

    const isDoorProfile = (type: string) => type.toLowerCase().includes('door profile');

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
        case 'door_profile':
          return isDoorProfile(materialType);
        default:
          return true;
      }
    });
  }

  async function handlePreview() {
    if (!oldMaterialId) {
      setValidationError(isHardwareMode ? 'Please select current hardware' : 'Please select current material');
      return;
    }

    if (!isHardwareMode && !newMaterialId) {
      setValidationError('Please select new material');
      return;
    }

    if (isHardwareMode && hardwareOperationType === 'replace' && !newMaterialId) {
      setValidationError('Please select replacement hardware');
      return;
    }

    setValidationError('');
    setLoading(true);

    try {
      if (isHardwareMode) {
        if (hardwareOperationType === 'replace') {
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
          newHardwareId: hardwareOperationType === 'replace' ? newMaterialId : undefined,
          operationType: hardwareOperationType,
        });

        setHardwarePreview(previewData);
        setStep('preview');
      } else {
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
          changeType: changeType as MaterialChangeType,
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
    if (executing) return;
    const activePreview = isHardwareMode ? hardwarePreview : preview;
    if (!activePreview) return;

    if (Math.abs(activePreview.percentageChange) > 20) {
      const changeWord = activePreview.percentageChange > 0 ? 'increase' : 'decrease';
      const confirmed = window.confirm(
        `This change will ${changeWord} costs by ${Math.abs(activePreview.percentageChange).toFixed(1)}%. Are you sure you want to continue?`
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

      if (isHardwareMode) {
        const result = await executeBulkHardwareChange({
          projectId,
          scope,
          areaIds,
          oldHardwareId: oldMaterialId,
          newHardwareId: hardwareOperationType === 'replace' ? newMaterialId : undefined,
          operationType: hardwareOperationType,
        });

        if (!result.success) {
          setValidationError(result.error || 'Failed to update cabinets');
          setExecuting(false);
          return;
        }

        const materialResult = {
          updated: result.updatedCount,
          costDifference: activePreview.costDifference,
        };

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
            changeType: 'hardware',
            oldMaterialId,
            newMaterialId: hardwareOperationType === 'replace' ? newMaterialId : null,
            operationType: hardwareOperationType,
          },
          undefined
        );

        setFinalResults({ materialChange: materialResult });
        setShowResults(true);

        setTimeout(() => {
          onSuccess();
          resetAndClose();
        }, 4000);
        return;
      }

      const result = await executeBulkMaterialChange({
        projectId,
        scope,
        areaIds,
        changeType: changeType as MaterialChangeType,
        oldMaterialId,
        newMaterialId,
        updateMatchingInteriorFinish,
      }, preview || undefined);

      if (!result.success) {
        setValidationError(result.error || 'Failed to update cabinets');
        setExecuting(false);
        return;
      }

      const materialResult = {
        updated: result.updatedCount,
        costDifference: activePreview.costDifference,
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
            operationType: 'replace',
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
            operationType: 'replace',
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
        resetAndClose();
      }, 4000);
    } catch (error: any) {
      console.error('Error executing change:', error);
      setValidationError(error.message || 'Failed to execute bulk change');
      setExecuting(false);
    }
  }

  function resetAllState() {
    setExecuting(false);
    setStep('setup');
    setScope(preselectedAreaId ? 'area' : 'project');
    setSelectedAreaIds(preselectedAreaId ? [preselectedAreaId] : []);
    setChangeType('box_material');
    setOldMaterialId('');
    setNewMaterialId('');
    setPreview(null);
    setValidationError('');
    setUpdateMatchingInteriorFinish(false);
    setAutoRecalculate(true);
    setVersionName('');
    setNotes('');
    setShowResults(false);
    setFinalResults(null);
    setHardwareInUse([]);
    setHardwareOperationType('replace');
    setHardwarePreview(null);
    setRecalculateProgress({ current: 0, total: 0, message: '' });
  }

  function handleClose() {
    if (executing) return;
    resetAllState();
    onClose();
  }

  function resetAndClose() {
    resetAllState();
    onClose();
  }

  const canPreview = oldMaterialId &&
    (isHardwareMode ? (hardwareOperationType === 'remove' || newMaterialId) : newMaterialId) &&
    (scope === 'project' || selectedAreaIds.length > 0);

  const showInteriorFinishOption = (changeType === 'box_material' || changeType === 'doors_material') && oldMaterialId;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Material Change" size="xl">
      {step === 'setup' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-fg-700 mb-3">Scope</label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer p-3 border border-border-soft rounded-lg hover:bg-surf-app">
                <input
                  type="radio"
                  value="project"
                  checked={scope === 'project'}
                  onChange={(e) => {
                    setScope(e.target.value as ChangeScope);
                    setSelectedAreaIds([]);
                  }}
                  className="w-4 h-4 text-accent-text focus-visible:ring-focus"
                />
                <span className="flex-1 text-sm text-fg-900">Entire Project</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer p-3 border border-border-soft rounded-lg hover:bg-surf-app">
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
                  className="w-4 h-4 text-accent-text focus-visible:ring-focus"
                />
                <span className="flex-1 text-sm text-fg-900">Single Area</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer p-3 border border-border-soft rounded-lg hover:bg-surf-app">
                <input
                  type="radio"
                  value="selected_areas"
                  checked={scope === 'selected_areas'}
                  onChange={(e) => {
                    setScope(e.target.value as ChangeScope);
                    setSelectedAreaIds([]);
                  }}
                  className="w-4 h-4 text-accent-text focus-visible:ring-focus"
                />
                <span className="flex-1 text-sm text-fg-900">Selected Areas</span>
              </label>
            </div>

            {(scope === 'area' || scope === 'selected_areas') && (
              <div className="mt-3 p-3 bg-surf-app rounded-lg border border-border-soft">
                <label className="block text-xs font-medium text-fg-700 mb-2">
                  {scope === 'area' ? 'Select Area' : 'Select Areas'}
                </label>
                {scope === 'area' ? (
                  <select
                    value={selectedAreaIds[0] || ''}
                    onChange={(e) => setSelectedAreaIds(e.target.value ? [e.target.value] : [])}
                    className="w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus text-sm"
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
                      <label key={area.id} className="flex items-center space-x-2 cursor-pointer hover:bg-surf-card p-2 rounded">
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
                          className="w-4 h-4 text-accent-text focus-visible:ring-focus rounded"
                        />
                        <span className="text-sm text-fg-700">{area.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-700 mb-2">Material Type to Change</label>
            <select
              value={changeType}
              onChange={(e) => setChangeType(e.target.value as MaterialChangeType | 'hardware')}
              className="w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus"
            >
              <option value="box_material">Box Construction Material</option>
              <option value="box_edgeband">Box Edgeband</option>
              <option value="doors_material">Doors & Drawer Fronts Material</option>
              <option value="doors_edgeband">Doors Edgeband</option>
              <option value="box_interior_finish">Box Interior Finish</option>
              <option value="doors_interior_finish">Doors Interior Finish</option>
              <option value="door_profile">Door Profile</option>
              <option value="drawer_box_material">Drawer Box Material</option>
              <option value="shelf_material">Shelf Material</option>
              <option value="hardware">Hardware</option>
            </select>
          </div>

          {isHardwareMode && (
            <div className="p-3 bg-surf-app border border-border-soft rounded-lg">
              <label className="block text-xs font-medium text-fg-700 mb-2">Operation Type</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="replace"
                    checked={hardwareOperationType === 'replace'}
                    onChange={() => { setHardwareOperationType('replace'); setNewMaterialId(''); }}
                    className="w-4 h-4 text-accent-text focus-visible:ring-focus"
                  />
                  <span className="text-sm text-fg-900">Replace with another hardware</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="remove"
                    checked={hardwareOperationType === 'remove'}
                    onChange={() => { setHardwareOperationType('remove'); setNewMaterialId(''); }}
                    className="w-4 h-4 text-accent-text focus-visible:ring-focus"
                  />
                  <span className="text-sm text-fg-900">Remove from cabinets</span>
                </label>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg-700 mb-2">
                {isHardwareMode ? 'Current Hardware' : 'Current Material'}
              </label>
              <select
                value={oldMaterialId}
                onChange={(e) => setOldMaterialId(e.target.value)}
                className="w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus"
                disabled={loading}
              >
                <option value="">{isHardwareMode ? 'Select current hardware...' : 'Select current material...'}</option>
                {isHardwareMode
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
                <div className="mt-2 text-xs text-fg-600">
                  {isHardwareMode
                    ? `${hardwareInUse.find(h => h.hardwareId === oldMaterialId)?.cabinetCount || 0} cabinets use this hardware`
                    : `${materialsInUse.find(m => m.materialId === oldMaterialId)?.cabinetCount || 0} cabinets use this material`
                  }
                </div>
              )}
            </div>

            <div>
              {isHardwareMode && hardwareOperationType === 'remove' ? (
                <div className="flex items-center justify-center h-full pt-6 text-sm text-fg-500 italic">
                  Hardware will be removed from all matching cabinets
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-fg-700">
                      {isHardwareMode ? 'Replacement Hardware' : 'New Material'}
                    </label>
                  </div>
                  {isHardwareMode ? (
                    <>
                      <AutocompleteSelect
                        value={newMaterialId}
                        onChange={setNewMaterialId}
                        options={allHardware
                          .filter(h => h.id !== oldMaterialId)
                          .map((hw) => ({
                            value: hw.id,
                            label: `${hw.concept_description} - ${formatCurrency(hw.price)}/${hw.unit}`,
                          }))}
                        placeholder="Search for replacement hardware..."
                      />
                      <p className="mt-1 text-xs text-fg-500">
                        {allHardware.length} hardware items available
                      </p>
                    </>
                  ) : (
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
                        placeholder="Search for new material..."
                      />
                      <p className="mt-1 text-xs text-fg-500">
                        {getCompatibleMaterials().length} compatible materials available
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {showInteriorFinishOption && (
            <div className="p-3 bg-accent-tint-soft border border-accent-tint-border rounded-lg">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateMatchingInteriorFinish}
                  onChange={(e) => setUpdateMatchingInteriorFinish(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-accent-text focus-visible:ring-focus rounded"
                />
                <div>
                  <span className="text-sm font-medium text-blue-900">
                    Update matching interior finish
                  </span>
                  <p className="text-xs text-accent-text mt-1">
                    If a cabinet's interior finish matches the current material, update it to the new material as well.
                  </p>
                </div>
              </label>
            </div>
          )}

          <div className="p-4 bg-status-emerald-bg border border-status-emerald-brd rounded-lg">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRecalculate}
                onChange={(e) => setAutoRecalculate(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-status-emerald-fg focus:ring-green-500 rounded"
              />
              <div className="flex-1">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-green-900">
                    Automatically recalculate prices after material change
                  </span>
                  <span className="ml-2 text-xs bg-status-emerald-bg text-green-800 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-status-emerald-fg mt-1">
                  After changing materials, all affected cabinets will be recalculated using current price list values. This ensures costs are always up to date.
                </p>
              </div>
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-fg-700 mb-1">
                Version Name <span className="text-fg-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                className="w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus text-sm"
                placeholder="e.g., Switch to Premium Melamine"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-fg-700 mb-1">
                Notes <span className="text-fg-500 font-normal">(Optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus text-sm"
                placeholder="Add any notes about this material change..."
              />
            </div>
          </div>

          {validationError && (
            <div className="p-3 bg-status-red-bg border border-status-red-brd rounded-lg flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-status-red-fg flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-xs text-status-red-fg mt-1">{validationError}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-border-soft">
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

      {step === 'preview' && (isHardwareMode ? hardwarePreview : preview) && (() => {
        const activePreview = (isHardwareMode ? hardwarePreview : preview)!;
        return (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-accent-tint-border">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Change Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-accent-text mb-1">Cabinets Affected</p>
                <p className="text-2xl font-bold text-blue-900">{activePreview.totalCabinets}</p>
              </div>
              <div>
                <p className="text-xs text-accent-text mb-1">Cost Change</p>
                <p className={`text-2xl font-bold ${activePreview.costDifference > 0 ? 'text-status-red-fg' : activePreview.costDifference < 0 ? 'text-status-emerald-fg' : 'text-fg-700'}`}>
                  {activePreview.costDifference > 0 ? '+' : ''}{formatCurrency(activePreview.costDifference)}
                </p>
                <p className="text-xs text-accent-text mt-1">
                  {activePreview.percentageChange > 0 ? '+' : ''}{activePreview.percentageChange.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-accent-tint-border">
              <div className="flex justify-between text-sm">
                <span className="text-blue-800">Current Total:</span>
                <span className="font-semibold text-blue-900">{formatCurrency(activePreview.costBefore)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-blue-800">New Total:</span>
                <span className="font-semibold text-blue-900">{formatCurrency(activePreview.costAfter)}</span>
              </div>
            </div>
          </div>

          {Math.abs(activePreview.percentageChange) > 20 && (
            <div className="p-3 bg-status-amber-bg border border-status-amber-brd rounded-lg flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-status-amber-fg flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">Significant Cost Change</p>
                <p className="text-xs text-status-amber-fg mt-1">
                  This change will {activePreview.costDifference > 0 ? 'increase' : 'decrease'} costs by more than 20%. Please verify this is correct.
                </p>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-fg-900 mb-3">Affected Cabinets</h4>
            <div className="max-h-60 overflow-y-auto border border-border-soft rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-surf-app sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-fg-700">SKU</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-fg-700">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-fg-700">Current</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-fg-700">New</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-fg-700">Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {activePreview.affectedCabinets.map((cabinet, idx) => {
                    const diff = cabinet.newCost - cabinet.currentCost;
                    return (
                      <tr key={cabinet.id} className={idx % 2 === 0 ? 'bg-surf-card' : 'bg-surf-app'}>
                        <td className="px-3 py-2 text-fg-900 font-medium">{cabinet.product_sku}</td>
                        <td className="px-3 py-2 text-center text-fg-700">{cabinet.quantity}</td>
                        <td className="px-3 py-2 text-right text-fg-700">{formatCurrency(cabinet.currentCost)}</td>
                        <td className="px-3 py-2 text-right text-fg-700">{formatCurrency(cabinet.newCost)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${diff > 0 ? 'text-status-red-fg' : diff < 0 ? 'text-status-emerald-fg' : 'text-fg-600'}`}>
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
            <div className="p-3 bg-status-red-bg border border-status-red-brd rounded-lg flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-status-red-fg flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-xs text-status-red-fg mt-1">{validationError}</p>
              </div>
            </div>
          )}

          {!executing && !showResults && (
            <div className="flex justify-between items-center pt-4 border-t border-border-soft">
              <Button variant="ghost" onClick={() => setStep('setup')}>
                Back to Setup
              </Button>
              <div className="flex space-x-3">
                <Button variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleExecute} disabled={executing}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Apply Changes
                </Button>
              </div>
            </div>
          )}

          {executing && !showResults && (
            <div className="text-center py-8">
              <RefreshCw className="h-12 w-12 text-accent-text animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-fg-900 mb-2">
                {autoRecalculate ? 'Applying Changes & Recalculating Prices...' : 'Applying Material Changes...'}
              </h3>
              {autoRecalculate && recalculateProgress.total > 0 && (
                <>
                  <p className="text-fg-600 mb-4">{recalculateProgress.message}</p>
                  <div className="max-w-md mx-auto">
                    <div className="bg-surf-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${(recalculateProgress.current / recalculateProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-fg-600 mt-2">
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
                <CheckCircle className="h-12 w-12 text-status-emerald-fg mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-fg-900 mb-2">Changes Applied Successfully</h3>
                <p className="text-fg-600">
                  {autoRecalculate
                    ? 'Materials changed and prices recalculated'
                    : 'Materials changed successfully'}
                </p>
              </div>

              <div className="bg-accent-tint-soft border border-accent-tint-border rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">Material Change</h4>
                <div className="text-sm text-blue-800">
                  <div>Updated {finalResults.materialChange.updated} cabinet{finalResults.materialChange.updated !== 1 ? 's' : ''}</div>
                  <div className="mt-1">
                    Cost impact: <span className={`font-semibold ${
                      finalResults.materialChange.costDifference >= 0 ? 'text-status-red-fg' : 'text-status-emerald-fg'
                    }`}>
                      {finalResults.materialChange.costDifference >= 0 ? '+' : ''}
                      {formatCurrency(finalResults.materialChange.costDifference)}
                    </span>
                  </div>
                </div>
              </div>

              {finalResults.priceRecalc && (
                <div className="bg-status-emerald-bg border border-status-emerald-brd rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3">Price Recalculation</h4>
                  <div className="text-sm text-green-800 space-y-2">
                    <div>Recalculated {finalResults.priceRecalc.updated} cabinet{finalResults.priceRecalc.updated !== 1 ? 's' : ''}</div>

                    {finalResults.priceRecalc.areaChanges.map((change, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-t border-status-emerald-brd">
                        <span className="font-medium">{change.areaName}</span>
                        <span className={`font-semibold ${
                          change.difference >= 0 ? 'text-status-red-fg' : 'text-status-emerald-fg'
                        }`}>
                          {change.difference >= 0 ? '+' : ''}{formatCurrency(change.difference)}
                        </span>
                      </div>
                    ))}

                    <div className="pt-2 border-t-2 border-status-emerald-brd flex justify-between items-center">
                      <span className="font-semibold">Total Change:</span>
                      <span className={`text-lg font-bold ${
                        finalResults.priceRecalc.totalDifference >= 0 ? 'text-status-red-fg' : 'text-status-emerald-fg'
                      }`}>
                        {finalResults.priceRecalc.totalDifference >= 0 ? '+' : ''}
                        {formatCurrency(finalResults.priceRecalc.totalDifference)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-border-soft">
                <Button onClick={handleClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
        );
      })()}
    </Modal>
  );
}
