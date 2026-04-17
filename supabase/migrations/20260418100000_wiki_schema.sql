/*
  # Knowledge Base — Phase 2 Wiki schema

  Adds long-form narrative articles parallel to the `kb_*` reference entries.
  Wiki articles are training / assembly / safety / QC / workflow content
  (source: MANUAL PARTE 1.pdf — "Técnicas y Buenas Prácticas de Armado 2025").

  Design:
    - Separate `wiki_*` tables; NOT hoisted to a shared `articles_*` substrate
      yet. Phase 1 KB remains untouched. If a 3rd use case emerges, consolidate.
    - Reuses the SQL helpers introduced in Phase 1A: public.is_admin() and
      public.current_member_id().
    - Phase 2A = read-only scaffolding (articles + versions). Proposal workflow
      (wiki_proposals + wiki_comments + wiki_audit_log) is deferred to 2B.
*/

CREATE TABLE IF NOT EXISTS wiki_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  icon        text,               -- lucide icon name, e.g. "Hammer", "Shield"
  sort_order  int NOT NULL DEFAULT 0,
  parent_id   uuid REFERENCES wiki_categories(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wiki_categories_parent_idx ON wiki_categories (parent_id);
CREATE INDEX IF NOT EXISTS wiki_categories_sort_idx   ON wiki_categories (sort_order);

CREATE TABLE IF NOT EXISTS wiki_articles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  title             text NOT NULL,
  summary           text,                                    -- one-line card summary
  category_id       uuid NOT NULL REFERENCES wiki_categories(id) ON DELETE RESTRICT,
  body_md           text NOT NULL DEFAULT '',
  tags              text[] NOT NULL DEFAULT '{}',
  reading_time_min  int,
  status            text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  current_version   int NOT NULL DEFAULT 1,
  search_tsv        tsvector,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES team_members(id) ON DELETE SET NULL,
  last_edited_by    uuid REFERENCES team_members(id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION public.wiki_articles_update_search_tsv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('spanish'::regconfig, array_to_string(NEW.tags, ' ')), 'B') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.body_md, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wiki_articles_tsv_trg ON wiki_articles;
CREATE TRIGGER wiki_articles_tsv_trg
  BEFORE INSERT OR UPDATE OF title, summary, tags, body_md ON wiki_articles
  FOR EACH ROW EXECUTE FUNCTION public.wiki_articles_update_search_tsv();

CREATE INDEX IF NOT EXISTS wiki_articles_tsv_idx        ON wiki_articles USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS wiki_articles_title_trgm_idx ON wiki_articles USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS wiki_articles_category_idx   ON wiki_articles (category_id);
CREATE INDEX IF NOT EXISTS wiki_articles_status_idx     ON wiki_articles (status);
CREATE INDEX IF NOT EXISTS wiki_articles_updated_idx    ON wiki_articles (updated_at DESC);
CREATE INDEX IF NOT EXISTS wiki_articles_tags_gin       ON wiki_articles USING GIN (tags);

DROP TRIGGER IF EXISTS wiki_articles_set_updated_at ON wiki_articles;
CREATE TRIGGER wiki_articles_set_updated_at
  BEFORE UPDATE ON wiki_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS wiki_article_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id      uuid NOT NULL REFERENCES wiki_articles(id) ON DELETE CASCADE,
  version_num     int NOT NULL,
  title           text NOT NULL,
  slug            text NOT NULL,
  summary         text,
  category_id     uuid NOT NULL,
  body_md         text NOT NULL,
  tags            text[] NOT NULL,
  edited_by       uuid REFERENCES team_members(id) ON DELETE SET NULL,
  edit_summary    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, version_num)
);

CREATE INDEX IF NOT EXISTS wiki_article_versions_article_idx
  ON wiki_article_versions (article_id, version_num DESC);

-- RLS
ALTER TABLE wiki_categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_articles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_article_versions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view wiki_categories"
  ON wiki_categories FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert wiki_categories"
  ON wiki_categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update wiki_categories"
  ON wiki_categories FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete wiki_categories"
  ON wiki_categories FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Authenticated users can view published wiki_articles"
  ON wiki_articles FOR SELECT TO authenticated
  USING (status <> 'archived' OR public.is_admin());
CREATE POLICY "Admins can insert wiki_articles"
  ON wiki_articles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update wiki_articles"
  ON wiki_articles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete wiki_articles"
  ON wiki_articles FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Authenticated users can view wiki_article_versions"
  ON wiki_article_versions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON wiki_categories        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wiki_articles          TO authenticated;
GRANT SELECT                         ON wiki_article_versions  TO authenticated;
