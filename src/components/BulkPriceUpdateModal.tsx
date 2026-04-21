import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { formatCurrency } from '../lib/calculations';
import {
  analyzeProjectPriceChanges,
  updateProjectPrices,
  type ProjectPriceAnalysis,
  type AffectedArea,
} from '../lib/priceUpdateSystem';

interface BulkPriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: () => void;
}

export function BulkPriceUpdateModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}: BulkPriceUpdateModalProps) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<ProjectPriceAnalysis | null>(null);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0, message: '' });
  const [updateComplete, setUpdateComplete] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ updated: number; errors: string[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'select' | 'confirm'>('preview');

  useEffect(() => {
    if (isOpen) {
      loadAnalysis();
    }
  }, [isOpen, projectId]);

  async function loadAnalysis() {
    setLoading(true);
    setUpdateComplete(false);
    setUpdateResult(null);
    try {
      const result = await analyzeProjectPriceChanges(projectId);
      setAnalysis(result);
      setSelectedAreaIds(result.affectedAreas.map(a => a.areaId));
    } catch (error) {
      console.error('Error analyzing price changes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate() {
    if (!analysis) return;

    setUpdating(true);
    setActiveTab('confirm');

    try {
      const result = await updateProjectPrices(
        projectId,
        selectedAreaIds.length === analysis.affectedAreas.length ? undefined : selectedAreaIds,
        (message, current, total) => {
          setUpdateProgress({ message, current, total });
        }
      );

      setUpdateResult(result);
      setUpdateComplete(true);

      if (result.success) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error updating prices:', error);
      setUpdateResult({ updated: 0, errors: [error.message] });
      setUpdateComplete(true);
    } finally {
      setUpdating(false);
    }
  }

  function toggleAreaSelection(areaId: string) {
    setSelectedAreaIds(prev =>
      prev.includes(areaId)
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  }

  function selectAllAreas() {
    setSelectedAreaIds(analysis?.affectedAreas.map(a => a.areaId) || []);
  }

  function deselectAllAreas() {
    setSelectedAreaIds([]);
  }

  const selectedAreas = analysis?.affectedAreas.filter(a => selectedAreaIds.includes(a.areaId)) || [];
  const selectedCabinetsCount = selectedAreas.reduce((sum, area) => sum + area.affectedCabinets.length, 0);
  const selectedTotalDifference = selectedAreas.reduce((sum, area) => sum + area.areaTotalDifference, 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Project Prices" size="xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-fg-600">Analyzing price changes...</p>
          </div>
        </div>
      ) : !analysis || !analysis.hasStalePrices ? (
        <div className="py-12 text-center">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-fg-900 mb-2">All Prices Up to Date</h3>
          <p className="text-fg-600">This project uses the latest prices from your price list.</p>
          <div className="mt-6">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-border-soft mb-6">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'preview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-fg-600 hover:text-fg-900'
                }`}
              >
                Preview Impact
              </button>
              <button
                onClick={() => setActiveTab('select')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'select'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-fg-600 hover:text-fg-900'
                }`}
              >
                Select Areas ({selectedAreaIds.length}/{analysis.affectedAreas.length})
              </button>
              {updateComplete && (
                <button
                  onClick={() => setActiveTab('confirm')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'confirm'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-fg-600 hover:text-fg-900'
                  }`}
                >
                  Results
                </button>
              )}
            </div>
          </div>

          {activeTab === 'preview' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-yellow-900 mb-1">Price Changes Detected</h4>
                  <p className="text-sm text-yellow-800">
                    {analysis.affectedCabinetsCount} cabinet{analysis.affectedCabinetsCount !== 1 ? 's' : ''} across {analysis.affectedAreas.length} area{analysis.affectedAreas.length !== 1 ? 's' : ''} {analysis.affectedAreas.length !== 1 ? 'are' : 'is'} affected by price changes.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surf-app rounded-lg p-4">
                  <div className="text-sm text-fg-600 mb-1">Affected Cabinets</div>
                  <div className="text-2xl font-bold text-fg-900">{analysis.affectedCabinetsCount}</div>
                </div>
                <div className="bg-surf-app rounded-lg p-4">
                  <div className="text-sm text-fg-600 mb-1">Materials Changed</div>
                  <div className="text-2xl font-bold text-fg-900">{analysis.affectedMaterialsCount}</div>
                </div>
                <div className="bg-surf-app rounded-lg p-4">
                  <div className="text-sm text-fg-600 mb-1">Total Difference</div>
                  <div className={`text-2xl font-bold flex items-center ${
                    analysis.totalPotentialDifference >= 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {analysis.totalPotentialDifference >= 0 ? (
                      <TrendingUp className="h-5 w-5 mr-1" />
                    ) : (
                      <TrendingDown className="h-5 w-5 mr-1" />
                    )}
                    {formatCurrency(Math.abs(analysis.totalPotentialDifference))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {analysis.affectedAreas.map((area) => (
                  <AreaPricePreview key={area.areaId} area={area} />
                ))}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-border-soft">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={() => setActiveTab('select')}>
                  Select Areas to Update
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'select' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-fg-900">Select Areas to Update</h3>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="ghost" onClick={selectAllAreas}>
                      Select All
                    </Button>
                    <Button size="sm" variant="ghost" onClick={deselectAllAreas}>
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {analysis.affectedAreas.map((area) => (
                    <label
                      key={area.areaId}
                      className="flex items-center p-4 border border-border-soft rounded-lg hover:bg-surf-app cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAreaIds.includes(area.areaId)}
                        onChange={() => toggleAreaSelection(area.areaId)}
                        className="h-4 w-4 text-blue-600 border-border-solid rounded focus-visible:ring-focus"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-fg-900">{area.areaName}</span>
                          <span className={`text-sm font-semibold ${
                            area.areaTotalDifference >= 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {area.areaTotalDifference >= 0 ? '+' : ''}{formatCurrency(area.areaTotalDifference)}
                          </span>
                        </div>
                        <div className="text-sm text-fg-600 mt-1">
                          {area.affectedCabinets.length} cabinet{area.affectedCabinets.length !== 1 ? 's' : ''} affected
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Selected Summary</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <div>Areas: {selectedAreaIds.length} of {analysis.affectedAreas.length}</div>
                  <div>Cabinets: {selectedCabinetsCount}</div>
                  <div className="flex items-center">
                    <span>Total Difference:</span>
                    <span className={`ml-2 font-semibold ${
                      selectedTotalDifference >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {selectedTotalDifference >= 0 ? '+' : ''}{formatCurrency(selectedTotalDifference)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-border-soft">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={selectedAreaIds.length === 0 || updating}
                >
                  {updating ? 'Updating...' : `Update ${selectedCabinetsCount} Cabinet${selectedCabinetsCount !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'confirm' && (
            <div className="space-y-6">
              {updating ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-fg-900 mb-2">Updating Prices...</h3>
                  <p className="text-fg-600">{updateProgress.message}</p>
                  {updateProgress.total > 0 && (
                    <div className="mt-4 max-w-md mx-auto">
                      <div className="bg-surf-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full transition-all duration-300"
                          style={{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-fg-600 mt-2">
                        {updateProgress.current} of {updateProgress.total}
                      </p>
                    </div>
                  )}
                </div>
              ) : updateComplete && updateResult ? (
                <div className="text-center py-12">
                  {updateResult.updated > 0 && updateResult.errors.length === 0 ? (
                    <>
                      <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-fg-900 mb-2">Prices Updated Successfully</h3>
                      <p className="text-fg-600">
                        Updated {updateResult.updated} cabinet{updateResult.updated !== 1 ? 's' : ''} with current prices.
                      </p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-fg-900 mb-2">Update Completed with Errors</h3>
                      <p className="text-fg-600 mb-4">
                        Successfully updated: {updateResult.updated} cabinets
                      </p>
                      {updateResult.errors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left max-w-md mx-auto">
                          <h4 className="font-semibold text-red-900 mb-2">Errors:</h4>
                          <ul className="text-sm text-red-800 space-y-1">
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
              ) : null}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function AreaPricePreview({ area }: { area: AffectedArea }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border-soft rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-surf-app transition-colors"
      >
        <div className="flex-1 text-left">
          <div className="font-medium text-fg-900">{area.areaName}</div>
          <div className="text-sm text-fg-600 mt-1">
            {area.affectedCabinets.length} cabinet{area.affectedCabinets.length !== 1 ? 's' : ''} affected
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className={`text-sm font-semibold ${
            area.areaTotalDifference >= 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {area.areaTotalDifference >= 0 ? '+' : ''}{formatCurrency(area.areaTotalDifference)}
          </span>
          <div className="text-fg-400">
            {expanded ? '−' : '+'}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border-soft">
          {area.affectedCabinets.map((cabinet) => (
            <div key={cabinet.cabinetId} className="bg-surf-app rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-fg-900">
                  {cabinet.productSku} (Qty: {cabinet.quantity})
                </span>
                <span className={`text-sm font-semibold ${
                  cabinet.totalDifference >= 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {cabinet.totalDifference >= 0 ? '+' : ''}{formatCurrency(cabinet.totalDifference)}
                </span>
              </div>
              <div className="space-y-1">
                {cabinet.materialChanges.map((change, idx) => (
                  <div key={idx} className="text-xs text-fg-600 flex items-center justify-between">
                    <span className="truncate mr-2">{change.materialName}</span>
                    <span className={change.difference >= 0 ? 'text-red-600' : 'text-green-600'}>
                      {change.difference >= 0 ? '+' : ''}{formatCurrency(change.difference)} ({change.percentageChange.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
