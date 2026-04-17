import type { Database } from '../database.types';

export type WikiCategory       = Database['public']['Tables']['wiki_categories']['Row'];
export type WikiArticle        = Database['public']['Tables']['wiki_articles']['Row'];
export type WikiArticleVersion = Database['public']['Tables']['wiki_article_versions']['Row'];
export type WikiProposal       = Database['public']['Tables']['wiki_proposals']['Row'];
export type WikiComment        = Database['public']['Tables']['wiki_comments']['Row'];
export type WikiAuditRow       = Database['public']['Tables']['wiki_audit_log']['Row'];

export interface WikiArticleListItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category_id: string;
  tags: string[];
  reading_time_min: number | null;
  updated_at: string;
}
