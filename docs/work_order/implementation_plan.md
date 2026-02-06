<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/work_order/implementation_plan.md -->

# MFA 전체 구현 계획서

## 샘플 데이터 분석 결과

### ICS (SkedPlus+ iCal) - 주 데이터 소스
| 이벤트 유형 | 의미 | 포함 데이터 |
|:---|:---|:---|
| `NJM` | Off Day (No Job/Minimum) | 시작/종료 UTC만 |
| `MOV` | 이동/포지셔닝 | 시작/종료 UTC만 |
| `Pairing` | 실제 비행 트립 | 아래 상세 |

**Pairing DESCRIPTION 구조:**
```
Total Block: 10:20  Total Credit: 17:46  TAFB: 77:56

IOE M3939B                          ← Pairing ID
Monday 02-02-2026   Report: 11:35   ← 날짜 + 리포트 타임 (현지시각)
1. 935      DTW  SLC  12:20  14:30  Block: 0:00  Credit: 4:10  ← 데드헤드(Block 0:00)
2. *6380  CR7  N728SK  SLC  PHX  06:48  08:49  Block: 2:01    ← 실제 운항편
              Day Block: 0:00   Day Credit: 4:10   Duty: 5:10
Release: 14:45/02   Hotel: Kimpton Hotel Monaco Salt (801)595-0000   Layover: 15:26

크루 정보:
2. CA: 019723 Theron Messick  FO: 097889 Taeyoung Cho  FA: 097389 Angel Alvarado  FF: 105709 Callie Wilson
```

**핵심 파싱 포인트:**
- `Block: 0:00` = 데드헤드 (탑승만, 운항 안 함)
- `*` 접두사 = Operating carrier 구분 표시
- Tail Number는 운항편에만 존재 (예: N728SK, N724SK)
- 호텔: `Hotel: [이름] ([지역번호])[전화번호]`
- 크루 포지션: CA(Captain), FO(First Officer), FA(Flight Attendant), FF(추가 승무원)
- DESCRIPTION 내 시각 = **현지 시각**, DTSTART/DTEND = **UTC**

### CSV - 보조 데이터 소스
- 2가지 변형: HH:MM 포맷 vs 소수점 시간(decimal hours)
- ICS보다 정보 적음 (호텔, 리포트/릴리즈 타임, 데드헤드 없음)
- 운항편(operated flights)만 포함

---

## 모노레포 디렉토리 구조

```
mfa/
├── frontend/                    # Next.js 14 (App Router) + PWA
│   ├── public/
│   │   ├── manifest.json
│   │   ├── sw.js               # Service Worker
│   │   └── icons/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root Layout (Dual-Time Bar, Bottom Nav)
│   │   │   ├── page.tsx        # Dashboard
│   │   │   ├── schedule/       # 스케줄 뷰
│   │   │   ├── briefing/       # 브리핑 (METAR/TAF/NOTAM/SIGMET)
│   │   │   ├── crew/           # 크루/호텔 정보
│   │   │   └── settings/       # 설정
│   │   ├── components/
│   │   │   ├── layout/         # DualTimeBar, BottomNav
│   │   │   ├── schedule/       # UploadModal, TimelineCard, FlightLeg
│   │   │   ├── briefing/       # MetarCard, TafCard, NotamList, SigmetMap
│   │   │   ├── crew/           # CrewCard, HotelCard
│   │   │   └── common/         # Button, Card, Badge, etc.
│   │   ├── lib/
│   │   │   ├── supabase.ts     # Supabase client
│   │   │   ├── api.ts          # Backend API 호출
│   │   │   └── utils.ts        # 시간 변환, 포매팅
│   │   ├── hooks/              # useSchedule, useBriefing, usePush
│   │   ├── stores/             # Zustand (상태관리)
│   │   ├── i18n/               # ko.json, en.json
│   │   └── types/              # TypeScript 타입 정의
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                     # FastAPI (Python 3.11+)
│   ├── app/
│   │   ├── main.py             # FastAPI 앱 엔트리포인트
│   │   ├── config.py           # 설정 (Supabase URL, API Keys)
│   │   ├── routers/
│   │   │   ├── schedule.py     # /api/schedule - 업로드, 파싱, 조회
│   │   │   ├── briefing.py     # /api/briefing - METAR/TAF/NOTAM
│   │   │   ├── sigmet.py       # /api/sigmet - SIGMET/AIRMET 경로 분석
│   │   │   ├── tracking.py     # /api/tracking - 테일넘버 추적
│   │   │   └── notification.py # /api/notification - 푸시 알림
│   │   ├── parsers/
│   │   │   ├── ics_parser.py   # iCal 파싱 (주 파서)
│   │   │   └── csv_parser.py   # CSV 파싱 (보조 파서)
│   │   ├── services/
│   │   │   ├── weather.py      # AWC API 연동 (METAR/TAF/SIGMET)
│   │   │   ├── notam.py        # NOTAM API 연동
│   │   │   ├── airport.py      # 공항 좌표/타임존 데이터
│   │   │   ├── route.py        # 대권항로 계산 + SIGMET 교차 판정
│   │   │   └── push.py         # Web Push 발송
│   │   ├── models/
│   │   │   └── schemas.py      # Pydantic 모델
│   │   └── data/
│   │       └── airports.json   # ICAO/IATA 공항 코드 → 좌표/타임존
│   ├── requirements.txt
│   └── Dockerfile
│
├── schedule_samples/            # (기존) 샘플 데이터
├── docs/
│   └── work_order/
├── README.md
├── .gitignore
└── docker-compose.yml           # 로컬 개발용
```

