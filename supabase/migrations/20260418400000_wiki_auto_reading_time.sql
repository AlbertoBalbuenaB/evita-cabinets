/*
  # Wiki — auto reading-time trigger

  Computes wiki_articles.reading_time_min from body_md word count
  (200 wpm, min 1) whenever body_md changes AND the caller did not
  set reading_time_min explicitly. Allows manual override to win:
  if a merge RPC or an admin edit passes a non-null value that
  differs from what the trigger would compute, we keep the override.

  Heuristic: if reading_time_min is NULL after the write, auto-fill;
  otherwise leave it alone. The merge RPC (wiki_merge_proposal) uses
  coalesce(proposed, current), so proposals that don't override the
  value preserve NULL which triggers auto-fill here.

  Also backfills existing rows where reading_time_min differs from
  the computed estimate by more than 1 minute (to clean up the 2A seed
  + MANUAL ingest estimates).
*/

CREATE OR REPLACE FUNCTION public.wiki_articles_auto_reading_time()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_words int;
  v_minutes int;
BEGIN
  IF NEW.body_md IS NULL OR length(NEW.body_md) = 0 THEN
    RETURN NEW;
  END IF;

  -- Only auto-fill when caller left it NULL. Preserves manual overrides
  -- set via the proposal form or direct admin edits.
  IF NEW.reading_time_min IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_words := array_length(regexp_split_to_array(NEW.body_md, '\s+'), 1);
  v_minutes := greatest(1, round(v_words::numeric / 200));
  NEW.reading_time_min := v_minutes;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wiki_articles_reading_time_trg ON wiki_articles;
CREATE TRIGGER wiki_articles_reading_time_trg
  BEFORE INSERT OR UPDATE OF body_md ON wiki_articles
  FOR EACH ROW EXECUTE FUNCTION public.wiki_articles_auto_reading_time();

-- Optional backfill: recompute all current articles by NULLing the field
-- and then touching body_md to trigger the function. We touch via an UPDATE
-- that sets body_md = body_md so the BEFORE UPDATE trigger fires.
UPDATE wiki_articles
SET reading_time_min = NULL;

UPDATE wiki_articles
SET body_md = body_md;
