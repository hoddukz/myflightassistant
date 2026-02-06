# ✈️ MFA (My Flight Assistant)
> **Pilot-Centric Schedule Management & Real-time Briefing Automation Solution**

MFA는 번거로운 수동 브리핑 과정을 자동화하고, 개인 스케줄 기반의 실시간 기상/항적 정보를 제공하여 파일럿의 상황 인식(Situational Awareness)을 극대화하는 모바일 최적화 웹앱(PWA)입니다.

---

## 1. 프로젝트 핵심 가치
* **데이터 통합**: 회사 스케줄(`ics`, `csv`)을 통합하여 직관적인 타임라인 제공.
* **시간 효율성**: 비행 전 날씨, 노탐, 경로상 위험 기상을 1초 만에 확인.
* **안전 강화**: 경로상 SIGMET/AIRMET 및 실시간 테일 넘버 추적으로 안전한 비행 의사결정 지원.

---

## 2. 주요 기능 (Core Features)

### 📂 스케줄 동기화 및 파싱
* **멀티 포맷 지원**: iCal(UTC 기준) 및 CSV(현지 시각 기준) 파일 통합 업로드 지원.
* **지능형 시간 변환**: 공항 코드를 기반으로 UTC와 Local Time을 계산하여 **Dual Time**으로 표기.
* **자동 크루/호텔 매칭**: 비행 동료 명단 및 레이오버 호텔 정보(전화번호 포함) 자동 추출.

### 📡 실시간 브리핑 시스템
* **Tail-Number Tracking**: 기체 번호(N-Number) 클릭 시 FlightAware/Flightradar24 실시간 항적 페이지로 리다이렉트.
* **Enroute Hazard 스캔**: 출발-도착지 사이의 대권항로(Great Circle Route) 100NM 반경 내 SIGMET/AIRMET 자동 감지.
* **Smart Airport Briefing**:
    * 출발/도착 공항의 METAR/TAF 색상 코딩 (VFR/IFR).
    * 핵심 NOTAM (RWY/TWY 폐쇄 등) 키워드 하이라이트 및 최상단 배치.

### 🔔 스마트 알림 및 설정
* **PWA 푸시 알림**: 기상 급변, 스케줄/게이트 변경, 리포트 타임(Report Time) 리마인더 알림 전송.
* **자격증 갱신 D-Day 알림**: White Card(신검), EPTA, 여권, 비자 등 만료일 입력 후 푸시 알림.
* **다국어 지원**: 한국어(KO) 및 영어(EN) UI 선택 기능.
* **사용자 커스텀**: 다크 모드(기본), 거리/속도/고도 단위 설정 및 선호 시간대 설정.

### 🧮 Duty/Rest & Pay 계산
* **법적 휴식/근무 시간 계산기**: FAR Part 117 기반 Duty Limit 및 최소 휴식 시간 자동 계산.
* **비행 수당(Pay/Per-diem) 자동 계산**: Block Time, Credit, TAFB 기반 월간 예상 수당 대시보드.

### 📝 개인 메모 & EFB 보조
* **공항별 개인 메모**: 사용자가 직접 저장하는 공항 팁(셔틀, 난기류, 맛집 등), 해당 공항 스케줄 시 자동 표시.

---

## 3. 기술 스택 (Technical Stack)

| 구분 | 기술 | 비고 |
| :--- | :--- | :--- |
| **Frontend** | **Next.js (React)** | PWA, 모바일 우선 대응, 다국어(i18n) 지원 |
| **Backend** | **FastAPI (Python)** | iCal/CSV 파싱, GeoJSON 기반 기상 구역 연산 |
| **Database** | **Supabase** | 사용자 인증(Auth), 실시간 DB, 푸시 토큰 저장 |
| **Data API** | **AWC API / AVWX** | 미국 AWC + 글로벌 확장 시 AVWX/CheckWX 검토 |
| **Caching** | **TanStack Query** | 오프라인 대응, 데이터 신선도(Last updated) 표시 |
| **Mapping** | **Leaflet / Mapbox** | 경로 및 기상 위험 구역 시각화 |

---

## 4. 데이터 워크플로우 (Workflow)

1. **Upload**: 사용자가 `SkedPlus+` 등에서 받은 파일을 앱에 업로드.
2. **Process**: 서버에서 테일 넘버, 공항, 시간을 추출하여 UTC로 정규화 저장.
3. **Fetch**: 추출된 공항/시간 정보를 바탕으로 실시간 날씨 및 NOTAM API 호출.
4. **Notify**: 변경 사항 발생 시 Service Worker를 통해 사용자 기기에 푸시 전송.

---

## 5. UI/UX 디자인 원칙 (Mobile-First)

* **Bottom Navigation**: Dashboard, Schedule, Briefing, Crew/Hotel, Settings (5개 메뉴).
* **Dual-Time Bar**: 상단 바에 현재 UTC와 현지 Local Time을 상시 노출하여 혼선 방지.
* **Cockpit Mode**: 야간 비행 및 어두운 칵핏 환경을 고려한 저광도 다크 모드 인터페이스.
* **Red-Light Mode**: Night Vision 보호를 위한 붉은색 톤 UI 옵션.
* **단위 변환기**: 온도(C/F), 압력(hPa/inHg), 고도(ft/m) 일괄 변경.

---

## 6. 개발 로드맵
* **Phase 1**: iCal/CSV 파서 개발 및 테일 넘버 추적 리다이렉트 구현.
* **Phase 2**: 공항별 실시간 기상(METAR/TAF) 및 NOTAM 연동.
* **Phase 3**: 경로상(Enroute) SIGMET 구역 감지 및 PWA 푸시 알림 시스템 구축.
* **Phase 4**: 오프라인 캐싱, 비행 로그/수당 자동 계산기, Duty/Rest Calculator, 자격증 갱신 알림 추가.

---
© 2026 MFA (My Flight Assistant) Project.
