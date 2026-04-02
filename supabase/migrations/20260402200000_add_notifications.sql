-- ============================================================================
-- Notifications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  actor_name text,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  reference_type text,
  reference_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_id, is_read, created_at DESC);

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (
    recipient_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
  );

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (
    recipient_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
  );

-- Any authenticated user can insert notifications
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- Enable realtime for notifications
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
