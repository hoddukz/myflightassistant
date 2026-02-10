<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/work_order/WO_2026-02-10_enroute_sigmet_airmet.md -->

# Enroute SIGMET/AIRMET 구현

## Context
Briefing 페이지에 METAR/TAF/NOTAM은 있지만 경로상 SIGMET/AIRMET 정보가 없음. `weather.py`에 `fetch_airsigmet()` 함수가 이미 존재하지만 파싱 없이 raw 데이터만 반환하며, API 엔드포인트도 없고, 프론트엔드에도 연결 안 됨. AWC API(`aviationweather.gov/api/data/airsigmet`)를 활용하여 경로 바운딩 박스 기반으로 SIGMET/AIRMET를 가져와서 Briefing 카드의 탭에 추가.

---

## 작업 1: 백엔드 — `fetch_airsigmet()` 개선 + 파싱 함수

**수정**: `backend/app/services/weather.py`

- 기존 `fetch_airsigmet()` 수정: 바운딩 박스 좌표를 실제로 활용하여 필터링
- `_parse_airsigmet(raw: dict)` 함수 추가
- `_is_in_bounds(coords, min_lat, max_lat, min_lon, max_lon)` 필터 함수
- 캐시 TTL: 기존 5분 유지

## 작업 2: 백엔드 — API 엔드포인트 추가

**수정**: `backend/app/routers/briefing.py`

- `GET /api/briefing/airsigmet?origin=XXX&destination=YYY` 엔드포인트 추가

## 작업 3: 프론트엔드 — API 함수 + 타입

**수정**: `frontend/src/lib/api.ts`
- `fetchAirSigmet(origin: string, destination: string)` 함수 추가

## 작업 4: 프론트엔드 — 패키지 설치

- `npm install react-leaflet leaflet`
- `npm install -D @types/leaflet`

## 작업 5: 프론트엔드 — Briefing 페이지 SIGMET 탭 추가

**수정**: `frontend/src/app/briefing/page.tsx`

## 작업 6: 프론트엔드 — RouteMap 컴포넌트

**생성**: `frontend/src/components/RouteMap.tsx`
