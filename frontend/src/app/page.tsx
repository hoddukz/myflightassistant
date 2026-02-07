// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/page.tsx

"use client";

import { useMemo } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";
import { getEventTypeLabel, getEventTypeColor } from "@/lib/utils";
import Link from "next/link";
import type { Pairing, DayDetail } from "@/types";

export default function Dashboard() {
  const { pairings, totalFlights } = useScheduleStore();

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // 다음 1개 이벤트
  const nextEvent = useMemo(() => {
    return pairings.find(
      (p) =>
        new Date(p.end_utc) >= now &&
        new Date(p.start_utc).toISOString().slice(0, 10) !== todayStr
    ) ?? null;
  }, [pairings, todayStr]);

  // 현재 진행 중인 트립 (pairing only)
  const currentTrip = useMemo(() => {
    return pairings.find(
      (p) =>
        p.event_type === "pairing" &&
        new Date(p.start_utc) <= now &&
        new Date(p.end_utc) >= now
    ) ?? null;
  }, [pairings, now]);

  // 오늘 비행 레그
  const todayLegs = useMemo(() => {
    const raw = pairings
      .filter((p) => p.event_type === "pairing")
      .flatMap((p) => p.days)
      .filter((d) => d.flight_date === todayStr)
      .flatMap((d) => d.legs);

    const nowUtc = now.getTime();
    const mapped = raw.map((leg) => {
      let passed = false;
      if (leg.arrive_utc && leg.flight_date) {
        let arrUtc = new Date(`${leg.flight_date}T${leg.arrive_utc}:00Z`);
        if (leg.depart_utc) {
          const depUtc = new Date(`${leg.flight_date}T${leg.depart_utc}:00Z`);
          if (arrUtc < depUtc) arrUtc = new Date(arrUtc.getTime() + 86400000);
        }
        passed = nowUtc > arrUtc.getTime();
      }
      return { ...leg, passed };
    });
    const firstUpcoming = mapped.findIndex((l) => !l.passed);
    if (firstUpcoming <= 0) return mapped;
    return [...mapped.slice(firstUpcoming), ...mapped.slice(0, firstUpcoming)];
  }, [pairings, todayStr]);

  // 오늘의 레이오버
  const todayLayover = useMemo(() => {
    for (const p of pairings) {
      if (p.event_type !== "pairing") continue;
      for (const d of p.days) {
        if (d.flight_date === todayStr && d.layover) {
          return d.layover;
        }
      }
    }
    return null;
  }, [pairings, todayStr]);

  // 다음 비행 카운트다운
  const nextFlight = useMemo(() => {
    for (const p of pairings) {
      if (p.event_type !== "pairing") continue;
      for (const d of p.days) {
        for (const leg of d.legs) {
          if (!leg.depart_utc || !leg.flight_date) continue;
          const depUtc = new Date(`${leg.flight_date}T${leg.depart_utc}:00Z`);
          if (depUtc > now) {
            return { leg, depUtc, day: d, pairing: p };
          }
        }
      }
    }
    return null;
  }, [pairings, now]);

  // 이번 달 통계 (완료/전체)
  const monthlyStats = useMemo(() => {
    const monthStr = todayStr.slice(0, 7);
    let totalBlock = 0;
    let totalCredit = 0;
    let doneBlock = 0;
    let doneCredit = 0;

    for (const p of pairings) {
      if (p.event_type !== "pairing") continue;
      for (const d of p.days) {
        if (!d.flight_date.startsWith(monthStr)) continue;
        for (const l of d.legs) {
          const bm = l.block_time ? _parseTime(l.block_time) : 0;
          const cm = l.credit_time ? _parseTime(l.credit_time) : 0;
          totalBlock += bm;
          totalCredit += cm;
          if (l.arrive_utc && l.flight_date) {
            let arr = new Date(`${l.flight_date}T${l.arrive_utc}:00Z`);
            if (l.depart_utc) {
              const dep = new Date(`${l.flight_date}T${l.depart_utc}:00Z`);
              if (arr <= dep) arr = new Date(arr.getTime() + 86400000);
            }
            if (now > arr) {
              doneBlock += bm;
              doneCredit += cm;
            }
          }
        }
      }
    }
    return {
      blockTotal: _formatMinutes(totalBlock),
      blockDone: _formatMinutes(doneBlock),
      creditTotal: _formatMinutes(totalCredit),
      creditDone: _formatMinutes(doneCredit),
    };
  }, [pairings, todayStr]);

  return (
    <div className="space-y-5">
      {/* Header: Dashboard 왼쪽, My Flight Assistant 오른쪽 (같은 줄) */}
      <div className="pt-2 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-zinc-500 text-sm">My Flight Assistant</p>
      </div>

      {pairings.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="text-4xl">{"\u2708"}</div>
          <p className="text-zinc-400">No schedule loaded</p>
          <Link
            href="/schedule"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Upload Schedule
          </Link>
        </div>
      ) : (
        <>
          {/* FEBRUARY STATS 라벨 */}
          <h2 className="text-sm font-semibold text-zinc-400">
            {now.toLocaleDateString("en-US", { month: "long" }).toUpperCase()} STATS
          </h2>

          {/* 상단 통계 (이번 달 완료/전체) */}
          <div className="grid grid-cols-3 gap-3">
            {(() => {
              const monthStr = todayStr.slice(0, 7);
              const monthTrips = pairings.filter(
                (p) => p.event_type === "pairing" && p.start_utc.slice(0, 7) <= monthStr && p.end_utc.slice(0, 7) >= monthStr
              );
              const doneTrips = monthTrips.filter((p) => new Date(p.end_utc) < now).length;
              const monthLegs = monthTrips.flatMap((p) => p.days).filter((d) => d.flight_date.startsWith(monthStr)).flatMap((d) => d.legs).filter((l) => !l.is_deadhead);
              const doneLegs = monthLegs.filter((l) => {
                if (!l.arrive_utc || !l.flight_date) return false;
                let arr = new Date(`${l.flight_date}T${l.arrive_utc}:00Z`);
                if (l.depart_utc) {
                  const dep = new Date(`${l.flight_date}T${l.depart_utc}:00Z`);
                  if (arr < dep) arr = new Date(arr.getTime() + 86400000);
                }
                return now > arr;
              }).length;
              const monthStart = new Date(`${monthStr}-01T00:00:00Z`);
              const monthEndDate = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
              const monthEndStr = monthEndDate.toISOString().slice(0, 10);
              let totalOffDays = 0;
              let doneOffDays = 0;
              pairings.filter((p) => p.event_type === "njm").forEach((p) => {
                const s = new Date(p.start_utc);
                const e = new Date(p.end_utc);
                const rangeStart = s < monthStart ? monthStart : s;
                const rangeEnd = e > new Date(`${monthEndStr}T23:59:59Z`) ? new Date(`${monthEndStr}T23:59:59Z`) : e;
                if (rangeStart > rangeEnd) return;
                const days = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86400000);
                totalOffDays += days;
                const doneEnd = now < rangeEnd ? now : rangeEnd;
                if (doneEnd > rangeStart) {
                  doneOffDays += Math.ceil((doneEnd.getTime() - rangeStart.getTime()) / 86400000);
                }
              });
              return (
                <>
                  <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                    <p className="text-zinc-500 text-xs">Trips</p>
                    <p className="text-xl font-bold font-mono">
                      <span className="text-blue-400">{doneTrips}</span>
                      <span className="text-zinc-600">/</span>
                      {monthTrips.length}
                    </p>
                  </div>
                  <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                    <p className="text-zinc-500 text-xs">Flights</p>
                    <p className="text-xl font-bold font-mono">
                      <span className="text-blue-400">{doneLegs}</span>
                      <span className="text-zinc-600">/</span>
                      {monthLegs.length}
                    </p>
                  </div>
                  <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                    <p className="text-zinc-500 text-xs">Off Days</p>
                    <p className="text-xl font-bold font-mono">
                      <span className="text-blue-400">{doneOffDays}</span>
                      <span className="text-zinc-600">/</span>
                      {totalOffDays}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Block Hours / Credit Hours (완료/전체) */}
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Block Hours</span>
              <span className="text-sm font-mono font-bold">
                <span className="text-blue-400">{monthlyStats.blockDone}</span>
                <span className="text-zinc-600">/</span>
                {monthlyStats.blockTotal}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Credit Hours</span>
              <span className="text-sm font-mono font-bold">
                <span className="text-blue-400">{monthlyStats.creditDone}</span>
                <span className="text-zinc-600">/</span>
                {monthlyStats.creditTotal}
              </span>
            </div>
          </div>

          {/* Current Trip 타임라인 */}
          {currentTrip && <TripTimeline trip={currentTrip} todayStr={todayStr} />}

          {/* Next Flight 카운트다운 */}
          {nextFlight && (
            <Link href="/briefing" className="block">
              <div className="bg-gradient-to-r from-blue-900/40 to-zinc-900 rounded-xl p-4 border border-blue-800/30">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-blue-400 font-semibold">NEXT FLIGHT</p>
                  <CountdownDisplay target={nextFlight.depUtc} now={now} />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{nextFlight.leg.origin}</p>
                    <p className="text-sm text-zinc-500">{nextFlight.leg.depart_local}</p>
                  </div>
                  <div className="flex-1 mx-4 flex flex-col items-center">
                    <span className="text-blue-400 font-mono text-sm font-bold">
                      {nextFlight.leg.flight_number}
                    </span>
                    <div className="w-full border-t border-dashed border-zinc-700 mt-1" />
                    {nextFlight.leg.ac_type && (
                      <span className="text-xs text-zinc-600 mt-1">{nextFlight.leg.ac_type}</span>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{nextFlight.leg.destination}</p>
                    <p className="text-sm text-zinc-500">{nextFlight.leg.arrive_local}</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 mt-2">
                  {new Date(nextFlight.leg.flight_date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric",
                  })}
                  {nextFlight.day.report_time && ` \u00B7 Report: ${nextFlight.day.report_time}`}
                </p>
              </div>
            </Link>
          )}

          {/* UPCOMING 1개 */}
          {nextEvent && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-400">UPCOMING</h2>
              <Link
                href="/schedule"
                className="block bg-zinc-900 rounded-xl p-4 border border-zinc-800 active:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${getEventTypeColor(
                        nextEvent.event_type
                      )} text-white`}
                    >
                      {getEventTypeLabel(nextEvent.event_type)}
                    </span>
                    <span className="text-sm font-medium">{nextEvent.summary}</span>
                  </div>
                  <span className="text-zinc-600 text-sm">{"\u203A"}</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                  <span>
                    {new Date(nextEvent.start_utc).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                    })}
                    {" - "}
                    {new Date(nextEvent.end_utc).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                    })}
                  </span>
                  {nextEvent.total_block && <span>Block: {nextEvent.total_block}</span>}
                  {nextEvent.total_credit && <span>Credit: {nextEvent.total_credit}</span>}
                </div>
              </Link>
            </div>
          )}

          {/* LAYOVER */}
          {todayLayover && (todayLayover.hotel_name || todayLayover.layover_duration) && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-400">LAYOVER</h2>
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                {todayLayover.hotel_name && (
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{"\uD83C\uDFE8"}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{todayLayover.hotel_name}</p>
                      {todayLayover.hotel_phone && (
                        <a
                          href={`tel:${todayLayover.hotel_phone.replace(/[^\d+]/g, "")}`}
                          className="text-sm text-blue-400 hover:text-blue-300 font-mono mt-1 inline-block"
                        >
                          {todayLayover.hotel_phone}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {todayLayover.layover_duration && (
                  <div className={`flex items-center gap-2 text-sm text-zinc-500 ${todayLayover.hotel_name ? "mt-3 pt-3 border-t border-zinc-800" : ""}`}>
                    <span>Layover: {todayLayover.layover_duration}</span>
                    {todayLayover.release_time && (
                      <span className="text-zinc-600">{"\u00B7"} Release: {todayLayover.release_time}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TODAY'S FLIGHTS */}
          {todayLegs.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-400">TODAY&apos;S FLIGHTS</h2>
              {todayLegs.map((leg, i) => (
                <div
                  key={i}
                  className={`bg-zinc-900 rounded-xl p-4 border border-zinc-800 ${
                    leg.passed ? "opacity-40" : leg.is_deadhead ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-blue-400 font-mono font-bold text-base">
                        {leg.flight_number}
                      </span>
                      {leg.is_deadhead && (
                        <span className="text-xs bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">
                          DH
                        </span>
                      )}
                    </div>
                    {leg.ac_type && (
                      <span className="text-zinc-500 text-xs">{leg.ac_type}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-center">
                      <p className="text-xl font-bold">{leg.origin}</p>
                      <p className="text-sm text-zinc-500">{leg.depart_local}</p>
                    </div>
                    <div className="flex-1 mx-4 border-t border-dashed border-zinc-700" />
                    <div className="text-center">
                      <p className="text-xl font-bold">{leg.destination}</p>
                      <p className="text-sm text-zinc-500">{leg.arrive_local}</p>
                    </div>
                  </div>
                  {leg.tail_number && (
                    <a
                      href={`https://flightaware.com/live/flight/${leg.tail_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-amber-400 hover:text-amber-300 font-mono"
                    >
                      {leg.tail_number} {"\u2197"}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────── Trip Timeline (공항 기반 + 비행기 아이콘) ─────────── */

function TripTimeline({ trip, todayStr }: { trip: Pairing; todayStr: string }) {
  const days = trip.days.filter((d) => d.legs.length > 0);
  if (days.length === 0) return null;

  const totalDays = days.length;
  const todayIdx = days.findIndex((d) => d.flight_date === todayStr);

  // 오늘의 레그만 추출
  const todayDay = days.find((d) => d.flight_date === todayStr);
  const todayLegs = todayDay ? todayDay.legs : [];

  // 오늘의 공항 시퀀스: DTW → ORD → MSP
  const todayAirports = todayLegs.length > 0
    ? [todayLegs[0].origin, ...todayLegs.map((l) => l.destination)]
    : [];

  // summary 포맷: "DTW-ORD-MSP-DTW 3Day" → "3Day DTW-ORD-MSP-DTW"
  const dayMatch = trip.summary.match(/(\d+Day)$/i);
  const dayLabel = dayMatch ? dayMatch[1] : `${totalDays}Day`;
  const routeLabel = trip.summary.replace(/\s*\d+Day$/i, "").trim();

  // 현재 진행 상태 (오늘 레그 기준)
  const now = new Date();
  let completedLegs = 0;
  let flyingProgress = 0;
  let isFlying = false;

  for (let i = 0; i < todayLegs.length; i++) {
    const leg = todayLegs[i];
    if (!leg.depart_utc || !leg.arrive_utc || !leg.flight_date) continue;
    let dep = new Date(`${leg.flight_date}T${leg.depart_utc}:00Z`);
    let arr = new Date(`${leg.flight_date}T${leg.arrive_utc}:00Z`);
    if (arr <= dep) arr = new Date(arr.getTime() + 86400000);

    if (now >= arr) {
      completedLegs = i + 1;
    } else if (now >= dep) {
      completedLegs = i;
      isFlying = true;
      flyingProgress = (now.getTime() - dep.getTime()) / (arr.getTime() - dep.getTime());
      break;
    } else {
      break;
    }
  }

  // 비행기 위치 (%)
  let planePct = 0;
  if (todayAirports.length > 1) {
    const segments = todayAirports.length - 1;
    if (completedLegs >= todayLegs.length) {
      planePct = 100;
    } else if (isFlying) {
      planePct = ((completedLegs + flyingProgress) / segments) * 100;
    } else {
      planePct = (completedLegs / segments) * 100;
    }
  }

  // 오늘 비행 없는 날 (레이오버)
  if (todayAirports.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-400">CURRENT TRIP</h2>
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-blue-400">
              {dayLabel} {routeLabel}
            </span>
            <span className="text-xs text-zinc-500">Layover</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-400">CURRENT TRIP</h2>
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-2">
        {/* 트립 정보 */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-blue-400">
            {todayAirports.join("-")}
          </span>
          <span className="text-xs text-zinc-500">
            {todayIdx >= 0 ? `Day ${todayIdx + 1}/${totalDays}` : `${totalDays} days`}
          </span>
        </div>

        {/* 타임라인 */}
        <div className="mt-1">
          {/* 트랙 + 점 + 비행기 (같은 높이) */}
          <div className="relative h-4">
            {/* 트랙 */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] bg-zinc-800 rounded-full">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${planePct}%` }}
              />
            </div>
            {/* 공항 점 */}
            {todayAirports.map((_, i) => {
              const pct = todayAirports.length > 1 ? (i / (todayAirports.length - 1)) * 100 : 0;
              const reached = pct <= planePct + 0.5;
              return (
                <div
                  key={i}
                  className={`absolute top-1/2 z-10 w-2.5 h-2.5 rounded-full ${
                    reached ? "bg-blue-500" : "bg-zinc-700"
                  }`}
                  style={{ left: `${pct}%`, transform: "translate(-50%, -50%)" }}
                />
              );
            })}
            {/* 비행기 */}
            <div
              className="absolute top-1/2 z-20 transition-all duration-1000"
              style={{ left: `${planePct}%`, transform: "translate(-50%, -50%) rotate(45deg)" }}
            >
              <span className="text-sm leading-none">{"\u2708\uFE0F"}</span>
            </div>
          </div>
          {/* 공항 라벨 */}
          <div className="relative h-4 mt-0.5">
            {todayAirports.map((code, i) => {
              const pct = todayAirports.length > 1 ? (i / (todayAirports.length - 1)) * 100 : 0;
              const reached = pct <= planePct + 0.5;
              const isEdge = i === 0 || i === todayAirports.length - 1;
              return (
                <span
                  key={i}
                  className={`absolute text-[10px] font-mono whitespace-nowrap ${
                    isEdge
                      ? reached ? "text-white font-bold" : "text-zinc-400 font-bold"
                      : reached ? "text-blue-400" : "text-zinc-600"
                  }`}
                  style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                >
                  {code}
                </span>
              );
            })}
          </div>
        </div>

        {/* 레그 진행 상태 */}
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{completedLegs}/{todayLegs.length} legs</span>
          {trip.total_block && <span>Block: {trip.total_block}</span>}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Countdown Display ─────────── */

function CountdownDisplay({ target, now }: { target: Date; now: Date }) {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return <span className="text-xs text-emerald-400 font-bold">NOW</span>;

  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;

  let display = "";
  if (days > 0) display = `${days}d ${hours}h`;
  else if (hours > 0) display = `${hours}h ${mins}m`;
  else display = `${mins}m`;

  return (
    <span className={`text-sm font-mono font-bold ${totalMin < 120 ? "text-amber-400" : "text-blue-400"}`}>
      in {display}
    </span>
  );
}

/* ─────────── Helpers ─────────── */

function _parseTime(str: string): number {
  const parts = str.split(":");
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return 0;
}

function _formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
