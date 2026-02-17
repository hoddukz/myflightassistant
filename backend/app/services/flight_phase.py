# Tag: core
# Path: backend/app/services/flight_phase.py

"""
비행 단계(Phase) 추정 엔진 — ADS-B 데이터 기반

12단계 비행 단계를 히스토리 기반으로 추정하며,
하이브리드 ETA 계산과 홀딩 패턴 감지를 포함한다.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional


# ─────────── 비행 단계 정의 ───────────

class Phase(str, Enum):
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


PHASE_DISPLAY: dict[Phase, tuple[str, str]] = {
    Phase.GATE_DEPARTURE:  ("P", "At Gate"),
    Phase.TAKEOFF:         ("TO", "Takeoff"),
    Phase.CLIMBING:        ("CLB", "Climbing"),
    Phase.CRUISE:          ("CRZ", "Cruise"),
    Phase.STEP_DESCENT:    ("SD", "Step Descent (ATC)"),
    Phase.LEVEL_OFF:       ("LVL", "Level Off"),
    Phase.RECLIMB:         ("RCL", "Reclimb"),
    Phase.INITIAL_DESCENT: ("DES", "Descending"),
    Phase.APPROACH:        ("APR", "Approach"),
    Phase.FINAL:           ("FNL", "Final"),
    Phase.HOLDING:         ("HLD", "Holding"),
    Phase.ARRIVED:         ("ARR", "Arrived"),
}


# ─────────── 단위 변환 유틸리티 ───────────

def meters_to_feet(m: float) -> float:
    return m * 3.28084


def mps_to_knots(mps: float) -> float:
    return mps * 1.94384


def mps_to_fpm(mps: float) -> float:
    """m/s → ft/min (수직속도)"""
    return mps * 196.85


def haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 좌표 간 거리 (nm)"""
    R = 3440.065
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


# ─────────── 비행 상태 데이터 ───────────

@dataclass
class FlightState:
    time: int  # Unix timestamp
    lat: float
    lon: float
    altitude: float  # ft
    velocity: float  # kts
    vertical_rate: float  # fpm
    true_track: float  # 도
    on_ground: bool
    dist_to_arr: float  # nm
    dist_from_dep: float  # nm


# ─────────── 비행 단계 추정기 ───────────

class FlightPhaseEstimator:
    """비행 단계 추정기 — ADS-B 데이터 기반"""

    def __init__(self, total_distance: float):
        self.total_dist = total_distance
        self.history: list[FlightState] = []
        self.max_alt: float = 0

    def update(self, state: FlightState) -> None:
        """새 상태 데이터 추가 (10분 버퍼 유지)"""
        self.history.append(state)
        self.max_alt = max(self.max_alt, state.altitude)

        # 최근 10분치만 유지
        cutoff = state.time - 600
        self.history = [s for s in self.history if s.time > cutoff]

    def estimate(self, state: FlightState) -> Phase:
        """현재 비행 단계를 추정"""
        progress = (
            1 - (state.dist_to_arr / self.total_dist) if self.total_dist > 0 else 0
        )

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

    def get_progress(self, state: FlightState) -> float:
        """비행 진행률 (0.0 ~ 1.0)"""
        if self.total_dist <= 0:
            return 0.0
        return max(0.0, min(1.0, 1 - (state.dist_to_arr / self.total_dist)))

    # ── 하강 분류 ──

    def _classify_descent(self, state: FlightState, progress: float) -> Phase:
        alt_lost_pct = (
            (self.max_alt - state.altitude) / self.max_alt if self.max_alt > 0 else 0
        )

        # 파이널
        if state.dist_to_arr < 12 and state.altitude < 4000:
            return Phase.FINAL

        # 어프로치
        if (
            state.dist_to_arr < 40
            and state.altitude < 10000
            and self._is_continuous_descent(min_duration=120)
        ):
            return Phase.APPROACH

        # 초기 하강 (TOD 이후)
        if (
            progress > 0.6
            and alt_lost_pct > 0.3
            and self._is_continuous_descent(min_duration=60)
        ):
            return Phase.INITIAL_DESCENT

        # 일시적 고도 변경
        return Phase.STEP_DESCENT

    # ── 히스토리 기반 보조 판단 ──

    def _is_continuous_descent(self, min_duration: int) -> bool:
        if not self.history:
            return False
        recent = [
            s
            for s in self.history
            if s.time > self.history[-1].time - min_duration
        ]
        if len(recent) < 3:
            return False
        return all(s.vertical_rate < -200 for s in recent)

    def _was_descending_recently(self) -> bool:
        if len(self.history) < 5:
            return False
        prev = self.history[-5:-1]
        return any(s.vertical_rate < -500 for s in prev)

    def _is_level_after_descent(self) -> bool:
        if len(self.history) < 8:
            return False
        older = self.history[-8:-4]
        recent = self.history[-3:]
        was_descending = any(s.vertical_rate < -500 for s in older)
        now_level = all(abs(s.vertical_rate) < 300 for s in recent)
        return was_descending and now_level

    def _is_holding(self) -> bool:
        """홀딩 패턴 감지 (최소 5분 데이터 필요)"""
        if len(self.history) < 10:
            return False

        recent = [
            s for s in self.history if s.time > self.history[-1].time - 300
        ]
        if len(recent) < 10:
            return False

        # 고도 변화 적음 (< 300ft)
        alts = [s.altitude for s in recent]
        if max(alts) - min(alts) > 300:
            return False

        # 헤딩 누적 변화 300°+
        total_heading_change = 0.0
        for i in range(1, len(recent)):
            diff = recent[i].true_track - recent[i - 1].true_track
            diff = (diff + 180) % 360 - 180
            total_heading_change += abs(diff)
        if total_heading_change < 300:
            return False

        # 위치가 좁은 범위 (< ~10nm)
        lats = [s.lat for s in recent]
        lons = [s.lon for s in recent]
        if max(lats) - min(lats) > 0.15 or max(lons) - min(lons) > 0.15:
            return False

        # 도착 공항에 가까워지지 않음
        first_dist = recent[0].dist_to_arr
        last_dist = recent[-1].dist_to_arr
        if first_dist - last_dist > 5:
            return False

        return True


