import { create } from 'zustand';
import { Pieza, StockSize, Remnant, OptimizationResult, OptimizerTab, UnitSystem, EbConfig } from '../lib/optimizer/types';
import { runOptimization } from '../lib/optimizer/engine';
import { exportOptimizerPDF, PdfLang } from '../lib/optimizer/pdfExport';

interface OptimizerState {
  pieces: Pieza[];
  stocks: StockSize[];
  remnants: Remnant[];
  areas: string[];
  globalSierra: number;
  minOffcut: number;
  boardTrim: number;
  projectName: string;
  clientName: string;
  result: OptimizationResult | null;
  isOptimizing: boolean;
  activeTab: OptimizerTab;
  unit: UnitSystem;
  selectedBoardIndex: number | null;
  ebConfig: EbConfig;
  labelScale: number;

  setUnit: (u: UnitSystem) => void;
  addPiece: (p: Omit<Pieza, 'id'>) => void;
  updatePiece: (id: string, patch: Partial<Pieza>) => void;
  removePiece: (id: string) => void;
  clearPieces: () => void;
  setPieces: (pieces: Pieza[]) => void;
  addStock: (s: Omit<StockSize, 'id'>) => void;
  updateStock: (id: string, patch: Partial<StockSize>) => void;
  removeStock: (id: string) => void;
  addRemnant: (r: Omit<Remnant, 'id'>) => void;
  removeRemnant: (id: string) => void;
  addArea: (name: string) => void;
  removeArea: (name: string) => void;
  setActiveTab: (tab: OptimizerTab) => void;
  setSelectedBoard: (idx: number | null) => void;
  setProjectName: (name: string) => void;
  setClientName: (name: string) => void;
  setGlobalSierra: (v: number) => void;
  setMinOffcut: (v: number) => void;
  setBoardTrim: (v: number) => void;
  setEbConfig: (cfg: EbConfig) => void;
  setLabelScale: (s: number) => void;
  runOptimize: () => Promise<void>;
  exportPDF: (lang?: PdfLang) => Promise<void>;
  saveProject: () => void;
  loadProject: (json: string) => void;
  reset: () => void;
}

const EMPTY_EB: EbConfig = {
  a: { id: '', name: '', price: 0 },
  b: { id: '', name: '', price: 0 },
  c: { id: '', name: '', price: 0 },
};

const DEFAULT_STOCK: StockSize = {
  id: crypto.randomUUID(),
  nombre: '4×8 ft',
  ancho: 2440,
  alto: 1220,
  costo: 450,
  sierra: 3.2,
  qty: 0,
};

export const useOptimizerStore = create<OptimizerState>((set, get) => ({
  pieces: [],
  stocks: [DEFAULT_STOCK],
  remnants: [],
  areas: [],
  globalSierra: 3.2,
  minOffcut: 200,
  boardTrim: 5,
  ebConfig: EMPTY_EB,
  labelScale: 1.0,
  projectName: '',
  clientName: '',
  unit: 'mm' as UnitSystem,
  result: null,
  isOptimizing: false,
  activeTab: 'boards',
  selectedBoardIndex: null,

  addPiece: (p) => set((state) => ({ pieces: [...state.pieces, { ...p, id: crypto.randomUUID() }] })),
  updatePiece: (id, patch) => set((state) => ({ pieces: state.pieces.map((p) => p.id === id ? { ...p, ...patch } : p) })),
  removePiece: (id) => set((state) => ({ pieces: state.pieces.filter((p) => p.id !== id) })),
  clearPieces: () => set({ pieces: [] }),
  setPieces: (pieces) => set({ pieces }),

  addStock: (s) => set((state) => ({ stocks: [...state.stocks, { ...s, id: crypto.randomUUID() }] })),
  updateStock: (id, patch) => set((state) => ({ stocks: state.stocks.map((s) => s.id === id ? { ...s, ...patch } : s) })),
  removeStock: (id) => set((state) => ({ stocks: state.stocks.filter((s) => s.id !== id) })),
  addRemnant: (r) => set((state) => ({ remnants: [...state.remnants, { ...r, id: crypto.randomUUID() }] })),
  removeRemnant: (id) => set((state) => ({ remnants: state.remnants.filter((r) => r.id !== id) })),

  addArea: (name) => set((state) => ({ areas: state.areas.includes(name) ? state.areas : [...state.areas, name] })),
  removeArea: (name) => set((state) => ({
    areas: state.areas.filter(a => a !== name),
    pieces: state.pieces.map(p => p.area === name ? { ...p, area: undefined } : p),
  })),

  setUnit: (u) => set({ unit: u }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedBoard: (idx) => set({ selectedBoardIndex: idx }),
  setProjectName: (name) => set({ projectName: name }),
  setClientName: (name) => set({ clientName: name }),
  setGlobalSierra: (v) => set({ globalSierra: v }),
  setMinOffcut: (v) => set({ minOffcut: v }),
  setBoardTrim: (v) => set({ boardTrim: v }),
  setEbConfig: (cfg) => set({ ebConfig: cfg }),
  setLabelScale: (s) => set({ labelScale: Math.min(2.0, Math.max(0.5, s)) }),

  runOptimize: async () => {
    const state = get();
    if (!state.pieces.length) { alert('Add at least one panel to optimize'); return; }
    set({ isOptimizing: true });
    await new Promise((r) => setTimeout(r, 100));
    try {
      const result = runOptimization(state.pieces, state.stocks, state.remnants, state.globalSierra, state.minOffcut, state.boardTrim);
      set({ result, isOptimizing: false, selectedBoardIndex: 0 });
    } catch (error) {
      console.error('Optimization error:', error);
      set({ isOptimizing: false });
      alert('Optimization error: ' + String(error));
    }
  },

  exportPDF: async (lang: PdfLang = 'en') => {
    const state = get();
    if (!state.result) { alert('Run optimization first'); return; }
    await exportOptimizerPDF(state.result, state.projectName, state.clientName, state.unit, state.ebConfig, state.areas, state.labelScale, lang);
  },

  saveProject: () => {
    const state = get();
    const data = { version: '1.1', projectName: state.projectName, clientName: state.clientName, pieces: state.pieces, stocks: state.stocks, remnants: state.remnants, areas: state.areas, globalSierra: state.globalSierra, minOffcut: state.minOffcut, boardTrim: state.boardTrim, ebConfig: state.ebConfig };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${state.projectName || 'project'}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  loadProject: (json) => {
    try {
      const data = JSON.parse(json);
      set({ projectName: data.projectName || '', clientName: data.clientName || '', pieces: data.pieces || [], stocks: data.stocks || [DEFAULT_STOCK], remnants: data.remnants || [], areas: data.areas || [], globalSierra: data.globalSierra || 3.2, minOffcut: data.minOffcut || 200, boardTrim: data.boardTrim ?? 5, ebConfig: data.ebConfig || EMPTY_EB });
    } catch (error) { alert('Error loading project: ' + String(error)); }
  },

  reset: () => set({ pieces: [], stocks: [DEFAULT_STOCK], remnants: [], areas: [], globalSierra: 3.2, minOffcut: 200, boardTrim: 5, ebConfig: EMPTY_EB, labelScale: 1.0, projectName: '', clientName: '', result: null, isOptimizing: false, activeTab: 'boards', selectedBoardIndex: null }),
}));
