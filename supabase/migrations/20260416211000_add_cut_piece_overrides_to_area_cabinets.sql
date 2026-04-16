-- Editable cut list pre-optimizer: per-cabinet override of products_catalog.cut_pieces.
-- See .claude/plans/editable-cut-list-pre-optimizer.md
ALTER TABLE area_cabinets
  ADD COLUMN IF NOT EXISTS cut_piece_overrides JSONB;

COMMENT ON COLUMN area_cabinets.cut_piece_overrides IS
  'Per-cabinet override for cut_pieces (full CutPiece[] replacement). NULL = use products_catalog template.';
