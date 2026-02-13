# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/services/flight_tracker.py

from __future__ import annotations

import math
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import httpx

from app.services.flight_phase import (
    FlightPhaseEstimator,
    FlightState,
    Phase,
    PHASE_DISPLAY,
    calculate_hybrid_eta,
    should_simplify_display,
)

_USER_AGENT = "MFA-MyFlightAssistant/0.1"

# 인메모리 캐시 (TTL 5분) — weather.py 패턴
_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 300  # 5분

# 항공기별 FlightPhaseEstimator 인스턴스 (icao24 키)
_estimators: dict[str, tuple[float, FlightPhaseEstimator]] = {}
_ESTIMATOR_TTL = 1800  # 30분 미사용 시 삭제


def _get_cached(key: str) -> Any | None:
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < _CACHE_TTL:
            return data
        del _cache[key]
    return None


def _set_cache(key: str, data: Any) -> None:
    _cache[key] = (time.time(), data)


def _get_estimator(icao24: str, total_distance: float) -> FlightPhaseEstimator:
    """항공기별 FlightPhaseEstimator 인스턴스를 반환한다. 없으면 생성."""
    now = time.time()
    if icao24 in _estimators:
        ts, est = _estimators[icao24]
        # total_distance가 크게 바뀌면 새로 생성 (다른 비행)
        if abs(est.total_dist - total_distance) < 50:
            _estimators[icao24] = (now, est)
            return est
    est = FlightPhaseEstimator(total_distance)
    _estimators[icao24] = (now, est)
    return est


def _cleanup_estimators() -> None:
    """오래된 estimator 인스턴스를 정리한다."""
    now = time.time()
    expired = [k for k, (ts, _) in _estimators.items() if now - ts > _ESTIMATOR_TTL]
    for k in expired:
        del _estimators[k]


def _get_flightlabs_key() -> str | None:
    return os.getenv("FLIGHTLABS_API_KEY")


def _get_aviationstack_key() -> str | None:
    return os.getenv("AVIATIONSTACK_API_KEY")


# ─────────── OpenSky N-number → ICAO24 변환 ───────────

_ICAO_BASE = 0xA00001
_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # 24자, I와 O 제외
# B(d) = d자리 숫자 배치 후 가능한 N-number 수
_BUCKET = {1: 101711, 2: 10111, 3: 951, 4: 35, 5: 1}
# S(d) = d자리 숫자 배치 후 접미사(bare + 문자) 수
_SUFFIX = {1: 601, 2: 601, 3: 601, 4: 25, 5: 1}


def _n_to_icao24(tail: str) -> Optional[str]:
    """US N-number를 ICAO24 hex 코드로 변환한다."""
    tail = tail.upper().strip()
    if not tail.startswith("N"):
        return None

    rest = tail[1:]
    if not rest:
        return None

    # 숫자/문자 분리
    digits: list[int] = []
    letters: list[str] = []
    for ch in rest:
        if ch.isdigit() and not letters:
            digits.append(int(ch))
        elif ch in _LETTERS:
            letters.append(ch)
        else:
            return None

    if not digits or digits[0] == 0:
        return None
    if len(digits) > 5 or len(letters) > 2:
        return None
    if len(digits) + len(letters) > 5:
        return None

    offset = 0

    # 첫 번째 숫자 (1-9)
    offset += (digits[0] - 1) * _BUCKET[1]

    # 후속 숫자 (0-9)
    for i in range(1, len(digits)):
        offset += _SUFFIX[i] + digits[i] * _BUCKET[i + 1]

    # 문자 접미사
    if len(letters) == 1:
        offset += 1 + _LETTERS.index(letters[0])
    elif len(letters) == 2:
        offset += 1 + 24 + _LETTERS.index(letters[0]) * 24 + _LETTERS.index(letters[1])

    icao = _ICAO_BASE + offset
    return format(icao, "06x")


# ─────────── Haversine 거리 계산 ───────────

