<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/work_order/WO_2026-02-07_auth_db_migration.md -->

# MFA 로그인 기능 + DB 저장 마이그레이션

## 작업 일자: 2026-02-07

## 작업 내용 요약
Supabase Auth(이메일/비밀번호) 로그인 기능 추가 및 스케줄 데이터를 localStorage에서 Supabase DB로 마이그레이션

## 작업 항목

### 신규 생성 파일
| 파일 | 태그 | 설명 |
|------|------|------|
| `frontend/src/lib/supabase.ts` | core | Supabase 클라이언트 초기화 |
| `frontend/src/stores/authStore.ts` | core | Auth Zustand store (signIn/signUp/signOut/initialize) |
| `frontend/src/app/login/page.tsx` | core | 로그인/회원가입 페이지 |
| `frontend/src/components/auth/AuthGuard.tsx` | core | 인증 가드 (비인증→로그인 리다이렉트) |
| `frontend/src/components/layout/AppShell.tsx` | core | 경로 분기 래퍼 (로그인/앱) |
| `backend/app/db/supabase.py` | core | Backend Supabase 클라이언트 (SERVICE_KEY) |
| `backend/app/services/schedule_db.py` | core | DB CRUD (save_schedule, get_schedule) |
| `backend/app/dependencies/auth.py` | core | Bearer 토큰 검증 dependency |

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `.env.example` | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 추가 |
| `.env` | 실제 Supabase 키 입력 |
| `frontend/src/app/layout.tsx` | AppShell 래퍼로 변경 (AuthGuard 포함) |
| `frontend/src/lib/api.ts` | getAuthHeaders() 추가, fetchSchedule() 추가 |
| `frontend/src/stores/scheduleStore.ts` | persist 제거, fetchSchedule/uploadSchedule 추가 |
| `frontend/src/app/settings/page.tsx` | 로그아웃 버튼 + 이메일 표시 |
| `backend/app/routers/schedule.py` | auth dependency 추가, DB 저장, GET 엔드포인트 |

## 사전 준비 (수동)
- [ ] Supabase SQL Editor에서 `backend/supabase/migrations/001_initial_schema.sql` 실행
- [ ] NAS `.env` 업데이트
- [ ] Docker 이미지 재빌드 및 배포
