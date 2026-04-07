-- Purchase item comments (simple threaded Q&A on purchase items)
CREATE TABLE IF NOT EXISTS purchase_item_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_item_id UUID NOT NULL REFERENCES project_purchase_items(id) ON DELETE CASCADE,
  author_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_item_comment_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES purchase_item_comments(id) ON DELETE CASCADE,
  author_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_purchase_item_comments_item_id
  ON purchase_item_comments(purchase_item_id);

CREATE INDEX IF NOT EXISTS idx_purchase_item_comment_replies_comment_id
  ON purchase_item_comment_replies(comment_id);

-- RLS (same open pattern as task_comments)
ALTER TABLE purchase_item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_item_comment_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all_purchase_item_comments"
  ON purchase_item_comments FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "public_all_purchase_item_comment_replies"
  ON purchase_item_comment_replies FOR ALL
  USING (true) WITH CHECK (true);
