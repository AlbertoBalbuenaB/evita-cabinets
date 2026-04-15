/**
 * Draft Tool — page orchestrator (Step 3).
 *
 * Wraps the canvas + catalog panel in a glass-morphism layout with a
 * header that handles:
 *   - Project (quotation) selector
 *   - Drawing selector + "New Drawing" button
 *   - "Edit Specs" (opens SpecsEditorModal)
 *   - Language toggle EN/ES
 *   - Paper-size indicator (letter for Phase 1)
 *   - Position-tags toggle
 *   - Save status pill
 *   - Plan ↔ Elevation view switcher
 *
 * Route: `/tools/draft` (registered in `src/App.tsx`).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Plus,
  Save,
  Loader2,
  AlertCircle,
  Tag,
  Languages,
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useCurrentMember } from '../../lib/useCurrentMember';
import { useDraftStore } from './store/useDraftStore';
import { CatalogPanel } from './panels/CatalogPanel';
import { SpecsEditorModal } from './panels/SpecsEditorModal';
import { DraftCanvas } from './canvas/DraftCanvas';
import * as api from './lib/draftApi';
import type { QuotationSummary } from './lib/draftApi';

export function DraftToolPage() {
  const { member } = useCurrentMember();

  // Header state
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [drawings, setDrawings] = useState<{ id: string; name: string }[]>([]);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [newDrawingOpen, setNewDrawingOpen] = useState(false);

  // Store
  const currentDrawing = useDraftStore((s) => s.currentDrawing);
  const currentView = useDraftStore((s) => s.currentView);
  const setCurrentView = useDraftStore((s) => s.setCurrentView);
  const saveStatus = useDraftStore((s) => s.saveStatus);
  const saveError = useDraftStore((s) => s.saveError);
  const loadDrawing = useDraftStore((s) => s.loadDrawing);
  const resetToEmpty = useDraftStore((s) => s.resetToEmpty);
  const newDrawing = useDraftStore((s) => s.newDrawing);
  const updateDrawingPatch = useDraftStore((s) => s.updateDrawingPatch);
  const areas = useDraftStore((s) => s.areas);
  const elevations = useDraftStore((s) => s.elevations);
  const currentAreaId = useDraftStore((s) => s.currentAreaId);
  const setCurrentArea = useDraftStore((s) => s.setCurrentArea);
  const currentElevationId = useDraftStore((s) => s.currentElevationId);
  const setCurrentElevation = useDraftStore((s) => s.setCurrentElevation);

  // Load quotations for the selector
  useEffect(() => {
    api.listQuotationsForSelector().then(setQuotations).catch(console.error);
  }, []);

  // When project changes, load its drawings
  useEffect(() => {
    if (!selectedProjectId) {
      setDrawings([]);
      return;
    }
    api
      .listDrawingsByProject(selectedProjectId)
      .then((rows) => setDrawings(rows.map((r) => ({ id: r.id, name: r.name }))))
      .catch(console.error);
  }, [selectedProjectId, currentDrawing?.id]);

  // Cleanup store when the tool unmounts
  useEffect(() => {
    return () => {
      resetToEmpty();
    };
  }, [resetToEmpty]);

  const currentElevations = useMemo(
    () => elevations.filter((e) => e.area_id === currentAreaId),
    [elevations, currentAreaId]
  );

  // ── Handlers ───────────────────────────────────────────────────────────
  async function handleNewDrawing(name: string) {
    if (!selectedProjectId) return;
    try {
      const row = await newDrawing({
        project_id: selectedProjectId,
        name,
        created_by: member?.id ?? null,
      });
      setDrawings((prev) => [{ id: row.id, name: row.name }, ...prev]);
      setNewDrawingOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to create drawing. See console for details.');
    }
  }

  async function handleSelectDrawing(drawingId: string) {
    try {
      await loadDrawing(drawingId);
    } catch (err) {
      console.error(err);
      alert('Failed to load drawing.');
    }
  }

  return (
    <div className="page-enter h-[calc(100vh-56px)] flex flex-col gap-2 px-3 sm:px-4 pt-3 pb-2">
      {/* Back link */}
      <Link
        to="/tools"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Tools
      </Link>

      {/* Header bar — compact to maximize canvas height */}
      <div className="glass-indigo rounded-xl px-3 py-1.5 flex flex-wrap items-center gap-2">
        <div className="flex-shrink-0">
          <h1 className="text-sm font-semibold text-slate-800 leading-tight">Evita Draft</h1>
          <p className="text-[10px] text-slate-500 leading-tight">
            Floorplans &amp; elevations · AWI/NAAWS 4.0
          </p>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Project selector */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-slate-300/60 bg-white/70 text-xs text-slate-700"
          >
            <option value="">Select project…</option>
            {quotations.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>

          {/* Drawing selector */}
          <select
            value={currentDrawing?.id ?? ''}
            onChange={(e) => {
              if (e.target.value) handleSelectDrawing(e.target.value);
            }}
            disabled={!selectedProjectId}
            className="px-2 py-1.5 rounded-lg border border-slate-300/60 bg-white/70 text-xs text-slate-700 disabled:opacity-50"
          >
            <option value="">Select drawing…</option>
            {drawings.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setNewDrawingOpen(true)}
            disabled={!selectedProjectId}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> New
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSpecsOpen(true)}
            disabled={!currentDrawing}
          >
            <FileText className="h-3.5 w-3.5 mr-1" /> Specs
          </Button>

          {/* Language toggle */}
          <button
            type="button"
            onClick={() =>
              updateDrawingPatch({
                export_language: currentDrawing?.export_language === 'es' ? 'en' : 'es',
              })
            }
            disabled={!currentDrawing}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-300/60 bg-white/70 text-xs text-slate-700 disabled:opacity-50"
          >
            <Languages className="h-3.5 w-3.5" />
            {currentDrawing?.export_language?.toUpperCase() ?? 'EN'}
          </button>

          {/* Position tags toggle */}
          <button
            type="button"
            onClick={() =>
              updateDrawingPatch({
                show_position_tags: !currentDrawing?.show_position_tags,
              })
            }
            disabled={!currentDrawing}
            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs disabled:opacity-50 ${
              currentDrawing?.show_position_tags
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-slate-300/60 bg-white/70 text-slate-700'
            }`}
            title="Show position tags (K-A1, K-A2…)"
          >
            <Tag className="h-3.5 w-3.5" />
            Tags
          </button>

          {/* Paper size (static Phase 1) */}
          <span className="text-[11px] text-slate-500 px-2">US Letter</span>

          {/* Save status pill */}
          <SaveStatusPill status={saveStatus} error={saveError} />
        </div>
      </div>

      {/* View switcher + area/elevation selectors */}
      {currentDrawing && (
        <div className="glass-white rounded-lg px-2 py-1 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100/80 rounded-md p-0.5">
            <ViewTab label="Plan" active={currentView === 'plan'} onClick={() => setCurrentView('plan')} />
            <ViewTab
              label="Elevation"
              active={currentView === 'elevation'}
              onClick={async () => {
                setCurrentView('elevation');
                // Auto-create first elevation if none exists for this area
                if (currentAreaId && elevations.filter((e) => e.area_id === currentAreaId).length === 0) {
                  try {
                    await useDraftStore.getState().createElevation(currentAreaId, 'A');
                  } catch (err) {
                    console.error('Failed to create default elevation', err);
                  }
                }
              }}
            />
          </div>

          <select
            value={currentAreaId ?? ''}
            onChange={(e) => setCurrentArea(e.target.value || null)}
            className="px-2 py-1.5 rounded-lg border border-slate-300/60 bg-white/70 text-xs text-slate-700"
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.prefix} — {a.name}
              </option>
            ))}
          </select>

          {currentView === 'elevation' && (
            <select
              value={currentElevationId ?? ''}
              onChange={(e) => setCurrentElevation(e.target.value || null)}
              className="px-2 py-1.5 rounded-lg border border-slate-300/60 bg-white/70 text-xs text-slate-700"
            >
              <option value="">Select elevation…</option>
              {currentElevations.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  Elevation {ev.letter}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Canvas + sidebar */}
      <div className="flex-1 flex gap-3 min-h-0">
        <CatalogPanel />
        {currentDrawing ? (
          <DraftCanvas />
        ) : (
          <div className="flex-1 glass-white rounded-2xl flex items-center justify-center text-slate-500">
            <div className="text-center">
              <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <div className="text-sm font-medium">No drawing open</div>
              <div className="text-xs mt-1">
                Select a project and drawing, or click <strong>New</strong>.
              </div>
            </div>
          </div>
        )}
      </div>

      <SpecsEditorModal isOpen={specsOpen} onClose={() => setSpecsOpen(false)} />

      <NewDrawingModal
        isOpen={newDrawingOpen}
        onClose={() => setNewDrawingOpen(false)}
        onCreate={handleNewDrawing}
      />
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function ViewTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
        active ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-800'
      }`}
    >
      {label}
    </button>
  );
}

function SaveStatusPill({
  status,
  error,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
  error: string | null;
}) {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px]">
        <Save className="h-3 w-3" />
        Saved
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-700 text-[11px]"
        title={error ?? ''}
      >
        <AlertCircle className="h-3 w-3" />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px]">
      Idle
    </span>
  );
}

function NewDrawingModal({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (isOpen) setName('');
  }, [isOpen]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Drawing" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Drawing name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kitchen plan — 2701 Beat Creek"
            className="w-full px-3 py-2 rounded-lg border border-slate-300/80 bg-white/70 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!name.trim()} onClick={() => onCreate(name.trim())}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}