---

## Supabase DB 스키마

```sql
-- 사용자
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  employee_id TEXT,            -- 예: 097889
  name TEXT,
  base_airport TEXT,           -- 홈베이스 (예: DTW)
  settings JSONB DEFAULT '{}', -- 다크모드, 언어, 단위 등
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 페어링 (트립 단위)
CREATE TABLE pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pairing_id TEXT NOT NULL,     -- 예: M3939B
  summary TEXT,                 -- 예: IOE M3939B CR7
  event_type TEXT NOT NULL,     -- 'pairing', 'njm', 'mov'
  start_utc TIMESTAMPTZ NOT NULL,
  end_utc TIMESTAMPTZ NOT NULL,
  total_block INTERVAL,
  total_credit INTERVAL,
  tafb INTERVAL,
  raw_description TEXT,         -- 원본 DESCRIPTION 보존
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 비행 레그 (개별 편)
CREATE TABLE flight_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_id UUID REFERENCES pairings(id) ON DELETE CASCADE,
  leg_number INT NOT NULL,
  flight_number TEXT,           -- 예: *6380, 935
  ac_type TEXT,                 -- 예: CR7, CR9, ER7
  tail_number TEXT,             -- 예: N728SK (없을 수 있음)
  origin TEXT NOT NULL,         -- IATA 코드
  destination TEXT NOT NULL,
  depart_local TIME,
  arrive_local TIME,
  depart_utc TIMESTAMPTZ,
  arrive_utc TIMESTAMPTZ,
  block_time INTERVAL,
  credit_time INTERVAL,
  is_deadhead BOOLEAN DEFAULT FALSE,
  flight_date DATE NOT NULL,
  day_block INTERVAL,
  day_credit INTERVAL,
  duty_time INTERVAL
);

-- 레이오버 (호텔 정보)
CREATE TABLE layovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_id UUID REFERENCES pairings(id) ON DELETE CASCADE,
  hotel_name TEXT,
  hotel_phone TEXT,
  layover_duration INTERVAL,
  release_time TEXT,
  flight_date DATE NOT NULL
);

-- 크루 정보
CREATE TABLE crew_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_leg_id UUID REFERENCES flight_legs(id) ON DELETE CASCADE,
  position TEXT NOT NULL,       -- CA, FO, FA, FF
  employee_id TEXT,
  name TEXT
);
```

---

## Phase별 구현 계획

### Phase 1: 핵심 파싱 + 스케줄 표시 (기반 구축)

#### 1-1. 프로젝트 초기 셋업
- [ ] Next.js 14 프로젝트 생성 (App Router, TypeScript, Tailwind CSS)
- [ ] FastAPI 프로젝트 생성 (Python 3.11+)
- [ ] Supabase 프로젝트 생성 가이드 문서 작성
- [ ] DB 스키마 마이그레이션 SQL 작성
- [ ] `.gitignore`, `docker-compose.yml` 설정
- [ ] 공항 데이터 JSON 생성 (IATA코드 → 좌표, 타임존)

#### 1-2. Backend - iCal/CSV 파서 개발
- [ ] `ics_parser.py`: SkedPlus+ iCal DESCRIPTION 파싱
  - Pairing/NJM/MOV 이벤트 분류
  - 비행 레그 추출 (편명, 기종, 테일넘버, 출발/도착, 시각, 블록/크레딧)
  - 데드헤드 판별 (Block: 0:00)
  - 호텔 정보 추출 (이름, 전화번호, 레이오버 시간)
  - 크루 정보 추출 (포지션별 사번 + 이름)
  - Report/Release 타임 추출
- [ ] `csv_parser.py`: CSV 파싱 (HH:MM 및 decimal 두 포맷 지원)
- [ ] `/api/schedule/upload` 엔드포인트 (파일 업로드 → 파싱 → DB 저장)
- [ ] `/api/schedule/list` 엔드포인트 (월별 스케줄 조회)

#### 1-3. Frontend - 기본 UI 구축
- [ ] Root Layout: Bottom Navigation (5개 탭)
- [ ] Dual-Time Bar (UTC / Local 상시 표시)
- [ ] Dashboard 페이지: 오늘/다음 비행 요약
- [ ] Schedule 페이지:
  - 파일 업로드 모달 (드래그앤드롭)
  - 월간 캘린더 뷰
  - 일별 타임라인 뷰 (Pairing 카드)
  - 비행 레그 상세 (편명, 공항, 시각, 크루)
- [ ] 다크 모드 (Cockpit Mode) 기본 적용
- [ ] Tail Number 클릭 → FlightAware/Flightradar24 리다이렉트

