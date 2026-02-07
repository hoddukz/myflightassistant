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

  // 이번 달 통계
  const monthlyStats = useMemo(() => {
    const monthStr = todayStr.slice(0, 7); // "2026-02"
    let blockMinutes = 0;
    let creditMinutes = 0;
    let flightCount = 0;

    for (const p of pairings) {
      if (p.event_type !== "pairing") continue;
      for (const d of p.days) {
        if (!d.flight_date.startsWith(monthStr)) continue;
        if (d.day_block) blockMinutes += _parseTime(d.day_block);
        if (d.day_credit) creditMinutes += _parseTime(d.day_credit);
        flightCount += d.legs.filter((l) => !l.is_deadhead).length;
      }
    }
    return {
      blockHours: _formatMinutes(blockMinutes),
      creditHours: _formatMinutes(creditMinutes),
      flightCount,
    };
  }, [pairings, todayStr]);

  return (
    <div className="space-y-5">
      <div className="pt-2">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">My Flight Assistant</p>
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
              const monthOff = pairings.filter(
                (p) => p.event_type === "njm" && p.start_utc.slice(0, 7) <= monthStr && p.end_utc.slice(0, 7) >= monthStr
              );
              const doneOff = monthOff.filter((p) => new Date(p.end_utc) < now).length;
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
                      <span className="text-blue-400">{doneOff}</span>
                      <span className="text-zinc-600">/</span>
                      {monthOff.length}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>

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

          {/* Today's Flights */}
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

          {/* Current Trip 타임라인 */}
          {currentTrip && <TripTimeline trip={currentTrip} todayStr={todayStr} />}

          {/* 이번 달 통계 */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-400">
              {now.toLocaleDateString("en-US", { month: "long" }).toUpperCase()} STATS
            </h2>
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Block Hours</span>
                <span className="text-sm font-mono font-bold">{monthlyStats.blockHours}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Credit Hours</span>
                <span className="text-sm font-mono font-bold">{monthlyStats.creditHours}</span>
              </div>
            </div>
          </div>

          {/* 오늘의 레이오버 */}
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
        </>
      )}
    </div>
  );
}

/* ─────────── Trip Timeline (비디오 플레이어 스타일) ─────────── */

function TripTimeline({ trip, todayStr }: { trip: Pairing; todayStr: string }) {
  const days = trip.days.filter((d) => d.legs.length > 0);
  if (days.length === 0) return null;

  const todayIdx = days.findIndex((d) => d.flight_date === todayStr);
  const totalDays = days.length;

  // 전체 레그 수 & 완료 레그 수
  const allLegs = days.flatMap((d) => d.legs);
  const completedLegs = (() => {
    let count = 0;
    for (const d of days) {
      if (d.flight_date < todayStr) {
        count += d.legs.length;
      } else if (d.flight_date === todayStr) {
        // 오늘: arrive_utc 기준으로 완료 여부
        const nowUtc = new Date().getTime();
        for (const leg of d.legs) {
          if (leg.arrive_utc) {
            let arrUtc = new Date(`${leg.flight_date}T${leg.arrive_utc}:00Z`);
            if (leg.depart_utc) {
              const depUtc = new Date(`${leg.flight_date}T${leg.depart_utc}:00Z`);
              if (arrUtc < depUtc) arrUtc = new Date(arrUtc.getTime() + 86400000);
            }
            if (nowUtc > arrUtc.getTime()) count++;
          }
        }
      }
    }
    return count;
  })();

  const progress = allLegs.length > 0 ? (completedLegs / allLegs.length) * 100 : 0;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-400">CURRENT TRIP</h2>
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
        {/* 트립 정보 */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-blue-400">{trip.summary}</span>
          <span className="text-xs text-zinc-500">
            {todayIdx >= 0 ? `Day ${todayIdx + 1}/${totalDays}` : `${totalDays} days`}
          </span>
        </div>

        {/* 타임라인 바 (비디오 플레이어 스타일) */}
        <div className="relative">
          {/* 배경 트랙 */}
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            {/* 진행 바 */}
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          {/* Day 마커들 */}
          <div className="flex justify-between mt-1">
            {days.map((d, i) => {
              const isToday = d.flight_date === todayStr;
              const isPast = d.flight_date < todayStr;
              return (
                <div key={i} className="flex flex-col items-center" style={{ width: `${100 / totalDays}%` }}>
                  <div
                    className={`w-2.5 h-2.5 rounded-full border-2 -mt-[13px] relative z-10 ${
                      isToday
                        ? "bg-blue-500 border-blue-400 ring-2 ring-blue-400/30"
                        : isPast
                        ? "bg-blue-600 border-blue-700"
                        : "bg-zinc-700 border-zinc-600"
                    }`}
                  />
                  <span
                    className={`text-xs mt-1 font-mono ${
                      isToday ? "text-blue-400 font-bold" : "text-zinc-600"
                    }`}
                  >
                    {i + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 레그 진행 상태 */}
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{completedLegs}/{allLegs.length} legs completed</span>
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
