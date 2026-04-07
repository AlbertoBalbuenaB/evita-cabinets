import { useEffect, useRef } from 'react';
import { X, User, Building2 } from 'lucide-react';
import type { ProjectPurchaseItemWithDetails } from '../../types';
import { PurchaseItemComments } from './PurchaseItemComments';

interface Props {
  item: ProjectPurchaseItemWithDetails;
  teamMembers: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  projectId: string;
  estelaId: string | null;
  onUpdate: (id: string, changes: Record<string, any>) => void;
  onClose: () => void;
}

export function PurchaseItemDetailPanel({
  item,
  teamMembers,
  suppliers,
  projectId,
  estelaId,
  onUpdate,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close on click outside panel
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  const assignedId = item.assigned_to_member_id ?? estelaId ?? '';

  return (
    // top: 56px = h-14, the height of the sticky navbar — panel sits flush below it
    <div
      className="fixed left-0 right-0 bottom-0 flex items-stretch justify-end"
      style={{ zIndex: 9999, top: 56 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden"
        style={{ animation: 'slideInRight 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-0.5">
              Purchase Item
            </p>
            <h2 className="text-sm font-semibold text-slate-800 truncate">
              {item.concept || 'Unnamed item'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Assigned + Provider */}
          <div className="px-5 py-4 border-b border-slate-100 space-y-4">
            {/* Assigned */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                <User className="h-3.5 w-3.5" />
                Assigned to
              </label>
              <select
                value={assignedId}
                onChange={(e) => onUpdate(item.id, { assigned_to_member_id: e.target.value || null })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
              >
                <option value="">— Unassigned —</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Provider */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Provider
              </label>
              <select
                value={item.supplier_id ?? ''}
                onChange={(e) => onUpdate(item.id, { supplier_id: e.target.value || null })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
              >
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Comments */}
          <div className="px-5 py-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Comments
            </h3>
            <PurchaseItemComments
              purchaseItemId={item.id}
              projectId={projectId}
              teamMembers={teamMembers as any}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
