<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/worklog.md -->

# MFA Worklog

## 긴급 오류/수정사항
(없음)

## 오류/수정사항/작업예정

### 즉시 (난이도 하, 1-2주)
- [ ] Sentry 연동 — 프론트/백 크래시 추적. 프로덕션 서비스 운영중인데 에러 발생 시 알 방법 없음. 무료 티어로 30분이면 연동 가능. 구조화된 로깅(JSON + 타임스탬프), `/health`에 DB 연결 체크 추가도 같이 고려
- [ ] lifespan 마이그레이션 — `main.py`에서 `@app.on_event("startup/shutdown")` 사용 중, FastAPI deprecated 예정. `asynccontextmanager` 방식으로 전환. 5분 작업
- [ ] CORS 프로덕션 도메인 고정 — 현재 `CORS_ORIGINS` 환경변수 구조는 있지만 `*` 가능. 프로덕션에서는 Vercel 도메인만 허용 필요. Koyeb 환경변수에 도메인 넣으면 끝

### 단기 (제품 완성도)
- [ ] FDP 계산기 방향 결정 — 대시보드에 이미 FDP 현황(10.8/12h) 표시되므로 계산기 중복 가능성. 선택지: 유지 / Pickup Simulator로 개선 / 제거 / Table B 조회만 축소
- [ ] 브리핑 과거 날짜 자동 날씨 로딩 제거 — 지난 Day는 수동 리프레쉬 버튼으로만 날씨 조회하도록 변경
- [ ] 외부 API retry + backoff — AWC, AVWX, FlightAware 등 외부 API에 rate limit 처리 없음. 유저 늘면 API 차단 위험. `httpx` 호출에 retry + exponential backoff + 요청 횟수 카운터 추가. 간헐적 실패 시 브리핑 날씨 빈칸 발생
- [ ] NOTAM 연동 — FAA API 키 계속 딜레이중. 대안: FAA NOTAM 웹 스크래핑(단기) → FAA API(장기) 2단계 전략 검토
- [ ] 테마 기능 구현 — 현재 모든 컴포넌트에 색상 하드코딩. CSS 변수 방식으로 전환 필요. Red/Night 모드(야간 비행 나이트비전 보호용) 우선 고려

### 중기 (유저 확장 시)
- [ ] 보안 강화 (서비스키→JWT 분리) — `SUPABASE_SERVICE_KEY`로 모든 DB 조작이 admin 권한(RLS 우회)으로 실행 중. 읽기는 유저 JWT로 Supabase client 생성하여 RLS 활용, 쓰기/관리만 service key 사용으로 분리. `.env.example`에 실제 키 포함 여부 확인 (git history 포함). 유저 10명+ 시 착수
- [ ] ICS/CSV 파서 항공사별 확장 — 밑작업 완료(base/registry/skywest 분리). 샘플 확보 시 airlines/ 디렉토리에 새 파서 추가만으로 확장 가능
- [ ] 스케줄 업로드 시 기존 데이터 병합 방식 검토 — 현재는 덮어쓰기(이전 달 삭제됨). 누적 저장 필요 여부 결정
- [ ] 인메모리 캐시 → 외부 캐시 — `_cache: dict` 단일 프로세스에서만 유효, 멀티 워커/서버리스에선 공유 안 됨. Koyeb 단일 인스턴스면 당장 OK. 스케일 시 Redis 또는 Supabase 캐시 테이블 추가
- [ ] PWA 실제 구현 — README에 PWA라 되어있지만 manifest/service worker 없음. 오프라인 캐싱, 홈 화면 추가 등 실제 PWA 설정 필요

### 장기 (유저 30명+)
- [ ] 스케줄러 큐 기반 전환 — `reminder_scheduler.py`에서 매 60초 전체 유저 풀스캔. 유저 늘면 DB 부하 급증. 스케줄 업로드 시 `reminder_queue` 테이블에 발송 시점 미리 계산, 스케줄러는 `WHERE send_at <= now() AND sent = false`만 조회. 또는 Supabase `pg_cron` + Edge Function
- [ ] 딜레이/캔슬 실시간 알림 — FlightAware AeroAPI Standard($100/월) 필요. 유저 30명+ 확보 후 전환 목표. 그전까지 Personal 티어($5 무료크레딧) + 스마트 폴링(출발 3-4h 전부터만)으로 대체
- [ ] 결제 모듈 구현 — Stripe 연간결제 기본 ($36/년 ≈ $3/월). 한국 사업자 등록 필요. 구독 상태 기반 기능 제한 구조

---

## 2026-02-13

- FAR 117 백엔드+프론트엔드 연동 완료
  - 디버깅: 백엔드 서버 미재시작으로 `/api/far117/` 라우트 미등록 상태 → 서버 재시작으로 해결
  - 대시보드 카드 (`Far117Card.tsx`): FDP 프로그레스 바 + 28d/365d 요약 정상 표시 확인
  - 브리핑 탭 (`Far117DetailTab.tsx`): 상세 FDP/Rest/Flight Time + 딜레이 시뮬레이션 정상 동작
  - FDP 계산기 (`FdpCalculatorModal.tsx`): Report Time + Leg 수 → Max FDP + Latest Release + Delay Impact
- FAR 117 전체 영어화
  - 백엔드 경고 메시지 6개 한글→영어 (far117.py)
  - 라우터 메시지 1개 한글→영어 (routers/far117.py)
  - 프론트엔드 라벨 3개 한글→영어 (여유→OK, 연장 필요→Extension Req., 상한 초과→Exceeds Limit)
