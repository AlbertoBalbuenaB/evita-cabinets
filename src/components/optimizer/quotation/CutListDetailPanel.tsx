import { LayoutDashboard } from 'lucide-react';
import type { Pieza } from '../../../lib/optimizer/types';

export interface CabinetDisplayInfo {
  productSku: string | null;
  productDescription: string | null;
  quantity: number;
  areaId: string;
  areaName: string;
}

interface Props {
  pieces: Pieza[];
  cabinetDetails: Record<string, CabinetDisplayInfo>;
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
export function CutListDetailPanel({ pieces, cabinetDetails }: Props) {
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
          return (
            <details key={cabinetId} open={defaultOpen}>
              <summary className="cursor-pointer select-none px-3 py-2 hover:bg-slate-50 text-xs flex items-center justify-between">
                <span className="font-medium text-slate-800 truncate">
                  {label}{qtySuffix}
                </span>
                <span className="text-slate-400 font-mono tabular-nums ml-2 shrink-0">
                  {pieceCount} piece{pieceCount !== 1 ? 's' : ''}
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Pieza['cutPieceRole'] }) {
  // Mirrors the tint convention from ProductFormModal and ProductItem so
  // the visual language is consistent across cut-list surfaces.
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    cuerpo: { bg: 'bg-blue-100',    text: 'text-blue-800',    label: 'Box'   },
    frente: { bg: 'bg-amber-100',   text: 'text-amber-800',   label: 'Door'  },
    back:   { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Back'  },
    custom: { bg: 'bg-slate-100',   text: 'text-slate-700',   label: 'Custom'},
  };
  const key = role ?? 'custom';
  const cfg = styles[key] ?? styles.custom;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}
