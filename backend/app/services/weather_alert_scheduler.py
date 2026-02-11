# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/services/weather_alert_scheduler.py

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone

from pywebpush import webpush, WebPushException

from app.config import VAPID_PRIVATE_KEY, VAPID_CLAIM_EMAIL
from app.db.supabase import get_supabase
from app.services.airport import iata_to_icao
from app.services.weather import fetch_metar

logger = logging.getLogger(__name__)

_task: asyncio.Task | None = None
CHECK_INTERVAL = 60  # 메인 루프 간격 (초)

# 공항별 마지막 METAR 체크 시각 (in-memory)
_last_check: dict[str, float] = {}


def _get_check_interval(minutes_to_departure: float) -> int:
    """출발까지 남은 시간에 따라 체크 간격(초)을 결정한다."""
    if minutes_to_departure <= 60:
        return 10 * 60
    elif minutes_to_departure <= 120:
        return 20 * 60
    else:
        return 30 * 60


def _evaluate_conditions(metar: dict) -> list[tuple[str, str]]:
    """METAR 데이터에서 위험 기상 조건을 판별한다."""
    conditions: list[tuple[str, str]] = []

    cat = metar.get("category", "")
    if cat in ("IFR", "LIFR"):
        conditions.append((f"category_{cat.lower()}", cat))

    wx = metar.get("weather") or ""
    if any(k in wx for k in ["TS", "TSRA", "TSGR"]):
        conditions.append(("thunderstorm", wx))
    if any(k in wx for k in ["FZRA", "FZDZ", "FZFG"]):
        conditions.append(("icing", wx))

    gust = metar.get("wind_gust") or 0
    speed = metar.get("wind_speed") or 0
    if gust >= 25 or speed >= 30:
        conditions.append(("wind", f"{speed}kt G{gust}kt"))

    vis = metar.get("visibility")
    if vis is not None and vis < 1:
        conditions.append(("low_vis", f"{vis}SM"))

    return conditions


def _format_condition(ctype: str, cvalue: str) -> str:
    """조건 타입을 사람이 읽을 수 있는 설명으로 변환한다."""
    labels = {
        "category_ifr": "IFR conditions",
        "category_lifr": "LIFR conditions",
        "thunderstorm": f"Thunderstorm ({cvalue})",
        "icing": f"Icing ({cvalue})",
        "wind": f"Strong wind: {cvalue}",
        "low_vis": f"Low visibility: {cvalue}",
    }
    return labels.get(ctype, ctype)


