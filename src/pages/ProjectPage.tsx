import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Pencil as Edit2, FileText, FolderOpen, BarChart3,
  Plus, Calendar, Save, X, Copy, Trash2,
  Receipt, ClipboardList, Files, ScrollText, MoreVertical, TrendingUp,
  ArrowUpDown, Upload, ShoppingCart, Ruler,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { ImportQuotationModal } from '../components/ImportQuotationModal';
import { QuotationFormModal } from '../components/QuotationFormModal';
import { formatCurrency } from '../lib/calculations';
import { useSettingsStore } from '../lib/settingsStore';
import { TasksSection } from '../components/tasks/TasksSection';
import { DocumentationSection } from '../components/DocumentationSection';
import { BitacoraSection } from '../components/BitacoraSection';
import { CrossQuotationAnalytics } from '../components/CrossQuotationAnalytics';
import { PurchaseListSection } from '../components/purchases/PurchaseListSection';
import { TakeoffsSection } from '../components/takeoff/TakeoffsSection';
import type { Project, Quotation, TeamMember } from '../types';
import { useCurrentMember } from '../lib/useCurrentMember';
import { usePageChrome } from '../contexts/PageChromeContext';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso + 'T00:00:00').getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? 's' : ''} ago`;
}

const VALID_TABS = ['overview', 'quotations', 'purchases', 'management', 'documents', 'takeoffs', 'logs', 'analytics'] as const;
type TabKey = typeof VALID_TABS[number];

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { member: currentMember } = useCurrentMember();
  const exchangeRate = useSettingsStore(s => s.settings.exchangeRateUsdToMxn);
  const fetchSettings = useSettingsStore(s => s.fetchSettings);

  // Initial tab/task come from ?tab=…&task=… (e.g. deep-link from Home)
  const initialTab = (() => {
    const t = searchParams.get('tab');
    return (t && (VALID_TABS as readonly string[]).includes(t)) ? (t as TabKey) : 'overview';
  })();
  const initialTaskId = searchParams.get('task');

  const [project, setProject] = useState<Project | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [quotationAreas, setQuotationAreas] = useState<Record<string, { name: string; subtotal: number }[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Overview editing
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', customer: '', address: '', project_type: '', status: '', project_details: '' });
  const [saving, setSaving] = useState(false);

  // Management
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [managementLoaded, setManagementLoaded] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [quotationModal, setQuotationModal] = useState<{ open: boolean; quotation?: Quotation }>({ open: false });
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  usePageChrome(
    {
      title: project?.name ?? 'Project',
      crumbs: [
        { label: 'Projects', to: '/projects' },
        { label: project?.name ?? '…' },
      ],
    },
    [project?.id, project?.name],
  );

  useEffect(() => {
    if (!projectId) { navigate('/projects', { replace: true }); return; }
    loadProject();
    fetchSettings();
  }, [projectId]);

  useEffect(() => {
    if (activeTab !== 'management' || managementLoaded) return;
    let cancelled = false;
    supabase.from('team_members').select('id, name, role, is_active, display_order').eq('is_active', true).order('display_order')
      .then(({ data }) => { if (!cancelled) { setTeamMembers((data || []) as any); setManagementLoaded(true); } });
    return () => { cancelled = true; };
  }, [activeTab, managementLoaded]);

  useEffect(() => {
    if (!openMenuId) return;
    function handleClickOutside() { setOpenMenuId(null); }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  async function loadProject() {
    setLoading(true);
    const [{ data: proj, error: pErr }, { data: quots }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId ?? '').single(),
      supabase.from('quotations').select('*').eq('project_id', projectId ?? '').order('version_number', { ascending: true }),
    ]);

    if (pErr || !proj) { navigate('/projects', { replace: true }); return; }

    // Resolve last_modified member name if present
    if (proj.last_modified_by_member_id) {
      const { data: modMember } = await supabase.from('team_members').select('name').eq('id', proj.last_modified_by_member_id).single();
      if (modMember) (proj as Record<string, unknown>).last_modified_member_name = modMember.name;
    }

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
        areasByQuotation[a.project_id].push({ name: a.name, subtotal: a.subtotal ?? 0 });
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
      last_modified_by_member_id: currentMember?.id ?? null,
      last_modified_at: new Date().toISOString(),
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

    const maxVersion = quotations.reduce((max, q) => Math.max(max, q.version_number ?? 0), 0);
    const nextVersion = maxVersion + 1;
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
      // Copy areas and all child records from source quotation
      const { data: srcAreas } = await supabase.from('project_areas').select('*').eq('project_id', quotation.id);
      if (srcAreas?.length) {
        const srcAreaIds = srcAreas.map(a => a.id);

        // Batch-fetch all child records in parallel (avoids N+1)
        const [cabsRes, itemsRes, countertopsRes, closetItemsRes, sectionsRes] = await Promise.all([
          supabase.from('area_cabinets').select('*').in('area_id', srcAreaIds),
          supabase.from('area_items').select('*').in('area_id', srcAreaIds),
          supabase.from('area_countertops').select('*').in('area_id', srcAreaIds),
          supabase.from('area_closet_items').select('*').in('area_id', srcAreaIds),
          supabase.from('area_sections').select('*').in('area_id', srcAreaIds),
        ]);

        // Group by area_id for fast lookup
        const groupBy = <T extends { area_id: string }>(items: T[] | null) => {
          const map = new Map<string, T[]>();
          (items || []).forEach(item => {
            if (!map.has(item.area_id)) map.set(item.area_id, []);
            map.get(item.area_id)!.push(item);
          });
          return map;
        };
        const cabsByArea = groupBy(cabsRes.data);
        const itemsByArea = groupBy(itemsRes.data);
        const countertopsByArea = groupBy(countertopsRes.data);
        const closetItemsByArea = groupBy(closetItemsRes.data);
        const sectionsByArea = groupBy(sectionsRes.data);

        for (const area of srcAreas) {
          const { id: areaId, created_at: ac, updated_at: au, ...areaData } = area;
          const { data: newArea } = await supabase.from('project_areas').insert({ ...areaData, project_id: data.id }).select('id').single();
          if (!newArea) continue;

          const insertPromises: Promise<unknown>[] = [];

          const srcCabs = cabsByArea.get(areaId);
          if (srcCabs?.length) {
            const newCabs = srcCabs.map((c: any) => {
              const { id: cId, created_at: cc, updated_at: cu, ...cabData } = c;
              return { ...cabData, area_id: newArea.id };
            });
            insertPromises.push(supabase.from('area_cabinets').insert(newCabs) as unknown as Promise<unknown>);
          }

          const srcItems = itemsByArea.get(areaId);
          if (srcItems?.length) {
            const newItems = srcItems.map((i: any) => {
              const { id: iId, created_at: ic, updated_at: iu, ...itemData } = i;
              return { ...itemData, area_id: newArea.id };
            });
            insertPromises.push(supabase.from('area_items').insert(newItems) as unknown as Promise<unknown>);
          }

          const srcCountertops = countertopsByArea.get(areaId);
          if (srcCountertops?.length) {
            const newCountertops = srcCountertops.map((ct: any) => {
              const { id: ctId, created_at: ctc, updated_at: ctu, ...ctData } = ct;
              return { ...ctData, area_id: newArea.id };
            });
            insertPromises.push(supabase.from('area_countertops').insert(newCountertops) as unknown as Promise<unknown>);
          }

          const srcClosetItems = closetItemsByArea.get(areaId);
          if (srcClosetItems?.length) {
            const newClosetItems = srcClosetItems.map((ci: any) => {
              const { id: clId, created_at: clc, updated_at: clu, catalog_item: _ci, ...clData } = ci;
              return { ...clData, area_id: newArea.id };
            });
            insertPromises.push(supabase.from('area_closet_items').insert(newClosetItems) as unknown as Promise<unknown>);
          }

          const srcSections = sectionsByArea.get(areaId);
          if (srcSections?.length) {
            const newSections = srcSections.map((s: any) => {
              const { id: sId, created_at: sc, updated_at: su, ...sectionData } = s;
              return { ...sectionData, area_id: newArea.id };
            });
            insertPromises.push(supabase.from('area_sections').insert(newSections) as unknown as Promise<unknown>);
          }

          await Promise.all(insertPromises);
        }
      }

      navigate(`/projects/${projectId}/quotations/${data.id}`);
    }
  }

  if (loading || !project) {
    return (
      <div className="space-y-5 page-enter">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 skeleton-shimmer" />
          <div className="space-y-1.5">
            <div className="h-3 w-20 skeleton-shimmer" />
            <div className="h-6 w-56 skeleton-shimmer" />
          </div>
        </div>
        <div className="h-44 skeleton-shimmer" />
        <div className="flex gap-2">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-10 w-24 skeleton-shimmer" />)}
        </div>
        <div className="glass-white h-96 animate-pulse" />
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: FolderOpen },
    { id: 'quotations' as const, label: 'Quotations', icon: Receipt },
    { id: 'purchases' as const, label: 'Purchases', icon: ShoppingCart },
    { id: 'management' as const, label: 'Management', icon: ClipboardList },
    { id: 'documents' as const, label: 'Documents', icon: Files },
    { id: 'takeoffs' as const, label: 'Takeoffs', icon: Ruler },
    { id: 'logs' as const, label: 'Logs', icon: ScrollText },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  ];

  const statusColors: Record<string, string> = {
    Awarded: 'bg-status-emerald-bg text-status-emerald-fg border-status-emerald-brd',
    Pending: 'bg-accent-tint-soft text-accent-text border-accent-tint-border',
    Estimating: 'bg-status-amber-bg text-status-amber-fg border-status-amber-brd',
    Sent: 'bg-cyan-50 text-cyan-700 border-cyan-200/50',
    Lost: 'bg-status-red-bg text-status-red-fg border-status-red-brd',
    Discarded: 'bg-surf-muted text-fg-600 border-border-soft',
    Cancelled: 'bg-surf-muted text-fg-500 border-border-soft',
  };

  const latestQuotation = quotations.length > 0
    ? quotations.reduce((latest, q) => {
        const qDate = new Date(q.quote_date).getTime();
        const latestDate = new Date(latest.quote_date).getTime();
        if (qDate !== latestDate) return qDate > latestDate ? q : latest;
        const qUpd = new Date(q.updated_at ?? q.created_at ?? 0).getTime();
        const latestUpd = new Date(latest.updated_at ?? latest.created_at ?? 0).getTime();
        return qUpd > latestUpd ? q : latest;
      })
    : null;

  const sortedQuotations = [...quotations].sort((a, b) => {
    const dateA = new Date(a.quote_date).getTime();
    const dateB = new Date(b.quote_date).getTime();
    if (dateA !== dateB) return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    const updA = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const updB = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return sortOrder === 'desc' ? updB - updA : updA - updB;
  });

  const statusCounts: Record<string, number> = {};
  quotations.forEach(q => {
    if (q.status) statusCounts[q.status] = (statusCounts[q.status] || 0) + 1;
  });

  const excludedFromPipeline = new Set(['Lost', 'Discarded', 'Cancelled']);
  const pipelineTotal = quotations
    .filter(q => !excludedFromPipeline.has(q.status || ''))
    .reduce((sum, q) => sum + (q.total_amount || 0), 0);

  return (
    <>
    <div className="space-y-5 page-enter">
      {/* Page hero — back button + title + last-modified subtitle */}
      <div className="flex items-center gap-3 hero-enter">
        <button
          onClick={() => navigate('/projects')}
          className="flex-shrink-0 p-2 rounded-xl bg-surf-card hover:bg-surf-card border border-border-soft text-fg-600 hover:text-fg-800 transition-colors"
          aria-label="Back to projects"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-fg-900 truncate">{project.name}</h1>
          {Boolean((project as Record<string, unknown>).last_modified_at) && Boolean((project as Record<string, unknown>).last_modified_by_member_id) && (
            <p className="text-xs text-fg-400 mt-0.5">
              Last modified: {(project as Record<string, unknown>).last_modified_member_name as string || 'Unknown'} · {formatRelativeDate(((project as Record<string, unknown>).last_modified_at as string).split('T')[0])}
            </p>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-border-soft gap-1 overflow-x-auto scrollbar-none">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${active ? 'border-blue-600 text-accent-text' : 'border-transparent text-fg-500 hover:text-fg-800'}`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'quotations' && <span className="ml-1 text-xs bg-surf-muted px-1.5 py-0.5 rounded-full">{quotations.length}</span>}
            </button>
          );
        })}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surf-app border border-border-soft rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-fg-500 uppercase tracking-wide">Project Info</h3>
              {editing ? (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg hover:bg-surf-muted text-fg-400"><X className="h-4 w-4" /></button>
                  <button onClick={handleSaveOverview} disabled={saving} className="p-1.5 rounded-lg hover:bg-accent-tint-soft text-accent-text"><Save className="h-4 w-4" /></button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-surf-muted text-fg-400"><Edit2 className="h-4 w-4" /></button>
              )}
            </div>
            {editing ? (
              <div className="space-y-3">
                <div><label className="text-xs text-fg-500">Name</label><input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-border-soft rounded-lg" /></div>
                <div><label className="text-xs text-fg-500">Customer</label><input value={editForm.customer} onChange={e => setEditForm({...editForm, customer: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-border-soft rounded-lg" /></div>
                <div><label className="text-xs text-fg-500">Address</label><input value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-border-soft rounded-lg" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-fg-500">Type</label>
                    <select value={editForm.project_type} onChange={e => setEditForm({...editForm, project_type: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-border-soft rounded-lg">
                      <option>Custom</option><option>Bids</option><option>Prefab</option><option>Stores</option>
                    </select>
                  </div>
                  <div><label className="text-xs text-fg-500">Status</label>
                    <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-border-soft rounded-lg">
                      <option>Estimating</option><option>Pending</option><option>Sent</option><option>Awarded</option><option>Lost</option><option>Discarded</option><option>Cancelled</option>
                    </select>
                  </div>
                </div>
                <div><label className="text-xs text-fg-500">Details</label><textarea value={editForm.project_details} onChange={e => setEditForm({...editForm, project_details: e.target.value})} rows={3} className="w-full mt-1 px-3 py-2 text-sm border border-border-soft rounded-lg" /></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border-soft"><span className="text-sm text-fg-500">Name</span><span className="text-sm font-medium text-fg-800">{project.name}</span></div>
                <div className="flex items-center justify-between py-2 border-b border-border-soft"><span className="text-sm text-fg-500">Customer</span><span className="text-sm text-fg-800">{project.customer || '—'}</span></div>
                <div className="flex items-center justify-between py-2 border-b border-border-soft"><span className="text-sm text-fg-500">Address</span><span className="text-sm text-fg-800 text-right max-w-[200px] truncate">{project.address || '—'}</span></div>
                <div className="flex items-center justify-between py-2 border-b border-border-soft"><span className="text-sm text-fg-500">Type</span><span className="text-xs px-2 py-0.5 rounded-full bg-accent-tint-soft text-accent-text">{project.project_type}</span></div>
                <div className="flex items-center justify-between py-2"><span className="text-sm text-fg-500">Status</span><span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[project.status || ''] || 'bg-surf-muted text-fg-600'}`}>{project.status}</span></div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-surf-app border border-border-soft rounded-xl p-5">
              <h3 className="text-sm font-semibold text-fg-500 uppercase tracking-wide mb-3">Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-2xl font-bold text-fg-900">{quotations.length}</div><span className="text-xs text-fg-500">Quotations</span></div>
                <div><div className="text-2xl font-bold text-fg-900">{quotations.filter(q => q.status === 'Awarded').length}</div><span className="text-xs text-fg-500">Awarded</span></div>
              </div>
            </div>
            <div className="bg-surf-app border border-border-soft rounded-xl p-5">
              <h3 className="text-sm font-semibold text-fg-500 uppercase tracking-wide mb-3">Details</h3>
              <p className="text-sm text-fg-700 whitespace-pre-wrap">{project.project_details || 'No details added yet.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quotations tab */}
      {activeTab === 'quotations' && (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-semibold text-fg-900">
                {quotations.length} Quotation{quotations.length !== 1 ? 's' : ''}
              </h3>
              {quotations.length > 0 && pipelineTotal > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-fg-500">
                  <TrendingUp className="h-3.5 w-3.5 text-fg-400" />
                  Pipeline:{' '}
                  <span className="font-semibold text-fg-700">
                    {formatCurrency(pipelineTotal / exchangeRate, 'USD')}
                  </span>
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {quotations.length > 1 && (
                <button
                  onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-fg-500 hover:text-fg-700 bg-surf-card border border-border-soft rounded-lg hover:bg-surf-app transition-colors"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
                </button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setImportModalOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                Import
              </Button>
              <Button size="sm" onClick={handleNewQuotation}>
                <Plus className="h-4 w-4 mr-1" />
                New Quotation
              </Button>
            </div>
          </div>

          {/* Status summary pills */}
          {quotations.length > 0 && Object.keys(statusCounts).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(statusCounts).map(([status, count]) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border ${statusColors[status] || 'bg-surf-muted text-fg-600 border-border-soft'}`}
                >
                  {count} {status}
                </span>
              ))}
            </div>
          )}

          {quotations.length === 0 ? (
            <div className="glass-white p-12 text-center">
              <FileText className="h-12 w-12 text-fg-300 mx-auto mb-4" />
              <p className="text-base font-medium text-fg-700 mb-1">No quotations yet</p>
              <p className="text-sm text-fg-400 mb-6">Start by creating your first quotation or importing an existing one.</p>
              <div className="flex items-center justify-center gap-3">
                <Button onClick={handleNewQuotation}>
                  <Plus className="h-4 w-4 mr-2" />New Quotation
                </Button>
                <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />Import
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedQuotations.map((q) => {
                const isLatest = q.id === latestQuotation?.id;
                const marginPct = q.profit_multiplier != null && q.profit_multiplier > 0
                  ? Math.round(q.profit_multiplier * 100)
                  : null;
                const isMenuOpen = openMenuId === q.id;

                return (
                  <div
                    key={q.id}
                    onClick={() => navigate(`/projects/${projectId}/quotations/${q.id}`)}
                    className={`glass-white p-4 cursor-pointer hover:shadow-md hover:border-accent-tint-border transition-all ${isLatest ? 'border-l-4 border-l-blue-400' : ''} ${isMenuOpen ? 'relative z-10' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: version badge + info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${isLatest ? 'bg-blue-600 text-white' : 'bg-accent-tint-soft text-accent-text'}`}>
                          {q.version_number || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-fg-900 truncate">{q.version_label || q.name}</span>
                            <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border ${statusColors[q.status || ''] || 'bg-surf-muted text-fg-600 border-border-soft'}`}>{q.status}</span>
                            {isLatest && (
                              <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-status-emerald-bg text-status-emerald-fg border border-status-emerald-brd font-medium">Latest</span>
                            )}
                            {marginPct !== null && (
                              <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-surf-muted text-fg-500 border border-border-soft">
                                {marginPct}% margin
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-fg-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(q.quote_date)}
                            </span>
                            <span className="text-fg-300">·</span>
                            <span>{formatRelativeDate(q.quote_date)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: amounts + kebab menu */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-bold text-fg-900 tabular-nums">{formatCurrency((q.total_amount || 0) / exchangeRate, 'USD')}</div>
                          <div className="text-xs text-fg-400 tabular-nums">{formatCurrency(q.total_amount || 0)}</div>
                        </div>

                        {/* Kebab menu */}
                        <div className="relative" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setOpenMenuId(isMenuOpen ? null : q.id)}
                            className="p-1.5 rounded-lg text-fg-400 hover:text-fg-700 hover:bg-surf-muted transition-colors"
                            title="More options"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-9 z-50 w-44 bg-surf-card rounded-xl shadow-lg border border-border-soft py-1 text-sm">
                              <button
                                onClick={() => { setOpenMenuId(null); navigate(`/projects/${projectId}/quotations/${q.id}`); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-fg-700 hover:bg-accent-tint-soft hover:text-accent-text transition-colors"
                              >
                                <FileText className="h-3.5 w-3.5" />View Details
                              </button>
                              <button
                                onClick={() => { setOpenMenuId(null); handleDuplicate(q); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-fg-700 hover:bg-surf-app transition-colors"
                              >
                                <Copy className="h-3.5 w-3.5" />Duplicate
                              </button>
                              <button
                                onClick={() => { setOpenMenuId(null); handleEditQuotation(q); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-fg-700 hover:bg-surf-app transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" />Edit
                              </button>
                              <div className="border-t border-border-soft my-1" />
                              <button
                                onClick={() => { setOpenMenuId(null); handleDeleteQuotation(q); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-status-red-fg hover:bg-status-red-bg transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Purchases tab */}
      {activeTab === 'purchases' && (
        <PurchaseListSection projectId={project.id} />
      )}

      {/* Management tab — Tasks */}
      {activeTab === 'management' && (
        <TasksSection projectId={project.id} teamMembers={teamMembers} initialTaskId={initialTaskId} />
      )}

      {/* Documents tab */}
      {activeTab === 'documents' && (
        <DocumentationSection projectId={project.id} />
      )}

      {/* Takeoffs tab */}
      {activeTab === 'takeoffs' && (
        <TakeoffsSection projectId={project.id} />
      )}

      {/* Logs tab */}
      {activeTab === 'logs' && (
        <BitacoraSection projectId={project.id} />
      )}

      {/* Analytics tab */}
      {activeTab === 'analytics' && (
        <CrossQuotationAnalytics quotations={quotations} exchangeRate={exchangeRate} quotationAreas={quotationAreas} />
      )}
    </div>

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
    </>
  );
}
