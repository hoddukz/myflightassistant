// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/types/index.ts

export interface CrewMember {
  position: "CA" | "FO" | "FA" | "FF";
  employee_id: string;
  name: string;
}

export interface Layover {
  hotel_name: string | null;
  hotel_phone: string | null;
  layover_duration: string | null;
  release_time: string | null;
  flight_date: string;
}

export interface FlightLeg {
  leg_number: number;
  flight_number: string;
  ac_type: string | null;
  tail_number: string | null;
  origin: string;
  destination: string;
  depart_local: string | null;
  arrive_local: string | null;
  depart_utc: string | null;
  arrive_utc: string | null;
  depart_tz: string | null;
  arrive_tz: string | null;
  block_time: string | null;
  credit_time: string | null;
  is_deadhead: boolean;
  flight_date: string;
  crew: CrewMember[];
}

export interface DayDetail {
  flight_date: string;
  report_time: string | null;
  report_time_utc: string | null;
  report_tz: string | null;
  legs: FlightLeg[];
  day_block: string | null;
  day_credit: string | null;
  duty_time: string | null;
  layover: Layover | null;
}

export interface Pairing {
  pairing_id: string;
  summary: string;
  event_type: "pairing" | "njm" | "mov" | "vac" | "training" | "other";
  start_utc: string;
  end_utc: string;
  total_block: string | null;
  total_credit: string | null;
  tafb: string | null;
  days: DayDetail[];
}

export interface ScheduleResponse {
  pairings: Pairing[];
  total_flights: number;
  total_block: string | null;
}

export interface FlightTrackDeparture {
  airport: string;
  scheduled: string | null;
  estimated: string | null;
  actual: string | null;
  delay_minutes: number | null;
}

export interface FlightTrackArrival {
  airport: string;
  scheduled: string | null;
  estimated: string | null;
  actual: string | null;
  delay_minutes: number | null;
}

export type FlightPhase =
  | "gate_departure"
  | "takeoff"
  | "climbing"
  | "cruise"
  | "step_descent"
  | "level_off"
  | "reclimb"
  | "initial_descent"
  | "approach"
  | "final"
  | "holding"
  | "arrived";

export interface FlightTrackLive {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  speed: number | null;
  heading?: number | null;
  vertical_rate?: number | null;
  on_ground?: boolean;
  distance_nm?: number | null;
  phase?: FlightPhase | null;
  phase_label?: string | null;
  phase_short?: string | null;
  progress?: number | null;
  total_distance?: number | null;
  short_leg?: boolean;
}

export interface FlightTrackData {
  available: boolean;
  reason?: string;
  provider?: string;
  flight_number?: string;
  tail_number?: string;
  status?: string;
  departure?: FlightTrackDeparture;
  arrival?: FlightTrackArrival;
  live?: FlightTrackLive;
  fetched_at?: number;
}

export interface Far117Status {
  has_schedule: boolean;
  fdp: {
    current_hours: number;
    limit_hours: number;
    remaining_hours: number;
    legs: number;
    report_hour_local: number;
    on_duty: boolean;
    next_duty_date: string | null;
  } | null;
  flight_time: {
    last_28d: number;
    limit_28d: number;
    last_365d: number;
    limit_365d: number;
  } | null;
  rest: {
    last_rest_hours: number;
    min_required: number;
    next_report_earliest: string | null;
    longest_rest_168h: number;
    rest_56h_met: boolean;
  } | null;
  warnings: string[];
}

export interface Far117DelayResult {
  scenario: string;
  feasible: boolean;
  new_fdp_hours: number;
  fdp_limit: number;
  warnings: string[];
}

export type ThemeMode = "dark" | "red-light";
