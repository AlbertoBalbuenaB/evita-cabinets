// ─────────────────────────────────────────────────────────────
// OPTIMIZATION ENGINE — Maximal Rectangles + GRASP Multi-Strategy
// ─────────────────────────────────────────────────────────────

import { Pieza, StockSize, Remnant, BoardResult, PlacedPiece, FreeRectData, OptimizationResult, CutStep, UnitSystem } from './types';

// Local unit formatter — avoids importing units.ts into the engine bundle
const _fmtU = (v: number, unit: UnitSystem) =>
  unit === 'in' ? `${(v / 25.4).toFixed(3)}"` : `${v.toFixed(0)}mm`;

export const PIECE_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316',
  '#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6',
  '#a855f7','#d946ef','#10b981','#0ea5e9','#f472b6','#84cc16',
];

const HEURISTICS = ['bssf','baf','blsf','bl','lc'] as const;
type Heuristic = typeof HEURISTICS[number];
const GRASP_ITERS = 40;
const MIN_OFFCUT_DEFAULT = 200;

// ─────────────────────────────────────────────────────────────
// FREE RECT
// ─────────────────────────────────────────────────────────────
class FreeRect {
  x: number; y: number; w: number; h: number;
  constructor(x: number, y: number, w: number, h: number) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }
  fits(w: number, h: number): boolean { return this.w >= w && this.h >= h; }
  get area(): number { return this.w * this.h; }
}

// ─────────────────────────────────────────────────────────────
// BOARD
// ─────────────────────────────────────────────────────────────
class Board {
  ancho: number; alto: number; sierra: number;
  material: string; grosor: number; trim: number;
  stockInfo: { nombre: string; costo: number; isRemnant: boolean };
  placed: PlacedPiece[];
  freeRects: FreeRect[];
  offcuts: FreeRectData[];

  constructor(
    ancho: number, alto: number, sierra: number,
    material: string, grosor: number,
    stockInfo: { nombre: string; costo: number; isRemnant: boolean },
    trim = 0,
  ) {
    this.ancho = ancho; this.alto = alto; this.sierra = sierra;
    this.material = material; this.grosor = grosor; this.stockInfo = stockInfo;
    this.trim = trim;
    this.placed = [];
    const t = trim;
    this.freeRects = [new FreeRect(t, t, ancho - 2 * t, alto - 2 * t)];
    this.offcuts = [];
  }

  get areaTotal(): number {
    const usableW = this.ancho - 2 * this.trim;
    const usableH = this.alto - 2 * this.trim;
    return (usableW * usableH) / 1e6;
  }
  get areaUsed(): number  { return this.placed.reduce((s, p) => s + (p.w * p.h) / 1e6, 0); }
  get areaWaste(): number { return this.areaTotal - this.areaUsed; }
  get usage(): number     { return this.areaTotal ? (this.areaUsed / this.areaTotal) * 100 : 0; }

  toResult(): BoardResult {
    return {
      ancho: this.ancho, alto: this.alto, sierra: this.sierra,
      material: this.material, grosor: this.grosor, stockInfo: this.stockInfo,
      placed: this.placed, offcuts: this.offcuts,
      areaTotal: this.areaTotal, areaUsed: this.areaUsed,
      areaWaste: this.areaWaste, usage: this.usage,
      trim: this.trim,
    };
  }

  findBest(pw: number, ph: number, heuristic: Heuristic): FreeRect | null {
    let best: FreeRect | null = null;
    let bs = Infinity, bs2 = Infinity;
    for (const r of this.freeRects) {
      if (!r.fits(pw, ph)) continue;
      const sw = r.w - pw, sh = r.h - ph;
      let s: number, s2: number;
      if (heuristic === 'bssf')      { s = Math.min(sw, sh); s2 = Math.max(sw, sh); }
      else if (heuristic === 'baf')  { s = r.w * r.h - pw * ph; s2 = Math.min(sw, sh); }
      else if (heuristic === 'blsf') { s = Math.max(sw, sh); s2 = Math.min(sw, sh); }
      else if (heuristic === 'lc')   { s = r.x; s2 = r.y; }
      else                           { s = r.y; s2 = r.x; }
      if (s < bs || (s === bs && s2 < bs2)) { bs = s; bs2 = s2; best = r; }
    }
    return best;
  }

  place(piece: Pieza, pw: number, ph: number, rotated: boolean, idx: number, heuristic: Heuristic): boolean {
    const r = this.findBest(pw, ph, heuristic);
    if (!r) return false;
    this.placed.push({ piece, x: r.x, y: r.y, w: pw, h: ph, rotated, idx });
    const kw = Math.min(pw + this.sierra, this.ancho - r.x);
    const kh = Math.min(ph + this.sierra, this.alto - r.y);
    this._splitMaxRect(r.x, r.y, kw, kh);
    return true;
  }

