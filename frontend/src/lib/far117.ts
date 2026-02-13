// Tag: core
// Path: frontend/src/lib/far117.ts

import type { Pairing } from "@/types";

// ── FAR 117.11 Table B — FDP Limits (hours) ──
// Row: report hour (acclimated local)
// Col: [1-2legs, 3legs, 4legs, 5legs, 6legs, 7+legs]

export const FDP_TABLE = [
  { range: [0, 3], limits: [9, 9, 9, 9, 9, 9] },
  { range: [4, 4], limits: [10, 10, 10, 9, 9, 9] },
  { range: [5, 5], limits: [12, 12, 11, 11, 10, 9] },
  { range: [6, 6], limits: [13, 13, 12, 12, 11, 10] },
  { range: [7, 12], limits: [14, 14, 13, 13, 12, 11] },
  { range: [13, 16], limits: [13, 13, 12, 12, 11, 10] },
  { range: [17, 21], limits: [12, 12, 11, 11, 10, 9] },
  { range: [22, 23], limits: [11, 11, 10, 10, 9, 9] },
];

export const PICKUP_PRESETS = [
  { label: "Early 2", reportH: 5, reportM: 0, legs: 2, blockH: 4, blockM: 0 },
  { label: "Mid 3", reportH: 7, reportM: 0, legs: 3, blockH: 6, blockM: 0 },
  { label: "Late 3", reportH: 14, reportM: 0, legs: 3, blockH: 5, blockM: 0 },
  { label: "Red-eye", reportH: 22, reportM: 0, legs: 2, blockH: 4, blockM: 0 },
];

// ── FDP Calculation ──

export function getFdpLimit(reportHour: number, numLegs: number): number {
  const col =
    numLegs <= 2 ? 0 : numLegs >= 7 ? 5 : numLegs - 2;
  for (const row of FDP_TABLE) {
    if (reportHour >= row.range[0] && reportHour <= row.range[1])
      return row.limits[col];
  }
  return 9;
}

