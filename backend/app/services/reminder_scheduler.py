# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/services/reminder_scheduler.py

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from pywebpush import webpush, WebPushException

from app.config import VAPID_PRIVATE_KEY, VAPID_CLAIM_EMAIL
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

_task: asyncio.Task | None = None
CHECK_INTERVAL = 60  # 초
TOLERANCE_SECONDS = 120  # ±2분 허용 오차


def _check_and_send() -> None:
    """리마인더 대상을 조회하고 push 알림을 발송한다. (동기 — to_thread에서 호출)"""
    db = get_supabase()
    now = datetime.now(timezone.utc)

    # 1) push_token이 있고 settings가 있는 유저 조회
    users_result = (
        db.table("users")
        .select("id, push_token, settings")
        .not_.is_("push_token", "null")
        .execute()
    )

    if not users_result.data:
        return

    for user in users_result.data:
        settings = user.get("settings") or {}
        if not settings.get("reminder_enabled"):
            continue

        reminder_minutes_list = settings.get("reminder_minutes", [])
        if not reminder_minutes_list:
            continue

        push_token = user["push_token"]
        user_id = user["id"]

        # 해당 유저의 pairing ID 목록
        pairing_ids_result = (
            db.table("pairings")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )
        user_pairing_ids = {p["id"] for p in (pairing_ids_result.data or [])}
        if not user_pairing_ids:
            continue

        # 2) report_time_utc가 있는 day_summaries 조회 (윈도우 내)
        max_minutes = max(reminder_minutes_list)
        # 윈도우: now - tolerance ~ now + max_minutes + tolerance
        window_start = datetime.fromtimestamp(
            now.timestamp() - max_minutes * 60 - TOLERANCE_SECONDS, tz=timezone.utc
        )
        window_end = datetime.fromtimestamp(
            now.timestamp() + max_minutes * 60 + TOLERANCE_SECONDS, tz=timezone.utc
        )

        days_result = (
            db.table("day_summaries")
            .select("id, flight_date, report_time, report_time_utc, pairing_id")
            .not_.is_("report_time_utc", "null")
            .gte("report_time_utc", window_start.isoformat())
            .lte("report_time_utc", window_end.isoformat())
            .execute()
        )

        if not days_result.data:
            continue

        for day in days_result.data:
            if day["pairing_id"] not in user_pairing_ids:
                continue

            report_utc_str = day["report_time_utc"]
            # ISO 파싱: "2026-02-10T16:35:00Z" 또는 "2026-02-10T16:35:00+00:00"
            report_utc = datetime.fromisoformat(report_utc_str.replace("Z", "+00:00"))
            day_summary_id = day["id"]

            for reminder_minutes in reminder_minutes_list:
                # 리마인더 발송 시점 = report_time_utc - reminder_minutes
                target_time = datetime.fromtimestamp(
                    report_utc.timestamp() - reminder_minutes * 60, tz=timezone.utc
                )
                diff = abs((now - target_time).total_seconds())

                if diff > TOLERANCE_SECONDS:
                    continue

                # 3) notification_log 확인 (중복 방지)
                log_result = (
                    db.table("notification_log")
                    .select("id")
                    .eq("user_id", user_id)
                    .eq("day_summary_id", day_summary_id)
                    .eq("reminder_minutes", reminder_minutes)
                    .execute()
                )

                if log_result.data:
                    continue

                # 4) push 발송
                report_local = day.get("report_time") or "?"
                flight_date = day.get("flight_date") or "?"

                if reminder_minutes >= 60:
                    hours = reminder_minutes // 60
                    mins = reminder_minutes % 60
                    time_str = f"{hours}h{mins}m" if mins else f"{hours}h"
                else:
                    time_str = f"{reminder_minutes}m"

                try:
                    subscription_info = json.loads(push_token)
                    webpush(
                        subscription_info=subscription_info,
                        data=json.dumps({
                            "title": f"Report in {time_str}",
                            "body": f"{flight_date} Report: {report_local}L",
                        }),
                        vapid_private_key=VAPID_PRIVATE_KEY,
                        vapid_claims={"sub": VAPID_CLAIM_EMAIL},
                    )

                    # 5) notification_log 기록
                    db.table("notification_log").insert({
                        "user_id": user_id,
                        "day_summary_id": day_summary_id,
                        "reminder_minutes": reminder_minutes,
                    }).execute()

                    logger.info(
                        "Reminder sent: user=%s day=%s minutes=%d",
                        user_id, day_summary_id, reminder_minutes,
                    )
                except WebPushException as e:
                    logger.warning("Push failed for user %s: %s", user_id, e)
                except Exception as e:
                    logger.error("Unexpected error sending reminder: %s", e)


async def _run_loop() -> None:
    """asyncio 태스크로 실행되는 메인 루프."""
    while True:
        try:
            await asyncio.to_thread(_check_and_send)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Scheduler loop error: %s", e)
        await asyncio.sleep(CHECK_INTERVAL)


def start_scheduler() -> None:
    """백그라운드 스케줄러를 시작한다."""
    global _task
    if _task is None or _task.done():
        _task = asyncio.get_event_loop().create_task(_run_loop())
        logger.info("Reminder scheduler started")


def stop_scheduler() -> None:
    """백그라운드 스케줄러를 중지한다."""
    global _task
    if _task and not _task.done():
        _task.cancel()
        logger.info("Reminder scheduler stopped")
    _task = None
