<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/WORKLOG.md -->

# MFA (My Flight Assistant) - Work Log

---

## 긴급 오류/수정사항

### Vercel 배포 — Schedule 페이지 JSON 파싱 에러
- **증상**: `Failed to execute 'json' on 'Response': Unexpected end of JSON input`
- **현재 상태**: 환경변수 `\n` 문제 해결 완료 (Supabase 클라이언트 정상 초기화 확인). 하지만 Schedule 페이지에서 여전히 빈 응답 JSON 파싱 에러 발생.
- **디버그 엔드포인트 아직 남아있음**: `backend/app/main.py`에 `/api/debug/env`, `/api/debug/auth` + `backend/app/dependencies/auth.py`에 상세 에러 메시지 — 해결 후 반드시 제거할 것

#### 예상 원인 및 확인 방법

1. **Vercel 서버리스 함수 타임아웃/크래시**
   - Vercel Hobby 플랜은 서버리스 함수 10초 타임아웃
   - DB 조회가 느리거나 cold start로 인해 빈 응답 반환 가능
   - **확인**: `vercel logs` 또는 Vercel 대시보드 → Functions → 에러 로그 확인
   - **해결**: 함수 크래시 원인 파악 후 수정

2. **`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 빌드 타임 미주입**
   - Next.js `NEXT_PUBLIC_*` 변수는 빌드 시점에 bake됨
   - Vercel env var 등록 후 재배포했지만, Next.js 빌드에서 실제로 주입됐는지 확인 필요
   - **확인**: 배포된 사이트에서 브라우저 콘솔: `document.querySelector('script').textContent` 등으로 Supabase URL 포함 여부 확인, 또는 브라우저 Network 탭에서 Supabase 요청 URL 확인
   - **해결**: 미주입 시 `frontend/.env.production`에 직접 추가하거나, Vercel 빌드 캐시 클리어 후 재배포

3. **`getCalendarUrl()` → FastAPI `return None` → 빈 응답 가능성**
   - FastAPI가 `None` 반환 시 `200 + null` 이지만, Vercel Python 런타임에서 다르게 처리될 수 있음
   - **확인**: `curl -H "Authorization: Bearer <token>" https://mfa-seven.vercel.app/api/schedule/calendar-url` 로 인증된 상태에서 실제 응답 바디 확인
   - **해결**: `return None` 대신 `return JSONResponse(content=None)` 또는 빈 객체 반환으로 변경

4. **프론트엔드 `!res.ok` 분기에서 에러 응답도 빈 바디일 때**
   - `uploadICS`, `deleteSchedule` 등에서 `!res.ok` 시 `await res.json()` 호출하는데, 에러 응답 바디가 비어있으면 동일 에러 발생
   - **해결**: `res.json()` 호출을 try/catch로 감싸기

#### 즉시 조치 가능한 해결방안
```typescript
// api.ts — res.json() 안전하게 처리
async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}
```
- 모든 API 함수에서 `res.json()` 대신 `safeJson(res)` 사용
- 이 방법으로 빈 응답에서도 크래시 방지 가능

---

## 미구현 서비스 / 향후 작업

### NOTAM 연동
- [ ] FAA NOTAM API 키 승인 대기 중 (계정 생성 완료, 권한 미부여 상태)
- [ ] AVWX NOTAM API는 enterprise 플랜 전용 → 무료 키로는 사용 불가 확인됨
- [ ] FAA 키 승인 후 NOTAM 서비스 연결 (코드는 이미 구현 완료)

### 호텔 주소 / 우버
- [ ] 호텔 주소 표시 기능 추가 (OpenStreetMap Nominatim API 활용, 무료)
- [ ] 우버 호출 버튼 추가 (호텔 이름 기반 Uber 딥링크)

### Phase 3
- [ ] Enroute SIGMET 지도
- [ ] PWA 푸시 알림

### Phase 4
- [ ] 오프라인 캐싱
- [ ] Flight Log / Pay Calculator
- [ ] Duty/Rest Calculator
- [ ] Certification Renewal Tracker

### 크루 라운지 코드 공유 기능
- [ ] **항공사 이메일 인증 시스템**
  - 유저가 회사 이메일 입력 → 6자리 인증번호 발송 → 인증 완료 시 도메인에서 항공사 자동 매칭
  - 이메일 발송: Resend (무료 100통/일) 활용
  - DB: `email_verifications` 테이블 (code, email, expires_at, 5분 TTL)
  - DB: `airline_domains` 테이블 (domain → airline 매핑, 예: koreanair.com → KE)
  - `users` 테이블에 `airline`, `verified_airline_email` 컬럼 추가
