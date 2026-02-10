// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/schedule/page.tsx

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useScheduleStore } from "@/stores/scheduleStore";
import { getEventTypeLabel, getEventTypeColor, utcHHMM } from "@/lib/utils";
import type { Pairing } from "@/types";

export default function SchedulePage() {
  const { pairings, fetchSchedule } = useScheduleStore();
  const [expandedPairing, setExpandedPairing] = useState<string | null>(null);

  // 페이지 마운트 시 DB에서 스케줄 로드
  useEffect(() => {
    fetchSchedule();
  }, []);

  // 월 네비게이터 상태
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const prevMonth = () =>
    setSelectedMonth((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 }
    );

  const nextMonth = () =>
    setSelectedMonth((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 }
    );

  const monthLabel = new Date(
    selectedMonth.year,
    selectedMonth.month
  ).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  const now = useMemo(() => new Date(), []);

  // 선택된 월에 해당하는 이벤트 필터 + 순환식 (지나간 이벤트 하단으로)
  const filteredPairings = useMemo(() => {
    const monthStart = new Date(selectedMonth.year, selectedMonth.month, 1);
    const monthEnd = new Date(selectedMonth.year, selectedMonth.month + 1, 0, 23, 59, 59);
    const filtered = pairings.filter((p) => {
      const start = new Date(p.start_utc);
      const end = new Date(p.end_utc);
      return start <= monthEnd && end >= monthStart;
    });

    // 순환식: 지나간 이벤트는 뒤로
    const firstUpcoming = filtered.findIndex((p) => new Date(p.end_utc) >= now);
    if (firstUpcoming > 0) {
      return [...filtered.slice(firstUpcoming), ...filtered.slice(0, firstUpcoming)];
    }
    return filtered;
  }, [pairings, selectedMonth, now]);

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h1 className="text-xl font-bold">Schedule</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {pairings.length > 0
            ? `${pairings.length} events loaded`
            : "No schedule loaded"}
        </p>
      </div>

      {/* Empty State: Settings 안내 */}
      {pairings.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <div className="text-4xl">{"\u{1F4C5}"}</div>
          <p className="text-zinc-400 text-sm">
            No schedule loaded.
          </p>
          <Link
            href="/settings"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Go to Settings → Schedule
          </Link>
        </div>
      )}

      {/* Month Navigator */}
      {pairings.length > 0 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prevMonth}
            className="w-9 h-9 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 flex items-center justify-center transition-colors"
          >
            &lt;
          </button>
          <span className="text-sm font-semibold w-28 text-center">
            {monthLabel}
          </span>
          <button
            onClick={nextMonth}
            className="w-9 h-9 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 flex items-center justify-center transition-colors"
          >
            &gt;
          </button>
        </div>
      )}

      {/* Timeline */}
      {pairings.length > 0 && (
        <div className="space-y-2">
          {filteredPairings.length === 0 ? (
            <p className="text-center text-zinc-600 text-sm py-8">
              No events in {monthLabel}
            </p>
          ) : (
            filteredPairings.map((p) => (
              <PairingCard
                key={p.pairing_id + p.start_utc}
                pairing={p}
                passed={new Date(p.end_utc) < now}
                expanded={expandedPairing === p.pairing_id + p.start_utc}
                onToggle={() =>
                  setExpandedPairing(
                    expandedPairing === p.pairing_id + p.start_utc
                      ? null
                      : p.pairing_id + p.start_utc
                  )
                }
              />
            ))
          )}
        </div>
      )}

    </div>
  );
}

