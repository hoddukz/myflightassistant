# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/services/calendar_sync.py

import asyncio
from datetime import datetime, timezone
from functools import partial
from typing import Optional

import httpx

from app.db.supabase import get_supabase
from app.parsers.ics_parser import parse_ics
from app.services.schedule_db import save_schedule


SYNC_INTERVAL_SECONDS = 3600  # 1시간


def should_sync(last_synced_at: Optional[str]) -> bool:
    """마지막 동기화 시점으로부터 1시간 이상 경과했는지 확인한다."""
    if last_synced_at is None:
        return True
    last = datetime.fromisoformat(last_synced_at)
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    elapsed = (datetime.now(timezone.utc) - last).total_seconds()
    return elapsed >= SYNC_INTERVAL_SECONDS


async def fetch_ics_content(ics_url: str) -> bytes:
    """ICS URL에서 캘린더 데이터를 가져온다."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(ics_url)
        resp.raise_for_status()
        return resp.content


def _sync_blocking(user_id: str, email: str, content: bytes) -> int:
    """동기 함수: ICS 파싱 + DB 저장 (스레드에서 실행됨)."""
    pairings = parse_ics(content)
    save_schedule(user_id, email, pairings)

    db = get_supabase()
    db.table("calendar_sources").update({
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
    }).eq("user_id", user_id).execute()

    return len(pairings)


async def sync_calendar(user_id: str, email: str, ics_url: str) -> int:
    """ICS URL fetch → 파싱 → DB 저장 → last_synced_at 업데이트. 이벤트 루프를 블로킹하지 않음."""
    content = await fetch_ics_content(ics_url)
    loop = asyncio.get_event_loop()
    count = await loop.run_in_executor(None, partial(_sync_blocking, user_id, email, content))
    return count


def get_calendar_source(user_id: str) -> Optional[dict]:
    """사용자의 calendar_sources 레코드를 조회한다."""
    db = get_supabase()
    result = db.table("calendar_sources").select("*").eq("user_id", user_id).execute()
    if result.data:
        return result.data[0]
    return None


def save_calendar_url(user_id: str, ics_url: str) -> None:
    """calendar_sources에 ICS URL을 upsert한다."""
    db = get_supabase()
    db.table("calendar_sources").upsert({
        "user_id": user_id,
        "ics_url": ics_url,
        "sync_enabled": True,
    }, on_conflict="user_id").execute()


def delete_calendar_url(user_id: str) -> None:
    """calendar_sources에서 사용자의 레코드를 삭제한다."""
    db = get_supabase()
    db.table("calendar_sources").delete().eq("user_id", user_id).execute()
