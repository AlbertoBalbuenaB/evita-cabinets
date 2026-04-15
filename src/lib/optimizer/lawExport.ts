// ─────────────────────────────────────────────────────────────
// .law (ZDCUT) Export for HongYe CNC Panel Saw
// ─────────────────────────────────────────────────────────────

import { OptimizationResult, BoardResult, CutTreeNode } from './types';

/** Format a number for .law output: integers stay whole, fractionals get one decimal max, no trailing zeros. */
function fmtLaw(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(1);
  return s.endsWith('0') ? String(Math.round(n)) : s;
}

/** Trigger a browser file download. */
function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Format a Date as "YYYY/M/D H:MM" (no zero-padding on month/day/hour). */
function fmtCutTime(d: Date): string {
  const Y = d.getFullYear();
  const M = d.getMonth() + 1;
  const D = d.getDate();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${Y}/${M}/${D} ${h}:${m}`;
}

// ── CutTreeNode → nested <Part> XML ──

interface StepCounter { value: number }

function buildPartXml(
  node: CutTreeNode,
  counter: StepCounter,
  trim: number,
  indent: string,
  productIdMap: Map<string, number>,
): string {
  const NL = '\r\n';

  // Leaf: placed piece
  if (node.piece) {
    const p = node.piece;
    const pKey = `${p.piece.id}_${p.piece.ancho}_${p.piece.alto}`;
    const prodId = productIdMap.get(pKey) ?? 0;
    const dri = node.piece.h === node.h ? 'True' : 'False';
    return `${indent}<Part Step="0" Length="${fmtLaw(p.h)}" Width="${fmtLaw(p.w)}" x="${fmtLaw(p.x)}" y="${fmtLaw(p.y)}" Dri="${dri}" ID="${prodId}" />${NL}`;
  }

  // Leaf: waste (no piece, no cut, no children)
  if (!node.cut && !node.left && !node.right) {
    return `${indent}<Part Step="-1" Length="${fmtLaw(node.h)}" Width="${fmtLaw(node.w)}" x="${fmtLaw(node.x)}" y="${fmtLaw(node.y)}" Dri="True" ID="${counter.value}" Shape="True" />${NL}`;
  }

  // Internal node with cut
  if (node.cut) {
    const step = counter.value++;
    const dri = node.cut.type === 'H' ? 'True' : 'False';
    let xml = `${indent}<Part Step="${step}" Length="${fmtLaw(node.h)}" Width="${fmtLaw(node.w)}" x="${fmtLaw(node.x)}" y="${fmtLaw(node.y)}" Dri="${dri}" ID="${step}" Trim="${fmtLaw(trim)}">${NL}`;
    if (node.left) xml += buildPartXml(node.left, counter, trim, indent + '\t', productIdMap);
    if (node.right) xml += buildPartXml(node.right, counter, trim, indent + '\t', productIdMap);
    xml += `${indent}</Part>${NL}`;
    return xml;
  }

  // Node with children but no cut (wrapper) — recurse into whatever exists
  let xml = '';
  if (node.left) xml += buildPartXml(node.left, counter, trim, indent, productIdMap);
  if (node.right) xml += buildPartXml(node.right, counter, trim, indent, productIdMap);
  return xml;
}

/** Build <Part> XML for boards that lack a cutTree (MaxRect fallback).
 *  Emits a flat list of piece leaves sorted by y then x. */
function buildFlatPartsXml(
  board: BoardResult,
  productIdMap: Map<string, number>,
  indent: string,
): string {
  const NL = '\r\n';
  const sorted = [...board.placed].sort((a, b) => a.y - b.y || a.x - b.x);
  let xml = '';
  for (const p of sorted) {
    const pKey = `${p.piece.id}_${p.piece.ancho}_${p.piece.alto}`;
    const prodId = productIdMap.get(pKey) ?? 0;
    xml += `${indent}<Part Step="0" Length="${fmtLaw(p.h)}" Width="${fmtLaw(p.w)}" x="${fmtLaw(p.x)}" y="${fmtLaw(p.y)}" Dri="False" ID="${prodId}" />${NL}`;
  }
  return xml;
}

export function exportLaw(
  result: OptimizationResult,
  options?: {
    projectName?: string;
    fileName?: string;
    sheetCount?: number;
    ply?: number;
  },
): void {
  const projectName = options?.projectName ?? 'Optimizer';
  const ply = options?.ply ?? 18;
  const cutTime = fmtCutTime(new Date());
  const NL = '\r\n';
  const T = '\t';

  // Group boards by material
  const matGroups = new Map<string, BoardResult[]>();
  for (const b of result.boards) {
    const key = b.material;
    if (!matGroups.has(key)) matGroups.set(key, []);
    matGroups.get(key)!.push(b);
  }

  for (const [matName, boards] of matGroups) {
    // ── Build Products list (dedup by piece id + original dims) ──
    const productIdMap = new Map<string, number>();
    const products: Array<{ id: number; name: string; length: number; width: number; turn: string; count: number }> = [];
    const productCounts = new Map<string, number>();

    for (const board of boards) {
      for (const pp of board.placed) {
        const p = pp.piece;
        const key = `${p.id}_${p.ancho}_${p.alto}`;
        productCounts.set(key, (productCounts.get(key) ?? 0) + 1);
        if (!productIdMap.has(key)) {
          const pid = productIdMap.size + 1;
          productIdMap.set(key, pid);
          products.push({
            id: pid,
            name: p.nombre || `P${pid}`,
            length: p.alto,
            width: p.ancho,
            turn: p.veta === 'none' ? 'True' : 'False',
            count: 0, // filled after counting
          });
        }
      }
    }
    // Update counts
    for (const prod of products) {
      const matchKey = [...productIdMap.entries()].find(([, v]) => v === prod.id)?.[0];
      if (matchKey) prod.count = productCounts.get(matchKey) ?? 0;
    }

    // ── Determine material dimensions from first board ──
    const matBoard = boards[0];
    const matLength = matBoard.alto;
    const matWidth = matBoard.ancho;
    const panelCount = boards.length;

    // ── Build XML ──
    let xml = `\uFEFF<?xml version="1.0" encoding="utf-8"?>${NL}`;
    xml += `<ZDCUT Name="${esc(projectName)}" CutTime="${cutTime}" Selected="0" ApplictionVer="2.0.0.2" Update="2020.09.30" FilePath="D:\\HongYeSaw24.01.09\\dat\\Manuall\\Eidt\\Bin.law">${NL}`;
    xml += `${T}<Data>${NL}`;

    // Materials
    xml += `${T}${T}<Materials>${NL}`;
    xml += `${T}${T}${T}<Material ID="M001" Name="${esc(matName)}" Length="${fmtLaw(matLength)}" Width="${fmtLaw(matWidth)}" Ply="${fmtLaw(ply)}" Count="${panelCount}" />${NL}`;
    xml += `${T}${T}</Materials>${NL}`;

    // Products
    xml += `${T}${T}<Products>${NL}`;
    for (const prod of products) {
      xml += `${T}${T}${T}<Product ID="${prod.id}" Name="${esc(prod.name)}" Length="${fmtLaw(prod.length)}" Width="${fmtLaw(prod.width)}" Turn="${prod.turn}" Count="${prod.count}" />${NL}`;
    }
    xml += `${T}${T}</Products>${NL}`;

    // Panels
    xml += `${T}${T}<Panels Count="${panelCount}">${NL}`;
    for (let i = 0; i < boards.length; i++) {
      const board = boards[i];
      const saw = board.sierra;
      const trim = board.trim;
      xml += `${T}${T}${T}<Panel ID="${i}" Count="${panelCount}" Cut="False" Length="${fmtLaw(board.alto)}" Width="${fmtLaw(board.ancho)}" Saw="${fmtLaw(saw)}" Trim="${fmtLaw(trim)}">${NL}`;

      const counter: StepCounter = { value: 1 };
      if (board.cutTree) {
        xml += buildPartXml(board.cutTree, counter, trim, T + T + T + T, productIdMap);
      } else {
        xml += buildFlatPartsXml(board, productIdMap, T + T + T + T);
      }

      xml += `${T}${T}${T}</Panel>${NL}`;
    }
    xml += `${T}${T}</Panels>${NL}`;

    xml += `${T}</Data>${NL}`;
    xml += `</ZDCUT>${NL}`;

    // Download
    const fileName = options?.fileName
      ?? `${projectName}_${matName.replace(/[^a-zA-Z0-9]/g, '_')}.law`;
    downloadFile(xml, fileName);
  }
}

/** Escape special XML characters in attribute values. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
