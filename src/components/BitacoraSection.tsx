import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScrollText, Trash2, Pencil, X, Check, Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, CheckCircle2, AlertTriangle, Star, Lightbulb,
  ArrowRightCircle, Filter, Clock
} from 'lucide-react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { format } from 'date-fns';
import type { ProjectLog } from '../types';

// ---------------------------------------------------------------------------
// Log type system
// ---------------------------------------------------------------------------

type LogType = 'note' | 'change_request' | 'approved_change' | 'decision' | 'error' | 'achievement';

interface LogTypeConfig {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  color: string;
  bg: string;
  border: string;
  badgeBg: string;
}

const LOG_TYPES: Record<LogType, LogTypeConfig> = {
  note:            { label: 'Nota',              Icon: ScrollText,       color: 'text-slate-600',   bg: 'bg-slate-50',    border: 'border-slate-300',  badgeBg: 'bg-slate-100' },
  change_request:  { label: 'Cambio Solicitado', Icon: ArrowRightCircle, color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-400',   badgeBg: 'bg-blue-100'  },
  approved_change: { label: 'Cambio Aprobado',   Icon: CheckCircle2,     color: 'text-green-600',   bg: 'bg-green-50',    border: 'border-green-400',  badgeBg: 'bg-green-100' },
  decision:        { label: 'Decisión',          Icon: Lightbulb,        color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-400',  badgeBg: 'bg-amber-100' },
  error:           { label: 'Error',             Icon: AlertTriangle,    color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-400',    badgeBg: 'bg-red-100'   },
  achievement:     { label: 'Acierto',           Icon: Star,             color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-400',badgeBg: 'bg-emerald-100'},
};

const LOG_TYPE_ORDER: LogType[] = ['note', 'change_request', 'approved_change', 'decision', 'error', 'achievement'];

// ---------------------------------------------------------------------------
// Mention item types
// ---------------------------------------------------------------------------

interface MentionItem {
  id: string;   // encoded: "project:{uuid}" | "quotation:{projectId}:{id}" | "cabinet:{sku}" | "price_item:{id}"
  label: string;
  typeLabel: string;
  typeBadgeClass: string;
}

function mentionToUrl(id: string): string {
  const parts = id.split(':');
  const type = parts[0];
  if (type === 'project')     return `/projects/${parts[1]}`;
  if (type === 'quotation')   return `/projects/${parts[1]}`;   // parts[1]=projectId
  if (type === 'cabinet')     return `/price-list`;
  if (type === 'price_item')  return `/price-list`;
  return '#';
}

// ---------------------------------------------------------------------------
// Rich-text helpers
// ---------------------------------------------------------------------------

function isRichContent(comment: string): boolean {
  try {
    const parsed = JSON.parse(comment);
    return parsed && parsed.type === 'doc';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Mention suggestion list component (rendered by tippy)
// ---------------------------------------------------------------------------

interface SuggestionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

function SuggestionList({ items, command }: SuggestionListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) command(item);
    },
    [items, command]
  );

  // Expose keyboard nav via a ref on the container
  // (tippy calls onKeyDown on the renderer)
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden w-72 max-h-64 overflow-y-auto">
      {items.length === 0 ? (
        <div className="px-3 py-2 text-xs text-slate-400">Sin resultados</div>
      ) : (
        items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors ${
              index === selectedIndex ? 'bg-blue-50' : 'hover:bg-slate-50'
            }`}
          >
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${item.typeBadgeClass} flex-shrink-0`}>
              {item.typeLabel}
            </span>
            <span className="text-slate-800 truncate">{item.label}</span>
          </button>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build TipTap mention suggestion config
// ---------------------------------------------------------------------------

function buildMentionSuggestion(allItems: MentionItem[]) {
  return {
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      return allItems
        .filter((item) => item.label.toLowerCase().includes(q))
        .slice(0, 10);
    },

    render: () => {
      let reactRenderer: ReactRenderer<unknown>;
      let popup: TippyInstance[];

      return {
        onStart: (props: SuggestionProps) => {
          reactRenderer = new ReactRenderer(SuggestionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: reactRenderer.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },

        onUpdate: (props: SuggestionProps) => {
          reactRenderer.updateProps(props);
          if (!props.clientRect) return;
          popup[0].setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },

        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === 'Escape') {
            popup[0].hide();
            return true;
          }
          // Forward to the list component via the renderer element's dataset
          return false;
        },

        onExit: () => {
          popup[0].destroy();
          reactRenderer.destroy();
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Custom Mention extension with link rendering in view mode
// ---------------------------------------------------------------------------

function buildMentionExtension(mentionItems: MentionItem[], viewMode = false) {
  return Mention.configure({
    HTMLAttributes: {
      class: viewMode ? 'mention-link' : 'mention',
    },
    renderHTML({ node }) {
      const id = node.attrs.id as string;
      const label = node.attrs.label as string;
      if (viewMode) {
        const url = mentionToUrl(id);
        return ['a', { href: url, class: 'mention-link', 'data-mention-id': id }, `@${label}`];
      }
      return ['span', { class: 'mention', 'data-mention-id': id }, `@${label}`];
    },
    suggestion: viewMode ? undefined : buildMentionSuggestion(mentionItems),
  });
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

interface ToolbarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
}

function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const btn = (
    active: boolean,
    onClick: () => void,
    Icon: React.ElementType,
    title: string
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-slate-200 text-slate-900'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg">
      {btn(editor.isActive('bold'),      () => editor.chain().focus().toggleBold().run(),          Bold,         'Negrita (Ctrl+B)')}
      {btn(editor.isActive('italic'),    () => editor.chain().focus().toggleItalic().run(),        Italic,       'Cursiva (Ctrl+I)')}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(),     UnderlineIcon,'Subrayado (Ctrl+U)')}
      <div className="w-px h-4 bg-slate-300 mx-1" />
      {btn(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  List,         'Lista con viñetas')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered,  'Lista numerada')}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LogEntry — renders a single log entry (read-only) using TipTap
// ---------------------------------------------------------------------------

interface LogEntryProps {
  log: ProjectLog;
  mentionItems: MentionItem[];
  onEdit: () => void;
  onDelete: () => void;
}

function LogEntry({ log, mentionItems, onEdit, onDelete }: LogEntryProps) {
  const navigate = useNavigate();
  const logType = (log.log_type as LogType) || 'note';
  const cfg = LOG_TYPES[logType] || LOG_TYPES.note;
  const { Icon } = cfg;

  const isRich = isRichContent(log.comment);

  // Build a read-only TipTap instance to render rich content
  const viewEditor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      buildMentionExtension(mentionItems, true),
    ],
    content: isRich ? JSON.parse(log.comment) : { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: log.comment }] }] },
    editable: false,
  }, [log.comment]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a.mention-link') as HTMLAnchorElement | null;
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href) navigate(href);
    }
  }

  function formatTimestamp(ts: string | null): string {
    if (!ts) return '';
    try {
      return format(new Date(ts), "d MMM yyyy · h:mm a");
    } catch {
      return ts;
    }
  }

  return (
    <div className={`group relative rounded-lg border-l-4 ${cfg.border} ${cfg.bg} border border-slate-200/60 p-4 transition-shadow hover:shadow-sm`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.color}`}>
          <Icon className="h-3 w-3" />
          {cfg.label}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimestamp(log.created_at)}
            </p>
            {log.updated_at && (
              <p className="text-[10px] text-slate-400 italic">editado</p>
            )}
          </div>
          {/* Action buttons — revealed on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-white/80"
              title="Editar entrada"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-white/80"
              title="Eliminar entrada"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Rich content */}
      <div
        className="bitacora-content text-sm text-slate-700 cursor-text"
        onClick={handleClick}
      >
        <EditorContent editor={viewEditor} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit / Create form
// ---------------------------------------------------------------------------

interface EntryFormProps {
  mentionItems: MentionItem[];
  initialContent?: string;
  initialType?: LogType;
  saving: boolean;
  onSave: (content: string, logType: LogType) => void;
  onCancel?: () => void;
  isEdit?: boolean;
}

function EntryForm({ mentionItems, initialContent, initialType = 'note', saving, onSave, onCancel, isEdit }: EntryFormProps) {
  const [logType, setLogType] = useState<LogType>(initialType);

  const startContent = initialContent && isRichContent(initialContent)
    ? JSON.parse(initialContent)
    : initialContent
      ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: initialContent }] }] }
      : '';

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      Placeholder.configure({ placeholder: 'Agrega una observación, cambio, decisión... Usa @ para referenciar proyectos, cotizaciones o productos.' }),
      buildMentionExtension(mentionItems, false),
    ],
    content: startContent,
  });

  function handleSave() {
    if (!editor) return;
    const json = editor.getJSON();
    // Check if there's actual text content
    const text = editor.getText().trim();
    if (!text) return;
    onSave(JSON.stringify(json), logType);
    if (!isEdit) {
      editor.commands.clearContent();
      setLogType('note');
    }
  }

  const isEmpty = !editor || editor.getText().trim() === '';

  return (
    <div className="space-y-3">
      {/* Log type selector */}
      <div className="flex flex-wrap gap-1.5">
        {LOG_TYPE_ORDER.map((type) => {
          const cfg = LOG_TYPES[type];
          const { Icon } = cfg;
          const isActive = logType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setLogType(type)}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                isActive
                  ? `${cfg.badgeBg} ${cfg.color} ${cfg.border} font-semibold`
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              <Icon className="h-3 w-3" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <div className="border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        <Toolbar editor={editor} />
        <div
          className="px-3 py-2 min-h-[80px] text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Ctrl+Enter para guardar · @ para referenciar</p>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancelar
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={isEmpty || saving}>
            {saving ? 'Guardando...' : isEdit ? (
              <><Check className="h-3.5 w-3.5 mr-1" />Guardar</>
            ) : (
              'Agregar Entrada'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  projectId: string;
}

export function BitacoraSection({ projectId }: Props) {
  const [logs, setLogs] = useState<ProjectLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<LogType | 'all'>('all');
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const mentionItemsRef = useRef<MentionItem[]>([]);

  // Load mention candidates once
  useEffect(() => {
    async function loadMentions() {
      const [{ data: projects }, { data: quotations }, { data: cabinets }, { data: priceItems }] = await Promise.all([
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('quotations').select('id, name, project_id').order('name'),
        supabase.from('products_catalog').select('sku, description').order('description'),
        supabase.from('price_list').select('id, concept_description').eq('is_active', true).order('concept_description'),
      ]);

      const items: MentionItem[] = [
        ...(projects || []).map((p) => ({
          id: `project:${p.id}`,
          label: p.name,
          typeLabel: 'Proyecto',
          typeBadgeClass: 'bg-violet-100 text-violet-700',
        })),
        ...(quotations || []).map((q) => ({
          id: `quotation:${q.project_id}:${q.id}`,
          label: q.name,
          typeLabel: 'Cotización',
          typeBadgeClass: 'bg-blue-100 text-blue-700',
        })),
        ...(cabinets || []).map((c) => ({
          id: `cabinet:${c.sku}`,
          label: `${c.sku} — ${c.description}`,
          typeLabel: 'Gabinete',
          typeBadgeClass: 'bg-amber-100 text-amber-700',
        })),
        ...(priceItems || []).map((i) => ({
          id: `price_item:${i.id}`,
          label: i.concept_description,
          typeLabel: 'Precio',
          typeBadgeClass: 'bg-green-100 text-green-700',
        })),
      ];

      mentionItemsRef.current = items;
      setMentionItems(items);
    }

    loadMentions().catch(console.error);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [projectId]);

  async function loadLogs() {
    try {
      const { data, error } = await supabase
        .from('project_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error loading logs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function addLog(content: string, logType: LogType) {
    if (saving) return;
    setSaving(true);

    const optimistic: ProjectLog = {
      id: crypto.randomUUID(),
      project_id: projectId,
      comment: content,
      log_type: logType,
      created_at: new Date().toISOString(),
      updated_at: null,
    };

    setLogs((prev) => [optimistic, ...prev]);

    try {
      const { error } = await supabase.from('project_logs').insert({
        project_id: projectId,
        comment: content,
        log_type: logType,
      });
      if (error) throw error;
      loadLogs();
    } catch (err) {
      console.error('Error adding log:', err);
      setLogs((prev) => prev.filter((l) => l.id !== optimistic.id));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(logId: string, content: string, logType: LogType) {
    const prev = [...logs];
    setLogs((l) =>
      l.map((x) => x.id === logId ? { ...x, comment: content, log_type: logType, updated_at: new Date().toISOString() } : x)
    );
    setEditingId(null);

    try {
      const { error } = await supabase
        .from('project_logs')
        .update({ comment: content, log_type: logType, updated_at: new Date().toISOString() })
        .eq('id', logId);
      if (error) throw error;
    } catch (err) {
      console.error('Error updating log:', err);
      setLogs(prev);
    }
  }

  async function deleteLog(id: string) {
    const prev = [...logs];
    setLogs((l) => l.filter((x) => x.id !== id));
    try {
      const { error } = await supabase.from('project_logs').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error deleting log:', err);
      setLogs(prev);
    }
  }

  const filteredLogs = filterType === 'all' ? logs : logs.filter((l) => (l.log_type || 'note') === filterType);
  const editingLog = editingId ? logs.find((l) => l.id === editingId) : null;

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <div className="animate-pulse h-6 bg-slate-100 rounded w-40" />
        <div className="animate-pulse h-24 bg-slate-100 rounded" />
        <div className="animate-pulse h-20 bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-amber-600" />
        <h3 className="text-lg font-semibold text-slate-900">Bitácora del Proyecto</h3>
        {logs.length > 0 && (
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {logs.length} {logs.length === 1 ? 'entrada' : 'entradas'}
          </span>
        )}
      </div>

      {/* New entry form */}
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
        <EntryForm
          mentionItems={mentionItems}
          saving={saving}
          onSave={addLog}
        />
      </div>

      {/* Filter bar */}
      {logs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <button
            onClick={() => setFilterType('all')}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              filterType === 'all'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            Todas ({logs.length})
          </button>
          {LOG_TYPE_ORDER.map((type) => {
            const count = logs.filter((l) => (l.log_type || 'note') === type).length;
            if (count === 0) return null;
            const cfg = LOG_TYPES[type];
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filterType === type
                    ? `${cfg.badgeBg} ${cfg.color} ${cfg.border} font-semibold`
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Log entries */}
      {filteredLogs.length === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{filterType === 'all' ? 'No hay entradas aún' : 'No hay entradas de este tipo'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) =>
            editingId === log.id && editingLog ? (
              <div key={log.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50/30">
                <p className="text-xs text-slate-400 mb-3">Editando entrada</p>
                <EntryForm
                  mentionItems={mentionItems}
                  initialContent={log.comment}
                  initialType={(log.log_type as LogType) || 'note'}
                  saving={saving}
                  onSave={(content, type) => saveEdit(log.id, content, type)}
                  onCancel={() => setEditingId(null)}
                  isEdit
                />
              </div>
            ) : (
              <LogEntry
                key={log.id}
                log={log}
                mentionItems={mentionItems}
                onEdit={() => setEditingId(log.id)}
                onDelete={() => deleteLog(log.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
