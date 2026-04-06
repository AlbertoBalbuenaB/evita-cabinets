import { useRef, useState, useEffect } from 'react';
import { LayoutDashboard, Upload, Download, ChevronDown, Zap, Loader2, Table, FolderOpen, Save, FileDown, Settings, Package } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useOptimizerStore } from '../hooks/useOptimizerStore';
import { toMM } from '../lib/optimizer/units';
import { Button } from '../components/Button';
import { OptimizerSidebar } from '../components/optimizer/OptimizerSidebar';
import { CADViewer } from '../components/optimizer/CADViewer';
import { RightStatsPanel } from '../components/optimizer/RightStatsPanel';
import { ImportCabinetsModal } from '../components/optimizer/ImportCabinetsModal';

export function OptimizerPage() {
  const store   = useOptimizerStore();
  const csvRef  = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [cabinetModalOpen, setCabinetModalOpen] = useState(false);

  // close dropdowns on click outside
  useEffect(() => {
    if (!importOpen && !exportOpen) return;
    const close = () => { setImportOpen(false); setExportOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [importOpen, exportOpen]);

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
    alert(`${count} pieces imported from CSV (units: ${unit})`);
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
      alert('CANTIDAD header not found. Verify the file is a valid Evita or Masisa sheet.');
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
      alert('WIDTH/BASE and HEIGHT columns not found.');
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
    alert(`${count} pieces imported from Excel (sheet: ${sheetName}, units: ${unit})`);
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
          placeholder="Project" className="px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 w-28" />
        <input value={store.clientName} onChange={(e) => store.setClientName(e.target.value)}
          placeholder="Client" className="px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 w-28" />
        <div className="flex-1" />

        <input ref={csvRef}  type="file" accept=".csv"       onChange={handleCSV}  className="hidden" />
        <input ref={xlsxRef} type="file" accept=".xlsx,.xls" onChange={handleXLSX} className="hidden" />
        <input ref={jsonRef} type="file" accept=".json"      onChange={handleJSON} className="hidden" />

        {/* Import dropdown */}
        <div className="relative">
          <Button variant="secondary" size="sm"
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); setImportOpen(v => !v); setExportOpen(false); }}
            className="flex items-center gap-1">
            <Upload className="h-3.5 w-3.5" />Import
            <ChevronDown className={`h-3 w-3 transition-transform ${importOpen ? 'rotate-180' : ''}`} />
          </Button>
          {importOpen && (
            <div className="absolute top-full mt-1 left-0 z-50 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
              <button onClick={() => { csvRef.current?.click(); setImportOpen(false); }}
                className="w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left">
                <Upload className="h-3.5 w-3.5 text-slate-400" />CSV
              </button>
              <button onClick={() => { xlsxRef.current?.click(); setImportOpen(false); }}
                className="w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left">
                <Table className="h-3.5 w-3.5 text-slate-400" />Excel
              </button>
              <button onClick={() => { jsonRef.current?.click(); setImportOpen(false); }}
                className="w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left">
                <FolderOpen className="h-3.5 w-3.5 text-slate-400" />Open Project
              </button>
              <button onClick={() => { setCabinetModalOpen(true); setImportOpen(false); }}
                className="w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left">
                <Package className="h-3.5 w-3.5 text-slate-400" />Cabinets
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button onClick={() => {
                const csv = 'nombre,ancho,alto,grosor,material,cantidad,veta\nSide Panel,610,762,18,Melamina,2,no\nBack Panel,726,762,18,Melamina,1,no\nShelf,726,574,18,Melamina,1,no\nDoor,378,759,18,MDF,2,si\n';
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'evita_optimizer_template.csv';
                a.click();
                URL.revokeObjectURL(a.href);
                setImportOpen(false);
              }}
                className="w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left">
                <FileDown className="h-3.5 w-3.5 text-slate-400" />CSV Template
              </button>
            </div>
          )}
        </div>

        {/* Export dropdown */}
        <div className="relative">
          <Button variant="secondary" size="sm"
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); setExportOpen(v => !v); setImportOpen(false); }}
            className="flex items-center gap-1">
            <Download className="h-3.5 w-3.5" />Export
            <ChevronDown className={`h-3 w-3 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
          </Button>
          {exportOpen && (
            <div className="absolute top-full mt-1 left-0 z-50 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
              <button onClick={() => { store.saveProject(); setExportOpen(false); }}
                className="w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left">
                <Save className="h-3.5 w-3.5 text-slate-400" />Save Project
              </button>
              <button onClick={() => { store.exportPDF('en'); setExportOpen(false); }} disabled={!store.result}
                className="w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left disabled:opacity-40">
                <FileDown className="h-3.5 w-3.5 text-slate-400" />PDF (English)
              </button>
              <button onClick={() => { store.exportPDF('es'); setExportOpen(false); }} disabled={!store.result}
                className="w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left disabled:opacity-40">
                <FileDown className="h-3.5 w-3.5 text-slate-400" />PDF (Español)
              </button>
            </div>
          )}
        </div>

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
          Optimize
        </Button>
      </div>

      {/* ── Spinner overlay ───────────────────────────────── */}
      {store.isOptimizing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center spinner-overlay-enter">
          <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-3 shadow-xl spinner-card-enter">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="font-semibold text-slate-900">Optimizing...</p>
            <p className="text-xs text-slate-400">GRASP Multi-Strategy in progress</p>
          </div>
        </div>
      )}

      {/* ── Tab bar ─────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 flex items-center shrink-0">
        {([
          { id: 'setup' as const, label: 'Setup', Icon: Settings },
          { id: 'results' as const, label: 'Results', Icon: LayoutDashboard },
        ]).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => store.setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              store.activeTab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────── */}
      <div className="flex-1 overflow-hidden min-h-0">
        {store.activeTab === 'setup' ? (
          <div className="h-full overflow-hidden bg-slate-50">
            <OptimizerSidebar />
          </div>
        ) : (
          <div className="h-full flex flex-col lg:flex-row overflow-hidden">
            <CADViewer board={selectedBoard} unit={store.unit} />
            <div className="lg:w-80 lg:shrink-0 lg:border-l border-t lg:border-t-0 border-slate-200 overflow-y-auto bg-white">
              <RightStatsPanel
                result={store.result}
                selectedIdx={store.selectedBoardIndex ?? 0}
                onSelectBoard={(idx) => store.setSelectedBoard(idx)}
              />
            </div>
          </div>
        )}
      </div>

      <ImportCabinetsModal isOpen={cabinetModalOpen} onClose={() => setCabinetModalOpen(false)} />
    </div>
  );
}
