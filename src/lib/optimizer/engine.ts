// ─────────────────────────────────────────────────────────────
// OPTIMIZATION ENGINE — Maximal Rectangles + GRASP Multi-Strategy
// ─────────────────────────────────────────────────────────────

import { Pieza, StockSize, Remnant, BoardResult, PlacedPiece, FreeRectData, OptimizationResult, CutStep, UnitSystem, GuillotineCut, CutTreeNode, EngineMode, OptimizationObjective } from './types';
import { sanitizeOptimizerInputs, MAX_ENGINE_MS } from './sanitizeOptimizerInputs';

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
const GUILLOTINE_ITERS = 20;
const MIN_OFFCUT_DEFAULT = 200;
const MIN_USEFUL_STRIP = 80; // mm — thin-strip penalty threshold for guillotine scoring

// ─────────────────────────────────────────────────────────────
// TYPED ENTRY — internal packing representation
// ─────────────────────────────────────────────────────────────
/**
 * One entry per unique piece type (cleanPieces[_idx]) with a `remaining`
 * counter instead of a per-instance expanded array. The hot packing loops
 * iterate T entries (e.g. 892 for Oak Plywood 15mm in Mountain View) instead
 * of N expanded instances (13,614) — the primary source of the refactor
 * speedup. Fields `ancho`, `alto`, `veta` are cached to avoid `.piece.*`
 * dereferencing per hot-loop iteration. In the landscape-transpose path
 * (_buildShelfGuillotine with packW > packH), the per-call entry array is
 * a shallow copy with `veta` swapped; `piece` still refs the original
 * Pieza, so PlacedPiece.piece downstream always points to the unswapped
 * original.
 */
type TypedEntry = {
  piece: Pieza & { _idx?: number };
  _idx: number;
  remaining: number;
  ancho: number;
  alto: number;
  /** Math.max(ancho, alto). Cached so hot scans can early-skip entries that
   *  cannot fit in either orientation of the available rect (maxDim > max(rw,rh))
   *  without reading ancho/alto and running per-orientation checks. Byte-identity
   *  preserved: an entry skipped by this bound would have failed both orientation
   *  checks anyway, so bestEntry selection is unchanged. */
  maxDim: number;
  veta: 'none' | 'horizontal' | 'vertical';
};

/** Change log for in-place rollback during `guillotinePack` branch exploration.
 *  Each tuple `[entry, amount]` records how much `entry.remaining` was decremented
 *  so `revertChangedLog` can restore the state before the losing branch. */
type ChangedLog = Array<[TypedEntry, number]>;

/** Recursion-call budget for `guillotinePack`. The packer explores both H-cut
 *  and V-cut branches at every frame; with 4 recursive sub-calls per internal
 *  node, specific dimensional combinations can blow up exponentially
 *  (observed on 1030 W 8th Street's 189-type × 637-expanded group — timeout
 *  >60s even in the post-refactor engine). The budget is a soft cap: when
 *  `count > limit`, the recursion returns empty and the caller keeps whatever
 *  partial placements it already found. The top-level caller (packShelf)
 *  creates a fresh budget per sub-guillotinePack invocation, so the cap is
 *  per-invocation, not global. */
type GuillotineBudget = { count: number; limit: number };

/** Default cap per top-level guillotinePack call from packShelf. Sized to be
 *  far above what real projects hit in healthy cases (Mountain View real
 *  dims complete in ~15s ≈ millions of calls across ALL sub-guillotines,
 *  each sub-invocation well under 1M), while bounding pathological
 *  dimensional combinations that would otherwise explode the recursion tree. */
const GUILLOTINE_CALL_LIMIT = 1_000_000;

/** Module-level counter — how many times the guillotinePack budget cap fired
 *  during the current top-level `run()` / `runOptimization()` / `optimizeOneGroup()`
 *  call. Reset by each public entry point; surfaced on the result as `capFires`
 *  so the UI can warn the user that packing may be sub-optimal for affected
 *  groups. Safe as module state because workers are isolated (single-threaded JS). */
let _capFireCount = 0;

function revertChangedLog(log: ChangedLog): void {
  for (let i = 0; i < log.length; i++) {
    const [entry, amount] = log[i];
    entry.remaining += amount;
  }
}

/** Materialize an expanded (one-per-physical-instance) array into `TypedEntry[]`
 *  form where each entry has `remaining = 1`. Used for GRASP paths so the
 *  `_shuffleWin` pass continues to consume the RNG length × times (byte-identity
 *  with the pre-refactor output). The input expanded array is assumed to already
 *  be one Pieza-spread per physical copy. */
function wrapExpandedAsEntries(expanded: (Pieza & { _idx: number })[]): TypedEntry[] {
  const out: TypedEntry[] = new Array(expanded.length);
  for (let i = 0; i < expanded.length; i++) {
    const p = expanded[i];
    out[i] = {
      piece: p,
      _idx: p._idx,
      remaining: 1,
      ancho: p.ancho,
      alto: p.alto,
      maxDim: p.ancho > p.alto ? p.ancho : p.alto,
      veta: p.veta,
    };
  }
  return out;
}

/** Expand TypedEntry[] back into a one-per-physical-instance array. Used by GRASP
 *  paths so `_shuffleWin` sees the same length as before the refactor. */
function materializeExpanded(entries: TypedEntry[]): (Pieza & { _idx: number })[] {
  const out: (Pieza & { _idx: number })[] = [];
  for (const e of entries) {
    for (let c = 0; c < e.remaining; c++) {
      out.push({ ...e.piece, _idx: e._idx });
    }
  }
  return out;
}

/** True when any entry in the array still has `remaining > 0`. */
function hasAnyRemaining(entries: TypedEntry[]): boolean {
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].remaining > 0) return true;
  }
  return false;
}

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
  cutTree?: CutTreeNode;

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
      ...(this.cutTree ? { cutTree: this.cutTree } : {}),
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
    if (this.cutTree) {
      // Collect usable waste leaf nodes from the guillotine tree
      this.offcuts = [];
      const collect = (node: CutTreeNode | null) => {
        if (!node) return;
        // Only true leaf nodes (no cut, no piece, no children) are actual waste space.
        if (!node.cut && !node.piece && !node.left && !node.right && node.w >= minOff && node.h >= minOff) {
          this.offcuts.push({ x: node.x, y: node.y, w: node.w, h: node.h });
        }
        collect(node.left);
        collect(node.right);
      };
      collect(this.cutTree);
      return this.offcuts;
    }
    this.offcuts = this.freeRects
      .filter(r => r.w >= minOff && r.h >= minOff)
      .map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h }));
    return this.offcuts;
  }
}

// ─────────────────────────────────────────────────────────────
// GUILLOTINE ENGINE — Recursive Best-Fit Partitioning
// Reference: Wäscher et al. (2007) 2D-MSSCSP with guillotine cuts
// ─────────────────────────────────────────────────────────────

/** Score how well a piece of size (iw × ih) fits into a rectangle (rw × rh).
 *  Higher = better. Favors high area utilization, exact-dimension fits,
 *  and penalizes leaving thin unusable strips. */
function scoreFit(rw: number, rh: number, iw: number, ih: number): number {
  const areaRatio   = (iw * ih) / (rw * rh);
  const exactBonus  = (iw === rw ? 0.2 : 0) + (ih === rh ? 0.2 : 0);
  const thinPenalty =
    (rw - iw > 0 && rw - iw < MIN_USEFUL_STRIP ? -0.15 : 0) +
    (rh - ih > 0 && rh - ih < MIN_USEFUL_STRIP ? -0.15 : 0);
  return areaRatio + exactBonus + thinPenalty;
}

