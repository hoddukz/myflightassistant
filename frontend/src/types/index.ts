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

export interface FlightTrackLive {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  speed: number | null;
  heading?: number | null;
  vertical_rate?: number | null;
  on_ground?: boolean;
  distance_nm?: number | null;
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

export type ThemeMode = "dark" | "red-light";
