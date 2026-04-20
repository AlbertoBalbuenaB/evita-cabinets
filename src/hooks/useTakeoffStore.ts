import { create } from 'zustand';
import type {
  ViewportState,
  ToolMode,
  MeasurementUnit,
  PdfPoint,
  Calibration,
  Measurement,
  Annotation,
  UndoableAction,
  SessionData,
} from '../lib/takeoff/types';

const MEASUREMENT_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c',
  '#0891b2', '#be185d', '#4f46e5', '#ca8a04', '#059669',
];

const SESSION_KEY = 'evita-takeoff-session';
const LEGACY_SESSION_KEY = 'plan-viewer-session';

interface TakeoffState {
  // PDF
  pageCount: number;
  currentPage: number;
  pdfPageWidth: number;
  pdfPageHeight: number;

  // Viewport
  viewport: ViewportState;

  // Tool
  activeTool: ToolMode;
  activePoints: PdfPoint[];

  // Calibration (per-page)
  calibrations: Record<number, Calibration>;
  showCalibrationModal: boolean;

  // Measurements
  measurements: Measurement[];
  selectedMeasurementId: string | null;

  // Annotations
  annotations: Annotation[];
  showAnnotationInput: boolean;
  pendingAnnotationPos: PdfPoint | null;

  // Groups
  groups: string[];
  activeGroup: string | undefined;

  // Undo/redo
  undoStack: UndoableAction[];
  redoStack: UndoableAction[];

  // Settings
  unit: MeasurementUnit;
  showCrosshair: boolean;
  snapEnabled: boolean;
  showGrid: boolean;

  // Counters
  lineCount: number;
  multilineCount: number;
  rectCount: number;
  angleCount: number;
  polygonCount: number;
  annotationCount: number;
  colorIndex: number;
}

interface TakeoffActions {
  setPageInfo: (pageCount: number, width: number, height: number) => void;
  setCurrentPage: (page: number) => void;

  setViewport: (v: Partial<ViewportState>) => void;
  fitToScreen: (containerWidth: number, containerHeight: number) => void;

  setActiveTool: (tool: ToolMode) => void;
  addActivePoint: (pt: PdfPoint) => void;
  clearActivePoints: () => void;

  // Calibration (per-page)
  getCalibration: () => Calibration | null;
  setCalibration: (cal: Calibration) => void;
  clearCalibration: () => void;
  setShowCalibrationModal: (show: boolean) => void;

  addMeasurement: (m: Measurement) => void;
  deleteMeasurement: (id: string) => void;
  renameMeasurement: (id: string, name: string) => void;
  selectMeasurement: (id: string | null) => void;
  clearAllMeasurements: () => void;
  setMeasurementGroup: (id: string, group: string | undefined) => void;

  // Select tool: live preview during drag (no undo entry) + final commit (with undo)
  replaceMeasurementLive: (id: string, m: Measurement) => void;
  commitReplaceMeasurement: (prev: Measurement, next: Measurement) => void;

  // Annotations
  addAnnotation: (a: Annotation) => void;
  deleteAnnotation: (id: string) => void;
  setShowAnnotationInput: (show: boolean) => void;
  setPendingAnnotationPos: (pos: PdfPoint | null) => void;

  // Groups
  addGroup: (name: string) => void;
  removeGroup: (name: string) => void;
  setActiveGroup: (name: string | undefined) => void;

  undo: () => void;
  redo: () => void;

  setUnit: (u: MeasurementUnit) => void;
  toggleCrosshair: () => void;
  toggleSnap: () => void;
  toggleGrid: () => void;

  nextColor: () => string;
  nextName: (type: 'line' | 'multiline' | 'rectangle' | 'angle' | 'polygon') => string;

  // Session
  saveSession: () => void;
  loadSession: () => boolean;
  exportSession: () => string;
  importSession: (json: string) => boolean;

  reset: () => void;
}

export type TakeoffStore = TakeoffState & TakeoffActions;

