/*
  # Create AI Chat Sessions Table

  ## Purpose
  Stores conversation history for the Evita IA chat assistant so users can
  review past conversations.

  ## New Tables
  - `ai_chat_sessions`
    - `id` (uuid, primary key)
    - `created_at` (timestamptz) - when the session was started
    - `title` (text) - first user message truncated to ~60 chars
    - `messages` (jsonb) - full array of {role, content} objects
    - `session_key` (text) - anonymous browser session identifier

  ## Security
  - RLS enabled
  - Anon users can insert and select their own sessions (matched by session_key)
  - No delete policy (keep history intact by default)

  ## Notes
  - No auth required; sessions are identified by a random UUID stored in localStorage
  - This allows history to work without login
*/

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  title text NOT NULL DEFAULT '',
  messages jsonb NOT NULL DEFAULT '[]',
  session_key text NOT NULL DEFAULT ''
);

ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert own sessions"
  ON ai_chat_sessions FOR INSERT
  TO anon
  WITH CHECK (session_key != '');

CREATE POLICY "Anon can select own sessions"
  ON ai_chat_sessions FOR SELECT
  TO anon
  USING (session_key != '');

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_session_key
  ON ai_chat_sessions (session_key, created_at DESC);
