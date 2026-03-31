import jsPDF from 'jspdf';
import { OptimizationResult, PIECE_COLORS } from './engine';
import { UnitSystem, fmtDim, fmtNum } from './units';

export function exportOptimizerPDF(
  result: OptimizationResult,
  projectName: string,
  clientName: string,
  unit: UnitSystem = 'mm',
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Cover
  doc.setFillColor(15, 18, 25);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(48);
  doc.text('CutBoard Pro', pageW / 2, 60, { align: 'center' });
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
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  const stats = [
    `Tableros: ${result.boards.length}`,
    `Piezas: ${result.totalPieces}`,
    `Eficiencia: ${result.efficiency.toFixed(1)}%`,
    `Costo total: $${result.totalCost.toFixed(2)}`,
    `Tiempo: ${result.timeMs.toFixed(0)}ms`,
    `Estrategia: ${result.strategy}`,
  ];
  let statY = 160;
  stats.forEach((stat) => { doc.text(stat, pageW / 2, statY, { align: 'center' }); statY += 8; });

  // Board pages
  result.boards.forEach((board, boardIdx) => {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setFontSize(16); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
    doc.text(`Tablero ${boardIdx + 1}`, 20, 20);
    doc.setFontSize(10); doc.setFont('Helvetica', 'normal'); doc.setTextColor(71, 85, 105);
    doc.text(`Material: ${board.material} | Grosor: ${fmtDim(board.grosor, unit)} | Dimensiones: ${fmtDim(board.ancho, unit)}×${fmtDim(board.alto, unit)}`, 20, 28);
    doc.text(`Uso: ${board.usage.toFixed(1)}% | Costo: $${board.stockInfo.costo.toFixed(2)} | ${board.placed.length} piezas`, 20, 35);

    const maxBoardW = pageW - 40, maxBoardH = pageH - 70;
    const scale = Math.min(maxBoardW / board.ancho, maxBoardH / board.alto);
    const boardW = board.ancho * scale, boardH = board.alto * scale;
    const startX = (pageW - boardW) / 2, startY = 50;

    doc.setDrawColor(51, 65, 85); doc.setLineWidth(0.5); doc.setFillColor(30, 41, 59);
    doc.rect(startX, startY, boardW, boardH, 'FD');

    board.placed.forEach((piece) => {
      const px = startX + piece.x * scale, py = startY + piece.y * scale;
      const pw = piece.w * scale, ph = piece.h * scale;
      const rgb = hexToRgb(PIECE_COLORS[piece.idx % PIECE_COLORS.length]);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.setDrawColor(Math.max(0, rgb.r - 30), Math.max(0, rgb.g - 30), Math.max(0, rgb.b - 30));
      doc.setLineWidth(0.3);
      doc.rect(px + 0.5, py + 0.5, pw - 1, ph - 1, 'FD');
      if (pw > 15 && ph > 12) {
        doc.setFontSize(7); doc.setTextColor(0, 0, 0);
        doc.text(`${fmtNum(piece.piece.ancho, unit)}×${fmtNum(piece.piece.alto, unit)}`, px + pw / 2, py + ph / 2, { align: 'center', baseline: 'middle' });
      }
    });

    doc.setDrawColor(34, 197, 94); doc.setLineWidth(0.3); doc.setLineDash([1.5, 1.5]);
    board.offcuts.forEach((o) => { doc.rect(startX + o.x * scale, startY + o.y * scale, o.w * scale, o.h * scale); });
    doc.setLineDash([]);

    doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text(fmtDim(board.ancho, unit), startX + boardW / 2, startY + boardH + 3, { align: 'center' });
    doc.text(fmtDim(board.alto, unit), startX - 5, startY + boardH / 2, { align: 'right', baseline: 'middle' });
  });

  // Cut list
  doc.addPage();
  doc.setFontSize(14); doc.setFont('Helvetica', 'bold'); doc.setTextColor(15, 23, 42);
  doc.text('Lista de Corte', 20, 20);
  let cutListY = 30;
  const colX = [10, 22, 52, 72, 92, 112, 132, 152, 172];

  result.boards.forEach((board, boardIdx) => {
    if (cutListY > pageH - 30) { doc.addPage(); cutListY = 20; }
    doc.setFontSize(10); doc.setFont('Helvetica', 'bold'); doc.setTextColor(15, 23, 42);
    doc.text(`Tablero ${boardIdx + 1} - ${board.material} ${fmtDim(board.grosor, unit)} (${fmtDim(board.ancho, unit)}×${fmtDim(board.alto, unit)})`, 20, cutListY);
    cutListY += 8;
    doc.setFontSize(8); doc.setTextColor(71, 85, 105);
    ['#','Nombre','Ancho','Alto','Pos X','Pos Y','Rot','Veta','Canto'].forEach((h, i) => {
      doc.text(h, colX[i], cutListY, { align: i === 1 ? 'left' : 'center' });
    });
    cutListY += 5;
    board.placed.forEach((piece) => {
      if (cutListY > pageH - 10) { doc.addPage(); cutListY = 20; }
      doc.setTextColor(30, 41, 59); doc.setFont('Helvetica', 'normal');
      const edgeBands = [piece.piece.cubrecanto.sup?'S':'', piece.piece.cubrecanto.inf?'I':'', piece.piece.cubrecanto.izq?'L':'', piece.piece.cubrecanto.der?'R':''].filter(v => v).join('/');
      [
        [`${board.placed.indexOf(piece) + 1}`, 'center'],
        [piece.piece.nombre || 'Pieza', 'left'],
        [fmtNum(piece.piece.ancho, unit), 'center'],
        [fmtNum(piece.piece.alto, unit), 'center'],
        [fmtNum(piece.x, unit), 'center'],
        [fmtNum(piece.y, unit), 'center'],
        [piece.rotated ? 'Sí' : '—', 'center'],
        [piece.piece.vetaHorizontal ? 'Fija' : 'Libre', 'center'],
        [edgeBands || '—', 'center'],
      ].forEach(([text, align], i) => {
        doc.text(text as string, colX[i], cutListY, { align: align as 'left' | 'center' });
      });
      cutListY += 5;
    });
    cutListY += 5;
  });

  doc.save(`optimizacion_${(projectName || 'proyecto').replace(/\s+/g, '_')}.pdf`);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
