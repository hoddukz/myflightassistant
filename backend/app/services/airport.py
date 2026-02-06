# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/services/airport.py

from __future__ import annotations

import json
from pathlib import Path
from functools import lru_cache

_DATA_PATH = Path(__file__).parent.parent / "data" / "airports.json"


@lru_cache(maxsize=1)
def _load_airports() -> dict:
    with open(_DATA_PATH, "r") as f:
        return json.load(f)


def get_airport(iata: str) -> dict | None:
    """IATA 코드로 공항 정보를 조회한다."""
    airports = _load_airports()
    return airports.get(iata.upper())


def iata_to_icao(iata: str) -> str | None:
    """IATA 코드를 ICAO 코드로 변환한다."""
    airport = get_airport(iata)
    return airport["icao"] if airport else None


def get_timezone(iata: str) -> str | None:
    """IATA 코드로 타임존을 조회한다."""
    airport = get_airport(iata)
    return airport["tz"] if airport else None


def get_coordinates(iata: str) -> tuple[float, float] | None:
    """IATA 코드로 좌표(lat, lon)를 조회한다."""
    airport = get_airport(iata)
    if airport:
        return (airport["lat"], airport["lon"])
    return None


def search_airports(query: str) -> list[dict]:
    """공항 이름/도시/코드로 검색한다."""
    airports = _load_airports()
    query_upper = query.upper()
    results = []
    for iata, info in airports.items():
        if (
            query_upper in iata
            or query_upper in info.get("icao", "").upper()
            or query_upper in info.get("city", "").upper()
            or query_upper in info.get("name", "").upper()
        ):
            results.append({"iata": iata, **info})
    return results[:20]
