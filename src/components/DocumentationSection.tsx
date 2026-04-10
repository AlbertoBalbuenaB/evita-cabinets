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
  GripVertical,
  Check,
  X,
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

interface EditDraft {
  id: string;
  label: string;
  url: string;
}

export function DocumentationSection({ projectId }: Props) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
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

  function startEdit(doc: ProjectDocument) {
    setEditDraft({ id: doc.id, label: doc.label, url: doc.url });
  }

  async function saveEdit() {
    if (!editDraft) return;
    const doc = documents.find((d) => d.id === editDraft.id);
    if (!doc) {
      setEditDraft(null);
      return;
    }
    const trimmedLabel = editDraft.label.trim();
    const trimmedUrl = editDraft.url.trim();
    if (!trimmedLabel) return; // require a name

    const labelChanged = trimmedLabel !== doc.label;
    const urlChanged = trimmedUrl !== doc.url;
    if (!labelChanged && !urlChanged) {
      setEditDraft(null);
      return;
    }

    const changes: Partial<Pick<ProjectDocument, 'label' | 'url' | 'file_name'>> = {};
    if (labelChanged) changes.label = trimmedLabel;
    if (urlChanged) {
      changes.url = trimmedUrl;
      changes.file_name = null; // user-edited URL: drop the picked filename
    }

    setEditDraft(null);
    await updateDocument(editDraft.id, changes);
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
      setEditDraft(null);
    });
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    setDragOverId(null);
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }

    const dragIdx = documents.findIndex((d) => d.id === dragId);
    const targetIdx = documents.findIndex((d) => d.id === targetId);
    if (dragIdx === -1 || targetIdx === -1) {
      setDragId(null);
      return;
    }

    const reordered = [...documents];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    const updated = reordered.map((item, idx) => ({ ...item, display_order: idx }));

    const prev = [...documents];
    setDocuments(updated);
    setDragId(null);

    try {
      for (const item of updated) {
        const { error } = await supabase
          .from('project_documents')
          .update({ display_order: item.display_order })
          .eq('id', item.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error reordering documents:', error);
      setDocuments(prev);
    }
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
      <div className="glass-white p-5">
        <div className="animate-pulse h-6 bg-slate-100/60 rounded w-36" />
      </div>
    );
  }

  return (
    <div className="glass-white p-5">
      <div className="flex items-center mb-5">
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
            const isEditing = editDraft?.id === doc.id;
            const isDragging = dragId === doc.id;
            const isDropTarget = dragOverId === doc.id && dragId !== null && dragId !== doc.id;
            const hasUrl = !!doc.url;
            const meta = hasUrl ? getUrlMeta(doc.url) : null;
            const host = hasUrl ? getUrlHost(doc.url) : '';

            const cardClasses = [
              'group flex items-center gap-2 px-3 py-2.5',
              'bg-white/70 backdrop-blur-sm',
              'border border-white/90',
              'rounded-xl',
              'shadow-[0_1px_4px_rgba(99,102,241,0.05)]',
              'hover:bg-white/90 hover:border-white hover:shadow-[0_4px_14px_rgba(99,102,241,0.1)]',
              'transition-all duration-200',
              isDragging ? 'opacity-50' : '',
              isDropTarget ? 'ring-2 ring-blue-400/60 border-blue-300' : '',
              isEditing ? 'ring-2 ring-blue-400/40' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                key={doc.id}
                onDragOver={handleDragOver}
                onDragEnter={() => setDragOverId(doc.id)}
                onDragLeave={(e) => {
                  // Only clear if leaving the row itself, not crossing children
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverId(null);
                  }
                }}
                onDrop={(e) => handleDrop(e, doc.id)}
                className={cardClasses}
              >
                {/* Drag handle */}
                {!isEditing && (
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, doc.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOverId(null);
                    }}
                    className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-slate-100/80 transition-colors flex-shrink-0 opacity-30 group-hover:opacity-100"
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4 text-slate-400" />
                  </div>
                )}

                {/* Content */}
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <div
                      className={`flex-shrink-0 h-9 w-9 rounded-md flex items-center justify-center ${
                        meta ? meta.iconTileClass : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {meta ? <meta.Icon className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input
                        type="text"
                        value={editDraft.label}
                        onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') setEditDraft(null);
                        }}
                        placeholder="Name"
                        autoFocus
                        className="w-full px-2 py-1 text-sm font-semibold text-slate-900 bg-white/90 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="url"
                        value={editDraft.url}
                        onChange={(e) => setEditDraft({ ...editDraft, url: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') setEditDraft(null);
                        }}
                        placeholder="https://..."
                        className="w-full px-2 py-1 text-xs text-slate-600 bg-white/90 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ) : hasUrl && meta ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-3 min-w-0"
                  >
                    <div
                      className={`flex-shrink-0 h-9 w-9 rounded-md flex items-center justify-center ${meta.iconTileClass}`}
                    >
                      <meta.Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{doc.label}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {meta.typeLabel}
                        {host && ` · ${host}`}
                      </div>
                    </div>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(doc)}
                    className="flex-1 flex items-center gap-3 min-w-0 text-left"
                  >
                    <div className="flex-shrink-0 h-9 w-9 rounded-md flex items-center justify-center bg-slate-100/80 text-slate-400">
                      <Link2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{doc.label}</div>
                      <div className="text-xs text-slate-400 truncate italic">
                        No link yet — click to add
                      </div>
                    </div>
                  </button>
                )}

                {/* Actions */}
                {isEditing ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={saveEdit}
                      disabled={!editDraft.label.trim()}
                      className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Save"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditDraft(null)}
                      className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(doc)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit name & URL"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => pickForExistingRow(doc)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="Pick from Google Drive"
                    >
                      <HardDrive className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-4 border-t border-white/60">
        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
          <div className="w-full sm:w-44">
            <label className="block text-xs text-slate-600 mb-1">Name</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Document name"
              className="block w-full px-3 py-2 text-sm bg-white/80 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-600 mb-1">URL</label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
              className="block w-full px-3 py-2 text-sm bg-white/80 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addDocument();
              }}
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
