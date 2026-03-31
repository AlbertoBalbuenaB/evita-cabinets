import { useRef, useEffect } from 'react';
import { BoardResult, UnitSystem } from '../../lib/optimizer/types';
import { renderBoardThumbnail } from '../../lib/optimizer/engine';

interface Props {
  board: BoardResult;
  maxW?: number;
  maxH?: number;
  unit?: UnitSystem;
  onClick?: () => void;
  className?: string;
}

export function BoardCanvas({ board, maxW = 320, maxH = 200, unit = 'mm', onClick, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderBoardThumbnail(ref.current, board, { maxW, maxH, unit });
  }, [board, maxW, maxH, unit]);
  return (
    <canvas
      ref={ref}
      onClick={onClick}
      className={`block ${onClick ? 'cursor-pointer' : ''} ${className ?? ''}`}
    />
  );
}
