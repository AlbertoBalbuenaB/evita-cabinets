import { useState } from 'react';
import { ChevronRight, LayoutDashboard, Pencil } from 'lucide-react';
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

  const NO_AREA_KEY = '(no area)';

  // Two-level grouping: areaName → (cabinetId → pieces). Pieces without an
  // areaName/cabinetId fall into the NO_AREA_KEY / '__unassigned__' buckets
  // (defensive — shouldn't happen with a well-formed quotation).
  const byArea = new Map<string, Map<string, Pieza[]>>();
  for (const p of pieces) {
    const cabinetId = p.cabinetId ?? '__unassigned__';
    const areaName = cabinetDetails[cabinetId]?.areaName?.trim() || NO_AREA_KEY;
    let cabinets = byArea.get(areaName);
    if (!cabinets) {
      cabinets = new Map<string, Pieza[]>();
      byArea.set(areaName, cabinets);
    }
    const arr = cabinets.get(cabinetId);
    if (arr) arr.push(p);
    else cabinets.set(cabinetId, [p]);
  }

  // Sort areas alphabetically, with NO_AREA_KEY last.
  const orderedAreas = Array.from(byArea.entries()).sort(([a], [b]) => {
    if (a === NO_AREA_KEY) return 1;
    if (b === NO_AREA_KEY) return -1;
    return a.localeCompare(b);
  });

  // Within each area, sort cabinets by productSku → description for stable UI.
  const orderedAreasWithCabinets = orderedAreas.map(([areaName, cabinets]) => {
    const sortedCabinets = Array.from(cabinets.entries()).sort(([aId], [bId]) => {
      const a = cabinetDetails[aId];
      const b = cabinetDetails[bId];
      const aLabel = `${a?.productSku ?? 'zzz'}|${a?.productDescription ?? ''}`;
      const bLabel = `${b?.productSku ?? 'zzz'}|${b?.productDescription ?? ''}`;
      return aLabel.localeCompare(bLabel);
    });
    return [areaName, sortedCabinets] as const;
  });

  const totalCabinets = orderedAreasWithCabinets.reduce((sum, [, cabs]) => sum + cabs.length, 0);
  const totalAreas = orderedAreasWithCabinets.length;

  // Open by default if 3 or fewer cabinets total — preserves the prior UX.
  const defaultOpen = totalCabinets <= 3;

  return (
    <div className="rounded-lg border border-border-soft bg-surf-card">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border-soft">
        <LayoutDashboard className="h-3.5 w-3.5 text-accent-text" />
        <h3 className="text-xs font-semibold text-fg-800 uppercase tracking-wide">
          Cut-list detail — {totalCabinets} cabinet{totalCabinets !== 1 ? 's' : ''} across {totalAreas} area{totalAreas !== 1 ? 's' : ''}
        </h3>
      </div>
      <div>
        {orderedAreasWithCabinets.map(([areaName, areaCabinets], areaIdx) => {
          const areaPieceCount = areaCabinets.reduce(
            (sum, [, cabPieces]) => sum + cabPieces.reduce((s, p) => s + p.cantidad, 0),
            0,
          );
          return (
            <details
              key={areaName}
              className={`group ${areaIdx > 0 ? 'border-t-2 border-border-soft' : ''}`}
            >
              <summary className="flex items-center justify-between gap-2 px-3 py-1.5 bg-surf-muted border-b border-border-soft cursor-pointer select-none hover:bg-surf-muted">
                <span className="flex items-center gap-1.5 min-w-0">
                  <ChevronRight className="h-3 w-3 text-fg-500 shrink-0 transition-transform group-open:rotate-90" />
                  <span className="text-[11px] font-semibold text-fg-700 uppercase tracking-wide truncate">
                    {areaName}
                  </span>
                </span>
                <span className="text-[10px] text-fg-500 font-mono tabular-nums shrink-0">
                  {areaCabinets.length} cab · {areaPieceCount} piece{areaPieceCount !== 1 ? 's' : ''}
                </span>
              </summary>
              <div className="divide-y divide-slate-100">
                {areaCabinets.map(([cabinetId, groupPieces]) => {
          const info = cabinetDetails[cabinetId];
          const pieceCount = groupPieces.reduce((s, p) => s + p.cantidad, 0);
          const label = info
            ? [
                info.productSku ?? '(no SKU)',
                info.productDescription,
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
              <summary className="cursor-pointer select-none px-3 py-2 hover:bg-surf-app text-xs flex items-center justify-between gap-2">
                <span className="font-medium text-fg-800 truncate flex items-center gap-2">
                  <span className="truncate">{label}{qtySuffix}</span>
                  {info?.hasOverride && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-status-amber-bg text-amber-800 shrink-0">
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
                  <span className="text-fg-400 font-mono tabular-nums">
                    {pieceCount} piece{pieceCount !== 1 ? 's' : ''}
                  </span>
                </span>
              </summary>
              <div className="px-3 pb-3 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-fg-500 border-b border-border-soft">
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
                          <td className="px-2 py-1 text-fg-800 truncate max-w-[10rem]" title={p.nombre}>
                            {p.nombre}
                          </td>
                          <td className="px-2 py-1">
                            <RoleBadge role={p.cutPieceRole} />
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums text-fg-700">
                            {p.ancho} × {p.alto}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums text-fg-500">
                            {p.grosor}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums font-semibold text-fg-800">
                            {p.cantidad}
                          </td>
                          <td className="px-2 py-1 text-center">
                            {ebSides ? (
                              <span className="font-mono text-[10px] text-fg-600 bg-surf-muted px-1 rounded">
                                {ebSides}
                              </span>
                            ) : (
                              <span className="text-fg-300">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-fg-500 truncate max-w-[12rem]" title={p.material}>
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
    cuerpo:     { bg: 'bg-accent-tint-soft',    text: 'text-blue-800',    label: 'Box'        },
    frente:     { bg: 'bg-status-amber-bg',   text: 'text-amber-800',   label: 'Door'       },
    back:       { bg: 'bg-status-emerald-bg', text: 'text-emerald-800', label: 'Back'       },
    drawer_box: { bg: 'bg-teal-100',    text: 'text-teal-800',    label: 'Drawer Box' },
    shelf:      { bg: 'bg-accent-tint-soft',  text: 'text-violet-800',  label: 'Shelf'      },
    custom:     { bg: 'bg-surf-muted',   text: 'text-fg-700',   label: 'Custom'     },
  };
  const key = role ?? 'custom';
  const cfg = styles[key] ?? styles.custom;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}