def _haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 좌표 간 대원 거리를 해리(NM)로 계산한다."""
    R_NM = 3440.065
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return R_NM * c


def _estimate_eta_minutes(distance_nm: float, speed_kts: float, altitude_ft: float) -> Optional[float]:
    """남은 거리/속도/고도를 기반으로 ETA를 분 단위로 추정한다."""
    if speed_kts <= 0 or distance_nm <= 0:
        return None
    if distance_nm > 100:
        avg_speed = speed_kts
    elif distance_nm > 30:
        avg_speed = (speed_kts + 200) / 2
    else:
        avg_speed = min(speed_kts, 200)
    return (distance_nm / avg_speed) * 60


def get_tracker_status() -> dict:
    """설정된 provider 목록을 반환한다."""
    fl = bool(_get_flightlabs_key())
    av = bool(_get_aviationstack_key())
    return {
        "opensky": True,  # OpenSky는 항상 사용 가능 (API key 불필요)
        "flightlabs": fl,
        "aviationstack": av,
        "any_available": True,
    }


async def track_inbound(
    tail_number: str | None = None,
    flight_number: str | None = None,
    provider: str | None = None,
    destination: str | None = None,
    origin: str | None = None,
    scheduled_dep: str | None = None,
    scheduled_arr: str | None = None,
) -> dict:
    """Inbound 항공기를 추적한다. 통합 진입점."""
    if not tail_number and not flight_number:
        return {"available": False, "reason": "no_identifier"}

    # 주기적으로 오래된 estimator 정리
    _cleanup_estimators()

    # 캐시 키 — 스케줄 컨텍스트는 캐시 키에 포함하지 않음 (동일 항공기)
    cache_key = f"flight:{tail_number or ''}:{flight_number or ''}:{provider or 'auto'}:{destination or ''}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    # 스케줄 컨텍스트 (하이브리드 ETA용)
    schedule_ctx = {
        "origin": origin,
        "scheduled_dep": scheduled_dep,
        "scheduled_arr": scheduled_arr,
    }

    # provider 지정 시
    if provider == "opensky":
        if not tail_number:
            return {"available": False, "reason": "opensky_requires_tail_number", "provider": "opensky"}
        result = await _fetch_opensky(tail_number)
        if result:
            normalized = _normalize_opensky(result, tail_number, destination, schedule_ctx)
            _set_cache(cache_key, normalized)
            return normalized
        return {"available": False, "reason": "no_data", "provider": "opensky"}

    if provider == "flightlabs":
        result = await _fetch_flightlabs(tail_number, flight_number)
        if result:
            normalized = _normalize_flight(result, "flightlabs")
            _set_cache(cache_key, normalized)
            return normalized
        return {"available": False, "reason": "no_data", "provider": "flightlabs"}

    if provider == "aviationstack":
        if not flight_number:
            return {"available": False, "reason": "aviationstack_requires_flight_number", "provider": "aviationstack"}
        result = await _fetch_aviationstack(flight_number)
        if result:
            normalized = _normalize_flight(result, "aviationstack")
            _set_cache(cache_key, normalized)
            return normalized
        return {"available": False, "reason": "no_data", "provider": "aviationstack"}

    # 자동: OpenSky 우선 (tail_number 있을 때) → FlightLabs → AviationStack
    if tail_number:
        result = await _fetch_opensky(tail_number)
        if result:
            normalized = _normalize_opensky(result, tail_number, destination, schedule_ctx)
            _set_cache(cache_key, normalized)
            return normalized

    if _get_flightlabs_key():
        result = await _fetch_flightlabs(tail_number, flight_number)
        if result:
            normalized = _normalize_flight(result, "flightlabs")
            _set_cache(cache_key, normalized)
            return normalized

    if _get_aviationstack_key() and flight_number:
        result = await _fetch_aviationstack(flight_number)
        if result:
            normalized = _normalize_flight(result, "aviationstack")
            _set_cache(cache_key, normalized)
            return normalized

    return {"available": False, "reason": "no_data"}


async def _fetch_opensky(tail_number: str) -> Optional[list]:
    """OpenSky Network API로 항공기 위치를 조회한다. N-number → ICAO24 변환 후 호출."""
    icao24 = _n_to_icao24(tail_number)
    if not icao24:
        return None

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://opensky-network.org/api/states/all",
                params={"icao24": icao24},
                headers={"User-Agent": _USER_AGENT},
            )
        if resp.status_code != 200:
            return None
        data = resp.json()
        states = data.get("states")
        if states and len(states) > 0:
            return states[0]
        return None
    except Exception:
        return None


def _normalize_opensky(
    state: list,
    tail_number: str,
    destination: Optional[str],
    schedule_ctx: Optional[dict] = None,
) -> dict:
    """OpenSky state vector를 통일된 형식으로 정규화한다. 비행 단계 추정 포함."""
    from app.services.airport import get_coordinates

    callsign = (state[1] or "").strip()
    icao24 = (state[0] or "").strip()
    lon = state[5]
    lat = state[6]
    baro_alt_m = state[7]
    on_ground = state[8]
    velocity_ms = state[9]
    heading = state[10]
    vertical_rate_ms = state[11]
    time_position = state[3]

    # 단위 변환
    alt_ft = round(baro_alt_m * 3.28084) if baro_alt_m is not None else None
    speed_kts = round(velocity_ms * 1.94384) if velocity_ms is not None else None
    vrate_fpm = round(vertical_rate_ms * 196.85) if vertical_rate_ms is not None else None

    # 출발/도착 좌표 + 거리 계산
    distance_nm = None
    dist_from_dep = None
    total_distance = None
    dest_coords = None
    origin_coords = None

    sched = schedule_ctx or {}
    origin_code = sched.get("origin") or ""

    if origin_code and lat is not None and lon is not None:
        origin_coords = get_coordinates(origin_code)
        if origin_coords:
            dist_from_dep = round(_haversine_nm(lat, lon, origin_coords[0], origin_coords[1]), 1)

    if destination and lat is not None and lon is not None:
        dest_coords = get_coordinates(destination)
        if dest_coords:
            distance_nm = round(_haversine_nm(lat, lon, dest_coords[0], dest_coords[1]), 1)

    # 총 비행 거리 (출발~도착 공항 간)
    if origin_coords and dest_coords:
        total_distance = round(
            _haversine_nm(origin_coords[0], origin_coords[1], dest_coords[0], dest_coords[1]), 1
        )
    elif distance_nm is not None and dist_from_dep is not None:
        total_distance = distance_nm + dist_from_dep

    # ── 비행 단계 추정 ──
    phase_str = None
    phase_label = None
    phase_short = None
    progress = None
    is_short_leg = False

    if (
        icao24
        and lat is not None
        and lon is not None
        and alt_ft is not None
        and speed_kts is not None
        and vrate_fpm is not None
        and distance_nm is not None
    ):
        td = total_distance or (distance_nm + (dist_from_dep or 0))
        estimator = _get_estimator(icao24, td)

        flight_state = FlightState(
            time=time_position or int(time.time()),
            lat=lat,
            lon=lon,
            altitude=alt_ft,
            velocity=speed_kts,
            vertical_rate=vrate_fpm,
            true_track=heading or 0.0,
            on_ground=on_ground or False,
            dist_to_arr=distance_nm,
            dist_from_dep=dist_from_dep or 0.0,
        )

        estimator.update(flight_state)
        phase = estimator.estimate(flight_state)
        progress = round(estimator.get_progress(flight_state) * 100, 1)

        phase_str = phase.value
        short, label = PHASE_DISPLAY.get(phase, ("?", "Unknown"))
        phase_short = short
        phase_label = label

        is_short_leg = should_simplify_display(td)

    # ── ETA 계산 (하이브리드) ──
    eta_utc = None

    sched_dep_str = sched.get("scheduled_dep")
    sched_arr_str = sched.get("scheduled_arr")
    sched_dep_dt = _parse_iso(sched_dep_str) if sched_dep_str else None
    sched_arr_dt = _parse_iso(sched_arr_str) if sched_arr_str else None

    # 실제 출발 시점 추정: 비행 중이고 출발 공항 근처 기록이 없으면 스케줄 기반
    actual_dep_dt = sched_dep_dt if (not on_ground and sched_dep_dt) else None

    if distance_nm is not None and speed_kts is not None and not on_ground:
        prog = (progress or 0) / 100.0
        hybrid_eta = calculate_hybrid_eta(
            scheduled_dep=sched_dep_dt,
            scheduled_arr=sched_arr_dt,
            actual_dep=actual_dep_dt,
            progress=prog,
            dist_remaining=distance_nm,
            current_speed=speed_kts,
        )
        if hybrid_eta:
            eta_utc = hybrid_eta.isoformat()
    elif sched_arr_dt:
        eta_utc = sched_arr_dt.isoformat()

    # 상태 결정
    if on_ground:
        if distance_nm is not None and distance_nm < 5:
            status = "landed"
        else:
            status = "on-ground"
    else:
        status = "en-route"

    return {
        "available": True,
        "provider": "opensky",
        "flight_number": callsign or None,
        "tail_number": tail_number,
        "status": status,
        "departure": {
            "airport": origin_code,
            "scheduled": sched_dep_str,
            "estimated": None,
            "actual": None,
            "delay_minutes": None,
        },
        "arrival": {
            "airport": destination or "",
            "scheduled": sched_arr_str,
            "estimated": eta_utc,
            "actual": None,
            "delay_minutes": None,
        },
        "live": {
            "latitude": lat,
            "longitude": lon,
            "altitude": alt_ft,
            "speed": speed_kts,
            "heading": heading,
            "vertical_rate": vrate_fpm,
            "on_ground": on_ground,
            "distance_nm": distance_nm,
            "phase": phase_str,
            "phase_label": phase_label,
            "phase_short": phase_short,
            "progress": progress,
            "total_distance": total_distance,
            "short_leg": is_short_leg,
        },
        "fetched_at": time.time(),
    }


async def _fetch_flightlabs(
    tail_number: str | None = None,
    flight_number: str | None = None,
) -> dict | None:
    """FlightLabs API로 항공편을 조회한다."""
    key = _get_flightlabs_key()
    if not key:
        return None

    params: dict[str, str] = {"access_key": key}
    if tail_number:
        params["reg_number"] = tail_number
    if flight_number:
        params["flight_iata"] = flight_number

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://app.goflightlabs.com/advanced-real-time-flights",
                params=params,
                headers={"User-Agent": _USER_AGENT},
            )
        if resp.status_code != 200:
            return None
        data = resp.json()
        # FlightLabs는 data 배열로 응답
        if isinstance(data, dict) and "data" in data:
            flights = data["data"]
            if isinstance(flights, list) and len(flights) > 0:
                return flights[0]
        if isinstance(data, list) and len(data) > 0:
            return data[0]
        return None
    except Exception:
        return None


async def _fetch_aviationstack(flight_number: str) -> dict | None:
    """AviationStack API로 항공편을 조회한다. flight_number만 지원."""
    key = _get_aviationstack_key()
    if not key:
        return None

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.aviationstack.com/v1/flights",
                params={"access_key": key, "flight_iata": flight_number},
                headers={"User-Agent": _USER_AGENT},
            )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if isinstance(data, dict) and "data" in data:
            flights = data["data"]
            if isinstance(flights, list) and len(flights) > 0:
                return flights[0]
        return None
    except Exception:
        return None


def _normalize_flight(raw: dict, provider: str) -> dict:
    """API 응답을 통일된 형식으로 정규화한다."""
    if provider == "flightlabs":
        return _normalize_flightlabs(raw)
    elif provider == "aviationstack":
        return _normalize_aviationstack(raw)
    return {"available": False, "reason": "unknown_provider"}


def _normalize_flightlabs(raw: dict) -> dict:
    """FlightLabs 응답을 정규화한다."""
    flight = raw.get("flight", {}) or {}
    departure = raw.get("departure", {}) or {}
    arrival = raw.get("arrival", {}) or {}
    live = raw.get("live", {}) or {}
    aircraft = raw.get("aircraft", {}) or {}

    flight_number = flight.get("iata") or ""
    tail_number = aircraft.get("registration") or ""

    status = _map_status(raw.get("flight_status", ""))

    dep_delay = _calc_delay_minutes(departure.get("scheduled"), departure.get("estimated"))
    arr_delay = _calc_delay_minutes(arrival.get("scheduled"), arrival.get("estimated"))

    result: dict[str, Any] = {
        "available": True,
        "provider": "flightlabs",
        "flight_number": flight_number,
        "tail_number": tail_number,
        "status": status,
        "departure": {
            "airport": departure.get("iata") or "",
            "scheduled": departure.get("scheduled"),
            "estimated": departure.get("estimated"),
            "actual": departure.get("actual"),
            "delay_minutes": dep_delay,
        },
        "arrival": {
            "airport": arrival.get("iata") or "",
            "scheduled": arrival.get("scheduled"),
            "estimated": arrival.get("estimated"),
            "actual": arrival.get("actual"),
            "delay_minutes": arr_delay,
        },
        "fetched_at": time.time(),
    }

    if live and live.get("latitude") is not None:
        result["live"] = {
            "latitude": live.get("latitude"),
            "longitude": live.get("longitude"),
            "altitude": live.get("altitude"),
            "speed": live.get("speed_horizontal"),
        }

    return result


def _normalize_aviationstack(raw: dict) -> dict:
    """AviationStack 응답을 정규화한다."""
    flight = raw.get("flight", {}) or {}
    departure = raw.get("departure", {}) or {}
    arrival = raw.get("arrival", {}) or {}
    live = raw.get("live", {}) or {}
    aircraft = raw.get("aircraft", {}) or {}

    flight_number = flight.get("iata") or ""
    tail_number = aircraft.get("registration") or ""

    status = _map_status(raw.get("flight_status", ""))

    dep_delay = departure.get("delay")
    if dep_delay is not None:
        dep_delay = int(dep_delay)
    else:
        dep_delay = _calc_delay_minutes(departure.get("scheduled"), departure.get("estimated"))

    arr_delay = arrival.get("delay")
    if arr_delay is not None:
        arr_delay = int(arr_delay)
    else:
        arr_delay = _calc_delay_minutes(arrival.get("scheduled"), arrival.get("estimated"))

    result: dict[str, Any] = {
        "available": True,
        "provider": "aviationstack",
        "flight_number": flight_number,
        "tail_number": tail_number,
        "status": status,
        "departure": {
            "airport": departure.get("iata") or "",
            "scheduled": departure.get("scheduled"),
            "estimated": departure.get("estimated"),
            "actual": departure.get("actual"),
            "delay_minutes": dep_delay,
        },
        "arrival": {
            "airport": arrival.get("iata") or "",
            "scheduled": arrival.get("scheduled"),
            "estimated": arrival.get("estimated"),
            "actual": arrival.get("actual"),
            "delay_minutes": arr_delay,
        },
        "fetched_at": time.time(),
    }

    if live and live.get("latitude") is not None:
        result["live"] = {
            "latitude": live.get("latitude"),
            "longitude": live.get("longitude"),
            "altitude": live.get("altitude"),
            "speed": live.get("speed_horizontal"),
        }

    return result


def _map_status(raw_status: str) -> str:
    """API flight_status를 통일된 상태로 매핑한다."""
    s = (raw_status or "").lower().strip()
    mapping = {
        "scheduled": "scheduled",
        "active": "en-route",
        "en-route": "en-route",
        "landed": "landed",
        "cancelled": "cancelled",
        "diverted": "diverted",
        "incident": "unknown",
    }
    return mapping.get(s, "unknown")


def _calc_delay_minutes(scheduled: str | None, estimated: str | None) -> int | None:
    """scheduled와 estimated 시간 차이를 분 단위로 계산한다."""
    if not scheduled or not estimated:
        return None
    try:
        sched = datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
        est = datetime.fromisoformat(estimated.replace("Z", "+00:00"))
        diff = (est - sched).total_seconds() / 60
        return int(diff)
    except Exception:
        return None


def _parse_iso(s: str) -> Optional[datetime]:
    """ISO 8601 문자열을 datetime으로 파싱한다."""
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None
