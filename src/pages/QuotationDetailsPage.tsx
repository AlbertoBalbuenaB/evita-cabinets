import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ProjectDetails } from './ProjectDetails';
import type { Quotation, Project } from '../types';

export function QuotationDetailsPage() {
  const { projectId, quotationId } = useParams<{ projectId: string; quotationId: string }>();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [parentProject, setParentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!quotationId) { navigate('/projects', { replace: true }); return; }

    async function load() {
      const [{ data: qData, error: qErr }, { data: pData }] = await Promise.all([
        supabase.from('quotations').select('*').eq('id', quotationId).single(),
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
    />
  );
}