# ─────────── 하이브리드 ETA 계산 ───────────

def calculate_hybrid_eta(
    scheduled_dep: Optional[datetime],
    scheduled_arr: Optional[datetime],
    actual_dep: Optional[datetime],
    progress: float,
    dist_remaining: float,
    current_speed: float,
) -> Optional[datetime]:
    """
    하이브리드 ETA 계산.

    스케줄 비행시간을 기본값으로 깔고, 실측으로 보정한다.
    스케줄 정보가 없으면 단순 거리/속도 기반 ETA를 반환한다.
    """
    now = datetime.now(timezone.utc)

    # 스케줄 정보가 없으면 단순 계산
    if not scheduled_dep or not scheduled_arr:
        if current_speed > 0 and dist_remaining > 0:
            remaining_min = (dist_remaining / current_speed) * 60
            return now + timedelta(minutes=remaining_min)
        return None

    scheduled_flight_min = (scheduled_arr - scheduled_dep).total_seconds() / 60

    # 거리/속도 기반 ETA (sanity check용)
    speed_eta = None
    speed_remaining_min = None
    if current_speed > 0 and dist_remaining > 0:
        speed_remaining_min = (dist_remaining / current_speed) * 60
        speed_eta = now + timedelta(minutes=speed_remaining_min)

    # 출발 전: 스케줄 시간 그대로
    if actual_dep is None:
        return scheduled_arr

    # 기본 ETA: 실제 출발 + 스케줄 비행시간
    base_eta = actual_dep + timedelta(minutes=scheduled_flight_min)

    # 어프로치 이후 (75%+): 실측 기반이 더 정확
    if progress > 0.75 and speed_eta:
        return speed_eta

    # 엔루트 (20~75%): 스케줄 기반 + 진행률 보정
    if progress > 0.2 and scheduled_flight_min > 0:
        elapsed_min = (now - actual_dep).total_seconds() / 60
        expected_progress = elapsed_min / scheduled_flight_min
        deviation = progress - expected_progress
        adjustment_min = deviation * scheduled_flight_min * 0.5
        hybrid_eta = base_eta - timedelta(minutes=adjustment_min)

        # sanity check: 거리/속도 ETA와 30% 이상 차이나면 거리/속도 기반 사용
        if speed_eta and speed_remaining_min:
            hybrid_remaining = (hybrid_eta - now).total_seconds() / 60
            if hybrid_remaining > 0 and speed_remaining_min > 0:
                ratio = hybrid_remaining / speed_remaining_min
                if ratio < 0.7 or ratio > 1.3:
                    return speed_eta
        return hybrid_eta

    # 상승 중: 스케줄 기반 ETA (sanity check 적용)
    if speed_eta and speed_remaining_min:
        base_remaining = (base_eta - now).total_seconds() / 60
        if base_remaining > 0 and speed_remaining_min > 0:
            ratio = base_remaining / speed_remaining_min
            if ratio < 0.7 or ratio > 1.3:
                return speed_eta

    return base_eta


def should_simplify_display(total_distance: float) -> bool:
    """초단거리 비행은 간소화된 표시 사용 (< 150nm)"""
    return total_distance < 150