- [ ] **라운지 코드 DB + RLS**
  - `lounge_codes` 테이블: airline, airport(IATA), lounge_name, access_code, location/memo, updated_by, updated_at
  - Supabase RLS로 같은 airline 유저만 읽기/쓰기
  - 한 공항에 여러 항공사 라운지 등록 가능 (각 항공사 태그 구분)
- [ ] **리저널 항공사 파트너십 지원**
  - `airline_partnerships` 테이블: regional_airline, mainline_airline
    - 예: OO(SkyWest) → DL, UA, AA, AS / 9E(Endeavor) → DL / YX(Republic) → DL, UA, AA
  - 메인라인 소속 유저 → 자기 항공사 라운지만 조회
  - 리저널 소속 유저 → 자기 항공사 + 파트너 메인라인 라운지 전부 조회
  - RLS 정책: `airline = user.airline OR airline IN (SELECT mainline FROM airline_partnerships WHERE regional = user.airline)`
- [ ] **UI 배치 (확정)**
  - **Dashboard (읽기 전용)**: NEXT FLIGHT 아래에 "CREW LOUNGE" 섹션
    - 다음 비행 출발지/도착지 공항의 라운지 코드 자동 표시
    - 데이터 없으면 섹션 숨김 또는 "No lounge info"
    - 카드 클릭 → Settings 라운지 관리 페이지로 이동
  - **Settings (관리 페이지)**: 탭이 아닌 메뉴 항목으로 "Crew Lounge Codes"
    - 상단 공항 검색바 (IATA 코드)
    - 등록된 라운지 코드 목록 (검색/조회/추가/수정/삭제)
    - 항공사 인증 미완료 시 인증 안내 표시

### 기타
- [ ] Class C 공항 데이터 airports.json 추가
- [ ] SkyWest 전체 취항지 airports.json 검증

---

## 작업 내역

### 2026-02-08 (Vercel 이전 + 기능 개선)

#### Vercel 서버리스 이전 (진행 중)
- `api/index.py` 생성: FastAPI를 Vercel Python serverless로 래핑
- `vercel.json` 생성: 빌드 설정 (Next.js + Python), 라우팅 (OPTIONS CORS preflight + API + 프론트엔드)
- 루트 `requirements.txt` 생성 (uvicorn 제외)
- `frontend/.env.production` 생성: `NEXT_PUBLIC_API_URL=` (빈값 → 상대경로 사용)
- `frontend/.env.local` 생성: 로컬 개발용 환경변수
- 루트 `.env`에서 `NEXT_PUBLIC_*` 변수 제거 (빌드 시 간섭 방지)
- Vercel 환경변수 8개 등록 (printf로 개행문자 없이)
- CORS 에러 수정: vercel.json에 OPTIONS 204 라우트 추가
- 환경변수 `\n` 문제 해결: Supabase `AuthRetryableError` → 환경변수 재등록
- **잔여 이슈**: Schedule 페이지 JSON 파싱 에러 (상단 긴급사항 참조)

#### Schedule Clear 버튼 — DB 삭제 + 확인 다이얼로그
- `backend/app/services/schedule_db.py`: `delete_schedule()` 함수 추가
- `backend/app/routers/schedule.py`: `DELETE /api/schedule` 엔드포인트 추가
- `frontend/src/lib/api.ts`: `deleteSchedule()` API 함수 추가
- `frontend/src/app/schedule/page.tsx`: 커스텀 다크 테마 확인 모달 (bg-zinc-900, backdrop-blur)
  - Clear 클릭 → 모달 표시 → Confirm 클릭 → API 삭제 → Zustand 상태 비움

#### Settings 불필요한 토글 제거
- Temperature, Pressure, Altitude, Timezone Display 토글 4개 삭제
- ToggleGroup 컴포넌트 + useSettingsStore import 제거

### 2026-02-06 (Docker 컨테이너화)

#### Docker 컨테이너화 (Synology NAS 배포 준비)
- Frontend Dockerfile 생성 (multi-stage build, standalone 모드)
- next.config.ts에 `output: "standalone"` 추가
- Backend requirements.txt에 python-dotenv 추가
- CORS 환경변수화 (`CORS_ORIGINS`, 콤마 구분)
- docker-compose.yml 프로덕션용 업데이트 (volume/reload 제거, restart 정책 추가)
- .env.example 생성 (환경변수 템플릿)
- frontend/backend .dockerignore 생성
- schedule_samples/ .gitignore 추가

### 2026-02-06

#### 대시보드 (page.tsx)
- UPCOMING 섹션에서 NJM(off days) 제외, pairing/MOV만 표시
- 스케줄 카드 클릭 시 Schedule 페이지로 이동 (Link 적용)

