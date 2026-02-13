# MFA 인바운드 항공기 위치 추적 — 기술 사양서

> **문서 버전**: 1.0  
> **작성일**: 2026-02-13  
> **상태**: 설계 단계

---

## 1. 개요

### 1.1 핵심 목표

파일럿이 앱 한 번 열어서 **"내 다음 비행기가 지금 어디 있고, 제시간에 오는지"**를 한눈에 파악할 수 있게 한다.

### 1.2 현재 파일럿의 워크플로우 (문제점)

```
FlightAware/ForeFlight 앱 열기
  → 테일넘버 수동 입력
  → 검색 결과에서 현재 비행 찾기
  → 위치/상태 확인
  → 내 스케줄과 머릿속으로 비교
  → 정시 도착 여부 판단
```

### 1.3 MFA 목표 워크플로우

```
MFA 앱 열기
  → 내 스케줄 기반으로 인바운드 항공기 자동 표시
  → 현재 위치, 비행 단계, 예상 도착 시간 한 화면에
  → 기상 + 듀티 리밋까지 통합
  → 파일럿이 경험에 기반해 스스로 판단
```

### 1.4 설계 철학

> **"앱이 판단하는 게 아니라 파일럿이 판단할 수 있게 정보를 제공한다."**

- 딜레이 여부를 앱이 단정짓지 않음
- 최대한 상세한 실시간 데이터를 보기 쉽게 제공
- 파일럿이 자신의 경험과 맥락(기상, 공항 상황 등)으로 최종 판단

---

## 2. 데이터 소스 분석

### 2.1 API 비교 요약

| 항목 | OpenSky Network | AeroDataBox | FlightAware AeroAPI |
|:---|:---|:---|:---|
| **실시간 위치** | ✅ (5~10초 간격) | ❌ (스케줄 데이터 수준) | ✅ |
| **테일넘버 조회** | ❌ (icao24 필요) | ✅ (reg 검색 가능) | ✅ |
| **딜레이/캔슬** | ❌ | △ (basic quality) | ✅ |
| **게이트 정보** | ❌ | 일부 | ✅ |
| **인바운드 연결** | ❌ | ❌ | ✅ |
| **웹훅 (PUSH)** | ❌ | ✅ | ✅ (Standard $100+) |
| **비용** | **무료** | $0.99/월~ | **$100/월~** |
| **데이터 품질** | ADS-B 원시 데이터 | 중상 | 최상 |

### 2.2 AeroDataBox 테스트 결과 (2026-02-13)

OO4030 (PSP→SLC) 편명 조회 결과:

```json
{
  "aircraft": { "model": "Embraer 175" },  // ← 테일넘버(N번호) 없음
  "lastUpdatedUtc": "2025-11-25 15:37Z",   // ← 3개월 전 데이터
  "status": "Expected",
  "departure": { "scheduledTime": { "utc": "2026-02-13 14:00Z" } },
  "arrival": {
    "scheduledTime": { "utc": "2026-02-13 15:48Z" },
    "predictedTime": { "utc": "2026-02-13 15:34Z" }  // ← 예측 시간 있음
  }
}
```

**문제점:**
- 테일넘버 미포함 → 인바운드 기체 체인 추적 불가
- lastUpdated가 3개월 전 → 실시간 데이터가 아님
- withLocation=true로 요청했으나 위치 데이터 없음
- "Basic" quality → 리저널 항편 커버리지 부족

**결론: AeroDataBox는 MFA 용도로 부적합**

### 2.3 OpenSky Network — 선택된 데이터 소스

**선택 이유:**
- 무료 (비용 $0)
- 실시간 위치/속도/고도 제공 (5~10초 간격)
- ADS-B 기반 원시 데이터 → 가장 실시간에 가까움
- 하루 4,000 크레딧 (인증 유저) 충분

**제한사항:**
- 딜레이/캔슬 정보 없음 (위치 기반 추론 필요)
- 편명 검색 불가 (icao24 주소 필요 → 매핑 테이블 필요)
- 비행 이력은 전날 이전만 조회 가능 (당일 이력 불가)
- 상업적 사용 시 별도 문의 필요

