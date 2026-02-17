// Tag: core
// Path: frontend/src/components/briefing/OverviewTab.tsx

"use client";

import { useMemo } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";
import { getTodayDuty } from "@/lib/far117";
import type { Pairing, Far117Status, DayDetail } from "@/types";

/* ── Types (mirrored from page.tsx internal interfaces) ── */

interface DayInfo {
  date: string;
  dateFormatted: string;
  legs: { origin: string; destination: string; flight_number: string; is_deadhead: boolean }[];
  airports: string[];
}

interface TripInfo {
  pairingId: string;
  summary: string;
  days: DayInfo[];
}

interface OverviewTabProps {
  trip: TripInfo | null;
  pairing: Pairing | null;
  briefingCache: Record<string, any>;
  loadingAirports: Set<string>;
  far117Status: Far117Status | null;
  far117Loading: boolean;
}

/* ── Fatigue Risk ── */

interface FatigueFlag {
  type: "short_rest" | "long_duty_consecutive" | "early_late" | "consecutive_days";
  message: string;
  dayIndex?: number;
}

interface FatigueResult {
  level: "low" | "moderate" | "high";
  flags: FatigueFlag[];
  dutyHours: { date: string; hours: number }[];
}

function parseHHMM(str: string | null | undefined): number {
  if (!str) return 0;
  const parts = str.split(":");
  if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1]) / 60;
  return 0;
}

function parseHHMMtoMinutes(str: string | null | undefined): number {
  if (!str) return 0;
  const parts = str.split(":");
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return 0;
}

function computeFatigueRisk(pairing: Pairing): FatigueResult {
  const flags: FatigueFlag[] = [];
  const dutyHours: { date: string; hours: number }[] = [];
  const days = pairing.days;

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const dh = parseHHMM(d.duty_time);
    dutyHours.push({ date: d.flight_date, hours: dh });

    // Short rest: layover_duration < 11h
    if (d.layover?.layover_duration) {
      const restH = parseHHMM(d.layover.layover_duration);
      if (restH > 0 && restH < 11) {
        flags.push({
          type: "short_rest",
          message: `Short rest ${restH.toFixed(1)}h after Day ${i + 1}`,
          dayIndex: i,
        });
      }
    }

    // Consecutive long duty: 9h+ for 2 days in a row
    if (i > 0) {
      const prevDh = parseHHMM(days[i - 1].duty_time);
      if (prevDh >= 9 && dh >= 9) {
        flags.push({
          type: "long_duty_consecutive",
          message: `Back-to-back long duty: Day ${i} (${prevDh.toFixed(1)}h) + Day ${i + 1} (${dh.toFixed(1)}h)`,
          dayIndex: i,
        });
      }
    }

    // Early report after late release
    if (i > 0 && days[i - 1].layover?.release_time && d.report_time) {
      const releaseStr = days[i - 1].layover!.release_time!;
      const reportStr = d.report_time;
      const releaseH = parseHHMM(releaseStr);
      const reportH = parseHHMM(reportStr);
      if (releaseH > 20 && reportH < 6) {
        flags.push({
          type: "early_late",
          message: `Early report (${reportStr}) after late release (${releaseStr}) on Day ${i + 1}`,
          dayIndex: i,
        });
      }
    }
  }

  // 4+ consecutive working days
  if (days.length >= 4) {
    flags.push({
      type: "consecutive_days",
      message: `${days.length} consecutive duty days`,
    });
  }

  const level = flags.length === 0 ? "low" : flags.length <= 2 ? "moderate" : "high";
  return { level, flags, dutyHours };
}

/* ── Category Badge ── */