def _check_and_send() -> None:
    """공항 기준으로 METAR를 조회하고, 위험 조건 시 해당 유저들에게 push 알림을 발송한다."""
    db = get_supabase()
    now = datetime.now(timezone.utc)
    now_ts = now.timestamp()

    # 1) weather_alerts_enabled + push_token 있는 유저 조회
    users_result = (
        db.table("users")
        .select("id, push_token, settings")
        .not_.is_("push_token", "null")
        .execute()
    )
    if not users_result.data:
        return

    enabled_users = {}
    for u in users_result.data:
        settings = u.get("settings") or {}
        if not settings.get("weather_alerts_enabled", True):
            continue
        enabled_users[u["id"]] = u["push_token"]

    if not enabled_users:
        return

    user_ids = list(enabled_users.keys())

    # 2) 해당 유저들의 3시간 이내 출발 flight_legs 조회
    window_end = datetime.fromtimestamp(now_ts + 3 * 3600, tz=timezone.utc)

    # pairing_id 목록 조회
    pairings_result = (
        db.table("pairings")
        .select("id, user_id")
        .in_("user_id", user_ids)
        .execute()
    )
    if not pairings_result.data:
        return

    pairing_to_user: dict[str, str] = {}
    pairing_ids: list[str] = []
    for p in pairings_result.data:
        pairing_to_user[p["id"]] = p["user_id"]
        pairing_ids.append(p["id"])

    if not pairing_ids:
        return

    legs_result = (
        db.table("flight_legs")
        .select("id, pairing_id, flight_number, origin, destination, depart_utc")
        .in_("pairing_id", pairing_ids)
        .gte("depart_utc", now.isoformat())
        .lte("depart_utc", window_end.isoformat())
        .execute()
    )
    if not legs_result.data:
        return

    # 3) 공항 기준으로 그룹핑: airport_icao -> [(leg, user_id, minutes_to_dep)]
    airport_legs: dict[str, list[dict]] = {}

    for leg in legs_result.data:
        user_id = pairing_to_user.get(leg["pairing_id"])
        if not user_id:
            continue

        depart_str = leg["depart_utc"]
        depart_utc = datetime.fromisoformat(depart_str.replace("Z", "+00:00"))
        minutes_to_dep = (depart_utc.timestamp() - now_ts) / 60

        if minutes_to_dep < 0 or minutes_to_dep > 180:
            continue

        for airport_iata in [leg["origin"], leg["destination"]]:
            icao = iata_to_icao(airport_iata)
            if not icao:
                # fallback: 3글자면 K 접두사
                if len(airport_iata) == 3:
                    icao = f"K{airport_iata.upper()}"
                else:
                    continue

            if icao not in airport_legs:
                airport_legs[icao] = []
            airport_legs[icao].append({
                "leg": leg,
                "user_id": user_id,
                "minutes_to_dep": minutes_to_dep,
                "airport_iata": airport_iata,
            })

    # 4) 공항별 체크 간격 판단 + METAR fetch + 위험 조건 판별
    loop = asyncio.new_event_loop()

    for icao, leg_infos in airport_legs.items():
        # 해당 공항 관련 leg 중 가장 가까운 출발 시간 기준으로 체크 간격 결정
        min_minutes = min(info["minutes_to_dep"] for info in leg_infos)
        interval = _get_check_interval(min_minutes)

        last = _last_check.get(icao, 0)
        if now_ts - last < interval:
            continue

        # METAR fetch (동기 컨텍스트에서 비동기 호출)
        try:
            metar = loop.run_until_complete(fetch_metar(icao))
        except Exception as e:
            logger.warning("Failed to fetch METAR for %s: %s", icao, e)
            continue

        _last_check[icao] = now_ts

        if not metar:
            continue

        conditions = _evaluate_conditions(metar)
        if not conditions:
            continue

        # 5) 위험 조건 → 해당 공항의 모든 leg/user에 알림
        for info in leg_infos:
            leg = info["leg"]
            user_id = info["user_id"]
            push_token = enabled_users.get(user_id)
            if not push_token:
                continue

            flight_number = leg.get("flight_number", "")
            origin = leg.get("origin", "")
            destination = leg.get("destination", "")
            mins = int(info["minutes_to_dep"])
            hours = mins // 60
            remaining_mins = mins % 60

            for ctype, cvalue in conditions:
                # 중복 방지: INSERT ON CONFLICT DO NOTHING
                try:
                    insert_result = (
                        db.table("weather_alert_log")
                        .insert({
                            "user_id": user_id,
                            "flight_leg_id": leg["id"],
                            "airport": icao,
                            "condition_type": ctype,
                            "condition_value": cvalue,
                        })
                        .execute()
                    )
                except Exception:
                    # UNIQUE 충돌 → 이미 알림 전송됨
                    continue

                if not insert_result.data:
                    continue

                # 푸쉬 발송
                desc = _format_condition(ctype, cvalue)
                try:
                    subscription_info = json.loads(push_token)
                    webpush(
                        subscription_info=subscription_info,
                        data=json.dumps({
                            "title": f"Weather Alert: {icao}",
                            "body": (
                                f"{desc}\n"
                                f"Flight {flight_number} {origin}\u2192{destination} "
                                f"departs in {hours}h{remaining_mins}m"
                            ),
                        }),
                        vapid_private_key=VAPID_PRIVATE_KEY,
                        vapid_claims={"sub": VAPID_CLAIM_EMAIL},
                    )
                    logger.info(
                        "Weather alert sent: user=%s airport=%s condition=%s",
                        user_id, icao, ctype,
                    )
                except WebPushException as e:
                    logger.warning("Push failed for user %s: %s", user_id, e)
                except Exception as e:
                    logger.error("Unexpected error sending weather alert: %s", e)

    loop.close()

    # 6) 24시간 이상 된 로그 정리
    try:
        cutoff = datetime.fromtimestamp(now_ts - 86400, tz=timezone.utc)
        db.table("weather_alert_log").delete().lt("sent_at", cutoff.isoformat()).execute()
    except Exception as e:
        logger.warning("Failed to clean old weather_alert_log: %s", e)

    # 오래된 last_check 항목 정리 (1시간 이상 된 것)
    stale = [k for k, v in _last_check.items() if now_ts - v > 3600]
    for k in stale:
        del _last_check[k]


async def _run_loop() -> None:
    """asyncio 태스크로 실행되는 메인 루프."""
    while True:
        try:
            await asyncio.to_thread(_check_and_send)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Weather alert scheduler loop error: %s", e)
        await asyncio.sleep(CHECK_INTERVAL)


def start_weather_scheduler() -> None:
    """백그라운드 weather alert 스케줄러를 시작한다."""
    global _task
    if _task is None or _task.done():
        _task = asyncio.get_event_loop().create_task(_run_loop())
        logger.info("Weather alert scheduler started")


def stop_weather_scheduler() -> None:
    """백그라운드 weather alert 스케줄러를 중지한다."""
    global _task
    if _task and not _task.done():
        _task.cancel()
        logger.info("Weather alert scheduler stopped")
    _task = None
