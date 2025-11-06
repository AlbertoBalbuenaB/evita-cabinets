import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, CheckCircle, TrendingUp, TrendingDown, X } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { formatCurrency } from '../lib/calculations';
import {
  analyzeMaterialPriceChanges,
  updateSelectedMaterials,
  type MaterialUpdateAnalysis,
  type MaterialImpact,
} from '../lib/materialPriceUpdateSystem';

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
  const [analysis, setAnalysis] = useState<MaterialUpdateAnalysis | null>(null);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
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
    setSelectedMaterialIds([]);
    setActiveTab('preview');
    try {
      const result = await analyzeMaterialPriceChanges(projectId);
      setAnalysis(result);
    } catch (error) {
      console.error('Error analyzing material changes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate() {
    if (!analysis || selectedMaterialIds.length === 0) return;

    setUpdating(true);
    setActiveTab('confirm');

    try {
      const result = await updateSelectedMaterials(
        projectId,
        selectedMaterialIds,
        (message, current, total) => {
          setUpdateProgress({ message, current, total });
        }
      );

      setUpdateResult(result);
      setUpdateComplete(true);

      if (result.updated > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error updating materials:', error);
      setUpdateResult({ updated: 0, errors: [error.message] });
      setUpdateComplete(true);
    } finally {
      setUpdating(false);
    }
  }

  function toggleMaterialSelection(materialId: string) {
    setSelectedMaterialIds(prev =>
      prev.includes(materialId)
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  }

  function selectAllMaterials() {
    setSelectedMaterialIds(analysis?.materials.map(m => m.materialId) || []);
  }

  function deselectAllMaterials() {
    setSelectedMaterialIds([]);
  }

  const selectedMaterials = analysis?.materials.filter(m => selectedMaterialIds.includes(m.materialId)) || [];
  const selectedTotalDifference = selectedMaterials.reduce((sum, m) => sum + m.totalDifference, 0);
  const selectedCabinetsCount = selectedMaterials.reduce((sum, m) => sum + m.affectedCabinetsCount, 0);

  const getMaterialTypeLabel = (type: MaterialImpact['materialType']) => {
    const labels = {
      box_material: 'Box Material',
      box_edgeband: 'Box Edgeband',
      box_interior_finish: 'Box Interior Finish',
      doors_material: 'Doors Material',
      doors_edgeband: 'Doors Edgeband',
      doors_interior_finish: 'Doors Interior Finish',
      hardware: 'Hardware',
    };
    return labels[type];
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Material Prices" size="xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Analyzing material price differences...</p>
          </div>
        </div>
      ) : !analysis || analysis.materials.length === 0 ? (
        <div className="py-12 text-center">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">All Materials Up to Date</h3>
          <p className="text-slate-600">No material price differences detected in this project.</p>
          <div className="mt-6">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-slate-200 mb-6">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'preview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Preview Changes
              </button>
              <button
                onClick={() => setActiveTab('select')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'select'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Select Materials ({selectedMaterialIds.length}/{analysis.materials.length})
              </button>
              {updateComplete && (
                <button
                  onClick={() => setActiveTab('confirm')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'confirm'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Results
                </button>
              )}
            </div>
          </div>

          {activeTab === 'preview' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 mb-1">Material Price Differences Detected</h4>
                  <p className="text-sm text-blue-800">
                    {analysis.materials.length} material{analysis.materials.length !== 1 ? 's have' : ' has'} different prices than stored in {analysis.affectedCabinetsCount} cabinet{analysis.affectedCabinetsCount !== 1 ? 's' : ''}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600 mb-1">Materials with Differences</div>
                  <div className="text-2xl font-bold text-slate-900">{analysis.materials.length}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-600 mb-1">Total Difference</div>
                  <div className={`text-2xl font-bold flex items-center ${
                    analysis.totalDifference >= 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {analysis.totalDifference >= 0 ? (
                      <TrendingUp className="h-5 w-5 mr-1" />
                    ) : (
                      <TrendingDown className="h-5 w-5 mr-1" />
                    )}
                    {formatCurrency(Math.abs(analysis.totalDifference))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {analysis.materials.map((material) => (
                  <MaterialPreviewCard key={material.materialId} material={material} getMaterialTypeLabel={getMaterialTypeLabel} />
                ))}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={() => setActiveTab('select')}>
                  Select Materials to Update
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'select' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Choose Materials to Update</h3>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="ghost" onClick={selectAllMaterials}>
                      Select All
                    </Button>
                    <Button size="sm" variant="ghost" onClick={deselectAllMaterials}>
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {analysis.materials.map((material) => {
                    const priceChangeDate = new Date(material.priceChangeDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <label
                        key={material.materialId}
                        className="flex items-start p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMaterialIds.includes(material.materialId)}
                          onChange={() => toggleMaterialSelection(material.materialId)}
                          className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-1"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-slate-900">{material.materialName}</div>
                              <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                                <div>{getMaterialTypeLabel(material.materialType)} • {material.affectedCabinetsCount} cabinet{material.affectedCabinetsCount !== 1 ? 's' : ''} • Areas: {material.affectedAreas.join(', ')}</div>
                                <div>
                                  <span className="font-medium">Price:</span> {formatCurrency(material.oldPrice)} → {formatCurrency(material.currentPrice)}
                                  <span className={material.priceChangePercentage >= 0 ? 'text-red-600' : 'text-green-600'}>
                                    {' '}({material.priceChangePercentage >= 0 ? '+' : ''}{material.priceChangePercentage.toFixed(1)}%)
                                  </span>
                                  {' • '}{priceChangeDate}
                                </div>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <span className={`text-sm font-semibold ${
                                material.totalDifference >= 0 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {material.totalDifference >= 0 ? '+' : ''}{formatCurrency(material.totalDifference)}
                              </span>
                              <div className="text-xs text-slate-500">
                                ({material.percentageChange >= 0 ? '+' : ''}{material.percentageChange.toFixed(1)}%)
                              </div>
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Selection Summary</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <div>Materials selected: {selectedMaterialIds.length} of {analysis.materials.length}</div>
                  <div>Cabinets to update: {selectedCabinetsCount}</div>
                  <div className="flex items-center">
                    <span>Total difference:</span>
                    <span className={`ml-2 font-semibold ${
                      selectedTotalDifference >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {selectedTotalDifference >= 0 ? '+' : ''}{formatCurrency(selectedTotalDifference)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={selectedMaterialIds.length === 0 || updating}
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
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Updating Material Prices...</h3>
                  <p className="text-slate-600">{updateProgress.message}</p>
                  {updateProgress.total > 0 && (
                    <div className="mt-4 max-w-md mx-auto">
                      <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full transition-all duration-300"
                          style={{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-slate-600 mt-2">
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
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">Prices Updated Successfully</h3>
                      <p className="text-slate-600">
                        Updated {updateResult.updated} cabinet{updateResult.updated !== 1 ? 's' : ''} with new material prices.
                      </p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">Update Completed with Errors</h3>
                      <p className="text-slate-600 mb-4">
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

function MaterialPreviewCard({ material, getMaterialTypeLabel }: { material: MaterialImpact; getMaterialTypeLabel: (type: MaterialImpact['materialType']) => string }) {
  const priceChangeDate = new Date(material.priceChangeDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-medium text-slate-900">{material.materialName}</div>
          <div className="text-sm text-slate-600 mt-1">
            {getMaterialTypeLabel(material.materialType)}
          </div>
          <div className="text-xs text-slate-500 mt-2 space-y-1">
            <div>
              <span className="font-medium">Price changed:</span> {priceChangeDate}
            </div>
            <div>
              <span className="font-medium">Unit price:</span> {formatCurrency(material.oldPrice)} → {formatCurrency(material.currentPrice)}
              <span className={material.priceChangePercentage >= 0 ? 'text-red-600' : 'text-green-600'}>
                {' '}({material.priceChangePercentage >= 0 ? '+' : ''}{material.priceChangePercentage.toFixed(1)}%)
              </span>
            </div>
            <div>
              <span className="font-medium">Impact:</span> {material.affectedCabinetsCount} cabinet{material.affectedCabinetsCount !== 1 ? 's' : ''} in {material.affectedAreas.length} area{material.affectedAreas.length !== 1 ? 's' : ''}: {material.affectedAreas.join(', ')}
            </div>
          </div>
        </div>
        <div className="text-right ml-4">
          <div className={`text-lg font-bold ${
            material.totalDifference >= 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {material.totalDifference >= 0 ? '+' : ''}{formatCurrency(material.totalDifference)}
          </div>
          <div className="text-xs text-slate-600 mt-1">
            ({material.percentageChange >= 0 ? '+' : ''}{material.percentageChange.toFixed(1)}%)
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {formatCurrency(material.totalOldCost)} → {formatCurrency(material.totalNewCost)}
          </div>
        </div>
      </div>
    </div>
  );
}