  private _splitMaxRect(px: number, py: number, pw: number, ph: number): void {
    const added: FreeRect[] = [];
    let i = 0;
    while (i < this.freeRects.length) {
      const r = this.freeRects[i];
      if (!(r.x >= px + pw || r.x + r.w <= px || r.y >= py + ph || r.y + r.h <= py)) {
        this.freeRects.splice(i, 1);
        if (r.x < px)           { const w = px - r.x;               if (w >= 10) added.push(new FreeRect(r.x,    r.y,    w,    r.h)); }
        if (r.x + r.w > px + pw){ const w = r.x + r.w - px - pw;    if (w >= 10) added.push(new FreeRect(px + pw, r.y,    w,    r.h)); }
        if (r.y < py)           { const h = py - r.y;               if (h >= 10) added.push(new FreeRect(r.x,    r.y,    r.w,  h)); }
        if (r.y + r.h > py + ph){ const h = r.y + r.h - py - ph;   if (h >= 10) added.push(new FreeRect(r.x,    py + ph, r.w, h)); }
      } else { i++; }
    }
    this.freeRects.push(...added);
    this._prune();
  }

  private _prune(): void {
    let i = 0;
    while (i < this.freeRects.length) {
      const a = this.freeRects[i];
      let del = false;
      for (let j = 0; j < this.freeRects.length; j++) {
        if (i !== j) {
          const b = this.freeRects[j];
          if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) {
            this.freeRects.splice(i, 1); del = true; break;
          }
        }
      }
      if (!del) i++;
    }
  }

  calcOffcuts(minOff = MIN_OFFCUT_DEFAULT): FreeRectData[] {
    this.offcuts = this.freeRects
      .filter(r => r.w >= minOff && r.h >= minOff)
      .map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h }));
    return this.offcuts;
  }
}

// ─────────────────────────────────────────────────────────────
// OPTIMIZER
// ─────────────────────────────────────────────────────────────
class Optimizer {
  private stocks: StockSize[];
  private remnants: (Remnant & { _used?: boolean })[];
  private sierra: number;
  private minOff: number;
  private trim: number;
  bestStrategy = '';
  iters = 0;
  time = 0;

  constructor(stocks: StockSize[], remnants: Remnant[], sierra: number, minOff = MIN_OFFCUT_DEFAULT, trim = 0) {
    this.stocks = stocks;
    this.remnants = remnants.map(r => ({ ...r, _used: false }));
    this.sierra = sierra;
    this.minOff = minOff;
    this.trim = trim;
  }

  run(pieces: Pieza[]): Board[] {
    const t0 = performance.now();
    let seed = 42;
    const rng = (): number => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    const expanded: (Pieza & { _idx: number })[] = [];
    pieces.forEach((p, i) => {
      for (let c = 0; c < p.cantidad; c++) expanded.push({ ...p, _idx: i });
    });

    const groups: Record<string, typeof expanded> = {};
    expanded.forEach(p => {
      const k = `${p.material}_${p.grosor}`;
      (groups[k] = groups[k] || []).push(p);
    });

    const allBoards: Board[] = [];
    for (const k in groups) {
      const g = groups[k];
      const best = this._optGroup(g, g[0].material, g[0].grosor, rng);
      allBoards.push(...best);
    }
    allBoards.forEach(b => b.calcOffcuts(this.minOff));
    this.time = performance.now() - t0;
    return allBoards;
  }

  private _optGroup(
    group: (Pieza & { _idx: number })[],
    mat: string, grs: number,
    rng: () => number
  ): Board[] {
    type SortFn = (a: Pieza, b: Pieza) => number;
    const sorts: [string, SortFn][] = [
      ['area',  (a, b) => (b.ancho * b.alto - a.ancho * a.alto) || (Math.max(b.ancho, b.alto) - Math.max(a.ancho, a.alto))],
      ['lado',  (a, b) => (Math.max(b.ancho, b.alto) - Math.max(a.ancho, a.alto)) || (b.ancho * b.alto - a.ancho * a.alto)],
      ['perim', (a, b) => (b.ancho + b.alto) - (a.ancho + a.alto) || (b.ancho * b.alto - a.ancho * a.alto)],
      ['ancho', (a, b) => b.ancho - a.ancho || b.alto - a.alto],
      ['alto',  (a, b) => b.alto - a.alto || b.ancho - a.ancho],
      ['cuad',  (a, b) => Math.abs(b.ancho - b.alto) - Math.abs(a.ancho - a.alto) || (b.ancho * b.alto - a.ancho * a.alto)],
      ['colW',  (a, b) => Math.round(b.ancho / 100) * 100 - Math.round(a.ancho / 100) * 100 || b.alto - a.alto],
      ['colH',  (a, b) => Math.round(b.alto / 100) * 100 - Math.round(a.alto / 100) * 100 || b.ancho - a.ancho],
    ];

    let best: Board[] | null = null;
    let bestScore = Infinity;
    let bestName = '';
    let totalIters = 0;

    for (const [sn, sf] of sorts) {
      const sorted = [...group].sort(sf);
      for (const h of HEURISTICS) {
        const bds = this._build(sorted, mat, grs, h);
        const sc  = this._score(bds);
        totalIters++;
        if (sc < bestScore) { bestScore = sc; best = bds; bestName = `${sn}+${h}`; }
      }
    }

    for (let g = 0; g < GRASP_ITERS; g++) {
      const si = Math.floor(rng() * sorts.length);
      const hi = Math.floor(rng() * HEURISTICS.length);
      const [sn, sf] = sorts[si];
      const sorted  = [...group].sort(sf);
      const shuffled = this._shuffleWin(sorted, rng);
      const bds  = this._build(shuffled, mat, grs, HEURISTICS[hi]);
      const sc   = this._score(bds);
      totalIters++;
      if (sc < bestScore) { bestScore = sc; best = bds; bestName = `GRASP(${sn}+${HEURISTICS[hi]})`; }
    }

    if (best && best.length > 1) {
      const improved = this._localSearch(best, mat, grs);
      if (this._score(improved) < bestScore) { best = improved; bestName += ' +local'; }
    }

    this.iters += totalIters;
    this.bestStrategy = bestName;
    return best || [];
  }

