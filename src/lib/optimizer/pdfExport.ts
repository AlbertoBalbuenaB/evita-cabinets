import jsPDF from 'jspdf';
import { PIECE_COLORS } from './engine';
import { fmtDim, fmtNum } from './units';
import { EbConfig, OptimizationResult, UnitSystem } from './types';

const EB_LABELS: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

/** Convert 0-based index to letter code: 0→A, 1→B, ..., 25→Z, 26→AA, 27→AB */
function partLabel(idx: number): string {
  let label = '';
  let n = idx;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/**
 * Stable fingerprint for board deduplication. Two boards are considered
 * identical when they have the same stock + the same placed pieces at the
 * same coordinates (orientation included). Sort the placed pieces so the
 * order in the engine's output doesn't affect the fingerprint.
 */
function boardFingerprint(b: OptimizationResult['boards'][number]): string {
  const placed = [...b.placed]
    .map(p => `${p.piece.id}|${p.x}|${p.y}|${p.w}|${p.h}|${p.rotated ? 1 : 0}`)
    .sort()
    .join(';');
  return `${b.material}|${b.grosor}|${b.ancho}|${b.alto}|${b.stockInfo.nombre}|${placed}`;
}

export type PdfLang = 'en' | 'es';

const i18n: Record<PdfLang, Record<string, string>> = {
  en: {
    subtitle: 'Board Cutting Optimizer',
    date: 'Date',
    project: 'Project',
    client: 'Client',
    areas: 'Areas',
    sheets: 'Sheets',
    parts: 'Parts',
    efficiency: 'Efficiency',
    totalCost: 'Total cost',
    edgeBanding: 'Edge banding',
    strategy: 'Strategy',
    time: 'Time',
    sheet: 'Sheet',
    material: 'Material',
    thickness: 'Thickness',
    size: 'Size',
    usage: 'Usage',
    cost: 'Cost',
    trim: 'Trim',
    cutListByArea: 'Cut List by Area',
    cutListByMaterial: 'Cut List by Material',
    area: 'Area',
    unassigned: 'Unassigned',
    name: 'Name',
    qty: 'Qty',
    width: 'Width',
    height: 'Height',
    rot: 'Rot',
    grain: 'Grain',
    eb: 'EB',
    yes: 'Yes',
    fixed: 'Fixed',
    free: 'Free',
    part: 'Part',
    unnamed: 'Unnamed',
    notSpecified: 'Not specified',
    ebSummary: 'Edge Banding Summary',
    typeASolid: 'Type A (solid)',
    typeBDashed: 'Type B (dashed)',
    typeCDotted: 'Type C (dotted)',
    total: 'Total',
    linearM: 'linear m',
    ebWasteNote: 'Note: Each side includes +3cm waste allowance.',
  },
  es: {
    subtitle: 'Optimizador de Corte',
    date: 'Fecha',
    project: 'Proyecto',
    client: 'Cliente',
    areas: 'Áreas',
    sheets: 'Láminas',
    parts: 'Piezas',
    efficiency: 'Eficiencia',
    totalCost: 'Costo total',
    edgeBanding: 'Cubrecanto',
    strategy: 'Estrategia',
    time: 'Tiempo',
    sheet: 'Lámina',
    material: 'Material',
    thickness: 'Espesor',
    size: 'Tamaño',
    usage: 'Uso',
    cost: 'Costo',
    trim: 'Recorte',
    cutListByArea: 'Lista de Corte por Área',
    cutListByMaterial: 'Lista de Corte por Material',
    area: 'Área',
    unassigned: 'Sin asignar',
    name: 'Nombre',
    qty: 'Cant',
    width: 'Ancho',
    height: 'Alto',
    rot: 'Rot',
    grain: 'Veta',
    eb: 'CC',
    yes: 'Sí',
    fixed: 'Fija',
    free: 'Libre',
    part: 'Pieza',
    unnamed: 'Sin nombre',
    notSpecified: 'No especificado',
    ebSummary: 'Resumen de Cubrecanto',
    typeASolid: 'Tipo A (continuo)',
    typeBDashed: 'Tipo B (discontinuo)',
    typeCDotted: 'Tipo C (punteado)',
    total: 'Total',
    linearM: 'm lineales',
    ebWasteNote: 'Nota: Cada lado incluye +3cm de desperdicio.',
  },
};

export async function exportOptimizerPDF(
  result: OptimizationResult,
  projectName: string,
  _clientName: string,
  unit: UnitSystem = 'mm',
  ebConfig?: EbConfig,
  areas?: string[],
  labelScale: number = 1,
  lang: PdfLang = 'en',
): Promise<void> {
  const t = i18n[lang];
  const dateFmt = lang === 'es' ? 'es-MX' : 'en-US';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Pre-compute EB total (used later)
  let totalEB = 0;
  result.boards.forEach(b => b.placed.forEach(p => {
    const cb = p.piece.cubrecanto;
    if (cb.sup > 0) totalEB += p.piece.ancho + 30;
    if (cb.inf > 0) totalEB += p.piece.ancho + 30;
    if (cb.izq > 0) totalEB += p.piece.alto + 30;
    if (cb.der > 0) totalEB += p.piece.alto + 30;
  }));

  // ── Group identical boards ───────────────────────────────
  // Boards with the same stock and same placed pieces in the same coordinates
  // are physically interchangeable; we render one page per unique layout with
  // a "×N" badge and a sheet range, instead of N duplicate pages.
  interface BoardGroup {
    board: OptimizationResult['boards'][number];
    count: number;
    firstIdx: number; // first ORIGINAL index in result.boards (0-based)
  }
  const boardGroups: BoardGroup[] = [];
  const groupByFingerprint = new Map<string, BoardGroup>();
  result.boards.forEach((board, idx) => {
    const fp = boardFingerprint(board);
    const existing = groupByFingerprint.get(fp);
    if (existing) {
      existing.count += 1;
    } else {
      const g: BoardGroup = { board, count: 1, firstIdx: idx };
      groupByFingerprint.set(fp, g);
      boardGroups.push(g);
    }
  });

  // Map from each ORIGINAL board index → the BoardGroup that represents it.
  // Used by the cut list to translate per-piece sheet locations into the
  // grouped sheet labels (so a piece on original sheets 1+2+3 displays as
  // "S1-3" if those three sheets are merged into one group).
  const groupByOriginalIdx = new Map<number, BoardGroup>();
  result.boards.forEach((_b, idx) => {
    const fp = boardFingerprint(result.boards[idx]);
    groupByOriginalIdx.set(idx, groupByFingerprint.get(fp)!);
  });

  // Build global piece index → letter mapping. Iterate over UNIQUE boards
  // only and skip already-mapped keys, so duplicate placements across
  // identical boards don't waste letters (was a pre-existing bug where
  // letters were skipped when boards repeated).
  const pieceLetterMap = new Map<string, string>();
  let globalPieceIdx = 0;
  boardGroups.forEach(({ board }) => board.placed.forEach(p => {
    const key = `${p.piece.id}-${p.x}-${p.y}`;
    if (!pieceLetterMap.has(key)) {
      pieceLetterMap.set(key, partLabel(globalPieceIdx++));
    }
  }));

  // Load logo
  const logoData = await loadImageAsBase64('/evita_logo.png');

  // ── Cover (white background) ──────────────────────────────
  // Logo (aspect ratio 1280:673 ≈ 1.90)
  let curY = 35;
  if (logoData) {
    const logoH = 28;
    const logoW = logoH * 1.90;
    doc.addImage(logoData, 'PNG', pageW / 2 - logoW / 2, curY, logoW, logoH);
    curY += logoH + 10;
  } else {
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(30, 41, 59);
    doc.text('EVITA CABINETS', pageW / 2, curY + 10, { align: 'center' });
    curY += 25;
  }

  // Accent line
  doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 60, curY, pageW / 2 + 60, curY);
  curY += 14;

  // Project name — hero text. Auto-shrink to fit, then wrap to multiple
  // lines if still too wide at the minimum size. Available width = page
  // minus 20mm side margins.
  const titleText = projectName || t.unnamed;
  const titleMaxW = pageW - 40;
  let titleSize = 36;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(titleSize);
  doc.setTextColor(15, 23, 42);
  while (titleSize > 16 && doc.getTextWidth(titleText) > titleMaxW) {
    titleSize -= 1;
    doc.setFontSize(titleSize);
  }
  // Empirical line-height factor for jsPDF Helvetica (mm per pt at the given size).
  const titleLineH = titleSize * 0.42;
  if (doc.getTextWidth(titleText) > titleMaxW) {
    // Still too wide at min size — wrap to multiple lines.
    const lines = doc.splitTextToSize(titleText, titleMaxW) as string[];
    lines.forEach((line, i) => {
      doc.text(line, pageW / 2, curY + i * titleLineH, { align: 'center' });
    });
    curY += lines.length * titleLineH;
  } else {
    doc.text(titleText, pageW / 2, curY, { align: 'center' });
    curY += 10;
  }

  // Subtitle
  doc.setFontSize(12); doc.setTextColor(100, 116, 139); doc.setFont('Helvetica', 'normal');
  doc.text(t.subtitle, pageW / 2, curY, { align: 'center' });
  curY += 12;

  // Accent line
  doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 60, curY, pageW / 2 + 60, curY);
  curY += 10;

  // Key stats — compact
  doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.setFont('Helvetica', 'normal');
  const summaryLine = `${t.sheets}: ${result.boards.length}  ·  ${t.parts}: ${result.totalPieces}  ·  ${t.efficiency}: ${result.efficiency.toFixed(1)}%`;
  doc.text(summaryLine, pageW / 2, curY, { align: 'center' });
  curY += 6;
  if (totalEB > 0) {
    doc.text(`${t.edgeBanding}: ${(totalEB / 1000).toFixed(2)} ${t.linearM}`, pageW / 2, curY, { align: 'center' });
    curY += 6;
  }
  if (areas && areas.length > 0) {
    doc.text(`${t.areas}: ${areas.join(', ')}`, pageW / 2, curY, { align: 'center' });
  }

  // Date — bottom right
  doc.setFontSize(9); doc.setTextColor(148, 163, 184);
  doc.text(new Date().toLocaleDateString(dateFmt, { year: 'numeric', month: 'long', day: 'numeric' }), pageW - 20, pageH - 12, { align: 'right' });

  // ── Board pages ───────────────────────────────────────────
  boardGroups.forEach(({ board, count, firstIdx }) => {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, 'F');

    doc.setFontSize(16); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
    const titleSuffix = count > 1 ? `  ×${count}` : '';
    doc.text((projectName || t.unnamed) + titleSuffix, 20, 20);
    doc.setFontSize(10); doc.setFont('Helvetica', 'normal'); doc.setTextColor(71, 85, 105);
    doc.text(`${t.material}: ${board.material} | ${t.thickness}: ${fmtDim(board.grosor, unit)} | ${t.size}: ${fmtDim(board.ancho, unit)}×${fmtDim(board.alto, unit)}`, 20, 28);
    doc.text(`${t.usage}: ${board.usage.toFixed(1)}% | ${board.placed.length} ${t.parts.toLowerCase()} | ${t.trim}: ${board.trim}mm`, 20, 35);

    // Sheet number footer — bottom right. Show range when grouped.
    doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    const sheetLabel = count > 1
      ? `${t.sheet} ${firstIdx + 1}-${firstIdx + count}`
      : `${t.sheet} ${firstIdx + 1}`;
    doc.text(sheetLabel, pageW - 15, pageH - 8, { align: 'right' });

    const maxBoardW = pageW - 50, maxBoardH = pageH - 75;
    const scale = Math.min(maxBoardW / board.ancho, maxBoardH / board.alto);
    const boardW = board.ancho * scale, boardH = board.alto * scale;
    const startX = (pageW - boardW) / 2, startY = 50;

    // Board background — white like CAD
    doc.setDrawColor(51, 65, 85); doc.setLineWidth(0.5); doc.setFillColor(255, 255, 255);
    doc.rect(startX, startY, boardW, boardH, 'FD');

    // Trim areas — nearly invisible like CAD (alpha ~0.09)
    if (board.trim > 0) {
      const t = board.trim * scale;
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.10 }));
      doc.setFillColor(100, 116, 139);
      doc.rect(startX, startY, boardW, t, 'F');
      doc.rect(startX, startY + boardH - t, boardW, t, 'F');
      doc.rect(startX, startY + t, t, boardH - 2 * t, 'F');
      doc.rect(startX + boardW - t, startY + t, t, boardH - 2 * t, 'F');
      doc.setGState(new (doc as any).GState({ opacity: 0.40 }));
      doc.setDrawColor(100, 116, 139); doc.setLineWidth(0.2); (doc as any).setLineDash([1.5, 1.5]);
      doc.rect(startX + t, startY + t, boardW - 2 * t, boardH - 2 * t);
      (doc as any).setLineDash([]);
      doc.restoreGraphicsState();
    }

    // Board grain — very subtle
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.02 }));
    doc.setDrawColor(100, 116, 139); doc.setLineWidth(0.1);
    for (let gy = 3; gy < boardH; gy += 3) {
      doc.line(startX + 1, startY + gy, startX + boardW - 1, startY + gy);
    }
    doc.restoreGraphicsState();

    board.placed.forEach((piece) => {
      const px = startX + piece.x * scale, py = startY + piece.y * scale;
      const pw = piece.w * scale, ph = piece.h * scale;
      const rgb = hexToRgb(PIECE_COLORS[piece.idx % PIECE_COLORS.length]);

      // Part fill — 20% opacity like CAD (globalAlpha=0.18)
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.20 }));
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(px + 0.3, py + 0.3, pw - 0.6, ph - 0.6, 'F');
      doc.restoreGraphicsState();

      // Part border — full color like CAD
      doc.setDrawColor(rgb.r, rgb.g, rgb.b);
      doc.setLineWidth(0.5);
      doc.rect(px + 0.3, py + 0.3, pw - 0.6, ph - 0.6, 'S');


      const cb = piece.piece.cubrecanto;
      const edges = piece.rotated
        ? { top: cb.izq, bottom: cb.der, left: cb.sup, right: cb.inf }
        : { top: cb.sup, bottom: cb.inf, left: cb.izq, right: cb.der };
      const inset = 1;
      const drawEB = (type: number, x1: number, y1: number, x2: number, y2: number) => {
        if (!type) return;
        doc.setDrawColor(30, 30, 30); doc.setLineWidth(0.5);
        if (type === 1) (doc as any).setLineDash([]);
        else if (type === 2) (doc as any).setLineDash([1.5, 0.8]);
        else (doc as any).setLineDash([0.5, 0.5]);
        doc.line(x1, y1, x2, y2); (doc as any).setLineDash([]);
      };
      drawEB(edges.top, px + inset, py + inset, px + pw - inset, py + inset);
      drawEB(edges.bottom, px + inset, py + ph - inset, px + pw - inset, py + ph - inset);
      drawEB(edges.left, px + inset, py + inset, px + inset, py + ph - inset);
      drawEB(edges.right, px + pw - inset, py + inset, px + pw - inset, py + ph - inset);

      if (pw > 12 && ph > 8) {
        const pieceKey = `${piece.piece.id}-${piece.x}-${piece.y}`;
        const pLetter = pieceLetterMap.get(pieceKey) || '';
        const dimFz = Math.min(7, Math.max(4, pw / 6)) * labelScale;
        const dimText = `${pLetter}  ${fmtNum(piece.piece.ancho, unit)}×${fmtNum(piece.piece.alto, unit)}`;
        const hasName = piece.piece.nombre && ph > 10;
        const nameFz = Math.min(5, Math.max(3, pw / 8)) * labelScale;

        // Measure text widths
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(dimFz);
        const dimW = doc.getTextWidth(dimText);
        let nameW = 0;
        if (hasName) {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(nameFz);
          nameW = doc.getTextWidth(piece.piece.nombre!);
        }

        // Semi-transparent white background
        const pad = 1.5;
        const lineGap = hasName ? 1.8 : 0;
        const bgW = Math.max(dimW, nameW) + pad * 2;
        const bgH = dimFz * 0.35 + (hasName ? nameFz * 0.35 + lineGap : 0) + pad * 2;
        const bgX = px + pw / 2 - bgW / 2;
        const bgY = py + ph / 2 - bgH / 2;

        doc.saveGraphicsState();
        doc.setGState(new (doc as any).GState({ opacity: 0.8 }));
        doc.setFillColor(255, 255, 255);
        doc.rect(bgX, bgY, bgW, bgH, 'F');
        doc.restoreGraphicsState();

        // Dimension text (bold)
        const cy = py + ph / 2;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(dimFz);
        doc.setTextColor(30, 30, 30);
        doc.text(dimText, px + pw / 2, cy - (hasName ? lineGap / 2 + nameFz * 0.15 : 0),
          { align: 'center', baseline: 'middle' });

        // Name text (normal, gray)
        if (hasName) {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(nameFz);
          doc.setTextColor(80, 80, 80);
          doc.text(piece.piece.nombre!, px + pw / 2, cy + lineGap / 2 + dimFz * 0.15,
            { align: 'center', baseline: 'middle' });
        }

        doc.setFont('Helvetica', 'normal');
      }
    });

    // Offcuts — green dashed like CAD (alpha ~0.65)
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.65 }));
    doc.setDrawColor(34, 197, 94); doc.setLineWidth(0.3); (doc as any).setLineDash([1.5, 1.5]);
    board.offcuts.forEach((o) => doc.rect(startX + o.x * scale, startY + o.y * scale, o.w * scale, o.h * scale));
    (doc as any).setLineDash([]);
    doc.restoreGraphicsState();

    doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.2); doc.setFontSize(7); doc.setTextColor(60, 60, 60);
    const dimY = startY + boardH + 5;
    doc.line(startX, startY + boardH + 1, startX, dimY + 2);
    doc.line(startX + boardW, startY + boardH + 1, startX + boardW, dimY + 2);
    doc.line(startX, dimY, startX + boardW, dimY);
    doc.text(fmtDim(board.ancho, unit), startX + boardW / 2, dimY + 3, { align: 'center' });
    const dimX = startX - 5;
    doc.line(startX - 1, startY, dimX - 2, startY);
    doc.line(startX - 1, startY + boardH, dimX - 2, startY + boardH);
    doc.line(dimX, startY, dimX, startY + boardH);
    doc.text(fmtDim(board.alto, unit), dimX - 3, startY + boardH / 2, { align: 'center', angle: 90 });
  });

  // ── Shared cut list rendering function ─────────────────────
  // 13 columns: # Name Qty W H Sheets Rot Grain T B L R Material
  const colX = [10, 22, 52, 62, 75, 88, 110, 122, 135, 143, 151, 159, 200];
  const allPieces: { piece: typeof result.boards[0]['placed'][0]; boardIdx: number; board: typeof result.boards[0] }[] = [];
  result.boards.forEach((board, boardIdx) => board.placed.forEach(piece => allPieces.push({ piece, boardIdx, board })));

  // Group physical placements by piece kind. The engine reuses the same
  // Pieza id for every copy of the same input piece, so piece.id is the
  // canonical kind key. We add the dimensions, material, and cubrecanto as
  // a safety net in case the engine ever splits identical-kind pieces.
  function pieceKindKey(p: typeof allPieces[number]['piece']): string {
    const cb = p.piece.cubrecanto;
    return `${p.piece.id}|${p.piece.ancho}|${p.piece.alto}|${p.piece.material}|${cb.sup}-${cb.inf}-${cb.izq}-${cb.der}`;
  }

  const renderCutList = (title: string, groups: Map<string, typeof allPieces>, groupLabel: string) => {
    doc.addPage();
    doc.setFontSize(14); doc.setFont('Helvetica', 'bold'); doc.setTextColor(15, 23, 42);
    doc.text(title, 20, 20);
    let y = 30;

    groups.forEach((items, groupName) => {
      if (y > pageH - 25) { doc.addPage(); y = 20; }
      doc.setFontSize(11); doc.setFont('Helvetica', 'bold'); doc.setTextColor(15, 23, 42);
      doc.text(`${groupLabel}: ${groupName}`, 20, y);
      y += 7;
      doc.setFontSize(7); doc.setTextColor(71, 85, 105); doc.setFont('Helvetica', 'bold');
      ['#', t.name, t.qty, t.width, t.height, t.sheets, t.rot, t.grain, 'T', 'B', 'L', 'R', t.material].forEach((h, i) => {
        doc.text(h, colX[i], y, { align: i === 1 || i === 12 ? 'left' : 'center' });
      });
      y += 5;
      doc.setFont('Helvetica', 'normal');

      // Group items by piece kind so identical pieces collapse into one row.
      const kindGroups = new Map<string, typeof items>();
      items.forEach((item) => {
        const k = pieceKindKey(item.piece);
        if (!kindGroups.has(k)) kindGroups.set(k, []);
        kindGroups.get(k)!.push(item);
      });

      kindGroups.forEach((kindItems) => {
        if (y > pageH - 10) { doc.addPage(); y = 20; }
        doc.setTextColor(30, 41, 59);
        const first = kindItems[0];
        const p = first.piece;
        const cb = p.piece.cubrecanto;
        const pKey = `${p.piece.id}-${p.x}-${p.y}`;
        const letter = pieceLetterMap.get(pKey) || '';

        // Build sheet list grouped by parent board group, so duplicate
        // physical sheets that share a layout collapse with the same range
        // shown on the board page footer (e.g. "S1-3×2" means 2 copies of
        // the piece appear in the layout printed as sheets 1, 2 and 3).
        // Truncate after 4 entries to keep the cell readable.
        const groupCounts = new Map<BoardGroup, number>();
        kindItems.forEach(it => {
          const g = groupByOriginalIdx.get(it.boardIdx);
          if (!g) return;
          groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
        });
        const groupEntries = Array.from(groupCounts.entries())
          .sort(([a], [b]) => a.firstIdx - b.firstIdx);
        let sheetText = groupEntries
          .slice(0, 4)
          .map(([g, c]) => {
            const label = g.count > 1
              ? `S${g.firstIdx + 1}-${g.firstIdx + g.count}`
              : `S${g.firstIdx + 1}`;
            return c > 1 ? `${label}×${c}` : label;
          })
          .join(',');
        if (groupEntries.length > 4) sheetText += `,+${groupEntries.length - 4}`;

        [
          [letter, 'center'],
          [p.piece.nombre || t.part, 'left'],
          [String(kindItems.length), 'center'],
          [fmtNum(p.piece.ancho, unit), 'center'],
          [fmtNum(p.piece.alto, unit), 'center'],
          [sheetText, 'center'],
          [p.rotated ? t.yes : '—', 'center'],
          [p.piece.veta === 'none' ? '—' : p.piece.veta === 'horizontal' ? 'H' : 'V', 'center'],
          [cb.sup > 0 ? EB_LABELS[cb.sup] : '—', 'center'],
          [cb.inf > 0 ? EB_LABELS[cb.inf] : '—', 'center'],
          [cb.izq > 0 ? EB_LABELS[cb.izq] : '—', 'center'],
          [cb.der > 0 ? EB_LABELS[cb.der] : '—', 'center'],
          [p.piece.material || '—', 'left'],
        ].forEach(([text, align], i) => {
          doc.text(text as string, colX[i], y, { align: align as 'left' | 'center' });
        });
        y += 4.5;
      });
      y += 5;
    });
    return y;
  };

  // ── Cut list by Area ──────────────────────────────────────
  const byArea = new Map<string, typeof allPieces>();
  allPieces.forEach(item => {
    const area = item.piece.piece.area || t.unassigned;
    if (!byArea.has(area)) byArea.set(area, []);
    byArea.get(area)!.push(item);
  });
  let cutListY = renderCutList(t.cutListByArea, byArea, t.area);

  // ── Edge banding summary (on same page as area cut list) ──
  if (totalEB > 0) {
    if (cutListY > pageH - 40) { doc.addPage(); cutListY = 20; }
    cutListY += 5;
    doc.setFontSize(12); doc.setFont('Helvetica', 'bold'); doc.setTextColor(15, 23, 42);
    doc.text(t.ebSummary, 20, cutListY);
    cutListY += 8;

    const byType: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    result.boards.forEach(b => b.placed.forEach(p => {
      const cb = p.piece.cubrecanto;
      (['sup', 'inf', 'izq', 'der'] as const).forEach(side => {
        const tt = cb[side];
        if (tt > 0) byType[tt] = (byType[tt] || 0) + ((side === 'sup' || side === 'inf') ? p.piece.ancho + 30 : p.piece.alto + 30);
      });
    }));

    doc.setFontSize(9); doc.setFont('Helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const ebNames: Record<number, string> = {
      1: ebConfig?.a?.name ? `${t.typeASolid.split('(')[0].trim()} — ${ebConfig.a.name}` : t.typeASolid,
      2: ebConfig?.b?.name ? `${t.typeBDashed.split('(')[0].trim()} — ${ebConfig.b.name}` : t.typeBDashed,
      3: ebConfig?.c?.name ? `${t.typeCDotted.split('(')[0].trim()} — ${ebConfig.c.name}` : t.typeCDotted,
    };
    [1, 2, 3].forEach(tt => {
      if (byType[tt] > 0) {
        doc.text(`${ebNames[tt]}: ${(byType[tt] / 1000).toFixed(2)} m`, 25, cutListY);
        cutListY += 5;
      }
    });
    doc.setFont('Helvetica', 'bold');
    doc.text(`${t.total}: ${(totalEB / 1000).toFixed(2)} ${t.linearM}`, 25, cutListY);
    cutListY += 5;
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120, 120, 120);
    doc.text(t.ebWasteNote, 25, cutListY);
  }

  // ── Cut list by Material ──────────────────────────────────
  const byMaterial = new Map<string, typeof allPieces>();
  allPieces.forEach(item => {
    const mat = item.piece.piece.material || t.unassigned;
    if (!byMaterial.has(mat)) byMaterial.set(mat, []);
    byMaterial.get(mat)!.push(item);
  });
  renderCutList(t.cutListByMaterial, byMaterial, t.material);

  const filePrefix = lang === 'es' ? 'optimizacion' : 'optimization';
  doc.save(`${filePrefix}_${(projectName || 'project').replace(/\s+/g, '_')}.pdf`);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}
