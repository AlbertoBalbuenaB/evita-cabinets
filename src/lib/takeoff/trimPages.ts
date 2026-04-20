import { PDFDocument } from 'pdf-lib';

// Build a new PDF containing only the pages listed in keepIndices (1-based,
// will be deduped and sorted before use). Returns a File with the same filename
// as the source so downstream save flows pick up a sensible display name.
export async function buildTrimmedPdf(file: File, keepIndices1Based: number[]): Promise<File> {
  if (keepIndices1Based.length === 0) {
    throw new Error('At least one page must be kept.');
  }
  const sortedKeep = [...new Set(keepIndices1Based)].sort((a, b) => a - b);
  const sourceBytes = await file.arrayBuffer();
  const src = await PDFDocument.load(sourceBytes);
  const dst = await PDFDocument.create();

  // pdf-lib uses 0-based indices when copying.
  const indices0 = sortedKeep.map((n) => n - 1);
  const copied = await dst.copyPages(src, indices0);
  copied.forEach((p) => dst.addPage(p));

  const outBytes = await dst.save();
  // Use a fresh ArrayBuffer to keep the File constructor happy across browsers.
  return new File([outBytes], file.name, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });
}

// Map from original 1-based page numbers to the new 1-based numbers after trimming.
// Used to remap measurements / calibrations / comments after the PDF is rebuilt.
export function buildPageRemap(keepIndices1Based: number[]): Map<number, number> {
  const sorted = [...new Set(keepIndices1Based)].sort((a, b) => a - b);
  const map = new Map<number, number>();
  sorted.forEach((oldPage, idx) => map.set(oldPage, idx + 1));
  return map;
}
