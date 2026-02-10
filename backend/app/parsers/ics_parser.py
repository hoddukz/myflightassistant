# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/parsers/ics_parser.py

import re
from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from icalendar import Calendar

from app.models.schemas import (
    CrewMember,
    DayDetail,
    FlightLeg,
    Layover,
    Pairing,
)
from app.services.airport import get_timezone


def parse_ics(file_content: bytes) -> list[Pairing]:
    """SkedPlus+ iCal 파일을 파싱하여 Pairing 리스트를 반환한다."""
    cal = Calendar.from_ical(file_content)
    pairings: list[Pairing] = []

    for component in cal.walk():
        if component.name != "VEVENT":
            continue

        summary = str(component.get("SUMMARY", ""))
        uid = str(component.get("UID", ""))
        dtstart = component.get("DTSTART").dt
        dtend = component.get("DTEND").dt
        description = str(component.get("DESCRIPTION", ""))

        # UTC datetime으로 통일
        if not isinstance(dtstart, datetime):
            dtstart = datetime.combine(dtstart, datetime.min.time())
        if not isinstance(dtend, datetime):
            dtend = datetime.combine(dtend, datetime.min.time())

        event_type = _classify_event(uid, summary, description)

        if event_type == "pairing":
            pairing = _parse_pairing(uid, summary, dtstart, dtend, description)
        else:
            pairing = Pairing(
                pairing_id=_extract_id_from_uid(uid, event_type),
                summary=summary,
                event_type=event_type,
                start_utc=dtstart,
                end_utc=dtend,
            )

        pairings.append(pairing)

    # 중복 제거 (Google Calendar import 시 동일 이벤트가 다른 UID로 2번 존재할 수 있음)
    seen: set[tuple[str, str, str]] = set()
    unique: list[Pairing] = []
    for p in pairings:
        key = (p.summary, p.start_utc.isoformat(), p.end_utc.isoformat())
        if key not in seen:
            seen.add(key)
            unique.append(p)

    # 시간순 정렬
    unique.sort(key=lambda p: p.start_utc)
    return unique


def _classify_event(uid: str, summary: str, description: str) -> str:
    """이벤트 유형을 분류한다: pairing, njm, mov 등."""
    if uid.startswith("Pairing_"):
        return "pairing"
    summary_upper = summary.upper()
    if "NJM" in summary_upper:
        return "njm"
    if "MOV" in summary_upper:
        return "mov"
    if "VAC" in summary_upper:
        return "vac"
    if "TRN" in summary_upper or "TRAIN" in summary_upper:
        return "training"
    # 기타: description에 비행 레그 정보가 있으면 pairing
    if re.search(r"Total Block:", description):
        return "pairing"
    return "other"


def _extract_id_from_uid(uid: str, event_type: str) -> str:
    """UID에서 식별 가능한 ID를 추출한다."""
    if uid.startswith("Pairing_"):
        parts = uid.split("_")
        if len(parts) >= 3:
            return parts[2]  # 예: M3939B
    return f"{event_type.upper()}_{uid[:20]}"


def _parse_pairing(
    uid: str,
    summary: str,
    dtstart: datetime,
    dtend: datetime,
    description: str,
) -> Pairing:
    """Pairing 이벤트의 DESCRIPTION을 상세 파싱한다."""
    # \\n을 실제 줄바꿈으로 변환
    desc = description.replace("\\n", "\n")
    lines = desc.split("\n")

    # 요약 정보 추출
    total_block = _extract_field(desc, r"Total Block:\s*([\d:]+)")
    total_credit = _extract_field(desc, r"Total Credit:\s*([\d:]+)")
    tafb = _extract_field(desc, r"TAFB:\s*([\d:]+)")

    # Pairing ID 추출
    pairing_id_match = re.search(r"^(IOE\s+)?([A-Z]\d{3,5}[A-Z]?)\b", desc, re.MULTILINE)
    pairing_id = pairing_id_match.group(2) if pairing_id_match else _extract_id_from_uid(uid, "pairing")

    # 날짜별 섹션 분리 및 파싱
    days = _parse_days(lines)

    # 크루 정보 파싱 (DESCRIPTION 하단부)
    crew_by_leg = _parse_crew_section(lines)
    _assign_crew_to_legs(days, crew_by_leg)

    # UTC 시간 계산
    _fill_utc_times(days)

    return Pairing(
        pairing_id=pairing_id,
        summary=summary,
        event_type="pairing",
        start_utc=dtstart,
        end_utc=dtend,
        total_block=total_block,
        total_credit=total_credit,
        tafb=tafb,
        days=days,
    )


