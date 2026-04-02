import { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  side: 'left' | 'right';
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

export function ResizablePanel({
  side, defaultWidth, minWidth, maxWidth, collapsed, onToggle, children, className = '',
}: Props) {
  const [width, setWidth] = useState(defaultWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = side === 'left'
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      setWidth(Math.min(maxWidth, Math.max(minWidth, startW.current + delta)));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [side, minWidth, maxWidth]);

  if (collapsed) {
    return (
      <div className={`shrink-0 flex flex-col items-center ${side === 'left' ? 'border-r' : 'border-l'} border-slate-200 bg-white`}>
        <button
          onClick={onToggle}
          className="p-1.5 mt-2 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          title={side === 'left' ? 'Expand left panel' : 'Expand right panel'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {side === 'left'
              ? <><line x1="3" y1="3" x2="3" y2="13"/><polyline points="7,5 11,8 7,11"/></>
              : <><line x1="13" y1="3" x2="13" y2="13"/><polyline points="9,5 5,8 9,11"/></>}
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`shrink-0 flex ${className}`} style={{ width }}>
      {side === 'right' && (
        <div
          onMouseDown={onMouseDown}
          className="w-1 shrink-0 cursor-col-resize bg-slate-200 hover:bg-blue-400 active:bg-blue-500 transition-colors"
        />
      )}
      <div className={`flex-1 flex flex-col overflow-hidden ${side === 'left' ? 'border-r border-slate-200' : ''}`}>
        {/* Collapse button */}
        <div className="flex items-center justify-end px-1 py-0.5 bg-slate-50 border-b border-slate-100 shrink-0">
          <button
            onClick={onToggle}
            className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            title={side === 'left' ? 'Collapse left panel' : 'Collapse right panel'}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {side === 'left'
                ? <><line x1="13" y1="3" x2="13" y2="13"/><polyline points="9,5 5,8 9,11"/></>
                : <><line x1="3" y1="3" x2="3" y2="13"/><polyline points="7,5 11,8 7,11"/></>}
            </svg>
          </button>
        </div>
        {children}
      </div>
      {side === 'left' && (
        <div
          onMouseDown={onMouseDown}
          className="w-1 shrink-0 cursor-col-resize bg-slate-200 hover:bg-blue-400 active:bg-blue-500 transition-colors"
        />
      )}
    </div>
  );
}
