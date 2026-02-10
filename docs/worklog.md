<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/worklog.md -->

# MFA Worklog

## 오류/수정사항
(없음)

## 향후 작업
- [ ] 테마 기능 구현 — 현재 모든 컴포넌트에 색상 하드코딩. CSS 변수 방식으로 전환 필요. Red/Night 모드(야간 비행 나이트비전 보호용) 우선 고려

---

## 2026-02-10

- 스케줄 업로드/싱크를 Settings → Schedule 탭으로 이동 완료
- Off Days 0/0 수정: NJM 이벤트 필터 → 근무 이벤트 없는 날 = 오프 방식으로 변경
- Briefing 접힌 카드 인디케이터 추가: SIG/AIR/!NOTAM/Weather 뱃지 표시
- OpenSky 항공기 추적 + 타임존 표시 개선 + 대시보드 레이아웃 git push (`cc114d0`)

---

## 완료 항목
- [x] Dashboard: Off Days `0/0` 표시 — 근무일 기반 계산으로 수정
- [x] Briefing: 카드 접힌 상태에서 주의사항 인디케이터 — SIG/AIR/NOTAM/Weather 뱃지 추가
