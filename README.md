# MFA (My Flight Assistant)
> **Pilot-Centric Schedule Management & Real-time Briefing Automation Solution**

MFA는 파일럿의 수동 브리핑 과정을 자동화하고, 개인 스케줄 기반의 실시간 기상/항적 정보를 제공하여 상황 인식(Situational Awareness)을 극대화하는 모바일 최적화 웹앱(PWA)입니다.

---

## 사용 설명서

- [User Guide (English)](docs/user-guide.md)
- [사용 설명서 (한국어)](docs/user-guide-ko.md)

---

## 주요 기능

### 스케줄 관리
- **멀티 포맷 지원**: iCal(.ics) 및 CSV 파일 업로드
- **Google Calendar 자동 싱크**: ICS URL 등록 시 자동 동기화
- **시간 변환**: 공항 코드 기반 UTC/Local Dual Time 표기
- **크루/호텔 매칭**: 비행 동료 명단 및 레이오버 호텔 정보 자동 추출

### 실시간 브리핑
- **METAR/TAF**: 출발/도착 공항 기상 색상 코딩 (VFR/MVFR/IFR/LIFR)
- **NOTAM**: 핵심 키워드(RWY/TWY 폐쇄 등) 하이라이트 및 Critical NOTAM 우선 배치
- **SIGMET/AIRMET**: 출발-도착지 대권항로 100NM 반경 내 위험 기상 자동 감지 + 경로 지도 시각화
- **공항 검색**: ICAO 코드 직접 검색 브리핑

### 항공기 추적
- **Tail Number Tracking**: OpenSky 기반 실시간 항적 추적
- **FlightAware/Flightradar24 연동**: 외부 추적 서비스 리다이렉트

### 푸시 알림
- **기상 급변 알림**: 스케줄 공항 기상 변화 감지 시 푸시
- **리포트 타임 리마인더**: 출근 전 커스텀 시간 알림 (1h/2h/3h + 사용자 지정)
- **PWA Service Worker**: 백그라운드 푸시 지원

### 세션 관리
- **동시 로그인 제한**: 최대 2대 기기 동시 접속
- **비활동 자동 로그아웃**: 30분 미사용 시 자동 로그아웃
- **Device ID 기반 추적**: 5분 간격 heartbeat로 세션 유지

### 유틸리티
- **단위 변환기**: 온도, 압력, 고도, 거리, 속도, 무게
- **비행 메모**: 현재 레그 자동 연결, 시간 기록

---

## 기술 스택

| 구분 | 기술 | 비고 |
| :--- | :--- | :--- |
| **Frontend** | Next.js 16 (React, Turbopack) | PWA, 모바일 우선, Tailwind CSS v4 |
| **Backend** | FastAPI (Python) | iCal/CSV 파싱, 기상 API 연동 |
| **Database** | Supabase (PostgreSQL) | Auth, RLS, 실시간 DB |
| **State** | Zustand | 클라이언트 상태 관리 (auth, schedule, settings) |
| **Data API** | NOAA AWC API | METAR/TAF/NOTAM/SIGMET |
| **Flight Tracking** | OpenSky Network | 실시간 항적 |
| **Push** | Web Push (VAPID) | pywebpush + Service Worker |
| **Mapping** | Leaflet | SIGMET/AIRMET 경로 시각화 |

---

## 프로젝트 구조

```
mfa/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 앱
│   │   ├── dependencies/auth.py # JWT + 세션 인증
│   │   ├── routers/             # schedule, briefing, flight, push, session
│   │   ├── services/            # DB, 캘린더 싱크, 스케줄러
│   │   └── parsers/             # ICS/CSV 파서
│   └── supabase/migrations/     # DB 스키마
├── frontend/
│   ├── src/app/                 # Next.js 페이지 (/, /briefing, /schedule, /settings, /login)
│   ├── src/components/          # UI 컴포넌트
│   ├── src/stores/              # Zustand 스토어 (auth, schedule, settings)
│   ├── src/hooks/               # 커스텀 훅 (useActivityTracker, useResolvedTheme)
│   └── src/lib/                 # API 클라이언트, 유틸리티
└── docs/
    └── worklog.md               # 작업 로그
```

---

## 환경 설정

### 로컬 개발
```bash
# 백엔드
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 프론트엔드
cd frontend
npm install
npm run dev
```

### 환경변수
- `backend/.env` — Supabase, VAPID, API 키
- `frontend/.env.local` — NEXT_PUBLIC_API_URL, Supabase anon key

### DB 분리
| 환경 | Supabase 프로젝트 | 용도 |
| :--- | :--- | :--- |
| 로컬 | `ctqccnpufytcbgxcvxit` | 개발/테스트 |
| 프로덕션 | `luqnrkqbzqbnjuhqekks` | Vercel + Koyeb |

---

## 향후 계획
- 과거 날짜 브리핑 수동 리프레쉬 전환
- 스케줄 데이터 병합 업로드 (기존 데이터 보존)
- Red/Night 모드 (야간 비행 나이트비전 보호)
- Duty/Rest 계산기 (FAR Part 117)
- 결제 모듈 (Stripe/Lemon Squeezy)

---

(c) 2026 MFA (My Flight Assistant) Project.
