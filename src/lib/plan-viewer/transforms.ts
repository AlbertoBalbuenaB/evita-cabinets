import type { PdfPoint, ViewportState } from './types';

export function screenToPdf(
  screenX: number,
  screenY: number,
  viewport: ViewportState,
  renderScale: number
): PdfPoint {
  return {
    x: (screenX - viewport.offsetX) / (viewport.zoom * renderScale),
    y: (screenY - viewport.offsetY) / (viewport.zoom * renderScale),
  };
}

export function pdfToScreen(
  pt: PdfPoint,
  viewport: ViewportState,
  renderScale: number
): { x: number; y: number } {
  return {
    x: pt.x * viewport.zoom * renderScale + viewport.offsetX,
    y: pt.y * viewport.zoom * renderScale + viewport.offsetY,
  };
}
