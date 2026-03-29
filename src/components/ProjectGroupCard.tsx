import { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, MapPin, Pencil as Edit2, Trash2, Eye, Copy, MoreVertical, AlertTriangle, CheckCircle2, XCircle, Ban, AlertCircle, Clock, FileText, Send, User, Layers, Unlink, Star } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from './Button';
import { formatCurrency } from '../lib/calculations';
import { getProjectVersionNumber } from '../lib/projectGrouping';
import type { Quotation, QuotationStatus } from '../types';
import type { ProjectGroup } from '../lib/projectGrouping';

interface ProjectGroupCardProps {
  group: ProjectGroup;
  allProjects: Quotation[];
  onView: (project: Quotation) => void;
  onEdit: (project: Quotation) => void;
  onDelete: (project: Quotation) => void;
  onDuplicate: (project: Quotation) => void;
  onStatusChange: (project: Quotation, status: QuotationStatus) => void;
  onUngroup: (projectId: string) => void;
  staleProjectIds: string[];
  exchangeRate?: number;
  selectionMode?: boolean;
  selectedProjectIds?: string[];
  onSelect?: (projectId: string, checked: boolean) => void;
  onSelectAll?: (projectIds: string[], checked: boolean) => void;
}

export function ProjectGroupCard({
  group,
  allProjects,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onStatusChange,
  onUngroup,
  staleProjectIds,
  exchangeRate = 1,
  selectionMode,
  selectedProjectIds = [],
  onSelect,
  onSelectAll,
}: ProjectGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPrimaryActions, setShowPrimaryActions] = useState(false);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Pending':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: <Clock className="h-3.5 w-3.5" />,
        };
      case 'Estimating':
        return {
          color: 'bg-orange-100 text-orange-800 border-orange-300',
          icon: <FileText className="h-3.5 w-3.5" />,
        };
      case 'Sent':
        return {
          color: 'bg-cyan-100 text-cyan-800 border-cyan-300',
          icon: <Send className="h-3.5 w-3.5" />,
        };
      case 'Awarded':
        return {
          color: 'bg-green-100 text-green-800 border-green-300',
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        };
      case 'Lost':
        return {
          color: 'bg-red-100 text-red-800 border-red-300',
          icon: <XCircle className="h-3.5 w-3.5" />,
        };
      case 'Disqualified':
        return {
          color: 'bg-slate-100 text-slate-700 border-slate-300',
          icon: <Ban className="h-3.5 w-3.5" />,
        };
      case 'Cancelled':
        return {
          color: 'bg-gray-100 text-gray-700 border-gray-300',
          icon: <AlertCircle className="h-3.5 w-3.5" />,
        };
      default:
        return {
          color: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: <Clock className="h-3.5 w-3.5" />,
        };
    }
  };

  const primaryProject = group.primaryProject;
  const statusConfig = getStatusConfig(primaryProject.status);

  const groupProjectIds = group.projects.map(p => p.id);
  const allGroupSelected = selectionMode && groupProjectIds.every(id => selectedProjectIds.includes(id));
  const someGroupSelected = selectionMode && groupProjectIds.some(id => selectedProjectIds.includes(id)) && !allGroupSelected;

  const sortedVersions = [...group.projects].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="group glass-white hover:shadow-lg hover:border-blue-400/60 transition-all duration-200 overflow-hidden relative">
      <div className="h-1.5 bg-blue-500" />

      {selectionMode && (
        <div className="absolute top-4 left-4 z-10">
          <input
            type="checkbox"
            checked={allGroupSelected || false}
            ref={(el) => {
              if (el) el.indeterminate = someGroupSelected || false;
            }}
            onChange={(e) => {
              e.stopPropagation();
              onSelectAll?.(groupProjectIds, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
            title={allGroupSelected ? 'Deselect all versions' : 'Select all versions'}
          />
        </div>
      )}

      <div className="absolute top-4 right-4 z-10">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPrimaryActions(!showPrimaryActions);
            }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="More actions"
          >
            <MoreVertical className="h-4 w-4 text-slate-500" />
          </button>

          {showPrimaryActions && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowPrimaryActions(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(primaryProject);
                    setShowPrimaryActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View Latest
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                    setShowPrimaryActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Layers className="h-4 w-4" />
                  {isExpanded ? 'Collapse Versions' : 'Show All Versions'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="p-5 cursor-pointer" onClick={() => onView(primaryProject)}>
        <div className="flex justify-between items-start mb-3 pr-8">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                {primaryProject.name}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {group.versionCount > 1 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  <Layers className="h-3 w-3" />
                  {group.versionCount}v
                </span>
              )}
              {staleProjectIds.includes(primaryProject.id) && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200" title="Price updates available">
                  <AlertTriangle className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mb-3">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${statusConfig.color}`}>
            {statusConfig.icon}
            {primaryProject.status}
          </span>
        </div>

        <div className="space-y-1.5 mb-4">
          {primaryProject.customer && (
            <div className="flex items-center text-sm text-slate-600">
              <User className="h-3.5 w-3.5 mr-2 flex-shrink-0 text-slate-400" />
              <span className="font-medium">{primaryProject.customer}</span>
            </div>
          )}

          {primaryProject.address && (
            <div className="flex items-start text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5 mr-2 mt-0.5 flex-shrink-0 text-slate-400" />
              <span className="line-clamp-2 leading-snug">{primaryProject.address}</span>
            </div>
          )}

          <div className="flex items-center text-sm text-slate-500">
            <Calendar className="h-3.5 w-3.5 mr-2 flex-shrink-0 text-slate-400" />
            <span>{format(new Date(primaryProject.quote_date + 'T00:00:00'), 'MMM dd, yyyy')}</span>
          </div>
        </div>

        {primaryProject.project_details && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{primaryProject.project_details}</p>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100">
          <div className="text-2xl font-bold text-slate-900 mb-3">
            {formatCurrency(primaryProject.total_amount / exchangeRate, 'USD')}
          </div>

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onView(primaryProject);
              }}
              className="flex-1"
            >
              View Details
            </Button>
            {group.versionCount > 1 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="flex items-center gap-1.5 px-3"
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{group.versionCount}</span>
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>
      </div>

      {isExpanded && group.versionCount > 1 && (
        <div className="border-t border-slate-200/60" style={{ background: 'rgba(248,250,252,0.7)' }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700">All Versions ({group.versionCount})</h4>
              <span className="text-xs text-slate-400">Newest first</span>
            </div>
            <div className="space-y-2">
              {sortedVersions.map((project, index) => {
                const versionNum = getProjectVersionNumber(project, allProjects);
                const isLatest = index === 0;
                const isStale = staleProjectIds.includes(project.id);
                const projectStatusConfig = getStatusConfig(project.status);

                return (
                  <div
                    key={project.id}
                    className={`bg-white rounded-lg border transition-all duration-150 cursor-pointer overflow-hidden ${
                      isLatest
                        ? 'border-blue-200 shadow-sm'
                        : 'border-slate-200 hover:border-blue-200 hover:shadow-sm'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!selectionMode) onView(project);
                    }}
                  >
                    {isLatest && (
                      <div className="h-0.5 bg-blue-500" />
                    )}
                    <div className="p-3">
                      <div className="flex items-start gap-2">
                        {selectionMode && (
                          <input
                            type="checkbox"
                            checked={selectedProjectIds.includes(project.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              onSelect?.(project.id, e.target.checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 mt-0.5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${
                              isLatest
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                              v{versionNum}
                            </span>
                            {isLatest && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                <Star className="h-2.5 w-2.5" />
                                Latest
                              </span>
                            )}
                            {isStale && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200" title="Price updates available">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Prices outdated
                              </span>
                            )}
                          </div>

                          <p className="text-sm font-medium text-slate-900 mb-2 leading-snug">
                            {project.name}
                          </p>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${projectStatusConfig.color}`}>
                              {projectStatusConfig.icon}
                              {project.status}
                            </span>
                            <span className="text-xs text-slate-400">
                              {format(new Date(project.created_at), 'MMM dd, yyyy')}
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {formatCurrency(project.total_amount / exchangeRate, 'USD')}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onView(project);
                            }}
                            className="p-1.5 rounded-md hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
                            title="View"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(project);
                            }}
                            className="p-1.5 rounded-md hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicate(project);
                            }}
                            className="p-1.5 rounded-md hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
                            title="Duplicate"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(project);
                            }}
                            className="p-1.5 rounded-md hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          {group.versionCount > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUngroup(project.id);
                              }}
                              className="p-1.5 rounded-md hover:bg-orange-50 text-slate-500 hover:text-orange-600 transition-colors"
                              title="Remove from group"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