  private _getStocksFor(mat: string, grs: number): {
    nombre: string; ancho: number; alto: number; costo: number; sierra: number;
    isRemnant: boolean; remnantId?: string; _used?: boolean;
    stockId?: string; qty?: number;
  }[] {
    const rems = this.remnants
      .filter(r => r.material === mat && r.grosor === grs && !r._used)
      .map(r => ({
        nombre: `Remnant ${r.ancho}×${r.alto}`,
        ancho: r.ancho, alto: r.alto, costo: 0, sierra: this.sierra,
        isRemnant: true, remnantId: r.id, _used: r._used,
      }));
    const stk = this.stocks.map(s => ({ ...s, isRemnant: false, stockId: s.id }));
    return [...rems, ...stk.sort((a, b) => a.costo - b.costo)];
  }

  private _build(pcs: (Pieza & { _idx: number })[], mat: string, grs: number, heuristic: Heuristic): Board[] {
    const boards: Board[] = [];
    const availStocks = this._getStocksFor(mat, grs);
    if (!availStocks.length) return [];

    // Track usage count per stockId for qty limits
    const usageCount: Record<string, number> = {};

    for (const p of pcs) {
      const fitsN = (s: { ancho: number; alto: number }) => p.ancho <= s.ancho && p.alto <= s.alto;
      const fitsR = (s: { ancho: number; alto: number }) => !p.vetaHorizontal && p.alto <= s.ancho && p.ancho <= s.alto;

      let bestBoard: Board | null = null;
      let bestS = Infinity, bestS2 = Infinity, bestRot = false;

      for (const b of boards) {
        if (fitsN(b)) {
          const r = b.findBest(p.ancho, p.alto, heuristic);
          if (r) {
            const [s1, s2] = this._espScore(r, p.ancho, p.alto, heuristic);
            if (s1 < bestS || (s1 === bestS && s2 < bestS2)) { bestS = s1; bestS2 = s2; bestBoard = b; bestRot = false; }
          }
        }
        if (fitsR(b)) {
          const r = b.findBest(p.alto, p.ancho, heuristic);
          if (r) {
            const [s1, s2] = this._espScore(r, p.alto, p.ancho, heuristic);
            if (s1 < bestS || (s1 === bestS && s2 < bestS2)) { bestS = s1; bestS2 = s2; bestBoard = b; bestRot = true; }
          }
        }
      }

      if (bestBoard) {
        if (bestRot) bestBoard.place(p, p.alto, p.ancho, true,  p._idx, heuristic);
        else         bestBoard.place(p, p.ancho, p.alto, false, p._idx, heuristic);
        continue;
      }

      let placed = false;
      for (const st of availStocks) {
        if (st.isRemnant && st._used) continue;
        // Check qty limit (0 = unlimited)
        if (st.stockId && st.qty && st.qty > 0) {
          if ((usageCount[st.stockId] || 0) >= st.qty) continue;
        }
        const sierra = st.sierra || this.sierra;
        const nb = new Board(st.ancho, st.alto, sierra, mat, grs, {
          nombre: st.nombre, costo: st.costo, isRemnant: !!st.isRemnant,
        }, this.trim);
        const fn = p.ancho <= st.ancho && p.alto <= st.alto;
        const fr = !p.vetaHorizontal && p.alto <= st.ancho && p.ancho <= st.alto;
        if (fn && nb.place(p, p.ancho, p.alto, false, p._idx, heuristic)) {
          boards.push(nb); if (st.isRemnant) st._used = true;
          if (st.stockId) usageCount[st.stockId] = (usageCount[st.stockId] || 0) + 1;
          placed = true; break;
        }
        if (fr && nb.place(p, p.alto, p.ancho, true,  p._idx, heuristic)) {
          boards.push(nb); if (st.isRemnant) st._used = true;
          if (st.stockId) usageCount[st.stockId] = (usageCount[st.stockId] || 0) + 1;
          placed = true; break;
        }
      }
      if (!placed) {
        console.warn(`Piece ${p.nombre || p.ancho + 'x' + p.alto} does not fit any stock size`);
      }
    }
    return boards;
  }

