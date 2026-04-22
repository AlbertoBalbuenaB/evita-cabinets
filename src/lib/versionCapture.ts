import { supabase } from './supabase';

/**
 * Version history v2 — client-side helpers.
 *
 * The Postgres side is in `supabase/migrations/20260422170000_version_history_v2_foundations.sql`.
 * Three RPCs are exposed:
 *   - capture_project_version_v2  — atomic snapshot + version row, fire-and-forget safe
 *   - restore_project_version     — transactional wipe + re-insert + safety snapshot
 *   - prune_auto_versions         — retention job (Phase 3 will schedule it)
 *
 * Phase 0 only ships the helpers. Phase 1 wires them into every mutation site
 * in `ProjectDetails.tsx` + `CabinetForm.tsx` + the `evita-ia` edge function.
 */

/** Master switch for the whole feature. Flip to `false` to disable capture globally. */
export const VERSION_HISTORY_ENABLED = true;

export type CaptureSource = 'client' | 'ai' | 'system';

export interface CaptureAction {
  /** Short machine code, e.g. `'cabinet.create'`, `'area.duplicate'`, `'ai.update_cabinet_material'`. */
  code: string;
  /** Human summary shown in the history timeline. */
  summary: string;
  /** Who triggered the capture. Defaults to `'client'`. */
  source?: CaptureSource;
  /** Team member who performed the action. Pass from `useCurrentMember().member?.id`. */
  actorMemberId?: string | null;
  /** Supabase auth user id. When omitted, the RPC falls back to `auth.uid()`. */
  actorUserId?: string | null;
}

export interface RestoreResult {
  restoredFromVersionId: string;
  safetyVersionId: string;
  restoreMarkerId: string;
}

/**
 * Wraps any mutation with a post-mutation snapshot capture.
 *
 * The mutation runs first; the snapshot is fired-and-forgotten afterward so
 * history never slows down the user's edit. Capture failures are logged only —
 * the mutation's result is always returned.
 *
 * Usage:
 *   const updated = await captureMutation(
 *     projectId,
 *     { code: 'cabinet.create', summary: `Added ${sku} to ${areaName}`, actorMemberId: member?.id },
 *     () => supabase.from('area_cabinets').insert(payload).select().single()
 *   );
 */
export async function captureMutation<T>(
  projectId: string,
  action: CaptureAction,
  fn: () => Promise<T>,
): Promise<T> {
  const result = await fn();

  if (!VERSION_HISTORY_ENABLED || !projectId) return result;

  void supabase
    .rpc('capture_project_version_v2', {
      p_project_id: projectId,
      p_action_code: action.code,
      p_summary: action.summary,
      p_source: action.source ?? 'client',
      p_actor_member_id: action.actorMemberId ?? undefined,
      p_actor_user_id: action.actorUserId ?? undefined,
    })
    .then(({ error }) => {
      if (error) {
        console.warn('[versionCapture] capture failed', {
          code: action.code,
          projectId,
          message: error.message,
        });
      }
    });

  return result;
}

/**
 * Explicit named snapshot — awaited, surfaces errors. Used by the "Save version"
 * button in the History Drawer (Phase 3).
 */
export async function saveNamedVersion(params: {
  projectId: string;
  versionName: string;
  notes?: string | null;
  actorMemberId?: string | null;
  actorUserId?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('capture_project_version_v2', {
    p_project_id: params.projectId,
    p_action_code: 'manual.named_save',
    p_summary: params.versionName,
    p_version_type: 'manual_snapshot',
    p_source: 'client',
    p_actor_member_id: params.actorMemberId ?? undefined,
    p_actor_user_id: params.actorUserId ?? undefined,
    p_is_named: true,
    p_version_name: params.versionName,
    p_notes: params.notes ?? undefined,
  });

  if (error) throw error;
  return data as string;
}

/**
 * Transactional restore. Wipes current children, re-inserts from the snapshot,
 * captures a safety snapshot beforehand so the UI can offer "undo this restore".
 */
export async function restoreProjectVersion(params: {
  versionId: string;
  actorMemberId?: string | null;
  actorUserId?: string | null;
}): Promise<RestoreResult> {
  const { data, error } = await supabase.rpc('restore_project_version', {
    p_version_id: params.versionId,
    p_actor_member_id: params.actorMemberId ?? undefined,
    p_actor_user_id: params.actorUserId ?? undefined,
  });

  if (error) throw error;

  const payload = data as {
    restored_from_version_id: string;
    safety_version_id: string;
    restore_marker_id: string;
  };

  return {
    restoredFromVersionId: payload.restored_from_version_id,
    safetyVersionId: payload.safety_version_id,
    restoreMarkerId: payload.restore_marker_id,
  };
}

/** Canonical action codes — keeps the timeline summary space tidy across the app. */
export const VERSION_ACTIONS = {
  cabinet: {
    create: 'cabinet.create',
    update: 'cabinet.update',
    delete: 'cabinet.delete',
    reorder: 'cabinet.reorder',
  },
  area: {
    create: 'area.create',
    update: 'area.update',
    delete: 'area.delete',
    duplicate: 'area.duplicate',
  },
  item: {
    create: 'item.create',
    update: 'item.update',
    delete: 'item.delete',
  },
  countertop: {
    create: 'countertop.create',
    update: 'countertop.update',
    delete: 'countertop.delete',
  },
  closetItem: {
    create: 'closet_item.create',
    update: 'closet_item.update',
    delete: 'closet_item.delete',
  },
  prefabItem: {
    create: 'prefab_item.create',
    update: 'prefab_item.update',
    delete: 'prefab_item.delete',
  },
  quotation: {
    headerSave: 'quotation.header_save',
    statusChange: 'quotation.status_change',
    pricingMethod: 'quotation.pricing_method',
    bulkPriceUpdate: 'quotation.bulk_price_update',
    bulkMaterialChange: 'quotation.bulk_material_change',
  },
  ai: {
    updateCabinetMaterial: 'ai.update_cabinet_material',
    updateCabinetQuantity: 'ai.update_cabinet_quantity',
    updateQuotationSettings: 'ai.update_quotation_settings',
    bulkUpdateHardware: 'ai.bulk_update_hardware',
    pricingMethodSwitch: 'ai.pricing_method_switch',
  },
} as const;
