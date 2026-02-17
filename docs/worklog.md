<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/worklog.md -->

# MFA Worklog

## 긴급 오류/수정사항
- [ ] 하이브리드 ETA sanity check 검증 필요 — 스케줄 기반 ETA와 거리/속도 기반 ETA 불일치 시 fallback 로직 추가함. 실제 비행 데이터로 정확도 검증 필요 (테스트 ICS는 가짜 스케줄이라 검증 불가)

## 오류/수정사항/작업예정

### 즉시 (난이도 하, 1-2주)
- [ ] Sentry 연동 — 프론트/백 크래시 추적. 프로덕션 서비스 운영중인데 에러 발생 시 알 방법 없음. 무료 티어로 30분이면 연동 가능. 구조화된 로깅(JSON + 타임스탬프), `/health`에 DB 연결 체크 추가도 같이 고려
- [ ] lifespan 마이그레이션 — `main.py`에서 `@app.on_event("startup/shutdown")` 사용 중, FastAPI deprecated 예정. `asynccontextmanager` 방식으로 전환. 5분 작업
- [ ] CORS 프로덕션 도메인 고정 — 현재 `CORS_ORIGINS` 환경변수 구조는 있지만 `*` 가능. 프로덕션에서는 Vercel 도메인만 허용 필요. Koyeb 환경변수에 도메인 넣으면 끝

### 단기 (제품 완성도)
- [ ] **유료화 전 법적/라이선싱 검토** — 아래 항목 모두 상업적 이용 조건 확인 필요
  - [ ] ❌ **OpenSky Network API** — 개인/비영리만 무료, 상업용 별도 라이선스 필요 (확인됨). FlightAware AeroAPI로 전환 필수. 멀티 프로바이더 구조에 `_fetch_flightaware()` 추가만으로 전환 가능
  - [ ] ⚠️ **GoFlightLabs API** — 상업적 이용 약관 확인 필요 (fallback 프로바이더)
  - [ ] ⚠️ **AviationStack API** — 상업적 이용 약관 확인 필요 (fallback 프로바이더)
  - [ ] ⚠️ **AVWX API** — NOTAM 대체 소스, 상업적 이용 약관 확인 필요
  - [ ] ✅ **AWC/NOAA (aviationweather.gov)** — US 정부 데이터, public domain (상업 이용 가능)
  - [ ] ✅ **FAA NOTAM API** — US 정부 데이터, public domain (상업 이용 가능)
  - [ ] ⚠️ **CartoDB 타일 서비스** — 지도 타일 (`basemaps.cartocdn.com`), 상업 이용 시 유료 티어 또는 약관 확인 필요. 기반 데이터 OpenStreetMap (ODbL 라이선스 — 출처 표기 의무)
  - [ ] ⚠️ **react-leaflet** — Hippocratic License 2.1 (윤리적 사용 조항 포함, 상업 호환성 논란). 순수 Leaflet(BSD-2) 또는 MapLibre로 교체 검토
  - [ ] ⚠️ **airports.json 데이터** — 출처 불명, 원본 데이터 소스 및 라이선스/출처표기 요구사항 확인 필요
  - [ ] ✅ **Supabase** — 유료 플랜 전환 시 상업 이용 가능 (Pro $25/월~)
  - [ ] ✅ **Vercel** — 유료 플랜 전환 시 상업 이용 가능 (Pro $20/월~)
  - [ ] ✅ **Koyeb** — 유료 플랜 전환 시 상업 이용 가능
  - [ ] ✅ **Google Fonts (Inter, JetBrains Mono)** — SIL Open Font License 1.1 (상업 이용 가능)
  - [ ] ✅ **Material Icons** — Apache License 2.0 (상업 이용 가능)
  - [ ] ✅ **Web Push (VAPID)** — IETF 표준, 라이선싱 이슈 없음
  - [ ] ✅ **주요 NPM/Python 패키지** — 대부분 MIT/BSD/Apache 라이선스 (상업 이용 가능)
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
- [ ] 딜레이/캔슬 실시간 알림 — FlightAware AeroAPI Alert(웹훅) 활용. Standard 티어 이상 필요
- [ ] 결제 모듈 구현 — Stripe 연간결제. 한국 사업자 등록 필요. 구독 상태 기반 기능 제한 구조

### 유료화 비용 전략

#### 플랜 구조 (2-Tier)
- **Basic** ($3/월, $36/년) — 브리핑, FAR 117, 스케줄 관리, 푸시 알림. 비행 추적 미포함 → FlightAware 비용 $0
- **Pro** ($6/월, $72/년) — Basic + 실시간 비행 추적 + 딜레이 알림

#### 인프라 고정 비용 (유료화 시점)
| 서비스 | 월 비용 |
|--------|---------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Koyeb | ~$10 |
| FlightAware Standard (Pro 플랜 출시 시) | $100 |
| **Basic만 운영 시** | **~$55/월** (손익분기 19명) |
| **Pro 포함 시** | **~$155/월** (손익분기 26명, Basic:Pro 50:50 가정) |

#### 비행 추적 API 전환 전략
- **현재 → 유저 30명**: OpenSky 무료 유지 (비상업 단계, 무료 배포)
- **유료 전환 시점**: Basic 플랜만 먼저 출시 → FlightAware 비용 불필요
- **유저 50명+**: Pro 플랜 추가 → FlightAware Standard($100/월) 도입
- **유저 100명+**: FlightAware Alert 웹훅으로 딜레이/캔슬 실시간 알림 추가