/** Recursively pack entries into rectangle (rx, ry, rw, rh) using guillotine cuts.
 *  Returns placed pieces, a CutTreeNode for exact panel-saw sequencing, and a
 *  `log` of the decrements applied to `entries.remaining` during this subtree
 *  (so the caller can revert if this branch is discarded).
 *
 *  Both H-cut and V-cut options are explored by mutating `entries` in place;
 *  the losing branch's log is reverted before the winning branch is re-applied
 *  (when H wins) or kept in place (when V wins). */
function guillotinePack(
  rx: number, ry: number, rw: number, rh: number,
  entries: TypedEntry[],
  kerf: number,
  depth = 0,
  budget?: GuillotineBudget,
): { placed: PlacedPiece[]; tree: CutTreeNode | null; log: ChangedLog } {
  // Budget check: fire early if the caller-provided call-count cap was hit.
  // Healthy dimensional combinations (observed on Mountain View) never reach
  // this. Pathological ones (observed on 1030 W 8th Street's Roble Merida
  // group) would otherwise run indefinitely — the partial placements gathered
  // so far are kept by the caller. Increments the module-level cap-fire
  // counter the FIRST time this budget exceeds its limit (subsequent fires
  // for the same budget don't re-increment, so the counter reflects distinct
  // pathological sub-column trees).
  if (budget) {
    budget.count += 1;
    if (budget.count > budget.limit) {
      if (budget.count === budget.limit + 1) _capFireCount += 1;
      return { placed: [], tree: null, log: [] };
    }
  }
  if (rw < 10 || rh < 10 || depth > 40 || !hasAnyRemaining(entries)) {
    return { placed: [], tree: null, log: [] };
  }

  const log: ChangedLog = [];

  // ── Find best-fitting entry (all orientations, all remaining entries) ──
  // Pruning pasivo: any entry with `maxDim > max(rw, rh)` cannot fit in either
  // orientation. Skip before the per-orientation checks — byte-identity preserved
  // because such entries would have failed both inner ifs anyway.
  const rMax = rw > rh ? rw : rh;
  let bestEntry: TypedEntry | null = null;
  let bestIw = 0, bestIh = 0, bestScore = -Infinity;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.remaining === 0 || e.maxDim > rMax) continue;
    if (e.veta !== 'vertical' && e.ancho <= rw && e.alto <= rh) {
      const s = scoreFit(rw, rh, e.ancho, e.alto);
      if (s > bestScore) { bestScore = s; bestEntry = e; bestIw = e.ancho; bestIh = e.alto; }
    }
    if (e.veta !== 'horizontal' && e.alto <= rw && e.ancho <= rh) {
      const s = scoreFit(rw, rh, e.alto, e.ancho);
      if (s > bestScore) { bestScore = s; bestEntry = e; bestIw = e.alto; bestIh = e.ancho; }
    }
  }

  if (!bestEntry) return { placed: [], tree: null, log: [] };

  const pp: PlacedPiece = {
    piece: bestEntry.piece,
    x: rx, y: ry,
    w: bestIw, h: bestIh,
    rotated: bestIw !== bestEntry.piece.ancho,
    idx: bestEntry._idx,
  };
  bestEntry.remaining -= 1;
  log.push([bestEntry, 1]);

  // ── H-cut option: right remainder (beside piece) + bottom remainder ──
  const hRightX = rx + bestIw + kerf, hRightW = rw - bestIw - kerf;
  const hBotY   = ry + bestIh + kerf, hBotH   = rh - bestIh - kerf;

  const hRight = hRightW >= 10 && bestIh >= 10
    ? guillotinePack(hRightX, ry, hRightW, bestIh, entries, kerf, depth + 1, budget)
    : { placed: [] as PlacedPiece[], tree: null as CutTreeNode | null, log: [] as ChangedLog };
  const hBot = hBotH >= 10
    ? guillotinePack(rx, hBotY, rw, hBotH, entries, kerf, depth + 1, budget)
    : { placed: [] as PlacedPiece[], tree: null as CutTreeNode | null, log: [] as ChangedLog };
  const hTotal = hRight.placed.length + hBot.placed.length;

  // Revert the H subtree's decrements so V starts from the same post-bestEntry state.
  // bestEntry's own decrement stays — V also places bestEntry at the same position.
  revertChangedLog(hBot.log);
  revertChangedLog(hRight.log);

  // ── V-cut option: top remainder (above piece) + right remainder (full height) ──
  const vTopH   = rh - bestIh - kerf;
  const vRightX = rx + bestIw + kerf, vRightW = rw - bestIw - kerf;

  const vTop = vTopH >= 10 && bestIw >= 10
    ? guillotinePack(rx, ry + bestIh + kerf, bestIw, vTopH, entries, kerf, depth + 1, budget)
    : { placed: [] as PlacedPiece[], tree: null as CutTreeNode | null, log: [] as ChangedLog };
  const vRight = vRightW >= 10
    ? guillotinePack(vRightX, ry, vRightW, rh, entries, kerf, depth + 1, budget)
    : { placed: [] as PlacedPiece[], tree: null as CutTreeNode | null, log: [] as ChangedLog };
  const vTotal = vTop.placed.length + vRight.placed.length;

  // ── Choose winner; tie-break by actual combined waste (unoccupied) area ──
  // H-cut waste = right-of-piece strip + full-width bottom strip minus placed pieces
  const hWasteArea = (hRightW > 0 ? hRightW * bestIh : 0) + (hBotH > 0 ? rw * hBotH : 0)
    - hRight.placed.reduce((s, p) => s + p.w * p.h, 0)
    - hBot.placed.reduce((s, p) => s + p.w * p.h, 0);
  // V-cut waste = top-of-piece strip + full-height right strip minus placed pieces
  const vWasteArea = (vTopH > 0 ? bestIw * vTopH : 0) + (vRightW > 0 ? vRightW * rh : 0)
    - vTop.placed.reduce((s, p) => s + p.w * p.h, 0)
    - vRight.placed.reduce((s, p) => s + p.w * p.h, 0);
  const useH = hTotal > vTotal || (hTotal === vTotal && hWasteArea <= vWasteArea);

  // Reconcile `entries` state to reflect the winning branch.
  if (useH) {
    // V is currently applied — revert it, then replay H's decrements.
    revertChangedLog(vRight.log);
    revertChangedLog(vTop.log);
    for (let i = 0; i < hRight.log.length; i++) {
      const tup = hRight.log[i]; tup[0].remaining -= tup[1]; log.push(tup);
    }
    for (let i = 0; i < hBot.log.length; i++) {
      const tup = hBot.log[i]; tup[0].remaining -= tup[1]; log.push(tup);
    }
  } else {
    // V is already applied — accumulate its decrements into this frame's log.
    for (let i = 0; i < vTop.log.length; i++) log.push(vTop.log[i]);
    for (let i = 0; i < vRight.log.length; i++) log.push(vRight.log[i]);
  }

  // ── Build CutTreeNode ──
  const pieceLeaf: CutTreeNode = { x: rx, y: ry, w: bestIw, h: bestIh, piece: pp, cut: null, left: null, right: null };

  if (useH) {
    // Structure: H-cut at ry+bestIh+kerf/2 (full width)
    //   left child:  V-cut at rx+bestIw+kerf/2 (height=bestIh)
    //                  left=pieceLeaf  right=rightRemainder
    //   right child: bottomRemainder (full width, below)
    const vCutPos = rx + bestIw + kerf / 2;
    const hCutPos = ry + bestIh + kerf / 2;

    const rightNode = hRight.tree ?? (hRightW >= 10 && bestIh >= 10
      ? { x: hRightX, y: ry, w: hRightW, h: bestIh, piece: null, cut: null, left: null, right: null }
      : null);
    const vCut: GuillotineCut = { type: 'V', pos: vCutPos, isPieceCut: true };
    const innerNode: CutTreeNode = rightNode
      ? { x: rx, y: ry, w: rw, h: bestIh, piece: null, cut: vCut, left: pieceLeaf, right: rightNode }
      : { x: rx, y: ry, w: bestIw, h: bestIh, piece: null, cut: null, left: pieceLeaf, right: null };

    const botNode = hBot.tree ?? (hBotH >= 10
      ? { x: rx, y: hBotY, w: rw, h: hBotH, piece: null, cut: null, left: null, right: null }
      : null);
    const hCut: GuillotineCut = { type: 'H', pos: hCutPos, isPieceCut: true };
    const rootTree: CutTreeNode = botNode
      ? { x: rx, y: ry, w: rw, h: rh, piece: null, cut: hCut, left: innerNode, right: botNode }
      : { x: rx, y: ry, w: rw, h: rh, piece: null, cut: null, left: innerNode, right: null };

    return { placed: [pp, ...hRight.placed, ...hBot.placed], tree: rootTree, log };
  } else {
    // Structure: V-cut at rx+bestIw+kerf/2 (full height)
    //   left child:  H-cut at ry+bestIh+kerf/2 (width=bestIw)
    //                  left=pieceLeaf  right=topRemainder
    //   right child: rightRemainder (full height, to the right)
    const hCutPos = ry + bestIh + kerf / 2;
    const vCutPos = rx + bestIw + kerf / 2;

    const topNode = vTop.tree ?? (vTopH >= 10 && bestIw >= 10
      ? { x: rx, y: ry + bestIh + kerf, w: bestIw, h: vTopH, piece: null, cut: null, left: null, right: null }
      : null);
    const hCut: GuillotineCut = { type: 'H', pos: hCutPos, isPieceCut: true };
    const innerNode: CutTreeNode = topNode
      ? { x: rx, y: ry, w: bestIw, h: rh, piece: null, cut: hCut, left: pieceLeaf, right: topNode }
      : { x: rx, y: ry, w: bestIw, h: rh, piece: null, cut: null, left: pieceLeaf, right: null };

    const rightNode = vRight.tree ?? (vRightW >= 10
      ? { x: vRightX, y: ry, w: vRightW, h: rh, piece: null, cut: null, left: null, right: null }
      : null);
    const vCut: GuillotineCut = { type: 'V', pos: vCutPos, isPieceCut: false };
    const rootTree: CutTreeNode = rightNode
      ? { x: rx, y: ry, w: rw, h: rh, piece: null, cut: vCut, left: innerNode, right: rightNode }
      : { x: rx, y: ry, w: rw, h: rh, piece: null, cut: null, left: innerNode, right: null };

    return { placed: [pp, ...vTop.placed, ...vRight.placed], tree: rootTree, log };
  }
}

