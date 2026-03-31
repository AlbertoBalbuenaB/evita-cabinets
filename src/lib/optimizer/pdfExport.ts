import jsPDF from 'jspdf';
import { OptimizationResult, BoardResult, PIECE_COLORS, generateCutSequence } from './engine';
import { UnitSystem, fmtDim, fmtNum } from './units';

const EB_LABELS: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };

export function exportOptimizerPDF(
  result: OptimizationResult,
  projectName: string,
  clientName: string,
  unit: UnitSystem = 'mm',
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
  doc.text(`Optimización: ${new Date().toLocaleDateString('es-ES')}`, pageW / 2, 95, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(203, 213, 225);
  doc.text(`Proyecto: ${projectName || 'Sin nombre'}`, pageW / 2, 120, { align: 'center' });
  doc.text(`Cliente: ${clientName || 'Sin especificar'}`, pageW / 2, 130, { align: 'center' });

  // Edgeband totals
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
    `Tableros: ${result.boards.length}`,
    `Piezas: ${result.totalPieces}`,
    `Eficiencia: ${result.efficiency.toFixed(1)}%`,
    `Costo total: $${result.totalCost.toFixed(2)}`,
    `Cubrecanto: ${(totalEB / 1000).toFixed(2)} m lineales`,
    `Estrategia: ${result.strategy}`,
    `Tiempo: ${result.timeMs.toFixed(0)}ms`,
  ];
  let statY = 155;
  stats.forEach((stat) => { doc.text(stat, pageW / 2, statY, { align: 'center' }); statY += 8; });

  // ── Board pages ───────────────────────────────────────────
  result.boards.forEach((board, boardIdx) => {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, 'F');

    // Header
    doc.setFontSize(16); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
    doc.text(`Tablero ${boardIdx + 1}`, 20, 20);
    doc.setFontSize(10); doc.setFont('Helvetica', 'normal'); doc.setTextColor(71, 85, 105);
    doc.text(`Material: ${board.material} | Grosor: ${fmtDim(board.grosor, unit)} | Dimensiones: ${fmtDim(board.ancho, unit)}×${fmtDim(board.alto, unit)}`, 20, 28);
    doc.text(`Uso: ${board.usage.toFixed(1)}% | Costo: $${board.stockInfo.costo.toFixed(2)} | ${board.placed.length} piezas | Trim: ${board.trim}mm`, 20, 35);

    const maxBoardW = pageW - 50, maxBoardH = pageH - 75;
    const scale = Math.min(maxBoardW / board.ancho, maxBoardH / board.alto);
    const boardW = board.ancho * scale, boardH = board.alto * scale;
    const startX = (pageW - boardW) / 2, startY = 50;

    // Board background
    doc.setDrawColor(51, 65, 85); doc.setLineWidth(0.5); doc.setFillColor(245, 245, 245);
    doc.rect(startX, startY, boardW, boardH, 'FD');

    // Trim visualization
    if (board.trim > 0) {
      const t = board.trim * scale;
      doc.setFillColor(220, 220, 220);
      doc.rect(startX, startY, boardW, t, 'F');
      doc.rect(startX, startY + boardH - t, boardW, t, 'F');
      doc.rect(startX, startY + t, t, boardH - 2 * t, 'F');
      doc.rect(startX + boardW - t, startY + t, t, boardH - 2 * t, 'F');
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2); doc.setLineDash([1, 1]);
      doc.rect(startX + t, startY + t, boardW - 2 * t, boardH - 2 * t);
      doc.setLineDash([]);
    }

    // Grain direction on board (horizontal lines)
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1);
    for (let gy = 3; gy < boardH; gy += 3) {
      doc.line(startX + 1, startY + gy, startX + boardW - 1, startY + gy);
    }

    // Pieces
    board.placed.forEach((piece) => {
      const px = startX + piece.x * scale, py = startY + piece.y * scale;
      const pw = piece.w * scale, ph = piece.h * scale;
      const rgb = hexToRgb(PIECE_COLORS[piece.idx % PIECE_COLORS.length]);

      // Piece fill
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.setDrawColor(Math.max(0, rgb.r - 30), Math.max(0, rgb.g - 30), Math.max(0, rgb.b - 30));
      doc.setLineWidth(0.3);
      doc.rect(px + 0.3, py + 0.3, pw - 0.6, ph - 0.6, 'FD');

      // Grain lines on piece (if vetaHorizontal)
      if (piece.piece.vetaHorizontal) {
        doc.setDrawColor(Math.max(0, rgb.r - 50), Math.max(0, rgb.g - 50), Math.max(0, rgb.b - 50));
        doc.setLineWidth(0.08);
        if (piece.rotated) {
          for (let dx = 2; dx < pw; dx += 2.5) { doc.line(px + dx, py + 1, px + dx, py + ph - 1); }
        } else {
          for (let dy = 2; dy < ph; dy += 2.5) { doc.line(px + 1, py + dy, px + pw - 1, py + dy); }
        }
      }

      // Edge banding (inside piece)
      const cb = piece.piece.cubrecanto;
      const edges = piece.rotated
        ? { top: cb.izq, bottom: cb.der, left: cb.sup, right: cb.inf }
        : { top: cb.sup, bottom: cb.inf, left: cb.izq, right: cb.der };
      const inset = 1;
      const drawEB = (type: number, x1: number, y1: number, x2: number, y2: number) => {
        if (!type) return;
        doc.setDrawColor(30, 30, 30);
        doc.setLineWidth(0.5);
        if (type === 1)      doc.setLineDash([]);
        else if (type === 2) doc.setLineDash([1.5, 0.8]);
        else                 doc.setLineDash([0.5, 0.5]);
        doc.line(x1, y1, x2, y2);
        doc.setLineDash([]);
      };
      drawEB(edges.top,    px + inset, py + inset,      px + pw - inset, py + inset);
      drawEB(edges.bottom, px + inset, py + ph - inset,  px + pw - inset, py + ph - inset);
      drawEB(edges.left,   px + inset, py + inset,      px + inset,      py + ph - inset);
      drawEB(edges.right,  px + pw - inset, py + inset, px + pw - inset, py + ph - inset);

      // Label
      if (pw > 12 && ph > 8) {
        doc.setFontSize(Math.min(7, Math.max(4, pw / 6)));
        doc.setTextColor(0, 0, 0);
        doc.text(
          `${fmtNum(piece.piece.ancho, unit)}×${fmtNum(piece.piece.alto, unit)}`,
          px + pw / 2, py + ph / 2 - (piece.piece.nombre && ph > 10 ? 1.5 : 0),
          { align: 'center', baseline: 'middle' },
        );
        if (piece.piece.nombre && ph > 10) {
          doc.setFontSize(Math.min(5, Math.max(3, pw / 8)));
          doc.setTextColor(80, 80, 80);
          doc.text(piece.piece.nombre, px + pw / 2, py + ph / 2 + 2, { align: 'center', baseline: 'middle' });
        }
      }
    });

    // Offcuts
    doc.setDrawColor(34, 197, 94); doc.setLineWidth(0.3); doc.setLineDash([1.5, 1.5]);
    board.offcuts.forEach((o) => {
      doc.rect(startX + o.x * scale, startY + o.y * scale, o.w * scale, o.h * scale);
    });
    doc.setLineDash([]);

    // Dimension annotations
    doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.2); doc.setFontSize(7); doc.setTextColor(60, 60, 60);
    // Horizontal (bottom)
    const dimY = startY + boardH + 5;
    doc.line(startX, startY + boardH + 1, startX, dimY + 2);
    doc.line(startX + boardW, startY + boardH + 1, startX + boardW, dimY + 2);
    doc.line(startX, dimY, startX + boardW, dimY);
    doc.text(fmtDim(board.ancho, unit), startX + boardW / 2, dimY + 3, { align: 'center' });
    // Vertical (left)
    const dimX = startX - 5;
    doc.line(startX - 1, startY, dimX - 2, startY);
    doc.line(startX - 1, startY + boardH, dimX - 2, startY + boardH);
    doc.line(dimX, startY, dimX, startY + boardH);
    doc.text(fmtDim(board.alto, unit), dimX - 3, startY + boardH / 2, { align: 'center', angle: 90 });
  });

  // ── Cut list ──────────────────────────────────────────────
  doc.addPage();
  doc.setFontSize(14); doc.setFont('Helvetica', 'bold'); doc.setTextColor(15, 23, 42);
  doc.text('Lista de Corte', 20, 20);
  let cutListY = 30;
  const colX = [10, 22, 55, 78, 101, 124, 142, 158, 178];

  result.boards.forEach((board, boardIdx) => {
    if (cutListY > pageH - 30) { doc.addPage(); cutListY = 20; }
    doc.setFontSize(10); doc.setFont('Helvetica', 'bold'); doc.setTextColor(15, 23, 42);
    doc.text(`Tablero ${boardIdx + 1} - ${board.material} ${fmtDim(board.grosor, unit)} (${fmtDim(board.ancho, unit)}×${fmtDim(board.alto, unit)}) Trim: ${board.trim}mm`, 20, cutListY);
    cutListY += 8;
    doc.setFontSize(7); doc.setTextColor(71, 85, 105); doc.setFont('Helvetica', 'bold');
    ['#', 'Nombre', 'Ancho', 'Alto', 'Pos X', 'Pos Y', 'Rot', 'Veta', 'Canto'].forEach((h, i) => {
      doc.text(h, colX[i], cutListY, { align: i === 1 ? 'left' : 'center' });
    });
    cutListY += 5;
    doc.setFont('Helvetica', 'normal');
    board.placed.forEach((piece, pIdx) => {
      if (cutListY > pageH - 10) { doc.addPage(); cutListY = 20; }
      doc.setTextColor(30, 41, 59);
      const cb = piece.piece.cubrecanto;
      const ebParts: string[] = [];
      (['sup', 'inf', 'izq', 'der'] as const).forEach(side => {
        if (cb[side] > 0) ebParts.push(`${side[0].toUpperCase()}:${EB_LABELS[cb[side]] || cb[side]}`);
      });
      const ebStr = ebParts.join(' ') || '—';
      [
        [`${pIdx + 1}`, 'center'],
        [piece.piece.nombre || 'Pieza', 'left'],
        [fmtNum(piece.piece.ancho, unit), 'center'],
        [fmtNum(piece.piece.alto, unit), 'center'],
        [fmtNum(piece.x, unit), 'center'],
        [fmtNum(piece.y, unit), 'center'],
        [piece.rotated ? 'Sí' : '—', 'center'],
        [piece.piece.vetaHorizontal ? 'Fija' : 'Libre', 'center'],
        [ebStr, 'center'],
      ].forEach(([text, align], i) => {
        doc.text(text as string, colX[i], cutListY, { align: align as 'left' | 'center' });
      });
      cutListY += 4.5;
    });
    cutListY += 5;
  });

  // ── Edgeband summary ──────────────────────────────────────
  if (totalEB > 0) {
    if (cutListY > pageH - 40) { doc.addPage(); cutListY = 20; }
    cutListY += 5;
    doc.setFontSize(12); doc.setFont('Helvetica', 'bold'); doc.setTextColor(15, 23, 42);
    doc.text('Resumen Cubrecanto', 20, cutListY);
    cutListY += 8;

    // Per-type totals
    const byType: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    result.boards.forEach(b => b.placed.forEach(p => {
      const cb = p.piece.cubrecanto;
      (['sup', 'inf', 'izq', 'der'] as const).forEach(side => {
        const t = cb[side];
        if (t > 0) {
          const len = (side === 'sup' || side === 'inf') ? p.piece.ancho + 30 : p.piece.alto + 30;
          byType[t] = (byType[t] || 0) + len;
        }
      });
    }));

    doc.setFontSize(9); doc.setFont('Helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const typeNames = ['', 'Tipo A (━━)', 'Tipo B (╌╌)', 'Tipo C (····)'];
    [1, 2, 3].forEach(t => {
      if (byType[t] > 0) {
        doc.text(`${typeNames[t]}: ${(byType[t] / 1000).toFixed(2)} m lineales`, 25, cutListY);
        cutListY += 5;
      }
    });
    doc.setFont('Helvetica', 'bold');
    doc.text(`Total: ${(totalEB / 1000).toFixed(2)} m lineales`, 25, cutListY);
    cutListY += 5;
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120, 120, 120);
    doc.text('Nota: Cada lado incluye +3cm de desperdicio.', 25, cutListY);
  }

  doc.save(`optimizacion_${(projectName || 'proyecto').replace(/\s+/g, '_')}.pdf`);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