#### UTC 시간 표시
- 백엔드 스키마에 `depart_utc`, `arrive_utc`, `depart_tz`, `arrive_tz` (FlightLeg), `report_time_utc`, `report_tz` (DayDetail) 필드 추가
- ICS 파서에 공항 타임존 기반 UTC 변환 로직 추가 (`_local_to_utc`, `_get_tz_abbr`, `_fill_utc_times`)
- 프론트엔드 타입 업데이트
- 스케줄 페이지 레그 표시를 2줄 구조로 변경:
  - 1줄: 공항코드 → 공항코드, 블록타임
  - 2줄: 출발시간 TZ (UTCZ) → 도착시간 TZ (UTCZ)
- Report 시간에도 타임존 약어 + UTC 표시

#### 호텔 구글맵 링크
- 스케줄 페이지에서 호텔 이름 클릭 시 Google Maps로 리다이렉트

#### SkedPlus+ format 텍스트 삭제
- 업로드 영역 하단 "SkedPlus+ format" 문구 제거

#### AVWX NOTAM API 디버깅
- AVWX NOTAM API 테스트 결과: free 플랜에서는 enterprise 전용 리소스로 차단됨 확인
- 샘플 데이터만 반환, 실제 NOTAM 조회 불가

#### NOTAM 서비스 구조 변경
- notam.py: AVWX(1순위) → FAA(2순위) 순서로 시도하도록 구조 변경
- `_fetch_notams_avwx()`, `_parse_avwx_notam()` 함수 추가

#### Report 카운트다운
- DualTimeBar 우측에 로컬 시간 대신 "Report in HH:MM" 카운트다운 표시
- 다음 리포트 시간을 스케줄에서 자동 계산

#### Briefing 페이지 전면 재설계
- Day 탭 방식 (Day 1, 2, 3...)으로 변경
- 검색 버튼을 타이틀 우측 상단에 배치 (돋보기 아이콘)
- 레그별 블록 구조로 DEP/ARR 공항 브리핑 카드 표시
- 시간 기반 순환: 지나간 레그는 하단, 다음 레그가 최상단
- 60초 자동 갱신

#### METAR 크래시 수정
- AWC API가 visibility를 문자열("P6")로 반환하는 경우 처리
- `_safe_float()` 함수 추가 (weather.py)

#### 서비스 에러 격리
- briefing.py: METAR/TAF/NOTAM 각각 독립 try/except 처리

#### 모바일 가독성 개선
- 전체 페이지 폰트 사이즈 증가 (text-[9px]/text-[10px] → text-xs 등)
- 레그 간격 증가 (py-2 → py-3)
- 크루 뱃지, 호텔 섹션 폰트 증가

#### 테일넘버 링크 변경
- FlightRadar24 → FlightAware 라이브 트래킹으로 변경 (3개 파일)

#### .env 설정
- 프로젝트 루트에 .env 생성, main.py에서 dotenv 로딩 추가
- AVWX_API_KEY 설정 완료
- FAA_NOTAM_API_KEY 대기 중

---

## 완료된 항목 (최신순)

- [x] Settings 불필요한 토글 제거 (2026-02-08)
- [x] Schedule Clear 버튼 DB 삭제 + 커스텀 확인 모달 (2026-02-08)
- [x] Vercel 환경변수 `\n` 문제 해결 — printf로 재등록 (2026-02-08)
- [x] Vercel CORS preflight 에러 수정 (2026-02-08)
- [x] Vercel 서버리스 기본 구조 구축 (api/index.py, vercel.json) (2026-02-08)
- [x] Docker 컨테이너화 + NAS 배포 준비 (2026-02-06)
- [x] 대시보드 NJM 제외 + 스케줄 링크 (2026-02-06)
- [x] UTC 시간/타임존 약어 표시 - 백엔드+프론트엔드 (2026-02-06)
- [x] 스케줄 레그 2줄 레이아웃 (2026-02-06)
- [x] 호텔 이름 구글맵 링크 (2026-02-06)
- [x] SkedPlus+ format 텍스트 삭제 (2026-02-06)
- [x] AVWX NOTAM enterprise 전용 확인 (2026-02-06)
- [x] NOTAM 서비스 AVWX/FAA 이중 구조 (2026-02-06)
- [x] Report 카운트다운 (2026-02-06)
- [x] Briefing 페이지 전면 재설계 (2026-02-06)
- [x] METAR visibility 크래시 수정 (2026-02-06)
- [x] 서비스 에러 격리 (2026-02-06)
- [x] 모바일 가독성 개선 (2026-02-06)
- [x] 테일넘버 FlightAware 링크 변경 (2026-02-06)
- [x] .env 설정 + dotenv 로딩 (2026-02-06)
