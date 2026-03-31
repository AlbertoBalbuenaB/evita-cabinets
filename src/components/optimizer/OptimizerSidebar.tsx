import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useOptimizerStore } from '../../hooks/useOptimizerStore';
import { toMM, fromMM, unitLabel } from '../../lib/optimizer/units';
import { Button } from '../Button';

function SidebarSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden">
      <div onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between px-4 py-2.5 cursor-pointer bg-slate-50 font-medium text-sm text-slate-700 hover:bg-slate-100 select-none">
        {title}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
      </div>
      {isOpen && <div className="px-4 pb-4 pt-2">{children}</div>}
    </div>
  );
}

const MATERIALS = ['Melamina', 'MDF', 'Triplay', 'Aglomerado', 'MDP', 'OSB'];

const inputCls = "w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelCls = "block text-xs font-medium text-slate-600 mb-1";

export function OptimizerSidebar() {
  const store = useOptimizerStore();
  const unit = store.unit;

  // Stock form — values stored internally in mm
  const [stNombre, setStNombre] = useState('');
  const [stAncho, setStAncho] = useState(2440);  // mm
  const [stAlto, setStAlto] = useState(1220);    // mm
  const [stCosto, setStCosto] = useState(450);
  const [stSierra, setStSierra] = useState(3.2);

  // Remnant form
  const [remMat, setRemMat] = useState('Melamina');
  const [remGrosor, setRemGrosor] = useState(18);
  const [remAncho, setRemAncho] = useState(800);   // mm
  const [remAlto, setRemAlto] = useState(600);     // mm

  // Piece form
  const [pMat, setPMat] = useState('Melamina');
  const [pGrosor, setPGrosor] = useState(18);
  const [pAncho, setPAncho] = useState(0);
  const [pAlto, setPAlto] = useState(0);
  const [pCant, setPCant] = useState(1);
  const [pNombre, setPNombre] = useState('');
  const [pVeta, setPVeta] = useState(false);
  const [pCb, setPCb] = useState({ sup: false, inf: false, izq: false, der: false });

  const handleAddStock = () => {
    if (!stNombre.trim() || stAncho <= 0 || stAlto <= 0) { alert('Completa los campos del tablero'); return; }
    store.addStock({ nombre: stNombre, ancho: stAncho, alto: stAlto, costo: stCosto, sierra: stSierra });
    setStNombre('');
  };

  const handleAddPiece = () => {
    if (!pAncho || !pAlto) { alert('Ingresa las dimensiones de la pieza'); return; }
    store.addPiece({ nombre: pNombre, material: pMat, grosor: pGrosor, ancho: pAncho, alto: pAlto, cantidad: pCant, vetaHorizontal: pVeta, cubrecanto: pCb });
    setPAncho(0); setPAlto(0); setPCant(1); setPNombre(''); setPVeta(false); setPCb({ sup: false, inf: false, izq: false, der: false });
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 bg-slate-50">
      {/* Tableros */}
      <SidebarSection title="Tableros Disponibles">
        <div className="space-y-2">
          <div><label className={labelCls}>Nombre</label><input className={inputCls} value={stNombre} onChange={e => setStNombre(e.target.value)} placeholder="Ej: 4×8 pies" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Ancho ({unitLabel(unit)})</label><input type="number" step={unit === 'in' ? '0.001' : '1'} className={inputCls} value={parseFloat(fromMM(stAncho, unit).toFixed(3))} onChange={e => setStAncho(toMM(+e.target.value, unit))} /></div>
            <div><label className={labelCls}>Alto ({unitLabel(unit)})</label><input type="number" step={unit === 'in' ? '0.001' : '1'} className={inputCls} value={parseFloat(fromMM(stAlto, unit).toFixed(3))} onChange={e => setStAlto(toMM(+e.target.value, unit))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Costo ($)</label><input type="number" className={inputCls} value={stCosto} onChange={e => setStCosto(+e.target.value)} /></div>
            <div><label className={labelCls}>Sierra (mm)</label><input type="number" step="0.1" className={inputCls} value={stSierra} onChange={e => setStSierra(+e.target.value)} /></div>
          </div>
          <Button variant="primary" size="sm" onClick={handleAddStock} className="w-full">＋ Agregar</Button>
          {store.stocks.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-1">
              {store.stocks.map(s => (
                <div key={s.id} className="flex justify-between items-start py-1">
                  <div className="text-xs"><div className="font-medium text-slate-700">{s.nombre}</div><div className="text-slate-400">{parseFloat(fromMM(s.ancho, unit).toFixed(3))}×{parseFloat(fromMM(s.alto, unit).toFixed(3))}{unitLabel(unit)} | ${s.costo}</div></div>
                  <button onClick={() => store.removeStock(s.id)} className="text-slate-300 hover:text-red-500 ml-2 mt-0.5">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SidebarSection>

      {/* Global params */}
      <div className="bg-white rounded-lg border border-slate-200 mb-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>Sierra global (mm)</label><input type="number" step="0.1" className={inputCls} value={store.globalSierra} onChange={e => store.setGlobalSierra(+e.target.value)} /></div>
          <div><label className={labelCls}>Mín. retazo (mm)</label><input type="number" className={inputCls} value={store.minOffcut} onChange={e => store.setMinOffcut(+e.target.value)} /></div>
        </div>
        <div className="mt-2">
          <label className={labelCls}>
            Trim de bordes (mm)
            <span className="ml-1 text-slate-400 font-normal text-xs" title="Franja descartada en cada orilla de la hoja">ⓘ</span>
          </label>
          <input type="number" min={0} max={50} step={1} value={store.boardTrim} onChange={e => store.setBoardTrim(Math.max(0, parseFloat(e.target.value) || 0))} className={inputCls} placeholder="5" />
          <p className="text-xs text-slate-400 mt-1">Siempre en mm · por defecto 5mm</p>
        </div>
      </div>

      {/* Retazos */}
      <SidebarSection title="Retazos" defaultOpen={false}>
        <div className="space-y-2">
          <div><label className={labelCls}>Material</label><select className={inputCls} value={remMat} onChange={e => setRemMat(e.target.value)}>{MATERIALS.map(m => <option key={m}>{m}</option>)}</select></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelCls}>Grosor ({unitLabel(unit)})</label><input type="number" step={unit === 'in' ? '0.001' : '1'} className={inputCls} value={parseFloat(fromMM(remGrosor, unit).toFixed(3))} onChange={e => setRemGrosor(toMM(+e.target.value, unit))} /></div>
            <div><label className={labelCls}>Ancho ({unitLabel(unit)})</label><input type="number" step={unit === 'in' ? '0.001' : '1'} className={inputCls} value={parseFloat(fromMM(remAncho, unit).toFixed(3))} onChange={e => setRemAncho(toMM(+e.target.value, unit))} /></div>
            <div><label className={labelCls}>Alto ({unitLabel(unit)})</label><input type="number" step={unit === 'in' ? '0.001' : '1'} className={inputCls} value={parseFloat(fromMM(remAlto, unit).toFixed(3))} onChange={e => setRemAlto(toMM(+e.target.value, unit))} /></div>
          </div>
          <Button variant="primary" size="sm" onClick={() => { store.addRemnant({ material: remMat, grosor: remGrosor, ancho: remAncho, alto: remAlto }); }} className="w-full">＋ Agregar</Button>
          {store.remnants.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-1">
              {store.remnants.map(r => (
                <div key={r.id} className="flex justify-between items-center py-1">
                  <div className="text-xs text-slate-600">{r.material} • {parseFloat(fromMM(r.ancho, unit).toFixed(3))}×{parseFloat(fromMM(r.alto, unit).toFixed(3))}{unitLabel(unit)} • {parseFloat(fromMM(r.grosor, unit).toFixed(3))}{unitLabel(unit)}</div>
                  <button onClick={() => store.removeRemnant(r.id)} className="text-slate-300 hover:text-red-500 ml-2">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SidebarSection>

      {/* Agregar Pieza */}
      <SidebarSection title="Agregar Pieza">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Material</label><select className={inputCls} value={pMat} onChange={e => setPMat(e.target.value)}>{MATERIALS.map(m => <option key={m}>{m}</option>)}</select></div>
            <div><label className={labelCls}>Grosor ({unitLabel(unit)})</label><input type="number" step={unit === 'in' ? '0.001' : '1'} className={inputCls} value={parseFloat(fromMM(pGrosor, unit).toFixed(3))} onChange={e => setPGrosor(toMM(+e.target.value, unit))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelCls}>Ancho ({unitLabel(unit)})</label><input type="number" step={unit === 'in' ? '0.001' : '1'} className={inputCls} placeholder={unit === 'in' ? '23.622' : '600'} value={pAncho ? parseFloat(fromMM(pAncho, unit).toFixed(3)) : ''} onChange={e => setPAncho(toMM(+e.target.value, unit))} /></div>
            <div><label className={labelCls}>Alto ({unitLabel(unit)})</label><input type="number" step={unit === 'in' ? '0.001' : '1'} className={inputCls} placeholder={unit === 'in' ? '15.748' : '400'} value={pAlto ? parseFloat(fromMM(pAlto, unit).toFixed(3)) : ''} onChange={e => setPAlto(toMM(+e.target.value, unit))} /></div>
            <div><label className={labelCls}>Cant.</label><input type="number" min="1" className={inputCls} value={pCant} onChange={e => setPCant(+e.target.value)} /></div>
          </div>
          <div><label className={labelCls}>Nombre (opcional)</label><input className={inputCls} value={pNombre} onChange={e => setPNombre(e.target.value)} placeholder="Ej: Costado" /></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={pVeta} onChange={e => setPVeta(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600" />
            <span className="text-xs text-slate-600">Veta fija (no rotar)</span>
          </label>
          <div>
            <label className={labelCls}>Cubrecanto</label>
            <div className="flex gap-3">
              {(['sup','inf','izq','der'] as const).map(pos => (
                <label key={pos} className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={pCb[pos]} onChange={e => setPCb({ ...pCb, [pos]: e.target.checked })} className="w-3 h-3 rounded border-slate-300 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">{pos === 'sup' ? 'S' : pos === 'inf' ? 'I' : pos === 'izq' ? 'L' : 'R'}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="primary" size="sm" onClick={handleAddPiece} className="flex-1">＋ Agregar pieza</Button>
            <Button variant="danger" size="sm" onClick={() => { setPAncho(0); setPAlto(0); setPCant(1); setPNombre(''); setPVeta(false); setPCb({ sup: false, inf: false, izq: false, der: false }); }}>Limpiar</Button>
          </div>
        </div>
      </SidebarSection>
    </div>
  );
}
