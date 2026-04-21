import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { formatCurrency } from '../lib/calculations';
import {
  createProjectVersion,
  recalculateAllCabinetPrices,
  saveVersionDetails,
} from '../lib/versioningSystem';
import { recalculateAreaSheetMaterialCosts } from '../lib/sheetMaterials';
import { recalculateAreaEdgebandCosts } from '../lib/edgebandRolls';
import { clearProjectStaleness } from '../lib/priceUpdateSystem';
import { supabase } from '../lib/supabase';

interface MaterialPriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: () => void;
}

export function MaterialPriceUpdateModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}: MaterialPriceUpdateModalProps) {
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<Array<{ id: string; name: string; cabinetCount: number }>>([]);
  const [scope, setScope] = useState<'all' | 'area'>('all');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [versionName, setVersionName] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0, message: '' });
  const [updateComplete, setUpdateComplete] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    updated: number;
    errors: string[];
    areaChanges: Array<{ areaName: string; previous: number; new: number; difference: number }>;
    totalDifference: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAreas();
      const defaultName = `Price Update - ${new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`;
      setVersionName(defaultName);
    }
  }, [isOpen, projectId]);

  async function loadAreas() {
    setLoading(true);
    try {
      const { data: areasData } = await supabase
        .from('project_areas')
        .select('id, name')
        .eq('project_id', projectId)
        .order('display_order');

      const areasWithCounts = await Promise.all(
        (areasData || []).map(async (area) => {
          const { data: cabinets } = await supabase
            .from('area_cabinets')
            .select('id')
            .eq('area_id', area.id);

          return {
            id: area.id,
            name: area.name,
            cabinetCount: cabinets?.length || 0,
          };
        })
      );

      setAreas(areasWithCounts);
      if (areasWithCounts.length > 0) {
        setSelectedAreaId(areasWithCounts[0].id);
      }
    } catch (error) {
      console.error('Error loading areas:', error);
    } finally {
      setLoading(false);
    }
  }

  const totalCabinets = scope === 'all'
    ? areas.reduce((sum, a) => sum + a.cabinetCount, 0)
    : areas.find(a => a.id === selectedAreaId)?.cabinetCount || 0;

  const affectedAreas = scope === 'all'
    ? areas.map(a => a.id)
    : [selectedAreaId];

  async function handleRecalculate() {
    if (!confirmed) return;

    setUpdating(true);
    setUpdateComplete(false);
    setUpdateResult(null);

    try {
      const version = await createProjectVersion(
        projectId,
        versionName,
        'price_update',
        affectedAreas,
        notes || undefined
      );

      const result = await recalculateAllCabinetPrices(
        projectId,
        affectedAreas,
        (message, current, total) => {
          setUpdateProgress({ message, current, total });
        }
      );

      await saveVersionDetails(
        version.id,
        result.areaChanges,
        'price_update',
        undefined,
        { recalculated_at: new Date().toISOString() }
      );

      await clearProjectStaleness(projectId);

      for (const areaId of affectedAreas) {
        await recalculateAreaSheetMaterialCosts(areaId);
        await recalculateAreaEdgebandCosts(areaId);
      }

      const areaChangesArray = [];
      for (const [areaId, change] of result.areaChanges.entries()) {
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

      setUpdateResult({
        updated: result.updated,
        errors: result.errors,
        areaChanges: areaChangesArray,
        totalDifference,
      });

      setUpdateComplete(true);

      if (result.updated > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error recalculating prices:', error);
      setUpdateResult({
        updated: 0,
        errors: [error.message],
        areaChanges: [],
        totalDifference: 0,
      });
      setUpdateComplete(true);
    } finally {
      setUpdating(false);
    }
  }

  function handleClose() {
    if (!updating) {
      setConfirmed(false);
      setScope('all');
      setNotes('');
      setUpdateComplete(false);
      setUpdateResult(null);
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Recalculate Cabinet Prices" size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 text-accent-text animate-spin mx-auto mb-4" />
            <p className="text-fg-600">Loading project data...</p>
          </div>
        </div>
      ) : updating ? (
        <div className="text-center py-12">
          <RefreshCw className="h-12 w-12 text-accent-text animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-fg-900 mb-2">Recalculating Prices...</h3>
          <p className="text-fg-600 mb-4">{updateProgress.message}</p>
          {updateProgress.total > 0 && (
            <div className="max-w-md mx-auto">
              <div className="bg-surf-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-fg-600 mt-2">
                {updateProgress.current} of {updateProgress.total} cabinets
              </p>
            </div>
          )}
        </div>
      ) : updateComplete && updateResult ? (
        <div className="space-y-6">
          <div className="text-center py-6">
            {updateResult.updated > 0 && updateResult.errors.length === 0 ? (
              <>
                <CheckCircle className="h-12 w-12 text-status-emerald-fg mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-fg-900 mb-2">Prices Recalculated Successfully</h3>
                <p className="text-fg-600">
                  Updated {updateResult.updated} cabinet{updateResult.updated !== 1 ? 's' : ''} with current price list values.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="h-12 w-12 text-status-red-fg mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-fg-900 mb-2">Recalculation Completed with Errors</h3>
                <p className="text-fg-600 mb-4">
                  Successfully updated: {updateResult.updated} cabinet{updateResult.updated !== 1 ? 's' : ''}
                </p>
                {updateResult.errors.length > 0 && (
                  <div className="bg-status-red-bg border border-status-red-brd rounded-lg p-4 text-left max-w-md mx-auto">
                    <h4 className="font-semibold text-status-red-fg mb-2">Errors:</h4>
                    <ul className="text-sm text-status-red-fg space-y-1">
                      {updateResult.errors.slice(0, 5).map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                      {updateResult.errors.length > 5 && (
                        <li>...and {updateResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          {updateResult.areaChanges.length > 0 && (
            <div className="border-t border-border-soft pt-6">
              <h4 className="font-semibold text-fg-900 mb-4">Changes by Area</h4>
              <div className="space-y-3">
                {updateResult.areaChanges.map((change, idx) => (
                  <div key={idx} className="bg-surf-app rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-fg-900">{change.areaName}</div>
                        <div className="text-sm text-fg-600 mt-1">
                          {formatCurrency(change.previous)} → {formatCurrency(change.new)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          change.difference >= 0 ? 'text-status-red-fg' : 'text-status-emerald-fg'
                        }`}>
                          {change.difference >= 0 ? '+' : ''}{formatCurrency(change.difference)}
                        </div>
                        <div className="text-xs text-fg-500">
                          {change.previous !== 0
                            ? `${((change.difference / change.previous) * 100).toFixed(1)}%`
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-border-soft">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-fg-900">Total Project Change:</span>
                  <span className={`text-2xl font-bold ${
                    updateResult.totalDifference >= 0 ? 'text-status-red-fg' : 'text-status-emerald-fg'
                  }`}>
                    {updateResult.totalDifference >= 0 ? '+' : ''}{formatCurrency(updateResult.totalDifference)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-border-soft">
            <Button onClick={handleClose}>Close</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-accent-tint-soft border border-accent-tint-border rounded-lg p-4 flex items-start">
            <Info className="h-5 w-5 text-accent-text mr-3 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-accent-text mb-1">What does this do?</h4>
              <p className="text-sm text-accent-text">
                This will recalculate all cabinet costs using the current prices from your price list.
                Materials assigned to each cabinet will remain the same, but their costs will be updated
                to reflect current pricing. A version snapshot will be saved before making changes.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-700 mb-3">Recalculation Scope</label>
            <div className="space-y-2">
              <label className="flex items-start p-3 border border-border-soft rounded-lg hover:bg-surf-app cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="h-4 w-4 text-accent-text border-border-solid focus-visible:ring-focus mt-0.5"
                />
                <div className="ml-3 flex-1">
                  <div className="font-medium text-fg-900">All Areas in Project</div>
                  <div className="text-sm text-fg-600">
                    {areas.reduce((sum, a) => sum + a.cabinetCount, 0)} cabinet{areas.reduce((sum, a) => sum + a.cabinetCount, 0) !== 1 ? 's' : ''} across {areas.length} area{areas.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </label>

              <label className="flex items-start p-3 border border-border-soft rounded-lg hover:bg-surf-app cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'area'}
                  onChange={() => setScope('area')}
                  className="h-4 w-4 text-accent-text border-border-solid focus-visible:ring-focus mt-0.5"
                />
                <div className="ml-3 flex-1">
                  <div className="font-medium text-fg-900">Specific Area</div>
                  <div className="text-sm text-fg-600 mb-2">Recalculate only one area</div>
                  {scope === 'area' && (
                    <select
                      value={selectedAreaId}
                      onChange={(e) => setSelectedAreaId(e.target.value)}
                      className="w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name} ({area.cabinetCount} cabinet{area.cabinetCount !== 1 ? 's' : ''})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>
            </div>
          </div>

          <div className="bg-surf-app rounded-lg p-4">
            <div className="text-sm text-fg-700">
              <strong>{totalCabinets}</strong> cabinet{totalCabinets !== 1 ? 's' : ''} will be recalculated
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-700 mb-1">
              Version Name <span className="text-fg-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              className="w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus"
              placeholder="e.g., Q1 2024 Price Update"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-700 mb-1">
              Notes <span className="text-fg-500 font-normal">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border-solid rounded-lg focus:outline-none focus:ring-2 focus-visible:ring-focus"
              placeholder="Add any notes about this price update..."
            />
          </div>

          <div className="flex items-start">
            <input
              type="checkbox"
              id="confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4 text-accent-text border-border-solid rounded focus-visible:ring-focus mt-1"
            />
            <label htmlFor="confirm" className="ml-2 text-sm text-fg-700">
              I understand this will recalculate all costs using current price list values.
              A version will be saved before making changes.
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-border-soft">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleRecalculate}
              disabled={!confirmed}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Recalculate {totalCabinets} Cabinet{totalCabinets !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