  private _espScore(r: { x: number; y: number; w: number; h: number }, w: number, h: number, heuristic: Heuristic): [number, number] {
    const sw = r.w - w, sh = r.h - h;
    if (heuristic === 'bssf') return [Math.min(sw, sh), Math.max(sw, sh)];
    if (heuristic === 'baf')  return [r.w * r.h - w * h, Math.min(sw, sh)];
    if (heuristic === 'blsf') return [Math.max(sw, sh), Math.min(sw, sh)];
    if (heuristic === 'lc')   return [r.x, r.y];
    return [r.y, r.x];
  }

  private _score(bds: Board[] | null): number {
    if (!bds || !bds.length) return Infinity;
    const cost  = bds.reduce((s, b) => s + (b.stockInfo ? b.stockInfo.costo : 0), 0);
    const waste = bds.reduce((s, b) => s + b.areaWaste, 0);
    return bds.length * 1e6 + cost * 1e3 + waste * 100;
  }

  private _shuffleWin(arr: (Pieza & { _idx: number })[], rng: () => number): (Pieza & { _idx: number })[] {
    const r = [...arr];
    const w = Math.max(3, Math.floor(r.length / 5));
    for (let i = 0; i < r.length; i += w) {
      const end = Math.min(i + w, r.length);
      for (let j = end - 1; j > i; j--) {
        const k = i + Math.floor(rng() * (j - i + 1));
        [r[j], r[k]] = [r[k], r[j]];
      }
    }
    return r;
  }

  private _localSearch(bds: Board[], mat: string, grs: number): Board[] {
    let boards = [...bds];
    let improved = true;
    while (improved && boards.length > 1) {
      improved = false;
      boards.sort((a, b) => a.usage - b.usage);
      for (let wi = 0; wi < Math.min(3, boards.length) && !improved; wi++) {
        const pcs = boards[wi].placed.map(p => ({ ...p }));
        const others = boards.filter((_, i) => i !== wi);
        for (const h of HEURISTICS) {
          const copies = others.map(ob => {
            const nb = new Board(ob.ancho, ob.alto, ob.sierra, ob.material, ob.grosor, ob.stockInfo, this.trim);
            for (const p of ob.placed) nb.place(p.piece, p.w, p.h, p.rotated, p.idx, h);
            return nb;
          });
          let allOk = true;
          for (const pp of pcs) {
            let ok = false;
            for (const tb of copies) {
              if (tb.place(pp.piece, pp.w, pp.h, pp.rotated, pp.idx, h)) { ok = true; break; }
              if (!pp.piece.vetaHorizontal) {
                if (tb.place(pp.piece, pp.h, pp.w, !pp.rotated, pp.idx, h)) { ok = true; break; }
              }
            }
            if (!ok) { allOk = false; break; }
          }
          if (allOk) { boards = copies; improved = true; break; }
        }
      }
    }
    if (boards.length > 1) {
      for (let iter = 0; iter < 8; iter++) {
        boards.sort((a, b) => a.usage - b.usage);
        let moved = false;
        outer: for (let si = 0; si < Math.min(2, boards.length - 1); si++) {
          const src = boards[si];
          for (const pp of [...src.placed]) {
            for (let ti = si + 1; ti < boards.length; ti++) {
              const tgt = boards[ti];
              const nt = new Board(tgt.ancho, tgt.alto, tgt.sierra, tgt.material, tgt.grosor, tgt.stockInfo, this.trim);
              for (const p of tgt.placed) nt.place(p.piece, p.w, p.h, p.rotated, p.idx, 'baf');
              const fits =
                nt.place(pp.piece, pp.w, pp.h, pp.rotated, pp.idx, 'baf') ||
                (!pp.piece.vetaHorizontal && nt.place(pp.piece, pp.h, pp.w, !pp.rotated, pp.idx, 'baf'));
              if (fits) {
                const ns = new Board(src.ancho, src.alto, src.sierra, src.material, src.grosor, src.stockInfo, this.trim);
                let srcOk = true;
                for (const p of src.placed) {
                  if (p === pp) continue;
                  if (!ns.place(p.piece, p.w, p.h, p.rotated, p.idx, 'baf')) { srcOk = false; break; }
                }
                if (srcOk) {
                  const trial = [...boards]; trial[si] = ns; trial[ti] = nt;
                  if (this._score(trial) < this._score(boards)) { boards = trial; moved = true; break outer; }
                }
              }
            }
          }
        }
        if (!moved) break;
      }
    }
    return boards;
  }
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────
export function runOptimization(
  pieces: Pieza[],
  stocks: StockSize[],
  remnants: Remnant[],
  globalSierra = 3.2,
  minOffcut = 200,
  boardTrim = 0,
): OptimizationResult {
  const opt = new Optimizer(stocks, remnants, globalSierra, minOffcut, boardTrim);
  const boards = opt.run(pieces);
  const boardResults = boards.map(b => b.toResult());

  const totalArea   = boardResults.reduce((s, b) => s + b.areaTotal, 0);
  const usedArea    = boardResults.reduce((s, b) => s + b.areaUsed, 0);
  const totalPieces = pieces.reduce((s, p) => s + p.cantidad, 0);
  const totalCost   = boardResults.reduce((s, b) => s + b.stockInfo.costo, 0);
  const usefulOffcuts = boardResults.reduce((s, b) => s + b.offcuts.length, 0);

  return {
    boards: boardResults,
    totalPieces,
    efficiency: totalArea > 0 ? (usedArea / totalArea) * 100 : 0,
    totalCost,
    timeMs: opt.time,
    strategy: opt.bestStrategy,
    usefulOffcuts,
  };
}

// ─────────────────────────────────────────────────────────────
// GUILLOTINE CUT SEQUENCE
// ─────────────────────────────────────────────────────────────
export function generateCutSequence(board: BoardResult, unit: UnitSystem = 'mm'): CutStep[] {
  const cuts: CutStep[] = [];
  let cutN = 1;

  // ── Trim cuts (edge trimming) ──
  if (board.trim > 0) {
    const t = board.trim;
    cuts.push({ n: cutN++, type: 'H', pos: t,              desc: `y=${_fmtU(t, unit)} — orillado superior`,            isTrim: true });
    cuts.push({ n: cutN++, type: 'H', pos: board.alto - t, desc: `y=${_fmtU(board.alto - t, unit)} — orillado inferior`, isTrim: true });
    cuts.push({ n: cutN++, type: 'V', pos: t,              desc: `x=${_fmtU(t, unit)} — orillado izquierdo`,            isTrim: true });
    cuts.push({ n: cutN++, type: 'V', pos: board.ancho - t, desc: `x=${_fmtU(board.ancho - t, unit)} — orillado derecho`, isTrim: true });
  }

  // ── Piece cuts ──
  const pcs = [...board.placed].sort((a, b) => a.y - b.y || a.x - b.x);
  if (!pcs.length) return cuts;

  const ySet = new Set([0, board.alto]);
  pcs.forEach(p => { ySet.add(p.y); ySet.add(p.y + p.h); });
  const ys = [...ySet].sort((a, b) => a - b);
  const validH = ys.filter(y => y > 0 && y < board.alto && !pcs.some(p => p.y < y && p.y + p.h > y));

  const boundaries = [0, ...validH, board.alto];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const y1 = boundaries[i], y2 = boundaries[i + 1];
    if (i > 0) cuts.push({ n: cutN++, type: 'H', pos: y1, desc: `Corte horizontal a ${_fmtU(y1, unit)} del borde superior` });
    const strip = pcs.filter(p => p.y >= y1 && p.y + p.h <= y2).sort((a, b) => a.x - b.x);
    const xSet = new Set<number>();
    strip.forEach(p => { xSet.add(p.x); xSet.add(p.x + p.w); });
    [...xSet].sort((a, b) => a - b).filter(x => x > 0 && x < board.ancho).forEach(x => {
      if (!strip.some(p => p.x < x && p.x + p.w > x))
        cuts.push({ n: cutN++, type: 'V', pos: x, desc: `  Corte vertical a ${_fmtU(x, unit)} (franja ${_fmtU(y1, unit)}–${_fmtU(y2, unit)})` });
    });
  }
  return cuts;
}