// ─────────────────────────────────────────────────────────────
// SHELF-FIRST GUILLOTINE
// ─────────────────────────────────────────────────────────────

/** Pack a single shelf (full-width horizontal strip) left-to-right with vertical cuts.
 *  Pieces that are shorter than the shelf height create sub-columns where the remaining
 *  vertical space below is filled via guillotinePack(). Decrements `entries.remaining`
 *  in place and returns a `log` the caller can revert to undo this trial. */
function packShelf(
  shelfX: number, shelfY: number, shelfW: number, shelfH: number,
  entries: TypedEntry[], kerf: number,
): { placed: PlacedPiece[]; tree: CutTreeNode; log: ChangedLog } {
  const placed: PlacedPiece[] = [];
  const columns: CutTreeNode[] = [];
  let xCursor = shelfX;
  const log: ChangedLog = [];

  while (xCursor + 10 < shelfX + shelfW) {
    const availW = shelfX + shelfW - xCursor;
    const boundMax = availW > shelfH ? availW : shelfH;

    // Find best entry that fits in remaining width × shelf height.
    // Pruning pasivo: skip entries whose maxDim exceeds max(availW, shelfH).
    let bestEntry: TypedEntry | null = null;
    let bestW = 0, bestH = 0, bestScore = -Infinity;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.remaining === 0 || e.maxDim > boundMax) continue;
      // Normal orientation
      if (e.veta !== 'vertical' && e.ancho <= availW && e.alto <= shelfH) {
        const s = scoreFit(availW, shelfH, e.ancho, e.alto);
        if (s > bestScore) { bestScore = s; bestEntry = e; bestW = e.ancho; bestH = e.alto; }
      }
      // Rotated orientation
      if (e.veta !== 'horizontal' && e.alto <= availW && e.ancho <= shelfH) {
        const s = scoreFit(availW, shelfH, e.alto, e.ancho);
        if (s > bestScore) { bestScore = s; bestEntry = e; bestW = e.alto; bestH = e.ancho; }
      }
    }
    if (!bestEntry) break;

    bestEntry.remaining -= 1;
    log.push([bestEntry, 1]);

    const pp: PlacedPiece = {
      piece: bestEntry.piece, x: xCursor, y: shelfY,
      w: bestW, h: bestH,
      rotated: bestW !== bestEntry.piece.ancho,
      idx: bestEntry._idx,
    };
    placed.push(pp);

    // Build column node
    const pieceLeaf: CutTreeNode = {
      x: xCursor, y: shelfY, w: bestW, h: bestH,
      piece: pp, cut: null, left: null, right: null,
    };

    if (bestH < shelfH - kerf) {
      // Sub-column: piece on top, try packing more below
      const belowY = shelfY + bestH + kerf;
      const belowH = shelfH - bestH - kerf;

      if (belowH >= 10) {
        // Fresh call-count budget for this sub-guillotine invocation.
        // Each sub-column gets its own cap — prevents a single pathological
        // column from starving the rest of the shelf's packing budget.
        const subBudget: GuillotineBudget = { count: 0, limit: GUILLOTINE_CALL_LIMIT };
        const subResult = guillotinePack(xCursor, belowY, bestW, belowH, entries, kerf, 0, subBudget);
        const subTree = subResult.tree ?? {
          x: xCursor, y: belowY, w: bestW, h: belowH,
          piece: null, cut: null, left: null, right: null, // waste
        };
        placed.push(...subResult.placed);
        // Sub-guillotine already mutated entries in place — accumulate its decrements.
        for (let i = 0; i < subResult.log.length; i++) log.push(subResult.log[i]);

        // Column node: H-cut separating piece from below
        const colNode: CutTreeNode = {
          x: xCursor, y: shelfY, w: bestW, h: shelfH,
          piece: null,
          cut: { type: 'H', pos: shelfY + bestH + kerf / 2, isPieceCut: true },
          left: pieceLeaf,
          right: subTree,
        };
        columns.push(colNode);
      } else {
        // Below space too small — extend piece leaf to fill shelf visually
        columns.push(pieceLeaf);
      }
    } else {
      // Piece fills full shelf height — simple leaf
      columns.push(pieceLeaf);
    }

    xCursor += bestW + kerf;
  }

  // Right-side waste
  const wasteW = shelfX + shelfW - xCursor;
  if (wasteW > 0) {
    columns.push({
      x: xCursor, y: shelfY, w: wasteW, h: shelfH,
      piece: null, cut: null, left: null, right: null, // waste
    });
  }

  // Edge case: no columns at all
  if (columns.length === 0) {
    const wasteNode: CutTreeNode = {
      x: shelfX, y: shelfY, w: shelfW, h: shelfH,
      piece: null, cut: null, left: null, right: null,
    };
    return { placed: [], tree: wasteNode, log };
  }

  // Chain columns via V-cuts (right-to-left chaining)
  let tree = columns[columns.length - 1];
  for (let i = columns.length - 2; i >= 0; i--) {
    tree = {
      x: columns[i].x, y: shelfY,
      w: shelfX + shelfW - columns[i].x,
      h: shelfH,
      piece: null,
      cut: { type: 'V', pos: columns[i].x + columns[i].w + kerf / 2, isPieceCut: true },
      left: columns[i],
      right: tree,
    };
  }

  return { placed, tree, log };
}