def _local_to_utc(flight_date: date, local_time: str, tz_name: str) -> Optional[str]:
    """로컬 시간(HH:MM)을 UTC ISO datetime으로 변환한다."""
    try:
        tz = ZoneInfo(tz_name)
        hour, minute = map(int, local_time.split(":"))
        local_dt = datetime(flight_date.year, flight_date.month, flight_date.day, hour, minute, tzinfo=tz)
        utc_dt = local_dt.astimezone(ZoneInfo("UTC"))
        return utc_dt.strftime("%Y-%m-%dT%H:%M:00Z")
    except Exception:
        return None


def _get_tz_abbr(flight_date: date, local_time: str, tz_name: str) -> Optional[str]:
    """타임존 약어(EST, CST, MST 등)를 반환한다."""
    try:
        tz = ZoneInfo(tz_name)
        hour, minute = map(int, local_time.split(":"))
        local_dt = datetime(flight_date.year, flight_date.month, flight_date.day, hour, minute, tzinfo=tz)
        return local_dt.strftime("%Z")
    except Exception:
        return None


def _fill_utc_times(days: list[DayDetail]) -> None:
    """파싱된 날짜/레그에 UTC 시간과 타임존 약어를 채운다."""
    for day in days:
        for leg in day.legs:
            if leg.depart_local and leg.origin:
                tz = get_timezone(leg.origin)
                if tz:
                    leg.depart_utc = _local_to_utc(leg.flight_date, leg.depart_local, tz)
                    leg.depart_tz = _get_tz_abbr(leg.flight_date, leg.depart_local, tz)
            if leg.arrive_local and leg.destination:
                tz = get_timezone(leg.destination)
                if tz:
                    leg.arrive_utc = _local_to_utc(leg.flight_date, leg.arrive_local, tz)
                    leg.arrive_tz = _get_tz_abbr(leg.flight_date, leg.arrive_local, tz)
        # report_time: 첫 레그 출발지 기준
        if day.report_time and day.legs:
            origin_tz = get_timezone(day.legs[0].origin)
            if origin_tz:
                day.report_time_utc = _local_to_utc(day.flight_date, day.report_time, origin_tz)
                day.report_tz = _get_tz_abbr(day.flight_date, day.report_time, origin_tz)


def _extract_field(text: str, pattern: str) -> Optional[str]:
    """정규식으로 필드 값을 추출한다."""
    match = re.search(pattern, text)
    return match.group(1) if match else None


