import { useRef, useState } from 'react';
import { LayoutDashboard, Upload, Table, FolderOpen, Save, Zap, FileDown, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useOptimizerStore } from '../hooks/useOptimizerStore';
import { toMM } from '../lib/optimizer/units';
import { Button } from '../components/Button';
import { OptimizerSidebar } from '../components/optimizer/OptimizerSidebar';
import { CADViewer } from '../components/optimizer/CADViewer';
import { RightStatsPanel } from '../components/optimizer/RightStatsPanel';
import { ResizablePanel } from '../components/optimizer/ResizablePanel';

export function OptimizerPage() {
  const store   = useOptimizerStore();
  const csvRef  = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const [leftCollapsed, setLeftCollapsed]   = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // ── CSV import ────────────────────────────────────────────
  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
    const unit = store.unit;
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length < 3) continue;
      const anchoRaw  = parseFloat(cols[headers.indexOf('ancho')]  ?? cols[1]);
      const altoRaw   = parseFloat(cols[headers.indexOf('alto')]   ?? cols[2]);
      const grosorRaw = parseFloat(cols[headers.indexOf('grosor')] || '18') || 18;
      if (!anchoRaw || !altoRaw) continue;
      store.addPiece({
        nombre:    cols[headers.indexOf('nombre')]   || '',
        material:  cols[headers.indexOf('material')] || 'Melamina',
        grosor:    toMM(grosorRaw, unit),
        ancho:     toMM(anchoRaw,  unit),
        alto:      toMM(altoRaw,   unit),
        cantidad:  parseInt(cols[headers.indexOf('cantidad')] || '1') || 1,
        vetaHorizontal: /^(si|sí|yes|true|1)$/i.test(cols[headers.indexOf('veta')] || ''),
        cubrecanto: { sup: 0, inf: 0, izq: 0, der: 0 },
      });
      count++;
    }
    alert(`${count} piezas importadas desde CSV (unidades: ${unit})`);
    if (csvRef.current) csvRef.current.value = '';
  };

  // ── Excel import ──────────────────────────────────────────
  const handleXLSX = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const unit = store.unit;
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames.find((n) => /planilla|corte|piezas/i.test(n)) ?? wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      if (rows[i].map((c) => String(c).trim().toUpperCase()).some((c) => c.includes('CANTIDAD'))) {
        headerIdx = i; break;
      }
    }
    if (headerIdx < 0) {
      alert('No se encontró encabezado CANTIDAD. Verifica que sea una Planilla Evita o Masisa.');
      return;
    }

    const headers = rows[headerIdx].map((c) => String(c).trim().toUpperCase());
    const col = (keywords: string[]) => {
      for (const kw of keywords) {
        const idx = headers.findIndex((h) => h.includes(kw));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const iCant   = col(['CANTIDAD']);
    const iMat    = col(['MATERIAL']);
    const iGros   = col(['GROSOR']);
    const iAncho  = col(['ANCHO', 'BASE']);
    const iAlto   = col(['ALTO', 'ALTURA']);
    const iVeta   = col(['VETA']);
    const iNombre = col(['NOMBRE']);
    const iTapeBI = col(['BASE INF', 'BASE A']);
    const iTapeBS = col(['BASE SUP', 'BASE B']);
    const iTapeAI = col(['ALT IZQ', 'ALTURA A']);
    const iTapeAD = col(['ALT DER', 'ALTURA B']);

    if (iAncho < 0 || iAlto < 0) {
      alert('No se encontraron columnas ANCHO/BASE y ALTO/ALTURA.');
      return;
    }

    const isTruthy = (v: string) => /^(1|si|sí|yes|true|x)$/i.test(v.trim());
    let count = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => String(c).trim() === '')) continue;
      const anchoRaw = parseFloat(String(row[iAncho] ?? 0));
      const altoRaw  = parseFloat(String(row[iAlto]  ?? 0));
      if (!anchoRaw || !altoRaw) continue;
      store.addPiece({
        nombre:         iNombre >= 0 ? String(row[iNombre] || '').trim() : '',
        material:       iMat    >= 0 ? String(row[iMat]    || 'Melamina').trim() || 'Melamina' : 'Melamina',
        grosor:         iGros   >= 0 ? parseFloat(String(row[iGros] || '18')) || 18 : 18,
        ancho:          toMM(anchoRaw, unit),
        alto:           toMM(altoRaw,  unit),
        cantidad:       iCant   >= 0 ? parseInt(String(row[iCant]  || '1')) || 1 : 1,
        vetaHorizontal: iVeta   >= 0 ? /^fija$/i.test(String(row[iVeta] || '').trim()) : false,
        cubrecanto: {
          sup: iTapeBS >= 0 ? isTruthy(String(row[iTapeBS] ?? '')) : false,
          inf: iTapeBI >= 0 ? isTruthy(String(row[iTapeBI] ?? '')) : false,
          izq: iTapeAI >= 0 ? isTruthy(String(row[iTapeAI] ?? '')) : false,
          der: iTapeAD >= 0 ? isTruthy(String(row[iTapeAD] ?? '')) : false,
        },
      });
      count++;
    }
    alert(`${count} piezas importadas desde Excel (hoja: ${sheetName}, unidades: ${unit})`);
    if (xlsxRef.current) xlsxRef.current.value = '';
  };

  // ── JSON project ──────────────────────────────────────────
  const handleJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    store.loadProject(await file.text());
    if (jsonRef.current) jsonRef.current.value = '';
  };

  const selectedBoard =
    store.selectedBoardIndex !== null && store.result
      ? store.result.boards[store.selectedBoardIndex]
      : null;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-slate-50">

      {/* ── Page header ───────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-2 flex-shrink-0 flex-wrap">
        <LayoutDashboard className="h-5 w-5 text-blue-600 shrink-0" />
        <span className="font-semibold text-slate-800 text-sm">Evita Optimizer</span>
        <span className="text-xs text-slate-400">v1.3</span>
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <input value={store.projectName} onChange={(e) => store.setProjectName(e.target.value)}
          placeholder="Proyecto" className="px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 w-28" />
        <input value={store.clientName} onChange={(e) => store.setClientName(e.target.value)}
          placeholder="Cliente" className="px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 w-28" />
        <div className="flex-1" />

        <input ref={csvRef}  type="file" accept=".csv"       onChange={handleCSV}  className="hidden" />
        <input ref={xlsxRef} type="file" accept=".xlsx,.xls" onChange={handleXLSX} className="hidden" />
        <input ref={jsonRef} type="file" accept=".json"      onChange={handleJSON} className="hidden" />

        <Button variant="secondary" size="sm" onClick={() => csvRef.current?.click()}  className="flex items-center gap-1">
          <Upload className="h-3.5 w-3.5" />CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={() => xlsxRef.current?.click()} className="flex items-center gap-1">
          <Table className="h-3.5 w-3.5" />Excel
        </Button>
        <Button variant="secondary" size="sm" onClick={() => jsonRef.current?.click()} className="flex items-center gap-1">
          <FolderOpen className="h-3.5 w-3.5" />Abrir
        </Button>
        <Button variant="secondary" size="sm" onClick={() => store.saveProject()} className="flex items-center gap-1">
          <Save className="h-3.5 w-3.5" />Guardar
        </Button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        <div className="flex items-center rounded border border-slate-200 overflow-hidden text-xs font-medium">
          <button onClick={() => store.setUnit('mm')}
            className={`px-2.5 py-1 transition-colors ${store.unit === 'mm' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>mm</button>
          <button onClick={() => store.setUnit('in')}
            className={`px-2.5 py-1 transition-colors ${store.unit === 'in' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>in</button>
        </div>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        <Button variant="primary" size="sm" onClick={() => store.runOptimize()} disabled={store.isOptimizing}
          className="flex items-center gap-1">
          {store.isOptimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Optimizar
        </Button>
        <Button variant="secondary" size="sm" onClick={() => store.exportPDF()} disabled={!store.result}
          className="flex items-center gap-1">
          <FileDown className="h-3.5 w-3.5" />PDF
        </Button>
      </div>

      {/* ── Spinner overlay ───────────────────────────────── */}
      {store.isOptimizing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-3 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="font-semibold text-slate-900">Optimizando...</p>
            <p className="text-xs text-slate-400">GRASP Multi-Estrategia en progreso</p>
          </div>
        </div>
      )}

      {/* ── Three-panel body ──────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left: resizable + collapsible */}
        <ResizablePanel
          side="left" defaultWidth={300} minWidth={220} maxWidth={480}
          collapsed={leftCollapsed} onToggle={() => setLeftCollapsed(v => !v)}
        >
          <OptimizerSidebar />
        </ResizablePanel>

        {/* Center: CAD viewer */}
        <CADViewer board={selectedBoard} unit={store.unit} />

        {/* Right: resizable + collapsible */}
        <ResizablePanel
          side="right" defaultWidth={288} minWidth={220} maxWidth={420}
          collapsed={rightCollapsed} onToggle={() => setRightCollapsed(v => !v)}
        >
          <RightStatsPanel
            result={store.result}
            selectedIdx={store.selectedBoardIndex ?? 0}
            onSelectBoard={(idx) => store.setSelectedBoard(idx)}
          />
        </ResizablePanel>

      </div>
    </div>
  );
}
