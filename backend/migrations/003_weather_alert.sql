-- Tag: core
-- Path: /Users/hodduk/Documents/git/mfa/backend/migrations/003_weather_alert.sql

CREATE TABLE IF NOT EXISTS weather_alert_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  flight_leg_id UUID REFERENCES flight_legs(id) ON DELETE CASCADE,
  airport TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  condition_value TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, flight_leg_id, airport, condition_type)
);

CREATE INDEX IF NOT EXISTS idx_wal_user ON weather_alert_log(user_id);
CREATE INDEX IF NOT EXISTS idx_wal_sent ON weather_alert_log(sent_at);