const initialState: TakeoffState = {
  pageCount: 0,
  currentPage: 1,
  pdfPageWidth: 0,
  pdfPageHeight: 0,
  viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
  activeTool: 'pan',
  activePoints: [],
  calibrations: {},
  showCalibrationModal: false,
  measurements: [],
  selectedMeasurementId: null,
  annotations: [],
  showAnnotationInput: false,
  pendingAnnotationPos: null,
  groups: [],
  activeGroup: undefined,
  undoStack: [],
  redoStack: [],
  unit: 'in',
  showCrosshair: true,
  snapEnabled: false,
  showGrid: false,
  lineCount: 0,
  multilineCount: 0,
  rectCount: 0,
  angleCount: 0,
  polygonCount: 0,
  annotationCount: 0,
  colorIndex: 0,
};

export const useTakeoffStore = create<TakeoffStore>((set, get) => ({
  ...initialState,

  setPageInfo: (pageCount, width, height) =>
    set({ pageCount, pdfPageWidth: width, pdfPageHeight: height }),

  setCurrentPage: (page) => set({ currentPage: page }),

  setViewport: (v) =>
    set((s) => ({ viewport: { ...s.viewport, ...v } })),

  fitToScreen: (containerWidth, containerHeight) => {
    const { pdfPageWidth, pdfPageHeight } = get();
    if (!pdfPageWidth || !pdfPageHeight) return;
    const scaleX = containerWidth / pdfPageWidth;
    const scaleY = containerHeight / pdfPageHeight;
    const zoom = Math.min(scaleX, scaleY) * 0.95;
    const offsetX = (containerWidth - pdfPageWidth * zoom) / 2;
    const offsetY = (containerHeight - pdfPageHeight * zoom) / 2;
    set({ viewport: { zoom, offsetX, offsetY } });
  },

  setActiveTool: (tool) => set({ activeTool: tool, activePoints: [] }),

  addActivePoint: (pt) =>
    set((s) => ({ activePoints: [...s.activePoints, pt] })),

  clearActivePoints: () => set({ activePoints: [] }),

  // ── Calibration (per-page) ────────────────────────────────

  getCalibration: () => {
    const { calibrations, currentPage } = get();
    return calibrations[currentPage] ?? null;
  },

  setCalibration: (cal) => {
    const { currentPage, calibrations, undoStack } = get();
    const prev = calibrations[currentPage] ?? null;
    set({
      calibrations: { ...calibrations, [currentPage]: cal },
      showCalibrationModal: false,
      activePoints: [],
      activeTool: 'pan',
      undoStack: [...undoStack, { type: 'SET_CALIBRATION', page: currentPage, prev, next: cal }],
      redoStack: [],
    });
  },

  clearCalibration: () => {
    const { currentPage, calibrations } = get();
    const next = { ...calibrations };
    delete next[currentPage];
    set({ calibrations: next });
  },

  setShowCalibrationModal: (show) => set({ showCalibrationModal: show }),

  addMeasurement: (m) =>
    set((s) => ({
      measurements: [...s.measurements, m],
      activePoints: [],
      undoStack: [...s.undoStack, { type: 'ADD_MEASUREMENT', measurement: m }],
      redoStack: [],
    })),

  deleteMeasurement: (id) => {
    const { measurements, undoStack } = get();
    const index = measurements.findIndex((m) => m.id === id);
    if (index === -1) return;
    const measurement = measurements[index];
    set({
      measurements: measurements.filter((m) => m.id !== id),
      selectedMeasurementId: null,
      undoStack: [...undoStack, { type: 'DELETE_MEASUREMENT', measurement, index }],
      redoStack: [],
    });
  },

  renameMeasurement: (id, name) =>
    set((s) => ({
      measurements: s.measurements.map((m) => (m.id === id ? { ...m, name } : m)),
    })),

  selectMeasurement: (id) => set({ selectedMeasurementId: id }),

  clearAllMeasurements: () => {
    const { measurements, undoStack } = get();
    if (measurements.length === 0) return;
    set({
      measurements: [],
      selectedMeasurementId: null,
      undoStack: [...undoStack, { type: 'CLEAR_ALL', measurements }],
      redoStack: [],
    });
  },

  setMeasurementGroup: (id, group) =>
    set((s) => ({
      measurements: s.measurements.map((m) => (m.id === id ? { ...m, group } : m)),
    })),

  replaceMeasurementLive: (id, next) =>
    set((s) => ({
      measurements: s.measurements.map((m) => (m.id === id ? next : m)),
    })),

  commitReplaceMeasurement: (prev, next) =>
    set((s) => ({
      measurements: s.measurements.map((m) => (m.id === prev.id ? next : m)),
      undoStack: [...s.undoStack, { type: 'REPLACE_MEASUREMENT', prev, next }],
      redoStack: [],
    })),

  // ── Annotations ───────────────────────────────────────────

  addAnnotation: (a) =>
    set((s) => ({
      annotations: [...s.annotations, a],
      showAnnotationInput: false,
      pendingAnnotationPos: null,
      undoStack: [...s.undoStack, { type: 'ADD_ANNOTATION', annotation: a }],
      redoStack: [],
    })),

  deleteAnnotation: (id) => {
    const { annotations, undoStack } = get();
    const index = annotations.findIndex((a) => a.id === id);
    if (index === -1) return;
    const annotation = annotations[index];
    set({
      annotations: annotations.filter((a) => a.id !== id),
      undoStack: [...undoStack, { type: 'DELETE_ANNOTATION', annotation, index }],
      redoStack: [],
    });
  },

  setShowAnnotationInput: (show) => set({ showAnnotationInput: show }),
  setPendingAnnotationPos: (pos) => set({ pendingAnnotationPos: pos }),

  // ── Groups ────────────────────────────────────────────────

  addGroup: (name) =>
    set((s) => ({ groups: s.groups.includes(name) ? s.groups : [...s.groups, name] })),

  removeGroup: (name) =>
    set((s) => ({
      groups: s.groups.filter((g) => g !== name),
      activeGroup: s.activeGroup === name ? undefined : s.activeGroup,
      measurements: s.measurements.map((m) => (m.group === name ? { ...m, group: undefined } : m)),
    })),

  setActiveGroup: (name) => set({ activeGroup: name }),

  // ── Undo/Redo ─────────────────────────────────────────────

  undo: () => {
    const { undoStack, redoStack, measurements, calibrations, annotations } = get();
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    const newUndo = undoStack.slice(0, -1);

    switch (action.type) {
      case 'ADD_MEASUREMENT':
        set({
          measurements: measurements.filter((m) => m.id !== action.measurement.id),
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
      case 'DELETE_MEASUREMENT':
        set({
          measurements: [
            ...measurements.slice(0, action.index),
            action.measurement,
            ...measurements.slice(action.index),
          ],
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
      case 'SET_CALIBRATION': {
        const next = { ...calibrations };
        if (action.prev) next[action.page] = action.prev;
        else delete next[action.page];
        set({
          calibrations: next,
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
      }
      case 'CLEAR_ALL':
        set({
          measurements: action.measurements,
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
      case 'ADD_ANNOTATION':
        set({
          annotations: annotations.filter((a) => a.id !== action.annotation.id),
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
      case 'DELETE_ANNOTATION':
        set({
          annotations: [
            ...annotations.slice(0, action.index),
            action.annotation,
            ...annotations.slice(action.index),
          ],
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
      case 'REPLACE_MEASUREMENT':
        set({
          measurements: measurements.map((m) => (m.id === action.prev.id ? action.prev : m)),
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
    }
  },

  redo: () => {
    const { undoStack, redoStack, measurements, calibrations, annotations } = get();
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);

    switch (action.type) {
      case 'ADD_MEASUREMENT':
        set({
          measurements: [...measurements, action.measurement],
          undoStack: [...undoStack, action],
          redoStack: newRedo,
        });
        break;
      case 'DELETE_MEASUREMENT':
        set({
          measurements: measurements.filter((m) => m.id !== action.measurement.id),
          undoStack: [...undoStack, action],
          redoStack: newRedo,
        });
        break;
      case 'SET_CALIBRATION':
        set({
          calibrations: { ...calibrations, [action.page]: action.next },
          undoStack: [...undoStack, action],
          redoStack: newRedo,
        });
        break;
      case 'CLEAR_ALL':
        set({
          measurements: [],
          undoStack: [...undoStack, action],
          redoStack: newRedo,
        });
        break;
      case 'ADD_ANNOTATION':
        set({
          annotations: [...annotations, action.annotation],
          undoStack: [...undoStack, action],
          redoStack: newRedo,
        });
        break;
      case 'DELETE_ANNOTATION':
        set({
          annotations: annotations.filter((a) => a.id !== action.annotation.id),
          undoStack: [...undoStack, action],
          redoStack: newRedo,
        });
        break;
      case 'REPLACE_MEASUREMENT':
        set({
          measurements: measurements.map((m) => (m.id === action.prev.id ? action.next : m)),
          undoStack: [...undoStack, action],
          redoStack: newRedo,
        });
        break;
    }
  },

  setUnit: (unit) => set({ unit }),
  toggleCrosshair: () => set((s) => ({ showCrosshair: !s.showCrosshair })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  nextColor: () => {
    const idx = get().colorIndex;
    set({ colorIndex: idx + 1 });
    return MEASUREMENT_COLORS[idx % MEASUREMENT_COLORS.length];
  },

  nextName: (type) => {
    const s = get();
    const map: Record<string, [string, keyof TakeoffState]> = {
      line: ['Line', 'lineCount'],
      multiline: ['Path', 'multilineCount'],
      rectangle: ['Rect', 'rectCount'],
      angle: ['Angle', 'angleCount'],
      polygon: ['Polygon', 'polygonCount'],
    };
    const [prefix, key] = map[type];
    const n = (s[key] as number) + 1;
    set({ [key]: n } as Partial<TakeoffState>);
    return `${prefix} ${n}`;
  },

  // ── Session persistence ───────────────────────────────────

  saveSession: () => {
    const s = get();
    const data: SessionData = {
      calibrations: s.calibrations,
      measurements: s.measurements,
      annotations: s.annotations,
      unit: s.unit,
      groups: s.groups,
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch { /* quota exceeded — silently fail */ }
  },

  loadSession: () => {
    try {
      let raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        // Soft migration from the old Plan Viewer key (pre-rename to Evita Takeoff).
        const legacy = localStorage.getItem(LEGACY_SESSION_KEY);
        if (legacy) {
          localStorage.setItem(SESSION_KEY, legacy);
          localStorage.removeItem(LEGACY_SESSION_KEY);
          raw = legacy;
        }
      }
      if (!raw) return false;
      const data: SessionData = JSON.parse(raw);
      set({
        calibrations: data.calibrations || {},
        measurements: data.measurements || [],
        annotations: data.annotations || [],
        unit: data.unit || 'in',
        groups: data.groups || [],
      });
      return true;
    } catch {
      return false;
    }
  },

  exportSession: () => {
    const s = get();
    const data: SessionData = {
      calibrations: s.calibrations,
      measurements: s.measurements,
      annotations: s.annotations,
      unit: s.unit,
      groups: s.groups,
    };
    return JSON.stringify(data, null, 2);
  },

  importSession: (json) => {
    try {
      const data: SessionData = JSON.parse(json);
      set({
        calibrations: data.calibrations || {},
        measurements: data.measurements || [],
        annotations: data.annotations || [],
        unit: data.unit || 'in',
        groups: data.groups || [],
        undoStack: [],
        redoStack: [],
      });
      return true;
    } catch {
      return false;
    }
  },

  reset: () => set(initialState),
}));
