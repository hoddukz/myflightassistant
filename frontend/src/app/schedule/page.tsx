// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/schedule/page.tsx

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useScheduleStore } from "@/stores/scheduleStore";
import { getEventTypeLabel, getEventTypeColor, utcHHMM } from "@/lib/utils";
import type { Pairing } from "@/types";

// 캘린더 테마 변수 — 향후 테마 변경 시 여기만 수정
const calendarTheme = {
  container: "bg-zinc-900 rounded-xl border border-zinc-800 p-3",
  weekdayHeader: "text-zinc-500",
  weekdaySun: "text-red-400",
  weekdaySat: "text-blue-400",
  today: "bg-blue-600 text-white font-bold",
  pastDay: "text-zinc-600",
  day: "text-zinc-300",
  daySun: "text-red-400",
  daySat: "text-blue-400",
  pastDaySun: "text-red-800",
  pastDaySat: "text-blue-800",
  cellHover: "hover:bg-zinc-800",
  dotTrip: "bg-blue-500",
  dotOff: "bg-emerald-500",
  focusRing: "ring-1 ring-blue-500 rounded-lg p-2 -mx-2 transition-all",
};

export default function SchedulePage() {
  const { pairings, fetchSchedule } = useScheduleStore();
  const [expandedPairing, setExpandedPairing] = useState<string | null>(null);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);

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

  // 날짜별 이벤트 매핑
  const eventsByDate = useMemo(() => {
    const map: Record<string, Pairing[]> = {};
    for (const p of pairings) {
      const cur = new Date(p.start_utc.slice(0, 10) + "T00:00:00Z");
      const end = new Date(p.end_utc.slice(0, 10) + "T00:00:00Z");
      while (cur <= end) {
        const ds = cur.toISOString().slice(0, 10);
        if (!map[ds]) map[ds] = [];
        map[ds].push(p);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
    return map;
  }, [pairings]);

  // 캘린더 날짜 클릭 → PairingCard 확장 + 스크롤
  const onDateClick = useCallback((dateStr: string) => {
    const events = eventsByDate[dateStr];
    if (!events || events.length === 0) return;
    const target = events[0];
    const key = target.pairing_id + target.start_utc;
    setExpandedPairing(key);
    setFocusedDate(dateStr);
    setTimeout(() => {
      const el = document.getElementById(`day-${dateStr}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
    setTimeout(() => setFocusedDate(null), 3000);
  }, [eventsByDate]);

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

      {/* Calendar Grid */}
      {pairings.length > 0 && (
        <CalendarGrid
          selectedMonth={selectedMonth}
          eventsByDate={eventsByDate}
          onDateClick={onDateClick}
        />
      )}

      {/* Timeline */}
      {pairings.length > 0 && (
        <div>
          {filteredPairings.length === 0 ? (
            <p className="text-center text-zinc-600 text-sm py-8">
              No events in {monthLabel}
            </p>
          ) : (
            <div className="relative pl-6">
              {/* Timeline vertical line */}
              <div className="absolute left-[7px] top-4 bottom-4 w-px bg-zinc-800" />
              {filteredPairings.map((p, idx) => {
                const key = p.pairing_id + p.start_utc;
                const isPassed = new Date(p.end_utc) < now;
                return (
                  <div key={key} className={`relative ${idx > 0 ? "mt-3" : ""}`}>
                    {/* Timeline node */}
                    <div className={`absolute -left-6 top-5 w-[15px] h-[15px] rounded-full border-2 ${
                      isPassed
                        ? "bg-zinc-800 border-zinc-700"
                        : "bg-blue-400 border-blue-400/50"
                    }`} />
                    <PairingCard
                      pairing={p}
                      passed={isPassed}
                      expanded={expandedPairing === key}
                      onToggle={() =>
                        setExpandedPairing(expandedPairing === key ? null : key)
                      }
                      focusedDate={focusedDate}
                    />
                  </div>
                );
              })}
            </div>
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
  focusedDate,
}: {
  pairing: Pairing;
  passed: boolean;
  expanded: boolean;
  onToggle: () => void;
  focusedDate: string | null;
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
      {/* Header — Trip card with bg pattern */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex flex-col gap-2 text-left bg-zinc-800/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
            <span className="bg-blue-400/20 text-blue-400 text-xs font-bold px-2 py-1 rounded">
              {pairing.pairing_id}
            </span>
          </div>
          <span className="text-xs text-zinc-500 font-medium">{startDate} - {endDate}</span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{pairing.summary}</p>
          <div className="flex items-center gap-2">
            {pairing.total_block && (
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <span className="material-icons text-sm">schedule</span>
                {pairing.total_block}
              </div>
            )}
            <span className="material-icons text-zinc-500 text-sm">{expanded ? "expand_less" : "expand_more"}</span>
          </div>
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && pairing.days.length > 0 && (
        <div className="border-t border-zinc-800 px-4 pb-4">
          {reorderedDays.map((day, di) => {
            const dayPassed = day.flight_date < new Date().toISOString().slice(0, 10);
            return (
            <div
              key={di}
              id={`day-${day.flight_date}`}
              className={`mt-3 ${di > 0 ? "pt-4 border-t border-zinc-800" : ""} ${dayPassed ? "opacity-40" : ""} ${
                focusedDate === day.flight_date
                  ? calendarTheme.focusRing
                  : ""
              }`}
            >
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

              {/* Flight Legs — Flight Card style */}
              {day.legs.map((leg, li) => (
                <div
                  key={li}
                  className={`bg-zinc-800/50 rounded-lg p-3 border-l-4 ${
                    leg.is_deadhead ? "border-zinc-700" : "border-blue-400"
                  } mt-2`}
                >
                  {/* Top Row: Flight No & Aircraft */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-icons text-blue-400 text-sm">flight_takeoff</span>
                      <span className="text-base font-bold">
                        {leg.flight_number}
                      </span>
                      {leg.ac_type && (
                        <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
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
                        className="text-xs font-mono font-medium text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-900/30"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {leg.tail_number} {"\u2197"}
                      </a>
                    )}
                  </div>
                  {/* Route & Times — horizontal layout */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-left">
                      <div className="text-xl font-bold">{leg.origin}</div>
                      <div className="text-sm font-mono text-blue-400">{leg.depart_local}</div>
                      {leg.depart_utc && (
                        <div className="text-[10px] text-zinc-500">{utcHHMM(leg.depart_utc)}Z</div>
                      )}
                    </div>
                    <div className="flex-1 px-3 flex flex-col items-center">
                      {leg.block_time && (
                        <span className="text-xs text-zinc-500 mb-1">{leg.block_time}</span>
                      )}
                      <div className="w-full h-px bg-zinc-700 relative flex items-center">
                        <span className="material-icons text-zinc-500 text-xs rotate-90 absolute left-1/2 -translate-x-1/2 bg-zinc-800 px-1">flight</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">{leg.destination}</div>
                      <div className="text-sm font-mono text-blue-400">{leg.arrive_local}</div>
                      {leg.arrive_utc && (
                        <div className="text-[10px] text-zinc-500">{utcHHMM(leg.arrive_utc)}Z</div>
                      )}
                    </div>
                  </div>
                  {/* Crew pills */}
                  {leg.crew.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-700/50">
                      {leg.crew.map((c, ci) => (
                        <div
                          key={ci}
                          className="flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded-full border border-zinc-700"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            c.position === "CA" ? "bg-emerald-500" : "bg-blue-400"
                          }`}></span>
                          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">{c.position}</span>
                          <span className="text-xs text-zinc-200">{c.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Layover */}
              {day.layover?.hotel_name && (
                <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-700/50 mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-icons text-zinc-400 text-sm">hotel</span>
                    <span className="text-sm font-semibold">Layover</span>
                    {day.layover.layover_duration && (
                      <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-1.5 rounded">{day.layover.layover_duration}</span>
                    )}
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.layover.hotel_name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-zinc-200 hover:text-blue-400 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {day.layover.hotel_name}
                  </a>
                  {day.layover.hotel_phone && (
                    <div className="mt-1">
                      <a
                        href={`tel:${day.layover.hotel_phone.replace(/[^\d]/g, "")}`}
                        className="text-xs text-blue-400 flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="material-icons text-xs">phone</span>
                        {day.layover.hotel_phone}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Day Summary — grid */}
              {day.duty_time && (
                <div className="grid grid-cols-3 gap-2 mt-3 text-center divide-x divide-zinc-700/50">
                  {day.day_block && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Block</div>
                      <div className="text-sm font-bold">{day.day_block}</div>
                    </div>
                  )}
                  {day.day_credit && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Credit</div>
                      <div className="text-sm font-bold">{day.day_credit}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Duty</div>
                    <div className="text-sm font-bold">{day.duty_time}</div>
                  </div>
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

function CalendarGrid({
  selectedMonth,
  eventsByDate,
  onDateClick,
}: {
  selectedMonth: { year: number; month: number };
  eventsByDate: Record<string, Pairing[]>;
  onDateClick: (dateStr: string) => void;
}) {
  const daysInMonth = new Date(selectedMonth.year, selectedMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(selectedMonth.year, selectedMonth.month, 1).getDay();
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const cells = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const events = eventsByDate[dateStr] || [];
    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;
    const dow = (firstDayOfWeek + d - 1) % 7; // 0=Sun, 6=Sat
    const hasTrip = events.some((e) =>
      ["pairing", "mov", "training"].includes(e.event_type)
    );
    const hasOff = events.some((e) =>
      ["njm", "vac", "other"].includes(e.event_type)
    );

    const dayColor = isToday
      ? calendarTheme.today
      : isPast
      ? dow === 0 ? calendarTheme.pastDaySun : dow === 6 ? calendarTheme.pastDaySat : calendarTheme.pastDay
      : dow === 0 ? calendarTheme.daySun : dow === 6 ? calendarTheme.daySat : calendarTheme.day;

    cells.push(
      <button
        key={d}
        onClick={() => events.length > 0 && onDateClick(dateStr)}
        className={`flex flex-col items-center py-1 rounded-lg transition-colors ${
          events.length > 0 ? `cursor-pointer ${calendarTheme.cellHover}` : "cursor-default"
        }`}
      >
        <span
          className={`text-xs w-7 h-7 flex items-center justify-center rounded-full ${dayColor}`}
        >
          {d}
        </span>
        {(hasTrip || hasOff) && (
          <div className="flex gap-0.5 mt-0.5">
            {hasTrip && <span className={`w-1.5 h-1.5 rounded-full ${calendarTheme.dotTrip}`} />}
            {hasOff && <span className={`w-1.5 h-1.5 rounded-full ${calendarTheme.dotOff}`} />}
          </div>
        )}
      </button>
    );
  }

  return (
    <div className={calendarTheme.container}>
      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((day, i) => (
          <div
            key={day}
            className={`text-center text-xs pb-1 ${
              i === 0 ? calendarTheme.weekdaySun : i === 6 ? calendarTheme.weekdaySat : calendarTheme.weekdayHeader
            }`}
          >
            {day}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}