### 2.4 향후 전환 계획

```
Phase 1 (현재 ~ 유저 확보): OpenSky (무료)
  → 위치 기반 추론으로 MVP 운영
  
Phase 2 (구독자 25명+): FlightAware AeroAPI Standard ($100/월)
  → 정확한 딜레이/캔슬 정보 추가
  → 웹훅으로 실시간 알림
  → 인바운드 항편 연결 정보

Phase 3 (구독자 100명+): FlightAware Premium
  → Foresight 예측 ETA
  → B2B 기능
```

---

## 3. OpenSky API 상세

### 3.1 핵심 엔드포인트: State Vectors

```
GET https://opensky-network.org/api/states/all?icao24={icao24_address}
```

### 3.2 응답 필드 및 MFA 활용도

| Index | 필드 | 타입 | 설명 | MFA 활용 |
|:---|:---|:---|:---|:---|
| 0 | `icao24` | string | ICAO 24-bit 주소 (hex) | ⭐ 기체 식별 |
| 1 | `callsign` | string | 콜사인 (8글자) | ⭐ 편명 매핑 |
| 2 | `origin_country` | string | 등록 국가 | - |
| 3 | `time_position` | int | 마지막 위치 업데이트 (Unix) | ✅ 데이터 신선도 |
| 4 | `last_contact` | int | 마지막 신호 (Unix) | ✅ 통신 상태 |
| 5 | `longitude` | float | 경도 (WGS-84) | ⭐ 현재 위치 |
| 6 | `latitude` | float | 위도 (WGS-84) | ⭐ 현재 위치 |
| 7 | `baro_altitude` | float | 기압 고도 (미터) | ⭐ 비행 단계 판단 |
| 8 | `on_ground` | boolean | 지상 여부 | ⭐ 출발/도착 감지 |
| 9 | `velocity` | float | 대지속도 (m/s) | ⭐ ETA 계산 |
| 10 | `true_track` | float | 진행 방향 (도) | ✅ 지도 표시/홀딩 감지 |
| 11 | `vertical_rate` | float | 수직속도 (m/s) | ⭐ 비행 단계 판단 |
| 12 | `sensors` | int[] | 수신기 ID | - |
| 13 | `geo_altitude` | float | GPS 고도 (미터) | △ 보조 |
| 14 | `squawk` | string | 스쿽 코드 | △ 참고용 |
| 15 | `spi` | boolean | 특수목적 표시 | - |
| 16 | `position_source` | int | 위치 소스 | △ 데이터 품질 |
| 17 | `category` | int | 항공기 카테고리 | △ |

### 3.3 기타 엔드포인트

| 엔드포인트 | 실시간 | 설명 | MFA 활용 |
|:---|:---|:---|:---|
| `GET /states/all` | ✅ | 현재 비행 상태 | ⭐ 핵심 |
| `GET /flights/aircraft` | ❌ (전날~) | 기체별 비행 이력 | △ 과거 데이터 분석용 |
| `GET /flights/arrival` | ❌ (전날~) | 공항 도착 이력 | △ |
| `GET /flights/departure` | ❌ (전날~) | 공항 출발 이력 | △ |
| `GET /tracks` | △ 실험적 | 비행 궤적 | △ 불안정 |

### 3.4 API 제한사항

| 유저 타입 | 크레딧/일 | 시간 해상도 | 과거 조회 |
|:---|:---|:---|:---|
| 비인증 | 400 | 10초 | 불가 |
| 인증 유저 | 4,000 | 5초 | 1시간 |
| ADS-B 피더 | 8,000 | 5초 | 1시간 |

**크레딧 사용량:** 좁은 영역 조회 (< 500x500km) = 1크레딧, 전체 = 4크레딧

### 3.5 테일넘버 → icao24 매핑

OpenSky는 테일넘버(N번호)로 직접 조회 불가. icao24 주소가 필요.

**매핑 방법:**

| 방법 | 설명 | 적합성 |
|:---|:---|:---|
| FAA N-Number 데이터베이스 | 공개 데이터, N번호 → icao24 변환 | ✅ |
| OpenSky 메타데이터 DB | registration → icao24 매핑 | ✅ |
| 정적 매핑 테이블 | 항공사별 기체 목록 사전 구축 | ✅ 초기 MVP |

