import { useState, useEffect } from 'react';
import { ArrowLeft, History, TrendingUp, TrendingDown, Package, GitBranch, Calendar, FileText } from 'lucide-react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { formatCurrency } from '../lib/calculations';
import { getVersionHistory, getVersionDetails, type ProjectVersion, type VersionDetail } from '../lib/versioningSystem';
import { format } from 'date-fns';

interface ProjectVersionHistoryProps {
  projectId: string;
  projectName: string;
  onBack: () => void;
}

export function ProjectVersionHistory({ projectId, projectName, onBack }: ProjectVersionHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ProjectVersion | null>(null);
  const [versionDetails, setVersionDetails] = useState<VersionDetail[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'price_update' | 'material_change'>('all');

  useEffect(() => {
    if (projectId) {
      loadVersionHistory();
    }
  }, [projectId]);

  async function loadVersionHistory() {
    if (!projectId) return;

    setLoading(true);
    try {
      const history = await getVersionHistory(projectId);
      setVersions(history);
    } catch (error) {
      console.error('Error loading version history:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewDetails(version: ProjectVersion) {
    try {
      const details = await getVersionDetails(version.id);
      setSelectedVersion(version);
      setVersionDetails(details);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error loading version details:', error);
    }
  }

  function getVersionTypeInfo(type: string) {
    switch (type) {
      case 'price_update':
        return {
          icon: TrendingUp,
          label: 'Price Recalculation',
          color: 'bg-accent-tint-soft text-accent-text border-accent-tint-border',
        };
      case 'material_change':
        return {
          icon: Package,
          label: 'Material Change',
          color: 'bg-accent-tint-soft text-accent-text border-accent-tint-border',
        };
      case 'manual_snapshot':
        return {
          icon: GitBranch,
          label: 'Manual Snapshot',
          color: 'bg-surf-muted text-fg-800 border-border-soft',
        };
      default:
        return {
          icon: History,
          label: 'Unknown',
          color: 'bg-surf-muted text-fg-800 border-border-soft',
        };
    }
  }

  const filteredVersions = filterType === 'all'
    ? versions
    : versions.filter(v => v.version_type === filterType);

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={onBack}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Project
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-fg-900 mb-2">Version History</h1>
              <p className="text-fg-600">{projectName}</p>
            </div>
            <div className="flex items-center space-x-2 bg-surf-muted rounded-lg p-1">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-surf-card text-fg-900 shadow-sm'
                    : 'text-fg-600 hover:text-fg-900'
                }`}
              >
                All ({versions.length})
              </button>
              <button
                onClick={() => setFilterType('price_update')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  filterType === 'price_update'
                    ? 'bg-surf-card text-fg-900 shadow-sm'
                    : 'text-fg-600 hover:text-fg-900'
                }`}
              >
                Price Updates ({versions.filter(v => v.version_type === 'price_update').length})
              </button>
              <button
                onClick={() => setFilterType('material_change')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  filterType === 'material_change'
                    ? 'bg-surf-card text-fg-900 shadow-sm'
                    : 'text-fg-600 hover:text-fg-900'
                }`}
              >
                Material Changes ({versions.filter(v => v.version_type === 'material_change').length})
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 page-enter">
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 w-full skeleton-shimmer" style={{ width: '400px' }} />)}
            </div>
          </div>
        ) : filteredVersions.length === 0 ? (
          <div className="bg-surf-card rounded-lg shadow-sm border border-border-soft p-12 text-center">
            <History className="h-12 w-12 text-fg-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-fg-900 mb-2">No Version History Yet</h3>
            <p className="text-fg-600">
              {filterType === 'all'
                ? 'Versions will appear here when you recalculate prices or change materials.'
                : `No ${filterType === 'price_update' ? 'price updates' : 'material changes'} found.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVersions.map((version, idx) => {
              const typeInfo = getVersionTypeInfo(version.version_type);
              const Icon = typeInfo.icon;
              const isFirst = idx === 0;

              return (
                <div
                  key={version.id}
                  className={`bg-surf-card rounded-lg shadow-sm border-2 transition-all hover:shadow-md ${
                    isFirst ? 'border-accent-tint-border' : 'border-border-soft'
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className={`p-3 rounded-lg border ${typeInfo.color}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="text-lg font-semibold text-fg-900">
                              {version.version_name}
                            </h3>
                            {isFirst && (
                              <span className="px-2 py-0.5 bg-accent-tint-soft text-accent-text text-xs font-medium rounded-full">
                                Latest
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-fg-600">
                            <span className="flex items-center">
                              <History className="h-3.5 w-3.5 mr-1" />
                              Version #{version.version_number}
                            </span>
                            <span className="flex items-center">
                              <Calendar className="h-3.5 w-3.5 mr-1" />
                              {format(new Date(version.created_at), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-fg-900">
                          {formatCurrency(version.total_amount)}
                        </div>
                        <div className="text-xs text-fg-500">Project Total</div>
                      </div>
                    </div>

                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${typeInfo.color} mb-3`}>
                      {typeInfo.label}
                    </div>

                    {version.affected_areas.length > 0 && (
                      <div className="mb-3">
                        <span className="text-sm text-fg-600">
                          Affected areas: <span className="font-medium">{version.affected_areas.length}</span>
                        </span>
                      </div>
                    )}

                    {version.notes && (
                      <div className="mb-4 p-3 bg-surf-app rounded-lg border border-border-soft">
                        <div className="flex items-start">
                          <FileText className="h-4 w-4 text-fg-400 mr-2 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-fg-700">{version.notes}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border-soft">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleViewDetails(version)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedVersion(null);
          setVersionDetails([]);
        }}
        title="Version Details"
        size="xl"
      >
        {selectedVersion && (
          <div className="space-y-6">
            <div className="bg-surf-app rounded-lg p-4 border border-border-soft">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-fg-600 mb-1">Version Name</div>
                  <div className="font-semibold text-fg-900">{selectedVersion.version_name}</div>
                </div>
                <div>
                  <div className="text-sm text-fg-600 mb-1">Version Number</div>
                  <div className="font-semibold text-fg-900">#{selectedVersion.version_number}</div>
                </div>
                <div>
                  <div className="text-sm text-fg-600 mb-1">Date</div>
                  <div className="font-semibold text-fg-900">
                    {format(new Date(selectedVersion.created_at), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-fg-600 mb-1">Project Total</div>
                  <div className="font-semibold text-fg-900">
                    {formatCurrency(selectedVersion.total_amount)}
                  </div>
                </div>
              </div>

              {selectedVersion.notes && (
                <div className="pt-4 border-t border-border-soft">
                  <div className="text-sm text-fg-600 mb-1">Notes</div>
                  <div className="text-fg-900">{selectedVersion.notes}</div>
                </div>
              )}
            </div>

            {versionDetails.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-fg-900 mb-4">Changes by Area</h3>
                <div className="space-y-3">
                  {versionDetails.map((detail) => {
                    const difference = detail.new_subtotal - detail.previous_subtotal;
                    const hasChange = Math.abs(difference) > 0.01;

                    return (
                      <div
                        key={detail.id}
                        className={`rounded-lg border p-4 ${
                          hasChange
                            ? difference > 0
                              ? 'bg-status-red-bg border-status-red-brd'
                              : 'bg-status-emerald-bg border-status-emerald-brd'
                            : 'bg-surf-app border-border-soft'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-semibold text-fg-900">{detail.area_name}</div>
                            <div className="text-sm text-fg-600">
                              {detail.cabinets_affected_count} cabinet{detail.cabinets_affected_count !== 1 ? 's' : ''} affected
                            </div>
                          </div>
                          <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            detail.change_type === 'both'
                              ? 'bg-accent-tint-soft text-accent-text'
                              : detail.change_type === 'material_change'
                              ? 'bg-accent-tint-soft text-accent-text'
                              : 'bg-status-emerald-bg text-status-emerald-fg'
                          }`}>
                            {detail.change_type === 'both' ? 'Material + Price' :
                             detail.change_type === 'material_change' ? 'Material Change' : 'Price Update'}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-fg-600 mb-1">Previous</div>
                            <div className="font-semibold text-fg-900">
                              {formatCurrency(detail.previous_subtotal)}
                            </div>
                          </div>
                          <div>
                            <div className="text-fg-600 mb-1">New</div>
                            <div className="font-semibold text-fg-900">
                              {formatCurrency(detail.new_subtotal)}
                            </div>
                          </div>
                          <div>
                            <div className="text-fg-600 mb-1">Change</div>
                            <div className="flex items-center space-x-2">
                              {hasChange && (
                                difference > 0 ? (
                                  <TrendingUp className="h-4 w-4 text-status-red-fg" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-status-emerald-fg" />
                                )
                              )}
                              <span className={`font-semibold ${
                                difference > 0 ? 'text-status-red-fg' : difference < 0 ? 'text-status-emerald-fg' : 'text-fg-600'
                              }`}>
                                {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                              </span>
                            </div>
                            {hasChange && (
                              <div className="text-xs text-fg-500 mt-0.5">
                                ({detail.difference_percentage > 0 ? '+' : ''}{detail.difference_percentage.toFixed(1)}%)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 pt-6 border-t border-border-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-fg-900">Total Project Change</span>
                    <span className="text-2xl font-bold text-fg-900">
                      {formatCurrency(selectedVersion.total_amount)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-border-soft">
              <Button onClick={() => setShowDetailsModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
