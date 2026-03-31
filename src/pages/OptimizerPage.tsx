import { useRef, useState } from 'react';
import { Scissors, Upload, Table, FolderOpen, Save, Zap, FileDown, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useOptimizerStore } from '../hooks/useOptimizerStore';
import { toMM } from '../lib/optimizer/units';
import { Button } from '../components/Button';
import { OptimizerSidebar } from '../components/optimizer/OptimizerSidebar';
import { PieceList } from '../components/optimizer/PieceList';
import { StatsBar } from '../components/optimizer/StatsBar';
import { BoardGrid } from '../components/optimizer/BoardGrid';
import { CutListView } from '../components/optimizer/CutListView';
import { SummaryView } from '../components/optimizer/SummaryView';
import { BoardDetailModal } from '../components/optimizer/BoardDetailModal';

export function OptimizerPage() {
  const store = useOptimizerStore();
  const csvRef  = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const jsonRef  = useRef<HTMLInputElement>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const unit = store.unit;
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 3) continue;
      const anchoRaw  = parseFloat(cols[headers.indexOf('ancho')]  ?? cols[1]);
      const altoRaw   = parseFloat(cols[headers.indexOf('alto')]   ?? cols[2]);
      const grosorRaw = parseFloat(cols[headers.indexOf('grosor')] || '18') || 18;
      if (!anchoRaw || !altoRaw) continue;
      store.addPiece({
        nombre: cols[headers.indexOf('nombre')] || '',
        material: cols[headers.indexOf('material')] || 'Melamina',
        grosor: toMM(grosorRaw, unit),
        ancho:  toMM(anchoRaw, unit),
        alto:   toMM(altoRaw, unit),
        cantidad: parseInt(cols[headers.indexOf('cantidad')] || '1') || 1,
        vetaHorizontal: /^(si|sí|yes|true|1)$/i.test(cols[headers.indexOf('veta')] || ''),
        cubrecanto: { sup: false, inf: false, izq: false, der: false },
      });
      count++;
    }
    alert(`${count} piezas importadas desde CSV (unidades: ${unit})`);
    if (csvRef.current) csvRef.current.value = '';
  };

  // ── Excel import (Planilla Evita Cabinets / Planilla Masisa Optimiza) ─────────
  const handleXLSX = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const unit = store.unit;
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, { type: 'array' });

    // Prefer 'PLANILLA EVITA' sheet, then first sheet
    const sheetName = wb.SheetNames.find(n =>
      /planilla|corte|piezas/i.test(n)
    ) ?? wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

    // Find the header row: look for a row containing CANTIDAD or CANTIDAD-like text
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const r = rows[i].map(c => String(c).trim().toUpperCase());
      if (r.some(c => c.includes('CANTIDAD'))) { headerIdx = i; break; }
    }
    if (headerIdx < 0) { alert('No se encontró encabezado CANTIDAD en el archivo. Verifica que sea una Planilla Evita o Masisa.'); return; }

    const headers = rows[headerIdx].map(c => String(c).trim().toUpperCase());

    // Column index helpers — support both Evita (ANCHO/ALTO) and Masisa (BASE/ALTURA)
    const col = (keywords: string[]) => {
      for (const kw of keywords) {
        const idx = headers.findIndex(h => h.includes(kw));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const iCant   = col(['CANTIDAD']);
    const iMat    = col(['MATERIAL']);
    const iGros   = col(['GROSOR']);
    const iAncho  = col(['ANCHO', 'BASE']);        // Evita = ANCHO, Masisa = BASE
    const iAlto   = col(['ALTO', 'ALTURA']);       // Evita = ALTO,  Masisa = ALTURA
    const iVeta   = col(['VETA']);
    const iNombre = col(['NOMBRE']);
    // Tapacanto — Evita uses BASE INF/SUP/ALT IZQ/DER; Masisa uses BASE A/B, ALTURA A/B
    const iTapeBI = col(['BASE INF', 'BASE A']);
    const iTapeBS = col(['BASE SUP', 'BASE B']);
    const iTapeAI = col(['ALT IZQ', 'ALTURA A']);
    const iTapeAD = col(['ALT DER', 'ALTURA B']);

    if (iAncho < 0 || iAlto < 0) {
      alert('No se encontraron columnas ANCHO/BASE y ALTO/ALTURA. Verifica el formato.');
      return;
    }

    const isTruthy = (v: string) => /^(1|si|sí|yes|true|x)$/i.test(v.trim());

    let count = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(c => String(c).trim() === '')) continue;

      const anchoRaw  = parseFloat(String(row[iAncho]  ?? 0));
      const altoRaw   = parseFloat(String(row[iAlto]   ?? 0));
      if (!anchoRaw || !altoRaw) continue;

      const grosorRaw = iGros  >= 0 ? parseFloat(String(row[iGros] || '18')) || 18 : 18;
      const cant      = iCant  >= 0 ? parseInt(String(row[iCant]  || '1')) || 1 : 1;
      const mat       = iMat   >= 0 ? String(row[iMat]   || 'Melamina').trim() || 'Melamina' : 'Melamina';
      const nombre    = iNombre >= 0 ? String(row[iNombre] || '').trim() : '';
      const veta      = iVeta  >= 0 ? /^fija$/i.test(String(row[iVeta] || '').trim()) : false;
      const cbSup     = iTapeBS >= 0 ? isTruthy(String(row[iTapeBS] ?? '')) : false;
      const cbInf     = iTapeBI >= 0 ? isTruthy(String(row[iTapeBI] ?? '')) : false;
      const cbIzq     = iTapeAI >= 0 ? isTruthy(String(row[iTapeAI] ?? '')) : false;
      const cbDer     = iTapeAD >= 0 ? isTruthy(String(row[iTapeAD] ?? '')) : false;

      store.addPiece({
        nombre,
        material:        mat,
        grosor:          grosorRaw,          // grosor always in mm
        ancho:           toMM(anchoRaw, unit),
        alto:            toMM(altoRaw,  unit),
        cantidad:        cant,
        vetaHorizontal:  veta,
        cubrecanto:      { sup: cbSup, inf: cbInf, izq: cbIzq, der: cbDer },
      });
      count++;
    }

    alert(`${count} piezas importadas desde Excel (hoja: ${sheetName}, unidades: ${unit})`);
    if (xlsxRef.current) xlsxRef.current.value = '';
  };

  const handleJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    store.loadProject(await file.text());
    if (jsonRef.current) jsonRef.current.value = '';
  };

  const tabs = [
    { key: 'boards' as const, label: '🎨 Tableros' },
    { key: 'cutlist' as const, label: '📋 Lista de Corte' },
    { key: 'summary' as const, label: '📊 Resumen' },
  ];

  const selectedBoard = store.selectedBoardIndex !== null && store.result
    ? store.result.boards[store.selectedBoardIndex] : null;

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col overflow-hidden bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0 flex-wrap">
        <Scissors className="h-5 w-5 text-blue-600 shrink-0" />
        <span className="font-semibold text-slate-800">CutBoard Pro</span>
        <span className="text-xs text-slate-400">v1.0</span>
        <span className="text-slate-200">|</span>
        <input value={store.projectName} onChange={e => store.setProjectName(e.target.value)} placeholder="Proyecto" className="px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 w-32" />
        <input value={store.clientName} onChange={e => store.setClientName(e.target.value)} placeholder="Cliente" className="px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 w-32" />
        <div className="flex-1" />
        <input ref={csvRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
        <Button variant="secondary" size="sm" onClick={() => csvRef.current?.click()} className="flex items-center gap-1"><Upload className="h-3.5 w-3.5" />CSV</Button>
        <input ref={xlsxRef} type="file" accept=".xlsx,.xls" onChange={handleXLSX} className="hidden" />
        <Button variant="secondary" size="sm" onClick={() => xlsxRef.current?.click()} className="flex items-center gap-1"><Table className="h-3.5 w-3.5" />Excel</Button>
        <input ref={jsonRef} type="file" accept=".json" onChange={handleJSON} className="hidden" />
        <Button variant="secondary" size="sm" onClick={() => jsonRef.current?.click()} className="flex items-center gap-1"><FolderOpen className="h-3.5 w-3.5" />Abrir</Button>
        <Button variant="secondary" size="sm" onClick={() => store.saveProject()} className="flex items-center gap-1"><Save className="h-3.5 w-3.5" />Guardar</Button>
        <span className="text-slate-200">|</span>
        {/* Unit toggle — mm/in */}
        <div className="flex items-center rounded border border-slate-200 overflow-hidden text-xs font-medium">
          <button onClick={() => store.setUnit('mm')} className={`px-2 py-1 transition-colors ${store.unit === 'mm' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>mm</button>
          <button onClick={() => store.setUnit('in')} className={`px-2 py-1 transition-colors ${store.unit === 'in' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>in</button>
        </div>
        <span className="text-slate-200">|</span>
        <Button variant="primary" size="sm" onClick={() => store.runOptimize()} disabled={store.isOptimizing} className="flex items-center gap-1">
          {store.isOptimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Optimizar
        </Button>
        <Button variant="secondary" size="sm" onClick={() => store.exportPDF()} disabled={!store.result} className="flex items-center gap-1"><FileDown className="h-3.5 w-3.5" />PDF</Button>
      </div>

      {/* Optimization spinner overlay */}
      {store.isOptimizing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-3 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="font-semibold text-slate-900">Optimizando...</p>
            <p className="text-xs text-slate-400">GRASP Multi-Estrategia en progreso</p>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: sidebar + piece list */}
        <div className="w-72 shrink-0 flex flex-col border-r border-slate-200 overflow-hidden">
          <OptimizerSidebar />
          <PieceList pieces={store.pieces} onRemove={store.removePiece} />
        </div>

        {/* Right: stats + tabs + content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <StatsBar result={store.result} />

          <div className="bg-white border-b border-slate-200 px-6 flex gap-6 shrink-0">
            {tabs.map(t => (
              <button key={t.key} onClick={() => store.setActiveTab(t.key)}
                className={`px-1 py-3 text-sm font-medium transition-all ${store.activeTab === t.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {store.activeTab === 'boards' && (
              <BoardGrid result={store.result} onSelectBoard={idx => { store.setSelectedBoard(idx); setDetailOpen(true); }} />
            )}
            {store.activeTab === 'cutlist' && <CutListView result={store.result} />}
            {store.activeTab === 'summary' && <SummaryView result={store.result} />}
          </div>
        </div>
      </div>

      <BoardDetailModal board={selectedBoard} boardIndex={store.selectedBoardIndex ?? 0} isOpen={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
  );
}