const CATEGORY_BADGE: Record<string, string> = {
  VFR: "bg-emerald-900/30 text-emerald-400 border-emerald-800",
  MVFR: "bg-[#60a5fa]/10 text-[#60a5fa] border-[#60a5fa]/30",
  IFR: "bg-red-900/30 text-red-400 border-red-800",
  LIFR: "bg-purple-900/30 text-purple-400 border-purple-800",
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
        CATEGORY_BADGE[category] || "bg-zinc-800 text-zinc-400 border-zinc-700"
      }`}
    >
      {category}
    </span>
  );
}

/* ── Compact FDP Bar ── */

function FdpBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  let barColor = "bg-emerald-500";
  let textColor = "text-emerald-400";
  if (pct > 90) {
    barColor = "bg-red-500";
    textColor = "text-red-400";
  } else if (pct > 70) {
    barColor = "bg-amber-500";
    textColor = "text-amber-400";
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        {label && <span className="text-xs text-zinc-500">{label}</span>}
        <span className={`text-sm font-bold font-mono ${textColor}`}>
          {value}h / {max}h
        </span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Main Component ── */

export default function OverviewTab({
  trip,
  pairing,
  briefingCache,
  loadingAirports,
  far117Status,
  far117Loading,
}: OverviewTabProps) {
  const { pairings } = useScheduleStore();

  const todayDuty = useMemo(() => getTodayDuty(pairings), [pairings]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todayDay = useMemo(() => {
    if (!pairing) return null;
    return pairing.days.find((d) => d.flight_date === todayStr) ?? null;
  }, [pairing, todayStr]);

  const todayRoute = useMemo(() => {
    if (!todayDay) return null;
    const airports: string[] = [];
    for (const leg of todayDay.legs) {
      if (airports.length === 0) airports.push(leg.origin);
      airports.push(leg.destination);
    }
    return airports.join("\u2192");
  }, [todayDay]);

  const fatigueResult = useMemo(() => {
    if (!pairing) return null;
    return computeFatigueRisk(pairing);
  }, [pairing]);

  const maxDutyH = useMemo(() => {
    if (!fatigueResult) return 14;
    return Math.max(14, ...fatigueResult.dutyHours.map((d) => d.hours));
  }, [fatigueResult]);

  // Layover cities
  const layoverCities = useMemo(() => {
    if (!pairing) return [];
    return pairing.days
      .filter((d) => d.layover)
      .map((d) => {
        const lastLeg = d.legs[d.legs.length - 1];
        return lastLeg?.destination ?? null;
      })
      .filter(Boolean) as string[];
  }, [pairing]);

  // Total legs count
  const totalLegs = useMemo(() => {
    if (!pairing) return 0;
    return pairing.days.reduce((sum, d) => sum + d.legs.length, 0);
  }, [pairing]);

  // Weather: determine worst category per day (only first 2 days from TAF coverage)
  const weatherByDay = useMemo(() => {
    if (!trip) return [];
    return trip.days.map((day, i) => {
      if (i >= 2) return { date: day.dateFormatted, airports: day.airports, status: "unavailable" as const };
      const cats: { airport: string; category: string; loading: boolean }[] = day.airports.map((apt) => {
        if (loadingAirports.has(apt)) return { airport: apt, category: "?", loading: true };
        const b = briefingCache[apt];
        if (!b) return { airport: apt, category: "?", loading: false };
        return { airport: apt, category: b.metar?.category || "VFR", loading: false };
      });
      return { date: day.dateFormatted, airports: day.airports, status: "available" as const, cats };
    });
  }, [trip, briefingCache, loadingAirports]);

  if (!trip) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p>No trip selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* 1) Trip Summary */}
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Trip Summary
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <SummaryItem label="Pairing" value={trip.pairingId} />
          <SummaryItem label="Days" value={`${trip.days.length}`} />
          <SummaryItem label="Legs" value={`${totalLegs}`} />
          <SummaryItem label="Block" value={pairing?.total_block ?? "\u2014"} />
          <SummaryItem label="Credit" value={pairing?.total_credit ?? "\u2014"} />
          <SummaryItem label="TAFB" value={pairing?.tafb ?? "\u2014"} />
        </div>
        {layoverCities.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="uppercase font-semibold">Layovers</span>
            <span className="text-zinc-300">{layoverCities.join(", ")}</span>
          </div>
        )}
      </div>

      {/* 2) Today */}
      {todayDay && todayDuty && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-2">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Today
            {todayDuty.isOnDuty && (
              <span className="ml-2 text-emerald-400 normal-case">(On Duty)</span>
            )}
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-zinc-500 text-xs">Report</span>
              <p className="font-mono font-bold">{todayDuty.reportTime ?? "\u2014"}</p>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">Release</span>
              <p className="font-mono font-bold">{todayDuty.releaseTime ?? "\u2014"}</p>
            </div>
          </div>
          {todayRoute && (
            <p className="text-sm font-mono text-blue-400">{todayRoute}</p>
          )}
          {todayDay.layover?.hotel_name && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="uppercase font-semibold">Hotel</span>
              <span className="text-zinc-300">{todayDay.layover.hotel_name}</span>
              {todayDay.layover.hotel_phone && (
                <a href={`tel:${todayDay.layover.hotel_phone}`} className="text-blue-400">
                  {todayDay.layover.hotel_phone}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3) FDP Status (compact) */}
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          FDP Status
        </h3>
        {far117Loading ? (
          <div className="h-10 bg-zinc-800/50 rounded-lg animate-pulse" />
        ) : far117Status?.fdp ? (
          <div className="space-y-3">
            {far117Status.fdp.on_duty ? (
              <>
                <FdpBar
                  value={far117Status.fdp.current_hours}
                  max={far117Status.fdp.limit_hours}
                  label="Current FDP"
                />
                <p className="text-xs text-zinc-500">
                  {far117Status.fdp.remaining_hours}h remaining
                </p>
              </>
            ) : (
              <div>
                <p className="text-sm">
                  Max FDP:{" "}
                  <span className="font-bold font-mono text-blue-400">
                    {far117Status.fdp.limit_hours}h
                  </span>
                  <span className="text-zinc-500 ml-2">
                    ({far117Status.fdp.legs} legs)
                  </span>
                </p>
                {far117Status.fdp.next_duty_date && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Next duty: {far117Status.fdp.next_duty_date}
                  </p>
                )}
              </div>
            )}
            {far117Status.warnings.length > 0 && (
              <div className="space-y-1">
                {far117Status.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-400">
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No FDP data available</p>
        )}
      </div>

      {/* 4) Fatigue Risk */}
      {fatigueResult && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Fatigue Risk
            </h3>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                fatigueResult.level === "low"
                  ? "bg-emerald-900/30 text-emerald-400"
                  : fatigueResult.level === "moderate"
                    ? "bg-amber-900/30 text-amber-400"
                    : "bg-red-900/30 text-red-400"
              }`}
            >
              {fatigueResult.level === "low" ? "Low" : fatigueResult.level === "moderate" ? "Moderate" : "High"}
            </span>
          </div>

          {/* Day-by-day duty bar chart */}
          <div className="space-y-1.5">
            {fatigueResult.dutyHours.map((d, i) => {
              const pct = maxDutyH > 0 ? (d.hours / maxDutyH) * 100 : 0;
              const dateLabel = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 w-24 shrink-0 truncate">{dateLabel}</span>
                  <div className="flex-1 h-4 bg-zinc-800 rounded overflow-hidden">
                    <div
                      className={`h-full rounded transition-all ${
                        d.hours >= 12 ? "bg-red-500" : d.hours >= 9 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-zinc-400 w-12 text-right">
                    {d.hours.toFixed(1)}h
                  </span>
                </div>
              );
            })}
          </div>

          {/* Risk flags */}
          {fatigueResult.flags.length > 0 && (
            <div className="space-y-1 pt-1">
              {fatigueResult.flags.map((f, i) => (
                <p key={i} className="text-xs text-amber-400 flex items-start gap-1">
                  <span className="shrink-0">{"\u26A0"}</span>
                  <span>{f.message}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5) Weather Alerts */}
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Weather Alerts
        </h3>
        <div className="space-y-2">
          {weatherByDay.map((wd, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-24 shrink-0 truncate">
                Day {i + 1} <span className="text-zinc-600">{wd.date}</span>
              </span>
              {wd.status === "unavailable" ? (
                <span className="text-xs text-zinc-600 italic">Not yet available</span>
              ) : (
                <div className="flex gap-1.5 flex-wrap">
                  {wd.cats!.map((c, j) => (
                    <div key={j} className="flex items-center gap-1">
                      <span className="text-xs font-mono text-zinc-400">{c.airport}</span>
                      {c.loading ? (
                        <span className="text-xs text-zinc-600">Loading...</span>
                      ) : (
                        <CategoryBadge category={c.category} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {weatherByDay.length === 0 && (
            <p className="text-sm text-zinc-500">No weather data</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Summary Item ── */

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-zinc-500 uppercase">{label}</span>
      <p className="text-sm font-mono font-bold">{value}</p>
    </div>
  );
}
