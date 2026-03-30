import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil as Edit2, FileText, FolderOpen, Hammer, BarChart3,
  Plus, Calendar, Tag, User, MapPin, Check, Save, X, Copy, Trash2,
  Receipt, ClipboardList, Files, ScrollText
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { ImportQuotationModal } from '../components/ImportQuotationModal';
import { QuotationFormModal } from '../components/QuotationFormModal';
import { formatCurrency } from '../lib/calculations';
import { useSettingsStore } from '../lib/settingsStore';
import { ScheduleSection } from '../components/ScheduleSection';
import { TasksSection } from '../components/TasksSection';
import { DocumentationSection } from '../components/DocumentationSection';
import { BitacoraSection } from '../components/BitacoraSection';
import { CrossQuotationAnalytics } from '../components/CrossQuotationAnalytics';
import type { Project, Quotation, TeamMember } from '../types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const exchangeRate = useSettingsStore(s => s.settings.exchangeRateUsdToMxn);
  const fetchSettings = useSettingsStore(s => s.fetchSettings);

  const [project, setProject] = useState<Project | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [quotationAreas, setQuotationAreas] = useState<Record<string, { name: string; subtotal: number }[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'quotations' | 'management' | 'documents' | 'logs' | 'analytics'>('overview');

  // Overview editing
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', customer: '', address: '', project_type: '', status: '', project_details: '' });
  const [saving, setSaving] = useState(false);

  // Management
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [managementLoaded, setManagementLoaded] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [quotationModal, setQuotationModal] = useState<{ open: boolean; quotation?: Quotation }>({ open: false });

  useEffect(() => {
    if (!projectId) { navigate('/projects', { replace: true }); return; }
    loadProject();
    fetchSettings();
  }, [projectId]);

  useEffect(() => {
    if (activeTab === 'management' && !managementLoaded) {
      supabase.from('team_members').select('*').eq('is_active', true).order('display_order')
        .then(({ data }) => { setTeamMembers(data || []); setManagementLoaded(true); });
    }
  }, [activeTab, managementLoaded]);

  async function loadProject() {
    setLoading(true);
    const [{ data: proj, error: pErr }, { data: quots, error: qErr }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('quotations').select('*').eq('project_id', projectId).order('version_number', { ascending: true }),
    ]);

    if (pErr || !proj) { navigate('/projects', { replace: true }); return; }

    setProject(proj);
    setQuotations(quots || []);

    // Fetch areas for all quotations (for analytics)
    if (quots && quots.length > 0) {
      const quotIds = quots.map(q => q.id);
      const { data: allAreas } = await supabase
        .from('project_areas')
        .select('project_id, name, subtotal')
        .in('project_id', quotIds)
        .order('display_order');

      const areasByQuotation: Record<string, { name: string; subtotal: number }[]> = {};
      (allAreas || []).forEach(a => {
        if (!areasByQuotation[a.project_id]) areasByQuotation[a.project_id] = [];
        areasByQuotation[a.project_id].push({ name: a.name, subtotal: a.subtotal });
      });
      setQuotationAreas(areasByQuotation);
    }

    setEditForm({
      name: proj.name,
      customer: proj.customer || '',
      address: proj.address || '',
      project_type: proj.project_type || 'Custom',
      status: proj.status || 'Estimating',
      project_details: proj.project_details || '',
    });
    setLoading(false);
  }

  async function handleSaveOverview() {
    if (!projectId) return;
    setSaving(true);
    const { error } = await supabase.from('projects').update({
      name: editForm.name,
      customer: editForm.customer || null,
      address: editForm.address || null,
      project_type: editForm.project_type,
      status: editForm.status,
      project_details: editForm.project_details || null,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);

    if (error) { alert('Failed to save'); console.error(error); }
    else { await loadProject(); setEditing(false); }
    setSaving(false);
  }

  function handleNewQuotation() {
    setQuotationModal({ open: true });
  }

  function handleEditQuotation(q: Quotation) {
    setQuotationModal({ open: true, quotation: q });
  }

  async function handleDeleteQuotation(q: Quotation) {
    if (!confirm(`Delete quotation "${q.version_label || q.name}"? This will also delete all areas and cabinets.`)) return;
    const { error } = await supabase.from('quotations').delete().eq('id', q.id);
    if (error) { alert('Failed to delete quotation'); console.error(error); return; }
    loadProject();
  }

  async function handleDuplicate(quotation: Quotation) {
    if (!projectId || !project) return;
    if (!confirm(`Duplicate "${quotation.version_label || quotation.name}"?`)) return;

    const nextVersion = quotations.length + 1;
    const { id, created_at, updated_at, ...qData } = quotation;
    const { data, error } = await supabase.from('quotations').insert({
      ...qData,
      project_id: projectId,
      name: `${project.name} - ${quotation.version_label || 'Copy'} (Copy)`,
      version_label: `${quotation.version_label || 'v1'} (Copy)`,
      version_number: nextVersion,
      status: 'Estimating',
    }).select('id').single();

    if (error) { alert('Failed to duplicate'); console.error(error); return; }
    if (data) {
      // Copy areas and cabinets from source quotation
      const { data: srcAreas } = await supabase.from('project_areas').select('*').eq('project_id', quotation.id);
      if (srcAreas) {
        for (const area of srcAreas) {
          const { id: areaId, created_at: ac, updated_at: au, ...areaData } = area;
          const { data: newArea } = await supabase.from('project_areas').insert({ ...areaData, project_id: data.id }).select('id').single();
          if (!newArea) continue;

          const { data: srcCabs } = await supabase.from('area_cabinets').select('*').eq('area_id', areaId);
          if (srcCabs?.length) {
            const newCabs = srcCabs.map(({ id: cId, created_at: cc, updated_at: cu, ...cabData }) => ({
              ...cabData, area_id: newArea.id,
            }));
            await supabase.from('area_cabinets').insert(newCabs);
          }

          const { data: srcItems } = await supabase.from('area_items').select('*').eq('area_id', areaId);
          if (srcItems?.length) {
            const newItems = srcItems.map(({ id: iId, created_at: ic, updated_at: iu, ...itemData }) => ({
              ...itemData, area_id: newArea.id,
            }));
            await supabase.from('area_items').insert(newItems);
          }
        }
      }

      navigate(`/projects/${projectId}/quotations/${data.id}`);
    }
  }

  if (loading || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-slate-500 text-sm">Loading project...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: FolderOpen },
    { id: 'quotations' as const, label: 'Quotations', icon: Receipt },
    { id: 'management' as const, label: 'Management', icon: ClipboardList },
    { id: 'documents' as const, label: 'Documents', icon: Files },
    { id: 'logs' as const, label: 'Logs', icon: ScrollText },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  ];

  const statusColors: Record<string, string> = {
    Awarded: 'bg-green-50 text-green-700 border-green-200/50',
    Pending: 'bg-blue-50 text-blue-700 border-blue-200/50',
    Estimating: 'bg-amber-50 text-amber-700 border-amber-200/50',
    Sent: 'bg-cyan-50 text-cyan-700 border-cyan-200/50',
    Lost: 'bg-red-50 text-red-700 border-red-200/50',
    Disqualified: 'bg-slate-100 text-slate-600 border-slate-200/50',
    Cancelled: 'bg-slate-100 text-slate-500 border-slate-200/50',
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/projects')} className="flex-shrink-0 p-2 rounded-xl bg-white/60 hover:bg-white/80 border border-slate-200/50 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <button onClick={() => navigate('/projects')} className="hover:text-blue-600 transition-colors">Projects</button>
            <span>/</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-900 truncate">{project.name}</h1>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-slate-200 gap-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'quotations' && <span className="ml-1 text-xs bg-slate-100 px-1.5 py-0.5 rounded-full">{quotations.length}</span>}
            </button>
          );
        })}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Project Info</h3>
              {editing ? (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg hover:bg-slate-200/50 text-slate-400"><X className="h-4 w-4" /></button>
                  <button onClick={handleSaveOverview} disabled={saving} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600"><Save className="h-4 w-4" /></button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-slate-200/50 text-slate-400"><Edit2 className="h-4 w-4" /></button>
              )}
            </div>
            {editing ? (
              <div className="space-y-3">
                <div><label className="text-xs text-slate-500">Name</label><input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" /></div>
                <div><label className="text-xs text-slate-500">Customer</label><input value={editForm.customer} onChange={e => setEditForm({...editForm, customer: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" /></div>
                <div><label className="text-xs text-slate-500">Address</label><input value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-slate-500">Type</label>
                    <select value={editForm.project_type} onChange={e => setEditForm({...editForm, project_type: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg">
                      <option>Custom</option><option>Bids</option><option>Prefab</option><option>Stores</option>
                    </select>
                  </div>
                  <div><label className="text-xs text-slate-500">Status</label>
                    <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg">
                      <option>Estimating</option><option>Pending</option><option>Sent</option><option>Awarded</option><option>Lost</option><option>Disqualified</option><option>Cancelled</option>
                    </select>
                  </div>
                </div>
                <div><label className="text-xs text-slate-500">Details</label><textarea value={editForm.project_details} onChange={e => setEditForm({...editForm, project_details: e.target.value})} rows={3} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" /></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-slate-200/40"><span className="text-sm text-slate-500">Name</span><span className="text-sm font-medium text-slate-800">{project.name}</span></div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200/40"><span className="text-sm text-slate-500">Customer</span><span className="text-sm text-slate-800">{project.customer || '—'}</span></div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200/40"><span className="text-sm text-slate-500">Address</span><span className="text-sm text-slate-800 text-right max-w-[200px] truncate">{project.address || '—'}</span></div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200/40"><span className="text-sm text-slate-500">Type</span><span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{project.project_type}</span></div>
                <div className="flex items-center justify-between py-2"><span className="text-sm text-slate-500">Status</span><span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[project.status || ''] || 'bg-slate-100 text-slate-600'}`}>{project.status}</span></div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-2xl font-bold text-slate-900">{quotations.length}</div><span className="text-xs text-slate-500">Quotations</span></div>
                <div><div className="text-2xl font-bold text-slate-900">{quotations.filter(q => q.status === 'Awarded').length}</div><span className="text-xs text-slate-500">Awarded</span></div>
              </div>
            </div>
            <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Details</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{project.project_details || 'No details added yet.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quotations tab */}
      {activeTab === 'quotations' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">{quotations.length} Quotation{quotations.length !== 1 ? 's' : ''}</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setImportModalOpen(true)}>
                Import
              </Button>
              <Button size="sm" onClick={handleNewQuotation}>
                <Plus className="h-4 w-4 mr-1" />
                New Quotation
              </Button>
            </div>
          </div>
          {quotations.length === 0 ? (
            <div className="glass-white p-12 text-center">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">No quotations yet.</p>
              <Button onClick={handleNewQuotation}><Plus className="h-4 w-4 mr-2" />Create First Quotation</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {quotations.map((q) => (
                <div
                  key={q.id}
                  onClick={() => navigate(`/projects/${projectId}/quotations/${q.id}`)}
                  className="glass-white p-4 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
                        {q.version_number || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 truncate">{q.version_label || q.name}</span>
                          <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border ${statusColors[q.status] || 'bg-slate-100 text-slate-600 border-slate-200/50'}`}>{q.status}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(q.quote_date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(q.total_amount / exchangeRate, 'USD')}</div>
                        <div className="text-xs text-slate-400 tabular-nums">{formatCurrency(q.total_amount)}</div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDuplicate(q); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditQuotation(q); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteQuotation(q); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Management tab — Schedule + Tasks only */}
      {activeTab === 'management' && (
        <div className="space-y-6">
          <ScheduleSection projectId={project.id} />
          <TasksSection projectId={project.id} teamMembers={teamMembers} />
        </div>
      )}

      {/* Documents tab */}
      {activeTab === 'documents' && (
        <DocumentationSection projectId={project.id} />
      )}

      {/* Logs tab */}
      {activeTab === 'logs' && (
        <BitacoraSection projectId={project.id} />
      )}

      {/* Analytics tab */}
      {activeTab === 'analytics' && (
        <CrossQuotationAnalytics quotations={quotations} exchangeRate={exchangeRate} quotationAreas={quotationAreas} />
      )}

      <ImportQuotationModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        projectId={project.id}
        onSuccess={(quotationId) => {
          setImportModalOpen(false);
          navigate(`/projects/${project.id}/quotations/${quotationId}`);
        }}
      />

      <QuotationFormModal
        isOpen={quotationModal.open}
        onClose={() => setQuotationModal({ open: false })}
        projectId={projectId!}
        project={project}
        nextVersion={quotations.length + 1}
        quotation={quotationModal.quotation}
        onSuccess={(id) => {
          setQuotationModal({ open: false });
          if (!quotationModal.quotation) {
            navigate(`/projects/${projectId}/quotations/${id}`);
          } else {
            loadProject();
          }
        }}
      />
    </div>
  );
}