- 브리핑 FAR 117 탭 위치 이동: Day 탭들 뒤 → 맨 왼쪽(Day 1 앞)으로 변경
- 프로덕션화 권장사항 9개 항목 현재 상태 점검 + 기존 TODO와 합쳐서 우선순위 4단계로 재정리 (즉시/단기/중기/장기)

---

## 2026-02-12

- 프로덕션화 검토 (GitHub 레포 `hoddukz/mfa` 코드 리뷰 기반)
  - 배포 현황 확인: Supabase + Vercel(FE) + Koyeb(BE) 구성 완료, 알림 정상 동작중
  - 보안: 서비스키 → 유저 JWT 분리 필요 (유저 10명+ 시), CORS 도메인 고정 필요
  - 인프라: Sentry 연동, lifespan 마이그레이션 등 기술부채 정리 필요
- FAR 117 계산 로직 초안 작성 (`far117.py`)
  - `Far117Calculator` 클래스: FDP 상한 테이블 룩업, 누적 비행시간(28d/365d), 레스트 추적, 56h 규정
  - `simulate_delay()`: 딜레이 시 FDP 초과 여부 + Unforeseen Circumstances 2h 연장 판단
  - `simulate_pickup()`: 오픈 타임 픽업 시 FDP + 28일 한도 + 레스트 간격 체크
  - `pairings_to_duty_periods()`: MFA 스케줄 데이터 → DutyPeriod 변환 헬퍼
- FAR 117 UI 배치 설계 결정
  - 대시보드: FDP 프로그레스 바 + 28d/365d 한 줄 요약 카드
  - Briefing Day 탭: 해당일 FDP 상세 + 딜레이 시뮬레이션
  - 독립 계산기: 스케줄 없이도 report time + 레그 수 입력 → 즉시 결과 (프론트 전용)
- FlightAware AeroAPI 가격 조사
  - Personal: $5 무료크레딧/월, Alert(웹훅) 불가, 비상업
  - Standard: $100/월 최소, Alert 가능, B2C 가능
  - 전략: Personal로 시작 → 유저 30명+ 확보 후 Standard 전환 + Alert(웹훅) 활성화
- NOTAM 대체 소스 조사 — FAA 웹 스크래핑, AVWX 셀프호스트, Notamify API 등 검토
- 가격 전략: $3-4/월 (연 $36) 타겟. Stripe 연간결제로 수수료 최소화

---

## 2026-02-11

- ICS/CSV 파서 플러그인 구조 밑작업
  - `base.py`: BaseICSParser / BaseCSVParser 추상 클래스 정의
  - `airlines/skywest.py`: 기존 ics_parser.py 로직 → SkyWestICSParser 클래스로 이동
  - `airlines/skywest_csv.py`: 기존 csv_parser.py 로직 → SkyWestCSVParser 클래스로 이동
  - `registry.py`: can_parse() 자동 감지 라우터 (parse_ics / parse_csv)
  - 기존 ics_parser.py / csv_parser.py → re-export 래퍼로 전환 (기존 import 호환 유지)
- 세션 관리 기능 구현 (`3900923`)
  - 최대 2대 기기 동시 로그인 제한 (초과 시 가장 오래된 세션 제거)
  - 30분 비활동 시 자동 로그아웃 + 5분 간격 heartbeat
  - Device ID 기반 세션 추적 (localStorage + X-Device-ID 헤더)
  - 401 session_expired 감지 시 자동 signOut
  - DB: user_sessions 테이블 (프로덕션 + 테스트 DB 모두 적용)
- 라이트모드 세팅 유틸리티 글자 가시성 수정 (text-white → text-foreground)
- 브리핑 검색창 기본 닫힘으로 변경

---

## 2026-02-10

- 스케줄 업로드/싱크를 Settings → Schedule 탭으로 이동 완료
- Off Days 0/0 수정: NJM 이벤트 필터 → 근무 이벤트 없는 날 = 오프 방식으로 변경
- Briefing 접힌 카드 인디케이터 추가: SIG/AIR/!NOTAM/Weather 뱃지 표시
- OpenSky 항공기 추적 + 타임존 표시 개선 + 대시보드 레이아웃 git push (`cc114d0`)

---

## 완료 항목
- [x] FAR 117 전체 구현 (백엔드 API + 대시보드 카드 + 브리핑 탭 + FDP 계산기 + 영어화) — 2026-02-13
- [x] FAR 117 계산 로직 초안 + UI 배치 설계 — 2026-02-12
- [x] 프로덕션화 검토 (배포/보안/인프라/가격/API 조사) — 2026-02-12
- [x] 로그인 후 Warning/Disclaimer 페이지 — 구현 완료 (로그아웃 시 초기화 + NODE_ENV 기반 제어)
- [x] ICS/CSV 파서 플러그인 구조 밑작업 (BaseParser + registry + SkyWest 분리) — 2026-02-11
- [x] 세션 관리 기능 (2대 동시 로그인 제한 + 30분 비활동 자동 로그아웃) — 2026-02-11
- [x] 라이트모드 세팅 유틸리티 글자 가시성 수정 — 2026-02-11
- [x] 브리핑 검색창 기본 닫힘 — 2026-02-11
- [x] Dashboard: Off Days `0/0` 표시 — 근무일 기반 계산으로 수정
- [x] Briefing: 카드 접힌 상태에서 주의사항 인디케이터 — SIG/AIR/NOTAM/Weather 뱃지 추가
