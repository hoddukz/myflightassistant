# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/routers/flight.py

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.flight_tracker import get_tracker_status, track_inbound

router = APIRouter()


@router.get("/track")
async def track_flight(
    tail_number: Optional[str] = Query(None, description="항공기 등록번호 (e.g. N728SK)"),
    flight_number: Optional[str] = Query(None, description="편명 (e.g. DL5678)"),
    provider: Optional[str] = Query(None, description="API provider: opensky | aviationstack | flightlabs"),
    destination: Optional[str] = Query(None, description="도착 공항 IATA (ETA 계산용, e.g. PHX)"),
    origin: Optional[str] = Query(None, description="출발 공항 IATA (비행 단계 추정용)"),
    scheduled_dep: Optional[str] = Query(None, description="스케줄 출발시간 ISO 8601 (하이브리드 ETA용)"),
    scheduled_arr: Optional[str] = Query(None, description="스케줄 도착시간 ISO 8601 (하이브리드 ETA용)"),
):
    """Inbound 항공기를 추적한다. 비행 단계 추정 + 하이브리드 ETA 포함."""
    if not tail_number and not flight_number:
        raise HTTPException(
            status_code=400,
            detail="tail_number 또는 flight_number 중 최소 하나 필수",
        )
    return await track_inbound(
        tail_number=tail_number,
        flight_number=flight_number,
        provider=provider,
        destination=destination,
        origin=origin,
        scheduled_dep=scheduled_dep,
        scheduled_arr=scheduled_arr,
    )


@router.get("/status")
async def tracker_status():
    """설정된 flight tracker provider 목록을 반환한다."""
    return get_tracker_status()
