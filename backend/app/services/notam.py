# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/services/notam.py

from __future__ import annotations

import os
import re
import time
from typing import Any

import httpx

from app.services.airport import iata_to_icao

# FAA NOTAM API (v1)
NOTAM_BASE = "https://external-api.faa.gov/notamapi/v1/notams"
# AVWX API
AVWX_BASE = "https://avwx.rest/api/notam"
_USER_AGENT = "MFA-MyFlightAssistant/0.1"
_FAA_API_KEY = os.getenv("FAA_NOTAM_API_KEY", "")
_AVWX_API_KEY = os.getenv("AVWX_API_KEY", "")

# 인메모리 캐시 (TTL 10분)
_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 600

# 중요 키워드 (최상단 배치)
CRITICAL_KEYWORDS = [
    "RWY", "RY", "RUNWAY",
    "TWY", "TY", "TAXIWAY",
    "CLSD", "CLOSED",
    "ILS", "LOC", "GS", "GLIDESLOPE",
    "APCH", "APPROACH",
    "AD", "AERODROME",
    "OBST", "OBSTACLE",
    "SVC", "SERVICE",
    "FUEL",
]

# 키워드 카테고리
KEYWORD_CATEGORIES = {
    "runway": ["RWY", "RY", "RUNWAY", "CLSD", "CLOSED"],
    "taxiway": ["TWY", "TY", "TAXIWAY"],
    "navigation": ["ILS", "LOC", "GS", "GLIDESLOPE", "VOR", "NDB", "RNAV", "GPS"],
    "approach": ["APCH", "APPROACH", "SID", "STAR", "IAP"],
    "airspace": ["TFR", "AIRSPACE", "NOTAM", "FDC"],
    "obstacle": ["OBST", "OBSTACLE", "CRANE", "TOWER"],
    "service": ["SVC", "SERVICE", "FUEL", "TWR", "ATIS", "CTAF"],
}


def _get_cached(key: str) -> Any | None:
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < _CACHE_TTL:
            return data
        del _cache[key]
    return None


def _set_cache(key: str, data: Any) -> None:
    _cache[key] = (time.time(), data)


async def fetch_notams(station: str) -> list[dict]:
    """공항의 NOTAM을 조회한다. AVWX → FAA → AWC 순으로 시도."""
    icao = _resolve_icao(station)
    if not icao:
        return []

    cache_key = f"notam:{icao}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    # 1순위: AVWX API (키가 있을 때)
    if _AVWX_API_KEY:
        result = await _fetch_notams_avwx(icao)
        if result:
            _set_cache(cache_key, result)
            return result

    # 2순위: FAA API (키가 있을 때)
    if _FAA_API_KEY:
        result = await _fetch_notams_faa(icao)
        if result:
            _set_cache(cache_key, result)
            return result

    return []


async def _fetch_notams_avwx(icao: str) -> list[dict]:
    """AVWX API로 NOTAM을 조회한다."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{AVWX_BASE}/{icao}",
                headers={
                    "Authorization": f"BEARER {_AVWX_API_KEY}",
                    "User-Agent": _USER_AGENT,
                },
            )

        if resp.status_code != 200:
            return []

        data = resp.json()
        if not isinstance(data, list):
            return []

        notams = [_parse_avwx_notam(item) for item in data]
        notams = _sort_notams(notams)
        return notams
    except Exception:
        return []


async def _fetch_notams_faa(icao: str) -> list[dict]:
    """FAA API로 NOTAM을 조회한다."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                NOTAM_BASE,
                params={
                    "icaoLocation": icao,
                    "notamType": "N",
                    "sortBy": "effectiveStartDate",
                    "sortOrder": "DESC",
                    "pageSize": 50,
                },
                headers={
                    "User-Agent": _USER_AGENT,
                    "client_id": _FAA_API_KEY,
                },
            )

        if resp.status_code != 200:
            return []

        data = resp.json()
        items = data.get("items", [])
        notams = [_parse_notam(item) for item in items]
        notams = _sort_notams(notams)
        return notams
    except Exception:
        return []


def _parse_notam(item: dict) -> dict:
    """FAA NOTAM API 응답을 정규화한다."""
    properties = item.get("properties", item)
    text = properties.get("coreNOTAMData", {}).get("notam", {}).get("text", "")
    classification = properties.get("coreNOTAMData", {}).get("notam", {}).get("classification", "")

    return {
        "id": properties.get("coreNOTAMData", {}).get("notam", {}).get("id", ""),
        "text": text,
        "classification": classification,
        "effective_start": properties.get("coreNOTAMData", {}).get("notam", {}).get("effectiveStart", ""),
        "effective_end": properties.get("coreNOTAMData", {}).get("notam", {}).get("effectiveEnd", ""),
        "keywords": _extract_keywords(text),
        "category": _categorize_notam(text),
        "is_critical": _is_critical(text),
    }


def _parse_avwx_notam(item: dict) -> dict:
    """AVWX NOTAM 응답을 정규화한다."""
    raw = item.get("raw", "")
    text = item.get("body", raw)
    return {
        "id": item.get("number", ""),
        "text": text or raw,
        "classification": item.get("type", ""),
        "effective_start": item.get("startTime", ""),
        "effective_end": item.get("endTime", ""),
        "keywords": _extract_keywords(text or raw),
        "category": _categorize_notam(text or raw),
        "is_critical": _is_critical(text or raw),
    }


def _extract_keywords(text: str) -> list[str]:
    """NOTAM 텍스트에서 키워드를 추출한다."""
    text_upper = text.upper()
    found = []
    for kw in CRITICAL_KEYWORDS:
        if re.search(rf"\b{kw}\b", text_upper):
            found.append(kw)
    return found


def _categorize_notam(text: str) -> str:
    """NOTAM의 카테고리를 판정한다."""
    text_upper = text.upper()
    for category, keywords in KEYWORD_CATEGORIES.items():
        for kw in keywords:
            if re.search(rf"\b{kw}\b", text_upper):
                return category
    return "other"


def _is_critical(text: str) -> bool:
    """NOTAM이 중요(RWY/TWY 폐쇄 등)인지 판정한다."""
    text_upper = text.upper()
    # 활주로/유도로 폐쇄
    if re.search(r"\b(RWY|RY|RUNWAY|TWY|TAXIWAY).*\b(CLSD|CLOSED)\b", text_upper):
        return True
    # ILS/접근 불가
    if re.search(r"\b(ILS|LOC|GS|APCH).*\b(CLSD|CLOSED|U/S|UNSERVICEABLE|OTS|OUT OF SERVICE)\b", text_upper):
        return True
    return False


def _sort_notams(notams: list[dict]) -> list[dict]:
    """중요 NOTAM을 최상단에 배치한다."""
    critical = [n for n in notams if n["is_critical"]]
    runway_taxiway = [n for n in notams if not n["is_critical"] and n["category"] in ("runway", "taxiway")]
    navigation = [n for n in notams if not n["is_critical"] and n["category"] in ("navigation", "approach")]
    rest = [n for n in notams if not n["is_critical"] and n["category"] not in ("runway", "taxiway", "navigation", "approach")]
    return critical + runway_taxiway + navigation + rest


def _resolve_icao(station: str) -> str | None:
    station = station.upper().strip()
    if len(station) == 4 and (station.startswith("K") or station.startswith("P")):
        return station
    icao = iata_to_icao(station)
    if icao:
        return icao
    if len(station) == 3:
        return f"K{station}"
    return None