```python
# 예시: 정적 매핑 테이블
TAIL_TO_ICAO24 = {
    "N123SW": "a1b2c3",
    "N456SW": "d4e5f6",
    # ... SkyWest 기체 목록
}

def get_icao24(tail_number: str) -> str:
    return TAIL_TO_ICAO24.get(tail_number)
```

**향후 개선:** FAA DB에서 자동 업데이트하는 배치 프로세스 구축

---

## 4. 비행 단계(Phase) 추정 로직

### 4.1 정의된 비행 단계

| 페이즈 | 아이콘 | 설명 |
|:---|:---|:---|
| GATE_DEPARTURE | 🅿️ | 출발 공항 대기 (지상, 출발 공항 근처) |
| TAKEOFF | 🛫 | 이륙 직후 |
| CLIMBING | ⬆️ | 상승 중 |
| CRUISE | ✈️ | 순항 (수평 비행, 높은 고도) |
| STEP_DESCENT | ↕️ | 일시적 고도 변경 (ATC 지시/트래픽 분리 추정) |
| LEVEL_OFF | ➡️ | 하강 후 중간 고도 레벨오프 |
| RECLIMB | ↗️ | 하강 후 재상승 (고도 재배정) |
| INITIAL_DESCENT | ⬇️ | TOD 이후 초기 하강 |
| APPROACH | 🔽 | 어프로치 (도착 공항 40nm 이내 + 지속 하강) |
| FINAL | 🛬 | 파이널 (도착 공항 12nm 이내) |
| HOLDING | 🔄 | 홀딩 패턴 추정 |
| ARRIVED | ✅ | 도착 완료 (지상, 도착 공항 근처) |

### 4.2 핵심 판단 원칙

**"하강 = 어프로치"가 아니다.**

하강이 어프로치가 아닌 케이스:
- ATC 트래픽 분리 지시 (중간 고도 하강 후 레벨오프)
- 난기류 회피 (일시적 고도 변경 후 원래 고도 복귀)
- Step descent (순항 중 고도 조정)

**진짜 어프로치 판단 기준:**
- 도착 공항까지 거리가 가까움 (40nm 이내)
- 2분 이상 지속적 하강
- 최고 고도 대비 상당한 고도 소실 (50%+)
- 고도 10,000ft 이하

### 4.3 페이즈 추정 로직

