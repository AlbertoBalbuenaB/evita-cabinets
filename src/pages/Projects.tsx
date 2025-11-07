import { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  FolderOpen,
  Calendar,
  MapPin,
  Edit2,
  Trash2,
  Tag,
  Search,
  Filter,
  Grid3x3,
  List,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Clock,
  FileText,
  X,
  XCircle,
  AlertCircle,
  Ban,
  Copy,
  Eye,
  MoreVertical,
  AlertTriangle,
  Send
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { formatCurrency } from '../lib/calculations';
import { format } from 'date-fns';
import type { Project, ProjectInsert, ProjectType, ProjectStatus } from '../types';
import { getProjectsWithStalePrices } from '../lib/priceUpdateSystem';

type ViewMode = 'grid' | 'list';
type SortBy = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'amount_desc' | 'amount_asc';

interface ProjectsProps {
  selectedProjectId?: string | null;
  onClearSelection?: () => void;
}

export function Projects({ selectedProjectId, onClearSelection }: ProjectsProps = {}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [staleProjectIds, setStaleProjectIds] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date_desc');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadProjects();
    loadStaleProjects();
  }, []);

  async function loadStaleProjects() {
    const ids = await getProjectsWithStalePrices();
    setStaleProjectIds(ids);
  }

  useEffect(() => {
    if (selectedProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (project) {
        setSelectedProject(project);
        if (onClearSelection) {
          onClearSelection();
        }
      }
    }
  }, [selectedProjectId, projects, onClearSelection]);

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('quote_date', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  const availableYears = useMemo(() => {
    const years = new Set(projects.map(p => new Date(p.quote_date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [projects]);

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...projects];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.address?.toLowerCase().includes(query) ||
          p.project_details?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((p) => p.project_type === typeFilter);
    }

    if (yearFilter !== 'all') {
      filtered = filtered.filter((p) => new Date(p.quote_date).getFullYear().toString() === yearFilter);
    }

    if (monthFilter !== 'all') {
      filtered = filtered.filter((p) => (new Date(p.quote_date).getMonth() + 1).toString() === monthFilter);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.quote_date).getTime() - new Date(a.quote_date).getTime();
        case 'date_asc':
          return new Date(a.quote_date).getTime() - new Date(b.quote_date).getTime();
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'amount_desc':
          return b.total_amount - a.total_amount;
        case 'amount_asc':
          return a.total_amount - b.total_amount;
        default:
          return 0;
      }
    });

    return filtered;
  }, [projects, searchQuery, statusFilter, typeFilter, monthFilter, yearFilter, sortBy]);

  const stats = useMemo(() => {
    const total = projects.length;
    const pending = projects.filter((p) => p.status === 'Pending').length;
    const estimating = projects.filter((p) => p.status === 'Estimating').length;
    const awarded = projects.filter((p) => p.status === 'Awarded').length;
    const lost = projects.filter((p) => p.status === 'Lost').length;
    const disqualified = projects.filter((p) => p.status === 'Disqualified').length;
    const cancelled = projects.filter((p) => p.status === 'Cancelled').length;

    const totalValue = projects.reduce((sum, p) => sum + p.total_amount, 0);
    const awardedValue = projects
      .filter((p) => p.status === 'Awarded')
      .reduce((sum, p) => sum + p.total_amount, 0);
    const activeValue = projects
      .filter((p) => p.status === 'Pending' || p.status === 'Estimating')
      .reduce((sum, p) => sum + p.total_amount, 0);
    const lostValue = projects
      .filter((p) => p.status === 'Lost' || p.status === 'Disqualified' || p.status === 'Cancelled')
      .reduce((sum, p) => sum + p.total_amount, 0);

    return {
      total,
      pending,
      estimating,
      awarded,
      lost,
      disqualified,
      cancelled,
      totalValue,
      awardedValue,
      activeValue,
      lostValue,
    };
  }, [projects]);

  function handleAddNew() {
    setEditingProject(null);
    setIsModalOpen(true);
  }

  function handleEdit(project: Project) {
    setEditingProject(project);
    setIsModalOpen(true);
  }

  async function handleDelete(project: Project) {
    if (!confirm(`Delete project "${project.name}"? This will also delete all areas and cabinets.`)) return;

    try {
      const { error } = await supabase.from('projects').delete().eq('id', project.id);

      if (error) throw error;
      loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  }

  async function handleDuplicate(project: Project) {
    if (!confirm(`Duplicate project "${project.name}"?`)) return;

    try {
      const { id, created_at, updated_at, ...projectData } = project;
      projectData.name = `${projectData.name} (Copy)`;
      projectData.status = 'Pending';

      const { error } = await supabase.from('projects').insert([projectData]);

      if (error) throw error;
      loadProjects();
    } catch (error) {
      console.error('Error duplicating project:', error);
      alert('Failed to duplicate project');
    }
  }

  async function handleQuickStatusChange(project: Project, newStatus: ProjectStatus) {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', project.id);

      if (error) throw error;
      loadProjects();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingProject(null);
  }

  async function handleSaveProject(project: ProjectInsert) {
    try {
      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update(project)
          .eq('id', editingProject.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('projects').insert([project]);

        if (error) throw error;
      }

      loadProjects();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project');
    }
  }

  function handleViewProject(project: Project) {
    setSelectedProject(project);
  }

  function handleBackToList() {
    setSelectedProject(null);
    loadProjects();
  }

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setMonthFilter('all');
    setYearFilter('all');
    setSortBy('date_desc');
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || monthFilter !== 'all' || yearFilter !== 'all';

  if (selectedProject) {
    return <ProjectDetails project={selectedProject} onBack={handleBackToList} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading projects...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
            <p className="mt-2 text-slate-600">Manage your millwork quotations</p>
          </div>
          <Button onClick={handleAddNew} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            New Project
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-8 w-8 text-blue-600" />
              <span className="text-3xl font-bold text-blue-900">{stats.pending + stats.estimating}</span>
            </div>
            <p className="text-sm font-medium text-blue-900">Active Projects</p>
            <p className="text-xs text-blue-700 mt-1">
              {stats.pending} pending · {stats.estimating} estimating
            </p>
            <p className="text-sm font-bold text-blue-900 mt-2">{formatCurrency(stats.activeValue)}</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <span className="text-3xl font-bold text-green-900">{stats.awarded}</span>
            </div>
            <p className="text-sm font-medium text-green-900">Awarded</p>
            <p className="text-xs text-green-700 mt-1">Won projects</p>
            <p className="text-sm font-bold text-green-900 mt-2">{formatCurrency(stats.awardedValue)}</p>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="h-8 w-8 text-red-600" />
              <span className="text-3xl font-bold text-red-900">{stats.lost + stats.disqualified + stats.cancelled}</span>
            </div>
            <p className="text-sm font-medium text-red-900">Lost/Cancelled</p>
            <p className="text-xs text-red-700 mt-1">
              {stats.lost} lost · {stats.disqualified} disqualified · {stats.cancelled} cancelled
            </p>
            <p className="text-sm font-bold text-red-900 mt-2">{formatCurrency(stats.lostValue)}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-8 w-8 text-purple-600" />
              <span className="text-2xl font-bold text-purple-900">
                {formatCurrency(stats.totalValue)}
              </span>
            </div>
            <p className="text-sm font-medium text-purple-900">Total Value</p>
            <p className="text-xs text-purple-700 mt-1">{stats.total} total projects</p>
            <p className="text-xs text-purple-700">
              Win Rate: {stats.total > 0 ? ((stats.awarded / stats.total) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects by name, address, or details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={showFilters ? 'primary' : 'secondary'}
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    !
                  </span>
                )}
              </Button>

              <div className="flex border border-slate-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 border-l border-slate-300 ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Estimating">Estimating</option>
                  <option value="Sent">Sent</option>
                  <option value="Lost">Lost</option>
                  <option value="Awarded">Awarded</option>
                  <option value="Disqualified">Disqualified</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="Custom">Custom</option>
                  <option value="Bids">Bids</option>
                  <option value="Prefab">Prefab</option>
                  <option value="Stores">Stores</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Year</label>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Years</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year.toString()}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Month</label>
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Months</option>
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="date_desc">Date (Newest)</option>
                  <option value="date_asc">Date (Oldest)</option>
                  <option value="name_asc">Name (A-Z)</option>
                  <option value="name_desc">Name (Z-A)</option>
                  <option value="amount_desc">Amount (High-Low)</option>
                  <option value="amount_asc">Amount (Low-High)</option>
                </select>
              </div>

              {hasActiveFilters && (
                <div className="lg:col-span-5 flex justify-end">
                  <Button variant="ghost" onClick={clearFilters} size="sm">
                    <X className="h-4 w-4 mr-2" />
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {filteredAndSortedProjects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-600 mb-4">
              {hasActiveFilters ? 'No projects match your filters' : 'No projects yet'}
            </p>
            {!hasActiveFilters && <Button onClick={handleAddNew}>Create Your First Project</Button>}
            {hasActiveFilters && (
              <Button variant="secondary" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onView={handleViewProject}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onStatusChange={handleQuickStatusChange}
              staleProjectIds={staleProjectIds}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAndSortedProjects.map((project) => (
            <ProjectListItem
              key={project.id}
              project={project}
              onView={handleViewProject}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onStatusChange={handleQuickStatusChange}
              staleProjectIds={staleProjectIds}
            />
          ))}
        </div>
      )}

      {isModalOpen && (
        <ProjectFormModal
          project={editingProject}
          onSave={handleSaveProject}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  onView: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onDuplicate: (project: Project) => void;
  onStatusChange: (project: Project, status: ProjectStatus) => void;
  staleProjectIds: string[];
}

function ProjectCard({ project, onView, onEdit, onDelete, onDuplicate, onStatusChange, staleProjectIds }: ProjectCardProps) {
  const [showActions, setShowActions] = useState(false);
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Custom':
        return <FileText className="h-3.5 w-3.5" />;
      case 'Bids':
        return <TrendingUp className="h-3.5 w-3.5" />;
      case 'Prefab':
        return <Grid3x3 className="h-3.5 w-3.5" />;
      case 'Stores':
        return <FolderOpen className="h-3.5 w-3.5" />;
      default:
        return <Tag className="h-3.5 w-3.5" />;
    }
  };

  const statusConfig = getStatusConfig(project.status);

  return (
    <div className="group bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all duration-200 overflow-hidden relative">
      <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500" />

      <div className="absolute top-4 right-4 z-10">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="More actions"
          >
            <MoreVertical className="h-4 w-4 text-slate-600" />
          </button>

          {showActions && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowActions(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(project);
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(project);
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Project
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(project);
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </button>
                <div className="border-t border-slate-200 my-1" />
                <div className="px-4 py-2 text-xs font-medium text-slate-500">Change Status</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(project, 'Awarded');
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-green-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark as Awarded
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(project, 'Lost');
                    setShowActions(false);
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
                    onDelete(project);
                    setShowActions(false);
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

      <div className="p-6 cursor-pointer" onClick={() => onView(project)}>
        <div className="flex justify-between items-start mb-3 pr-8">
          <div className="flex items-start gap-2 flex-1">
            <h3 className="text-lg font-semibold text-slate-900 line-clamp-2 flex-1 group-hover:text-blue-600 transition-colors">
              {project.name}
            </h3>
            {staleProjectIds.includes(project.id) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300" title="Price updates available">
                <AlertTriangle className="h-3 w-3" />
              </span>
            )}
          </div>
          <span
            className={`ml-3 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${statusConfig.color}`}
          >
            {statusConfig.icon}
            {project.status}
          </span>
        </div>

        {project.address && (
          <div className="flex items-center text-sm text-slate-600 mb-2">
            <MapPin className="h-4 w-4 mr-1.5 flex-shrink-0 text-slate-400" />
            <span className="line-clamp-1">{project.address}</span>
          </div>
        )}

        <div className="flex items-center text-sm text-slate-600 mb-2">
          <Calendar className="h-4 w-4 mr-1.5 flex-shrink-0 text-slate-400" />
          <span>{format(new Date(project.quote_date), 'MMM dd, yyyy')}</span>
        </div>

        <div className="flex items-center text-sm text-slate-600 mb-4">
          <span className="mr-1.5 text-slate-400">{getTypeIcon(project.project_type)}</span>
          <span className="font-medium">{project.project_type}</span>
        </div>

        {project.project_details && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 line-clamp-2">{project.project_details}</p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200">
          <div className="text-2xl font-bold text-slate-900 mb-4">
            {formatCurrency(project.total_amount)}
          </div>

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onView(project);
              }}
              className="flex-1"
            >
              View Details
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(project);
              }}
              className="hover:bg-blue-50"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project);
              }}
              className="hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectListItem({ project, onView, onEdit, onDelete, staleProjectIds }: ProjectCardProps) {
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

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
      onClick={() => onView(project)}
    >
      <div className="p-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-base font-semibold text-slate-900 truncate hover:text-blue-600 transition-colors">
              {project.name}
            </h3>
            {staleProjectIds.includes(project.id) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300" title="Price updates available">
                <AlertTriangle className="h-3 w-3" />
              </span>
            )}
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                project.status
              )}`}
            >
              {project.status}
            </span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {project.project_type}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-600">
            {project.address && (
              <div className="flex items-center">
                <MapPin className="h-3.5 w-3.5 mr-1 text-slate-400" />
                <span className="truncate max-w-xs">{project.address}</span>
              </div>
            )}
            <div className="flex items-center">
              <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" />
              <span>{format(new Date(project.quote_date), 'MMM dd, yyyy')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right mr-2">
            <div className="text-xs text-slate-500 mb-1">Total Value</div>
            <div className="text-xl font-bold text-slate-900">
              {formatCurrency(project.total_amount)}
            </div>
          </div>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="More actions"
            >
              <MoreVertical className="h-4 w-4 text-slate-600" />
            </button>

            {showActions && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowActions(false)}
                />
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onView(project);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(project);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit Project
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(project);
                      setShowActions(false);
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
                      onStatusChange(project, 'Awarded');
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark as Awarded
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(project, 'Lost');
                      setShowActions(false);
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
                      onDelete(project);
                      setShowActions(false);
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
    </div>
  );
}

interface ProjectFormModalProps {
  project: Project | null;
  onSave: (project: ProjectInsert) => void;
  onClose: () => void;
}

function ProjectFormModal({ project, onSave, onClose }: ProjectFormModalProps) {
  const [formData, setFormData] = useState<ProjectInsert>({
    name: project?.name || '',
    address: project?.address || '',
    quote_date: project?.quote_date || format(new Date(), 'yyyy-MM-dd'),
    status: project?.status || 'Pending',
    project_type: project?.project_type || 'Custom',
    project_details: project?.project_details || '',
  });

  const maxChars = 5000;
  const remainingChars = maxChars - (formData.project_details?.length || 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={project ? 'Edit Project' : 'Create New Project'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Project Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Kitchen Renovation - Smith Residence"
            />
          </div>

          <Input
            label="Address (Optional)"
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="123 Main St, City, State ZIP"
          />

          <Input
            label="Quote Date"
            type="date"
            value={formData.quote_date}
            onChange={(e) => setFormData({ ...formData, quote_date: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Project Type
            </label>
            <select
              value={formData.project_type}
              onChange={(e) => setFormData({ ...formData, project_type: e.target.value as ProjectType })}
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="Custom">Custom</option>
              <option value="Bids">Bids</option>
              <option value="Prefab">Prefab</option>
              <option value="Stores">Stores</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="Pending">Pending</option>
              <option value="Estimating">Estimating</option>
              <option value="Sent">Sent</option>
              <option value="Lost">Lost</option>
              <option value="Awarded">Awarded</option>
              <option value="Disqualified">Disqualified</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Project Details (Optional)
          </label>
          <textarea
            value={formData.project_details || ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= maxChars) {
                setFormData({ ...formData, project_details: value });
              }
            }}
            placeholder="Add detailed description, specifications, notes, or any relevant information about the project..."
            className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-y"
            rows={6}
          />
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-slate-500">Max 5,000 characters</span>
            <span className={remainingChars < 500 ? 'text-amber-600 font-medium' : 'text-slate-500'}>
              {remainingChars} characters remaining
            </span>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {project ? 'Update Project' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { ProjectDetails } from './ProjectDetails';
