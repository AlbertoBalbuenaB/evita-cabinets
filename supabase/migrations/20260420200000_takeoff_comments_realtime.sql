-- Enable Supabase Realtime for takeoff_comments so team members collaborating on the
-- same takeoff session see each other's new comments, replies, resolve toggles, and
-- deletes without a manual refresh.
--
-- Two changes:
--   1. Add the table to the supabase_realtime publication (required for the
--      Postgres logical replication stream that Realtime reads from).
--   2. Set REPLICA IDENTITY FULL so DELETE events include the full old row. We
--      currently only need the id for DELETEs (client removes by id), but this
--      also keeps the door open for diff-based UI updates later.

ALTER TABLE takeoff_comments REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE takeoff_comments;
