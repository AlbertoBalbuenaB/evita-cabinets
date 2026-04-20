import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import { supabase } from '../../lib/supabase';
import { useTakeoffStore } from '../../hooks/useTakeoffStore';
import { saveSessionToSupabase } from '../../lib/takeoff/supabase';

interface ProjectOption {
  id: string;
  name: string;
}

interface SaveSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  // Pre-fill project selector (e.g. when opened from a project page). If the caller wants to
  // force the session to be linked to this project, pass lockProject=true.
  defaultProjectId?: string | null;
  lockProject?: boolean;
  onSaved?: (sessionId: string, name: string, projectId: string | null) => void;
}

export function SaveSessionModal({ isOpen, onClose, file, defaultProjectId, lockProject, onSaved }: SaveSessionModalProps) {
  const store = useTakeoffStore();
  const { currentSessionId, sessionName, sessionProjectId, pdfDirty, getSessionData, setCurrentSession, setPdfDirty } = store;
  const existingSessionId = currentSessionId;

  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Initial fields
    setName(sessionName ?? file?.name?.replace(/\.[^.]+$/, '') ?? '');
    setProjectId(existingSessionId ? sessionProjectId : (defaultProjectId ?? null));
    setError(null);
    // Fetch projects once per open
    let cancelled = false;
    setProjectsLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name', { ascending: true });
      if (!cancelled) {
        if (error) setError(`Could not load projects: ${error.message}`);
        setProjects((data ?? []) as ProjectOption[]);
        setProjectsLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Name is required.'); return; }
    if (!existingSessionId && !file) { setError('PDF file is required for a new session.'); return; }
    setSaving(true);
    setError(null);
    try {
      const { sessionId } = await saveSessionToSupabase({
        name: trimmed,
        projectId,
        sessionData: getSessionData(),
        // On update: re-upload only if the PDF bytes changed locally (e.g. after trim).
        file: existingSessionId ? (pdfDirty ? file : null) : file,
        existingSessionId,
      });
      setCurrentSession({ id: sessionId, name: trimmed, projectId });
      if (pdfDirty) setPdfDirty(false);
      onSaved?.(sessionId, trimmed, projectId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const title = existingSessionId ? 'Update session' : 'Save session to Supabase';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-3">
        <Input
          label="Session name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Kona millwork takeoff"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        />
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Project (optional)</label>
          <select
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value || null)}
            disabled={!!lockProject || projectsLoading}
            className="w-full text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">— None (standalone) —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {lockProject && (
            <p className="text-[10px] text-slate-400 mt-1">Locked to the project you opened from.</p>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : existingSessionId ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
