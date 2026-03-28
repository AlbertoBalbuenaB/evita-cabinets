import { useState, useEffect } from 'react';
import { Link2, Trash2, Plus, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import type { ProjectDocument } from '../types';

interface Props {
  projectId: string;
}

const DEFAULT_DOCS = [
  'Google Drive',
  'Elevations',
  'Renders',
  'Pricing',
  'BOM (Bill of Materials)',
  'Shopping List',
  'Production / Cut List',
];

export function DocumentationSection({ projectId }: Props) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  async function loadDocuments() {
    try {
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('display_order');

      if (error) throw error;

      if (!data || data.length === 0) {
        await seedDefaults();
        return;
      }

      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function seedDefaults() {
    try {
      const rows = DEFAULT_DOCS.map((label, i) => ({
        project_id: projectId,
        label,
        url: '',
        display_order: i,
      }));

      const { error } = await supabase
        .from('project_documents')
        .upsert(rows, { onConflict: 'project_id,label', ignoreDuplicates: true });
      if (error) throw error;

      const { data, error: fetchError } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('display_order');

      if (fetchError) throw fetchError;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error seeding default documents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateUrl(id: string, url: string) {
    const prev = [...documents];
    setDocuments((d) => d.map((x) => (x.id === id ? { ...x, url } : x)));

    try {
      const { error } = await supabase
        .from('project_documents')
        .update({ url })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating document URL:', error);
      setDocuments(prev);
    }
  }

  async function addDocument() {
    if (!newLabel.trim()) return;

    const optimistic: ProjectDocument = {
      id: crypto.randomUUID(),
      project_id: projectId,
      label: newLabel,
      url: newUrl,
      display_order: documents.length,
      created_at: new Date().toISOString(),
    };

    setDocuments((prev) => [...prev, optimistic]);
    setNewLabel('');
    setNewUrl('');

    try {
      const { data, error } = await supabase
        .from('project_documents')
        .insert({
          project_id: projectId,
          label: optimistic.label,
          url: optimistic.url,
          display_order: optimistic.display_order,
        })
        .select()
        .single();
      if (error) throw error;
      setDocuments((prev) =>
        prev.map((d) => (d.id === optimistic.id ? data : d))
      );
    } catch (error) {
      console.error('Error adding document:', error);
      setDocuments((prev) => prev.filter((d) => d.id !== optimistic.id));
    }
  }

  async function deleteDocument(id: string) {
    const prev = [...documents];
    setDocuments((d) => d.filter((x) => x.id !== id));

    try {
      const { error } = await supabase.from('project_documents').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting document:', error);
      setDocuments(prev);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="animate-pulse h-6 bg-slate-100 rounded w-36" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center mb-4">
        <Link2 className="h-5 w-5 text-sky-600 mr-2" />
        <h3 className="text-lg font-semibold text-slate-900">Documentation</h3>
      </div>

      {documents.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <Link2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No documents linked yet</p>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 group">
              <span className="text-sm font-medium text-slate-700 w-44 flex-shrink-0 truncate">
                {doc.label}
              </span>
              <input
                type="url"
                value={doc.url}
                onChange={(e) =>
                  setDocuments((d) =>
                    d.map((x) => (x.id === doc.id ? { ...x, url: e.target.value } : x))
                  )
                }
                onBlur={(e) => updateUrl(doc.id, e.target.value)}
                placeholder="Paste link here..."
                className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => doc.url && window.open(doc.url, '_blank', 'noopener')}
                disabled={!doc.url}
                className="text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                title="Open link"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              <button
                onClick={() => deleteDocument(doc.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 flex-shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-slate-200">
        <div className="flex items-end gap-2">
          <div className="w-44">
            <label className="block text-xs text-slate-600 mb-1">Label</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Document name"
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-600 mb-1">URL</label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => { if (e.key === 'Enter') addDocument(); }}
            />
          </div>
          <Button onClick={addDocument} disabled={!newLabel.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Link
          </Button>
        </div>
      </div>
    </div>
  );
}
