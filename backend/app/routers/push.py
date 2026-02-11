# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/routers/push.py

import json

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from pywebpush import webpush, WebPushException

from app.config import VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CLAIM_EMAIL
from app.dependencies.auth import get_current_user
from app.db.supabase import get_supabase

router = APIRouter()


class SubscriptionPayload(BaseModel):
    endpoint: str
    keys: dict


@router.get("/vapid-key")
async def get_vapid_key():
    """VAPID 공개키를 반환한다 (인증 불필요)."""
    return {"public_key": VAPID_PUBLIC_KEY}


@router.post("/subscribe")
async def subscribe(
    payload: SubscriptionPayload,
    current_user: dict = Depends(get_current_user),
):
    """Push subscription 정보를 users.push_token에 저장한다."""
    user_id = current_user["id"]
    db = get_supabase()

    subscription_json = json.dumps(payload.dict())
    db.table("users").update({"push_token": subscription_json}).eq("id", user_id).execute()

    return {"status": "subscribed"}


@router.delete("/subscribe")
async def unsubscribe(
    current_user: dict = Depends(get_current_user),
):
    """Push subscription을 해제한다 (push_token = null)."""
    user_id = current_user["id"]
    db = get_supabase()

    db.table("users").update({"push_token": None}).eq("id", user_id).execute()

    return {"status": "unsubscribed"}


@router.post("/test")
async def send_test_push(
    current_user: dict = Depends(get_current_user),
):
    """현재 사용자에게 테스트 푸시 알림을 발송한다."""
    user_id = current_user["id"]
    db = get_supabase()

    result = db.table("users").select("push_token").eq("id", user_id).single().execute()
    push_token = result.data.get("push_token") if result.data else None

    if not push_token:
        raise HTTPException(status_code=400, detail="No push subscription found")

    subscription_info = json.loads(push_token)

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps({
                "title": "MFA Test",
                "body": "Push notification is working!",
            }),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CLAIM_EMAIL},
        )
    except WebPushException as e:
        raise HTTPException(status_code=502, detail=f"Push failed: {str(e)}")

    return {"status": "sent"}


class WeatherAlertSettingsPayload(BaseModel):
    weather_alerts_enabled: bool


@router.get("/weather-alert-settings")
async def get_weather_alert_settings(
    current_user: dict = Depends(get_current_user),
):
    """현재 유저의 weather alert 설정을 조회한다."""
    user_id = current_user["id"]
    db = get_supabase()

    result = db.table("users").select("settings").eq("id", user_id).execute()
    row = result.data[0] if result.data else None
    settings = (row.get("settings") or {}) if row else {}

    return {
        "weather_alerts_enabled": settings.get("weather_alerts_enabled", True),
    }


@router.put("/weather-alert-settings")
async def save_weather_alert_settings(
    payload: WeatherAlertSettingsPayload,
    current_user: dict = Depends(get_current_user),
):
    """Weather alert 설정을 users.settings JSONB에 저장한다."""
    user_id = current_user["id"]
    db = get_supabase()

    result = db.table("users").select("settings").eq("id", user_id).execute()
    row = result.data[0] if result.data else None
    settings = (row.get("settings") or {}) if row else {}

    settings["weather_alerts_enabled"] = payload.weather_alerts_enabled

    if row:
        db.table("users").update({"settings": settings}).eq("id", user_id).execute()
    else:
        email = current_user.get("email", "")
        db.table("users").insert({"id": user_id, "email": email, "settings": settings}).execute()

    return {
        "weather_alerts_enabled": settings["weather_alerts_enabled"],
    }


class ReminderSettingsPayload(BaseModel):
    reminder_enabled: bool
    reminder_minutes: list[int]

    @field_validator("reminder_minutes")
    @classmethod
    def validate_minutes(cls, v: list[int]) -> list[int]:
        if len(v) > 5:
            raise ValueError("Maximum 5 reminder times allowed")
        for m in v:
            if m < 15 or m > 1440:
                raise ValueError(f"Each value must be 15-1440 minutes, got {m}")
        return sorted(set(v))


@router.get("/reminder-settings")
async def get_reminder_settings(
    current_user: dict = Depends(get_current_user),
):
    """현재 유저의 리마인더 설정을 조회한다."""
    user_id = current_user["id"]
    db = get_supabase()

    result = db.table("users").select("settings").eq("id", user_id).execute()
    row = result.data[0] if result.data else None
    settings = (row.get("settings") or {}) if row else {}

    return {
        "reminder_enabled": settings.get("reminder_enabled", False),
        "reminder_minutes": settings.get("reminder_minutes", []),
    }


@router.put("/reminder-settings")
async def save_reminder_settings(
    payload: ReminderSettingsPayload,
    current_user: dict = Depends(get_current_user),
):
    """리마인더 설정을 users.settings JSONB에 저장한다."""
    user_id = current_user["id"]
    db = get_supabase()

    # 기존 settings 가져와서 merge
    result = db.table("users").select("settings").eq("id", user_id).execute()
    row = result.data[0] if result.data else None
    settings = (row.get("settings") or {}) if row else {}

    settings["reminder_enabled"] = payload.reminder_enabled
    settings["reminder_minutes"] = payload.reminder_minutes

    if row:
        db.table("users").update({"settings": settings}).eq("id", user_id).execute()
    else:
        email = current_user.get("email", "")
        db.table("users").insert({"id": user_id, "email": email, "settings": settings}).execute()

    return {
        "reminder_enabled": settings["reminder_enabled"],
        "reminder_minutes": settings["reminder_minutes"],
    }
