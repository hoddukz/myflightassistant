-- Tag: core
-- Path: /Users/hodduk/Documents/git/mfa/backend/supabase/migrations/001_initial_schema.sql
-- MFA 초기 DB 스키마

-- 사용자
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  employee_id TEXT,
  name TEXT,
  base_airport TEXT,
  settings JSONB DEFAULT '{
    "language": "en",
    "theme": "dark",
    "temp_unit": "C",
    "pressure_unit": "hPa",
    "altitude_unit": "ft",
    "preferred_timezone": "utc"
  }'::jsonb,
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 페어링 (트립 단위)
CREATE TABLE pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  pairing_id TEXT NOT NULL,
  summary TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('pairing', 'njm', 'mov', 'vac', 'training', 'other')),
  start_utc TIMESTAMPTZ NOT NULL,
  end_utc TIMESTAMPTZ NOT NULL,
  total_block TEXT,
  total_credit TEXT,
  tafb TEXT,
  raw_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 비행 레그 (개별 편)
CREATE TABLE flight_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_id UUID REFERENCES pairings(id) ON DELETE CASCADE NOT NULL,
  leg_number INT NOT NULL,
  flight_number TEXT,
  ac_type TEXT,
  tail_number TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  depart_local TEXT,
  arrive_local TEXT,
  depart_utc TIMESTAMPTZ,
  arrive_utc TIMESTAMPTZ,
  block_time TEXT,
  credit_time TEXT,
  is_deadhead BOOLEAN DEFAULT FALSE,
  flight_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 일별 요약
CREATE TABLE day_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_id UUID REFERENCES pairings(id) ON DELETE CASCADE NOT NULL,
  flight_date DATE NOT NULL,
  report_time TEXT,
  day_block TEXT,
  day_credit TEXT,
  duty_time TEXT
);

-- 레이오버 (호텔 정보)
CREATE TABLE layovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_id UUID REFERENCES pairings(id) ON DELETE CASCADE NOT NULL,
  hotel_name TEXT,
  hotel_phone TEXT,
  layover_duration TEXT,
  release_time TEXT,
  flight_date DATE NOT NULL
);

-- 크루 정보
CREATE TABLE crew_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_leg_id UUID REFERENCES flight_legs(id) ON DELETE CASCADE NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('CA', 'FO', 'FA', 'FF')),
  employee_id TEXT,
  name TEXT
);

-- 공항 개인 메모
CREATE TABLE airport_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  airport_code TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, airport_code)
);

-- 자격증/문서 만료 알림
CREATE TABLE certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  cert_type TEXT NOT NULL,
  cert_name TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  remind_days_before INT DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_pairings_user_id ON pairings(user_id);
CREATE INDEX idx_pairings_start_utc ON pairings(start_utc);
CREATE INDEX idx_pairings_event_type ON pairings(event_type);
CREATE INDEX idx_flight_legs_pairing_id ON flight_legs(pairing_id);
CREATE INDEX idx_flight_legs_flight_date ON flight_legs(flight_date);
CREATE INDEX idx_flight_legs_origin ON flight_legs(origin);
CREATE INDEX idx_flight_legs_destination ON flight_legs(destination);
CREATE INDEX idx_flight_legs_tail_number ON flight_legs(tail_number);
CREATE INDEX idx_crew_assignments_flight_leg_id ON crew_assignments(flight_leg_id);
CREATE INDEX idx_layovers_pairing_id ON layovers(pairing_id);

-- RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE layovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE airport_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자기 데이터만 접근
CREATE POLICY "Users can view own data" ON users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can manage own pairings" ON pairings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own flight legs" ON flight_legs
  FOR ALL USING (
    pairing_id IN (SELECT id FROM pairings WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own day summaries" ON day_summaries
  FOR ALL USING (
    pairing_id IN (SELECT id FROM pairings WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own layovers" ON layovers
  FOR ALL USING (
    pairing_id IN (SELECT id FROM pairings WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own crew" ON crew_assignments
  FOR ALL USING (
    flight_leg_id IN (
      SELECT fl.id FROM flight_legs fl
      JOIN pairings p ON fl.pairing_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own airport notes" ON airport_notes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own certifications" ON certifications
  FOR ALL USING (auth.uid() = user_id);