```python
from enum import Enum
from dataclasses import dataclass
from typing import List, Optional
import math

class Phase(Enum):
    GATE_DEPARTURE = "gate_departure"
    TAKEOFF = "takeoff"
    CLIMBING = "climbing"
    CRUISE = "cruise"
    STEP_DESCENT = "step_descent"
    LEVEL_OFF = "level_off"
    RECLIMB = "reclimb"
    INITIAL_DESCENT = "initial_descent"
    APPROACH = "approach"
    FINAL = "final"
    HOLDING = "holding"
    ARRIVED = "arrived"

PHASE_DISPLAY = {
    Phase.GATE_DEPARTURE:  ("🅿️", "출발 공항 대기"),
    Phase.TAKEOFF:         ("🛫", "이륙"),
    Phase.CLIMBING:        ("⬆️", "상승 중"),
    Phase.CRUISE:          ("✈️", "순항 중"),
    Phase.STEP_DESCENT:    ("↕️", "고도 변경 (ATC 지시 추정)"),
    Phase.LEVEL_OFF:       ("➡️", "중간 고도 레벨오프"),
    Phase.RECLIMB:         ("↗️", "재상승"),
    Phase.INITIAL_DESCENT: ("⬇️", "하강 시작"),
    Phase.APPROACH:        ("🔽", "어프로치 (추정)"),
    Phase.FINAL:           ("🛬", "파이널"),
    Phase.HOLDING:         ("🔄", "홀딩 추정"),
    Phase.ARRIVED:         ("✅", "도착 완료"),
}

@dataclass
class FlightState:
    time: int               # Unix timestamp
    lat: float              # 위도
    lon: float              # 경도
    altitude: float         # 기압 고도 (ft)
    velocity: float         # 대지속도 (kts)
    vertical_rate: float    # 수직속도 (fpm)
    true_track: float       # 진행 방향 (도)
    on_ground: bool         # 지상 여부
    dist_to_arr: float      # 도착 공항까지 거리 (nm)
    dist_from_dep: float    # 출발 공항에서 거리 (nm)


class FlightPhaseEstimator:
    """비행 단계 추정기 — ADS-B 데이터 기반"""
    
    def __init__(self, total_distance: float):
        """
        Args:
            total_distance: 출발~도착 공항 간 총 거리 (nm)
        """
        self.total_dist = total_distance
        self.history: List[FlightState] = []
        self.max_alt: float = 0  # 이번 비행 최고 고도
    
    def update(self, state: FlightState):
        """새 상태 데이터 추가 (10분 버퍼 유지)"""
        self.history.append(state)
        self.max_alt = max(self.max_alt, state.altitude)
        
        # 최근 10분치만 유지
        cutoff = state.time - 600
        self.history = [s for s in self.history if s.time > cutoff]
    
    def estimate(self, state: FlightState) -> Phase:
        """현재 비행 단계를 추정"""
        progress = 1 - (state.dist_to_arr / self.total_dist) if self.total_dist > 0 else 0
        
        # ── 지상 판단 ──
        if state.on_ground:
            if state.dist_to_arr > self.total_dist * 0.5:
                return Phase.GATE_DEPARTURE
            return Phase.ARRIVED
        
        # ── 홀딩 감지 (히스토리 기반) ──
        if self._is_holding():
            return Phase.HOLDING
        
        # ── 이륙 직후 ──
        if progress < 0.05 and state.vertical_rate > 500:
            return Phase.TAKEOFF
        
        # ── 상승 중 (vr > 300 fpm) ──
        if state.vertical_rate > 300:
            if self._was_descending_recently():
                return Phase.RECLIMB
            return Phase.CLIMBING
        
        # ── 수평 비행 (|vr| < 300 fpm) ──
        if abs(state.vertical_rate) < 300:
            if progress < 0.7:
                return Phase.CRUISE
            if self._is_level_after_descent():
                return Phase.LEVEL_OFF
            return Phase.CRUISE
        
        # ── 하강 중 (vr < -300 fpm) ──
        return self._classify_descent(state, progress)
    
    def _classify_descent(self, state: FlightState, progress: float) -> Phase:
        """하강의 종류를 분류 — 핵심 로직"""
        
        alt_lost_pct = (
            (self.max_alt - state.altitude) / self.max_alt 
            if self.max_alt > 0 else 0
        )
        
        # ── 파이널 ──
        if state.dist_to_arr < 12 and state.altitude < 4000:
            return Phase.FINAL
        
        # ── 어프로치 ──
        # 조건: 가까움 + 낮음 + 지속 하강
        if (state.dist_to_arr < 40 
                and state.altitude < 10000
                and self._is_continuous_descent(min_duration=120)):
            return Phase.APPROACH
        
        # ── 초기 하강 (TOD 이후) ──
        # 조건: 진행률 높음 + 최고 고도 대비 30%+ 소실 + 지속 하강
        if (progress > 0.6 
                and alt_lost_pct > 0.3
                and self._is_continuous_descent(min_duration=60)):
            return Phase.INITIAL_DESCENT
        
        # ── 일시적 고도 변경 (트래픽/ATC) ──
        # 위 조건 미충족 → 일시적 하강으로 판단
        return Phase.STEP_DESCENT
    
    # ── 히스토리 기반 보조 판단 메서드 ──
    
    def _is_continuous_descent(self, min_duration: int) -> bool:
        """최근 N초간 지속적으로 하강했는지"""
        if not self.history:
            return False
        recent = [
            s for s in self.history 
            if s.time > self.history[-1].time - min_duration
        ]
        if len(recent) < 3:
            return False
        return all(s.vertical_rate < -200 for s in recent)
    
    def _was_descending_recently(self) -> bool:
        """직전에 하강 중이었는지 (재상승 판단용)"""
        if len(self.history) < 5:
            return False
        prev = self.history[-5:-1]
        return any(s.vertical_rate < -500 for s in prev)
    
    def _is_level_after_descent(self) -> bool:
        """하강 후 레벨오프 했는지"""
        if len(self.history) < 8:
            return False
        older = self.history[-8:-4]
        recent = self.history[-3:]
        was_descending = any(s.vertical_rate < -500 for s in older)
        now_level = all(abs(s.vertical_rate) < 300 for s in recent)
        return was_descending and now_level
    
    def _is_holding(self) -> bool:
        """홀딩 패턴 감지 (최소 5분 데이터 필요)"""
        # 최근 5분 데이터
        if len(self.history) < 10:
            return False
        
        recent = [
            s for s in self.history 
            if s.time > self.history[-1].time - 300
        ]
        if len(recent) < 10:
            return False
        
        # 조건 1: 고도 변화 적음 (< 300ft)
        alts = [s.altitude for s in recent]
        if max(alts) - min(alts) > 300:
            return False
        
        # 조건 2: 헤딩 누적 변화 300°+ (회전 패턴)
        total_heading_change = 0
        for i in range(1, len(recent)):
            diff = recent[i].true_track - recent[i-1].true_track
            diff = (diff + 180) % 360 - 180  # -180~180 정규화
            total_heading_change += abs(diff)
        if total_heading_change < 300:
            return False
        
        # 조건 3: 위치가 좁은 범위 (< ~10nm)
        lats = [s.lat for s in recent]
        lons = [s.lon for s in recent]
        if max(lats) - min(lats) > 0.15 or max(lons) - min(lons) > 0.15:
            return False
        
        # 조건 4: 도착 공항에 가까워지지 않음
        first_dist = recent[0].dist_to_arr
        last_dist = recent[-1].dist_to_arr
        if first_dist - last_dist > 5:  # 5nm 이상 접근 → 홀딩 아님
            return False
        
        return True
```

