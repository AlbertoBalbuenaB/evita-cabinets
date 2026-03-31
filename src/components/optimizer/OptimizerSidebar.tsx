import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Layers, Settings, LayoutList, X, Pencil, Plus, FolderOpen } from 'lucide-react';
import { useOptimizerStore } from '../../hooks/useOptimizerStore';
import { toMM, fromMM, unitLabel } from '../../lib/optimizer/units';
import { Pieza } from '../../lib/optimizer/types';
import { supabase } from '../../lib/supabase';

const sectionHeaderCls = "flex items-center gap-2 px-3 py-2 bg-slate-100 border-b border-slate-200 cursor-pointer select-none hover:bg-slate-200/60 transition-colors";
const cellInput = "w-full bg-transparent text-xs px-1.5 py-1 border border-transparent focus:border-blue-400 focus:bg-white rounded outline-none text-center tabular-nums";

function SectionHeader({ icon: Icon, title, open, onToggle }: {
  icon: React.ComponentType<{ className?: string }>; title: string; open: boolean; onToggle: () => void;
}) {
  return (
    <div className={sectionHeaderCls} onClick={onToggle}>
      <Icon className="h-4 w-4 text-slate-500 shrink-0" />
      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex-1">{title}</span>
      <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
    </div>
  );
}

// ── Edge banding popover ────────────────────────────────────
const EB_TYPES = [
  { value: 0, label: '—', cls: 'bg-slate-100 text-slate-400' },
  { value: 1, label: 'A', cls: 'bg-slate-800 text-white' },
  { value: 2, label: 'B', cls: 'bg-slate-600 text-white' },
  { value: 3, label: 'C', cls: 'bg-slate-400 text-white' },
];