#### 1-4. Supabase 연동
- [ ] Supabase Auth (이메일/패스워드 인증)
- [ ] Row Level Security (RLS) 정책 설정
- [ ] Frontend Supabase client 연결

---

### Phase 2: 실시간 기상 + NOTAM

#### 2-1. Backend - 기상 API 연동
- [ ] `weather.py`: AWC API 연동
  - METAR 조회 (공항 ICAO 코드 기반)
  - TAF 조회
  - 응답 캐싱 (5분 TTL)
- [ ] `notam.py`: FAA NOTAM API 연동
  - 공항별 NOTAM 조회
  - 키워드 분류 (RWY, TWY, ILS, CLSD 등)
- [ ] `/api/briefing/{airport}` 엔드포인트
- [ ] `airport.py`: IATA → ICAO 변환 + 좌표/타임존 조회

#### 2-2. Frontend - 브리핑 페이지
- [ ] Briefing 페이지:
  - 출발/도착 공항 자동 선택 (다음 비행 기준)
  - METAR 카드 (색상 코딩: VFR=초록, MVFR=파랑, IFR=빨강, LIFR=보라)
  - TAF 카드 (시간대별 예보)
  - NOTAM 리스트 (RWY/TWY 폐쇄 키워드 하이라이트 + 최상단 배치)
- [ ] 크루/호텔 페이지:
  - 크루 카드 (포지션, 이름, 사번)
  - 호텔 카드 (이름, 전화번호 → 전화 바로걸기)

---

### Phase 3: Enroute SIGMET + PWA 푸시 알림

#### 3-1. Backend - 경로 위험기상 분석
- [ ] `route.py`: 대권항로(Great Circle) 계산
  - 출발/도착 공항 좌표 기반 경로 포인트 생성
  - 100NM 반경 버퍼 영역 생성 (Shapely)
- [ ] `services/weather.py` 확장: SIGMET/AIRMET 폴리곤 데이터 수신
- [ ] GeoJSON 교차 판정 (경로 버퍼 ∩ SIGMET 영역)
- [ ] `/api/sigmet/enroute` 엔드포인트

#### 3-2. Frontend - 지도 시각화
- [ ] Leaflet/Mapbox 지도 컴포넌트
  - 대권항로 라인 표시
  - SIGMET/AIRMET 영역 오버레이 (색상 구분)
  - 출발/도착 공항 마커
- [ ] Briefing 페이지에 지도 탭 추가

#### 3-3. PWA 푸시 알림
- [ ] Service Worker 등록 (next-pwa 또는 수동)
- [ ] `manifest.json` 설정
- [ ] Web Push API 연동 (VAPID 키 생성)
- [ ] Backend: 푸시 토큰 저장 + 발송 로직
- [ ] 알림 트리거:
  - Report Time 리마인더 (출발 2시간 전)
  - 기상 급변 (METAR 카테고리 변경)
  - SIGMET 경로 진입

---

### Phase 4: 오프라인 + 비행 로그/수당 계산

#### 4-1. 오프라인 캐싱
- [ ] Service Worker 캐싱 전략 (Cache First for static, Network First for API)
- [ ] IndexedDB로 스케줄 데이터 로컬 저장
- [ ] 오프라인 시 마지막 캐시 데이터 표시

#### 4-2. 비행 로그 & 수당 계산
- [ ] Flight Log 페이지:
  - 월별/연별 Block Time, Credit Time, TAFB 합산
  - 기종별(CR7, CR9, ER7) 비행시간 분류
  - 공항별 방문 횟수 통계
- [ ] 수당 계산기:
  - Per Diem 계산 (TAFB 기반)
  - Override/Guarantee 비교
  - 월간 예상 급여 산출

#### 4-3. 다국어 지원
- [ ] i18n 설정 (next-intl 또는 자체 구현)
- [ ] ko.json / en.json 번역 파일
- [ ] 설정 페이지에서 언어 전환

---

## 기술 선택 상세

| 항목 | 선택 | 이유 |
|:---|:---|:---|
| 상태관리 | Zustand | 가볍고 TypeScript 친화적 |
| CSS | Tailwind CSS | 다크모드 내장, 유틸리티 기반 빠른 개발 |
| iCal 파싱 | icalendar (Python) | 표준 iCal 라이브러리 |
| 지리 연산 | Shapely + pyproj | GeoJSON 교차 판정에 최적 |
| 푸시 알림 | pywebpush | VAPID 기반 Web Push |
| 지도 | Leaflet (react-leaflet) | 무료, 가볍고, 항공 경로 표시에 적합 |

---

## 구현 우선순위 요약

```
Phase 1 (기반)    → 파서 + 스케줄 UI + 인증        ← 여기부터 시작
Phase 2 (브리핑)  → METAR/TAF/NOTAM + 크루/호텔
Phase 3 (안전)    → SIGMET 경로분석 + 푸시알림
Phase 4 (편의)    → 오프라인 + 로그/수당 계산
```

각 Phase 완료 시 Git Push 후 다음 Phase 진행.