export function formatFdpTime(hours: number): string {
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function addHoursToTime(
  hh: number,
  mm: number,
  addH: number
): string {
  let totalMin = hh * 60 + mm + Math.round(addH * 60);
  const nextDay = totalMin >= 1440;
  totalMin = ((totalMin % 1440) + 1440) % 1440;
  const nh = Math.floor(totalMin / 60);
  const nm = totalMin % 60;
  return `${nh.toString().padStart(2, "0")}:${nm
    .toString()
    .padStart(2, "0")}${nextDay ? " +1d" : ""}`;
}

export type FdpStatus = "normal" | "warning" | "extend" | "critical";

export function getFdpStatus(
  currentFdp: number,
  fdpLimit: number
): FdpStatus {
  const hardLimit = fdpLimit + 2;
  if (currentFdp > hardLimit) return "critical";
  if (currentFdp > fdpLimit) return "extend";
  if (fdpLimit - currentFdp < 1) return "warning";
  return "normal";
}

// ── Pickup Simulator ──

export interface PickupInput {
  reportH: number;
  reportM: number;
  legs: number;
  blockH: number;
  blockM: number;
}

export interface PickupResult {
  fdpHours: number;
  fdpLimit: number;
  fdpOk: boolean;

  flight28d: number | null;
  flight28dAfter: number | null;
  flight28dOk: boolean | null;

  restGapHours: number | null;
  restGapOk: boolean | null;

  canPickup: boolean;
  warnings: string[];
}

export function simulatePickup(
  input: PickupInput,
  scheduleData?: {
    flightTime28d: number;
    lastReleaseUtc: string;
  }
): PickupResult {
  const blockHours = input.blockH + input.blockM / 60;
  const estFdp = blockHours + 1.0; // +30min pre + 30min post
  const fdpLimit = getFdpLimit(input.reportH, input.legs);
  const fdpOk = estFdp <= fdpLimit;

  const warnings: string[] = [];

  let flight28d: number | null = null;
  let flight28dAfter: number | null = null;
  let flight28dOk: boolean | null = null;

  let restGapHours: number | null = null;
  let restGapOk: boolean | null = null;

  if (scheduleData) {
    flight28d = scheduleData.flightTime28d;
    flight28dAfter = flight28d + blockHours;
    flight28dOk = flight28dAfter <= 100;

    if (!flight28dOk) {
      warnings.push(
        `28-day flight time ${flight28dAfter.toFixed(1)}h exceeds 100h limit`
      );
    }

    if (scheduleData.lastReleaseUtc) {
      const lastRelease = new Date(scheduleData.lastReleaseUtc);
      const now = new Date();
      restGapHours = Math.round(
        ((now.getTime() - lastRelease.getTime()) / 3600000) * 10
      ) / 10;
      restGapOk = restGapHours >= 10;

      if (!restGapOk) {
        warnings.push(
          `Rest gap ${restGapHours.toFixed(1)}h is less than 10h minimum`
        );
      }
    }
  }

  if (!fdpOk) {
    warnings.push(
      `FDP ${estFdp.toFixed(1)}h exceeds ${fdpLimit}h limit`
    );
  }

  const canPickup =
    fdpOk &&
    (flight28dOk === null || flight28dOk) &&
    (restGapOk === null || restGapOk);

  return {
    fdpHours: Math.round(estFdp * 10) / 10,
    fdpLimit,
    fdpOk,
    flight28d,
    flight28dAfter: flight28dAfter !== null ? Math.round(flight28dAfter * 10) / 10 : null,
    flight28dOk,
    restGapHours,
    restGapOk,
    canPickup,
    warnings,
  };
}

// ── Schedule Data Extraction ──

function _parseHHMM(str: string | null): number {
  if (!str) return 0;
  const parts = str.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
}

export function getTodayDuty(pairings: Pairing[]): {
  reportTime: string | null;
  releaseTime: string | null;
  legs: number;
  blockHours: number;
  isOnDuty: boolean;
} | null {
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const p of pairings) {
    if (p.event_type !== "pairing") continue;
    for (const d of p.days) {
      if (d.flight_date !== todayStr) continue;
      if (d.legs.length === 0) continue;

      const blockMin = d.legs.reduce(
        (sum, l) => sum + _parseHHMM(l.block_time),
        0
      );

      const now = new Date();
      const reportUtc = d.report_time_utc ? new Date(d.report_time_utc) : null;
      const dutyMin = _parseHHMM(d.duty_time);
      const releaseUtc =
        reportUtc && dutyMin > 0
          ? new Date(reportUtc.getTime() + dutyMin * 60000)
          : null;
      const isOnDuty =
        reportUtc && releaseUtc
          ? now >= reportUtc && now <= releaseUtc
          : false;

      return {
        reportTime: d.report_time,
        releaseTime: releaseUtc
          ? `${releaseUtc.getUTCHours().toString().padStart(2, "0")}:${releaseUtc.getUTCMinutes().toString().padStart(2, "0")}Z`
          : null,
        legs: d.legs.filter((l) => !l.is_deadhead).length,
        blockHours: Math.round((blockMin / 60) * 10) / 10,
        isOnDuty,
      };
    }
  }
  return null;
}

export function getCumulativeFlightTime(
  pairings: Pairing[],
  windowDays: number
): number {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowDays * 86400000);
  let total = 0;

  for (const p of pairings) {
    if (p.event_type !== "pairing") continue;
    for (const d of p.days) {
      const flightDate = new Date(d.flight_date + "T00:00:00Z");
      if (flightDate < cutoff || flightDate > now) continue;
      for (const l of d.legs) {
        total += _parseHHMM(l.block_time);
      }
    }
  }
  return Math.round((total / 60) * 10) / 10;
}

export function getLastRelease(pairings: Pairing[]): string | null {
  const now = new Date();
  let latest: Date | null = null;

  for (const p of pairings) {
    if (p.event_type !== "pairing") continue;
    for (const d of p.days) {
      if (!d.report_time_utc || !d.duty_time) continue;
      const reportUtc = new Date(d.report_time_utc);
      const dutyMin = _parseHHMM(d.duty_time);
      if (dutyMin <= 0) continue;
      const releaseUtc = new Date(reportUtc.getTime() + dutyMin * 60000);
      if (releaseUtc <= now && (!latest || releaseUtc > latest)) {
        latest = releaseUtc;
      }
    }
  }

  return latest ? latest.toISOString() : null;
}
