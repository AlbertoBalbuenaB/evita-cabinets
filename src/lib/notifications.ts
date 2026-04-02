import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Extract mention IDs from TipTap JSON document
// ---------------------------------------------------------------------------

interface MentionIds {
  memberIds: string[];
  departmentIds: string[];
}

export function extractMentionIds(doc: unknown): MentionIds {
  const memberIds = new Set<string>();
  const departmentIds = new Set<string>();

  function traverse(node: any) {
    if (!node) return;
    if (node.type === 'mention' && node.attrs?.id) {
      const raw: string = node.attrs.id;
      if (raw.startsWith('team_member:')) {
        memberIds.add(raw.replace('team_member:', ''));
      } else if (raw.startsWith('department:')) {
        departmentIds.add(raw.replace('department:', ''));
      } else if (raw.startsWith('dept:')) {
        // TaskComments uses dept:{id} prefix
        departmentIds.add(raw.replace('dept:', ''));
      }
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  }

  if (typeof doc === 'string') {
    try { traverse(JSON.parse(doc)); } catch { /* not JSON */ }
  } else {
    traverse(doc);
  }

  return { memberIds: [...memberIds], departmentIds: [...departmentIds] };
}

// ---------------------------------------------------------------------------
// Resolve department → member IDs
// ---------------------------------------------------------------------------

export async function resolveDepartmentMembers(departmentIds: string[]): Promise<string[]> {
  if (!departmentIds.length) return [];
  const { data } = await supabase
    .from('team_members')
    .select('id')
    .in('department_id', departmentIds)
    .eq('is_active', true);
  return (data || []).map((m) => m.id);
}

// ---------------------------------------------------------------------------
// Create notifications in batch
// ---------------------------------------------------------------------------

interface CreateNotificationsParams {
  recipientIds: string[];
  actorId: string | null;
  actorName: string | null;
  type: string;
  title: string;
  body?: string | null;
  projectId: string | null;
  referenceType: string;
  referenceId: string;
}

export async function createNotifications(params: CreateNotificationsParams) {
  const { recipientIds, actorId, actorName, type, title, body, projectId, referenceType, referenceId } = params;

  // Deduplicate and exclude the actor (don't notify yourself)
  const unique = [...new Set(recipientIds)].filter((id) => id !== actorId);
  if (!unique.length) return;

  const rows = unique.map((recipientId) => ({
    recipient_id: recipientId,
    actor_id: actorId,
    actor_name: actorName,
    type,
    title,
    body: body ? body.slice(0, 200) : null,
    project_id: projectId,
    reference_type: referenceType,
    reference_id: referenceId,
  }));

  try {
    await supabase.from('notifications').insert(rows);
  } catch (err) {
    console.error('Error creating notifications:', err);
  }
}

// ---------------------------------------------------------------------------
// Helper: extract mentions and create notifications in one call
// ---------------------------------------------------------------------------

interface NotifyMentionsParams {
  content: unknown; // TipTap JSON doc or string
  actorId: string | null;
  actorName: string | null;
  type: string;
  title: string;
  body?: string | null;
  projectId: string | null;
  referenceType: string;
  referenceId: string;
}

export async function notifyMentions(params: NotifyMentionsParams) {
  const { content, ...rest } = params;
  const { memberIds, departmentIds } = extractMentionIds(content);
  const deptMemberIds = await resolveDepartmentMembers(departmentIds);
  const allRecipients = [...memberIds, ...deptMemberIds];
  if (!allRecipients.length) return;
  await createNotifications({ ...rest, recipientIds: allRecipients });
}
