# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/services/weather.py

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app.services.airport import iata_to_icao

AWC_BASE = "https://aviationweather.gov/api/data"
_USER_AGENT = "MFA-MyFlightAssistant/0.1"

# 간단한 인메모리 캐시 (TTL 5분)
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


async def fetch_metar(station: str, hours: int = 2) -> dict | None:
    """METAR 데이터를 조회한다. station은 IATA 또는 ICAO 코드."""
    icao = _resolve_icao(station)
    if not icao:
        return None

    cache_key = f"metar:{icao}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{AWC_BASE}/metar",
            params={"ids": icao, "format": "json", "hours": hours},
            headers={"User-Agent": _USER_AGENT},
        )

    if resp.status_code == 204:
        return None
    if resp.status_code != 200:
        return None

    data = resp.json()
    if not data:
        return None

    # 최신 METAR 가져오기
    latest = data[0] if isinstance(data, list) else data
    result = _parse_metar(latest)
    _set_cache(cache_key, result)
    return result


async def fetch_taf(station: str) -> dict | None:
    """TAF 데이터를 조회한다."""
    icao = _resolve_icao(station)
    if not icao:
        return None

    cache_key = f"taf:{icao}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{AWC_BASE}/taf",
            params={"ids": icao, "format": "json"},
            headers={"User-Agent": _USER_AGENT},
        )

    if resp.status_code == 204:
        return None
    if resp.status_code != 200:
        return None

    data = resp.json()
    if not data:
        return None

    latest = data[0] if isinstance(data, list) else data
    result = _parse_taf(latest)
    _set_cache(cache_key, result)
    return result


async def fetch_airsigmet(
    min_lat: float = 24.0,
    max_lat: float = 50.0,
    min_lon: float = -125.0,
    max_lon: float = -66.0,
) -> list[dict]:
    """SIGMET/AIRMET 데이터를 조회하고 바운딩 박스로 필터링한다."""
    cache_key = f"airsigmet:{min_lat}:{max_lat}:{min_lon}:{max_lon}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{AWC_BASE}/airsigmet",
            params={"format": "json"},
            headers={"User-Agent": _USER_AGENT},
        )

    if resp.status_code != 200:
        return []

    data = resp.json()
    if not isinstance(data, list):
        return []

    parsed = []
    for item in data:
        coords = item.get("coords", [])
        if not _is_in_bounds(coords, min_lat, max_lat, min_lon, max_lon):
            continue
        parsed.append(_parse_airsigmet(item))

    _set_cache(cache_key, parsed)
    return parsed


_SEVERITY_MAP: dict[int, str] = {
    1: "LGT",
    2: "LGT",
    3: "MOD",
    4: "MOD",
    5: "SEV",
    6: "SEV",
    7: "EXTREME",
    8: "EXTREME",
}


