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
// Extract plain text from TipTap JSON document
// ---------------------------------------------------------------------------

export function extractPlainText(doc: unknown, maxLen = 150): string {
  const parts: string[] = [];

  function traverse(node: any) {
    if (!node) return;
    if (node.type === 'text' && node.text) parts.push(node.text);
    if (node.type === 'mention' && node.attrs?.label) parts.push(`@${node.attrs.label}`);
    if (Array.isArray(node.content)) node.content.forEach(traverse);
  }

  if (typeof doc === 'string') {
    try { traverse(JSON.parse(doc)); } catch { return doc.slice(0, maxLen); }
  } else {
    traverse(doc);
  }

  const text = parts.join('').trim();
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
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
  projectName?: string | null;
  referenceType: string;
  referenceId: string;
}

export async function createNotifications(params: CreateNotificationsParams) {
  const { recipientIds, actorId, actorName, type, title, body, projectId, projectName, referenceType, referenceId } = params;

  // Deduplicate recipients
  const unique = [...new Set(recipientIds)];
  if (!unique.length) return;

  // Look up project name if not provided
  let resolvedProjectName = projectName ?? null;
  if (!resolvedProjectName && projectId) {
    const { data: proj } = await supabase.from('projects').select('name').eq('id', projectId).single();
    resolvedProjectName = proj?.name ?? null;
  }

  const rows = unique.map((recipientId) => ({
    recipient_id: recipientId,
    actor_id: actorId,
    actor_name: actorName,
    type,
    title,
    body: body ? body.slice(0, 200) : null,
    project_id: projectId,
    project_name: resolvedProjectName,
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
