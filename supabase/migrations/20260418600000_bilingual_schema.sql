/*
  # KB + Wiki — bilingual schema (Spanish default, English overlay)

  Adds `*_en` columns so every user-facing text field can hold an English
  translation alongside the Spanish original. Both KB and Wiki follow the
  same shape.

  Strategy:
    - Spanish columns remain the canonical / default — NOT NULL where they
      already were NOT NULL.
    - English columns are NULLable overlays. UI falls back to Spanish when
      the English version is missing.
    - search_tsv trigger concatenates both locales so Ctrl+K / FTS works
      regardless of UI language.
*/

-- ============================================================================
-- KB
-- ============================================================================
ALTER TABLE kb_categories
  ADD COLUMN IF NOT EXISTS name_en        text,
  ADD COLUMN IF NOT EXISTS description_en text;

ALTER TABLE kb_suppliers
  ADD COLUMN IF NOT EXISTS name_en     text,
  ADD COLUMN IF NOT EXISTS notes_md_en text;

ALTER TABLE kb_entries
  ADD COLUMN IF NOT EXISTS title_en   text,
  ADD COLUMN IF NOT EXISTS body_md_en text;

-- Update kb_entries tsv trigger to include English text
CREATE OR REPLACE FUNCTION public.kb_entries_update_search_tsv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.title, '') || ' ' || coalesce(NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('spanish'::regconfig, array_to_string(NEW.tags, ' ')), 'B') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.body_md, '') || ' ' || coalesce(NEW.body_md_en, '')), 'C') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.structured_data::text, '')), 'D');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kb_entries_tsv_trg ON kb_entries;
CREATE TRIGGER kb_entries_tsv_trg
  BEFORE INSERT OR UPDATE OF title, title_en, tags, body_md, body_md_en, structured_data ON kb_entries
  FOR EACH ROW EXECUTE FUNCTION public.kb_entries_update_search_tsv();

-- Update kb_suppliers tsv trigger
CREATE OR REPLACE FUNCTION public.kb_suppliers_update_search_tsv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.name, '') || ' ' || coalesce(NEW.name_en, '')), 'A') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.notes_md, '') || ' ' || coalesce(NEW.notes_md_en, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kb_suppliers_tsv_trg ON kb_suppliers;
CREATE TRIGGER kb_suppliers_tsv_trg
  BEFORE INSERT OR UPDATE OF name, name_en, notes_md, notes_md_en ON kb_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.kb_suppliers_update_search_tsv();

-- Rebuild tsv values with new triggers
UPDATE kb_entries    SET title = title;
UPDATE kb_suppliers  SET name  = name;

-- ============================================================================
-- Wiki
-- ============================================================================
ALTER TABLE wiki_categories
  ADD COLUMN IF NOT EXISTS name_en        text,
  ADD COLUMN IF NOT EXISTS description_en text;

ALTER TABLE wiki_articles
  ADD COLUMN IF NOT EXISTS title_en   text,
  ADD COLUMN IF NOT EXISTS summary_en text,
  ADD COLUMN IF NOT EXISTS body_md_en text;

-- Update wiki_articles tsv trigger
CREATE OR REPLACE FUNCTION public.wiki_articles_update_search_tsv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.title, '') || ' ' || coalesce(NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.summary, '') || ' ' || coalesce(NEW.summary_en, '')), 'B') ||
    setweight(to_tsvector('spanish'::regconfig, array_to_string(NEW.tags, ' ')), 'B') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(NEW.body_md, '') || ' ' || coalesce(NEW.body_md_en, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wiki_articles_tsv_trg ON wiki_articles;
CREATE TRIGGER wiki_articles_tsv_trg
  BEFORE INSERT OR UPDATE OF title, title_en, summary, summary_en, tags, body_md, body_md_en ON wiki_articles
  FOR EACH ROW EXECUTE FUNCTION public.wiki_articles_update_search_tsv();

UPDATE wiki_articles SET title = title;