// ─────────────────────────────────────────────────────────────
// CANVAS THUMBNAIL RENDERER
// ─────────────────────────────────────────────────────────────
export function renderBoardThumbnail(
  canvas: HTMLCanvasElement,
  board: BoardResult,
  opts: { maxW?: number; maxH?: number; padding?: number; showLabels?: boolean; unit?: UnitSystem } = {}
): void {
  const { maxW = 440, maxH = 260, padding = 16, showLabels = true, unit = 'mm' } = opts;
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min((maxW - padding * 2) / board.ancho, (maxH - padding * 2) / board.alto);
  const bw = board.ancho * scale, bh = board.alto * scale;
  canvas.width  = (bw + padding * 2) * dpr;
  canvas.height = (bh + padding * 2) * dpr;
  canvas.style.width  = `${bw + padding * 2}px`;
  canvas.style.height = `${bh + padding * 2}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const ox = padding, oy = padding;

  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  _roundRect(ctx, ox - 1, oy - 1, bw + 2, bh + 2, 4); ctx.fill(); ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,.03)'; ctx.lineWidth = .5;
  const gs = 100 * scale;
  for (let gx = gs; gx < bw; gx += gs) { ctx.beginPath(); ctx.moveTo(ox + gx, oy); ctx.lineTo(ox + gx, oy + bh); ctx.stroke(); }
  for (let gy = gs; gy < bh; gy += gs) { ctx.beginPath(); ctx.moveTo(ox, oy + gy); ctx.lineTo(ox + bw, oy + gy); ctx.stroke(); }

  // Trim margin visualization
  if (board.trim > 0) {
    const t = board.trim;
    ctx.fillStyle = 'rgba(100,116,139,0.10)';
    ctx.fillRect(ox, oy, bw, t * scale);
    ctx.fillRect(ox, oy + (board.alto - t) * scale, bw, t * scale);
    ctx.fillRect(ox, oy + t * scale, t * scale, (board.alto - 2 * t) * scale);
    ctx.fillRect(ox + (board.ancho - t) * scale, oy + t * scale, t * scale, (board.alto - 2 * t) * scale);
    ctx.strokeStyle = 'rgba(100,116,139,0.35)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(ox + t * scale, oy + t * scale, (board.ancho - 2*t) * scale, (board.alto - 2*t) * scale);
    ctx.setLineDash([]);
  }

  board.placed.forEach((p) => {
    const x = ox + p.x * scale, y = oy + p.y * scale, w = p.w * scale, h = p.h * scale;
    const color = PIECE_COLORS[p.idx % PIECE_COLORS.length];
    ctx.fillStyle = color;
    _roundRect(ctx, x + .5, y + .5, w - 1, h - 1, 2); ctx.fill();

    if (p.piece.vetaHorizontal) {
      ctx.save(); ctx.globalAlpha = .15; ctx.strokeStyle = '#fff'; ctx.lineWidth = .5; ctx.beginPath();
      const dir = p.rotated ? 'V' : 'H';
      if (dir === 'H') { for (let dy = 4; dy < h; dy += 5) { ctx.moveTo(x + 2, y + dy); ctx.lineTo(x + w - 2, y + dy); } }
      else             { for (let dx = 4; dx < w; dx += 5) { ctx.moveTo(x + dx, y + 2); ctx.lineTo(x + dx, y + h - 2); } }
      ctx.stroke(); ctx.restore();
    }

    if (showLabels && w > 30 && h > 18) {
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      _roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 1); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = unit === 'in'
        ? `${(p.piece.ancho / 25.4).toFixed(1)}×${(p.piece.alto / 25.4).toFixed(1)}`
        : `${p.piece.ancho}×${p.piece.alto}`;
      const fz = Math.min(10, Math.min(w / label.length * 1.4, h * .35));
      ctx.font = `600 ${fz}px system-ui`;
      ctx.fillText(label, x + w / 2, y + h / 2 - (p.piece.nombre && h > 30 ? 4 : 0), w - 6);
      if (p.piece.nombre && h > 30 && fz >= 7) {
        ctx.font = `${fz * .8}px system-ui`; ctx.globalAlpha = .7;
        ctx.fillText(p.piece.nombre, x + w / 2, y + h / 2 + fz * .6, w - 6); ctx.globalAlpha = 1;
      }
      if (p.rotated && w > 24 && h > 14) {
        ctx.font = `${Math.min(8, fz * .7)}px system-ui`; ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'right';
        ctx.fillText('R', x + w - 4, y + 10);
      }
    }
  });

  board.offcuts.forEach(r => {
    ctx.strokeStyle = 'rgba(34,197,94,.4)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.strokeRect(ox + r.x * scale, oy + r.y * scale, r.w * scale, r.h * scale);
    ctx.setLineDash([]);
  });

  ctx.fillStyle = '#64748b'; ctx.font = '10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(_fmtU(board.ancho, unit), ox + bw / 2, oy + bh + 4);
  ctx.save(); ctx.translate(ox - 4, oy + bh / 2); ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'bottom'; ctx.fillText(_fmtU(board.alto, unit), 0, 0); ctx.restore();
}

function _roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

// ─────────────────────────────────────────────────────────────
// CAD VIEWER RENDER — full interactive board renderer
// ─────────────────────────────────────────────────────────────

export interface CADRenderOptions {
  zoom: number;
  offsetX: number;
  offsetY: number;
  showLabels: boolean;
  showDimensions: boolean;
  showKerf: boolean;
  showOffcuts: boolean;
  showGrain: boolean;
  showEdgeBand: boolean;
  hoverPieceIdx: number | null;
  unit: UnitSystem;
}

export function renderBoardCAD(
  canvas: HTMLCanvasElement,
  board: BoardResult,
  opts: CADRenderOptions,
): void {
  const { zoom, offsetX, offsetY, showLabels, showDimensions, showKerf, showOffcuts, showGrain, showEdgeBand, hoverPieceIdx, unit } = opts;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.offsetWidth || 800;
  const cssH = canvas.clientHeight || canvas.offsetHeight || 600;

  const targetW = Math.round(cssW * dpr);
  const targetH = Math.round(cssH * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  const bw = board.ancho;
  const bh = board.alto;

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, cssW, cssH);
  ctx.clip();

  const ox = offsetX;
  const oy = offsetY;
  const scaledW = bw * zoom;
  const scaledH = bh * zoom;

  // Board shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ox, oy, scaledW, scaledH);
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ox, oy, scaledW, scaledH);

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(ox, oy, scaledW, scaledH);

  // ── Board grain (always horizontal — along the length) ────
  if (showGrain) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 0.5;
    const grainStep = Math.max(4, 6 * zoom);
    for (let gy = grainStep; gy < scaledH; gy += grainStep) {
      ctx.beginPath();
      ctx.moveTo(ox + 2, oy + gy);
      ctx.lineTo(ox + scaledW - 2, oy + gy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Trim margin ───────────────────────────────────────────
  if (board.trim > 0) {
    const t = board.trim;
    ctx.fillStyle = 'rgba(100,116,139,0.09)';
    ctx.fillRect(ox, oy, scaledW, t * zoom);
    ctx.fillRect(ox, oy + (bh - t) * zoom, scaledW, t * zoom);
    ctx.fillRect(ox, oy + t * zoom, t * zoom, (bh - 2*t) * zoom);
    ctx.fillRect(ox + (bw - t) * zoom, oy + t * zoom, t * zoom, (bh - 2*t) * zoom);
    ctx.strokeStyle = 'rgba(100,116,139,0.40)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(ox + t * zoom, oy + t * zoom, (bw - 2*t) * zoom, (bh - 2*t) * zoom);
    ctx.setLineDash([]);
  }

  // ── Pieces ────────────────────────────────────────────────
  board.placed.forEach((p, placedIdx) => {
    const color = PIECE_COLORS[p.idx % PIECE_COLORS.length];
    const px = ox + p.x * zoom;
    const py = oy + p.y * zoom;
    const pw = p.w * zoom;
    const ph = p.h * zoom;

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    ctx.fillRect(px, py, pw, ph);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 0.75, py + 0.75, pw - 1.5, ph - 1.5);

    // ── Grain direction on piece ────────────────────────────
    if (showGrain && p.piece.vetaHorizontal) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 0.7;
      if (p.rotated) {
        const step = Math.max(3, 5 * zoom);
        for (let dx = step; dx < pw; dx += step) {
          ctx.beginPath(); ctx.moveTo(px + dx, py + 2); ctx.lineTo(px + dx, py + ph - 2); ctx.stroke();
        }
      } else {
        const step = Math.max(3, 5 * zoom);
        for (let dy = step; dy < ph; dy += step) {
          ctx.beginPath(); ctx.moveTo(px + 2, py + dy); ctx.lineTo(px + pw - 2, py + dy); ctx.stroke();
        }
      }
      ctx.restore();
    }

    // ── Edge banding indicators (3 types, drawn inside piece) ─
    if (showEdgeBand) {
      const cb = p.piece.cubrecanto;
      const edges = p.rotated
        ? { top: cb.izq, bottom: cb.der, left: cb.sup, right: cb.inf }
        : { top: cb.sup, bottom: cb.inf, left: cb.izq, right: cb.der };
      const inset = 4; // px inset from piece edge
      const drawEB = (type: number, x1: number, y1: number, x2: number, y2: number) => {
        if (!type) return;
        ctx.save();
        ctx.lineWidth = 2.5;
        // Type 1 = solid black, Type 2 = dashed, Type 3 = dotted
        if (type === 1)      { ctx.strokeStyle = '#1e293b'; ctx.setLineDash([]); }
        else if (type === 2) { ctx.strokeStyle = '#1e293b'; ctx.setLineDash([6, 3]); }
        else                 { ctx.strokeStyle = '#1e293b'; ctx.setLineDash([2, 2]); }
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      };
      drawEB(edges.top,    px + inset, py + inset,      px + pw - inset, py + inset);
      drawEB(edges.bottom, px + inset, py + ph - inset,  px + pw - inset, py + ph - inset);
      drawEB(edges.left,   px + inset, py + inset,      px + inset,      py + ph - inset);
      drawEB(edges.right,  px + pw - inset, py + inset, px + pw - inset, py + ph - inset);
    }

    // Labels
    if (showLabels && pw > 28 && ph > 16) {
      const fontSize = Math.min(13, Math.max(8, Math.min(pw / 5.5, ph / 3)));
      ctx.fillStyle = '#1e293b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = px + pw / 2;
      const cy = py + ph / 2;
      const dimLabel = `${_fmtU(p.piece.ancho, unit)}×${_fmtU(p.piece.alto, unit)}`;
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      const hasName = p.piece.nombre && ph > 30;
      ctx.fillText(dimLabel, cx, cy - (hasName ? fontSize * 0.65 : 0));
      if (hasName) {
        ctx.fillStyle = '#64748b';
        ctx.font = `${fontSize * 0.85}px system-ui, sans-serif`;
        ctx.fillText(p.piece.nombre, cx, cy + fontSize * 0.65);
      }
    }

    // ── Hover per-piece dimension annotations ───────────────
    if (hoverPieceIdx === placedIdx) {
      ctx.save();
      const dc = '#1d4ed8';
      const bg = 'rgba(255,255,255,0.85)';
      ctx.strokeStyle = dc; ctx.fillStyle = dc;
      ctx.lineWidth = 1; ctx.setLineDash([]); ctx.font = 'bold 9px system-ui, sans-serif';
      const al = 4;

      // Width (top)
      const wY = py - 10;
      ctx.beginPath(); ctx.moveTo(px, py - 2); ctx.lineTo(px, wY - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + pw, py - 2); ctx.lineTo(px + pw, wY - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, wY); ctx.lineTo(px + pw, wY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, wY); ctx.lineTo(px + al, wY - 2); ctx.lineTo(px + al, wY + 2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + pw, wY); ctx.lineTo(px + pw - al, wY - 2); ctx.lineTo(px + pw - al, wY + 2); ctx.closePath(); ctx.fill();
      const wL = _fmtU(p.piece.ancho, unit);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const wm = ctx.measureText(wL);
      ctx.fillStyle = bg; ctx.fillRect((2*px + pw) / 2 - wm.width / 2 - 3, wY - 13, wm.width + 6, 12);
      ctx.fillStyle = dc; ctx.fillText(wL, (2*px + pw) / 2, wY - 2);

      // Height (right)
      const hX = px + pw + 10;
      ctx.beginPath(); ctx.moveTo(px + pw + 2, py); ctx.lineTo(hX + 2, py); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + pw + 2, py + ph); ctx.lineTo(hX + 2, py + ph); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hX, py); ctx.lineTo(hX, py + ph); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hX, py); ctx.lineTo(hX - 2, py + al); ctx.lineTo(hX + 2, py + al); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hX, py + ph); ctx.lineTo(hX - 2, py + ph - al); ctx.lineTo(hX + 2, py + ph - al); ctx.closePath(); ctx.fill();
      const hL = _fmtU(p.piece.alto, unit);
      ctx.save();
      ctx.translate(hX + 5, (2*py + ph) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const hm = ctx.measureText(hL);
      ctx.fillStyle = bg; ctx.fillRect(-hm.width / 2 - 3, -12, hm.width + 6, 12);
      ctx.fillStyle = dc; ctx.fillText(hL, 0, 0);
      ctx.restore();

      ctx.restore();
    }
  });

  // ── Offcuts ───────────────────────────────────────────────
  if (showOffcuts) {
    ctx.strokeStyle = 'rgba(34,197,94,0.65)';
    ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
    board.offcuts.forEach((r) => {
      ctx.strokeRect(ox + r.x * zoom + 1, oy + r.y * zoom + 1, r.w * zoom - 2, r.h * zoom - 2);
    });
    ctx.setLineDash([]);
  }

  // ── Kerf lines ────────────────────────────────────────────
  if (showKerf) {
    const cuts = generateCutSequence(board, unit);
    ctx.strokeStyle = 'rgba(239,68,68,0.65)';
    ctx.lineWidth = Math.max(1, board.sierra * zoom);
    ctx.setLineDash([]);
    cuts.forEach((cut) => {
      if (cut.isTrim) return;
      ctx.beginPath();
      if (cut.type === 'H') { ctx.moveTo(ox, oy + cut.pos * zoom); ctx.lineTo(ox + scaledW, oy + cut.pos * zoom); }
      else { ctx.moveTo(ox + cut.pos * zoom, oy); ctx.lineTo(ox + cut.pos * zoom, oy + scaledH); }
      ctx.stroke();
    });
  }

  ctx.restore(); // end clip

  // ── Board dimension annotations (cotas) ───────────────────
  if (showDimensions) {
    const dimOff = 18; const al = 6;
    const bL = ox, bR = ox + scaledW, bT = oy, bB = oy + scaledH;
    ctx.strokeStyle = '#475569'; ctx.fillStyle = '#334155';
    ctx.lineWidth = 1; ctx.setLineDash([]); ctx.font = 'bold 10px system-ui, sans-serif';
    // Horizontal (bottom)
    const hY = bB + dimOff;
    ctx.beginPath(); ctx.moveTo(bL, bB + 4); ctx.lineTo(bL, hY + 4); ctx.moveTo(bR, bB + 4); ctx.lineTo(bR, hY + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bL, hY); ctx.lineTo(bR, hY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bL, hY); ctx.lineTo(bL + al, hY - 3); ctx.lineTo(bL + al, hY + 3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bR, hY); ctx.lineTo(bR - al, hY - 3); ctx.lineTo(bR - al, hY + 3); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(_fmtU(board.ancho, unit), (bL + bR) / 2, hY + 3);
    // Vertical (left)
    const vX = bL - dimOff;
    ctx.beginPath(); ctx.moveTo(bL - 4, bT); ctx.lineTo(vX - 4, bT); ctx.moveTo(bL - 4, bB); ctx.lineTo(vX - 4, bB); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vX, bT); ctx.lineTo(vX, bB); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vX, bT); ctx.lineTo(vX - 3, bT + al); ctx.lineTo(vX + 3, bT + al); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(vX, bB); ctx.lineTo(vX - 3, bB - al); ctx.lineTo(vX + 3, bB - al); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(vX - 5, (bT + bB) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(_fmtU(board.alto, unit), 0, 0); ctx.restore();
  }
}

/** Find which placed piece index the mouse is hovering over */
export function hitTestPiece(
  board: BoardResult, zoom: number, offsetX: number, offsetY: number,
  mouseX: number, mouseY: number,
): number | null {
  for (let i = board.placed.length - 1; i >= 0; i--) {
    const p = board.placed[i];
    const px = offsetX + p.x * zoom;
    const py = offsetY + p.y * zoom;
    if (mouseX >= px && mouseX <= px + p.w * zoom && mouseY >= py && mouseY <= py + p.h * zoom) return i;
  }
  return null;
}
