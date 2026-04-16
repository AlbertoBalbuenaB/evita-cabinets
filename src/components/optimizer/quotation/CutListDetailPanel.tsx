import { useState } from 'react';
import { LayoutDashboard, Pencil } from 'lucide-react';
import type { Pieza } from '../../../lib/optimizer/types';
import type { CutPiece } from '../../../types';
import { Button } from '../../Button';
import { CutListEditorModal } from './CutListEditorModal';

export interface CabinetDisplayInfo {
  productSku: string | null;
  productDescription: string | null;
  quantity: number;
  areaId: string;
  areaName: string;
  /** Optional for backwards compatibility with snapshots saved before the
   *  editable-cut-list feature. Undefined ≡ no override. */
  hasOverride?: boolean;
}

interface Props {
  pieces: Pieza[];
  cabinetDetails: Record<string, CabinetDisplayInfo>;
  /** Called after the user saves or resets a cut-list override, so the parent
   *  can re-run "Build from Quotation" to refresh the panel. */
  onOverrideChanged?: () => void | Promise<void>;
}

/**
 * Read-only audit view of the cut list that the quotation builder
 * generated. Groups pieces by cabinetId and shows one collapsible
 * section per cabinet with a compact table:
 *
 *   Name | Role badge | W × H | Thickness | Qty | Edge banding | Material
 *
 * The user uses this to verify the despiece is correct before trusting
 * the optimizer output. There is no editing — if something is wrong,
 * the user fixes it on the product template and clicks Rebuild.
 */
