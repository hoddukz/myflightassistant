-- Tag: config
-- Path: /Users/hodduk/Documents/git/mfa/backend/supabase/migrations/002_calendar_sources.sql
-- Google Calendar ICS URL 자동 동기화용 테이블

CREATE TABLE IF NOT EXISTS calendar_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ics_url TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE calendar_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own sources' AND tablename = 'calendar_sources') THEN
    CREATE POLICY "Users manage own sources" ON calendar_sources
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;
