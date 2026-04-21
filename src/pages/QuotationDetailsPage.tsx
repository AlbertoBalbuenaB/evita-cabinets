import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ProjectDetails, type QuotationTab } from './ProjectDetails';
import { usePageChrome } from '../contexts/PageChromeContext';
import type { Quotation, Project } from '../types';

const TAB_DEFS: Array<{ id: QuotationTab; label: string }> = [
  { id: 'info',      label: 'Info' },
  { id: 'pricing',   label: 'Pricing' },
  { id: 'cutlist',   label: 'Breakdown' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'history',   label: 'History' },
];

export function QuotationDetailsPage() {
  const { projectId, quotationId } = useParams<{ projectId: string; quotationId: string }>();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [parentProject, setParentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<QuotationTab>('info');

  useEffect(() => {
    if (!quotationId) { navigate('/projects', { replace: true }); return; }

    async function load() {
      const [{ data: qData, error: qErr }, { data: pData }] = await Promise.all([
        supabase.from('quotations').select('*').eq('id', quotationId ?? '').single(),
        projectId
          ? supabase.from('projects').select('*').eq('id', projectId).single()
          : Promise.resolve({ data: null }),
      ]);

      if (qErr || !qData) {
        navigate(projectId ? `/projects/${projectId}` : '/projects', { replace: true });
        return;
      }
      setQuotation(qData);
      setParentProject(pData);
      setLoading(false);
    }

    load();
  }, [quotationId, projectId, navigate]);

  // Build the tabs for the global Topbar. `onClick` closes over `setActiveTab`,
  // so it stays stable as long as the id list is.
  const chromeTabs = useMemo(
    () =>
      TAB_DEFS.map((t) => ({
        id: t.id,
        label: t.label,
        onClick: () => setActiveTab(t.id),
      })),
    [],
  );

  const variantName =
    quotation?.version_label || quotation?.name || 'Quote';
  const titleProject = parentProject?.name ?? '';

  usePageChrome(
    {
      title: titleProject ? `${titleProject} · ${variantName}` : variantName,
      // ProjectHeader renders its own identity (back button + project /
      // variant title). Suppress the Topbar's crumb strip so the two
      // don't duplicate the same information.
      hideCrumbs: true,
      tabs: chromeTabs,
      activeTabId: activeTab,
    },
    [
      parentProject?.id,
      parentProject?.name,
      quotation?.id,
      quotation?.name,
      quotation?.version_label,
      activeTab,
      chromeTabs,
    ],
  );

  if (loading || !quotation) {
    return (
      <div className="space-y-5 page-enter">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 skeleton-shimmer" />
          <div className="space-y-1.5">
            <div className="h-3 w-20 skeleton-shimmer" />
            <div className="h-6 w-48 skeleton-shimmer" />
          </div>
        </div>
        <div className="h-48 skeleton-shimmer" />
        <div className="glass-white h-96 animate-pulse" />
      </div>
    );
  }

  return (
    <ProjectDetails
      project={quotation}
      parentProject={parentProject}
      onBack={() => navigate(projectId ? `/projects/${projectId}` : '/projects')}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
    />
  );
}
