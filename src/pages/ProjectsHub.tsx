import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FolderOpen, MapPin, User, Calendar, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { NewProjectModal } from '../components/NewProjectModal';
import { formatCurrency } from '../lib/calculations';
import { useSettingsStore } from '../lib/settingsStore';
import type { Project, Quotation } from '../types';

interface ProjectWithStats extends Project {
  quotations: Quotation[];
  quotationCount: number;
  latestQuotation: Quotation | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ProjectsHub() {
  const navigate = useNavigate();
  const exchangeRate = useSettingsStore(s => s.settings.exchangeRateUsdToMxn);
  const fetchSettings = useSettingsStore(s => s.fetchSettings);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadProjects();
    fetchSettings();
  }, []);

  async function loadProjects() {
    try {
      const [{ data: hubs, error: hubErr }, { data: quotations, error: qErr }] = await Promise.all([
        supabase.from('projects').select('*').order('updated_at', { ascending: false }),
        supabase.from('quotations').select('id, project_id, name, status, total_amount, quote_date, version_number, version_label, created_at, updated_at').order('version_number', { ascending: false }),
      ]);

      if (hubErr) throw hubErr;
      if (qErr) throw qErr;

      const quotationsByProject = new Map<string, Quotation[]>();
      (quotations || []).forEach(q => {
        if (!quotationsByProject.has(q.project_id)) quotationsByProject.set(q.project_id, []);
        quotationsByProject.get(q.project_id)!.push(q as Quotation);
      });

      const enriched: ProjectWithStats[] = (hubs || []).map(p => {
        const pQuotations = quotationsByProject.get(p.id) || [];
        return {
          ...p,
          quotations: pQuotations,
          quotationCount: pQuotations.length,
          latestQuotation: pQuotations[0] || null,
        };
      });

      setProjects(enriched);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateProject() {
    setShowCreateModal(true);
  }

  function handleProjectCreated(projectId: string) {
    navigate(`/projects/${projectId}`);
  }

  const projectTypes = useMemo(() => {
    const types = new Set(projects.map(p => p.project_type).filter(Boolean));
    return Array.from(types).sort();
  }, [projects]);

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (typeFilter !== 'all' && p.project_type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCustomer = p.customer?.toLowerCase().includes(q);
        const matchesAddress = p.address?.toLowerCase().includes(q);
        if (!matchesName && !matchesCustomer && !matchesAddress) return false;
      }
      return true;
    });
  }, [projects, typeFilter, searchQuery]);

  if (loading) {
    return (
      <div className="space-y-6 page-enter">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-2">
            <div className="h-8 w-48 skeleton-shimmer" />
            <div className="h-4 w-64 skeleton-shimmer" />
          </div>
          <div className="h-10 w-36 skeleton-shimmer" />
        </div>
        <div className="glass-white h-14 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="glass-white h-48 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="page-enter">
      <div className="flex justify-between items-start mb-6 hero-enter">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
          <p className="mt-2 text-slate-600">Manage your millwork projects and quotations</p>
        </div>
        <Button onClick={handleCreateProject} size="lg">
          <Plus className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">New Project</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-white p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, customer, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200/60 rounded-lg bg-white/80"
          >
            <option value="all">All Types</option>
            {projectTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-xs text-slate-400 self-center hidden sm:inline">{filtered.length} projects</span>
        </div>
      </div>

      {/* Project cards */}
      {filtered.length === 0 ? (
        <div className="glass-white p-12 text-center">
          <FolderOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{searchQuery ? 'No projects match your search.' : 'Create your first project to get started.'}</p>
          {!searchQuery && (
            <Button onClick={handleCreateProject} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project, idx) => {
            const latest = project.latestQuotation;
            const statusColors: Record<string, string> = {
              Awarded: 'bg-green-50 text-green-700 border-green-200/50',
              Pending: 'bg-blue-50 text-blue-700 border-blue-200/50',
              Estimating: 'bg-amber-50 text-amber-700 border-amber-200/50',
              Sent: 'bg-cyan-50 text-cyan-700 border-cyan-200/50',
              Lost: 'bg-red-50 text-red-700 border-red-200/50',
            };

            return (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className={`glass-white p-0 overflow-hidden cursor-pointer group hover:shadow-lg hover:border-blue-300/60 hover:-translate-y-0.5 transition-all duration-200 card-enter stagger-${Math.min(idx + 1, 12)}`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 flex-1">{project.name}</h3>
                    {latest && (
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border ${statusColors[latest.status] || 'bg-slate-50 text-slate-600 border-slate-200/50'}`}>
                        {latest.status}
                      </span>
                    )}
                  </div>

                  {project.customer && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                      <User className="h-3 w-3" />
                      <span className="truncate">{project.customer}</span>
                    </div>
                  )}
                  {project.address && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{project.address}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {project.project_type && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/50">
                        {project.project_type}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      <FileText className="h-3 w-3 inline mr-0.5" />
                      {project.quotationCount} {project.quotationCount === 1 ? 'quotation' : 'quotations'}
                    </span>
                  </div>
                </div>

                {latest && (
                  <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-200/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold text-slate-900 tabular-nums">
                          {formatCurrency(latest.total_amount / exchangeRate, 'USD')}
                        </div>
                        <span className="text-xs text-slate-400">Latest quotation</span>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="h-3 w-3" />
                          {formatDate(latest.quote_date)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>

      <NewProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleProjectCreated}
      />
    </>
  );
}
