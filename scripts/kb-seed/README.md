# KB Seed — provenance & update process

The Knowledge Base v1 seed content lives in the migration
`supabase/migrations/20260417100100_kb_seed.sql`, hand-crafted from the reviewed
source document `Evita_Knowledge_Base_Seed_v1.md`.

## Why no parser script

Phase 1A treats the v1 seed as frozen. After Phase 1B ships the proposal
workflow, ongoing content changes flow through the in-app PR UI — not
re-seeding. A TypeScript parser would add complexity without recurring value.

## How to update seed content post-Phase-1A

1. **Small additions/fixes (preferred):** open a proposal in the KB UI
   (`/kb/proposals/new`) — goes through review + audit trail.
2. **Bulk content migrations:** write a new `NNNN_kb_seed_update_*.sql`
   migration that `INSERT … ON CONFLICT (slug) DO NOTHING` for new rows and
   targeted `UPDATE … WHERE slug = '…'` for edits.

## Reference

- Source Markdown: `C:\Users\alber\OneDrive\Documents\Claude\Projects\Evita Cabinets Platform\Evita_Knowledge_Base_Seed_v1.md`
- Section numbering from the source is preserved in `kb_categories.section_num`
  and in entry body headers, so every row is traceable back to a source §.
