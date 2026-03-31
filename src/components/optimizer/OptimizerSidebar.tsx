import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Layers, Settings, LayoutList, X, Pencil, MoreHorizontal } from 'lucide-react';
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

// ── Edge banding type labels & styles ────────────────────────
const EB_TYPES = [
  { value: 0, label: '—', cls: 'bg-slate-100 text-slate-400' },
  { value: 1, label: 'A', cls: 'bg-slate-800 text-white' },       // solid
  { value: 2, label: 'B', cls: 'bg-slate-600 text-white' },       // dashed
  { value: 3, label: 'C', cls: 'bg-slate-400 text-white' },       // dotted
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

  const cycle = (side: keyof Pieza['cubrecanto']) => {
    onUpdate({ ...cb, [side]: (cb[side] + 1) % 4 });
  };

  const sides: [keyof Pieza['cubrecanto'], string][] = [
    ['sup', 'Sup'], ['inf', 'Inf'], ['izq', 'Izq'], ['der', 'Der'],
  ];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} title="Cubrecanto"
        className={`text-xs px-1 py-0.5 rounded ${count > 0 ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:bg-slate-100'}`}>
        {count > 0 ? count : '—'}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 w-40">
          <div className="text-xs font-semibold text-slate-600 mb-2">Cubrecanto</div>
          <div className="text-[10px] text-slate-400 mb-2 flex gap-2">
            <span>A=━━</span><span>B=╌╌</span><span>C=····</span>
          </div>
          {sides.map(([k, label]) => {
            const val = cb[k];
            const t = EB_TYPES[val] || EB_TYPES[0];
            return (
              <div key={k} className="flex items-center justify-between py-1">
                <span className="text-xs text-slate-600 w-8">{label}</span>
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

// ── Price list sheet material type ──────────────────────────
interface SheetMaterial {
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

  // ── Price list sheet materials ────────────────────────────
  const [sheetMaterials, setSheetMaterials] = useState<SheetMaterial[]>([]);
  useEffect(() => {
    supabase.from('price_list').select('id, concept_description, price, dimensions, material')
      .eq('unit', 'Sheet').eq('is_active', true)
      .then(({ data }) => { if (data) setSheetMaterials(data); });
  }, []);

  // Derive material names from stock sheets for panel material dropdown
  const stockMaterials = Array.from(new Set(store.stocks.map(s => s.nombre))).filter(Boolean);

  // ── Inline add row state — Panels ─────────────────────────
  const [pAncho, setPAncho] = useState('');
  const [pAlto, setPAlto] = useState('');
  const [pCant, setPCant] = useState('1');
  const [pNombre, setPNombre] = useState('');
  const [pMat, setPMat] = useState('');
  const [pGrosor, setPGrosor] = useState('18');
  const [pVeta, setPVeta] = useState(false);

  // ── Inline add row state — Stocks ─────────────────────────
  const [sAncho, setSAncho] = useState('2440');
  const [sAlto, setSAlto] = useState('1220');
  const [sNombre, setSNombre] = useState('');
  const [sCosto, setSCosto] = useState('450');
  const [selectedSheetId, setSelectedSheetId] = useState('');

  const addPiece = () => {
    const ancho = toMM(parseFloat(pAncho) || 0, unit);
    const alto = toMM(parseFloat(pAlto) || 0, unit);
    if (!ancho || !alto) return;
    const material = pMat || (store.stocks[0]?.nombre ?? 'Melamina');
    store.addPiece({
      nombre: pNombre, material,
      grosor: toMM(parseFloat(pGrosor) || 18, unit),
      ancho, alto, cantidad: parseInt(pCant) || 1,
      vetaHorizontal: pVeta,
      cubrecanto: { sup: 0, inf: 0, izq: 0, der: 0 },
    });
    setPAncho(''); setPAlto(''); setPCant('1'); setPNombre('');
  };

  const addStock = () => {
    const ancho = toMM(parseFloat(sAncho) || 0, unit);
    const alto = toMM(parseFloat(sAlto) || 0, unit);
    if (!ancho || !alto) return;
    store.addStock({
      nombre: sNombre || `${sAncho}×${sAlto}`,
      ancho, alto,
      costo: parseFloat(sCosto) || 0,
      sierra: store.globalSierra,
    });
    setSNombre('');
  };

  const handleSelectSheet = (sheetId: string) => {
    setSelectedSheetId(sheetId);
    const mat = sheetMaterials.find(m => m.id === sheetId);
    if (!mat) return;
    // Try to parse dimensions like "4ft x 8ft" or "2440x1220"
    const dims = mat.dimensions || '';
    const numMatch = dims.match(/(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)/i);
    if (numMatch) {
      setSAncho(numMatch[1]);
      setSAlto(numMatch[2]);
    }
    setSCosto(String(mat.price || 0));
    setSNombre(mat.concept_description);
  };

  const handlePieceKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') addPiece(); };
  const handleStockKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') addStock(); };

  // ── Remnant state ─────────────────────────────────────────
  const [remMat, setRemMat] = useState('Melamina');
  const [remGrosor, setRemGrosor] = useState('18');
  const [remAncho, setRemAncho] = useState('800');
  const [remAlto, setRemAlto] = useState('600');

  return (
    <div className="flex-1 overflow-y-auto bg-white">

      {/* ═══ PANELS ═════════════════════════════════════════ */}
      <SectionHeader icon={LayoutList} title="Panels" open={panelsOpen} onToggle={() => setPanelsOpen(v => !v)} />
      {panelsOpen && (
        <div>
          {/* Material / grain bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100">
            <select value={pMat} onChange={e => setPMat(e.target.value)}
              className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700 flex-1 truncate">
              <option value="">Material...</option>
              {stockMaterials.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input value={pGrosor} onChange={e => setPGrosor(e.target.value)} placeholder="18"
              className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white text-center w-12"
              title={`Grosor (${unitLabel(unit)})`} />
            <label className="flex items-center gap-1 cursor-pointer shrink-0" title="Veta fija (no rotar)">
              <input type="checkbox" checked={pVeta} onChange={e => setPVeta(e.target.checked)}
                className="w-3 h-3 rounded border-slate-300 text-blue-600" />
              <span className="text-xs text-slate-500">Veta</span>
            </label>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-1.5 px-2 text-left font-semibold text-slate-500">Ancho</th>
                <th className="py-1.5 px-1 text-left font-semibold text-slate-500">Alto</th>
                <th className="py-1.5 px-1 text-center font-semibold text-slate-500 w-10">Cant.</th>
                <th className="py-1.5 px-1 text-center font-semibold text-slate-500 w-7">V</th>
                <th className="py-1.5 px-1 text-center font-semibold text-slate-500 w-7">EB</th>
                <th className="py-1.5 px-1 text-left font-semibold text-slate-500">Nombre</th>
                <th className="py-1.5 w-5"></th>
              </tr>
            </thead>
            <tbody>
              {store.pieces.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-blue-50/40 group">
                  <td className="px-2 py-0.5 text-xs tabular-nums text-slate-700">{parseFloat(fromMM(p.ancho, unit).toFixed(3))}</td>
                  <td className="px-1 py-0.5 text-xs tabular-nums text-slate-700">{parseFloat(fromMM(p.alto, unit).toFixed(3))}</td>
                  <td className="px-1 py-0.5 text-center text-xs font-semibold tabular-nums text-slate-700">{p.cantidad}</td>
                  <td className="px-1 py-0.5 text-center">
                    <button onClick={() => store.updatePiece(p.id, { vetaHorizontal: !p.vetaHorizontal })}
                      title={p.vetaHorizontal ? 'Veta fija' : 'Veta libre'}
                      className={`text-xs px-1 py-0.5 rounded ${p.vetaHorizontal ? 'bg-amber-100 text-amber-700' : 'text-slate-300 hover:bg-slate-100'}`}>
                      {p.vetaHorizontal ? '|||' : '~'}
                    </button>
                  </td>
                  <td className="px-1 py-0.5 text-center">
                    <EdgeBandPopover piece={p} onUpdate={(cb) => store.updatePiece(p.id, { cubrecanto: cb })} />
                  </td>
                  <td className="px-1 py-0.5 truncate max-w-16 text-xs text-slate-500">{p.nombre || '—'}</td>
                  <td className="px-0.5 py-0.5">
                    <button onClick={() => store.removePiece(p.id)}
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Add row */}
              <tr className="bg-green-50/40 border-t border-slate-200">
                <td className="px-1 py-0.5">
                  <input value={pAncho} onChange={e => setPAncho(e.target.value)} onKeyDown={handlePieceKey}
                    placeholder={unit === 'in' ? '24' : '600'} className={cellInput + ' text-left'} />
                </td>
                <td className="px-0.5 py-0.5">
                  <input value={pAlto} onChange={e => setPAlto(e.target.value)} onKeyDown={handlePieceKey}
                    placeholder={unit === 'in' ? '16' : '400'} className={cellInput + ' text-left'} />
                </td>
                <td className="px-0.5 py-0.5">
                  <input value={pCant} onChange={e => setPCant(e.target.value)} onKeyDown={handlePieceKey}
                    className={cellInput} />
                </td>
                <td colSpan={2}></td>
                <td className="px-0.5 py-0.5">
                  <input value={pNombre} onChange={e => setPNombre(e.target.value)} onKeyDown={handlePieceKey}
                    placeholder="Nombre" className={cellInput + ' text-left'} />
                </td>
                <td className="px-0.5 py-0.5">
                  <button onClick={addPiece} title="Agregar" disabled={!pAncho || !pAlto}
                    className="text-green-600 hover:text-green-700 disabled:text-slate-300 p-0.5">
                    <Pencil className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Summary with edgeband total */}
          {(() => {
            let totalEB = 0;
            store.pieces.forEach(p => {
              const cb = p.cubrecanto;
              const addCm = 30; // +3cm = 30mm per side
              if (cb.sup > 0) totalEB += (p.ancho + addCm) * p.cantidad;
              if (cb.inf > 0) totalEB += (p.ancho + addCm) * p.cantidad;
              if (cb.izq > 0) totalEB += (p.alto + addCm) * p.cantidad;
              if (cb.der > 0) totalEB += (p.alto + addCm) * p.cantidad;
            });
            const ebMeters = totalEB / 1000;
            return (
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex-wrap gap-1">
                <span>{store.pieces.length} panel{store.pieces.length !== 1 ? 'es' : ''}</span>
                <span>{(store.pieces.reduce((s, p) => s + p.ancho * p.alto * p.cantidad, 0) / 1e6).toFixed(2)} m²</span>
                {ebMeters > 0 && <span className="text-amber-600">EB: {ebMeters.toFixed(2)}m</span>}
                {store.pieces.length > 0 && (
                  <button onClick={() => store.clearPieces()} className="text-red-400 hover:text-red-600 text-xs">Limpiar</button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ STOCK SHEETS ═══════════════════════════════════ */}
      <SectionHeader icon={Layers} title="Stock sheets" open={stocksOpen} onToggle={() => setStocksOpen(v => !v)} />
      {stocksOpen && (
        <div>
          {/* Material selector from pricelist */}
          {sheetMaterials.length > 0 && (
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
              <select value={selectedSheetId} onChange={e => handleSelectSheet(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700">
                <option value="">Seleccionar material del Price List...</option>
                {sheetMaterials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.concept_description} — ${m.price} {m.dimensions ? `(${m.dimensions})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-1.5 px-2 text-left font-semibold text-slate-500">Ancho</th>
                <th className="py-1.5 px-1 text-left font-semibold text-slate-500">Alto</th>
                <th className="py-1.5 px-1 text-center font-semibold text-slate-500">$</th>
                <th className="py-1.5 px-1 text-left font-semibold text-slate-500">Nombre</th>
                <th className="py-1.5 w-5"></th>
              </tr>
            </thead>
            <tbody>
              {store.stocks.map(s => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-blue-50/40 group">
                  <td className="px-2 py-0.5 text-xs tabular-nums text-slate-700">{parseFloat(fromMM(s.ancho, unit).toFixed(3))}</td>
                  <td className="px-1 py-0.5 text-xs tabular-nums text-slate-700">{parseFloat(fromMM(s.alto, unit).toFixed(3))}</td>
                  <td className="px-1 py-0.5 text-center text-xs tabular-nums text-slate-700">{s.costo}</td>
                  <td className="px-1 py-0.5 text-xs text-slate-500 truncate max-w-20">{s.nombre}</td>
                  <td className="px-0.5 py-0.5">
                    <button onClick={() => store.removeStock(s.id)}
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-green-50/40 border-t border-slate-200">
                <td className="px-1 py-0.5">
                  <input value={sAncho} onChange={e => setSAncho(e.target.value)} onKeyDown={handleStockKey}
                    className={cellInput + ' text-left'} />
                </td>
                <td className="px-0.5 py-0.5">
                  <input value={sAlto} onChange={e => setSAlto(e.target.value)} onKeyDown={handleStockKey}
                    className={cellInput + ' text-left'} />
                </td>
                <td className="px-0.5 py-0.5">
                  <input value={sCosto} onChange={e => setSCosto(e.target.value)} onKeyDown={handleStockKey}
                    className={cellInput} />
                </td>
                <td className="px-0.5 py-0.5">
                  <input value={sNombre} onChange={e => setSNombre(e.target.value)} onKeyDown={handleStockKey}
                    placeholder="Nombre" className={cellInput + ' text-left'} />
                </td>
                <td className="px-0.5 py-0.5">
                  <button onClick={addStock} title="Agregar"
                    className="text-green-600 hover:text-green-700 p-0.5">
                    <Pencil className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ OPTIONS ═════════════════════════════════════════ */}
      <SectionHeader icon={Settings} title="Options" open={optionsOpen} onToggle={() => setOptionsOpen(v => !v)} />
      {optionsOpen && (
        <div className="px-3 py-2 space-y-2.5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">Sierra (mm)</span>
            <input type="number" step="0.1" value={store.globalSierra} onChange={e => store.setGlobalSierra(+e.target.value)}
              className="w-16 text-xs text-right border border-slate-200 rounded px-1.5 py-0.5 tabular-nums" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">Mín. retazo (mm)</span>
            <input type="number" value={store.minOffcut} onChange={e => store.setMinOffcut(+e.target.value)}
              className="w-16 text-xs text-right border border-slate-200 rounded px-1.5 py-0.5 tabular-nums" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">
              Trim de bordes (mm)
              <span className="ml-1 text-slate-400" title="Franja descartada en cada orilla">ⓘ</span>
            </span>
            <input type="number" min={0} max={50} step={1} value={store.boardTrim}
              onChange={e => store.setBoardTrim(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-16 text-xs text-right border border-slate-200 rounded px-1.5 py-0.5 tabular-nums" />
          </div>
        </div>
      )}

      {/* ═══ REMNANTS ════════════════════════════════════════ */}
      <SectionHeader icon={Layers} title="Remnants" open={remnantsOpen} onToggle={() => setRemnantsOpen(v => !v)} />
      {remnantsOpen && (
        <div className="px-3 py-2 space-y-2 border-b border-slate-100">
          <div className="flex gap-1.5">
            <select value={remMat} onChange={e => setRemMat(e.target.value)}
              className="text-xs border border-slate-200 rounded px-1 py-0.5 flex-1">
              {stockMaterials.length > 0
                ? stockMaterials.map(m => <option key={m}>{m}</option>)
                : <option>Melamina</option>}
            </select>
            <input value={remGrosor} onChange={e => setRemGrosor(e.target.value)} placeholder="18"
              className="w-12 text-xs text-center border border-slate-200 rounded px-1 py-0.5" />
          </div>
          <div className="flex gap-1.5">
            <input value={remAncho} onChange={e => setRemAncho(e.target.value)} placeholder="Ancho"
              className="flex-1 text-xs border border-slate-200 rounded px-1.5 py-0.5" />
            <input value={remAlto} onChange={e => setRemAlto(e.target.value)} placeholder="Alto"
              className="flex-1 text-xs border border-slate-200 rounded px-1.5 py-0.5" />
            <button onClick={() => {
              store.addRemnant({
                material: remMat || 'Melamina',
                grosor: toMM(parseFloat(remGrosor) || 18, unit),
                ancho: toMM(parseFloat(remAncho) || 0, unit),
                alto: toMM(parseFloat(remAlto) || 0, unit),
              });
            }} className="text-xs text-green-600 hover:text-green-700 font-semibold px-1.5">+</button>
          </div>
          {store.remnants.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-slate-100">
              {store.remnants.map(r => (
                <div key={r.id} className="flex justify-between items-center text-xs group">
                  <span className="text-slate-600">{r.material} {parseFloat(fromMM(r.ancho, unit).toFixed(0))}×{parseFloat(fromMM(r.alto, unit).toFixed(0))}</span>
                  <button onClick={() => store.removeRemnant(r.id)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
