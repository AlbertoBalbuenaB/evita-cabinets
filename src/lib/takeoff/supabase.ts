// Supabase adapter for Evita Takeoff — sessions + comments live here so the store stays
// focused on pure state transitions. Components call these helpers directly; the store
// only holds the resulting UI state (currentSessionId, sessionName, sessionProjectId).

import { supabase } from '../supabase';
import type { Json } from '../database.types';
import type { SessionData } from './types';

const BUCKET = 'takeoffs';

// ── Comment types ────────────────────────────────────────────

export interface TakeoffComment {
  id: string;
  sessionId: string;
  parentCommentId: string | null;   // null ⇒ root (has a pin anchored on the PDF)
  authorId: string;
  authorName: string | null;
  text: string;
  positionX: number | null;         // PDF-space, only on root
  positionY: number | null;
  page: number | null;              // only on root
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

type CommentRowWithAuthor = {
  id: string;
  session_id: string;
  parent_comment_id: string | null;
  author_id: string;
  text: string;
  position_x: number | null;
  position_y: number | null;
  page: number | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  author?: { name: string | null } | { name: string | null }[] | null;
};

function rowToComment(r: CommentRowWithAuthor): TakeoffComment {
  const author = r.author;
  let authorName: string | null = null;
  if (Array.isArray(author)) authorName = author[0]?.name ?? null;
  else if (author) authorName = (author as { name: string | null }).name ?? null;
  return {
    id: r.id,
    sessionId: r.session_id,
    parentCommentId: r.parent_comment_id,
    authorId: r.author_id,
    authorName,
    text: r.text,
    positionX: r.position_x,
    positionY: r.position_y,
    page: r.page,
    resolved: r.resolved,
    resolvedBy: r.resolved_by,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
  };
}

export interface TakeoffSessionRow {
  id: string;
  name: string;
  project_id: string | null;
  pdf_storage_path: string;
  pdf_filename: string;
  session_data: SessionData;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TakeoffSessionListItem {
  id: string;
  name: string;
  projectId: string | null;
  projectName: string | null;
  pdfFilename: string;
  createdById: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Auth helper ──────────────────────────────────────────────

export async function getCurrentTeamMemberId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('team_members')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();
  return data?.id ?? null;
}

// ── Session I/O ─────────────────────────────────────────────

export interface SaveSessionParams {
  name: string;
  projectId: string | null;
  sessionData: SessionData;
  // Only required when creating a new session. Updates keep the original PDF.
  file?: File | null;
  // If set, update this session instead of inserting a new row.
  existingSessionId?: string | null;
}

export async function saveSessionToSupabase(params: SaveSessionParams): Promise<{ sessionId: string }> {
  const memberId = await getCurrentTeamMemberId();
  if (!memberId) throw new Error('Not authenticated as a team member.');

  const { name, projectId, sessionData, file, existingSessionId } = params;

  if (existingSessionId) {
    const { error } = await supabase
      .from('takeoff_sessions')
      .update({
        name,
        project_id: projectId,
        session_data: sessionData as unknown as Json,
        updated_by: memberId,
      })
      .eq('id', existingSessionId);
    if (error) throw new Error(`Save failed: ${error.message}`);
    return { sessionId: existingSessionId };
  }

  if (!file) throw new Error('PDF file is required when creating a new session.');

  const sessionId = crypto.randomUUID();
  const storagePath = `${sessionId}/${sanitizeFilename(file.name)}`;

  const upload = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (upload.error) throw new Error(`PDF upload failed: ${upload.error.message}`);

  const { error: insertError } = await supabase.from('takeoff_sessions').insert({
    id: sessionId,
    name,
    project_id: projectId,
    pdf_storage_path: storagePath,
    pdf_filename: file.name,
    session_data: sessionData as unknown as Json,
    created_by: memberId,
    updated_by: memberId,
  });

  if (insertError) {
    // Try to clean up the orphaned file so storage doesn't accumulate garbage.
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    throw new Error(`Session insert failed: ${insertError.message}`);
  }

  return { sessionId };
}

export async function loadSessionFromSupabase(
  sessionId: string,
): Promise<{ session: TakeoffSessionRow; file: File } | null> {
  const { data, error } = await supabase
    .from('takeoff_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (error || !data) return null;

  const session = data as unknown as TakeoffSessionRow;

  const { data: signed, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(session.pdf_storage_path, 3600);
  if (urlError || !signed?.signedUrl) {
    throw new Error(`Could not fetch PDF URL: ${urlError?.message ?? 'unknown'}`);
  }

  const resp = await fetch(signed.signedUrl);
  if (!resp.ok) throw new Error(`PDF download failed (HTTP ${resp.status}).`);
  const blob = await resp.blob();
  const file = new File([blob], session.pdf_filename, { type: blob.type || 'application/pdf' });

  return { session, file };
}

export async function listTakeoffSessions(params: { projectId?: string | null } = {}): Promise<TakeoffSessionListItem[]> {
  let query = supabase
    .from('takeoff_sessions')
    .select(`
      id, name, project_id, pdf_filename, created_by, created_at, updated_at,
      projects:project_id ( name ),
      creator:created_by ( name )
    `)
    .order('updated_at', { ascending: false });

  if (params.projectId === null) {
    query = query.is('project_id', null);
  } else if (typeof params.projectId === 'string') {
    query = query.eq('project_id', params.projectId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`List sessions failed: ${error.message}`);

  return (data ?? []).map((r) => {
    // Supabase returns embedded joins as either objects or arrays depending on the FK setup.
    const projectsVal = r.projects as unknown;
    const creatorVal = r.creator as unknown;
    const projectName = extractJoinedField<string>(projectsVal, 'name');
    const createdByName = extractJoinedField<string>(creatorVal, 'name');

    return {
      id: r.id as string,
      name: r.name as string,
      projectId: r.project_id as string | null,
      projectName,
      pdfFilename: r.pdf_filename as string,
      createdById: r.created_by as string,
      createdByName,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    };
  });
}

export async function deleteTakeoffSession(sessionId: string): Promise<void> {
  // Grab the storage path first so we can clean the blob after the row is gone.
  const { data: sessionRow } = await supabase
    .from('takeoff_sessions')
    .select('pdf_storage_path')
    .eq('id', sessionId)
    .single();

  const { error } = await supabase.from('takeoff_sessions').delete().eq('id', sessionId);
  if (error) throw new Error(`Delete failed: ${error.message}`);

  if (sessionRow?.pdf_storage_path) {
    await supabase.storage.from(BUCKET).remove([sessionRow.pdf_storage_path]).catch(() => {});
  }
}

// ── Helpers ──────────────────────────────────────────────────

// ── Comments ────────────────────────────────────────────────

export async function listCommentsForSession(sessionId: string): Promise<TakeoffComment[]> {
  const { data, error } = await supabase
    .from('takeoff_comments')
    .select(`
      id, session_id, parent_comment_id, author_id, text,
      position_x, position_y, page,
      resolved, resolved_by, resolved_at, created_at,
      author:author_id ( name )
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Load comments failed: ${error.message}`);
  return (data ?? []).map((r) => rowToComment(r as unknown as CommentRowWithAuthor));
}

export async function addRootCommentToSupabase(params: {
  sessionId: string;
  text: string;
  positionX: number;
  positionY: number;
  page: number;
}): Promise<TakeoffComment> {
  const memberId = await getCurrentTeamMemberId();
  if (!memberId) throw new Error('Not authenticated as a team member.');
  const { data, error } = await supabase
    .from('takeoff_comments')
    .insert({
      session_id: params.sessionId,
      parent_comment_id: null,
      author_id: memberId,
      text: params.text,
      position_x: params.positionX,
      position_y: params.positionY,
      page: params.page,
    })
    .select(`
      id, session_id, parent_comment_id, author_id, text,
      position_x, position_y, page,
      resolved, resolved_by, resolved_at, created_at,
      author:author_id ( name )
    `)
    .single();
  if (error || !data) throw new Error(`Add comment failed: ${error?.message ?? 'unknown'}`);
  return rowToComment(data as unknown as CommentRowWithAuthor);
}

export async function addReplyToSupabase(params: {
  sessionId: string;
  parentCommentId: string;
  text: string;
}): Promise<TakeoffComment> {
  const memberId = await getCurrentTeamMemberId();
  if (!memberId) throw new Error('Not authenticated as a team member.');
  const { data, error } = await supabase
    .from('takeoff_comments')
    .insert({
      session_id: params.sessionId,
      parent_comment_id: params.parentCommentId,
      author_id: memberId,
      text: params.text,
      // Replies inherit location from the root; column stays NULL.
      position_x: null,
      position_y: null,
      page: null,
    })
    .select(`
      id, session_id, parent_comment_id, author_id, text,
      position_x, position_y, page,
      resolved, resolved_by, resolved_at, created_at,
      author:author_id ( name )
    `)
    .single();
  if (error || !data) throw new Error(`Reply failed: ${error?.message ?? 'unknown'}`);
  return rowToComment(data as unknown as CommentRowWithAuthor);
}

export async function setCommentResolved(commentId: string, resolved: boolean): Promise<TakeoffComment> {
  const memberId = await getCurrentTeamMemberId();
  if (!memberId) throw new Error('Not authenticated as a team member.');
  const { data, error } = await supabase
    .from('takeoff_comments')
    .update({
      resolved,
      resolved_by: resolved ? memberId : null,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq('id', commentId)
    .select(`
      id, session_id, parent_comment_id, author_id, text,
      position_x, position_y, page,
      resolved, resolved_by, resolved_at, created_at,
      author:author_id ( name )
    `)
    .single();
  if (error || !data) throw new Error(`Resolve failed: ${error?.message ?? 'unknown'}`);
  return rowToComment(data as unknown as CommentRowWithAuthor);
}

export async function deleteCommentFromSupabase(commentId: string): Promise<void> {
  const { error } = await supabase.from('takeoff_comments').delete().eq('id', commentId);
  if (error) throw new Error(`Delete comment failed: ${error.message}`);
}

// ── Helpers ──────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  // Storage path is URL-like; strip anything that might trip routing.
  return name.replace(/[^\w.\-]+/g, '_').slice(0, 200) || 'file.pdf';
}

function extractJoinedField<T>(value: unknown, field: string): T | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value[0] as Record<string, unknown> | undefined;
    return (first?.[field] as T) ?? null;
  }
  if (typeof value === 'object') {
    return ((value as Record<string, unknown>)[field] as T) ?? null;
  }
  return null;
}