#### 비행 추적 API 비용 통제: 수동 리프레쉬 + 월간 횟수 제한
- 자동 60초 폴링 제거 → 수동 리프레쉬 버튼 방식으로 전환
- SkyWest 단거리 기준: 월 15일 출근 × 5회/일 = **75회/월** (여유 포함 100회/월 한도)
- API 비용: 100회 × $0.01 = **$1/유저/월** → Pro $6 기준 마진 $5
- UI에 잔여 횟수 표시 ("Refresh 187/200 left"), 월초 리셋
- FlightAware 전환 시 fallback 체인(FlightLabs/AviationStack) 제거 → 단일 프로바이더로 단순화

#### 비용 통제 전략 우선순위 (SkyWest 2인 크루 기준)
1. **수동 리프레쉬 + 월간 횟수 제한** — 비용 확정, 구현 간단
2. **탭 비활성 시 폴링 중지** — 자동 폴링 유지할 경우 필수
3. **스마트 폴링 (비행 단계별 주기 조절)** — 자동 폴링 유지할 경우 70-80% 절감
4. ~~서버사이드 캐시~~ — 효과 없음 (SkyWest 2인 크루, 동일 편 동시 조회 확률 ~0%)

#### 비용 시뮬레이션 (Pro 유저 기준, 수동 리프레쉬 100회/월 한도)
| Pro 유저 수 | 월 API 비용 (쿼리) | FlightAware 기본료 | 총 API 비용 | Pro 수익 | 손익 |
|------------|-------------------|-------------------|-------------|---------|------|
| 10명 | $10 | $100 | $110 | $60 | -$50 |
| 20명 | $20 | $100 | $120 | $120 | ±$0 |
| 30명 | $30 | $100 | $130 | $180 | +$50 |
| 50명 | $50 | $100 | $150 | $300 | +$150 |

**Pro 플랜 손익분기: ~20명** (Basic 수익으로 인프라 비용 커버 가정)

---

## 2026-02-13

- BottomNav FAB 리뉴얼
  - FAB 버튼 + 확장 메뉴 (Crew/Hotel→/crew, Schedule→/settings?tab=schedule, Settings→/settings)
  - Duty 페이지 신규: FDP Status + Cumulative Limits + Pickup Simulator + Table B
  - Far117Card: /duty 링크 연결
  - Settings: ?tab=schedule 쿼리 파라미터 지원
- 비행 단계 추정 엔진 구현 (flight_phase.py)
  - 12단계 Phase enum + FlightPhaseEstimator (ADS-B 히스토리 10분 버퍼 기반)
  - 하이브리드 ETA: 스케줄 비행시간 기본 + 실측 보정 + 30% 이상 괴리 시 거리/속도 fallback
  - 홀딩 패턴 감지: 헤딩 누적 변화 300°+ / 좁은 위치 범위 / 고도 유지
  - flight_tracker.py 통합: 항공기별 estimator 인메모리 관리, 응답에 phase/progress 추가
  - 라우터: origin/scheduled_dep/scheduled_arr 파라미터 추가
- InboundAircraft UI 업그레이드
  - 비행 단계 아이콘 + 라벨 (material icons), 단계별 프로그레스 바 색상
  - 홀딩 경고 배너, 짧은 레그 간소화, ADS-B 면책 조항
  - 프로그레스 거리 표시 수정 (비행거리/전체 형식)
  - 콜사인 클릭 → FlightAware 라이브 트래킹 링크
  - 대시보드에서 이전 레그 스케줄 컨텍스트 추출 후 API에 전달
- ⚠️ ETA 정확도 미검증: 테스트 ICS가 실제 비행과 불일치하여 하이브리드 ETA sanity check 로직 실제 데이터로 검증 필요
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
- 유료화 전 법적/라이선싱 전수 조사
  - 외부 API 6종, 인프라 3종, 프론트 라이브러리/폰트/아이콘, 데이터 소스 전체 점검
  - 즉시 조치 필요: OpenSky (비상업 전용 확인), react-leaflet (Hippocratic License), CartoDB 타일 약관
  - 안전 확인: AWC/NOAA, FAA (US 정부 public domain), Google Fonts/Material Icons (SIL/Apache), 주요 패키지 (MIT/BSD)
  - 확인 필요: GoFlightLabs, AviationStack, AVWX 상업 약관, airports.json 데이터 출처
- 유료화 비용 전략 수립
  - OpenSky 대체 API 조사: FlightAware/ADS-B Exchange/AeroDataBox/AviationStack/RadarBox 비교
  - 핵심 결론: 어떤 API든 상업 이용 = 유료 (FlightAware Standard $100/월 최소). 피더 혜택은 웹 계정만 해당, AeroAPI 상업 라이선스와 무관
  - 2-Tier 플랜 설계: Basic $3 (추적 미포함) + Pro $6 (추적 포함)
  - 비행 추적 비용 통제: 자동 폴링 → 수동 리프레쉬 + 월 100회 한도 (유저당 API $1/월)
  - SkyWest 단거리 2인 크루 특성상 서버 캐시 효과 없음 → 수동 리프레쉬 횟수 제한이 최적 전략
  - 로드맵: 무료(OpenSky) → Basic만 출시($55/월) → Pro 추가(FlightAware $100/월) → Alert 웹훅

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
- 가격 전략: Basic $3/월 + Pro $6/월 2-Tier. Stripe 연간결제로 수수료 최소화

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
