<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/work_order/WO_2026-02-07_calendar_sync.md -->

# Google Calendar ICS URL 자동 동기화

## 작업 완료 보고

### 신규 생성 파일
| 파일 | 태그 | 설명 |
|------|------|------|
| `backend/supabase/migrations/002_calendar_sources.sql` | config | calendar_sources 테이블 + RLS |
| `backend/app/services/calendar_sync.py` | core | ICS URL fetch, 파싱, DB 저장, 동기화 서비스 |

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `backend/app/routers/schedule.py` | PUT/GET/DELETE `/calendar-url`, POST `/sync-now`, GET `/schedule` 자동 re-sync |
| `frontend/src/lib/api.ts` | `saveCalendarUrl`, `getCalendarUrl`, `deleteCalendarUrl`, `syncNow` 함수 추가 |
| `frontend/src/app/settings/page.tsx` | CalendarSyncSection 컴포넌트 (URL 입력, 저장, Sync Now, 삭제, 상태 표시) |
| `frontend/src/app/schedule/page.tsx` | Calendar 연동 시 업로드 영역 대신 연동 상태 + Sync Now + Settings 링크 표시 |

### 동작 플로우
1. Settings > Calendar Sync에서 Google Calendar 비공개 iCal URL 입력 → Save
2. 백엔드가 URL fetch 시도(유효성 검증) → 성공 시 DB 저장 + 즉시 동기화
3. GET /api/schedule 호출 시 last_synced_at이 1시간 이상 지났으면 자동 re-fetch
4. Schedule 페이지에서 "Sync Now" 버튼으로 수동 즉시 동기화
5. Settings에서 "Remove" 버튼으로 URL 삭제 → 수동 업로드 모드 복귀

### 참고: Supabase 마이그레이션
`002_calendar_sources.sql`은 Supabase SQL Editor에서 수동 실행 필요.
