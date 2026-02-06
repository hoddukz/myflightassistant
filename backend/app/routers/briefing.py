# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/routers/briefing.py

from fastapi import APIRouter, HTTPException, Query

from app.services.airport import get_airport, iata_to_icao
from app.services.weather import fetch_metar, fetch_taf
from app.services.notam import fetch_notams

router = APIRouter()


@router.get("/weather/{station}")
async def get_weather(station: str):
    """공항의 METAR + TAF를 한번에 조회한다."""
    airport = get_airport(station.upper())
    icao = iata_to_icao(station) or station.upper()

    metar = await fetch_metar(station)
    taf = await fetch_taf(station)

    return {
        "station": station.upper(),
        "icao": icao,
        "airport": airport,
        "metar": metar,
        "taf": taf,
    }


@router.get("/metar/{station}")
async def get_metar(station: str):
    """공항의 METAR를 조회한다."""
    metar = await fetch_metar(station)
    if metar is None:
        raise HTTPException(status_code=404, detail=f"No METAR data for {station}")
    return metar


@router.get("/taf/{station}")
async def get_taf(station: str):
    """공항의 TAF를 조회한다."""
    taf = await fetch_taf(station)
    if taf is None:
        raise HTTPException(status_code=404, detail=f"No TAF data for {station}")
    return taf


@router.get("/notam/{station}")
async def get_notam(station: str):
    """공항의 NOTAM을 조회한다."""
    notams = await fetch_notams(station)
    return {
        "station": station.upper(),
        "icao": iata_to_icao(station) or station.upper(),
        "notams": notams,
        "total": len(notams),
        "critical_count": sum(1 for n in notams if n.get("is_critical")),
    }


@router.get("/full/{station}")
async def get_full_briefing(station: str):
    """공항의 전체 브리핑(METAR + TAF + NOTAM)을 조회한다."""
    airport = get_airport(station.upper())
    icao = iata_to_icao(station) or station.upper()

    metar = None
    taf = None
    notams = []

    try:
        metar = await fetch_metar(station)
    except Exception:
        pass

    try:
        taf = await fetch_taf(station)
    except Exception:
        pass

    try:
        notams = await fetch_notams(station)
    except Exception:
        pass

    return {
        "station": station.upper(),
        "icao": icao,
        "airport": airport,
        "metar": metar,
        "taf": taf,
        "notams": notams,
        "notam_total": len(notams),
        "notam_critical_count": sum(1 for n in notams if n.get("is_critical")),
    }


@router.get("/route")
async def get_route_briefing(
    origin: str = Query(..., description="출발 공항 IATA/ICAO"),
    destination: str = Query(..., description="도착 공항 IATA/ICAO"),
):
    """출발/도착 공항의 기상 + NOTAM을 동시에 조회한다."""
    origin_data = {
        "metar": await fetch_metar(origin),
        "taf": await fetch_taf(origin),
        "notams": await fetch_notams(origin),
        "airport": get_airport(origin.upper()),
    }
    dest_data = {
        "metar": await fetch_metar(destination),
        "taf": await fetch_taf(destination),
        "notams": await fetch_notams(destination),
        "airport": get_airport(destination.upper()),
    }

    return {
        "origin": {"station": origin.upper(), **origin_data},
        "destination": {"station": destination.upper(), **dest_data},
    }