/** Shelf-first guillotine packer: creates full-width horizontal shelves (H-cuts at top level),
 *  then packs pieces left-to-right within each shelf using vertical cuts.
 *  Guarantees all first-level cuts are H-type — compatible with HongYe panel saws.
 *  Each candidate shelf-height is trialed in place and reverted; the winner's log
 *  is re-applied at the end. */
function shelfGuillotinePack(
  rx: number, ry: number, rw: number, rh: number,
  entries: TypedEntry[],
  kerf: number,
): { placed: PlacedPiece[]; tree: CutTreeNode | null; log: ChangedLog } {
  if (rw < 10 || rh < 10 || !hasAnyRemaining(entries)) {
    return { placed: [], tree: null, log: [] };
  }

  const allPlaced: PlacedPiece[] = [];
  const shelves: CutTreeNode[] = [];
  let yCursor = ry;
  const log: ChangedLog = [];

  while (yCursor + 10 <= ry + rh && hasAnyRemaining(entries)) {
    const availH = ry + rh - yCursor;
    const boundMax = availH > rw ? availH : rw;

    // Collect distinct candidate shelf heights from entries with remaining > 0.
    // Pruning pasivo: skip entries whose maxDim exceeds max(availH, rw).
    const heightSet = new Set<number>();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.remaining === 0 || e.maxDim > boundMax) continue;
      if (e.veta !== 'vertical'   && e.alto  <= availH && e.ancho <= rw) heightSet.add(e.alto);
      if (e.veta !== 'horizontal' && e.ancho <= availH && e.alto  <= rw) heightSet.add(e.ancho);
    }
    if (heightSet.size === 0) break;

    // Sort candidates descending — try tallest shelf first.
    const candidates = [...heightSet].sort((a, b) => b - a);

    // Pick the best shelf height: the one that places the most pieces.
    // This prevents a tall shelf from "wasting" space when a shorter shelf
    // would leave enough remaining height for other pieces below.
    let bestShelfH = candidates[0];
    let bestPlacedCount = 0;
    let bestTrialPlaced: PlacedPiece[] | null = null;
    let bestTrialTree: CutTreeNode | null = null;
    let bestTrialLog: ChangedLog | null = null;

    for (const candidateH of candidates) {
      if (candidateH < 10) continue;
      const trial = packShelf(rx, yCursor, rw, candidateH, entries, kerf);
      if (trial.placed.length === 0) {
        revertChangedLog(trial.log);
        continue;
      }

      // Score: prefer shelves that place more pieces. Among ties, prefer
      // a height that leaves room for the remaining unplaced pieces below.
      // `entries` is currently in post-trial state — check fits below before reverting.
      const afterH = availH - candidateH - kerf;
      let unplacedFitBelow = false;
      if (afterH >= 10) {
        const belowBoundMax = afterH > rw ? afterH : rw;
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          if (e.remaining === 0 || e.maxDim > belowBoundMax) continue;
          if ((e.veta !== 'vertical'   && e.alto  <= afterH && e.ancho <= rw) ||
              (e.veta !== 'horizontal' && e.ancho <= afterH && e.alto  <= rw)) {
            unplacedFitBelow = true;
            break;
          }
        }
      }
      // Bonus for leaving viable space below for remaining pieces
      const score = trial.placed.length + (unplacedFitBelow ? 0.5 : 0);

      // Revert this trial so next candidate starts from the same state.
      revertChangedLog(trial.log);

      if (score > bestPlacedCount || bestTrialLog === null) {
        bestPlacedCount = score;
        bestShelfH = candidateH;
        bestTrialPlaced = trial.placed;
        bestTrialTree = trial.tree;
        bestTrialLog = trial.log;
      }
    }

    if (!bestTrialPlaced || bestTrialPlaced.length === 0 || !bestTrialLog) break;

    // Replay the winning trial's decrements against `entries`.
    for (let i = 0; i < bestTrialLog.length; i++) {
      const tup = bestTrialLog[i]; tup[0].remaining -= tup[1]; log.push(tup);
    }

    allPlaced.push(...bestTrialPlaced);
    if (bestTrialTree) shelves.push(bestTrialTree);
    yCursor += bestShelfH + kerf;
  }

  if (shelves.length === 0) return { placed: [], tree: null, log };

  // Bottom waste below all shelves
  const wasteH = ry + rh - yCursor;
  if (wasteH > 0) {
    shelves.push({
      x: rx, y: yCursor, w: rw, h: wasteH,
      piece: null, cut: null, left: null, right: null, // waste
    });
  }

  // Chain shelves via H-cuts (bottom-up chaining: last shelf is rightmost in tree)
  let tree = shelves[shelves.length - 1];
  for (let i = shelves.length - 2; i >= 0; i--) {
    const shelfBottom = shelves[i].y + shelves[i].h;
    tree = {
      x: rx, y: shelves[i].y,
      w: rw,
      h: ry + rh - shelves[i].y,
      piece: null,
      cut: { type: 'H', pos: shelfBottom + kerf / 2, isPieceCut: true },
      left: shelves[i],
      right: tree,
    };
  }

  return { placed: allPlaced, tree, log };
}

/** Transpose a CutTreeNode hierarchy: swap x↔y, w↔h, H↔V.
 *  Used after packing in a transposed coordinate system (landscape → portrait)
 *  to convert the result back to the board's actual orientation. */
