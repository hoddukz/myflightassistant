# Tag: core
# Path: backend/app/services/far117.py

"""
FAR 117 (14 CFR Part 117) — Flight Duty / Rest Calculator
==========================================================
MFA 백엔드용 모듈. 스케줄 데이터 기반으로 FDP/Rest/누적 한도를 계산.

⚠️ 참고용이며 공식 계산을 대체하지 않습니다.
   Augmented crew, split duty, unforeseen circumstances 등은 미지원.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.models.schemas import Pairing


# ──────────────────────────────────────────────
# FAR 117.11 Table B — FDP 상한 (시간)
# 행: report time (acclimated local), 열: 레그 수
# ──────────────────────────────────────────────

# (start_hour, end_hour): [1-2legs, 3legs, 4legs, 5legs, 6legs, 7+legs]
FDP_TABLE: list[tuple[tuple[int, int], list[float]]] = [
    ((0,  3),  [9,  9,  9,  9,  9,  9]),
    ((4,  4),  [10, 10, 10, 9,  9,  9]),
    ((5,  5),  [12, 12, 11, 11, 10, 9]),
    ((6,  6),  [13, 13, 12, 12, 11, 10]),
    ((7, 12),  [14, 14, 13, 13, 12, 11]),
    ((13, 16), [13, 13, 12, 12, 11, 10]),
    ((17, 21), [12, 12, 11, 11, 10, 9]),
    ((22, 23), [11, 11, 10, 10, 9,  9]),
]


def get_fdp_limit(report_hour_local: int, num_legs: int) -> float:
    """FAR 117.11 Table B에서 FDP 상한(시간) 조회."""
    # 컬럼: [1-2legs, 3legs, 4legs, 5legs, 6legs, 7+legs]
    if num_legs <= 2:
        col = 0
    elif num_legs >= 7:
        col = 5
    else:
        col = num_legs - 2  # 3→1, 4→2, 5→3, 6→4
    for (start, end), limits in FDP_TABLE:
        if start <= report_hour_local <= end:
            return limits[col]
    return 9.0


# ──────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────

@dataclass
class FlightLegInput:
    """스케줄에서 파싱된 한 레그."""
    flight_number: str
    origin: str
    destination: str
    depart_utc: datetime
    arrive_utc: datetime
    block_time_hours: float
    flight_date: str


@dataclass
class DutyPeriod:
    """하루 또는 연속 근무 기간."""
    report_utc: datetime
    release_utc: datetime
    legs: list[FlightLegInput] = field(default_factory=list)
    flight_date: str = ""

    @property
    def fdp_hours(self) -> float:
        delta = self.release_utc - self.report_utc
        return delta.total_seconds() / 3600

    @property
    def num_legs(self) -> int:
        return len(self.legs)

    @property
    def total_block_hours(self) -> float:
        return sum(leg.block_time_hours for leg in self.legs)


@dataclass
class RestPeriod:
    """두 duty period 사이의 레스트."""
    start_utc: datetime
    end_utc: datetime

    @property
    def duration_hours(self) -> float:
        delta = self.end_utc - self.start_utc
        return delta.total_seconds() / 3600


@dataclass
class Far117Status:
    """현재 FAR 117 상태 스냅샷."""

    # 오늘 FDP
    current_fdp_hours: float = 0.0
    current_fdp_limit: float = 0.0
    fdp_remaining_hours: float = 0.0
    fdp_legs: int = 0
    report_hour_local: int = 0

    # 누적 Flight Time
    flight_time_28d: float = 0.0
    flight_time_28d_limit: float = 100.0
    flight_time_365d: float = 0.0
    flight_time_365d_limit: float = 1000.0

    # 레스트
    last_rest_hours: float = 0.0
    min_rest_required: float = 10.0
    next_report_earliest_utc: Optional[datetime] = None

    # 168시간(7일) 내 56시간 연속 레스트
    longest_rest_in_168h: float = 0.0
    rest_56h_met: bool = False

    # 현재 상태
    on_duty: bool = False
    next_duty_date: Optional[str] = None

    # 경고
    warnings: list[str] = field(default_factory=list)


@dataclass
class WhatIfResult:
    """시뮬레이션 결과."""
    scenario: str
    feasible: bool
    new_fdp_hours: float = 0.0
    new_fdp_limit: float = 0.0
    new_flight_time_28d: float = 0.0
    warnings: list[str] = field(default_factory=list)


# ──────────────────────────────────────────────
# Calculator
# ──────────────────────────────────────────────

class Far117Calculator:
    """FAR 117 기반 듀티/레스트 계산기."""

    def __init__(
        self,
        duty_periods: list[DutyPeriod],
        utc_offset_hours: float = -7.0,
        now: Optional[datetime] = None,
    ):
        self.duty_periods = sorted(duty_periods, key=lambda d: d.report_utc)
        self.utc_offset = timedelta(hours=utc_offset_hours)
        self.now = now or datetime.now(timezone.utc)

    def _utc_to_local_hour(self, utc_dt: datetime) -> int:
        local = utc_dt + self.utc_offset
        return local.hour

    def _get_rest_periods(self) -> list[RestPeriod]:
        rests = []
        for i in range(1, len(self.duty_periods)):
            prev_release = self.duty_periods[i - 1].release_utc
            curr_report = self.duty_periods[i].report_utc
            if curr_report > prev_release:
                rests.append(RestPeriod(
                    start_utc=prev_release,
                    end_utc=curr_report,
                ))
        return rests

    def _flight_time_in_window(self, window_days: int) -> float:
        cutoff = self.now - timedelta(days=window_days)
        total = 0.0
        for dp in self.duty_periods:
            for leg in dp.legs:
                if leg.depart_utc >= cutoff and leg.depart_utc <= self.now:
                    total += leg.block_time_hours
        return round(total, 1)

    def _find_current_duty(self) -> Optional[DutyPeriod]:
        for dp in self.duty_periods:
            if dp.report_utc <= self.now <= dp.release_utc:
                return dp
        return None

    def _find_next_duty(self) -> Optional[DutyPeriod]:
        for dp in self.duty_periods:
            if dp.report_utc > self.now:
                return dp
        return None

    def _find_last_release(self) -> Optional[datetime]:
        past = [dp for dp in self.duty_periods if dp.release_utc <= self.now]
        if past:
            return max(dp.release_utc for dp in past)
        return None

    def _longest_rest_in_window(self, window_hours: int = 168) -> float:
        cutoff = self.now - timedelta(hours=window_hours)
        rests = self._get_rest_periods()
        max_rest = 0.0

        for rest in rests:
            effective_start = max(rest.start_utc, cutoff)
            effective_end = min(rest.end_utc, self.now)
            if effective_end > effective_start:
                hours = (effective_end - effective_start).total_seconds() / 3600
                max_rest = max(max_rest, hours)

        last_release = self._find_last_release()
        if last_release and last_release >= cutoff:
            current_rest = (self.now - last_release).total_seconds() / 3600
            max_rest = max(max_rest, current_rest)

        return round(max_rest, 1)

    def get_current_status(self) -> Far117Status:
        """현재 FAR 117 상태 계산."""
        status = Far117Status()
        warnings = []

        current_dp = self._find_current_duty()
        next_dp = self._find_next_duty()

        if current_dp:
            elapsed = (self.now - current_dp.report_utc).total_seconds() / 3600
            report_hour = self._utc_to_local_hour(current_dp.report_utc)
            fdp_limit = get_fdp_limit(report_hour, current_dp.num_legs)

            status.current_fdp_hours = round(elapsed, 1)
            status.current_fdp_limit = fdp_limit
            status.fdp_remaining_hours = round(fdp_limit - elapsed, 1)
            status.fdp_legs = current_dp.num_legs
            status.report_hour_local = report_hour
            status.on_duty = True

            if status.fdp_remaining_hours < 1.0 and status.fdp_remaining_hours > 0:
                warnings.append(
                    f"Less than {status.fdp_remaining_hours:.1f}h remaining until FDP limit"
                )
            if status.fdp_remaining_hours <= 0:
                warnings.append("FDP limit exceeded")

        elif next_dp:
            report_hour = self._utc_to_local_hour(next_dp.report_utc)
            fdp_limit = get_fdp_limit(report_hour, next_dp.num_legs)

            status.current_fdp_hours = 0.0
            status.current_fdp_limit = fdp_limit
            status.fdp_remaining_hours = fdp_limit
            status.fdp_legs = next_dp.num_legs
            status.report_hour_local = report_hour
            status.on_duty = False
            status.next_duty_date = next_dp.flight_date

        # 누적 Flight Time
        status.flight_time_28d = self._flight_time_in_window(28)
        status.flight_time_365d = self._flight_time_in_window(365)

        if status.flight_time_28d > 90:
            warnings.append(
                f"28-day flight time {status.flight_time_28d}h — approaching 100h limit"
            )
        if status.flight_time_28d >= 100:
            warnings.append("28-day 100h flight time limit reached")

        # 레스트
        last_release = self._find_last_release()
        if last_release and not current_dp:
            rest_hours = (self.now - last_release).total_seconds() / 3600
            status.last_rest_hours = round(rest_hours, 1)
            status.next_report_earliest_utc = last_release + timedelta(hours=10)

            if rest_hours < 10:
                warnings.append(
                    f"Minimum 10h rest not met (current {rest_hours:.1f}h)"
                )

        # 168시간 내 56시간 연속 레스트
        status.longest_rest_in_168h = self._longest_rest_in_window(168)
        status.rest_56h_met = status.longest_rest_in_168h >= 56

        if not status.rest_56h_met:
            warnings.append(
                f"Longest consecutive rest in 168h: "
                f"{status.longest_rest_in_168h:.1f}h (56h required)"
            )

        status.warnings = warnings
        return status

    def simulate_delay(self, delay_minutes: int) -> WhatIfResult:
        """딜레이 적용 시 FDP 영향 시뮬레이션."""
        current_dp = self._find_current_duty()
        target_dp = current_dp or self._find_next_duty()

        if not target_dp:
            return WhatIfResult(
                scenario=f"+{delay_minutes}분 딜레이",
                feasible=True,
                warnings=["No scheduled duty period"],
            )

        delay_td = timedelta(minutes=delay_minutes)
        new_release = target_dp.release_utc + delay_td
        new_fdp = (new_release - target_dp.report_utc).total_seconds() / 3600

        report_hour = self._utc_to_local_hour(target_dp.report_utc)
        fdp_limit = get_fdp_limit(report_hour, target_dp.num_legs)
        hard_limit = fdp_limit + 2.0

        warnings = []
        feasible = True

        if new_fdp > fdp_limit and new_fdp <= hard_limit:
            warnings.append(
                f"FDP {new_fdp:.1f}h > base limit {fdp_limit:.0f}h — "
                f"Unforeseen Circumstances extension required (PIC decision)"
            )
        elif new_fdp > hard_limit:
            warnings.append(
                f"FDP {new_fdp:.1f}h > absolute limit {hard_limit:.0f}h — cannot operate"
            )
            feasible = False

        return WhatIfResult(
            scenario=f"+{delay_minutes}분 딜레이",
            feasible=feasible,
            new_fdp_hours=round(new_fdp, 1),
            new_fdp_limit=fdp_limit,
            warnings=warnings,
        )


# ──────────────────────────────────────────────
# MFA 스케줄 데이터 → DutyPeriod 변환
# ──────────────────────────────────────────────

def pairings_to_duty_periods(pairings: list[Pairing]) -> list[DutyPeriod]:
    """MFA Pairing 모델 리스트를 DutyPeriod 목록으로 변환."""
    duty_periods = []

    for pairing in pairings:
        if pairing.event_type != "pairing":
            continue

        for day in pairing.days:
            report_utc = _parse_iso_datetime(day.report_time_utc)
            if not report_utc:
                continue

            # release_utc: report + duty_time 으로 계산
            release_utc = None
            if day.duty_time:
                duty_hours = _parse_hhmm_to_hours(day.duty_time)
                if duty_hours > 0:
                    release_utc = report_utc + timedelta(hours=duty_hours)

            # 레그 변환
            legs = []
            for leg in day.legs:
                dep_utc = _parse_iso_datetime(leg.depart_utc)
                arr_utc = _parse_iso_datetime(leg.arrive_utc)
                if not dep_utc or not arr_utc:
                    continue

                block_hours = _parse_hhmm_to_hours(leg.block_time or "0:00")

                legs.append(FlightLegInput(
                    flight_number=leg.flight_number,
                    origin=leg.origin,
                    destination=leg.destination,
                    depart_utc=dep_utc,
                    arrive_utc=arr_utc,
                    block_time_hours=block_hours,
                    flight_date=day.flight_date.isoformat(),
                ))

            # release_utc fallback: 마지막 레그 도착 + 30분
            if not release_utc and legs:
                release_utc = legs[-1].arrive_utc + timedelta(minutes=30)
            if not release_utc:
                continue

            # release가 report보다 이전이면 다음 날 (자정 넘김)
            if release_utc <= report_utc:
                release_utc += timedelta(days=1)

            duty_periods.append(DutyPeriod(
                report_utc=report_utc,
                release_utc=release_utc,
                legs=legs,
                flight_date=day.flight_date.isoformat(),
            ))

    return sorted(duty_periods, key=lambda d: d.report_utc)


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    """ISO datetime 문자열 → timezone-aware datetime(UTC)."""
    if not value:
        return None
    try:
        value = value.strip()
        # "2026-02-15T18:35:00Z" → datetime
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def _parse_hhmm_to_hours(hhmm: str) -> float:
    """'1:30' 또는 '01:30' → 1.5 (시간)."""
    if not hhmm:
        return 0.0
    parts = hhmm.strip().split(":")
    if len(parts) == 2:
        try:
            return int(parts[0]) + int(parts[1]) / 60
        except ValueError:
            return 0.0
    return 0.0