### 4.4 하강 분류 판단 기준 요약

| 판단 요소 | 일시적 고도변경 (STEP_DESCENT) | 초기 하강 (INITIAL_DESCENT) | 어프로치 (APPROACH) | 파이널 (FINAL) |
|:---|:---|:---|:---|:---|
| 하강 지속 시간 | < 1분 또는 불규칙 | 1분+ 연속 | 2분+ 연속 | - |
| 도착까지 거리 | 무관 (보통 먼 거리) | 40nm+ | < 40nm | < 12nm |
| 고도 | 높음 | 중간 | < 10,000ft | < 4,000ft |
| 최고 고도 대비 | 소폭 (< 30%) | 대폭 (> 30%) | 대폭 (> 50%) | - |
| 진행률 | 무관 | > 60% | > 75% | > 95% |
| 하강 후 행동 | 레벨오프 or 재상승 | 계속 하강 | 계속 하강 | 착륙 |

---

## 5. 짧은 레그 처리

### 5.1 문제

리저널 항공 특성상 100nm 이하의 짧은 레그가 빈번함 (예: PHX→TUS, PHX→YUM, PHX→FLG).

절대 거리 기준으로 페이즈를 판단하면:
- 50nm 기준 "어프로치" → 이륙 5분 만에 어프로치 판정
- 순항 고도 자체가 낮아 고도 기준도 무의미
- 상승 끝나자마자 바로 하강 시작

### 5.2 해결: 거리 비율 기반 스케일링

절대 거리 대신 **총 비행 거리 대비 진행률(progress)**을 사용:

```python
progress = 1 - (dist_to_arrival / total_distance)
```

| 진행률 | 상태 | 짧은 레그 (100nm) | 긴 레그 (500nm) |
|:---|:---|:---|:---|
| 0~5% | 이륙 | ~5nm | ~25nm |
| 5~20% | 상승 | ~20nm | ~100nm |
| 20~75% | 엔루트 | 20~75nm | 100~375nm |
| 75~95% | 하강/어프로치 | 마지막 25nm | 마지막 125nm |
| 95%+ | 파이널 | 마지막 5nm | 마지막 25nm |

### 5.3 초단거리 예외 처리

비행시간 45분 이하(~150nm 이하)인 경우 세부 단계 표시를 간소화:

