# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/services/schedule_db.py

from datetime import date
from typing import Optional

from app.db.supabase import get_supabase
from app.models.schemas import (
    Pairing,
    DayDetail,
    FlightLeg,
    CrewMember,
    Layover,
    ScheduleResponse,
)


def save_schedule(user_id: str, email: str, pairings: list[Pairing]) -> None:
    """기존 스케줄 삭제 후 새 스케줄을 DB에 저장한다. (배치 insert 최적화)"""
    db = get_supabase()

    # 1) users upsert + 기존 데이터 삭제 (2 requests)
    db.table("users").upsert({"id": user_id, "email": email}, on_conflict="id").execute()
    db.table("pairings").delete().eq("user_id", user_id).execute()

    if not pairings:
        return

    # 2) pairings 배치 insert (1 request)
    pairing_inserts = [
        {
            "user_id": user_id,
            "pairing_id": p.pairing_id,
            "summary": p.summary,
            "event_type": p.event_type,
            "start_utc": p.start_utc.isoformat(),
            "end_utc": p.end_utc.isoformat(),
            "total_block": p.total_block,
            "total_credit": p.total_credit,
            "tafb": p.tafb,
        }
        for p in pairings
    ]
    pairing_result = db.table("pairings").insert(pairing_inserts).execute()
    db_pairing_ids = [r["id"] for r in pairing_result.data]

    # 3) day_summaries + layovers 배치 수집 후 insert (최대 2 requests)
    day_inserts: list[dict] = []
    layover_inserts: list[dict] = []
    # leg 데이터도 함께 수집 (crew 정보 별도 보관)
    leg_inserts: list[dict] = []
    leg_crews: list[list] = []  # leg_inserts와 동일 인덱스

    for i, p in enumerate(pairings):
        db_pid = db_pairing_ids[i]
        for day in p.days:
            day_inserts.append({
                "pairing_id": db_pid,
                "flight_date": day.flight_date.isoformat(),
                "report_time": day.report_time,
                "day_block": day.day_block,
                "day_credit": day.day_credit,
                "duty_time": day.duty_time,
            })
            if day.layover:
                layover_inserts.append({
                    "pairing_id": db_pid,
                    "hotel_name": day.layover.hotel_name,
                    "hotel_phone": day.layover.hotel_phone,
                    "layover_duration": day.layover.layover_duration,
                    "release_time": day.layover.release_time,
                    "flight_date": day.layover.flight_date.isoformat(),
                })
            for leg in day.legs:
                leg_inserts.append({
                    "pairing_id": db_pid,
                    "leg_number": leg.leg_number,
                    "flight_number": leg.flight_number,
                    "ac_type": leg.ac_type,
                    "tail_number": leg.tail_number,
                    "origin": leg.origin,
                    "destination": leg.destination,
                    "depart_local": leg.depart_local,
                    "arrive_local": leg.arrive_local,
                    "depart_utc": leg.depart_utc,
                    "arrive_utc": leg.arrive_utc,
                    "block_time": leg.block_time,
                    "credit_time": leg.credit_time,
                    "is_deadhead": leg.is_deadhead,
                    "flight_date": leg.flight_date.isoformat(),
                })
                leg_crews.append(leg.crew)

    if day_inserts:
        db.table("day_summaries").insert(day_inserts).execute()
    if layover_inserts:
        db.table("layovers").insert(layover_inserts).execute()

    # 4) flight_legs 배치 insert (1 request)
    if leg_inserts:
        leg_result = db.table("flight_legs").insert(leg_inserts).execute()
        db_leg_ids = [r["id"] for r in leg_result.data]

        # 5) crew_assignments 배치 insert (1 request)
        crew_inserts: list[dict] = []
        for j, crews in enumerate(leg_crews):
            db_leg_id = db_leg_ids[j]
            for crew in crews:
                crew_inserts.append({
                    "flight_leg_id": db_leg_id,
                    "position": crew.position,
                    "employee_id": crew.employee_id,
                    "name": crew.name,
                })
        if crew_inserts:
            db.table("crew_assignments").insert(crew_inserts).execute()