def _parse_days(lines: list[str]) -> list[DayDetail]:
    """날짜별 비행 정보를 파싱한다."""
    days: list[DayDetail] = []
    current_day: Optional[DayDetail] = None

    # 날짜 라인 패턴: "Monday 02-02-2026   Report: 11:35"
    date_pattern = re.compile(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+"
        r"(\d{2})-(\d{2})-(\d{4})\s+Report:\s*(\d{2}:\d{2})"
    )
    # 날짜 라인 (Report 없는 경우 - 분할된 날)
    date_no_report_pattern = re.compile(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+"
        r"(\d{2})-(\d{2})-(\d{4})"
    )
    # 비행 레그 패턴: "1. 935      DTW  SLC  12:20  14:30  Block: 0:00  Credit: 4:10"
    # 또는: "2. *6380  CR7  N728SK  SLC  PHX  06:48  08:49  Block: 2:01  Credit: 2:01"
    leg_pattern = re.compile(
        r"(\d+)\.\s+"
        r"(\*?\d+)\s+"
        r"(?:([A-Z][A-Z0-9]{1,2})\s+)?"     # AC type (optional)
        r"(?:(N\d+[A-Z]*)\s+)?"              # Tail number (optional)
        r"([A-Z]{3})\s+"                      # Origin
        r"([A-Z]{3})\s+"                      # Destination
        r"(\d{2}:\d{2})\s+"                   # Depart
        r"(\d{2}:\d{2})\s+"                   # Arrive
        r"Block:\s*([\d:]+)"                  # Block time
        r"(?:\s+Credit:\s*([\d:]+))?"         # Credit time (optional)
    )
    # Day 요약 패턴
    day_summary_pattern = re.compile(
        r"Day Block:\s*([\d:]+)\s+Day Credit:\s*([\d:]+)\s+Duty:\s*([\d:]+)"
    )
    # Release/Hotel 패턴
    release_pattern = re.compile(r"Release:\s*(\d{2}:\d{2}/\d{2})")
    hotel_pattern = re.compile(r"Hotel:\s*(.+?)\s*\((\d{3})\)(\d{3}-\d{4})")
    layover_pattern = re.compile(r"Layover:\s*([\d:]+)")

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 날짜 라인 체크
        date_match = date_pattern.search(line)
        if date_match:
            month, day, year = date_match.group(1), date_match.group(2), date_match.group(3)
            report_time = date_match.group(4)
            flight_date = date(int(year), int(month), int(day))
            current_day = DayDetail(flight_date=flight_date, report_time=report_time)
            days.append(current_day)
            continue

        # Report 없는 날짜 라인 (같은 날 두 번째 섹션)
        date_no_match = date_no_report_pattern.search(line)
        if date_no_match and not date_match:
            month, day, year = date_no_match.group(1), date_no_match.group(2), date_no_match.group(3)
            flight_date = date(int(year), int(month), int(day))
            # 같은 날짜가 이미 있으면 재사용
            existing = next((d for d in days if d.flight_date == flight_date), None)
            if existing:
                current_day = existing
            else:
                current_day = DayDetail(flight_date=flight_date)
                days.append(current_day)
            continue

        if current_day is None:
            continue

        # 비행 레그 파싱
        leg_match = leg_pattern.search(line)
        if leg_match:
            block_time = leg_match.group(9)
            is_deadhead = block_time == "0:00"

            leg = FlightLeg(
                leg_number=int(leg_match.group(1)),
                flight_number=leg_match.group(2),
                ac_type=leg_match.group(3),
                tail_number=leg_match.group(4),
                origin=leg_match.group(5),
                destination=leg_match.group(6),
                depart_local=leg_match.group(7),
                arrive_local=leg_match.group(8),
                block_time=block_time,
                credit_time=leg_match.group(10),
                is_deadhead=is_deadhead,
                flight_date=current_day.flight_date,
            )
            current_day.legs.append(leg)
            continue

        # Day 요약
        summary_match = day_summary_pattern.search(line)
        if summary_match:
            current_day.day_block = summary_match.group(1)
            current_day.day_credit = summary_match.group(2)
            current_day.duty_time = summary_match.group(3)
            continue

        # Release/Hotel/Layover
        release_match = release_pattern.search(line)
        hotel_match = hotel_pattern.search(line)
        layover_match = layover_pattern.search(line)

        if release_match or hotel_match or layover_match:
            layover = current_day.layover or Layover(flight_date=current_day.flight_date)
            if release_match:
                layover.release_time = release_match.group(1)
            if hotel_match:
                layover.hotel_name = hotel_match.group(1).strip()
                layover.hotel_phone = f"({hotel_match.group(2)}){hotel_match.group(3)}"
            if layover_match:
                layover.layover_duration = layover_match.group(1)
            current_day.layover = layover

    return days


def _parse_crew_section(lines: list[str]) -> dict[int, list[CrewMember]]:
    """DESCRIPTION 하단의 크루 정보를 파싱한다."""
    crew_by_leg: dict[int, list[CrewMember]] = {}

    # 크루 라인 패턴: "2. CA: 019723 Theron Messick    FO: 097889 Taeyoung Cho ..."
    crew_line_pattern = re.compile(r"^(\d+)\.\s+(.*)")
    member_pattern = re.compile(r"(CA|FO|FA|FF):\s*(\d+)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?=\s{2,}(?:CA|FO|FA|FF):|\s*$)")

    # 크루 섹션 찾기 (빈 줄 뒤 숫자로 시작하는 패턴)
    in_crew_section = False
    blank_count = 0

    for line in lines:
        stripped = line.strip()

        if not stripped:
            blank_count += 1
            if blank_count >= 2:
                in_crew_section = True
            continue

        if in_crew_section:
            crew_match = crew_line_pattern.match(stripped)
            if crew_match:
                leg_num = int(crew_match.group(1))
                rest = crew_match.group(2)
                members = []
                for m in member_pattern.finditer(rest):
                    members.append(CrewMember(
                        position=m.group(1),
                        employee_id=m.group(2),
                        name=m.group(3).strip(),
                    ))
                if members:
                    crew_by_leg[leg_num] = members

        # 레그 라인이 아닌 경우 blank_count 리셋
        if stripped:
            blank_count = 0

    return crew_by_leg


def _assign_crew_to_legs(
    days: list[DayDetail],
    crew_by_leg: dict[int, list[CrewMember]],
) -> None:
    """파싱된 크루 정보를 각 비행 레그에 할당한다."""
    for day in days:
        for leg in day.legs:
            if leg.leg_number in crew_by_leg:
                leg.crew = crew_by_leg[leg.leg_number]