def _parse_airsigmet(raw: dict) -> dict:
    """AWC JSON SIGMET/AIRMET을 정규화한다."""
    severity_num = raw.get("severity")
    severity = _SEVERITY_MAP.get(severity_num, "") if severity_num is not None else ""

    valid_from = raw.get("validTimeFrom")
    valid_to = raw.get("validTimeTo")
    if isinstance(valid_from, (int, float)):
        valid_from = datetime.fromtimestamp(valid_from, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(valid_to, (int, float)):
        valid_to = datetime.fromtimestamp(valid_to, tz=timezone.utc).isoformat().replace("+00:00", "Z")

    alt_low = raw.get("altitudeLow1")
    alt_hi = raw.get("altitudeHi1") or raw.get("altitudeHi2")
    altitude_low = _format_altitude(alt_low)
    altitude_high = _format_altitude(alt_hi)

    movement_dir = raw.get("movementDir")
    movement_spd = raw.get("movementSpd")
    movement = None
    if movement_dir is not None:
        movement = f"{movement_dir}\u00B0"
        if movement_spd is not None:
            movement += f" at {movement_spd}kt"

    return {
        "type": raw.get("airSigmetType", ""),
        "hazard": raw.get("hazard", ""),
        "severity": severity,
        "altitude_low": altitude_low,
        "altitude_high": altitude_high,
        "valid_from": valid_from,
        "valid_to": valid_to,
        "raw": raw.get("rawAirSigmet", ""),
        "coords": raw.get("coords", []),
        "movement": movement,
    }


def _format_altitude(val) -> str:
    """고도 값을 FL 또는 ft 문자열로 변환한다."""
    if val is None:
        return ""
    val = int(val)
    if val >= 18000:
        return f"FL{val // 100}"
    return f"{val}ft"


def _is_in_bounds(
    coords: list[dict],
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
) -> bool:
    """SIGMET/AIRMET 폴리곤이 바운딩 박스와 겹치는지 확인한다."""
    if not coords:
        return False
    for c in coords:
        lat = c.get("lat")
        lon = c.get("lon")
        if lat is None or lon is None:
            continue
        if min_lat <= lat <= max_lat and min_lon <= lon <= max_lon:
            return True
    return False


def _resolve_icao(station: str) -> str | None:
    """IATA 또는 ICAO 코드를 ICAO로 변환한다."""
    station = station.upper().strip()
    if len(station) == 4 and station.startswith("K"):
        return station
    if len(station) == 4 and station.startswith("P"):
        return station
    # IATA → ICAO
    icao = iata_to_icao(station)
    if icao:
        return icao
    # 미국 공항이면 K 접두사
    if len(station) == 3:
        return f"K{station}"
    return None


def _safe_float(val) -> float | None:
    """값을 안전하게 float로 변환한다. 'P6', '10+' 등 AWC 특수 표기 처리."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if s.startswith("P"):
        try:
            return float(s[1:])
        except ValueError:
            return None
    s = s.replace("+", "")
    try:
        return float(s)
    except ValueError:
        return None


def _parse_metar(raw: dict) -> dict:
    """AWC JSON METAR를 정규화한다."""
    # 기상 카테고리 판정
    visibility = _safe_float(raw.get("visib"))
    ceiling = _get_ceiling(raw)
    category = _determine_category(visibility, ceiling)

    return {
        "raw": raw.get("rawOb", ""),
        "station": raw.get("icaoId", ""),
        "observation_time": raw.get("reportTime", ""),
        "temperature": raw.get("temp"),
        "dewpoint": raw.get("dewp"),
        "wind_direction": raw.get("wdir"),
        "wind_speed": raw.get("wspd"),
        "wind_gust": raw.get("wgst"),
        "visibility": visibility,
        "altimeter": raw.get("altim"),
        "ceiling": ceiling,
        "clouds": raw.get("clouds", []),
        "weather": raw.get("wxString", ""),
        "category": category,
        "fetched_at": time.time(),
    }


def _parse_taf(raw: dict) -> dict:
    """AWC JSON TAF를 정규화한다."""
    return {
        "raw": raw.get("rawTAF", ""),
        "station": raw.get("icaoId", ""),
        "issue_time": raw.get("issueTime", ""),
        "valid_from": raw.get("validTimeFrom", ""),
        "valid_to": raw.get("validTimeTo", ""),
        "forecasts": raw.get("fcsts", []),
        "fetched_at": time.time(),
    }


def _get_ceiling(metar: dict) -> int | None:
    """METAR에서 실링(최저 BKN/OVC 고도)을 추출한다."""
    clouds = metar.get("clouds", [])
    if not clouds:
        return None
    for layer in clouds:
        cover = layer.get("cover", "")
        if cover in ("BKN", "OVC"):
            base = layer.get("base")
            if base is not None:
                return int(base)
    return None


def _determine_category(
    visibility: float | None, ceiling: int | None
) -> str:
    """METAR 기상 카테고리를 판정한다.

    VFR:  ceiling > 3000 AND visibility > 5
    MVFR: ceiling 1000-3000 OR visibility 3-5
    IFR:  ceiling 500-999 OR visibility 1-3
    LIFR: ceiling < 500 OR visibility < 1
    """
    if visibility is None and ceiling is None:
        return "VFR"

    cat = "VFR"

    if ceiling is not None:
        if ceiling < 500:
            cat = "LIFR"
        elif ceiling < 1000:
            cat = _worse_category(cat, "IFR")
        elif ceiling <= 3000:
            cat = _worse_category(cat, "MVFR")

    if visibility is not None:
        if visibility < 1:
            cat = _worse_category(cat, "LIFR")
        elif visibility < 3:
            cat = _worse_category(cat, "IFR")
        elif visibility <= 5:
            cat = _worse_category(cat, "MVFR")

    return cat


_CAT_ORDER = {"VFR": 0, "MVFR": 1, "IFR": 2, "LIFR": 3}


def _worse_category(a: str, b: str) -> str:
    return a if _CAT_ORDER.get(a, 0) >= _CAT_ORDER.get(b, 0) else b
