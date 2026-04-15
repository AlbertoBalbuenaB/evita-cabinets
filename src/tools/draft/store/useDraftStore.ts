/**
 * Draft Tool — Zustand store.
 *
 * Holds the in-memory state for a single open drawing: metadata, specs,
 * areas, elevations, and all drawing elements. Every mutation is applied
 * optimistically and enqueued for a debounced autosave (1.5s) to Supabase.
 *
 * There is no CRDT or conflict resolution in Phase 1. Supabase Realtime
 * subscriptions with last-write-wins are added in Phase 2 (see the plan
 * file at `.claude/plans/peppy-puzzling-orbit.md`).
 */

import { create } from 'zustand';
import type {
  DrawingRow,
  DrawingAreaRow,
  DrawingElevationRow,
  DrawingElementRow,
  DrawingElementInsert,
  ViewType,
  SaveStatus,
  DrawingSpecs,
} from '../types';
import * as api from '../lib/draftApi';

// ── Autosave timer (module-level — there is only ever one active drawing) ──
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTOSAVE_DELAY_MS = 1500;

// ── Store shape ─────────────────────────────────────────────────────────────
interface DraftStoreState {
  // Data
  currentDrawing: DrawingRow | null;
  areas: DrawingAreaRow[];
  elevations: DrawingElevationRow[];
  elements: Record<string, DrawingElementRow>;

  // UI / selection
  currentAreaId: string | null;
  currentElevationId: string | null;
  currentView: ViewType;
  selectedIds: string[];

  // Autosave bookkeeping
  saveStatus: SaveStatus;
  saveError: string | null;
  dirtyDrawing: boolean;
  dirtyElementIds: Set<string>;
  dirtyDeletedIds: Set<string>;

  // ── Loaders ────────────────────────────────────────────────────────────
  loadDrawing: (drawingId: string) => Promise<void>;
  resetToEmpty: () => void;
  newDrawing: (input: {
    project_id: string;
    name: string;
    created_by?: string | null;
  }) => Promise<DrawingRow>;

  // ── Selection / view ────────────────────────────────────────────────────
  setCurrentView: (view: ViewType) => void;
  setCurrentArea: (areaId: string | null) => void;
  setCurrentElevation: (elevationId: string | null) => void;
  setSelected: (ids: string[]) => void;
  toggleSelected: (id: string, multi?: boolean) => void;
  clearSelection: () => void;

  // ── Drawing metadata mutations ─────────────────────────────────────────
  updateSpecs: (patch: Partial<DrawingSpecs>) => void;
  updateDrawingPatch: (patch: Partial<DrawingRow>) => void;

  // ── Element mutations ──────────────────────────────────────────────────
  addElement: (row: DrawingElementRow) => void;
  upsertElement: (row: DrawingElementRow) => void;
  patchElement: (id: string, patch: Partial<DrawingElementRow>) => void;
  removeElements: (ids: string[]) => void;

  // ── Area / elevation creation ──────────────────────────────────────────
  createArea: (name: string, prefix: string) => Promise<DrawingAreaRow>;
  createElevation: (areaId: string, letter: string) => Promise<DrawingElevationRow>;

  // ── Autosave ───────────────────────────────────────────────────────────
  scheduleAutosave: () => void;
  flushAutosave: () => Promise<void>;
}

function createEmptyState(): Pick<
  DraftStoreState,
  | 'currentDrawing'
  | 'areas'
  | 'elevations'
  | 'elements'
  | 'currentAreaId'
  | 'currentElevationId'
  | 'currentView'
  | 'selectedIds'
  | 'saveStatus'
  | 'saveError'
  | 'dirtyDrawing'
  | 'dirtyElementIds'
  | 'dirtyDeletedIds'
> {
  return {
    currentDrawing: null,
    areas: [],
    elevations: [],
    elements: {},
    currentAreaId: null,
    currentElevationId: null,
    currentView: 'plan',
    selectedIds: [],
    saveStatus: 'idle',
    saveError: null,
    dirtyDrawing: false,
    dirtyElementIds: new Set(),
    dirtyDeletedIds: new Set(),
  };
}

