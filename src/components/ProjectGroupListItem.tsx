import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  Edit2,
  Trash2,
  Eye,
  Copy,
  MoreVertical,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  Layers,
  Unlink,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from './Button';
import { formatCurrency } from '../lib/calculations';
import { getProjectVersionNumber } from '../lib/projectGrouping';
import type { Project, ProjectStatus } from '../types';
import type { ProjectGroup } from '../lib/projectGrouping';

interface ProjectGroupListItemProps {
  group: ProjectGroup;
  allProjects: Project[];
  onView: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onDuplicate: (project: Project) => void;
  onStatusChange: (project: Project, status: ProjectStatus) => void;
  onUngroup: (projectId: string) => void;
  staleProjectIds: string[];
  selectionMode?: boolean;
  selectedProjectIds?: string[];
  onSelect?: (projectId: string, checked: boolean) => void;
  onSelectAll?: (projectIds: string[], checked: boolean) => void;
}

export function ProjectGroupListItem({
  group,
  allProjects,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onStatusChange,
  onUngroup,
  staleProjectIds,
  selectionMode,
  selectedProjectIds = [],
  onSelect,
  onSelectAll,
}: ProjectGroupListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPrimaryActions, setShowPrimaryActions] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-slate-100 text-slate-700';
      case 'Estimating':
        return 'bg-blue-100 text-blue-700';
      case 'Sent':
        return 'bg-purple-100 text-purple-700';
      case 'Awarded':
        return 'bg-green-100 text-green-700';
      case 'Lost':
        return 'bg-red-100 text-red-700';
      case 'Disqualified':
        return 'bg-orange-100 text-orange-700';
      case 'Cancelled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const primaryProject = group.primaryProject;

  const groupProjectIds = group.projects.map(p => p.id);
  const allGroupSelected = selectionMode && groupProjectIds.every(id => selectedProjectIds.includes(id));
  const someGroupSelected = selectionMode && groupProjectIds.some(id => selectedProjectIds.includes(id)) && !allGroupSelected;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all">
      <div
        className="p-4 flex items-center gap-4 cursor-pointer"
        onClick={() => !selectionMode && onView(primaryProject)}
      >
        {selectionMode && (
          <input
            type="checkbox"
            checked={allGroupSelected}
            ref={(el) => {
              if (el) el.indeterminate = someGroupSelected;
            }}
            onChange={(e) => {
              e.stopPropagation();
              onSelectAll?.(groupProjectIds, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
            title={allGroupSelected ? 'Deselect all versions' : 'Select all versions'}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-base font-semibold text-slate-900 truncate hover:text-blue-600 transition-colors">
              {primaryProject.name}
            </h3>
            {group.versionCount > 1 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-300">
                <Layers className="h-3 w-3" />
                {group.versionCount}
              </span>
            )}
            {staleProjectIds.includes(primaryProject.id) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300" title="Price updates available">
                <AlertTriangle className="h-3 w-3" />
              </span>
            )}
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                primaryProject.status
              )}`}
            >
              {primaryProject.status}
            </span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {primaryProject.project_type}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-600">
            {primaryProject.customer && (
              <div className="flex items-center">
                <User className="h-3.5 w-3.5 mr-1 text-slate-400" />
                <span className="font-medium truncate max-w-xs">{primaryProject.customer}</span>
              </div>
            )}
            {primaryProject.address && (
              <div className="flex items-center">
                <MapPin className="h-3.5 w-3.5 mr-1 text-slate-400" />
                <span className="truncate max-w-xs">{primaryProject.address}</span>
              </div>
            )}
            <div className="flex items-center">
              <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" />
              <span>{format(new Date(primaryProject.quote_date + 'T00:00:00'), 'MMM dd, yyyy')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right mr-2">
            <div className="text-xs text-slate-500 mb-1">Total Value</div>
            <div className="text-xl font-bold text-slate-900">
              {formatCurrency(primaryProject.total_amount)}
            </div>
          </div>

          {group.versionCount > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="hover:bg-slate-100"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPrimaryActions(!showPrimaryActions);
              }}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="More actions"
            >
              <MoreVertical className="h-4 w-4 text-slate-600" />
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
                    View Details
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(primaryProject);
                      setShowPrimaryActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit Project
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(primaryProject);
                      setShowPrimaryActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </button>
                  <div className="border-t border-slate-200 my-1" />
                  <div className="px-4 py-2 text-xs font-medium text-slate-500">Quick Status</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(primaryProject, 'Awarded');
                      setShowPrimaryActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark as Awarded
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(primaryProject, 'Lost');
                      setShowPrimaryActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-red-700"
                  >
                    <XCircle className="h-4 w-4" />
                    Mark as Lost
                  </button>
                  <div className="border-t border-slate-200 my-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(primaryProject);
                      setShowPrimaryActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isExpanded && group.versionCount > 1 && (
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">All Versions ({group.versionCount})</h4>
          <div className="space-y-2">
            {group.projects.map((project) => {
              const versionNum = getProjectVersionNumber(project, allProjects);
              const isStale = staleProjectIds.includes(project.id);

              return (
                <div
                  key={project.id}
                  className="bg-white rounded-lg p-3 border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!selectionMode) onView(project);
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    {selectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          onSelect?.(project.id, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500">v{versionNum}</span>
                        <h5 className="text-sm font-medium text-slate-900 truncate flex-1">
                          {project.name}
                        </h5>
                        {isStale && (
                          <AlertTriangle className="h-3 w-3 text-yellow-600 flex-shrink-0" title="Price updates available" />
                        )}
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
                          {project.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <span>{format(new Date(project.created_at), 'MMM dd, yyyy')}</span>
                        <span className="font-semibold">{formatCurrency(project.total_amount)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(project);
                        }}
                        className="hover:bg-blue-50 p-1"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate(project);
                        }}
                        className="hover:bg-blue-50 p-1"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(project);
                        }}
                        className="hover:bg-red-50 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                      {group.versionCount > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUngroup(project.id);
                          }}
                          className="hover:bg-orange-50 p-1"
                          title="Remove from group"
                        >
                          <Unlink className="h-3.5 w-3.5 text-orange-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