export function CutListDetailPanel({ pieces, cabinetDetails, onOverrideChanged }: Props) {
  const [editing, setEditing] = useState<{
    cabinetId: string;
    label: string;
    pieces: CutPiece[];
    hasOverride: boolean;
  } | null>(null);

  if (pieces.length === 0) return null;

  // Group pieces by cabinetId. Pieces without a cabinetId fall into
  // a single "Unassigned" bucket (shouldn't happen in practice, but
  // defensive coding).
  const groups = new Map<string, Pieza[]>();
  for (const p of pieces) {
    const key = p.cabinetId ?? '__unassigned__';
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }

  // Order groups by area name, then by productSku, then by description, so
  // the UI is stable across rebuilds.
  const orderedGroups = Array.from(groups.entries()).sort(([aId], [bId]) => {
    const a = cabinetDetails[aId];
    const b = cabinetDetails[bId];
    const aLabel = `${a?.areaName ?? 'zzz'}|${a?.productSku ?? 'zzz'}|${a?.productDescription ?? ''}`;
    const bLabel = `${b?.areaName ?? 'zzz'}|${b?.productSku ?? 'zzz'}|${b?.productDescription ?? ''}`;
    return aLabel.localeCompare(bLabel);
  });

  // Open by default if 3 or fewer cabinet groups.
  const defaultOpen = orderedGroups.length <= 3;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200">
        <LayoutDashboard className="h-3.5 w-3.5 text-blue-600" />
        <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
          Cut-list detail — {orderedGroups.length} cabinet{orderedGroups.length !== 1 ? 's' : ''}
        </h3>
      </div>
      <div className="divide-y divide-slate-100">
        {orderedGroups.map(([cabinetId, groupPieces]) => {
          const info = cabinetDetails[cabinetId];
          const pieceCount = groupPieces.reduce((s, p) => s + p.cantidad, 0);
          const label = info
            ? [
                info.productSku ?? '(no SKU)',
                info.productDescription,
                info.areaName,
              ].filter((s): s is string => !!s && s.length > 0).join(' — ')
            : `Cabinet ${cabinetId.slice(0, 8)}…`;
          const qtySuffix = info && info.quantity > 1 ? ` ×${info.quantity}` : '';
          const cabinetQty = info?.quantity && info.quantity > 0 ? info.quantity : 1;
          const editablePieces: CutPiece[] = groupPieces.map((p) => ({
            id: p.sourceCutPieceId ?? crypto.randomUUID(),
            nombre: p.nombre,
            ancho: p.ancho,
            alto: p.alto,
            // Pieza.cantidad already includes the cabinet quantity multiplier;
            // divide back out so the modal shows per-cabinet-instance counts.
            cantidad: Math.max(1, Math.round(p.cantidad / cabinetQty)),
            material: pieceRoleToMaterial(p.cutPieceRole),
            cubrecanto: p.cubrecanto,
            veta: p.veta,
          }));
          return (
            <details key={cabinetId} open={defaultOpen}>
              <summary className="cursor-pointer select-none px-3 py-2 hover:bg-slate-50 text-xs flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800 truncate flex items-center gap-2">
                  <span className="truncate">{label}{qtySuffix}</span>
                  {info?.hasOverride && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 shrink-0">
                      Modified
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!px-2 !py-1 text-[11px]"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditing({
                        cabinetId,
                        label: label,
                        pieces: editablePieces,
                        hasOverride: !!info?.hasOverride,
                      });
                    }}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <span className="text-slate-400 font-mono tabular-nums">
                    {pieceCount} piece{pieceCount !== 1 ? 's' : ''}
                  </span>
                </span>
              </summary>
              <div className="px-3 pb-3 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-100">
                      <th className="text-left  px-2 py-1 font-medium">Name</th>
                      <th className="text-left  px-2 py-1 font-medium">Role</th>
                      <th className="text-right px-2 py-1 font-medium">W × H (mm)</th>
                      <th className="text-right px-2 py-1 font-medium">Thick</th>
                      <th className="text-right px-2 py-1 font-medium">Qty</th>
                      <th className="text-center px-2 py-1 font-medium">EB</th>
                      <th className="text-left  px-2 py-1 font-medium">Material</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupPieces.map((p) => {
                      const ebSides = (['sup', 'inf', 'izq', 'der'] as const)
                        .filter((s) => (p.cubrecanto?.[s] ?? 0) > 0)
                        .map((s) => ({ sup: 'T', inf: 'B', izq: 'L', der: 'R' }[s]))
                        .join('');
                      return (
                        <tr key={p.id} className="border-b border-slate-50 last:border-b-0">
                          <td className="px-2 py-1 text-slate-800 truncate max-w-[10rem]" title={p.nombre}>
                            {p.nombre}
                          </td>
                          <td className="px-2 py-1">
                            <RoleBadge role={p.cutPieceRole} />
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums text-slate-700">
                            {p.ancho} × {p.alto}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums text-slate-500">
                            {p.grosor}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums font-semibold text-slate-800">
                            {p.cantidad}
                          </td>
                          <td className="px-2 py-1 text-center">
                            {ebSides ? (
                              <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1 rounded">
                                {ebSides}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-slate-500 truncate max-w-[12rem]" title={p.material}>
                            {p.material}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>
      {editing && (
        <CutListEditorModal
          isOpen
          onClose={() => setEditing(null)}
          cabinetId={editing.cabinetId}
          cabinetLabel={editing.label}
          initialPieces={editing.pieces}
          hasOverride={editing.hasOverride}
          onSaved={async () => {
            await onOverrideChanged?.();
          }}
        />
      )}
    </div>
  );
}

/** Map a Pieza.cutPieceRole to the CutPiece.material enum. The optimizer uses
 *  an extra 'interior-finish' role that does not exist on the catalog template;
 *  collapse it to 'custom' for the editor. */
function pieceRoleToMaterial(role: Pieza['cutPieceRole']): CutPiece['material'] {
  switch (role) {
    case 'cuerpo':
    case 'frente':
    case 'back':
    case 'drawer_box':
    case 'shelf':
    case 'custom':
      return role;
    default:
      return 'custom';
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Pieza['cutPieceRole'] }) {
  // Mirrors the tint convention from ProductFormModal and ProductItem so
  // the visual language is consistent across cut-list surfaces.
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    cuerpo:     { bg: 'bg-blue-100',    text: 'text-blue-800',    label: 'Box'        },
    frente:     { bg: 'bg-amber-100',   text: 'text-amber-800',   label: 'Door'       },
    back:       { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Back'       },
    drawer_box: { bg: 'bg-teal-100',    text: 'text-teal-800',    label: 'Drawer Box' },
    shelf:      { bg: 'bg-violet-100',  text: 'text-violet-800',  label: 'Shelf'      },
    custom:     { bg: 'bg-slate-100',   text: 'text-slate-700',   label: 'Custom'     },
  };
  const key = role ?? 'custom';
  const cfg = styles[key] ?? styles.custom;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}