export const useDraftStore = create<DraftStoreState>((set, get) => ({
  ...createEmptyState(),

  // ── Loaders ────────────────────────────────────────────────────────────
  resetToEmpty: () => {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    set(createEmptyState());
  },

  loadDrawing: async (drawingId) => {
    set({ saveStatus: 'idle', saveError: null });
    const [drawing, areas, elevations, elements] = await Promise.all([
      api.getDrawing(drawingId),
      api.listAreasByDrawing(drawingId),
      api.listElevationsByDrawing(drawingId),
      api.listElementsByDrawing(drawingId),
    ]);
    if (!drawing) throw new Error(`Drawing ${drawingId} not found`);
    const elementMap: Record<string, DrawingElementRow> = {};
    for (const el of elements) elementMap[el.id] = el;

    const firstArea = areas[0];
    set({
      currentDrawing: drawing,
      areas,
      elevations,
      elements: elementMap,
      currentAreaId: firstArea?.id ?? null,
      currentElevationId: null,
      currentView: 'plan',
      selectedIds: [],
      dirtyDrawing: false,
      dirtyElementIds: new Set(),
      dirtyDeletedIds: new Set(),
      saveStatus: 'idle',
      saveError: null,
    });
  },

  newDrawing: async (input) => {
    const row = await api.createDrawing({
      project_id: input.project_id,
      name: input.name,
      created_by: input.created_by ?? null,
      export_language: 'en',
    });
    // Create a default area "Kitchen" with prefix K so the user can
    // immediately start drawing without extra clicks.
    const defaultArea = await api.createArea(row.id, 'Kitchen', 'K');
    set({
      currentDrawing: row,
      areas: [defaultArea],
      elevations: [],
      elements: {},
      currentAreaId: defaultArea.id,
      currentElevationId: null,
      currentView: 'plan',
      selectedIds: [],
      dirtyDrawing: false,
      dirtyElementIds: new Set(),
      dirtyDeletedIds: new Set(),
      saveStatus: 'saved',
      saveError: null,
    });
    return row;
  },

  // ── Selection / view ────────────────────────────────────────────────────
  setCurrentView: (view) => set({ currentView: view, selectedIds: [] }),
  setCurrentArea: (areaId) => set({ currentAreaId: areaId, currentElevationId: null }),
  setCurrentElevation: (elevationId) =>
    set({ currentElevationId: elevationId, currentView: 'elevation' }),

  setSelected: (ids) => set({ selectedIds: ids }),
  toggleSelected: (id, multi = false) => {
    const { selectedIds } = get();
    if (!multi) {
      set({ selectedIds: selectedIds.includes(id) ? [] : [id] });
      return;
    }
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    set({ selectedIds: next });
  },
  clearSelection: () => set({ selectedIds: [] }),

  // ── Drawing metadata mutations ─────────────────────────────────────────
  updateSpecs: (patch) => {
    const { currentDrawing } = get();
    if (!currentDrawing) return;
    const nextSpecs = { ...(currentDrawing.specs as DrawingSpecs), ...patch };
    set({
      currentDrawing: { ...currentDrawing, specs: nextSpecs as DrawingRow['specs'] },
      dirtyDrawing: true,
    });
    get().scheduleAutosave();
  },

  updateDrawingPatch: (patch) => {
    const { currentDrawing } = get();
    if (!currentDrawing) return;
    set({
      currentDrawing: { ...currentDrawing, ...patch },
      dirtyDrawing: true,
    });
    get().scheduleAutosave();
  },

  // ── Element mutations ──────────────────────────────────────────────────
  addElement: (row) => {
    const { elements, dirtyElementIds } = get();
    set({
      elements: { ...elements, [row.id]: row },
      dirtyElementIds: new Set([...dirtyElementIds, row.id]),
    });
    get().scheduleAutosave();
  },

  upsertElement: (row) => {
    const { elements, dirtyElementIds } = get();
    set({
      elements: { ...elements, [row.id]: row },
      dirtyElementIds: new Set([...dirtyElementIds, row.id]),
    });
    get().scheduleAutosave();
  },

  patchElement: (id, patch) => {
    const { elements, dirtyElementIds } = get();
    const existing = elements[id];
    if (!existing) return;
    const next: DrawingElementRow = {
      ...existing,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    set({
      elements: { ...elements, [id]: next },
      dirtyElementIds: new Set([...dirtyElementIds, id]),
    });
    get().scheduleAutosave();
  },

  removeElements: (ids) => {
    const { elements, dirtyElementIds, dirtyDeletedIds, selectedIds } = get();
    const nextElements = { ...elements };
    const nextDirty = new Set(dirtyElementIds);
    const nextDeleted = new Set(dirtyDeletedIds);
    for (const id of ids) {
      delete nextElements[id];
      nextDirty.delete(id);
      nextDeleted.add(id);
    }
    set({
      elements: nextElements,
      dirtyElementIds: nextDirty,
      dirtyDeletedIds: nextDeleted,
      selectedIds: selectedIds.filter((x) => !ids.includes(x)),
    });
    get().scheduleAutosave();
  },

  // ── Area / elevation creation ──────────────────────────────────────────
  createArea: async (name, prefix) => {
    const { currentDrawing, areas } = get();
    if (!currentDrawing) throw new Error('No current drawing');
    const row = await api.createArea(currentDrawing.id, name, prefix);
    set({ areas: [...areas, row], currentAreaId: row.id });
    return row;
  },

  createElevation: async (areaId, letter) => {
    const { elevations } = get();
    const row = await api.createElevation(areaId, letter);
    set({
      elevations: [...elevations, row],
      currentElevationId: row.id,
      currentView: 'elevation',
    });
    return row;
  },

  // ── Autosave ───────────────────────────────────────────────────────────
  scheduleAutosave: () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      get().flushAutosave().catch(() => {
        // flushAutosave already sets saveStatus='error' on failure; we
        // swallow here so the timer callback doesn't crash.
      });
    }, AUTOSAVE_DELAY_MS);
  },

  flushAutosave: async () => {
    const state = get();
    const {
      currentDrawing,
      elements,
      dirtyDrawing,
      dirtyElementIds,
      dirtyDeletedIds,
    } = state;
    if (!currentDrawing) return;
    if (!dirtyDrawing && dirtyElementIds.size === 0 && dirtyDeletedIds.size === 0) {
      return;
    }

    set({ saveStatus: 'saving', saveError: null });
    try {
      // 1. Upsert dirty elements (insert-or-update in one roundtrip)
      if (dirtyElementIds.size > 0) {
        const rows: DrawingElementInsert[] = [];
        for (const id of dirtyElementIds) {
          const el = elements[id];
          if (el) rows.push(el);
        }
        await api.upsertElements(rows);
      }

      // 2. Delete pending
      if (dirtyDeletedIds.size > 0) {
        await api.deleteElements([...dirtyDeletedIds]);
      }

      // 3. Update drawing metadata (specs, name, etc.)
      if (dirtyDrawing) {
        await api.updateDrawing(currentDrawing.id, {
          specs: currentDrawing.specs,
          name: currentDrawing.name,
          export_language: currentDrawing.export_language,
          lock_tags: currentDrawing.lock_tags,
          show_position_tags: currentDrawing.show_position_tags,
          paper_size: currentDrawing.paper_size,
          scale: currentDrawing.scale,
          version: currentDrawing.version,
        });
      }

      set({
        saveStatus: 'saved',
        dirtyDrawing: false,
        dirtyElementIds: new Set(),
        dirtyDeletedIds: new Set(),
      });
    } catch (err) {
      set({
        saveStatus: 'error',
        saveError: err instanceof Error ? err.message : String(err),
      });
    }
  },
}));