def get_schedule(user_id: str) -> Optional[ScheduleResponse]:
    """DB에서 사용자의 스케줄을 조회하여 ScheduleResponse로 구성한다. (single nested query)"""
    db = get_supabase()

    # 단일 nested join 쿼리로 모든 데이터를 한번에 가져온다 (1 request)
    result = (
        db.table("pairings")
        .select("*, day_summaries(*), layovers(*), flight_legs(*, crew_assignments(*))")
        .eq("user_id", user_id)
        .order("start_utc")
        .execute()
    )

    if not result.data:
        return None

    pairings: list[Pairing] = []
    total_flights = 0

    for pr in result.data:
        # day_summaries — flight_date 기준 정렬
        day_rows = sorted(pr.get("day_summaries", []), key=lambda x: x["flight_date"])

        # layovers — flight_date으로 인덱싱
        layover_map: dict[str, dict] = {}
        for lr in pr.get("layovers", []):
            layover_map[lr["flight_date"]] = lr

        # flight_legs — flight_date, leg_number 기준 정렬
        leg_rows = sorted(
            pr.get("flight_legs", []),
            key=lambda x: (x["flight_date"], x["leg_number"]),
        )

        # legs를 날짜별로 그룹핑
        legs_by_date: dict[str, list[FlightLeg]] = {}
        for lr in leg_rows:
            flight_date_str = lr["flight_date"]
            crew_list = [
                CrewMember(
                    position=c["position"],
                    employee_id=c.get("employee_id") or "",
                    name=c.get("name") or "",
                )
                for c in lr.get("crew_assignments", [])
            ]
            leg = FlightLeg(
                leg_number=lr["leg_number"],
                flight_number=lr["flight_number"] or "",
                ac_type=lr["ac_type"],
                tail_number=lr["tail_number"],
                origin=lr["origin"],
                destination=lr["destination"],
                depart_local=lr["depart_local"],
                arrive_local=lr["arrive_local"],
                depart_utc=lr["depart_utc"],
                arrive_utc=lr["arrive_utc"],
                block_time=lr["block_time"],
                credit_time=lr["credit_time"],
                is_deadhead=lr["is_deadhead"] or False,
                flight_date=date.fromisoformat(flight_date_str),
                crew=crew_list,
            )
            legs_by_date.setdefault(flight_date_str, []).append(leg)
            total_flights += 1

        # DayDetail 구성
        days: list[DayDetail] = []
        for dr in day_rows:
            fd = dr["flight_date"]
            layover_data = layover_map.get(fd)
            layover = None
            if layover_data:
                layover = Layover(
                    hotel_name=layover_data["hotel_name"],
                    hotel_phone=layover_data["hotel_phone"],
                    layover_duration=layover_data["layover_duration"],
                    release_time=layover_data["release_time"],
                    flight_date=date.fromisoformat(layover_data["flight_date"]),
                )
            days.append(
                DayDetail(
                    flight_date=date.fromisoformat(fd),
                    report_time=dr["report_time"],
                    legs=legs_by_date.get(fd, []),
                    day_block=dr["day_block"],
                    day_credit=dr["day_credit"],
                    duty_time=dr["duty_time"],
                    layover=layover,
                )
            )

        pairings.append(
            Pairing(
                pairing_id=pr["pairing_id"],
                summary=pr["summary"] or "",
                event_type=pr["event_type"],
                start_utc=pr["start_utc"],
                end_utc=pr["end_utc"],
                total_block=pr["total_block"],
                total_credit=pr["total_credit"],
                tafb=pr["tafb"],
                days=days,
            )
        )

    return ScheduleResponse(
        pairings=pairings,
        total_flights=total_flights,
    )