function PairingCard({
  pairing,
  passed,
  expanded,
  onToggle,
}: {
  pairing: Pairing;
  passed: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const startDate = new Date(pairing.start_utc).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endDate = new Date(pairing.end_utc).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  // 순환: 오늘 이후 첫 날부터 표시, 지나간 날은 뒤로
  const reorderedDays = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const firstUpcoming = pairing.days.findIndex((d) => d.flight_date >= todayStr);
    if (firstUpcoming > 0) {
      return [...pairing.days.slice(firstUpcoming), ...pairing.days.slice(0, firstUpcoming)];
    }
    return pairing.days;
  }, [pairing.days]);

  return (
    <div className={`bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden ${passed ? "opacity-40" : ""}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          {passed && (
            <span className="text-xs bg-zinc-700 text-zinc-500 px-1.5 py-0.5 rounded font-bold">
              DONE
            </span>
          )}
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded ${getEventTypeColor(
              pairing.event_type
            )} text-white`}
          >
            {getEventTypeLabel(pairing.event_type)}
          </span>
          <div>
            <p className="text-sm font-medium">{pairing.summary}</p>
            <p className="text-xs text-zinc-500">
              {startDate} - {endDate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pairing.total_block && (
            <span className="text-xs text-zinc-500">
              Blk {pairing.total_block}
            </span>
          )}
          <span className="text-zinc-500 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && pairing.days.length > 0 && (
        <div className="border-t border-zinc-800 px-4 pb-4">
          {reorderedDays.map((day, di) => {
            const dayPassed = day.flight_date < new Date().toISOString().slice(0, 10);
            return (
            <div key={di} className={`mt-3 ${dayPassed ? "opacity-40" : ""}`}>
              {/* Day Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-400">
                  {new Date(day.flight_date + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { weekday: "short", month: "short", day: "numeric" }
                  )}
                </span>
                {day.report_time && (
                  <span className="text-xs text-amber-400">
                    Report: {day.report_time}
                    {day.report_tz && (
                      <span className="text-zinc-500 ml-1">{day.report_tz}</span>
                    )}
                    {day.report_time_utc && (
                      <span className="text-zinc-500 ml-1">({utcHHMM(day.report_time_utc)}Z)</span>
                    )}
                  </span>
                )}
              </div>

              {/* Flight Legs */}
              {day.legs.map((leg, li) => (
                <div
                  key={li}
                  className={`ml-2 pl-3 border-l-2 ${
                    leg.is_deadhead ? "border-zinc-700" : "border-blue-600"
                  } py-3`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-blue-400">
                        {leg.flight_number}
                      </span>
                      {leg.ac_type && (
                        <span className="text-xs text-zinc-500">
                          {leg.ac_type}
                        </span>
                      )}
                      {leg.is_deadhead && (
                        <span className="text-xs bg-zinc-700 text-zinc-400 px-1 py-0.5 rounded">
                          DH
                        </span>
                      )}
                    </div>
                    {leg.tail_number && (
                      <a
                        href={`https://flightaware.com/live/flight/${leg.tail_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-400 hover:text-amber-300 font-mono"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {leg.tail_number} {"\u2197"}
                      </a>
                    )}
                  </div>
                  {/* Line 1: Airport codes + block time */}
                  <div className="flex items-center gap-2 mt-2 text-base">
                    <span className="font-bold">{leg.origin}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="font-bold">{leg.destination}</span>
                    {leg.block_time && (
                      <span className="text-xs text-zinc-600 ml-auto">
                        {leg.block_time}
                      </span>
                    )}
                  </div>
                  {/* Line 2: Times with timezone + UTC */}
                  <div className="flex items-center gap-2 mt-0.5 text-sm text-zinc-500">
                    <span>
                      {leg.depart_local}
                      {leg.depart_tz && (
                        <span className="text-zinc-600 text-xs ml-0.5">{leg.depart_tz}</span>
                      )}
                      {leg.depart_utc && (
                        <span className="text-zinc-600 text-xs ml-0.5">({utcHHMM(leg.depart_utc)}Z)</span>
                      )}
                    </span>
                    <span className="text-zinc-700">→</span>
                    <span>
                      {leg.arrive_local}
                      {leg.arrive_tz && (
                        <span className="text-zinc-600 text-xs ml-0.5">{leg.arrive_tz}</span>
                      )}
                      {leg.arrive_utc && (
                        <span className="text-zinc-600 text-xs ml-0.5">({utcHHMM(leg.arrive_utc)}Z)</span>
                      )}
                    </span>
                  </div>
                  {leg.crew.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {leg.crew.map((c, ci) => (
                        <span
                          key={ci}
                          className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded"
                        >
                          {c.position}: {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Layover */}
              {day.layover?.hotel_name && (
                <div className="ml-2 pl-3 border-l-2 border-purple-600 py-3 mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-purple-400">🏨</span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.layover.hotel_name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-zinc-300 hover:text-purple-300 underline underline-offset-2 decoration-zinc-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {day.layover.hotel_name}
                    </a>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {day.layover.hotel_phone && (
                      <a
                        href={`tel:${day.layover.hotel_phone.replace(/[^\d]/g, "")}`}
                        className="text-xs text-blue-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {day.layover.hotel_phone}
                      </a>
                    )}
                    {day.layover.layover_duration && (
                      <span className="text-xs text-zinc-500">
                        Layover: {day.layover.layover_duration}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Day Summary */}
              {day.duty_time && (
                <div className="ml-2 mt-1 flex gap-3 text-xs text-zinc-600">
                  {day.day_block && <span>Block: {day.day_block}</span>}
                  {day.day_credit && <span>Credit: {day.day_credit}</span>}
                  <span>Duty: {day.duty_time}</span>
                </div>
              )}
            </div>
            );
          })}

          {/* Trip Summary */}
          {pairing.tafb && (
            <div className="mt-3 pt-3 border-t border-zinc-800 flex gap-4 text-xs text-zinc-500">
              <span>TAFB: {pairing.tafb}</span>
              {pairing.total_block && (
                <span>Total Block: {pairing.total_block}</span>
              )}
              {pairing.total_credit && (
                <span>Total Credit: {pairing.total_credit}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