function transposeCutTree(node: CutTreeNode | null): void {
  if (!node) return;
  [node.x, node.y] = [node.y, node.x];
  [node.w, node.h] = [node.h, node.w];
  if (node.cut) {
    node.cut.type = node.cut.type === 'H' ? 'V' : 'H';
  }
  // NOTE: node.piece is NOT transposed here — PlacedPiece objects are shared
  // references with result.placed[] and are already transposed in the caller loop.
  transposeCutTree(node.left);
  transposeCutTree(node.right);
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
  private engineMode: EngineMode;
  private objective: OptimizationObjective;
  /** Dedupe set for "piece does not fit" warnings. Without this, each of
   *  the 8 deterministic sorts and ~20 GRASP iterations per material group
   *  re-emits the same warning for every unfit piece → thousands of logs
   *  that stall the main thread when DevTools is open. One warning per
   *  (nombre × WxH × material) is plenty; the full unfit list is returned
   *  via `unplacedPieces` on the result and surfaced by the Warnings Panel. */
  private _warnedUnfitKeys: Set<string> = new Set();
  bestStrategy = '';
  iters = 0;
  time = 0;

  constructor(
    stocks: StockSize[], remnants: Remnant[], sierra: number,
    minOff = MIN_OFFCUT_DEFAULT, trim = 0,
    engineMode: EngineMode = 'guillotine',
    objective: OptimizationObjective = 'min-boards',
  ) {
    this.stocks = stocks;
    this.remnants = remnants.map(r => ({ ...r, _used: false }));
    this.sierra = sierra;
    this.minOff = minOff;
    this.trim = trim;
    this.engineMode = engineMode;
    this.objective  = objective;
  }

  private _warnUnfit(p: Pieza, prefix: string): void {
    const key = `${p.material}|${p.grosor}|${p.nombre || ''}|${p.ancho}x${p.alto}`;
    if (this._warnedUnfitKeys.has(key)) return;
    this._warnedUnfitKeys.add(key);
    console.warn(`${prefix}Piece ${p.nombre || p.ancho + 'x' + p.alto} (${p.ancho}×${p.alto}mm, ${p.material}) does not fit any stock`);
  }

  run(pieces: Pieza[], rngSeed = 42): Board[] {
    const t0 = performance.now();
    this._warnedUnfitKeys.clear();
    let seed = rngSeed;
    const rng = (): number => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    // Build TypedEntry[] — one entry per cleanPieces[i], carrying cantidad as
    // `remaining`. This is the core representation shift: post-refactor scans
    // iterate T types (not N expanded instances). Identity is tracked via
    // `remaining` counters; PlacedPiece.piece downstream always points to the
    // original Pieza object (not a per-instance spread).
    const entries: TypedEntry[] = pieces.map((p, i) => ({
      piece: p,
      _idx: i,
      remaining: p.cantidad,
      ancho: p.ancho,
      alto: p.alto,
      maxDim: p.ancho > p.alto ? p.ancho : p.alto,
      veta: p.veta,
    }));

    const groups: Record<string, TypedEntry[]> = {};
    for (const e of entries) {
      const k = `${e.piece.material}_${e.piece.grosor}`;
      (groups[k] = groups[k] || []).push(e);
    }

    const allBoards: Board[] = [];
    for (const k in groups) {
      const g = groups[k];
      const first = g[0].piece;
      const best = this._optGroup(g, first.material, first.grosor, rng);
      allBoards.push(...best);
    }
    allBoards.forEach(b => b.calcOffcuts(this.minOff));
    this.time = performance.now() - t0;
    return allBoards;
  }

  private _optGroup(
    group: TypedEntry[],
    mat: string, grs: number,
    rng: () => number
  ): Board[] {
    // Accepts both Pieza and TypedEntry (structural subtype — both expose .ancho/.alto).
    type SortFn = (a: { ancho: number; alto: number }, b: { ancho: number; alto: number }) => number;
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

    // Adaptive budget by expanded piece count (= Σ remaining across entries),
    // matching pre-refactor semantics where `group.length` was the total
    // number of physical instances.
    //
    // Tiers (tunable — future packer-level wins can relax these in one place):
    //   ≤500 expanded  → 8 sorts × GRASP_ITERS (unchanged)
    //   501..2000      → 8 sorts × 5 GRASP   + early term after 3
    //   >2000          → 2 sorts × 1 GRASP   + early term after 1
    let totalExpanded = 0;
    for (let i = 0; i < group.length; i++) totalExpanded += group[i].remaining;

    const LARGE_GROUP_THRESHOLD = 500;
    const HUGE_GROUP_THRESHOLD = 2000;
    const isLargeGroup = totalExpanded > LARGE_GROUP_THRESHOLD;
    const isHugeGroup  = totalExpanded > HUGE_GROUP_THRESHOLD;
    const effectiveGraspIters      = isHugeGroup ? 1 : (isLargeGroup ? 5 : GRASP_ITERS);
    const effectiveGuillotineIters = isHugeGroup ? 1 : (isLargeGroup ? 5 : GUILLOTINE_ITERS);
    const EARLY_TERM_AFTER         = isHugeGroup ? 1 : 3;
    const effectiveSorts = isHugeGroup
      ? sorts.filter(([n]) => n === 'area' || n === 'lado')
      : sorts;

    if (isHugeGroup || isLargeGroup) {
      console.log(`[_optGroup] ${mat} ${grs}mm (${totalExpanded} pieces) — ${isHugeGroup ? 'huge' : 'large'} tier: ${effectiveSorts.length} sorts × ${effectiveGuillotineIters} GRASP, early-term ≥${EARLY_TERM_AFTER}`);
    }

    // ── MaxRect phases — only when 'both' engines are requested ──
    if (this.engineMode === 'both') {
      for (const [sn, sf] of effectiveSorts) {
        const sortedEntries = [...group].sort(sf);
        for (const h of HEURISTICS) {
          const bds = this._build(sortedEntries, mat, grs, h);
          const sc  = this._score(bds);
          totalIters++;
          if (sc < bestScore) { bestScore = sc; best = bds; bestName = `${sn}+${h}`; }
        }
      }
      let maxrectNoImprove = 0;
      for (let g = 0; g < effectiveGraspIters; g++) {
        const si = Math.floor(rng() * sorts.length);
        const hi = Math.floor(rng() * HEURISTICS.length);
        const [sn, sf] = sorts[si];
        // GRASP path: shuffle over the expanded sequence (one item per physical
        // instance) so _shuffleWin consumes the RNG length × times — matches the
        // pre-refactor RNG consumption and preserves byte-identity. Wrap the
        // shuffled expanded back into TypedEntry[] (remaining=1 each) so
        // downstream packing functions see the unified type.
        const shuffledExpanded = this._shuffleWin(materializeExpanded(group).sort(sf), rng);
        const shuffledEntries = wrapExpandedAsEntries(shuffledExpanded);
        const bds  = this._build(shuffledEntries, mat, grs, HEURISTICS[hi]);
        const sc   = this._score(bds);
        totalIters++;
        if (sc < bestScore) { bestScore = sc; best = bds; bestName = `GRASP(${sn}+${HEURISTICS[hi]})`; maxrectNoImprove = 0; }
        else if (isLargeGroup && ++maxrectNoImprove >= EARLY_TERM_AFTER) break;
      }
    }

    // ── Shelf-first guillotine passes: N deterministic + M GRASP ──
    for (const [sn, sf] of effectiveSorts) {
      const sortedEntries = [...group].sort(sf);
      const bds = this._buildShelfGuillotine(sortedEntries, mat, grs);
      const sc  = this._score(bds);
      totalIters++;
      if (sc < bestScore) { bestScore = sc; best = bds; bestName = `shelf-${sn}`; }
    }
    let shelfNoImprove = 0;
    for (let g = 0; g < effectiveGuillotineIters; g++) {
      const si = Math.floor(rng() * sorts.length);
      const [sn, sf] = sorts[si];
      // GRASP path: shuffle over expanded to preserve RNG consumption (byte-identity).
      const shuffledExpanded = this._shuffleWin(materializeExpanded(group).sort(sf), rng);
      const shuffledEntries = wrapExpandedAsEntries(shuffledExpanded);
      const bds = this._buildShelfGuillotine(shuffledEntries, mat, grs);
      const sc  = this._score(bds);
      totalIters++;
      if (sc < bestScore) { bestScore = sc; best = bds; bestName = `GRASP-shelf(${sn})`; shelfNoImprove = 0; }
      else if (isLargeGroup && ++shelfNoImprove >= EARLY_TERM_AFTER) break;
    }

    // Local search rebuilds boards using MaxRect semantics (Board.place()), which would
    // erase the guillotine cut tree. Skip it when the winner is a guillotine/shelf result.
    const isGuillotine = bestName.startsWith('shelf') || bestName.startsWith('GRASP-shelf');
    if (best && best.length > 1 && !isGuillotine) {
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
    const allStk = this.stocks.map(s => ({ ...s, isRemnant: false, stockId: s.id }));
    // Prefer stocks whose nombre matches the current material group exactly.
    // Falls back to all stocks when no name match exists (preserves standalone-
    // optimizer behavior where piece materials and stock nombres are user-defined
    // and don't need to match).
    const matchingStk = allStk.filter(s => s.nombre === mat);
    const stk = matchingStk.length > 0 ? matchingStk : allStk;
    return [...rems, ...stk.sort((a, b) => a.costo - b.costo)];
  }

  private _build(entries: TypedEntry[], mat: string, grs: number, heuristic: Heuristic): Board[] {
    const boards: Board[] = [];
    const availStocks = this._getStocksFor(mat, grs);
    if (!availStocks.length) return [];

    // Track usage count per stockId for qty limits
    const usageCount: Record<string, number> = {};

    // Iterate entries and place each physical instance (count = snapshot of
    // remaining at entry time; we don't mutate entry.remaining — _build is
    // re-entrant across sort/heuristic passes within _optGroup).
    for (const e of entries) {
      const count = e.remaining;
      if (count <= 0) continue;
      const p = e.piece;
      const pAncho = e.ancho, pAlto = e.alto, pVeta = e.veta, pIdx = e._idx;

      for (let c = 0; c < count; c++) {
        let bestBoard: Board | null = null;
        let bestS = Infinity, bestS2 = Infinity, bestRot = false;

        for (const b of boards) {
          if (pVeta !== 'vertical' && pAncho <= b.ancho && pAlto <= b.alto) {
            const r = b.findBest(pAncho, pAlto, heuristic);
            if (r) {
              const [s1, s2] = this._espScore(r, pAncho, pAlto, heuristic);
              if (s1 < bestS || (s1 === bestS && s2 < bestS2)) { bestS = s1; bestS2 = s2; bestBoard = b; bestRot = false; }
            }
          }
          if (pVeta !== 'horizontal' && pAlto <= b.ancho && pAncho <= b.alto) {
            const r = b.findBest(pAlto, pAncho, heuristic);
            if (r) {
              const [s1, s2] = this._espScore(r, pAlto, pAncho, heuristic);
              if (s1 < bestS || (s1 === bestS && s2 < bestS2)) { bestS = s1; bestS2 = s2; bestBoard = b; bestRot = true; }
            }
          }
        }

        if (bestBoard) {
          if (bestRot) bestBoard.place(p, pAlto, pAncho, true,  pIdx, heuristic);
          else         bestBoard.place(p, pAncho, pAlto, false, pIdx, heuristic);
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
          const fn = pVeta !== 'vertical' && pAncho <= st.ancho && pAlto <= st.alto;
          const fr = pVeta !== 'horizontal' && pAlto <= st.ancho && pAncho <= st.alto;
          if (fn && nb.place(p, pAncho, pAlto, false, pIdx, heuristic)) {
            boards.push(nb); if (st.isRemnant) st._used = true;
            if (st.stockId) usageCount[st.stockId] = (usageCount[st.stockId] || 0) + 1;
            placed = true; break;
          }
          if (fr && nb.place(p, pAlto, pAncho, true,  pIdx, heuristic)) {
            boards.push(nb); if (st.isRemnant) st._used = true;
            if (st.stockId) usageCount[st.stockId] = (usageCount[st.stockId] || 0) + 1;
            placed = true; break;
          }
        }
        if (!placed) {
          this._warnUnfit(p, '');
        }
      }
    }
    return boards;
  }

  /** Shelf-first guillotine: guillotine-based build using shelfGuillotinePack
   *  to guarantee H-cuts at the top level (compatible with HongYe panel saws).
   *  When the board is in landscape (width > height), the coordinate system is
   *  transposed so shelves span the SHORT dimension and stack along the LONG
   *  dimension — matching the HongYe convention where shelves span the full
   *  board width (1220mm) and stack along the board length (2440mm). */
  private _buildShelfGuillotine(entries: TypedEntry[], mat: string, grs: number): Board[] {
    const boards: Board[] = [];
    const availStocks = this._getStocksFor(mat, grs);
    if (!availStocks.length) return [];

    const usageCount: Record<string, number> = {};

    // Clone entries so per-board decrements don't pollute the caller's array
    // (each sort/iter pass in _optGroup must see the same initial remaining).
    const localEntries: TypedEntry[] = new Array(entries.length);
    for (let i = 0; i < entries.length; i++) localEntries[i] = { ...entries[i] };

    while (hasAnyRemaining(localEntries)) {
      let placed = false;

      for (const st of availStocks) {
        if (st.isRemnant && st._used) continue;
        if (st.stockId && st.qty && st.qty > 0) {
          if ((usageCount[st.stockId] || 0) >= st.qty) continue;
        }

        const sierra = st.sierra || this.sierra;
        const t = this.trim;
        const packW = st.ancho - 2 * t;
        const packH = st.alto  - 2 * t;

        if (packW < 10 || packH < 10) continue;

        // HongYe shelf convention: shelves span the SHORT side, stack along the LONG side.
        // If the board is landscape (packW > packH), transpose so the algorithm's
        // internal Y becomes the long dimension.
        const needTranspose = packW > packH;
        const sW = needTranspose ? packH : packW;
        const sH = needTranspose ? packW : packH;

        // When transposing, "normal" in transposed space maps to "rotated" on the
        // actual board and vice versa. Swap veta so grain constraints stay correct.
        const swapVeta = (v: 'none' | 'horizontal' | 'vertical') =>
          !needTranspose ? v : v === 'vertical' ? 'horizontal' : v === 'horizontal' ? 'vertical' : v;

        const stockBoundMax = sW > sH ? sW : sH;
        let anyFits = false;
        for (let i = 0; i < localEntries.length; i++) {
          const e = localEntries[i];
          if (e.remaining === 0 || e.maxDim > stockBoundMax) continue;
          const v = swapVeta(e.veta);
          if ((v !== 'vertical'   && e.ancho <= sW && e.alto  <= sH) ||
              (v !== 'horizontal' && e.alto  <= sW && e.ancho <= sH)) {
            anyFits = true;
            break;
          }
        }
        if (!anyFits) continue;

        // For the transpose path, create T veta-swapped TypedEntry copies
        // (was N spread copies pre-refactor — e.g. 892 vs 24,585 for Oak
        // Plywood). `piece` still refs the original Pieza so PlacedPiece.piece
        // downstream always points to the unswapped original.
        let packEntries: TypedEntry[];
        if (needTranspose) {
          packEntries = new Array(localEntries.length);
          for (let i = 0; i < localEntries.length; i++) {
            const e = localEntries[i];
            packEntries[i] = { ...e, veta: swapVeta(e.veta) };
          }
        } else {
          packEntries = localEntries;
        }

        const result = shelfGuillotinePack(t, t, sW, sH, packEntries, sierra);
        if (!result.placed.length) continue;

        // Transpose coordinates back to the board's actual orientation.
        // `pp.piece` already refs the original Pieza — no Map lookup needed.
        if (needTranspose) {
          for (const pp of result.placed) {
            [pp.x, pp.y] = [pp.y, pp.x];
            [pp.w, pp.h] = [pp.h, pp.w];
            pp.rotated = pp.w !== pp.piece.ancho;
          }
          if (result.tree) transposeCutTree(result.tree);
        }

        const nb = new Board(st.ancho, st.alto, sierra, mat, grs, {
          nombre: st.nombre, costo: st.costo, isRemnant: !!st.isRemnant,
        }, t);
        nb.placed   = result.placed;
        nb.cutTree  = result.tree ?? undefined;
        boards.push(nb);

        if (st.isRemnant) st._used = true;
        if (st.stockId) usageCount[st.stockId] = (usageCount[st.stockId] || 0) + 1;

        // Propagate decrements from packEntries back to localEntries.
        // Same-array case (no transpose): decrements already applied in place.
        if (needTranspose) {
          for (let i = 0; i < localEntries.length; i++) {
            localEntries[i].remaining = packEntries[i].remaining;
          }
        }
        placed = true;
        break;
      }

      if (!placed) {
        for (let i = 0; i < localEntries.length; i++) {
          const e = localEntries[i];
          if (e.remaining > 0) this._warnUnfit(e.piece, '[shelf-guillotine] ');
        }
        break;
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
    const cost  = bds.reduce((s, b) => s + (b.stockInfo?.costo ?? 0), 0);
    const waste = bds.reduce((s, b) => s + b.areaWaste, 0);
    if (this.objective === 'min-waste') {
      // Waste area is primary; board count and cost are tie-breakers.
      return waste * 1e6 + bds.length * 1e3 + cost * 100;
    }
    if (this.objective === 'min-cuts') {
      // Proxy: a guillotine tree with P leaves has P-1 internal cuts.
      // Fewer cuts per board = simpler panel-saw sequence = less operator time.
      const cuts = bds.reduce((s, b) => s + Math.max(0, b.placed.length - 1), 0);
      return cuts * 1e6 + bds.length * 1e3 + waste * 100;
    }
    // 'min-boards' (default): fewest boards → lowest material cost.
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

  private _localSearch(bds: Board[], _mat: string, _grs: number): Board[] {
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
              {
                // Can we flip? Only if the alternate orientation is allowed by veta
                const altRotated = !pp.rotated;
                const altAllowed = pp.piece.veta === 'none' || (pp.piece.veta === 'horizontal' && !altRotated) || (pp.piece.veta === 'vertical' && altRotated);
                if (altAllowed && tb.place(pp.piece, pp.h, pp.w, altRotated, pp.idx, h)) { ok = true; break; }
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
              const altRot = !pp.rotated;
              const altOk = pp.piece.veta === 'none' || (pp.piece.veta === 'horizontal' && !altRot) || (pp.piece.veta === 'vertical' && altRot);
              const fits =
                nt.place(pp.piece, pp.w, pp.h, pp.rotated, pp.idx, 'baf') ||
                (altOk && nt.place(pp.piece, pp.h, pp.w, altRot, pp.idx, 'baf'));
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
  globalSierra = 4.5,
  minOffcut = 200,
  boardTrim = 0,
  engineMode: EngineMode = 'guillotine',
  objective: OptimizationObjective = 'min-boards',
): OptimizationResult {
  const t0 = performance.now();

  const { cleanPieces, cleanStocks, dropped } = sanitizeOptimizerInputs(pieces, stocks);

  if (dropped.length > 0) {
    console.warn('[runOptimization] dropped invalid inputs:', dropped);
  }

  // Reset the module-level cap-fire counter so this run's value reflects
  // only decrements that happened during this invocation.
  _capFireCount = 0;

  const totalExpanded = cleanPieces.reduce((s, p) => s + p.cantidad, 0);
  console.log('[runOptimization] starting', {
    piecesIn: pieces.length,
    piecesClean: cleanPieces.length,
    totalExpanded,
    stocksIn: stocks.length,
    stocksClean: cleanStocks.length,
    engineMode,
    objective,
  });

  if (cleanPieces.length === 0) {
    throw new Error(
      'No valid pieces to optimize. Check cabinet cut-pieces for missing dimensions or quantities.',
    );
  }
  if (cleanStocks.length === 0) {
    throw new Error(
      'No valid stocks selected. Make sure at least one board material is checked in the sidebar.',
    );
  }

  const opt = new Optimizer(cleanStocks, remnants, globalSierra, minOffcut, boardTrim, engineMode, objective);
  const boards = opt.run(cleanPieces);
  const boardResults = boards.map(b => b.toResult());

  const elapsed = performance.now() - t0;
  if (elapsed > MAX_ENGINE_MS) {
    console.warn(`[runOptimization] took ${elapsed.toFixed(0)}ms (soft budget ${MAX_ENGINE_MS}ms)`);
  }

  const totalArea   = boardResults.reduce((s, b) => s + b.areaTotal, 0);
  const usedArea    = boardResults.reduce((s, b) => s + b.areaUsed, 0);
  const totalPieces = cleanPieces.reduce((s, p) => s + p.cantidad, 0);
  const totalCost   = boardResults.reduce((s, b) => s + b.stockInfo.costo, 0);
  const usefulOffcuts = boardResults.reduce((s, b) => s + b.offcuts.length, 0);

  // Detect unplaced pieces: compare expected vs actually placed
  const placedCounts = new Map<number, number>();
  for (const b of boardResults) {
    for (const pp of b.placed) {
      placedCounts.set(pp.idx, (placedCounts.get(pp.idx) || 0) + 1);
    }
  }
  const unplacedPieces: { nombre: string; ancho: number; alto: number; count: number }[] = [];
  cleanPieces.forEach((p, idx) => {
    const placed = placedCounts.get(idx) || 0;
    const missing = p.cantidad - placed;
    if (missing > 0) {
      unplacedPieces.push({ nombre: p.nombre || `${p.ancho}×${p.alto}`, ancho: p.ancho, alto: p.alto, count: missing });
    }
  });

  const totalPlaced = boardResults.reduce((s, b) => s + b.placed.length, 0);
  const totalUnplaced = unplacedPieces.reduce((s, u) => s + u.count, 0);
  const capFires = _capFireCount;
  console.log(
    `[runOptimization] done: ${boardResults.length} boards, ${totalPlaced} placed, ` +
    `${totalUnplaced} unplaced, efficiency ${(totalArea > 0 ? (usedArea / totalArea) * 100 : 0).toFixed(1)}%, ` +
    `strategy=${opt.bestStrategy}, capFires=${capFires}`
  );
  if (totalUnplaced > 0) {
    console.warn('[runOptimization] unplaced pieces:', unplacedPieces);
  }
  if (capFires > 0) {
    console.warn(
      `[runOptimization] guillotinePack call-count cap fired ${capFires} time(s) — ` +
      `some groups may be sub-optimally packed. Consider adding +5-10% safety margin ` +
      `to material estimates for this quotation.`
    );
  }

  return {
    boards: boardResults,
    totalPieces,
    efficiency: totalArea > 0 ? (usedArea / totalArea) * 100 : 0,
    totalCost,
    timeMs: opt.time,
    strategy: opt.bestStrategy,
    usefulOffcuts,
    unplacedPieces,
    capFires,
  };
}

/**
 * Run optimization on a SINGLE material+thickness group. Entry point for the
 * parallel worker pool (one sub-worker per group). Takes unexpanded `Pieza[]`
 * (cantidad still present) and returns raw board results plus metadata — no
 * `totalPieces` / `efficiency` / `unplacedPieces` here; those are computed by
 * the aggregator (`mergeOptimizationResults`) after all groups return.
 *
 * The caller is responsible for:
 *   - Pre-sanitizing inputs (we trust them here).
 *   - Passing only pieces of one (material, grosor) — we do not re-group.
 *   - Choosing a deterministic seed per group (e.g. FNV hash of the key) so
 *     re-runs produce identical output.
 *
 * Why expose `rngSeed` (vs. always 42): the legacy `runOptimization` shares
 * one rng across groups so the sequence of groups affects each group's GRASP
 * randomization. Parallelizing breaks that sequencing — we give each group
 * its own seed instead. GRASP is stochastic multi-start, so seed choice only
 * affects diversity, not quality. Expect per-group board counts to drift by
 * ±1-2 vs. the serial single-seed version; global efficiency stays within
 * ±2%.
 */
export function optimizeOneGroup(
  groupPieces: Pieza[],
  _mat: string,
  _grs: number,
  stocks: StockSize[],
  remnants: Remnant[],
  globalSierra = 4.5,
  minOffcut = 200,
  boardTrim = 0,
  engineMode: EngineMode = 'guillotine',
  objective: OptimizationObjective = 'min-boards',
  rngSeed = 42,
): { boards: BoardResult[]; strategy: string; iters: number; timeMs: number; capFires: number } {
  // Reset the module-level cap-fire counter so the returned capFires reflects
  // only decrements from this group's pack. Workers are isolated (one group
  // per worker) so this is safe module state.
  _capFireCount = 0;
  const opt = new Optimizer(stocks, remnants, globalSierra, minOffcut, boardTrim, engineMode, objective);
  const boards = opt.run(groupPieces, rngSeed);
  return {
    boards: boards.map(b => b.toResult()),
    strategy: opt.bestStrategy,
    iters: opt.iters,
    timeMs: opt.time,
    capFires: _capFireCount,
  };
}

// ─────────────────────────────────────────────────────────────
// GUILLOTINE CUT SEQUENCE
// ─────────────────────────────────────────────────────────────
/** Traverse a guillotine cut tree in pre-order and emit cut steps.
 *  Each internal node with a cut emits one CutStep; leaf nodes are skipped. */
function traverseGuillotineTree(
  node: CutTreeNode | null,
  steps: CutStep[],
  cutN: number,
  unit: UnitSystem,
): number {
  if (!node || !node.cut) return cutN;
  const dir = node.cut.type === 'H' ? 'Horizontal' : 'Vertical';
  const label = node.cut.isPieceCut ? 'corte pieza' : 'separación';
  steps.push({
    n: cutN++,
    type: node.cut.type,
    pos: node.cut.pos,
    desc: `${dir} ${label} @ ${_fmtU(node.cut.pos, unit)}`,
  });
  cutN = traverseGuillotineTree(node.left, steps, cutN, unit);
  cutN = traverseGuillotineTree(node.right, steps, cutN, unit);
  return cutN;
}

export function generateCutSequence(board: BoardResult, unit: UnitSystem = 'mm'): CutStep[] {
  const cuts: CutStep[] = [];
  let cutN = 1;

  // ── Trim cuts (edge trimming) ──
  if (board.trim > 0) {
    const t = board.trim;
    cuts.push({ n: cutN++, type: 'H', pos: t,              desc: `y=${_fmtU(t, unit)} — top trim`,    isTrim: true });
    cuts.push({ n: cutN++, type: 'H', pos: board.alto - t, desc: `y=${_fmtU(board.alto - t, unit)} — bottom trim`, isTrim: true });
    cuts.push({ n: cutN++, type: 'V', pos: t,              desc: `x=${_fmtU(t, unit)} — left trim`,  isTrim: true });
    cuts.push({ n: cutN++, type: 'V', pos: board.ancho - t, desc: `x=${_fmtU(board.ancho - t, unit)} — right trim`, isTrim: true });
  }

  // ── Guillotine tree path: exact panel-saw sequence ──
  if (board.cutTree) {
    traverseGuillotineTree(board.cutTree, cuts, cutN, unit);
    return cuts;
  }

  // ── Fallback: grid-based heuristic (for MaxRect boards) ──
  const pcs = [...board.placed].sort((a, b) => a.y - b.y || a.x - b.x);
  if (!pcs.length) return cuts;

  const ySet = new Set([0, board.alto]);
  pcs.forEach(p => { ySet.add(p.y); ySet.add(p.y + p.h); });
  const ys = [...ySet].sort((a, b) => a - b);
  const validH = ys.filter(y => y > 0 && y < board.alto && !pcs.some(p => p.y < y && p.y + p.h > y));

  const boundaries = [0, ...validH, board.alto];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const y1 = boundaries[i], y2 = boundaries[i + 1];
    if (i > 0) cuts.push({ n: cutN++, type: 'H', pos: y1, desc: `Horizontal cut at ${_fmtU(y1, unit)} from top edge` });
    const strip = pcs.filter(p => p.y >= y1 && p.y + p.h <= y2).sort((a, b) => a.x - b.x);
    const xSet = new Set<number>();
    strip.forEach(p => { xSet.add(p.x); xSet.add(p.x + p.w); });
    [...xSet].sort((a, b) => a - b).filter(x => x > 0 && x < board.ancho).forEach(x => {
      if (!strip.some(p => p.x < x && p.x + p.w > x))
        cuts.push({ n: cutN++, type: 'V', pos: x, desc: `  Vertical cut at ${_fmtU(x, unit)} (strip ${_fmtU(y1, unit)}–${_fmtU(y2, unit)})` });
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

    if (p.piece.veta !== 'none') {
      ctx.save(); ctx.globalAlpha = .15; ctx.strokeStyle = '#fff'; ctx.lineWidth = .5; ctx.beginPath();
      const isH = (p.piece.veta === 'horizontal') !== p.rotated; // flip direction if rotated
      if (isH) { for (let dy = 4; dy < h; dy += 5) { ctx.moveTo(x + 2, y + dy); ctx.lineTo(x + w - 2, y + dy); } }
      else     { for (let dx = 4; dx < w; dx += 5) { ctx.moveTo(x + dx, y + 2); ctx.lineTo(x + dx, y + h - 2); } }
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
  labelScale: number;
}

export function renderBoardCAD(
  canvas: HTMLCanvasElement,
  board: BoardResult,
  opts: CADRenderOptions,
): void {
  const { zoom, offsetX, offsetY, showLabels, showDimensions, showKerf, showOffcuts, showGrain, showEdgeBand, hoverPieceIdx, unit, labelScale = 1 } = opts;
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
    if (showGrain && p.piece.veta !== 'none') {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 0.7;
      const drawVertical = (p.piece.veta === 'horizontal') === p.rotated; // horizontal grain + rotated = draw vertical lines
      if (drawVertical) {
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
      const baseSize = Math.min(13, Math.max(8, Math.min(pw / 5.5, ph / 3)));
      const fontSize = baseSize * labelScale;
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
    ctx.strokeStyle = 'rgba(239,68,68,0.65)';
    ctx.lineWidth = Math.max(1, board.sierra * zoom);
    ctx.setLineDash([]);
    // Draw from CutTreeNode when available — bounds each cut to its node rectangle
    // so V-cuts inside a shelf don't extend through other shelves.
    if (board.cutTree) {
      const drawTree = (node: CutTreeNode | null) => {
        if (!node || !node.cut) return;
        ctx.beginPath();
        if (node.cut.type === 'H') {
          ctx.moveTo(ox + node.x * zoom, oy + node.cut.pos * zoom);
          ctx.lineTo(ox + (node.x + node.w) * zoom, oy + node.cut.pos * zoom);
        } else {
          ctx.moveTo(ox + node.cut.pos * zoom, oy + node.y * zoom);
          ctx.lineTo(ox + node.cut.pos * zoom, oy + (node.y + node.h) * zoom);
        }
        ctx.stroke();
        drawTree(node.left);
        drawTree(node.right);
      };
      drawTree(board.cutTree);
    } else {
      // Fallback for MaxRect boards (no cutTree): use flat cut sequence
      const cuts = generateCutSequence(board, unit);
      cuts.forEach((cut) => {
        if (cut.isTrim) return;
        ctx.beginPath();
        if (cut.type === 'H') { ctx.moveTo(ox, oy + cut.pos * zoom); ctx.lineTo(ox + scaledW, oy + cut.pos * zoom); }
        else { ctx.moveTo(ox + cut.pos * zoom, oy); ctx.lineTo(ox + cut.pos * zoom, oy + scaledH); }
        ctx.stroke();
      });
    }
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
