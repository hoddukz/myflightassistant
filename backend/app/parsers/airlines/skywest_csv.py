# Tag: core
# Path: backend/app/parsers/airlines/skywest_csv.py

from __future__ import annotations

import csv
import io
import re
from datetime import date

from app.models.schemas import FlightLegCSV
from app.parsers.base import BaseCSVParser


class SkyWestCSVParser(BaseCSVParser):
    """SkyWest (SkedPlus+) CSV 파서"""

    @staticmethod
    def can_parse(file_content: bytes) -> bool:
        """CSV 헤더에 Flight, A/C Type, Tail, Origin, Dest 컬럼 존재 여부로 판별"""
        try:
            text = file_content.decode("utf-8-sig").strip()
            first_line = text.split("\n")[0]
            required = {"Flight", "A/C Type", "Tail", "Origin", "Dest"}
            headers = {h.strip() for h in first_line.split(",")}
            return required.issubset(headers)
        except Exception:
            return False

    @staticmethod
    def parse(file_content: bytes) -> list[FlightLegCSV]:
        """SkedPlus+ CSV 파일을 파싱하여 FlightLegCSV 리스트를 반환한다.

        두 가지 포맷을 지원한다:
        - HH:MM 포맷 (예: 02:01)
        - Decimal 포맷 (예: 2.02)
        """
        text = file_content.decode("utf-8-sig").strip()
        reader = csv.DictReader(io.StringIO(text))
        legs: list[FlightLegCSV] = []

        for row in reader:
            flight_date = _parse_date(row.get("Date", ""))
            if flight_date is None:
                continue

            block_raw = row.get("Block", "").strip()
            credit_raw = row.get("Credit", "").strip()

            leg = FlightLegCSV(
                flight_number=row.get("Flight", "").strip(),
                flight_date=flight_date,
                ac_type=row.get("A/C Type", "").strip() or None,
                tail_number=row.get("Tail", "").strip() or None,
                origin=row.get("Origin", "").strip(),
                destination=row.get("Dest", "").strip(),
                depart=row.get("Depart", "").strip() or None,
                arrive=row.get("Arrive", "").strip() or None,
                block_time=_normalize_time(block_raw),
                credit_time=_normalize_time(credit_raw),
                captain=row.get("Captain", "").strip() or None,
                first_officer=row.get("First Officer", "").strip() or None,
                flight_attendant=row.get("Flight Attendant", "").strip() or None,
            )
            legs.append(leg)

        return legs


def _parse_date(date_str: str) -> date | None:
    """MM/DD/YYYY 포맷의 날짜를 파싱한다."""
    match = re.match(r"(\d{2})/(\d{2})/(\d{4})", date_str.strip())
    if match:
        month, day, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
        return date(year, month, day)
    return None


def _normalize_time(value: str) -> str | None:
    """HH:MM 또는 decimal 시간을 HH:MM 포맷으로 정규화한다."""
    if not value:
        return None

    # 이미 HH:MM 포맷
    if re.match(r"^\d{1,2}:\d{2}$", value):
        return value

    # Decimal 포맷 (예: 2.02 → 소수점 시간)
    try:
        decimal_hours = float(value)
        hours = int(decimal_hours)
        minutes = round((decimal_hours - hours) * 60)
        return f"{hours}:{minutes:02d}"
    except ValueError:
        return value
