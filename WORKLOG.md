<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/WORKLOG.md -->

# MFA (My Flight Assistant) - Work Log

---

## 긴급 오류/수정사항

- [ ] NAS 배포 후 .env 환경변수 설정 확인 (SUPABASE, API KEY 등)
- [ ] 백엔드 서버 재시작 필요 (타임존/UTC 변경사항 반영)
- [ ] ICS 재업로드 필요 (UTC/타임존 필드가 기존 로컬 저장 데이터에 없음)

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

### 기타
- [ ] Settings 페이지 실제 토글 기능 구현
- [ ] Supabase Auth 연동 (실제 인증)
- [ ] Class C 공항 데이터 airports.json 추가
- [ ] SkyWest 전체 취항지 airports.json 검증

---

## 작업 내역

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
