import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Calendar, MapPin, Pencil as Edit2, Trash2, Tag, Search, Filter, TrendingUp, DollarSign, CheckCircle2, Clock, FileText, X, XCircle, AlertCircle, Ban, Copy, Eye, MoreVertical, AlertTriangle, Send, User, Upload, CheckSquare2, Square, Link2, Grid3x3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { formatCurrency } from '../lib/calculations';
import { format } from 'date-fns';
import type { Quotation, QuotationInsert, ProjectType, QuotationStatus, ProjectStatus } from '../types';
import { getProjectsWithStalePrices } from '../lib/priceUpdateSystem';
import { ImportProjectModal } from '../components/ImportProjectModal';
import { groupProjectsByGroupId } from '../lib/projectGrouping';
import { ProjectGroupCard } from '../components/ProjectGroupCard';
import { useSettingsStore } from '../lib/settingsStore';

type SortBy = 'modified_desc' | 'modified_asc' | 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'amount_desc' | 'amount_asc';

export function Projects() {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const exchangeRate = useSettingsStore(s => s.settings.exchangeRateUsdToMxn);
  const fetchSettings = useSettingsStore(s => s.fetchSettings);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Quotation | null>(null);
  const [selectedProject, setSelectedProject] = useState<Quotation | null>(null);
  const [staleProjectIds, setStaleProjectIds] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('modified_desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  useEffect(() => {
    loadProjects();
    loadStaleProjects();
    fetchSettings();
  }, []);

  async function loadStaleProjects() {
    const ids = await getProjectsWithStalePrices();
    setStaleProjectIds(ids);
  }

  useEffect(() => {
    if (routeProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === routeProjectId);
      if (project) {
        setSelectedProject(project);
      }
    } else if (!routeProjectId) {
      setSelectedProject(null);
    }
  }, [routeProjectId, projects]);

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('quotations')
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
          p.customer?.toLowerCase().includes(query) ||
          p.project_details?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((p) => p.project_type === typeFilter);
    }

    if (customerFilter !== 'all') {
      filtered = filtered.filter((p) => p.customer === customerFilter);
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
          return (b.total_amount ?? 0) - (a.total_amount ?? 0);
        case 'amount_asc':
          return (a.total_amount ?? 0) - (b.total_amount ?? 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [projects, searchQuery, statusFilter, typeFilter, customerFilter, monthFilter, yearFilter, sortBy]);

  const projectGroups = useMemo(() => {
    const groups = groupProjectsByGroupId(filteredAndSortedProjects);
    groups.sort((a, b) => {
      switch (sortBy) {
        case 'modified_desc':
          return new Date(b.latestUpdatedAt).getTime() - new Date(a.latestUpdatedAt).getTime();
        case 'modified_asc':
          return new Date(a.latestUpdatedAt).getTime() - new Date(b.latestUpdatedAt).getTime();
        case 'date_desc':
          return new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime();
        case 'date_asc':
          return new Date(a.latestDate).getTime() - new Date(b.latestDate).getTime();
        case 'name_asc':
          return a.primaryProject.name.localeCompare(b.primaryProject.name);
        case 'name_desc':
          return b.primaryProject.name.localeCompare(a.primaryProject.name);
        case 'amount_desc':
          return (b.primaryProject.total_amount ?? 0) - (a.primaryProject.total_amount ?? 0);
        case 'amount_asc':
          return (a.primaryProject.total_amount ?? 0) - (b.primaryProject.total_amount ?? 0);
        default:
          return 0;
      }
    });
    return groups;
  }, [filteredAndSortedProjects, sortBy]);

  const stats = useMemo(() => {
    const total = projects.length;
    const pending = projects.filter((p) => p.status === 'Pending').length;
    const estimating = projects.filter((p) => p.status === 'Estimating').length;
    const awarded = projects.filter((p) => p.status === 'Awarded').length;
    const lost = projects.filter((p) => p.status === 'Lost').length;
    const disqualified = projects.filter((p) => p.status === 'Discarded').length;
    const cancelled = projects.filter((p) => p.status === 'Cancelled').length;

    const totalValue = projects.reduce((sum, p) => sum + (p.total_amount ?? 0), 0);
    const awardedValue = projects
      .filter((p) => p.status === 'Awarded')
      .reduce((sum, p) => sum + (p.total_amount ?? 0), 0);
    const activeValue = projects
      .filter((p) => p.status === 'Pending' || p.status === 'Estimating')
      .reduce((sum, p) => sum + (p.total_amount ?? 0), 0);
    const lostValue = projects
      .filter((p) => p.status === 'Lost' || p.status === 'Discarded' || p.status === 'Cancelled')
      .reduce((sum, p) => sum + (p.total_amount ?? 0), 0);

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

  const uniqueCustomers = useMemo(() => {
    const customers = projects
      .map(p => p.customer)
      .filter((c): c is string => c !== null && c !== undefined && c.trim() !== '');
    return Array.from(new Set(customers)).sort();
  }, [projects]);

  function handleAddNew() {
    setEditingProject(null);
    setIsModalOpen(true);
  }

  async function handleImportComplete(projectId: string) {
    await loadProjects();
    navigate(`/projects/${projectId}`);
  }

  function handleEdit(project: Quotation) {
    setEditingProject(project);
    setIsModalOpen(true);
  }

  async function handleDelete(project: Quotation) {
    if (!confirm(`Delete project "${project.name}"? This will also delete all areas and cabinets.`)) return;

    try {
      const { error } = await supabase.from('quotations').delete().eq('id', project.id);

      if (error) throw error;
      loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  }

  async function handleDuplicate(project: Quotation) {
    if (!confirm(`Duplicate project "${project.name}"?`)) return;

    try {
      const { id, created_at, updated_at, ...projectData } = project;
      projectData.name = `${projectData.name} (Copy)`;
      projectData.status = 'Pending';
      projectData.group_id = project.group_id || crypto.randomUUID();

      const { error } = await supabase.from('quotations').insert([projectData]);

      if (error) throw error;
      loadProjects();
    } catch (error) {
      console.error('Error duplicating project:', error);
      alert('Failed to duplicate project');
    }
  }

  async function handleQuickStatusChange(project: Quotation, newStatus: QuotationStatus) {
    try {
      const { error } = await supabase
        .from('quotations')
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

  async function handleSaveProject(project: QuotationInsert) {
    try {
      if (editingProject) {
        const { error } = await supabase
          .from('quotations')
          .update(project)
          .eq('id', editingProject.id);

        if (error) throw error;
      } else {
        const projectWithGroup = {
          ...project,
          group_id: crypto.randomUUID(),
        };
        const { error } = await supabase.from('quotations').insert([projectWithGroup]);

        if (error) throw error;
      }

      loadProjects();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project');
    }
  }

  function handleViewProject(project: Quotation) {
    navigate(`/projects/${project.id}`);
  }

  function handleBackToList() {
    setSelectedProject(null);
    loadProjects();
    navigate('/projects');
  }

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setCustomerFilter('all');
    setMonthFilter('all');
    setYearFilter('all');
    setSortBy('modified_desc');
  }

  function toggleSelectionMode() {
    setSelectionMode(!selectionMode);
    setSelectedProjectIds([]);
  }

  function handleProjectSelect(projectId: string, checked: boolean) {
    if (checked) {
      setSelectedProjectIds([...selectedProjectIds, projectId]);
    } else {
      setSelectedProjectIds(selectedProjectIds.filter(id => id !== projectId));
    }
  }

  function handleSelectAllInGroup(groupProjectIds: string[], checked: boolean) {
    if (checked) {
      const newSelected = [...new Set([...selectedProjectIds, ...groupProjectIds])];
      setSelectedProjectIds(newSelected);
    } else {
      setSelectedProjectIds(selectedProjectIds.filter(id => !groupProjectIds.includes(id)));
    }
  }

  async function handleGroupSelected() {
    if (selectedProjectIds.length < 2) {
      alert('Please select at least 2 projects to group together');
      return;
    }

    try {
      const selectedProjects = projects.filter(p => selectedProjectIds.includes(p.id));
      const primaryProject = selectedProjects.sort((a, b) =>
        new Date(a.created_at ?? '').getTime() - new Date(b.created_at ?? '').getTime()
      )[0];

      let groupId = primaryProject.group_id;
      if (!groupId) {
        groupId = crypto.randomUUID();
        const { error: primaryError } = await supabase
          .from('quotations')
          .update({ group_id: groupId })
          .eq('id', primaryProject.id);

        if (primaryError) throw primaryError;
      }

      const otherProjectIds = selectedProjectIds.filter(id => id !== primaryProject.id);
      if (otherProjectIds.length > 0) {
        const { error } = await supabase
          .from('quotations')
          .update({ group_id: groupId })
          .in('id', otherProjectIds);

        if (error) throw error;
      }

      await loadProjects();
      setSelectedProjectIds([]);
      setSelectionMode(false);
      alert(`Successfully grouped ${selectedProjectIds.length} projects together!`);
    } catch (error) {
      console.error('Error grouping projects:', error);
      alert('Failed to group projects');
    }
  }

  async function handleUngroupProject(projectId: string) {
    if (!confirm('Remove this project from the group? It will become a standalone project.')) return;

    try {
      const { error } = await supabase
        .from('quotations')
        .update({ group_id: null })
        .eq('id', projectId);

      if (error) throw error;

      await loadProjects();
      alert('Project removed from group successfully!');
    } catch (error) {
      console.error('Error ungrouping project:', error);
      alert('Failed to ungroup project');
    }
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || customerFilter !== 'all' || monthFilter !== 'all' || yearFilter !== 'all';

  if (selectedProject) {
    return <ProjectDetails project={selectedProject} onBack={handleBackToList} />;
  }

  if (loading) {
    return (
      <div className="space-y-6 page-enter">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-2">
            <div className="h-8 w-40 skeleton-shimmer" />
            <div className="h-4 w-56 skeleton-shimmer" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-28 skeleton-shimmer" />
            <div className="h-10 w-32 skeleton-shimmer" />
          </div>
        </div>
        <div className="glass-white h-14 animate-pulse" />
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="glass-white h-32 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="page-enter">
      <div className="mb-6">
        <div className="flex justify-between items-start mb-6 hero-enter">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
            <p className="mt-2 text-slate-600">Manage your millwork quotations</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={toggleSelectionMode}
              size="lg"
              variant={selectionMode ? 'primary' : 'secondary'}
            >
              {selectionMode ? (
                <>
                  <CheckSquare2 className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Cancel Selection</span>
                </>
              ) : (
                <>
                  <Square className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Select</span>
                </>
              )}
            </Button>
            <Button onClick={() => setIsImportModalOpen(true)} size="lg" variant="secondary">
              <Upload className="h-5 w-5 sm:mr-2" />
              <span className="hidden sm:inline">Import Project</span>
            </Button>
            <Button onClick={handleAddNew} size="lg">
              <Plus className="h-5 w-5 sm:mr-2" />
              <span className="hidden sm:inline">New Project</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="glass-blue rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-8 w-8 text-blue-600" />
              <span className="text-3xl font-bold text-blue-900">{stats.pending + stats.estimating}</span>
            </div>
            <p className="text-sm font-medium text-blue-900">Active Projects</p>
            <p className="text-xs text-blue-700 mt-1">
              {stats.pending} pending · {stats.estimating} estimating
            </p>
            <p className="text-sm font-bold text-blue-900 mt-2">{formatCurrency(stats.activeValue / exchangeRate, 'USD')}</p>
          </div>

          <div className="glass-green rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <span className="text-3xl font-bold text-green-900">{stats.awarded}</span>
            </div>
            <p className="text-sm font-medium text-green-900">Awarded</p>
            <p className="text-xs text-green-700 mt-1">Won projects</p>
            <p className="text-sm font-bold text-green-900 mt-2">{formatCurrency(stats.awardedValue / exchangeRate, 'USD')}</p>
          </div>

          <div className="glass-white p-4" style={{ background: 'rgba(254,226,226,0.55)', border: '1px solid rgba(252,165,165,0.5)' }}>
            <div className="flex items-center justify-between mb-2">
              <XCircle className="h-8 w-8 text-red-600" />
              <span className="text-3xl font-bold text-red-900">{stats.lost + stats.disqualified + stats.cancelled}</span>
            </div>
            <p className="text-sm font-medium text-red-900">Lost/Cancelled</p>
            <p className="text-xs text-red-700 mt-1">
              {stats.lost} lost · {stats.disqualified} disqualified · {stats.cancelled} cancelled
            </p>
            <p className="text-sm font-bold text-red-900 mt-2">{formatCurrency(stats.lostValue / exchangeRate, 'USD')}</p>
          </div>

          <div className="glass-white p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-8 w-8 text-slate-600" />
              <span className="text-2xl font-bold text-slate-900">
                {formatCurrency(stats.totalValue / exchangeRate, 'USD')}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-900">Total Value</p>
            <p className="text-xs text-slate-600 mt-1">{stats.total} total projects</p>
            <p className="text-xs text-slate-600">
              Win Rate: {stats.total > 0 ? ((stats.awarded / stats.total) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>

        <div className="glass-white p-4 mb-6">
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
                  <option value="Discarded">Discarded</option>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Customer</label>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Customers</option>
                  {uniqueCustomers.map((customer) => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
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
                  <option value="modified_desc">Recent Activity (Newest)</option>
                  <option value="modified_asc">Recent Activity (Oldest)</option>
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
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
              <FolderOpen className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              {hasActiveFilters ? 'No matching projects' : 'No projects yet'}
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'Try adjusting your search or filters to find what you are looking for.'
                : 'Create your first project to start generating millwork quotations.'}
            </p>
            {!hasActiveFilters && <Button onClick={handleAddNew}>Create Your First Project</Button>}
            {hasActiveFilters && (
              <Button variant="secondary" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>

      {filteredAndSortedProjects.length > 0 && projectGroups && projectGroups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projectGroups.map((group) =>
            group?.versionCount === 1 ? (
              <ProjectCard
                key={group.primaryProject?.id}
                project={group.primaryProject}
                onView={handleViewProject}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onStatusChange={handleQuickStatusChange}
                staleProjectIds={staleProjectIds}
                exchangeRate={exchangeRate}
                selectionMode={selectionMode}
                isSelected={selectedProjectIds.includes(group.primaryProject.id)}
                onSelect={handleProjectSelect}
              />
            ) : (
              <ProjectGroupCard
                key={group.groupId}
                group={group}
                allProjects={projects}
                onView={handleViewProject}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onStatusChange={handleQuickStatusChange}
                onUngroup={handleUngroupProject}
                staleProjectIds={staleProjectIds}
                exchangeRate={exchangeRate}
                selectionMode={selectionMode}
                selectedProjectIds={selectedProjectIds}
                onSelect={handleProjectSelect}
                onSelectAll={handleSelectAllInGroup}
              />
            )
          )}
        </div>
      )}

      {selectionMode && selectedProjectIds.length >= 2 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-blue-600 text-white rounded-full shadow-2xl px-8 py-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckSquare2 className="h-5 w-5" />
              <span className="font-semibold">{selectedProjectIds.length} projects selected</span>
            </div>
            <Button
              onClick={handleGroupSelected}
              variant="secondary"
              size="lg"
              className="bg-white text-blue-600 hover:bg-blue-50"
            >
              <Link2 className="h-5 w-5 mr-2" />
              Group Selected Projects
            </Button>
          </div>
        </div>
      )}

    </div>

      {isModalOpen && (
        <ProjectFormModal
          project={editingProject}
          onSave={handleSaveProject}
          onClose={handleCloseModal}
        />
      )}

      <ImportProjectModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
      />
    </>
  );
}

interface ProjectCardProps {
  project: Quotation;
  onView: (project: Quotation) => void;
  onEdit: (project: Quotation) => void;
  onDelete: (project: Quotation) => void;
  onDuplicate: (project: Quotation) => void;
  onStatusChange: (project: Quotation, status: ProjectStatus) => void;
  staleProjectIds: string[];
  exchangeRate: number;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (projectId: string, checked: boolean) => void;
}

function ProjectCard({ project, onView, onEdit, onDelete, onDuplicate, onStatusChange, staleProjectIds, exchangeRate, selectionMode, isSelected, onSelect }: ProjectCardProps) {
  const [showActions, setShowActions] = useState(false);
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
      case 'Discarded':
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

  const statusConfig = getStatusConfig(project.status ?? '');

  return (
    <div className="group bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all duration-200 overflow-hidden relative">
      <div className="h-1.5 bg-blue-500" />

      {selectionMode && (
        <div className="absolute top-4 left-4 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect?.(project.id, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      )}

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
            <MoreVertical className="h-4 w-4 text-slate-500" />
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
                    onStatusChange(project, 'Pending');
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-blue-700"
                >
                  <Clock className="h-4 w-4" />
                  Mark as Pending
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(project, 'Estimating');
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-orange-700"
                >
                  <FileText className="h-4 w-4" />
                  Mark as Estimating
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(project, 'Sent');
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-cyan-700"
                >
                  <Send className="h-4 w-4" />
                  Mark as Sent
                </button>
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(project, 'Discarded');
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-600"
                >
                  <Ban className="h-4 w-4" />
                  Mark as Discarded
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(project, 'Cancelled');
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-gray-600"
                >
                  <AlertCircle className="h-4 w-4" />
                  Mark as Cancelled
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

      <div className="p-5 cursor-pointer" onClick={() => onView(project)}>
        <div className="pr-8 mb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug flex-1">
              {project.name}
            </h3>
            {staleProjectIds.includes(project.id) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 flex-shrink-0" title="Price updates available">
                <AlertTriangle className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>

        <div className="mb-3">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${statusConfig.color}`}>
            {statusConfig.icon}
            {project.status}
          </span>
        </div>

        <div className="space-y-1.5 mb-4">
          {project.customer && (
            <div className="flex items-center text-sm text-slate-600">
              <User className="h-3.5 w-3.5 mr-2 flex-shrink-0 text-slate-400" />
              <span className="font-medium">{project.customer}</span>
            </div>
          )}

          {project.address && (
            <div className="flex items-start text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5 mr-2 mt-0.5 flex-shrink-0 text-slate-400" />
              <span className="line-clamp-2 leading-snug">{project.address}</span>
            </div>
          )}

          <div className="flex items-center text-sm text-slate-500">
            <Calendar className="h-3.5 w-3.5 mr-2 flex-shrink-0 text-slate-400" />
            <span>{format(new Date(project.quote_date + 'T00:00:00'), 'MMM dd, yyyy')}</span>
          </div>

          <div className="flex items-center text-sm text-slate-500">
            <span className="mr-2 text-slate-400">{getTypeIcon(project.project_type)}</span>
            <span>{project.project_type}</span>
          </div>
        </div>

        {project.project_details && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{project.project_details}</p>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100">
          <div className="text-2xl font-bold text-slate-900 mb-3">
            {formatCurrency((project.total_amount ?? 0) / exchangeRate, 'USD')}
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

interface ProjectFormModalProps {
  project: Quotation | null;
  onSave: (project: QuotationInsert) => void;
  onClose: () => void;
}

function ProjectFormModal({ project, onSave, onClose }: ProjectFormModalProps) {
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState<QuotationInsert>({
    name: project?.name || '',
    customer: project?.customer || '',
    address: project?.address || '',
    project_id: project?.project_id || '',
    quote_date: project?.quote_date || getTodayDate(),
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
            label="Customer Name"
            value={formData.customer || ''}
            onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
            placeholder="John Smith"
          />

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
              value={formData.status ?? ''}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="Pending">Pending</option>
              <option value="Estimating">Estimating</option>
              <option value="Sent">Sent</option>
              <option value="Lost">Lost</option>
              <option value="Awarded">Awarded</option>
              <option value="Discarded">Discarded</option>
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
