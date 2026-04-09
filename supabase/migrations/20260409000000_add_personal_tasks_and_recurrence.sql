-- Personal tasks live in project_tasks with project_id = NULL.
-- Add owner_member_id (who owns the personal task),
-- bucket (Bullet Journal category: inbox/daily/weekly/monthly),
-- and recurrence (none/daily/weekly/monthly) for rollover on completion.

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS owner_member_id uuid
    REFERENCES public.team_members(id) ON DELETE SET NULL;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS bucket text
    CHECK (bucket IN ('inbox', 'daily', 'weekly', 'monthly'));

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS recurrence text
    NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly'));

-- Index to speed up "my personal tasks" query on Home
CREATE INDEX IF NOT EXISTS idx_project_tasks_personal_by_owner
  ON public.project_tasks (owner_member_id, bucket, display_order)
  WHERE project_id IS NULL;

COMMENT ON COLUMN public.project_tasks.owner_member_id IS
  'Team member who owns this task. Used for personal (non-project) tasks where project_id IS NULL.';
COMMENT ON COLUMN public.project_tasks.bucket IS
  'Bullet Journal category for personal tasks: inbox, daily, weekly, monthly. NULL for project tasks.';
COMMENT ON COLUMN public.project_tasks.recurrence IS
  'Recurrence pattern: none, daily, weekly, monthly. When a recurring task is marked done, its due_date rolls forward and status resets to pending.';
