# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/routers/schedule.py

import asyncio
from functools import partial
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.dependencies.auth import get_current_user
from app.models.schemas import FlightLegCSV, ScheduleResponse
from app.parsers.csv_parser import parse_csv
from app.parsers.ics_parser import parse_ics
from app.services.schedule_db import save_schedule, get_schedule, delete_schedule
from app.services.calendar_sync import (
    fetch_ics_content,
    sync_calendar,
    should_sync,
    get_calendar_source,
    save_calendar_url,
    delete_calendar_url,
)

router = APIRouter()


class CalendarUrlRequest(BaseModel):
    ics_url: str


class CalendarUrlResponse(BaseModel):
    ics_url: str
    last_synced_at: Optional[str] = None
    sync_enabled: bool = True


@router.post("/upload/ics", response_model=ScheduleResponse)
async def upload_ics(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """iCal(.ics) 파일을 업로드하여 파싱 후 DB에 저장한다."""
    if not file.filename or not file.filename.endswith(".ics"):
        raise HTTPException(status_code=400, detail="Only .ics files are supported")

    content = await file.read()
    try:
        pairings = parse_ics(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse ICS file: {e}")

    total_flights = sum(
        len(leg)
        for p in pairings
        for d in p.days
        for leg in [d.legs]
    )

    # DB에 저장 (스레드에서 실행하여 이벤트 루프 블로킹 방지)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, partial(save_schedule, current_user["id"], current_user["email"], pairings))

    return ScheduleResponse(
        pairings=pairings,
        total_flights=total_flights,
    )


@router.post("/upload/csv", response_model=list[FlightLegCSV])
async def upload_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """CSV 파일을 업로드하여 파싱한다."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    content = await file.read()
    try:
        legs = parse_csv(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse CSV file: {e}")

    return legs


@router.get("", response_model=ScheduleResponse)
async def get_user_schedule(
    current_user: dict = Depends(get_current_user),
):
    """DB에서 현재 사용자의 스케줄을 조회한다."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, partial(get_schedule, current_user["id"]))
    if result is None:
        return ScheduleResponse(pairings=[], total_flights=0)
    return result


@router.delete("")
async def delete_user_schedule(
    current_user: dict = Depends(get_current_user),
):
    """현재 사용자의 스케줄을 DB에서 삭제한다."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, partial(delete_schedule, current_user["id"]))
    return {"message": "Schedule deleted"}


@router.get("/sync-status")
async def get_sync_status(
    current_user: dict = Depends(get_current_user),
):
    """동기화 상태 조회. stale=true이면 프론트에서 sync-now 호출 권장."""
    source = get_calendar_source(current_user["id"])
    if not source:
        return {"has_calendar": False, "stale": False}
    return {
        "has_calendar": True,
        "stale": should_sync(source.get("last_synced_at")),
        "last_synced_at": source.get("last_synced_at"),
    }


@router.put("/calendar-url", response_model=CalendarUrlResponse)
async def put_calendar_url(
    body: CalendarUrlRequest,
    current_user: dict = Depends(get_current_user),
):
    """ICS URL 저장 + 즉시 동기화. URL 유효성 검증(fetch 시도)."""
    user_id = current_user["id"]
    email = current_user["email"]

    # URL 유효성 검증: fetch 시도
    try:
        await fetch_ics_content(body.ics_url)
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to fetch ICS URL. Please check the URL is correct.")

    # URL 저장
    save_calendar_url(user_id, body.ics_url)

    # 즉시 동기화
    try:
        await sync_calendar(user_id, email, body.ics_url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"URL saved but sync failed: {e}")

    source = get_calendar_source(user_id)
    return CalendarUrlResponse(
        ics_url=source["ics_url"],
        last_synced_at=source.get("last_synced_at"),
        sync_enabled=source.get("sync_enabled", True),
    )


@router.get("/calendar-url", response_model=Optional[CalendarUrlResponse])
async def get_calendar_url_endpoint(
    current_user: dict = Depends(get_current_user),
):
    """현재 등록된 Calendar URL + 동기화 상태 조회."""
    source = get_calendar_source(current_user["id"])
    if not source:
        return {"ics_url": None, "last_synced_at": None, "sync_enabled": False}
    return CalendarUrlResponse(
        ics_url=source["ics_url"],
        last_synced_at=source.get("last_synced_at"),
        sync_enabled=source.get("sync_enabled", True),
    )


@router.delete("/calendar-url")
async def delete_calendar_url_endpoint(
    current_user: dict = Depends(get_current_user),
):
    """Calendar URL 삭제 (자동 동기화 중단)."""
    delete_calendar_url(current_user["id"])
    return {"message": "Calendar URL deleted"}


@router.post("/sync-now", response_model=ScheduleResponse)
async def sync_now(
    current_user: dict = Depends(get_current_user),
):
    """수동 즉시 동기화 트리거."""
    user_id = current_user["id"]
    email = current_user["email"]

    source = get_calendar_source(user_id)
    if not source:
        raise HTTPException(status_code=404, detail="No calendar URL registered")

    try:
        await sync_calendar(user_id, email, source["ics_url"])
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Sync failed: {e}")

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, partial(get_schedule, user_id))
    if result is None:
        return ScheduleResponse(pairings=[], total_flights=0)
    return result
