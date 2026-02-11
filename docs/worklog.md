<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/worklog.md -->

# MFA Worklog

## 긴급 오류/수정사항
(없음)

## 오류/수정사항/작업예정
- [ ] 브리핑 과거 날짜 자동 날씨 로딩 제거 — 지난 Day는 수동 리프레쉬 버튼으로만 날씨 조회하도록 변경
- [ ] 스케줄 업로드 시 기존 데이터 병합 방식 검토 — 현재는 덮어쓰기(이전 달 삭제됨). 누적 저장 필요 여부 결정
- [ ] 테마 기능 구현 — 현재 모든 컴포넌트에 색상 하드코딩. CSS 변수 방식으로 전환 필요. Red/Night 모드(야간 비행 나이트비전 보호용) 우선 고려
- [ ] 로그인 후 Warning/Disclaimer 페이지 — 동의 시 대시보드 이동, 미동의 시 로그아웃 → 로그인 페이지 이동. 내용: "본 앱은 상황 인지 보조 도구(situational awareness aid)이며 공식 디스패치, 기상 브리핑, 항행 정보를 대체하지 않음. 모든 운항 결정은 FAA 승인 공식 소스(NOAA AWC, FAA NOTAM, 항공사 디스패치 등)를 기반으로 해야 함. METAR/TAF/NOTAM/SIGMET 데이터는 실시간 정확성을 보장하지 않으며, 최종 판단은 PIC 책임." ForeFlight/Garmin Pilot 등 공식 사이트에서 면책 문구 참고 후 확정
- [ ] 결제 모듈 검토 — 미국 타겟, Stripe 또는 Lemon Squeezy. 초기 Lemon Squeezy → 규모 확대 시 Stripe 전환 루트

---

## 2026-02-11

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
- [x] 세션 관리 기능 (2대 동시 로그인 제한 + 30분 비활동 자동 로그아웃) — 2026-02-11
- [x] 라이트모드 세팅 유틸리티 글자 가시성 수정 — 2026-02-11
- [x] 브리핑 검색창 기본 닫힘 — 2026-02-11
- [x] Dashboard: Off Days `0/0` 표시 — 근무일 기반 계산으로 수정
- [x] Briefing: 카드 접힌 상태에서 주의사항 인디케이터 — SIG/AIR/NOTAM/Weather 뱃지 추가
