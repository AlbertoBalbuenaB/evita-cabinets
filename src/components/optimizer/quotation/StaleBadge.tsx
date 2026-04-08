import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  onRerun?: () => void;
  size?: 'sm' | 'md';
}

/**
 * Orange pill shown in the Optimizer tab header when any
 * area_cabinet has been edited since the active optimizer run was saved.
 * Clicking it triggers a rebuild+re-run.
 */
export function StaleBadge({ onRerun, size = 'sm' }: Props) {
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const text    = size === 'sm' ? 'text-xs'     : 'text-sm';

  return (
    <button
      type="button"
      onClick={onRerun}
      disabled={!onRerun}
      className={`inline-flex items-center gap-1 ${padding} ${text} rounded-full bg-amber-100 text-amber-800 font-medium ${onRerun ? 'hover:bg-amber-200 transition-colors cursor-pointer' : 'cursor-default'}`}
      title="Cabinets have been edited since this run was saved. Click to re-run."
    >
      <AlertTriangle className="h-3 w-3" />
      <span>Stale — cabinets edited</span>
      {onRerun && <RefreshCw className="h-3 w-3 ml-0.5" />}
    </button>
  );
}
