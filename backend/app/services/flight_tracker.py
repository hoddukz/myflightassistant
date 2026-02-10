# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/services/flight_tracker.py

from __future__ import annotations

import math
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import httpx

_USER_AGENT = "MFA-MyFlightAssistant/0.1"

# 인메모리 캐시 (TTL 5분) — weather.py 패턴
_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 300  # 5분


def _get_cached(key: str) -> Any | None:
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < _CACHE_TTL:
            return data
        del _cache[key]
    return None


def _set_cache(key: str, data: Any) -> None:
    _cache[key] = (time.time(), data)


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
) -> dict:
    """Inbound 항공기를 추적한다. 통합 진입점."""
    if not tail_number and not flight_number:
        return {"available": False, "reason": "no_identifier"}

    # 캐시 키
    cache_key = f"flight:{tail_number or ''}:{flight_number or ''}:{provider or 'auto'}:{destination or ''}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    # provider 지정 시
    if provider == "opensky":
        if not tail_number:
            return {"available": False, "reason": "opensky_requires_tail_number", "provider": "opensky"}
        result = await _fetch_opensky(tail_number)
        if result:
            normalized = _normalize_opensky(result, tail_number, destination)
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
            normalized = _normalize_opensky(result, tail_number, destination)
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


def _normalize_opensky(state: list, tail_number: str, destination: Optional[str]) -> dict:
    """OpenSky state vector를 통일된 형식으로 정규화한다."""
    from app.services.airport import get_coordinates

    callsign = (state[1] or "").strip()
    lon = state[5]
    lat = state[6]
    baro_alt_m = state[7]
    on_ground = state[8]
    velocity_ms = state[9]
    heading = state[10]
    vertical_rate_ms = state[11]

    # 단위 변환
    alt_ft = round(baro_alt_m * 3.28084) if baro_alt_m is not None else None
    speed_kts = round(velocity_ms * 1.94384) if velocity_ms is not None else None
    vrate_fpm = round(vertical_rate_ms * 196.85) if vertical_rate_ms is not None else None

    # 목적지까지 거리 + ETA 계산
    distance_nm = None
    eta_utc = None
    eta_minutes = None

    if destination and lat is not None and lon is not None:
        dest_coords = get_coordinates(destination)
        if dest_coords:
            distance_nm = round(_haversine_nm(lat, lon, dest_coords[0], dest_coords[1]), 1)
            if speed_kts and speed_kts > 0 and not on_ground:
                eta_minutes = _estimate_eta_minutes(distance_nm, speed_kts, alt_ft or 0)
                if eta_minutes is not None:
                    eta_utc = (datetime.now(timezone.utc) + timedelta(minutes=eta_minutes)).isoformat()

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
            "airport": "",
            "scheduled": None,
            "estimated": None,
            "actual": None,
            "delay_minutes": None,
        },
        "arrival": {
            "airport": destination or "",
            "scheduled": None,
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
        from datetime import datetime

        # ISO 8601 파싱
        sched = datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
        est = datetime.fromisoformat(estimated.replace("Z", "+00:00"))
        diff = (est - sched).total_seconds() / 60
        return int(diff)
    except Exception:
        return None
