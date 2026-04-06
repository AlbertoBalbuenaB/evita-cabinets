import jsPDF from 'jspdf';
import { OptimizationResult, PIECE_COLORS, generateCutSequence } from './engine';
import { UnitSystem, fmtDim, fmtNum } from './units';
import { EbConfig } from './types';

const EB_LABELS: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };

export function exportOptimizerPDF(
  result: OptimizationResult,
  projectName: string,
  clientName: string,
  unit: UnitSystem = 'mm',
  ebConfig?: EbConfig,
  areas?: string[],
  labelScale: number = 1,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ── Cover ─────────────────────────────────────────────────
  doc.setFillColor(15, 18, 25);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(48);
  doc.text('Evita Optimizer', pageW / 2, 60, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(148, 163, 184);
  doc.text('Board Cutting Optimizer', pageW / 2, 75, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${new Date().toLocaleDateString('en-US')}`, pageW / 2, 95, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(203, 213, 225);
  doc.text(`Project: ${projectName || 'Unnamed'}`, pageW / 2, 120, { align: 'center' });
  doc.text(`Client: ${clientName || 'Not specified'}`, pageW / 2, 130, { align: 'center' });
  if (areas && areas.length > 0) {
    doc.text(`Areas: ${areas.join(', ')}`, pageW / 2, 140, { align: 'center' });
  }

  let totalEB = 0;
  result.boards.forEach(b => b.placed.forEach(p => {
    const cb = p.piece.cubrecanto;
    if (cb.sup > 0) totalEB += p.piece.ancho + 30;
    if (cb.inf > 0) totalEB += p.piece.ancho + 30;
    if (cb.izq > 0) totalEB += p.piece.alto + 30;
    if (cb.der > 0) totalEB += p.piece.alto + 30;
  }));

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  const stats = [
    `Sheets: ${result.boards.length}`,
    `Panels: ${result.totalPieces}`,
    `Efficiency: ${result.efficiency.toFixed(1)}%`,
    `Total cost: $${result.totalCost.toFixed(2)}`,
    `Edge banding: ${(totalEB / 1000).toFixed(2)} linear m`,
    `Strategy: ${result.strategy}`,
    `Time: ${result.timeMs.toFixed(0)}ms`,
  ];
  let statY = 155;
  stats.forEach((stat) => { doc.text(stat, pageW / 2, statY, { align: 'center' }); statY += 8; });

  // ── Board pages ───────────────────────────────────────────
  result.boards.forEach((board, boardIdx) => {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, 'F');

    doc.setFontSize(16); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
    doc.text(`Sheet ${boardIdx + 1}`, 20, 20);
    doc.setFontSize(10); doc.setFont('Helvetica', 'normal'); doc.setTextColor(71, 85, 105);
    doc.text(`Material: ${board.material} | Thickness: ${fmtDim(board.grosor, unit)} | Size: ${fmtDim(board.ancho, unit)}×${fmtDim(board.alto, unit)}`, 20, 28);
    doc.text(`Usage: ${board.usage.toFixed(1)}% | Cost: $${board.stockInfo.costo.toFixed(2)} | ${board.placed.length} panels | Trim: ${board.trim}mm`, 20, 35);

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
      doc.setDrawColor(100, 116, 139); doc.setLineWidth(0.2); doc.setLineDash([1.5, 1.5]);
      doc.rect(startX + t, startY + t, boardW - 2 * t, boardH - 2 * t);
      doc.setLineDash([]);
      doc.restoreGraphicsState();
    }

    // Board grain — very subtle like CAD (alpha ~0.06)
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
    doc.setDrawColor(100, 116, 139); doc.setLineWidth(0.1);
    for (let gy = 3; gy < boardH; gy += 3) {
      doc.line(startX + 1, startY + gy, startX + boardW - 1, startY + gy);
    }
    doc.restoreGraphicsState();

    board.placed.forEach((piece) => {
      const px = startX + piece.x * scale, py = startY + piece.y * scale;
      const pw = piece.w * scale, ph = piece.h * scale;
      const rgb = hexToRgb(PIECE_COLORS[piece.idx % PIECE_COLORS.length]);

      // Panel fill — 20% opacity like CAD (globalAlpha=0.18)
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.20 }));
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(px + 0.3, py + 0.3, pw - 0.6, ph - 0.6, 'F');
      doc.restoreGraphicsState();

      // Panel border — full color like CAD
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
        if (type === 1) doc.setLineDash([]);
        else if (type === 2) doc.setLineDash([1.5, 0.8]);
        else doc.setLineDash([0.5, 0.5]);
        doc.line(x1, y1, x2, y2); doc.setLineDash([]);
      };
      drawEB(edges.top, px + inset, py + inset, px + pw - inset, py + inset);
      drawEB(edges.bottom, px + inset, py + ph - inset, px + pw - inset, py + ph - inset);
      drawEB(edges.left, px + inset, py + inset, px + inset, py + ph - inset);
      drawEB(edges.right, px + pw - inset, py + inset, px + pw - inset, py + ph - inset);

      if (pw > 12 && ph > 8) {
        const dimFz = Math.min(7, Math.max(4, pw / 6)) * labelScale;
        const dimText = `${fmtNum(piece.piece.ancho, unit)}×${fmtNum(piece.piece.alto, unit)}`;
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
    doc.setDrawColor(34, 197, 94); doc.setLineWidth(0.3); doc.setLineDash([1.5, 1.5]);
    board.offcuts.forEach((o) => doc.rect(startX + o.x * scale, startY + o.y * scale, o.w * scale, o.h * scale));
    doc.setLineDash([]);
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

  // ── Cut list (grouped by area) ────────────────────────────
  doc.addPage();
  doc.setFontSize(14); doc.setFont('Helvetica', 'bold'); doc.setTextColor(15, 23, 42);
  doc.text('Cut List', 20, 20);
  let cutListY = 30;
  const colX = [10, 22, 55, 78, 101, 120, 136, 150, 170, 200];

  // Collect all placed pieces with their board index
  const allPieces: { piece: typeof result.boards[0]['placed'][0]; boardIdx: number; board: typeof result.boards[0] }[] = [];
  result.boards.forEach((board, boardIdx) => board.placed.forEach(piece => allPieces.push({ piece, boardIdx, board })));

  // Group by area
  const byArea = new Map<string, typeof allPieces>();
  allPieces.forEach(item => {
    const area = item.piece.piece.area || 'Unassigned';
    if (!byArea.has(area)) byArea.set(area, []);
    byArea.get(area)!.push(item);
  });

  byArea.forEach((items, area) => {
    if (cutListY > pageH - 25) { doc.addPage(); cutListY = 20; }
    doc.setFontSize(11); doc.setFont('Helvetica', 'bold'); doc.setTextColor(15, 23, 42);
    doc.text(`Area: ${area}`, 20, cutListY);
    cutListY += 7;
    doc.setFontSize(7); doc.setTextColor(71, 85, 105); doc.setFont('Helvetica', 'bold');
    ['#', 'Name', 'Width', 'Height', 'Sheet', 'Rot', 'Grain', 'EB', 'Material'].forEach((h, i) => {
      doc.text(h, colX[i], cutListY, { align: i === 1 || i === 8 ? 'left' : 'center' });
    });
    cutListY += 5;
    doc.setFont('Helvetica', 'normal');
    items.forEach((item, pIdx) => {
      if (cutListY > pageH - 10) { doc.addPage(); cutListY = 20; }
      doc.setTextColor(30, 41, 59);
      const p = item.piece;
      const cb = p.piece.cubrecanto;
      const ebParts: string[] = [];
      (['sup', 'inf', 'izq', 'der'] as const).forEach(s => { if (cb[s] > 0) ebParts.push(`${s[0].toUpperCase()}:${EB_LABELS[cb[s]]}`); });
      [
        [`${pIdx + 1}`, 'center'],
        [p.piece.nombre || 'Panel', 'left'],
        [fmtNum(p.piece.ancho, unit), 'center'],
        [fmtNum(p.piece.alto, unit), 'center'],
        [`S${item.boardIdx + 1}`, 'center'],
        [p.rotated ? 'Yes' : '—', 'center'],
        [p.piece.vetaHorizontal ? 'Fixed' : 'Free', 'center'],
        [ebParts.join(' ') || '—', 'center'],
        [p.piece.material || '—', 'left'],
      ].forEach(([text, align], i) => {
        doc.text(text as string, colX[i], cutListY, { align: align as 'left' | 'center' });
      });
      cutListY += 4.5;
    });
    cutListY += 5;
  });

  // ── Edge banding summary ──────────────────────────────────
  if (totalEB > 0) {
    if (cutListY > pageH - 40) { doc.addPage(); cutListY = 20; }
    cutListY += 5;
    doc.setFontSize(12); doc.setFont('Helvetica', 'bold'); doc.setTextColor(15, 23, 42);
    doc.text('Edge Banding Summary', 20, cutListY);
    cutListY += 8;

    const byType: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    result.boards.forEach(b => b.placed.forEach(p => {
      const cb = p.piece.cubrecanto;
      (['sup', 'inf', 'izq', 'der'] as const).forEach(side => {
        const t = cb[side];
        if (t > 0) byType[t] = (byType[t] || 0) + ((side === 'sup' || side === 'inf') ? p.piece.ancho + 30 : p.piece.alto + 30);
      });
    }));

    doc.setFontSize(9); doc.setFont('Helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const ebNames: Record<number, string> = {
      1: ebConfig?.a?.name ? `Type A — ${ebConfig.a.name}` : 'Type A (solid)',
      2: ebConfig?.b?.name ? `Type B — ${ebConfig.b.name}` : 'Type B (dashed)',
      3: ebConfig?.c?.name ? `Type C — ${ebConfig.c.name}` : 'Type C (dotted)',
    };
    const ebPrices: Record<number, number> = { 1: ebConfig?.a?.price || 0, 2: ebConfig?.b?.price || 0, 3: ebConfig?.c?.price || 0 };
    let ebTotalCost = 0;
    [1, 2, 3].forEach(t => {
      if (byType[t] > 0) {
        const meters = byType[t] / 1000;
        const cost = meters * ebPrices[t];
        ebTotalCost += cost;
        doc.text(`${ebNames[t]}: ${meters.toFixed(2)} m${ebPrices[t] > 0 ? ` — $${ebPrices[t].toFixed(2)}/m = $${cost.toFixed(2)}` : ''}`, 25, cutListY);
        cutListY += 5;
      }
    });
    doc.setFont('Helvetica', 'bold');
    doc.text(`Total: ${(totalEB / 1000).toFixed(2)} linear m${ebTotalCost > 0 ? ` — Cost: $${ebTotalCost.toFixed(2)}` : ''}`, 25, cutListY);
    cutListY += 5;
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120, 120, 120);
    doc.text('Note: Each side includes +3cm waste allowance.', 25, cutListY);
  }

  doc.save(`optimization_${(projectName || 'project').replace(/\s+/g, '_')}.pdf`);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}
