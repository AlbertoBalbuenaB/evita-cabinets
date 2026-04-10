import { useState, useEffect } from 'react';
import {
  Link2,
  Trash2,
  Plus,
  HardDrive,
  Pencil,
  FileText,
  Sheet,
  Presentation,
  ClipboardList,
  Folder,
  File,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { useGooglePicker } from '../hooks/useGooglePicker';
import type { ProjectDocument } from '../types';

interface UrlMeta {
  Icon: LucideIcon;
  iconTileClass: string;
  typeLabel: string;
}

function getUrlMeta(url: string): UrlMeta {
  const u = url.toLowerCase();

  if (u.includes('docs.google.com/document/'))
    return { Icon: FileText, iconTileClass: 'bg-blue-50 text-blue-600', typeLabel: 'Google Docs' };
  if (u.includes('docs.google.com/spreadsheets/'))
    return { Icon: Sheet, iconTileClass: 'bg-emerald-50 text-emerald-600', typeLabel: 'Google Sheets' };
  if (u.includes('docs.google.com/presentation/'))
    return { Icon: Presentation, iconTileClass: 'bg-amber-50 text-amber-600', typeLabel: 'Google Slides' };
  if (u.includes('docs.google.com/forms/'))
    return { Icon: ClipboardList, iconTileClass: 'bg-purple-50 text-purple-600', typeLabel: 'Google Forms' };
  if (u.includes('drive.google.com/drive/folders/'))
    return { Icon: Folder, iconTileClass: 'bg-yellow-50 text-yellow-700', typeLabel: 'Drive Folder' };
  if (u.includes('drive.google.com/file/') || u.includes('drive.google.com/open'))
    return { Icon: File, iconTileClass: 'bg-slate-100 text-slate-600', typeLabel: 'Drive File' };
  if (u.endsWith('.pdf'))
    return { Icon: FileText, iconTileClass: 'bg-red-50 text-red-600', typeLabel: 'PDF' };

  return { Icon: Link2, iconTileClass: 'bg-slate-100 text-slate-500', typeLabel: 'Link' };
}

function getUrlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const { openPicker } = useGooglePicker();

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
        .insert(rows);
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

  async function updateDocument(
    id: string,
    changes: Partial<Pick<ProjectDocument, 'label' | 'url' | 'file_name'>>
  ) {
    const prev = [...documents];
    setDocuments((d) => d.map((x) => (x.id === id ? { ...x, ...changes } : x)));

    try {
      const { error } = await supabase
        .from('project_documents')
        .update(changes)
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating document:', error);
      setDocuments(prev);
    }
  }

  function saveManualUrl(doc: ProjectDocument, newUrlValue: string) {
    setEditingId(null);
    if (newUrlValue === doc.url) return;
    updateDocument(doc.id, { url: newUrlValue, file_name: null });
  }

  function pickForExistingRow(doc: ProjectDocument) {
    const wasEmpty = !doc.url;
    const isDefaultLabel = DEFAULT_DOCS.includes(doc.label);
    openPicker((file) => {
      const changes: Partial<Pick<ProjectDocument, 'label' | 'url' | 'file_name'>> = {
        url: file.url,
        file_name: file.name,
      };
      if (wasEmpty && isDefaultLabel) {
        changes.label = file.name;
      }
      updateDocument(doc.id, changes);
      setEditingId(null);
    });
  }

  function pickForNewRow() {
    openPicker(async (file) => {
      const optimistic: ProjectDocument = {
        id: crypto.randomUUID(),
        project_id: projectId,
        label: file.name,
        url: file.url,
        file_name: file.name,
        display_order: documents.length,
        created_at: new Date().toISOString(),
      };

      setDocuments((prev) => [...prev, optimistic]);

      try {
        const { data, error } = await supabase
          .from('project_documents')
          .insert({
            project_id: projectId,
            label: optimistic.label,
            url: optimistic.url,
            file_name: optimistic.file_name,
            display_order: optimistic.display_order,
          })
          .select()
          .single();
        if (error) throw error;
        setDocuments((prev) =>
          prev.map((d) => (d.id === optimistic.id ? data : d))
        );
      } catch (error) {
        console.error('Error adding document from Drive:', error);
        setDocuments((prev) => prev.filter((d) => d.id !== optimistic.id));
      }
    });
  }

  async function addDocument() {
    if (!newLabel.trim()) return;

    const optimistic: ProjectDocument = {
      id: crypto.randomUUID(),
      project_id: projectId,
      label: newLabel,
      url: newUrl,
      file_name: null,
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
          {documents.map((doc) => {
            const isEditing = editingId === doc.id;
            const showCard = !!doc.url && !isEditing;
            const meta = showCard ? getUrlMeta(doc.url) : null;
            const host = showCard ? getUrlHost(doc.url) : '';
            const primary = doc.file_name || doc.label;

            return (
              <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-2 group">
                <span className="text-sm font-medium text-slate-700 w-full sm:w-44 sm:flex-shrink-0 truncate">
                  {doc.label}
                </span>

                {showCard && meta ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-3 px-3 py-2 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition min-w-0"
                  >
                    <div className={`flex-shrink-0 h-9 w-9 rounded-md flex items-center justify-center ${meta.iconTileClass}`}>
                      <meta.Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{primary}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {meta.typeLabel}
                        {host && ` · ${host}`}
                      </div>
                    </div>
                  </a>
                ) : isEditing ? (
                  <input
                    type="url"
                    autoFocus
                    defaultValue={doc.url}
                    placeholder="Paste link here..."
                    onBlur={(e) => saveManualUrl(doc, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <input
                    type="url"
                    value={doc.url}
                    onChange={(e) =>
                      setDocuments((d) =>
                        d.map((x) => (x.id === doc.id ? { ...x, url: e.target.value } : x))
                      )
                    }
                    onBlur={(e) => saveManualUrl(doc, e.target.value)}
                    placeholder="Paste link here..."
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                <button
                  onClick={() => pickForExistingRow(doc)}
                  className="text-slate-400 hover:text-emerald-600 flex-shrink-0"
                  title="Pick from Google Drive"
                >
                  <HardDrive className="h-4 w-4" />
                </button>
                {showCard && (
                  <button
                    onClick={() => setEditingId(doc.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600 flex-shrink-0"
                    title="Edit URL"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 flex-shrink-0"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-3 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
          <div className="w-full sm:w-44">
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
          <Button onClick={pickForNewRow} variant="outline" size="sm">
            <HardDrive className="h-4 w-4 mr-1" />
            Link from Drive
          </Button>
        </div>
      </div>
    </div>
  );
}
