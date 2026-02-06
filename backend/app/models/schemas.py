# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/models/schemas.py

from datetime import date, time, datetime, timedelta
from typing import Optional
from pydantic import BaseModel


class CrewMember(BaseModel):
    position: str          # CA, FO, FA, FF
    employee_id: str
    name: str


class Layover(BaseModel):
    hotel_name: Optional[str] = None
    hotel_phone: Optional[str] = None
    layover_duration: Optional[str] = None
    release_time: Optional[str] = None
    flight_date: date


class FlightLeg(BaseModel):
    leg_number: int
    flight_number: str
    ac_type: Optional[str] = None
    tail_number: Optional[str] = None
    origin: str
    destination: str
    depart_local: Optional[str] = None
    arrive_local: Optional[str] = None
    depart_utc: Optional[str] = None
    arrive_utc: Optional[str] = None
    depart_tz: Optional[str] = None
    arrive_tz: Optional[str] = None
    block_time: Optional[str] = None
    credit_time: Optional[str] = None
    is_deadhead: bool = False
    flight_date: date
    crew: list[CrewMember] = []


class DayDetail(BaseModel):
    flight_date: date
    report_time: Optional[str] = None
    report_time_utc: Optional[str] = None
    report_tz: Optional[str] = None
    legs: list[FlightLeg] = []
    day_block: Optional[str] = None
    day_credit: Optional[str] = None
    duty_time: Optional[str] = None
    layover: Optional[Layover] = None


class Pairing(BaseModel):
    pairing_id: str
    summary: str
    event_type: str            # pairing, njm, mov
    start_utc: datetime
    end_utc: datetime
    total_block: Optional[str] = None
    total_credit: Optional[str] = None
    tafb: Optional[str] = None
    days: list[DayDetail] = []


class ScheduleResponse(BaseModel):
    pairings: list[Pairing]
    total_flights: int
    total_block: Optional[str] = None


class FlightLegCSV(BaseModel):
    flight_number: str
    flight_date: date
    ac_type: Optional[str] = None
    tail_number: Optional[str] = None
    origin: str
    destination: str
    depart: Optional[str] = None
    arrive: Optional[str] = None
    block_time: Optional[str] = None
    credit_time: Optional[str] = None
    captain: Optional[str] = None
    first_officer: Optional[str] = None
    flight_attendant: Optional[str] = None
