import type { Database, Json } from '../database.types';

export type KbCategory       = Database['public']['Tables']['kb_categories']['Row'];
export type KbSupplier       = Database['public']['Tables']['kb_suppliers']['Row'];
export type KbEntry          = Database['public']['Tables']['kb_entries']['Row'];
export type KbEntryVersion   = Database['public']['Tables']['kb_entry_versions']['Row'];
export type KbProposal       = Database['public']['Tables']['kb_proposals']['Row'];
export type KbComment        = Database['public']['Tables']['kb_comments']['Row'];
export type KbAuditRow       = Database['public']['Tables']['kb_audit_log']['Row'];

export type KbEntryType = KbEntry['entry_type'];

export interface KbEntryListItem {
  id: string;
  slug: string;
  title: string;
  category_id: string;
  entry_type: KbEntryType;
  tags: string[];
  needs_enrichment: boolean;
  supplier_ids: string[];
  updated_at: string;
}

export interface KbSearchHit extends KbEntryListItem {
  snippet: string;
  rank: number;
}

export function isStructuredObject(data: Json | null): data is Record<string, Json> {
  return !!data && typeof data === 'object' && !Array.isArray(data);
}
