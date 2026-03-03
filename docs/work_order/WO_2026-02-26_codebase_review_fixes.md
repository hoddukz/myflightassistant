<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/work_order/WO_2026-02-26_codebase_review_fixes.md -->

# MFA 코드베이스 전체 점검 수정 작업명세서

**작성일**: 2026-02-26
**대상 파일**: 19개
**이슈**: Critical 5, Should Fix 9, Nice to Have 6 (총 20개, NOTAM 제외)

---

## Phase 1: Backend (10개 항목)

| # | 항목 | 파일 |
|---|------|------|
| 1-1 | lifespan 마이그레이션 | main.py |
| 1-2 | get_event_loop → get_running_loop (8곳) | schedule.py, far117.py, calendar_sync.py, reminder_scheduler.py |
| 1-3 | new_event_loop try/finally | weather_alert_scheduler.py |
| 1-4 | SSRF 방어 URL 검증 | calendar_sync.py |
| 1-5 | /route gather return_exceptions | briefing.py |
| 1-6 | Pydantic v2 model_dump() | push.py |
| 1-7 | 세션 인증 강화 (device_id 없어도 검사) | auth.py |
| 1-8 | VAPID 가드 | reminder_scheduler.py, weather_alert_scheduler.py |
| 1-9 | 미사용 SUPABASE_KEY 삭제 | config.py |
| 1-10 | UTC offset description 영어화 | far117.py |

## Phase 2: Frontend (8개 항목)

| # | 항목 | 파일 |
|---|------|------|
| 2-1 | placeholder 제거, env 없으면 throw | supabase.ts |
| 2-2 | console.log 삭제, error state 추가 | scheduleStore.ts |
| 2-3 | initialize() 멱등성 | authStore.ts |
| 2-4 | fetchSchedule 중복 방지 | AuthGuard.tsx |
| 2-5 | nextReport 분리 최적화 | DualTimeBar.tsx |
| 2-6 | 기본 offset → 브라우저 TZ, fetchSyncStatus 삭제 | api.ts |
| 2-7 | ErrorBoundary 추가 | AppShell.tsx |
| 2-8 | Dead code 4개 함수 삭제 | utils.ts |

## Phase 3: Frontend Nice to Have (1개 항목)

| # | 항목 | 파일 |
|---|------|------|
| 3-1 | any 타입 → 구체적 인터페이스 | briefing/page.tsx |
