import { useState, useEffect } from 'react';
import { X, ArrowRight, TrendingUp, TrendingDown, Printer } from 'lucide-react';
import { Button } from './Button';
import { compareVersions, type VersionComparison as ComparisonData } from '../lib/versioningSystem';
import { formatCurrency } from '../lib/calculations';
import { format } from 'date-fns';

interface VersionComparisonProps {
  versionId1: string;
  versionId2: string;
  onClose: () => void;
}

export function VersionComparison({ versionId1, versionId2, onClose }: VersionComparisonProps) {
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComparison();
  }, [versionId1, versionId2]);

  async function loadComparison() {
    try {
      const data = await compareVersions(versionId1, versionId2);
      setComparison(data);
    } catch (error) {
      console.error('Error loading comparison:', error);
      alert('Failed to load comparison');
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-slate-600">Loading comparison...</div>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return null;
  }

  const { version1, version2, data1, data2, differences } = comparison;

  const totalDiffPositive = differences.totalDiff >= 0;
  const totalDiffPercent = version1.total_amount > 0
    ? (Math.abs(differences.totalDiff) / version1.total_amount) * 100
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 print:hidden">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Version Comparison</h2>
            <p className="text-sm text-slate-600 mt-1">
              Comparing {version1.version_number} with {version2.version_number}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-blue-600" />
                <span className="font-semibold text-slate-900">{version1.version_number}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{version1.version_name}</h3>
              <p className="text-sm text-slate-600 mt-1">
                Created: {format(new Date(version1.created_at), 'MMM dd, yyyy')}
              </p>
              {version1.notes && (
                <p className="text-sm text-slate-700 mt-2 italic">{version1.notes}</p>
              )}
              <div className="mt-4 pt-4 border-t border-blue-300">
                <div className="text-sm text-slate-600">Total Amount</div>
                <div className="text-2xl font-bold text-slate-900">
                  {formatCurrency(version1.total_amount || 0)}
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-600" />
                <span className="font-semibold text-slate-900">{version2.version_number}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{version2.version_name}</h3>
              <p className="text-sm text-slate-600 mt-1">
                Created: {format(new Date(version2.created_at), 'MMM dd, yyyy')}
              </p>
              {version2.notes && (
                <p className="text-sm text-slate-700 mt-2 italic">{version2.notes}</p>
              )}
              <div className="mt-4 pt-4 border-t border-green-300">
                <div className="text-sm text-slate-600">Total Amount</div>
                <div className="text-2xl font-bold text-slate-900">
                  {formatCurrency(version2.total_amount || 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-2 border-slate-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Summary of Changes</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-4 rounded-lg ${totalDiffPositive ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {totalDiffPositive ? (
                    <TrendingUp className="h-5 w-5 text-red-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-green-600" />
                  )}
                  <span className="text-sm font-medium text-slate-700">Cost Difference</span>
                </div>
                <div className={`text-2xl font-bold ${totalDiffPositive ? 'text-red-900' : 'text-green-900'}`}>
                  {totalDiffPositive ? '+' : ''}{formatCurrency(differences.totalDiff)}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {totalDiffPercent.toFixed(1)}% change
                </div>
              </div>

              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <div className="text-sm font-medium text-slate-700 mb-2">Areas</div>
                <div className="space-y-1 text-sm">
                  {differences.areasDiff.added.length > 0 && (
                    <div className="text-green-700">+{differences.areasDiff.added.length} added</div>
                  )}
                  {differences.areasDiff.removed.length > 0 && (
                    <div className="text-red-700">-{differences.areasDiff.removed.length} removed</div>
                  )}
                  {differences.areasDiff.modified.length > 0 && (
                    <div className="text-blue-700">{differences.areasDiff.modified.length} modified</div>
                  )}
                  {differences.areasDiff.added.length === 0 &&
                    differences.areasDiff.removed.length === 0 &&
                    differences.areasDiff.modified.length === 0 && (
                    <div className="text-slate-500">No changes</div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <div className="text-sm font-medium text-slate-700 mb-2">Cabinets</div>
                <div className="space-y-1 text-sm">
                  {differences.cabinetsDiff.added > 0 && (
                    <div className="text-green-700">+{differences.cabinetsDiff.added} added</div>
                  )}
                  {differences.cabinetsDiff.removed > 0 && (
                    <div className="text-red-700">-{differences.cabinetsDiff.removed} removed</div>
                  )}
                  {differences.cabinetsDiff.modified > 0 && (
                    <div className="text-blue-700">{differences.cabinetsDiff.modified} areas modified</div>
                  )}
                  {differences.cabinetsDiff.added === 0 &&
                    differences.cabinetsDiff.removed === 0 &&
                    differences.cabinetsDiff.modified === 0 && (
                    <div className="text-slate-500">No changes</div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <div className="text-sm font-medium text-slate-700 mb-2">Items</div>
                <div className="space-y-1 text-sm">
                  {differences.itemsDiff.added > 0 && (
                    <div className="text-green-700">+{differences.itemsDiff.added} added</div>
                  )}
                  {differences.itemsDiff.removed > 0 && (
                    <div className="text-red-700">-{differences.itemsDiff.removed} removed</div>
                  )}
                  {differences.itemsDiff.added === 0 &&
                    differences.itemsDiff.removed === 0 && (
                    <div className="text-slate-500">No changes</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {(differences.areasDiff.added.length > 0 ||
            differences.areasDiff.removed.length > 0 ||
            differences.areasDiff.modified.length > 0) && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Detailed Area Changes</h3>

              {differences.areasDiff.added.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-green-700 mb-2">Added Areas:</h4>
                  <div className="flex flex-wrap gap-2">
                    {differences.areasDiff.added.map((name, i) => (
                      <span key={i} className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                        + {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {differences.areasDiff.removed.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-red-700 mb-2">Removed Areas:</h4>
                  <div className="flex flex-wrap gap-2">
                    {differences.areasDiff.removed.map((name, i) => (
                      <span key={i} className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full">
                        - {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {differences.areasDiff.modified.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-blue-700 mb-2">Modified Areas:</h4>
                  <div className="space-y-2">
                    {differences.areasDiff.modified.map((name, i) => {
                      const area1 = data1.find(a => a.name === name);
                      const area2 = data2.find(a => a.name === name);
                      const diff = (area2?.subtotal || 0) - (area1?.subtotal || 0);

                      return (
                        <div key={i} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <span className="font-medium text-slate-900">{name}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-600">
                              {formatCurrency(area1?.subtotal || 0)}
                            </span>
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-900 font-semibold">
                              {formatCurrency(area2?.subtotal || 0)}
                            </span>
                            <span className={`text-sm font-semibold ${diff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ({diff >= 0 ? '+' : ''}{formatCurrency(diff)})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-center text-sm text-slate-500 mt-6 print:hidden">
            Click "Export PDF" to save this comparison for your records
          </div>
        </div>
      </div>
    </div>
  );
}
