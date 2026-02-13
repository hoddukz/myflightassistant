# Tag: core
# Path: backend/app/routers/far117.py

import asyncio
from functools import partial

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.services.far117 import Far117Calculator, pairings_to_duty_periods
from app.services.schedule_db import get_schedule

router = APIRouter()


def _compute_status(user_id: str, utc_offset: float):
    """스케줄 조회 → FAR 117 상태 계산 (동기 함수, executor용)."""
    schedule = get_schedule(user_id)
    if not schedule or not schedule.pairings:
        return None

    duty_periods = pairings_to_duty_periods(schedule.pairings)
    if not duty_periods:
        return None

    calc = Far117Calculator(
        duty_periods=duty_periods,
        utc_offset_hours=utc_offset,
    )
    return calc, duty_periods


@router.get("/status")
async def get_far117_status(
    utc_offset: float = Query(default=-7.0, description="파일럿 홈베이스 UTC 오프셋"),
    current_user: dict = Depends(get_current_user),
):
    """현재 FAR 117 상태 조회."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, partial(_compute_status, current_user["id"], utc_offset)
    )

    if result is None:
        return {
            "has_schedule": False,
            "fdp": None,
            "flight_time": None,
            "rest": None,
            "warnings": [],
        }

    calc, _ = result
    status = calc.get_current_status()

    return {
        "has_schedule": True,
        "fdp": {
            "current_hours": status.current_fdp_hours,
            "limit_hours": status.current_fdp_limit,
            "remaining_hours": status.fdp_remaining_hours,
            "legs": status.fdp_legs,
            "report_hour_local": status.report_hour_local,
            "on_duty": status.on_duty,
            "next_duty_date": status.next_duty_date,
        },
        "flight_time": {
            "last_28d": status.flight_time_28d,
            "limit_28d": status.flight_time_28d_limit,
            "last_365d": status.flight_time_365d,
            "limit_365d": status.flight_time_365d_limit,
        },
        "rest": {
            "last_rest_hours": status.last_rest_hours,
            "min_required": status.min_rest_required,
            "next_report_earliest": (
                status.next_report_earliest_utc.isoformat()
                if status.next_report_earliest_utc else None
            ),
            "longest_rest_168h": status.longest_rest_in_168h,
            "rest_56h_met": status.rest_56h_met,
        },
        "warnings": status.warnings,
    }


@router.get("/simulate/delay")
async def simulate_delay(
    minutes: int = Query(ge=0, le=600, description="딜레이 시간 (분)"),
    utc_offset: float = Query(default=-7.0, description="파일럿 홈베이스 UTC 오프셋"),
    current_user: dict = Depends(get_current_user),
):
    """딜레이 시 FDP 영향 시뮬레이션."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, partial(_compute_status, current_user["id"], utc_offset)
    )

    if result is None:
        return {
            "scenario": f"+{minutes}분 딜레이",
            "feasible": True,
            "new_fdp_hours": 0,
            "fdp_limit": 0,
            "warnings": ["No schedule data"],
        }

    calc, _ = result
    sim = calc.simulate_delay(minutes)

    return {
        "scenario": sim.scenario,
        "feasible": sim.feasible,
        "new_fdp_hours": sim.new_fdp_hours,
        "fdp_limit": sim.new_fdp_limit,
        "warnings": sim.warnings,
    }
