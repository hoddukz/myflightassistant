<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/work_order/WO_2026-02-10_inbound_aircraft_tracker.md -->

# Inbound Aircraft Tracker 작업명세서

## Context
조종사가 출근 전 "내가 탈 비행기가 제시간에 오는지" 확인하는 기능. 스케줄의 tail number로 inbound 항공기를 자동 추적하고, ETA/지연/카운트다운을 대시보드에 표시. AviationStack + FlightLabs 두 API를 모두 테스트하여 비교 후 선택.

---

## 작업 1: 백엔드 — flight_tracker 서비스

**생성**: `backend/app/services/flight_tracker.py`

- `track_inbound(tail_number?, flight_number?, provider?)` — 통합 진입점
  - provider: `"aviationstack"` | `"flightlabs"` | `None`(자동 — FlightLabs 우선, 실패 시 AviationStack)
  - API key 미설정 시 `{ "available": false, "reason": "no_api_key" }` 반환
- `_fetch_flightlabs(tail_number?, flight_number?)` — tail_number(reg_number) + flight_number 모두 지원
  - `GET https://app.goflightlabs.com/advanced-real-time-flights?access_key=KEY&reg_number={tail}`
- `_fetch_aviationstack(flight_number)` — flight_number만 지원 (tail 조회 불가)
  - `GET https://api.aviationstack.com/v1/flights?access_key=KEY&flight_iata={flight}`
- `_normalize_flight(raw, provider)` → 통일된 응답:
  ```python
  {
    "available": True,
    "provider": "flightlabs",
    "flight_number": "DL5678",
    "tail_number": "N728SK",
    "status": "en-route",  # scheduled | en-route | landed | cancelled | unknown
    "departure": {
      "airport": "CID",
      "scheduled": "2026-02-10T12:00:00Z",
      "estimated": "2026-02-10T12:05:00Z",
      "actual": "2026-02-10T12:08:00Z",
      "delay_minutes": 8
    },
    "arrival": {
      "airport": "PHX",
      "scheduled": "2026-02-10T13:30:00Z",
      "estimated": "2026-02-10T13:47:00Z",  # ← 핵심 ETA
      "actual": None,
      "delay_minutes": 17
    },
    "live": {  # 비행 중일 때만
      "latitude": 35.12, "longitude": -95.67,
      "altitude": 36000, "speed": 480
    },
    "fetched_at": 1707580800.0
  }
  ```
- `get_tracker_status()` → `{ aviationstack: bool, flightlabs: bool, any_available: bool }`
- 캐시 5분 TTL (`weather.py` 패턴)
- 환경변수: `AVIATIONSTACK_API_KEY`, `FLIGHTLABS_API_KEY`

## 작업 2: 백엔드 — API 엔드포인트

**생성**: `backend/app/routers/flight.py`

- `GET /api/flight/track?tail_number=N728SK&flight_number=DL5678&provider=flightlabs`
  - tail_number, flight_number 중 최소 하나 필수
- `GET /api/flight/status` → 설정된 provider 목록

**수정**: `backend/app/main.py` — flight 라우터 등록 추가

## 작업 3: 프론트엔드 — API 함수 + 타입

**수정**: `frontend/src/lib/api.ts`
- `fetchFlightTrack({ tail_number?, flight_number?, provider? })` 추가
- `fetchTrackerStatus()` 추가

**수정**: `frontend/src/types/index.ts`
- `FlightTrackData` 인터페이스 추가

## 작업 4: 프론트엔드 — InboundAircraft 컴포넌트

**생성**: `frontend/src/components/dashboard/InboundAircraft.tsx`

Props: `tailNumber: string | null`, `flightNumber: string`, `destination: string`

동작:
- 마운트 시 자동 1회 호출 (tail_number로 조회)
- **Refresh 버튼**: 수동 클릭으로만 재조회 (자동 폴링 없음 — API 쿼터 절약)
- tail_number 없으면 수동 flight number 입력 폴백
- API key 미설정 시 기존 FlightAware 링크(`getTailTrackingUrl()`)로 폴백
- 카운트다운: arrival.estimated 기준 1분마다 갱신

UI:
```
┌─────────────────────────────────────────┐
│ INBOUND AIRCRAFT              [Refresh] │
│ N728SK · DL5678                         │
│                                         │
│ CID → PHX          EN ROUTE             │
│ ETA: 13:47L (sched 13:30L)             │
│                                         │
│ ████████████████░░░░  Arrives in 42 min │
│                                         │
│ [+17 min DELAYED]    via FlightLabs     │
└─────────────────────────────────────────┘
```

색상: 정시/조기=emerald, 1~15분 지연=amber, 15분+ 지연=red

## 작업 5: 대시보드 통합

**수정**: `frontend/src/app/page.tsx`

- NEXT FLIGHT 카드(line 249~283) 바로 아래에 InboundAircraft 삽입
- `nextFlight.leg.tail_number` → tailNumber prop
- `nextFlight.leg.origin` → destination prop (inbound 항공기가 도착하는 공항 = 내 출발 공항)

---

## 파일 목록

| 파일 | 변경 |
|------|------|
| `backend/app/services/flight_tracker.py` | **신규** — 듀얼 API 서비스 + 캐시 + 정규화 |
| `backend/app/routers/flight.py` | **신규** — `/api/flight/track`, `/api/flight/status` |
| `backend/app/main.py` | flight 라우터 등록 |
| `frontend/src/lib/api.ts` | fetchFlightTrack, fetchTrackerStatus |
| `frontend/src/types/index.ts` | FlightTrackData 인터페이스 |
| `frontend/src/components/dashboard/InboundAircraft.tsx` | **신규** — 대시보드 카드 |
| `frontend/src/app/page.tsx` | InboundAircraft 삽입 |

## 검증
1. `GET /api/flight/status` → 설정된 provider 확인
2. `GET /api/flight/track?flight_number=DL1234&provider=aviationstack` → ETA JSON
3. `GET /api/flight/track?tail_number=N728SK&provider=flightlabs` → ETA JSON
4. 두 API 응답 비교 (데이터 완성도, 응답속도, ETA 정확도)
5. 대시보드: Next Flight 아래 inbound 카드 표시 + 카운트다운
6. API key 없을 때 FlightAware 링크 폴백
7. 캐시: 5분 이내 재요청 시 API 호출 없이 캐시 반환
