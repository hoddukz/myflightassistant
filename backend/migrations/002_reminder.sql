-- Tag: core
-- Path: /Users/hodduk/Documents/git/mfa/backend/migrations/002_reminder.sql
-- Report Time Reminder 기능을 위한 스키마 변경

-- 1A. day_summaries에 report_time_utc 컬럼 추가
ALTER TABLE day_summaries ADD COLUMN IF NOT EXISTS report_time_utc TIMESTAMPTZ;

-- 1B. notification_log 테이블 생성 (중복 발송 방지)
CREATE TABLE IF NOT EXISTS notification_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_summary_id UUID NOT NULL REFERENCES day_summaries(id) ON DELETE CASCADE,
  reminder_minutes INT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_summary_id, reminder_minutes)
);

-- 1C. users.settings JSONB 컬럼 (없으면 추가)
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