function EdgeBandPopover({ piece, onUpdate }: { piece: Pieza; onUpdate: (cb: Pieza['cubrecanto']) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cb = piece.cubrecanto;
  const count = [cb.sup, cb.inf, cb.izq, cb.der].filter(v => v > 0).length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sides: [keyof Pieza['cubrecanto'], string][] = [['sup', 'Top'], ['inf', 'Bottom'], ['izq', 'Left'], ['der', 'Right']];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} title="Edge banding"
        className={`text-xs px-1 py-0.5 rounded ${count > 0 ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:bg-slate-100'}`}>
        {count > 0 ? count : '—'}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 w-40">
          <div className="text-xs font-semibold text-slate-600 mb-2">Edge Banding</div>
          <div className="text-[10px] text-slate-400 mb-2 flex gap-2"><span>A=━━</span><span>B=╌╌</span><span>C=····</span></div>
          {sides.map(([k, label]) => {
            const val = cb[k];
            return (
              <div key={k} className="flex items-center justify-between py-1">
                <span className="text-xs text-slate-600 w-12">{label}</span>
                <div className="flex gap-1">
                  {EB_TYPES.map(et => (
                    <button key={et.value} onClick={() => onUpdate({ ...cb, [k]: et.value })}
                      className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-all
                        ${val === et.value ? et.cls + ' ring-1 ring-blue-400' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                      {et.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface PriceListItem {
  id: string;
  concept_description: string;
  price: number;
  dimensions: string | null;
  material: string | null;
}

export function OptimizerSidebar() {
  const store = useOptimizerStore();
  const unit = store.unit;

  const [panelsOpen, setPanelsOpen] = useState(true);
  const [stocksOpen, setStocksOpen] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(true);
  const [remnantsOpen, setRemnantsOpen] = useState(false);

  // ── Price list data ───────────────────────────────────────
  const [sheetMaterials, setSheetMaterials] = useState<PriceListItem[]>([]);
  const [edgebandItems, setEdgebandItems] = useState<PriceListItem[]>([]);
  useEffect(() => {
    supabase.from('price_list').select('id, concept_description, price, dimensions, material')
      .eq('unit', 'Sheet').eq('is_active', true)
      .then(({ data }) => { if (data) setSheetMaterials(data); });
    supabase.from('price_list').select('id, concept_description, price, dimensions, material')
      .eq('type', 'Edgeband').eq('is_active', true)
      .then(({ data }) => { if (data) setEdgebandItems(data); });
  }, []);

  const stockNames = Array.from(new Set(store.stocks.map(s => s.nombre))).filter(Boolean);

  // ── Panel add state ───────────────────────────────────────
  const [pAncho, setPAncho] = useState('');
  const [pAlto, setPAlto] = useState('');
  const [pCant, setPCant] = useState('1');
  const [pNombre, setPNombre] = useState('');
  const [pMat, setPMat] = useState('');
  const [pGrosor, setPGrosor] = useState('18');
  const [pVeta, setPVeta] = useState(false);
  const [pArea, setPArea] = useState('');

  // ── Stock add state ───────────────────────────────────────
  const [sAncho, setSAncho] = useState('2440');
  const [sAlto, setSAlto] = useState('1220');
  const [sNombre, setSNombre] = useState('');
  const [sCosto, setSCosto] = useState('450');
  const [sQty, setSQty] = useState('0');

  // ── Area add state ────────────────────────────────────────
  const [newArea, setNewArea] = useState('');

  const addPiece = () => {
    const ancho = toMM(parseFloat(pAncho) || 0, unit);
    const alto = toMM(parseFloat(pAlto) || 0, unit);
    if (!ancho || !alto) return;
    store.addPiece({
      nombre: pNombre, material: pMat || (store.stocks[0]?.nombre ?? 'Default'),
      grosor: toMM(parseFloat(pGrosor) || 18, unit),
      ancho, alto, cantidad: parseInt(pCant) || 1,
      vetaHorizontal: pVeta,
      cubrecanto: { sup: 0, inf: 0, izq: 0, der: 0 },
      area: pArea || undefined,
    });
    setPAncho(''); setPAlto(''); setPCant('1'); setPNombre('');
  };

  const addStock = () => {
    const ancho = toMM(parseFloat(sAncho) || 0, unit);
    const alto = toMM(parseFloat(sAlto) || 0, unit);
    if (!ancho || !alto) return;
    store.addStock({
      nombre: sNombre || `${sAncho}×${sAlto}`,
      ancho, alto, costo: parseFloat(sCosto) || 0,
      sierra: store.globalSierra,
      qty: parseInt(sQty) || 0,
    });
    setSNombre('');
  };

  const handleSelectSheet = (sheetId: string, stockId?: string) => {
    const mat = sheetMaterials.find(m => m.id === sheetId);
    if (!mat) return;
    if (stockId) {
      // Assign material to existing stock
      const dims = mat.dimensions || '';
      const numMatch = dims.match(/(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)/i);
      store.updateStock(stockId, {
        nombre: mat.concept_description,
        costo: mat.price,
        materialId: mat.id,
        ...(numMatch ? { ancho: parseFloat(numMatch[1]), alto: parseFloat(numMatch[2]) } : {}),
      });
    } else {
      // Pre-fill add row
      const dims = mat.dimensions || '';
      const numMatch = dims.match(/(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)/i);
      if (numMatch) { setSAncho(numMatch[1]); setSAlto(numMatch[2]); }
      setSCosto(String(mat.price || 0));
      setSNombre(mat.concept_description);
    }
  };

  const handlePieceKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') addPiece(); };
  const handleStockKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') addStock(); };

  // ── Remnant state ─────────────────────────────────────────
  const [remMat, setRemMat] = useState('Default');
  const [remGrosor, setRemGrosor] = useState('18');
  const [remAncho, setRemAncho] = useState('800');
  const [remAlto, setRemAlto] = useState('600');

  // ── Group pieces by area then material ────────────────────
  const groupedPieces: { area: string; material: string; pieces: Pieza[] }[] = [];
  const piecesByKey = new Map<string, Pieza[]>();
  store.pieces.forEach(p => {
    const key = `${p.area || '—'}|||${p.material}`;
    if (!piecesByKey.has(key)) piecesByKey.set(key, []);
    piecesByKey.get(key)!.push(p);
  });
  piecesByKey.forEach((pieces, key) => {
    const [area, material] = key.split('|||');
    groupedPieces.push({ area, material, pieces });
  });
  groupedPieces.sort((a, b) => a.area.localeCompare(b.area) || a.material.localeCompare(b.material));

  return (
    <div className="flex-1 overflow-y-auto bg-white">

      {/* ═══ PANELS ═════════════════════════════════════════ */}
      <SectionHeader icon={LayoutList} title="Panels" open={panelsOpen} onToggle={() => setPanelsOpen(v => !v)} />
      {panelsOpen && (
        <div>
          {/* Area + Material + grain bar */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex-wrap">
            <select value={pArea} onChange={e => setPArea(e.target.value)}
              className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700 w-24">
              <option value="">No area</option>
              {store.areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={pMat} onChange={e => setPMat(e.target.value)}
              className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700 flex-1 truncate min-w-0">
              <option value="">Material...</option>
              {stockNames.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input value={pGrosor} onChange={e => setPGrosor(e.target.value)} placeholder="18"
              className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white text-center w-10" title="Thickness" />
            <label className="flex items-center gap-1 cursor-pointer shrink-0" title="Fixed grain">
              <input type="checkbox" checked={pVeta} onChange={e => setPVeta(e.target.checked)}
                className="w-3 h-3 rounded border-slate-300 text-blue-600" />
              <span className="text-[10px] text-slate-500">Grain</span>
            </label>
          </div>

          {/* Grouped panels table */}
          {groupedPieces.length > 0 ? (
            groupedPieces.map(({ area, material, pieces }) => (
              <div key={`${area}|||${material}`}>
                <div className="px-3 py-1 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                  {area !== '—' && <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">{area}</span>}
                  <span className="text-[10px] font-semibold text-slate-600 truncate">{material}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{pieces.length} pcs</span>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {pieces.map(p => (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-blue-50/40 group">
                        <td className="px-2 py-0.5 text-xs tabular-nums text-slate-700">{parseFloat(fromMM(p.ancho, unit).toFixed(3))}</td>
                        <td className="px-1 py-0.5 text-xs tabular-nums text-slate-700">{parseFloat(fromMM(p.alto, unit).toFixed(3))}</td>
                        <td className="px-1 py-0.5 text-center text-xs font-semibold tabular-nums text-slate-700 w-8">{p.cantidad}</td>
                        <td className="px-1 py-0.5 text-center w-6">
                          <button onClick={() => store.updatePiece(p.id, { vetaHorizontal: !p.vetaHorizontal })}
                            className={`text-xs px-0.5 rounded ${p.vetaHorizontal ? 'bg-amber-100 text-amber-700' : 'text-slate-300'}`}>
                            {p.vetaHorizontal ? '|||' : '~'}
                          </button>
                        </td>
                        <td className="px-1 py-0.5 text-center w-6">
                          <EdgeBandPopover piece={p} onUpdate={cb => store.updatePiece(p.id, { cubrecanto: cb })} />
                        </td>
                        <td className="px-1 py-0.5 truncate max-w-14 text-xs text-slate-500">{p.nombre || '—'}</td>
                        <td className="px-0.5 py-0.5 w-4">
                          <button onClick={() => store.removePiece(p.id)}
                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          ) : null}

          {/* Table header for add row */}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-1 px-2 text-left font-semibold text-slate-500">Width</th>
                <th className="py-1 px-1 text-left font-semibold text-slate-500">Height</th>
                <th className="py-1 px-1 text-center font-semibold text-slate-500 w-8">Qty</th>
                <th className="py-1 px-1 text-center font-semibold text-slate-500 w-6">V</th>
                <th className="py-1 px-1 text-center font-semibold text-slate-500 w-6">EB</th>
                <th className="py-1 px-1 text-left font-semibold text-slate-500">Name</th>
                <th className="py-1 w-4"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-green-50/40">
                <td className="px-1 py-0.5"><input value={pAncho} onChange={e => setPAncho(e.target.value)} onKeyDown={handlePieceKey}
                  placeholder={unit === 'in' ? '24' : '600'} className={cellInput + ' text-left'} /></td>
                <td className="px-0.5 py-0.5"><input value={pAlto} onChange={e => setPAlto(e.target.value)} onKeyDown={handlePieceKey}
                  placeholder={unit === 'in' ? '16' : '400'} className={cellInput + ' text-left'} /></td>
                <td className="px-0.5 py-0.5"><input value={pCant} onChange={e => setPCant(e.target.value)} onKeyDown={handlePieceKey}
                  className={cellInput} /></td>
                <td colSpan={2}></td>
                <td className="px-0.5 py-0.5"><input value={pNombre} onChange={e => setPNombre(e.target.value)} onKeyDown={handlePieceKey}
                  placeholder="Name" className={cellInput + ' text-left'} /></td>
                <td className="px-0.5 py-0.5"><button onClick={addPiece} disabled={!pAncho || !pAlto}
                  className="text-green-600 hover:text-green-700 disabled:text-slate-300 p-0.5"><Pencil className="h-3 w-3" /></button></td>
              </tr>
            </tbody>
          </table>

          {/* Summary */}
          {(() => {
            let totalEB = 0;
            store.pieces.forEach(p => {
              const cb = p.cubrecanto;
              if (cb.sup > 0) totalEB += (p.ancho + 30) * p.cantidad;
              if (cb.inf > 0) totalEB += (p.ancho + 30) * p.cantidad;
              if (cb.izq > 0) totalEB += (p.alto + 30) * p.cantidad;
              if (cb.der > 0) totalEB += (p.alto + 30) * p.cantidad;
            });
            return (
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex-wrap gap-1">
                <span>{store.pieces.length} panel{store.pieces.length !== 1 ? 's' : ''}</span>
                <span>{(store.pieces.reduce((s, p) => s + p.ancho * p.alto * p.cantidad, 0) / 1e6).toFixed(2)} m²</span>
                {totalEB > 0 && <span className="text-amber-600">EB: {(totalEB / 1000).toFixed(2)}m</span>}
                {store.pieces.length > 0 && (
                  <button onClick={() => store.clearPieces()} className="text-red-400 hover:text-red-600 text-xs">Clear</button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ AREAS ══════════════════════════════════════════ */}
      <SectionHeader icon={FolderOpen} title="Areas" open={store.areas.length > 0 || false} onToggle={() => {}} />
      <div className="px-3 py-1.5 border-b border-slate-100">
        <div className="flex gap-1.5">
          <input value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="e.g. Kitchen, Closet..."
            onKeyDown={e => { if (e.key === 'Enter' && newArea.trim()) { store.addArea(newArea.trim()); setNewArea(''); } }}
            className="flex-1 text-xs border border-slate-200 rounded px-1.5 py-1 bg-white" />
          <button onClick={() => { if (newArea.trim()) { store.addArea(newArea.trim()); setNewArea(''); } }}
            className="text-xs text-green-600 hover:text-green-700 px-1"><Plus className="h-3.5 w-3.5" /></button>
        </div>
        {store.areas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {store.areas.map(a => (
              <span key={a} className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                {a}
                <button onClick={() => store.removeArea(a)} className="text-blue-400 hover:text-red-500"><X className="h-2.5 w-2.5" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ═══ STOCK SHEETS ═══════════════════════════════════ */}
      <SectionHeader icon={Layers} title="Stock Sheets" open={stocksOpen} onToggle={() => setStocksOpen(v => !v)} />
      {stocksOpen && (
        <div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-1.5 px-2 text-left font-semibold text-slate-500">Width</th>
                <th className="py-1.5 px-1 text-left font-semibold text-slate-500">Height</th>
                <th className="py-1.5 px-1 text-center font-semibold text-slate-500">$</th>
                <th className="py-1.5 px-1 text-center font-semibold text-slate-500 w-8">Qty</th>
                <th className="py-1.5 px-1 text-left font-semibold text-slate-500">Material</th>
                <th className="py-1.5 w-4"></th>
              </tr>
            </thead>
            <tbody>
              {store.stocks.map(s => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-blue-50/40 group">
                  <td className="px-2 py-0.5 text-xs tabular-nums text-slate-700">{parseFloat(fromMM(s.ancho, unit).toFixed(3))}</td>
                  <td className="px-1 py-0.5 text-xs tabular-nums text-slate-700">{parseFloat(fromMM(s.alto, unit).toFixed(3))}</td>
                  <td className="px-1 py-0.5 text-center text-xs tabular-nums text-slate-700">{s.costo}</td>
                  <td className="px-1 py-0.5 text-center">
                    <input type="number" min="0" value={s.qty || 0}
                      onChange={e => store.updateStock(s.id, { qty: parseInt(e.target.value) || 0 })}
                      className="w-8 text-xs text-center border border-transparent hover:border-slate-200 focus:border-blue-400 rounded bg-transparent tabular-nums" />
                  </td>
                  <td className="px-1 py-0.5">
                    {sheetMaterials.length > 0 ? (
                      <select value={s.materialId || ''} onChange={e => handleSelectSheet(e.target.value, s.id)}
                        className="w-full text-[10px] border-0 bg-transparent text-slate-600 truncate cursor-pointer p-0">
                        <option value="">{s.nombre}</option>
                        {sheetMaterials.map(m => (
                          <option key={m.id} value={m.id}>{m.concept_description}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-500 truncate">{s.nombre}</span>
                    )}
                  </td>
                  <td className="px-0.5 py-0.5">
                    <button onClick={() => store.removeStock(s.id)}
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-green-50/40 border-t border-slate-200">
                <td className="px-1 py-0.5"><input value={sAncho} onChange={e => setSAncho(e.target.value)} onKeyDown={handleStockKey}
                  className={cellInput + ' text-left'} /></td>
                <td className="px-0.5 py-0.5"><input value={sAlto} onChange={e => setSAlto(e.target.value)} onKeyDown={handleStockKey}
                  className={cellInput + ' text-left'} /></td>
                <td className="px-0.5 py-0.5"><input value={sCosto} onChange={e => setSCosto(e.target.value)} onKeyDown={handleStockKey}
                  className={cellInput} /></td>
                <td className="px-0.5 py-0.5"><input value={sQty} onChange={e => setSQty(e.target.value)} onKeyDown={handleStockKey}
                  placeholder="0" className={cellInput} /></td>
                <td className="px-0.5 py-0.5"><input value={sNombre} onChange={e => setSNombre(e.target.value)} onKeyDown={handleStockKey}
                  placeholder="Name" className={cellInput + ' text-left'} /></td>
                <td className="px-0.5 py-0.5"><button onClick={addStock}
                  className="text-green-600 hover:text-green-700 p-0.5"><Pencil className="h-3 w-3" /></button></td>
              </tr>
            </tbody>
          </table>
          <div className="px-3 py-1 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400">
            Qty 0 = unlimited sheets
          </div>
        </div>
      )}

      {/* ═══ OPTIONS ═════════════════════════════════════════ */}
      <SectionHeader icon={Settings} title="Options" open={optionsOpen} onToggle={() => setOptionsOpen(v => !v)} />
      {optionsOpen && (
        <div className="px-3 py-2 space-y-2.5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">Kerf (mm)</span>
            <input type="number" step="0.1" value={store.globalSierra} onChange={e => store.setGlobalSierra(+e.target.value)}
              className="w-16 text-xs text-right border border-slate-200 rounded px-1.5 py-0.5 tabular-nums" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">Min. offcut (mm)</span>
            <input type="number" value={store.minOffcut} onChange={e => store.setMinOffcut(+e.target.value)}
              className="w-16 text-xs text-right border border-slate-200 rounded px-1.5 py-0.5 tabular-nums" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">Board trim (mm) <span className="text-slate-400" title="Edge strip discarded per side">ⓘ</span></span>
            <input type="number" min={0} max={50} step={1} value={store.boardTrim}
              onChange={e => store.setBoardTrim(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-16 text-xs text-right border border-slate-200 rounded px-1.5 py-0.5 tabular-nums" />
          </div>

          {edgebandItems.length > 0 && (
            <div className="pt-2 mt-2 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-600 mb-2">Edge Banding</div>
              {(['a', 'b', 'c'] as const).map(key => {
                const label = key.toUpperCase();
                const lineStyle = key === 'a' ? '━━' : key === 'b' ? '╌╌' : '····';
                const selected = store.ebConfig[key];
                return (
                  <div key={key} className="mb-1.5">
                    <label className="text-[10px] text-slate-500 font-semibold">Type {label} ({lineStyle})</label>
                    <select value={selected.id} onChange={e => {
                      const item = edgebandItems.find(i => i.id === e.target.value);
                      store.setEbConfig({
                        ...store.ebConfig,
                        [key]: item ? { id: item.id, name: item.concept_description, price: item.price } : { id: '', name: '', price: 0 },
                      });
                    }} className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700 mt-0.5">
                      <option value="">Not assigned</option>
                      {edgebandItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.concept_description} — ${item.price}/m {item.dimensions ? `(${item.dimensions})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ REMNANTS ════════════════════════════════════════ */}
      <SectionHeader icon={Layers} title="Remnants" open={remnantsOpen} onToggle={() => setRemnantsOpen(v => !v)} />
      {remnantsOpen && (
        <div className="px-3 py-2 space-y-2 border-b border-slate-100">
          <div className="flex gap-1.5">
            <select value={remMat} onChange={e => setRemMat(e.target.value)}
              className="text-xs border border-slate-200 rounded px-1 py-0.5 flex-1">
              {stockNames.length > 0 ? stockNames.map(m => <option key={m}>{m}</option>) : <option>Default</option>}
            </select>
            <input value={remGrosor} onChange={e => setRemGrosor(e.target.value)} placeholder="18"
              className="w-12 text-xs text-center border border-slate-200 rounded px-1 py-0.5" />
          </div>
          <div className="flex gap-1.5">
            <input value={remAncho} onChange={e => setRemAncho(e.target.value)} placeholder="Width"
              className="flex-1 text-xs border border-slate-200 rounded px-1.5 py-0.5" />
            <input value={remAlto} onChange={e => setRemAlto(e.target.value)} placeholder="Height"
              className="flex-1 text-xs border border-slate-200 rounded px-1.5 py-0.5" />
            <button onClick={() => {
              store.addRemnant({ material: remMat || 'Default',
                grosor: toMM(parseFloat(remGrosor) || 18, unit),
                ancho: toMM(parseFloat(remAncho) || 0, unit), alto: toMM(parseFloat(remAlto) || 0, unit) });
            }} className="text-xs text-green-600 hover:text-green-700 font-semibold px-1.5">+</button>
          </div>
          {store.remnants.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-slate-100">
              {store.remnants.map(r => (
                <div key={r.id} className="flex justify-between items-center text-xs group">
                  <span className="text-slate-600">{r.material} {parseFloat(fromMM(r.ancho, unit).toFixed(0))}×{parseFloat(fromMM(r.alto, unit).toFixed(0))}</span>
                  <button onClick={() => store.removeRemnant(r.id)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
