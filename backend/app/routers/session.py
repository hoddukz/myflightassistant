# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/routers/session.py

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.dependencies.auth import get_current_user
from app.db.supabase import get_supabase

router = APIRouter()

SESSION_TIMEOUT_MINUTES = 30
MAX_ACTIVE_SESSIONS = 2


class RegisterBody(BaseModel):
    device_id: str
    device_info: Optional[str] = None


@router.post("/register")
async def register_session(
    body: RegisterBody,
    current_user: dict = Depends(get_current_user),
):
    """로그인 시 세션 등록. 활성 세션이 2개 이상이면 가장 오래된 세션 제거."""
    db = get_supabase()
    user_id = current_user["id"]
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=SESSION_TIMEOUT_MINUTES)).isoformat()

    # 만료된 세션 정리
    db.table("user_sessions") \
        .delete() \
        .eq("user_id", user_id) \
        .lt("last_activity", cutoff) \
        .execute()

    # 현재 활성 세션 조회 (현재 device 제외)
    active = db.table("user_sessions") \
        .select("id, last_activity") \
        .eq("user_id", user_id) \
        .neq("device_id", body.device_id) \
        .gte("last_activity", cutoff) \
        .order("last_activity", desc=False) \
        .execute()

    # 활성 세션이 MAX-1 이상이면 가장 오래된 것 제거 (현재 기기 등록할 자리 확보)
    if len(active.data) >= MAX_ACTIVE_SESSIONS:
        remove_count = len(active.data) - MAX_ACTIVE_SESSIONS + 1
        for s in active.data[:remove_count]:
            db.table("user_sessions").delete().eq("id", s["id"]).execute()

    # UPSERT 현재 기기 세션
    db.table("user_sessions") \
        .upsert({
            "user_id": user_id,
            "device_id": body.device_id,
            "device_info": body.device_info,
            "last_activity": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="user_id,device_id") \
        .execute()

    return {"status": "ok"}


@router.post("/heartbeat")
async def heartbeat_session(
    current_user: dict = Depends(get_current_user),
    x_device_id: Optional[str] = Header(None, alias="X-Device-ID"),
):
    """last_activity 갱신."""
    if not x_device_id:
        raise HTTPException(status_code=400, detail="X-Device-ID header required")

    db = get_supabase()
    db.table("user_sessions") \
        .update({"last_activity": datetime.now(timezone.utc).isoformat()}) \
        .eq("user_id", current_user["id"]) \
        .eq("device_id", x_device_id) \
        .execute()

    return {"status": "ok"}


@router.delete("/logout")
async def logout_session(
    current_user: dict = Depends(get_current_user),
    x_device_id: Optional[str] = Header(None, alias="X-Device-ID"),
):
    """현재 기기 세션 삭제."""
    if not x_device_id:
        raise HTTPException(status_code=400, detail="X-Device-ID header required")

    db = get_supabase()
    db.table("user_sessions") \
        .delete() \
        .eq("user_id", current_user["id"]) \
        .eq("device_id", x_device_id) \
        .execute()

    return {"status": "ok"}