```python
def should_simplify_display(total_distance: float) -> bool:
    """초단거리 비행은 간소화된 표시 사용"""
    return total_distance < 150  # nm

# 간소화 시:
# - 세부 단계(STEP_DESCENT, LEVEL_OFF 등) 생략
# - 프로그레스 바 + 예상 도착만 표시
# - "단거리 비행 — 약 XX분 후 도착 예상"
```

---

## 6. ETA(예상 도착 시간) 계산

### 6.1 문제: 실시간 속도 기반 ETA의 불안정성

```
상승 중 (180kts): "38분 후 도착"
순항 진입 (320kts): "18분 후 도착"  ← 갑자기 줄어듦
감속 시작 (250kts): "24분 후 도착"  ← 다시 늘어남
```

단순 `남은 거리 / 현재 속도`는 페이즈 전환 시 ETA가 널뛰기함.

### 6.2 해결: 하이브리드 ETA 모델

**핵심 원칙: 스케줄 비행시간을 기본값으로 깔고, 실측으로 보정한다.**

스케줄 블록타임은 이미 항공사가 수백 번의 운항 데이터로 만든 평균값이므로,
자체 데이터 3~5회 평균보다 더 정확함.

```python
from datetime import datetime, timedelta


def calculate_eta(
    scheduled_dep: datetime,
    scheduled_arr: datetime,
    actual_dep: Optional[datetime],  # on_ground false 전환 시점
    progress: float,                  # 0.0 ~ 1.0
    dist_remaining: float,            # nm
    current_speed: float,             # kts
) -> datetime:
    """하이브리드 ETA 계산"""
    
    scheduled_flight_min = (scheduled_arr - scheduled_dep).total_seconds() / 60
    now = datetime.utcnow()
    
    # ── 출발 전: 스케줄 시간 그대로 ──
    if actual_dep is None:
        return scheduled_arr
    
    # ── 기본 ETA: 실제 출발 + 스케줄 비행시간 ──
    base_eta = actual_dep + timedelta(minutes=scheduled_flight_min)
    
    # ── 어프로치 이후 (75%+): 실측 기반이 더 정확 ──
    if progress > 0.75 and current_speed > 0:
        remaining_min = (dist_remaining / current_speed) * 60
        return now + timedelta(minutes=remaining_min)
    
    # ── 엔루트 (20~75%): 스케줄 기반 + 진행률 보정 ──
    if progress > 0.2:
        elapsed_min = (now - actual_dep).total_seconds() / 60
        expected_progress = elapsed_min / scheduled_flight_min
        deviation = progress - expected_progress
        # 예상보다 빠르면 ETA 앞당기고, 느리면 늦추고
        adjustment_min = deviation * scheduled_flight_min * 0.5
        return base_eta - timedelta(minutes=adjustment_min)
    
    # ── 상승 중: 스케줄 기반 ETA ──
    return base_eta
```

### 6.3 페이즈별 ETA 전략 요약

| 페이즈 | ETA 방식 | 안정성 | 이유 |
|:---|:---|:---|:---|
| 출발 전 | 스케줄 시간 그대로 | ⭐⭐⭐ | 정보 없음 |
| 이륙/상승 | 실제 출발 + 스케줄 비행시간 | ⭐⭐⭐ | 가장 안정적 |
| 순항 | 위 + 진행률 미세 보정 | ⭐⭐ | 실제 진행 반영 |
| 어프로치 이후 | 남은 거리 / 현재 속도 | ⭐⭐ | 속도 안정적이므로 실측이 더 정확 |
| 파이널 (5분 이내) | "약 X분 후 도착" | ⭐⭐⭐ | 거의 확정 |
| 홀딩 감지 시 | "지연 가능성 있음" | - | 정확한 시간 추정 불가 |

### 6.4 향후 개선 (데이터 축적 후)

비행 데이터가 충분히 쌓이면 **노선별 시간-거리 커브**로 업그레이드:

```
PHX→DFW 과거 데이터 (10회+ 축적)

거리 진행률    시간 경과 비율
  10%     →     15%    (상승이라 느림)
  50%     →     55%    (순항 들어가서 빠름)
  90%     →     85%    (감속 시작)
```

