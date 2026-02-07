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
    """기존 스케줄 삭제 후 새 스케줄을 DB에 저장한다."""
    db = get_supabase()

    # public.users에 레코드가 없으면 생성 (auth.users와 동기화)
    db.table("users").upsert({"id": user_id, "email": email}, on_conflict="id").execute()

    # 기존 데이터 삭제 (CASCADE로 하위 테이블도 삭제됨)
    db.table("pairings").delete().eq("user_id", user_id).execute()

    for p in pairings:
        # pairing 저장
        pairing_row = db.table("pairings").insert({
            "user_id": user_id,
            "pairing_id": p.pairing_id,
            "summary": p.summary,
            "event_type": p.event_type,
            "start_utc": p.start_utc.isoformat(),
            "end_utc": p.end_utc.isoformat(),
            "total_block": p.total_block,
            "total_credit": p.total_credit,
            "tafb": p.tafb,
        }).execute()

        db_pairing_id = pairing_row.data[0]["id"]

        for day in p.days:
            # day_summary 저장
            db.table("day_summaries").insert({
                "pairing_id": db_pairing_id,
                "flight_date": day.flight_date.isoformat(),
                "report_time": day.report_time,
                "day_block": day.day_block,
                "day_credit": day.day_credit,
                "duty_time": day.duty_time,
            }).execute()

            # layover 저장
            if day.layover:
                db.table("layovers").insert({
                    "pairing_id": db_pairing_id,
                    "hotel_name": day.layover.hotel_name,
                    "hotel_phone": day.layover.hotel_phone,
                    "layover_duration": day.layover.layover_duration,
                    "release_time": day.layover.release_time,
                    "flight_date": day.layover.flight_date.isoformat(),
                }).execute()

            # flight_legs 저장
            for leg in day.legs:
                leg_row = db.table("flight_legs").insert({
                    "pairing_id": db_pairing_id,
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
                }).execute()

                db_leg_id = leg_row.data[0]["id"]

                # crew 저장
                for crew in leg.crew:
                    db.table("crew_assignments").insert({
                        "flight_leg_id": db_leg_id,
                        "position": crew.position,
                        "employee_id": crew.employee_id,
                        "name": crew.name,
                    }).execute()


def get_schedule(user_id: str) -> Optional[ScheduleResponse]:
    """DB에서 사용자의 스케줄을 조회하여 ScheduleResponse로 구성한다."""
    db = get_supabase()

    # 페어링 조회
    pairing_rows = (
        db.table("pairings")
        .select("*")
        .eq("user_id", user_id)
        .order("start_utc")
        .execute()
    )

    if not pairing_rows.data:
        return None

    pairings: list[Pairing] = []
    total_flights = 0

    for pr in pairing_rows.data:
        db_pid = pr["id"]

        # day_summaries 조회
        day_rows = (
            db.table("day_summaries")
            .select("*")
            .eq("pairing_id", db_pid)
            .order("flight_date")
            .execute()
        )

        # layovers 조회
        layover_rows = (
            db.table("layovers")
            .select("*")
            .eq("pairing_id", db_pid)
            .execute()
        )
        layover_map: dict[str, dict] = {}
        for lr in layover_rows.data:
            layover_map[lr["flight_date"]] = lr

        # flight_legs 조회
        leg_rows = (
            db.table("flight_legs")
            .select("*")
            .eq("pairing_id", db_pid)
            .order("flight_date")
            .order("leg_number")
            .execute()
        )

        # crew 조회 (모든 legs의 crew를 한번에)
        leg_ids = [lr["id"] for lr in leg_rows.data]
        crew_map: dict[str, list[dict]] = {}
        if leg_ids:
            crew_rows = (
                db.table("crew_assignments")
                .select("*")
                .in_("flight_leg_id", leg_ids)
                .execute()
            )
            for cr in crew_rows.data:
                crew_map.setdefault(cr["flight_leg_id"], []).append(cr)

        # legs를 날짜별로 그룹핑
        legs_by_date: dict[str, list[FlightLeg]] = {}
        for lr in leg_rows.data:
            flight_date_str = lr["flight_date"]
            crew_list = [
                CrewMember(
                    position=c["position"],
                    employee_id=c["employee_id"] or "",
                    name=c["name"] or "",
                )
                for c in crew_map.get(lr["id"], [])
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
        for dr in day_rows.data:
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
