import { create } from 'zustand';
import type {
  ViewportState,
  ToolMode,
  MeasurementUnit,
  PdfPoint,
  Calibration,
  Measurement,
  UndoableAction,
} from '../lib/plan-viewer/types';

const MEASUREMENT_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c',
  '#0891b2', '#be185d', '#4f46e5', '#ca8a04', '#059669',
];

interface PlanViewerState {
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

  // Calibration
  calibration: Calibration | null;
  showCalibrationModal: boolean;

  // Measurements
  measurements: Measurement[];
  selectedMeasurementId: string | null;

  // Undo/redo
  undoStack: UndoableAction[];
  redoStack: UndoableAction[];

  // Settings
  unit: MeasurementUnit;
  showCrosshair: boolean;

  // Counters for auto-naming
  lineCount: number;
  multilineCount: number;
  rectCount: number;
  colorIndex: number;
}

interface PlanViewerActions {
  setPageInfo: (pageCount: number, width: number, height: number) => void;
  setCurrentPage: (page: number) => void;

  setViewport: (v: Partial<ViewportState>) => void;
  fitToScreen: (containerWidth: number, containerHeight: number) => void;

  setActiveTool: (tool: ToolMode) => void;
  addActivePoint: (pt: PdfPoint) => void;
  clearActivePoints: () => void;

  setCalibration: (cal: Calibration) => void;
  clearCalibration: () => void;
  setShowCalibrationModal: (show: boolean) => void;

  addMeasurement: (m: Measurement) => void;
  deleteMeasurement: (id: string) => void;
  renameMeasurement: (id: string, name: string) => void;
  selectMeasurement: (id: string | null) => void;
  clearAllMeasurements: () => void;

  undo: () => void;
  redo: () => void;

  setUnit: (u: MeasurementUnit) => void;
  toggleCrosshair: () => void;

  nextColor: () => string;
  nextName: (type: 'line' | 'multiline' | 'rectangle') => string;

  reset: () => void;
}

export type PlanViewerStore = PlanViewerState & PlanViewerActions;

const initialState: PlanViewerState = {
  pageCount: 0,
  currentPage: 1,
  pdfPageWidth: 0,
  pdfPageHeight: 0,
  viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
  activeTool: 'pan',
  activePoints: [],
  calibration: null,
  showCalibrationModal: false,
  measurements: [],
  selectedMeasurementId: null,
  undoStack: [],
  redoStack: [],
  unit: 'in',
  showCrosshair: true,
  lineCount: 0,
  multilineCount: 0,
  rectCount: 0,
  colorIndex: 0,
};

export const usePlanViewerStore = create<PlanViewerStore>((set, get) => ({
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

  setCalibration: (cal) => {
    const prev = get().calibration;
    set((s) => ({
      calibration: cal,
      showCalibrationModal: false,
      activePoints: [],
      activeTool: 'pan',
      undoStack: [...s.undoStack, { type: 'SET_CALIBRATION', prev, next: cal }],
      redoStack: [],
    }));
  },

  clearCalibration: () => set({ calibration: null }),

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

  undo: () => {
    const { undoStack, redoStack, measurements, calibration } = get();
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
      case 'SET_CALIBRATION':
        set({
          calibration: action.prev,
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
      case 'CLEAR_ALL':
        set({
          measurements: action.measurements,
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
    }
  },

  redo: () => {
    const { undoStack, redoStack, measurements } = get();
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
          calibration: action.next,
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
    }
  },

  setUnit: (unit) => set({ unit }),

  toggleCrosshair: () => set((s) => ({ showCrosshair: !s.showCrosshair })),

  nextColor: () => {
    const idx = get().colorIndex;
    set({ colorIndex: idx + 1 });
    return MEASUREMENT_COLORS[idx % MEASUREMENT_COLORS.length];
  },

  nextName: (type) => {
    const s = get();
    if (type === 'line') {
      const n = s.lineCount + 1;
      set({ lineCount: n });
      return `Line ${n}`;
    }
    if (type === 'multiline') {
      const n = s.multilineCount + 1;
      set({ multilineCount: n });
      return `Path ${n}`;
    }
    const n = s.rectCount + 1;
    set({ rectCount: n });
    return `Rect ${n}`;
  },

  reset: () => set(initialState),
}));
