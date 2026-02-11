<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/work_order/WO_2026-02-11_weather_alerts.md -->

# 날씨 알림 푸쉬 기능 구현

## 작업일: 2026-02-11
## 브랜치: feature/weather-alerts

## 구현 내용

### 공항 기준 모니터링 (스케일 최적화)
- 유저 기준이 아닌 공항 기준으로 METAR fetch → 유저 수 무관하게 공항 수만큼만 호출
- 3시간 이내 출발편의 고유 공항 추출 → 공항별 1회 METAR → 위험 조건 판별 → 해당 유저들에게 알림

### 체크 간격
| 출발까지 | 간격 |
|----------|------|
| 2~3시간 전 | 30분 |
| 1~2시간 전 | 20분 |
| 1시간 이내 | 10분 |

### 알림 조건
- IFR, LIFR 카테고리
- 뇌우 (TS/TSRA/TSGR)
- 결빙 (FZRA/FZDZ/FZFG)
- 강풍 (gust >= 25kt 또는 sustained >= 30kt)
- 저시정 (< 1SM)

## 생성/수정 파일

| 파일 | 작업 |
|------|------|
| backend/migrations/003_weather_alert.sql | 생성 |
| backend/app/services/weather_alert_scheduler.py | 생성 |
| backend/app/routers/push.py | 수정 (weather alert settings 엔드포인트) |
| backend/app/main.py | 수정 (스케줄러 등록) |
| frontend/src/stores/settingsStore.ts | 수정 (weatherAlerts 필드) |
| frontend/src/lib/api.ts | 수정 (weather alert API 함수) |
| frontend/src/app/settings/page.tsx | 수정 (Weather Alerts 토글) |

## 추가 수정 (브리핑 병렬화)
- backend/app/routers/briefing.py: asyncio.gather 적용으로 METAR/TAF/NOTAM 병렬 fetch
