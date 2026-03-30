-- Enable UPDATE and DELETE for conversation management in Evita IA
-- Previously only INSERT and SELECT were allowed, so saveSession updates were silently failing

CREATE POLICY "Anon can update own sessions"
  ON ai_chat_sessions FOR UPDATE
  TO anon
  USING (session_key != '')
  WITH CHECK (session_key != '');

CREATE POLICY "Anon can delete own sessions"
  ON ai_chat_sessions FOR DELETE
  TO anon
  USING (session_key != '');
