import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  Edit2,
  Trash2,
  Tag,
  Eye,
  Copy,
  MoreVertical,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ban,
  AlertCircle,
  Clock,
  FileText,
  Send,
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

interface ProjectGroupCardProps {
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
          color: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: <Clock className="h-3.5 w-3.5" />,
        };
      case 'Estimating':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: <FileText className="h-3.5 w-3.5" />,
        };
      case 'Sent':
        return {
          color: 'bg-purple-100 text-purple-800 border-purple-300',
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
          color: 'bg-orange-100 text-orange-800 border-orange-300',
          icon: <Ban className="h-3.5 w-3.5" />,
        };
      case 'Cancelled':
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-300',
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

  return (
    <div className="group bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all duration-200 overflow-hidden relative">
      <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500" />

      {selectionMode && (
        <div className="absolute top-4 left-4 z-10">
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

      <div className="p-6 cursor-pointer" onClick={() => onView(primaryProject)}>
        <div className="flex justify-between items-start mb-3 pr-8">
          <div className="flex items-start gap-2 flex-1">
            <h3 className="text-lg font-semibold text-slate-900 line-clamp-2 flex-1 group-hover:text-blue-600 transition-colors">
              {primaryProject.name}
            </h3>
            {group.versionCount > 1 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-300">
                <Layers className="h-3 w-3" />
                {group.versionCount}
              </span>
            )}
            {staleProjectIds.includes(primaryProject.id) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300" title="Price updates available">
                <AlertTriangle className="h-3 w-3" />
              </span>
            )}
          </div>
          <span
            className={`ml-3 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${statusConfig.color}`}
          >
            {statusConfig.icon}
            {primaryProject.status}
          </span>
        </div>

        {primaryProject.customer && (
          <div className="flex items-center text-sm text-slate-600 mb-2">
            <User className="h-4 w-4 mr-1.5 flex-shrink-0 text-slate-400" />
            <span className="font-medium line-clamp-1">{primaryProject.customer}</span>
          </div>
        )}

        {primaryProject.address && (
          <div className="flex items-center text-sm text-slate-600 mb-2">
            <MapPin className="h-4 w-4 mr-1.5 flex-shrink-0 text-slate-400" />
            <span className="line-clamp-1">{primaryProject.address}</span>
          </div>
        )}

        <div className="flex items-center text-sm text-slate-600 mb-4">
          <Calendar className="h-4 w-4 mr-1.5 flex-shrink-0 text-slate-400" />
          <span>{format(new Date(primaryProject.quote_date + 'T00:00:00'), 'MMM dd, yyyy')}</span>
        </div>

        {primaryProject.project_details && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 line-clamp-2">{primaryProject.project_details}</p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200">
          <div className="text-2xl font-bold text-slate-900 mb-4">
            {formatCurrency(primaryProject.total_amount)}
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
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </div>

      {isExpanded && group.versionCount > 1 && (
        <div className="border-t border-slate-200 bg-slate-50">
          <div className="p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">All Versions ({group.versionCount})</h4>
            <div className="space-y-2">
              {group.projects.map((project, index) => {
                const versionNum = getProjectVersionNumber(project, allProjects);
                const isStale = staleProjectIds.includes(project.id);
                const projectStatusConfig = getStatusConfig(project.status);

                return (
                  <div
                    key={project.id}
                    className="bg-white rounded-lg p-3 border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!selectionMode) onView(project);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
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
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-slate-500">v{versionNum}</span>
                          <h5 className="text-sm font-medium text-slate-900 truncate flex-1">
                            {project.name}
                          </h5>
                          {isStale && (
                            <AlertTriangle className="h-3 w-3 text-yellow-600 flex-shrink-0" title="Price updates available" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${projectStatusConfig.color}`}>
                            {projectStatusConfig.icon}
                            {project.status}
                          </span>
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
        </div>
      )}
    </div>
  );
}