이 커브를 적용하면 단순 비율 대비 정확도 향상.

---

## 7. 홀딩 패턴 감지

### 7.1 홀딩의 ADS-B 시그니처

| 특성 | 값 |
|:---|:---|
| 고도 | 거의 일정 (±300ft) |
| 헤딩 | 지속적 변화 (5분 내 300°+ 누적) |
| 위치 | 좁은 범위에 머무름 (< ~10nm) |
| 속도 | 일정 (보통 200~230kts) |
| 도착 공항 접근 | 없음 (거리 변화 < 5nm) |

### 7.2 감지 제한사항

- 최소 5분 데이터 필요 (홀딩 진입 즉시 감지 불가)
- 프로시저 턴과 구분 어려울 수 있음
- 레이스트랙 형태가 아닌 특수 홀딩은 감지 어려움

### 7.3 로직

`FlightPhaseEstimator._is_holding()` 메서드 참조 (섹션 4.3)

---

## 8. 대시보드 UI 설계 (안)

### 8.1 일반 비행 (긴 레그)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✈️ N123SW → SLC
  ○━━━━━━━━━━━━━━━●━━━━━━━○
  PHX               ↑          SLC

  📍 상태:  ↕️ 고도 변경 (추정)
           FL350 → FL240 하강 중
           · 도착공항까지 180nm
           · 지속 하강 아님 — ATC 지시 추정

  📊 데이터:
     고도    FL287 ↓ (-1,800fpm)
     속도    310kts
     진행    62%

  ⏱️ 예상:  14:08 UTC 도착
            (스케줄 14:00 — 약 8분 지연 추정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ※ 비행 단계는 ADS-B 데이터 기반 추정값입니다
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 8.2 어프로치 중

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✈️ N123SW → SLC
  ○━━━━━━━━━━━━━━━━━━━━━●━━○
  PHX                       ↑  SLC

  📍 상태:  🔽 어프로치 (추정)
           2분+ 지속 하강 중
           · 도착공항까지 28nm
           · 고도 8,200ft ↓

  📊 데이터:
     고도    8,200ft ↓ (-1,400fpm)
     속도    250kts
     진행    94%

  ⏱️ 예상:  ~8분 후 도착
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 8.3 홀딩 감지

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✈️ N123SW → SLC
  ○━━━━━━━━━━━━━━━━━━●🔄━━━○
  PHX                  ↑홀딩     SLC

  📍 상태:  🔄 홀딩 추정 (SLC 25nm 부근)
           · 고도 11,000ft 유지
           · 5분+ 동일 구역 체류 중

  📊 데이터:
     고도    11,000ft (유지)
     속도    210kts

  ⏱️ 예상:  지연 가능성 있음
  ⚠️ 홀딩 패턴 감지 — 도착 지연 예상
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 8.4 짧은 레그 (간소화)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✈️ N456SW  PHX → TUS
  ○━━━━━━━━━●━━━○
  PHX       ↑      TUS

  진행:  68% (32nm 남음)
  고도:  FL180 ↓ (-1,400fpm)
  속도:  290kts
  예상:  ~7분 후 도착
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 8.5 출발 대기 중

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✈️ N123SW → SLC
  ●━━━━━━━━━━━━━━━━━━━━━━━○
  PHX (지상)                SLC

  📍 상태:  🅿️ 출발 공항 대기
           PHX 게이트/램프 (추정)

  ⏱️ 예상:  스케줄 도착 14:00 UTC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 9. 통합 정보 화면

### 9.1 MFA의 차별화 포인트

**"인바운드 추적 + 기상 + 듀티 리밋을 한 화면에"** — 다른 어떤 앱에도 없는 조합.

| 정보 | 소스 | 상태 |
|:---|:---|:---|
| 인바운드 위치/속도/고도 | OpenSky API | 구현 중 |
| 도착 공항 METAR/TAF | AWC | 구현 완료 |
| 도착 공항 NOTAM | FAA API / 대안 | 추가 예정 |
| FAR 117 듀티 리밋 | 자체 계산 | 구현 완료 |

### 9.2 결합 시나리오 예시

파일럿이 한 화면에서:
- 인바운드가 어프로치 중 → "곧 오겠네"
- METAR에 눈 → "디아이싱 시간 추가될 수 있겠다"
- 듀티 리밋 2시간 남음 → "딜레이되면 듀티 초과 위험"

이 맥락을 **파일럿이 종합 판단** → 앱보다 정확한 결론.

---

## 10. 기술 구현 참고사항

### 10.1 OpenSky 폴링 전략

```python
# 인바운드 추적 폴링 간격
POLLING_INTERVALS = {
    "출발 4시간+ 전": None,          # 폴링 안 함
    "출발 4시간~1시간 전": 300,       # 5분 간격
    "출발 1시간~15분 전": 60,         # 1분 간격
    "출발 15분 전~도착": 15,          # 15초 간격
}
```

### 10.2 크레딧 사용량 예상

- 유저 1명, 하루 2~3 레그
- 레그당 폴링: 약 50~80회
- 하루 총: 약 150~240 크레딧
- 한도 4,000 크레딧 → **유저 약 16~25명까지 커버 가능**

### 10.3 데이터 변환 유틸리티

```python
# OpenSky 원시 데이터 → MFA 내부 단위 변환
def meters_to_feet(m: float) -> float:
    return m * 3.28084

def mps_to_knots(mps: float) -> float:
    return mps * 1.94384

def mps_to_fpm(mps: float) -> float:
    """m/s → ft/min (수직속도)"""
    return mps * 196.85

def haversine_nm(lat1, lon1, lat2, lon2) -> float:
    """두 좌표 간 거리 (nm)"""
    R = 3440.065  # 지구 반지름 (nm)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2)**2 + 
         math.cos(math.radians(lat1)) * 
         math.cos(math.radians(lat2)) * 
         math.sin(dlon/2)**2)
    return R * 2 * math.asin(math.sqrt(a))
```

---

## 11. 알려진 제한사항 및 면책

### 11.1 감지 가능 vs 불가능

| 감지 가능 | 감지 어려움 |
|:---|:---|
| 상승/순항/하강 단계 | 벡터링 vs 정상 어프로치 |
| 홀딩 패턴 (3~5분 후) | 홀딩 진입 즉시 |
| 출발/도착 (on_ground) | 미스드 어프로치 (즉시) |
| 대략적 진행률 | 정확한 남은 비행시간 |
| ATC 고도 변경 (추정) | 고도 변경의 정확한 사유 |

### 11.2 면책 조항 (앱 내 표시)

모든 비행 단계 정보에 다음을 명시:

> **※ 비행 단계는 ADS-B 데이터 기반 추정값입니다. 운항 결정에 이 정보를 단독으로 사용하지 마십시오.**

---

## 부록 A. API 전환 시 변경점

OpenSky → FlightAware 전환 시 로직 변경 최소화를 위한 추상화:

```python
from abc import ABC, abstractmethod

class FlightDataProvider(ABC):
    """비행 데이터 소스 추상화"""
    
    @abstractmethod
    def get_aircraft_state(self, identifier: str) -> Optional[FlightState]:
        """항공기 현재 상태 조회"""
        pass
    
    @abstractmethod
    def get_delay_info(self, flight_number: str) -> Optional[dict]:
        """딜레이 정보 (지원하는 API만)"""
        pass

class OpenSkyProvider(FlightDataProvider):
    def get_aircraft_state(self, icao24: str) -> Optional[FlightState]:
        # OpenSky API 호출 + FlightState 변환
        pass
    
    def get_delay_info(self, flight_number: str) -> Optional[dict]:
        return None  # OpenSky는 딜레이 정보 미제공

class FlightAwareProvider(FlightDataProvider):
    def get_aircraft_state(self, tail_number: str) -> Optional[FlightState]:
        # FlightAware AeroAPI 호출 + FlightState 변환
        pass
    
    def get_delay_info(self, flight_number: str) -> Optional[dict]:
        # 딜레이/캔슬/게이트 정보 반환
        pass
```

이렇게 추상화해두면 **데이터 소스만 교체하고 페이즈 추정/ETA 로직은 그대로** 사용 가능.
