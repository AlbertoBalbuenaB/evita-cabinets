import { useState, useEffect, useRef, Fragment } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Layers, Settings, LayoutList, X, Plus, FolderOpen, Trash2 } from 'lucide-react';
import { useOptimizerStore } from '../../hooks/useOptimizerStore';
import { toMM, fromMM } from '../../lib/optimizer/units';
import { Pieza } from '../../lib/optimizer/types';
import { supabase } from '../../lib/supabase';
import { EdgeBandCell } from '../EdgeBandPopover';

// ── Compact autocomplete ────────────────────────────────────
function CompactAutocomplete({ options, value, onChange, placeholder, className = '' }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hlIdx, setHlIdx] = useState(0);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Also check if click is inside the fixed dropdown
        const drop = document.getElementById('ca-dropdown');
        if (drop && drop.contains(e.target as Node)) return;
        setOpen(false); setSearch('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 220) });
    }
  }, [open]);
  useEffect(() => { setHlIdx(0); }, [search]);
  useEffect(() => {
    if (open && listRef.current && hlIdx >= 0) {
      const el = listRef.current.children[hlIdx] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [hlIdx, open]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHlIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHlIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hlIdx]) { onChange(filtered[hlIdx].value); setOpen(false); setSearch(''); } }
    else if (e.key === 'Escape') { setOpen(false); setSearch(''); }
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      {open ? (
        <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleKey}
          placeholder="Search..." onClick={e => e.stopPropagation()}
          className="w-full text-sm border border-blue-400 bg-white rounded-md px-2.5 py-1.5 outline-none" />
      ) : (
        <button onClick={() => setOpen(true)}
          className="w-full text-sm text-left text-slate-600 truncate cursor-pointer hover:text-blue-600 py-1">
          {selected?.label || placeholder || 'Select...'}
        </button>
      )}
      {open && dropPos && ReactDOM.createPortal(
        <div id="ca-dropdown" style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-auto">
          <div ref={listRef}>
            {filtered.length > 0 ? filtered.map((o, i) => (
              <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                className={`px-3 py-1.5 text-sm cursor-pointer truncate ${i === hlIdx ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'} ${value === o.value ? 'font-semibold' : ''}`}>
                {o.label}
              </div>
            )) : (
              <div className="px-3 py-2 text-sm text-slate-400 text-center">No results</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Section wrapper ─────────────────────────────────────────
function Section({ icon: Icon, title, children, defaultOpen = true, className = '' }: {
  icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; defaultOpen?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`glass-white hover:shadow-lg transition-all duration-200 section-enter ${className}`}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 cursor-pointer select-none hover:bg-white/40 transition-colors"
        onClick={() => setOpen(v => !v)}>
        <Icon className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-1">{title}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </div>
      {open && <div className="border-t border-white/60">{children}</div>}
    </div>
  );
}

// ── Shared input styles ─────────────────────────────────────
const inputCls = "w-full text-sm border border-slate-200/70 rounded-lg px-3 py-2 bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tabular-nums transition-colors";

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

  // ── Price list data ───────────────────────────────────────
  const [sheetMaterials, setSheetMaterials] = useState<PriceListItem[]>([]);
  const [edgebandItems, setEdgebandItems] = useState<PriceListItem[]>([]);
  useEffect(() => {
    supabase.from('price_list').select('id, concept_description, price, dimensions, material')
      .in('unit', ['Sheet', 'Slab']).eq('is_active', true)
      .then(({ data }) => { if (data) setSheetMaterials(data); });
    supabase.from('price_list').select('id, concept_description, price, dimensions, material')
      .eq('type', 'Edgeband').eq('is_active', true)
      .then(({ data }) => { if (data) setEdgebandItems(data); });
  }, []);

  const stockNames = Array.from(new Set([...store.stocks.map(s => s.nombre), ...store.pieces.map(p => p.material)])).filter(Boolean);

  // ── Piece add state ───────────────────────────────────────
  const [pAncho, setPAncho] = useState('');
  const [pAlto, setPAlto] = useState('');
  const [pCant, setPCant] = useState('1');
  const [pNombre, setPNombre] = useState('');
  const [pMat, setPMat] = useState('');
  const [pGrosor, setPGrosor] = useState('18');
  const [pVeta, setPVeta] = useState<'none' | 'horizontal' | 'vertical'>('none');
  const [pArea, setPArea] = useState('');

  // ── Stock add state ───────────────────────────────────────
  const [sAncho, setSAncho] = useState('2440');
  const [sAlto, setSAlto] = useState('1220');
  const [sNombre, setSNombre] = useState('');
  const [sCosto, setSCosto] = useState('450');
  const [sQty] = useState('0');

  // ── Area add state ────────────────────────────────────────
  const [newArea, setNewArea] = useState('');

  // ── Remnant state ─────────────────────────────────────────
  const [remMat, setRemMat] = useState('Default');
  const [remGrosor, setRemGrosor] = useState('18');
  const [remAncho, setRemAncho] = useState('800');
  const [remAlto, setRemAlto] = useState('600');

  const addPiece = () => {
    const ancho = toMM(parseFloat(pAncho) || 0, unit);
    const alto = toMM(parseFloat(pAlto) || 0, unit);
    if (!ancho || !alto) return;
    store.addPiece({
      nombre: pNombre, material: pMat || (store.stocks[0]?.nombre ?? 'Default'),
      grosor: toMM(parseFloat(pGrosor) || 18, unit),
      ancho, alto, cantidad: parseInt(pCant) || 1,
      veta: pVeta,
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
      const dims = mat.dimensions || '';
      const numMatch = dims.match(/(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)/i);
      store.updateStock(stockId, {
        nombre: mat.concept_description,
        costo: mat.price,
        materialId: mat.id,
        ...(numMatch ? { ancho: parseFloat(numMatch[1]), alto: parseFloat(numMatch[2]) } : {}),
      });
    } else {
      const dims = mat.dimensions || '';
      const numMatch = dims.match(/(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)/i);
      if (numMatch) { setSAncho(numMatch[1]); setSAlto(numMatch[2]); }
      setSCosto(String(mat.price || 0));
      setSNombre(mat.concept_description);
    }
  };

  const handlePieceKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') addPiece(); };
  const handleStockKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') addStock(); };

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

  // ── EB total ──────────────────────────────────────────────
  let totalEB = 0;
  store.pieces.forEach(p => {
    const cb = p.cubrecanto;
    if (cb.sup > 0) totalEB += (p.ancho + 30) * p.cantidad;
    if (cb.inf > 0) totalEB += (p.ancho + 30) * p.cantidad;
    if (cb.izq > 0) totalEB += (p.alto + 30) * p.cantidad;
    if (cb.der > 0) totalEB += (p.alto + 30) * p.cantidad;
  });

  // ── Sidebar collapse + resize state ────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarW, setSidebarW] = useState(320);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = e.clientX - dragRef.current.startX;
      setSidebarW(Math.max(240, Math.min(480, dragRef.current.startW + delta)));
    };
    const onUp = () => { dragRef.current = null; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, []);

  return (
    <div className="flex h-full overflow-hidden">

      {/* ═══ LEFT SIDEBAR: Areas + Stock Sheets + Options ════ */}
      <div className="shrink-0 border-r border-slate-200/60 bg-white/40 backdrop-blur-sm overflow-y-auto transition-[width] duration-200"
        style={{ width: sidebarOpen ? sidebarW : 0 }}>
        {sidebarOpen && (
          <div className="p-3 space-y-3" style={{ width: sidebarW }}>
            {/* Areas */}
            <Section icon={FolderOpen} title="Areas" className="stagger-1">
              <div className="px-4 py-3">
                <div className="flex gap-2">
                  <input value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="e.g. Kitchen, Closet..."
                    onKeyDown={e => { if (e.key === 'Enter' && newArea.trim()) { store.addArea(newArea.trim()); setNewArea(''); } }}
                    className={inputCls} />
                  <button onClick={() => { if (newArea.trim()) { store.addArea(newArea.trim()); setNewArea(''); } }}
                    className="px-2.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shrink-0">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {store.areas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {store.areas.map(a => (
                      <span key={a} className="inline-flex items-center gap-1 text-xs bg-blue-600/10 text-blue-800 px-2 py-0.5 rounded-full font-medium border border-blue-600/15">
                        {a}
                        <button onClick={() => store.removeArea(a)} className="text-blue-400 hover:text-red-500 transition-colors"><X className="h-2.5 w-2.5" /></button>
                      </span>
                    ))}
                  </div>
                )}
                {store.areas.length === 0 && (
                  <p className="text-xs text-slate-400 mt-2">No areas defined.</p>
                )}
              </div>
            </Section>

            {/* Stock Sheets */}
            <Section icon={Layers} title="Stock Sheets" className="stagger-2">
              <div className="px-4 py-3 space-y-2">
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Width</label>
                    <input value={sAncho} onChange={e => setSAncho(e.target.value)} onKeyDown={handleStockKey} className={inputCls + ' text-center'} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Height</label>
                    <input value={sAlto} onChange={e => setSAlto(e.target.value)} onKeyDown={handleStockKey} className={inputCls + ' text-center'} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Material</label>
                    <input value={sNombre} onChange={e => setSNombre(e.target.value)} onKeyDown={handleStockKey} placeholder="Name" className={inputCls} />
                  </div>
                </div>
                <button onClick={addStock}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors">
                  <Plus className="h-3.5 w-3.5" />Add Sheet
                </button>
                <p className="text-[10px] text-slate-400">Qty 0 = unlimited</p>
              </div>
              {store.stocks.length > 0 && (
                <div className="border-t border-slate-100/60">
                  {store.stocks.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-1.5 text-xs hover:bg-slate-50 group border-b border-slate-50 last:border-0">
                      <span className="tabular-nums text-slate-700">{parseFloat(fromMM(s.ancho, unit).toFixed(0))}×{parseFloat(fromMM(s.alto, unit).toFixed(0))}</span>
                      <span className="text-slate-500 truncate mx-2 flex-1 min-w-0">
                        {sheetMaterials.length > 0 ? (
                          <CompactAutocomplete
                            value={s.materialId || ''} onChange={val => handleSelectSheet(val, s.id)}
                            placeholder={s.nombre}
                            options={sheetMaterials.map(m => ({ value: m.id, label: m.concept_description }))}
                          />
                        ) : s.nombre}
                      </span>
                      <input type="number" min="0" value={s.qty || 0}
                        onChange={e => store.updateStock(s.id, { qty: parseInt(e.target.value) || 0 })}
                        className="w-10 text-xs text-center border border-transparent hover:border-slate-200/70 focus:border-blue-500 rounded bg-transparent tabular-nums" />
                      <button onClick={() => store.removeStock(s.id)}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 ml-1"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Options */}
            <Section icon={Settings} title="Options" className="stagger-3">
              <div className="px-4 py-3 space-y-3">
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Kerf (mm)</label>
                    <input type="number" step="0.1" value={store.globalSierra} onChange={e => store.setGlobalSierra(+e.target.value)}
                      className={inputCls + ' text-center'} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Min. offcut (mm)</label>
                    <input type="number" value={store.minOffcut} onChange={e => store.setMinOffcut(+e.target.value)}
                      className={inputCls + ' text-center'} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Board trim (mm)</label>
                    <input type="number" min={0} max={50} step={1} value={store.boardTrim}
                      onChange={e => store.setBoardTrim(Math.max(0, parseFloat(e.target.value) || 0))}
                      className={inputCls + ' text-center'} />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={store.trimIncludesKerf} onChange={e => store.setTrimIncludesKerf(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600" />
                  <span className="text-xs text-slate-500">Include kerf in board trim</span>
                </label>

                {/* Engine mode */}
                <div className="pt-2 border-t border-slate-100/60">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Engine</p>
                  <div className="flex flex-col gap-1">
                    {(['guillotine', 'both'] as const).map((mode) => (
                      <label key={mode} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="engine-mode"
                          value={mode}
                          checked={store.engineMode === mode}
                          onChange={() => store.setEngineMode(mode)}
                          className="border-slate-300 text-blue-600"
                        />
                        <span className="text-xs text-slate-500">
                          {mode === 'guillotine' ? 'Guillotine only (panel saw)' : 'Both engines (+ MaxRect)'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Objective */}
                <div className="pt-2 border-t border-slate-100/60">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Optimize for</p>
                  <div className="flex flex-col gap-1">
                    {([
                      ['min-boards', 'Fewer boards'],
                      ['min-waste',  'Less waste'],
                      ['min-cuts',   'Fewer cuts'],
                    ] as const).map(([val, label]) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="objective"
                          value={val}
                          checked={store.objective === val}
                          onChange={() => store.setObjective(val)}
                          className="border-slate-300 text-blue-600"
                        />
                        <span className="text-xs text-slate-500">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {edgebandItems.length > 0 && (
                  <div className="pt-3 border-t border-slate-100/60">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Edge Banding</div>
                    <div className="space-y-2">
                      {(['a', 'b', 'c'] as const).map(key => {
                        const label = key.toUpperCase();
                        const lineStyle = key === 'a' ? '━━' : key === 'b' ? '╌╌' : '····';
                        const selected = store.ebConfig[key];
                        return (
                          <div key={key}>
                            <label className="text-xs text-slate-500 font-medium">Type {label} ({lineStyle})</label>
                            <CompactAutocomplete
                              value={selected.id}
                              onChange={val => {
                                const item = edgebandItems.find(i => i.id === val);
                                store.setEbConfig({
                                  ...store.ebConfig,
                                  [key]: item ? { id: item.id, name: item.concept_description, price: item.price } : { id: '', name: '', price: 0 },
                                });
                              }}
                              placeholder="Not assigned"
                              options={edgebandItems.map(item => ({
                                value: item.id,
                                label: `${item.concept_description} — $${item.price}/m${item.dimensions ? ` (${item.dimensions})` : ''}`,
                              }))}
                              className="mt-0.5"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* Remnants */}
            <Section icon={Layers} title="Remnants" defaultOpen={false} className="stagger-3">
              <div className="px-4 py-3">
                <div className="grid grid-cols-2 gap-2">
                  <select value={remMat} onChange={e => setRemMat(e.target.value)} className={inputCls}>
                    {stockNames.length > 0 ? stockNames.map(m => <option key={m}>{m}</option>) : <option>Default</option>}
                  </select>
                  <input value={remGrosor} onChange={e => setRemGrosor(e.target.value)} placeholder="Thick." className={inputCls + ' text-center'} />
                  <input value={remAncho} onChange={e => setRemAncho(e.target.value)} placeholder="Width" className={inputCls + ' text-center'} />
                  <input value={remAlto} onChange={e => setRemAlto(e.target.value)} placeholder="Height" className={inputCls + ' text-center'} />
                </div>
                <button onClick={() => {
                  store.addRemnant({ material: remMat || 'Default',
                    grosor: toMM(parseFloat(remGrosor) || 18, unit),
                    ancho: toMM(parseFloat(remAncho) || 0, unit), alto: toMM(parseFloat(remAlto) || 0, unit) });
                }} className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200/70 hover:bg-white/60 text-slate-600 text-xs rounded-lg transition-colors">
                  <Plus className="h-3.5 w-3.5" />Add Remnant
                </button>
                {store.remnants.length > 0 && (
                  <div className="space-y-1 pt-2 mt-2 border-t border-slate-100/60">
                    {store.remnants.map(r => (
                      <div key={r.id} className="flex justify-between items-center text-xs group">
                        <span className="text-slate-600">{r.material} — {parseFloat(fromMM(r.ancho, unit).toFixed(0))}×{parseFloat(fromMM(r.alto, unit).toFixed(0))}</span>
                        <button onClick={() => store.removeRemnant(r.id)}
                          className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}
      </div>

      {/* Sidebar toggle + resize handle */}
      <div className="shrink-0 flex flex-col border-r border-slate-200/60">
        <button onClick={() => setSidebarOpen(v => !v)}
          className="w-5 h-8 flex items-center justify-center hover:bg-slate-100 transition-colors"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
          <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${sidebarOpen ? '-rotate-90' : 'rotate-90'}`} />
        </button>
        {sidebarOpen && (
          <div className="flex-1 w-5 cursor-col-resize hover:bg-blue-100 active:bg-blue-200 transition-colors"
            onMouseDown={e => { dragRef.current = { startX: e.clientX, startW: sidebarW }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }} />
        )}
      </div>

      {/* ═══ MAIN CONTENT: Parts ════════════════════════════ */}
      <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4">

      <Section icon={LayoutList} title="Parts">
        {/* Add piece form */}
        <div className="px-5 py-4 bg-blue-50/30 border-b border-slate-100/60 space-y-2">
          {/* Row 1: dimensions + name */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Width</label>
              <input value={pAncho} onChange={e => setPAncho(e.target.value)} onKeyDown={handlePieceKey}
                placeholder={unit === 'in' ? '24' : '600'} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Height</label>
              <input value={pAlto} onChange={e => setPAlto(e.target.value)} onKeyDown={handlePieceKey}
                placeholder={unit === 'in' ? '16' : '400'} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>
              <input value={pCant} onChange={e => setPCant(e.target.value)} onKeyDown={handlePieceKey}
                className={inputCls + ' text-center'} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
              <input value={pNombre} onChange={e => setPNombre(e.target.value)} onKeyDown={handlePieceKey}
                placeholder="Optional" className={inputCls} />
            </div>
          </div>
          {/* Row 2: material + area + thickness + grain + add button */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Material</label>
              <select value={pMat} onChange={e => setPMat(e.target.value)} className={inputCls}>
                <option value="">Default</option>
                {stockNames.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Area</label>
              <select value={pArea} onChange={e => setPArea(e.target.value)} className={inputCls}>
                <option value="">None</option>
                {store.areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-slate-500 mb-1">Thick.</label>
              <input value={pGrosor} onChange={e => setPGrosor(e.target.value)} className={inputCls + ' text-center'} />
            </div>
            <div className="shrink-0 flex items-end pb-0.5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Grain</label>
                <button type="button" onClick={() => setPVeta(v => v === 'none' ? 'horizontal' : v === 'horizontal' ? 'vertical' : 'none')}
                  title={`Grain: ${pVeta} — click to cycle`}
                  className={`w-10 h-[38px] rounded-lg text-sm font-bold flex items-center justify-center transition-all border
                    ${pVeta === 'none' ? 'border-slate-200/70 bg-white/60 text-slate-300' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                  {pVeta === 'none' ? '—' : pVeta === 'horizontal' ? '↔' : '↕'}
                </button>
              </div>
            </div>
            <button onClick={addPiece} disabled={!pAncho || !pAlto}
              className="flex items-center justify-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
              <Plus className="h-4 w-4" />Add
            </button>
          </div>
        </div>

        {/* Pieces table */}
        {store.pieces.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60">
                  <th className="py-2.5 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="py-2.5 px-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Width</th>
                  <th className="py-2.5 px-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Height</th>
                  <th className="py-2.5 px-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">Qty</th>
                  <th className="py-2.5 px-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">Grain</th>
                  <th className="py-2.5 px-1 w-9 text-center text-xs font-medium text-slate-400 uppercase" title="Top">T</th>
                  <th className="py-2.5 px-1 w-9 text-center text-xs font-medium text-slate-400 uppercase" title="Bottom">B</th>
                  <th className="py-2.5 px-1 w-9 text-center text-xs font-medium text-slate-400 uppercase" title="Left">L</th>
                  <th className="py-2.5 px-1 w-9 text-center text-xs font-medium text-slate-400 uppercase" title="Right">R</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Material</th>
                  <th className="py-2.5 px-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Area</th>
                  <th className="py-2.5 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {groupedPieces.map(({ area, material, pieces }, gi) => (
                  <Fragment key={`${area}|||${material}`}>
                    {/* Area group header */}
                    {(gi === 0 || area !== groupedPieces[gi - 1].area) && (
                      <tr className="bg-blue-50/40">
                        <td colSpan={13} className="py-1.5 px-4">
                          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{area === '—' ? 'Unassigned' : area}</span>
                        </td>
                      </tr>
                    )}
                    {pieces.map(p => (
                    <tr key={p.id} className="hover:bg-slate-100/50 transition-colors group">
                      <td className="py-1 px-3">
                        <input value={p.nombre} onChange={e => store.updatePiece(p.id, { nombre: e.target.value })}
                          placeholder="—" className="w-full bg-transparent text-sm border border-transparent hover:border-slate-200/70 focus:border-blue-500 rounded px-1 py-0.5 outline-none text-slate-800" />
                      </td>
                      <td className="py-1 px-2">
                        <input type="number" key={`w-${p.id}-${unit}`} defaultValue={parseFloat(fromMM(p.ancho, unit).toFixed(3))}
                          onBlur={e => { const v = parseFloat(e.target.value); if (v > 0) store.updatePiece(p.id, { ancho: toMM(v, unit) }); }}
                          className="w-full bg-transparent text-sm text-right border border-transparent hover:border-slate-200/70 focus:border-blue-500 rounded px-1 py-0.5 outline-none tabular-nums text-slate-700" />
                      </td>
                      <td className="py-1 px-2">
                        <input type="number" key={`h-${p.id}-${unit}`} defaultValue={parseFloat(fromMM(p.alto, unit).toFixed(3))}
                          onBlur={e => { const v = parseFloat(e.target.value); if (v > 0) store.updatePiece(p.id, { alto: toMM(v, unit) }); }}
                          className="w-full bg-transparent text-sm text-right border border-transparent hover:border-slate-200/70 focus:border-blue-500 rounded px-1 py-0.5 outline-none tabular-nums text-slate-700" />
                      </td>
                      <td className="py-1 px-2">
                        <input type="number" min="1" value={p.cantidad}
                          onChange={e => store.updatePiece(p.id, { cantidad: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full bg-transparent text-sm text-center font-semibold border border-transparent hover:border-slate-200/70 focus:border-blue-500 rounded px-1 py-0.5 outline-none tabular-nums text-slate-700" />
                      </td>
                      <td className="py-1 px-2 text-center">
                        <button onClick={() => {
                          const next = p.veta === 'none' ? 'horizontal' : p.veta === 'horizontal' ? 'vertical' : 'none';
                          store.updatePiece(p.id, { veta: next });
                        }} title={`Grain: ${p.veta} — click to cycle`}
                          className={`w-7 h-6 rounded text-xs font-bold flex items-center justify-center mx-auto transition-all
                            ${p.veta !== 'none' ? 'bg-amber-100 text-amber-700 ring-1 ring-offset-1 ring-amber-300' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}>
                          {p.veta === 'none' ? '—' : p.veta === 'horizontal' ? '↔' : '↕'}
                        </button>
                      </td>
                      <td className="py-1.5 px-1 w-9 text-center">
                        <EdgeBandCell value={p.cubrecanto.sup} side="Top" onChange={v => store.updatePiece(p.id, { cubrecanto: { ...p.cubrecanto, sup: v } })} />
                      </td>
                      <td className="py-1.5 px-1 w-9 text-center">
                        <EdgeBandCell value={p.cubrecanto.inf} side="Bottom" onChange={v => store.updatePiece(p.id, { cubrecanto: { ...p.cubrecanto, inf: v } })} />
                      </td>
                      <td className="py-1.5 px-1 w-9 text-center">
                        <EdgeBandCell value={p.cubrecanto.izq} side="Left" onChange={v => store.updatePiece(p.id, { cubrecanto: { ...p.cubrecanto, izq: v } })} />
                      </td>
                      <td className="py-1.5 px-1 w-9 text-center">
                        <EdgeBandCell value={p.cubrecanto.der} side="Right" onChange={v => store.updatePiece(p.id, { cubrecanto: { ...p.cubrecanto, der: v } })} />
                      </td>
                      <td className="py-1.5 px-2">
                        <select value={p.material} onChange={e => store.updatePiece(p.id, { material: e.target.value })}
                          className="text-xs border border-transparent hover:border-slate-200/70 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded bg-transparent text-slate-600 cursor-pointer py-0.5 px-1 transition-colors">
                          {stockNames.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2">
                        <select value={p.area || ''} onChange={e => store.updatePiece(p.id, { area: e.target.value || undefined })}
                          className="text-xs border border-transparent hover:border-slate-200/70 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded bg-transparent text-slate-600 cursor-pointer py-0.5 px-1 transition-colors">
                          <option value="">—</option>
                          {store.areas.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2">
                        <button onClick={() => store.removePiece(p.id)}
                          className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            No parts added yet. Use the form above or import from CSV/Excel.
          </div>
        )}

        {/* Summary bar */}
        {store.pieces.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-2.5 bg-blue-50/30 border-t border-slate-100/60 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{store.pieces.length} part{store.pieces.length !== 1 ? 's' : ''}</span>
            <span>{(store.pieces.reduce((s, p) => s + p.ancho * p.alto * p.cantidad, 0) / 1e6).toFixed(2)} m²</span>
            {totalEB > 0 && <span className="text-amber-600">EB: {(totalEB / 1000).toFixed(2)} m</span>}
            <div className="flex-1" />
            <button onClick={() => store.clearPieces()} className="text-red-400 hover:text-red-600 text-sm flex items-center gap-1">
              <Trash2 className="h-3.5 w-3.5" />Clear all
            </button>
          </div>
        )}
      </Section>

      </div>{/* end MAIN CONTENT */}
    </div>
  );
}
