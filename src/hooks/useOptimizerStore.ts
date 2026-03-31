import { create } from 'zustand';
import { Pieza, StockSize, Remnant, OptimizationResult, OptimizerTab, UnitSystem } from '../lib/optimizer/types';
import { runOptimization } from '../lib/optimizer/engine';
import { exportOptimizerPDF } from '../lib/optimizer/pdfExport';

interface OptimizerState {
  pieces: Pieza[];
  stocks: StockSize[];
  remnants: Remnant[];
  globalSierra: number;
  minOffcut: number;
  projectName: string;
  clientName: string;
  result: OptimizationResult | null;
  isOptimizing: boolean;
  activeTab: OptimizerTab;
  unit: UnitSystem;
  selectedBoardIndex: number | null;
  setUnit: (u: UnitSystem) => void;
  addPiece: (p: Omit<Pieza, 'id'>) => void;
  removePiece: (id: string) => void;
  clearPieces: () => void;
  setPieces: (pieces: Pieza[]) => void; // Option C extension point — ProjectOptimizerPage will call this
  addStock: (s: Omit<StockSize, 'id'>) => void;
  removeStock: (id: string) => void;
  addRemnant: (r: Omit<Remnant, 'id'>) => void;
  removeRemnant: (id: string) => void;
  setActiveTab: (tab: OptimizerTab) => void;
  setSelectedBoard: (idx: number | null) => void;
  setProjectName: (name: string) => void;
  setClientName: (name: string) => void;
  setGlobalSierra: (v: number) => void;
  setMinOffcut: (v: number) => void;
  runOptimize: () => Promise<void>;
  exportPDF: () => void;
  saveProject: () => void;
  loadProject: (json: string) => void;
  reset: () => void;
}

const DEFAULT_STOCK: StockSize = {
  id: crypto.randomUUID(),
  nombre: '4×8 pies',
  ancho: 2440,
  alto: 1220,
  costo: 450,
  sierra: 3.2,
};

export const useOptimizerStore = create<OptimizerState>((set, get) => ({
  pieces: [],
  stocks: [DEFAULT_STOCK],
  remnants: [],
  globalSierra: 3.2,
  minOffcut: 200,
  projectName: '',
  clientName: '',
  unit: 'mm' as UnitSystem,
  result: null,
  isOptimizing: false,
  activeTab: 'boards',
  selectedBoardIndex: null,

  addPiece: (p) => set((state) => ({ pieces: [...state.pieces, { ...p, id: crypto.randomUUID() }] })),
  removePiece: (id) => set((state) => ({ pieces: state.pieces.filter((p) => p.id !== id) })),
  clearPieces: () => set({ pieces: [] }),
  setPieces: (pieces) => set({ pieces }), // Option C hook

  addStock: (s) => set((state) => ({ stocks: [...state.stocks, { ...s, id: crypto.randomUUID() }] })),
  removeStock: (id) => set((state) => ({ stocks: state.stocks.filter((s) => s.id !== id) })),
  addRemnant: (r) => set((state) => ({ remnants: [...state.remnants, { ...r, id: crypto.randomUUID() }] })),
  removeRemnant: (id) => set((state) => ({ remnants: state.remnants.filter((r) => r.id !== id) })),

  setUnit: (u) => set({ unit: u }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedBoard: (idx) => set({ selectedBoardIndex: idx }),
  setProjectName: (name) => set({ projectName: name }),
  setClientName: (name) => set({ clientName: name }),
  setGlobalSierra: (v) => set({ globalSierra: v }),
  setMinOffcut: (v) => set({ minOffcut: v }),

  runOptimize: async () => {
    const state = get();
    if (!state.pieces.length) { alert('Agrega al menos una pieza para optimizar'); return; }
    set({ isOptimizing: true });
    await new Promise((r) => setTimeout(r, 100)); // allow spinner to render
    try {
      const result = runOptimization(state.pieces, state.stocks, state.remnants, state.globalSierra, state.minOffcut);
      set({ result, isOptimizing: false });
    } catch (error) {
      console.error('Optimization error:', error);
      set({ isOptimizing: false });
      alert('Error durante la optimización: ' + String(error));
    }
  },

  exportPDF: () => {
    const state = get();
    if (!state.result) { alert('Ejecuta una optimización primero'); return; }
    exportOptimizerPDF(state.result, state.projectName, state.clientName, state.unit);
  },

  saveProject: () => {
    const state = get();
    const data = { version: '1.0', projectName: state.projectName, clientName: state.clientName, pieces: state.pieces, stocks: state.stocks, remnants: state.remnants, globalSierra: state.globalSierra, minOffcut: state.minOffcut };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${state.projectName || 'proyecto'}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  loadProject: (json) => {
    try {
      const data = JSON.parse(json);
      set({ projectName: data.projectName || '', clientName: data.clientName || '', pieces: data.pieces || [], stocks: data.stocks || [DEFAULT_STOCK], remnants: data.remnants || [], globalSierra: data.globalSierra || 3.2, minOffcut: data.minOffcut || 200 });
    } catch (error) { alert('Error cargando proyecto: ' + String(error)); }
  },

  reset: () => set({ pieces: [], stocks: [DEFAULT_STOCK], remnants: [], globalSierra: 3.2, minOffcut: 200, projectName: '', clientName: '', result: null, isOptimizing: false, activeTab: 'boards', selectedBoardIndex: null }),
}));
