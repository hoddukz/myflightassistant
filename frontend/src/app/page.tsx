// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/page.tsx

"use client";

import { useScheduleStore } from "@/stores/scheduleStore";
import { getEventTypeLabel, getEventTypeColor } from "@/lib/utils";
import Link from "next/link";

export default function Dashboard() {
  const { pairings, totalFlights } = useScheduleStore();

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const upcomingPairings = pairings
    .filter((p) => p.event_type !== "njm" && new Date(p.end_utc) >= now && new Date(p.start_utc).toISOString().slice(0, 10) !== todayStr)
    .slice(0, 3);

  const todayLegsRaw = pairings
    .filter((p) => p.event_type === "pairing")
    .flatMap((p) => p.days)
    .filter((d) => d.flight_date === todayStr)
    .flatMap((d) => d.legs);

  // 도착 UTC 기준 순환: 끝난 레그 하단, 다음 레그 상단
  const nowUtc = now.getTime();
  const todayLegs = (() => {
    const mapped = todayLegsRaw.map((leg) => {
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
  })();

  return (
    <div className="space-y-6">
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
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <p className="text-zinc-500 text-xs">Trips</p>
              <p className="text-xl font-bold">
                {pairings.filter((p) => p.event_type === "pairing").length}
              </p>
            </div>
            <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <p className="text-zinc-500 text-xs">Flights</p>
              <p className="text-xl font-bold">{totalFlights}</p>
            </div>
            <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <p className="text-zinc-500 text-xs">Off Days</p>
              <p className="text-xl font-bold">
                {pairings.filter((p) => p.event_type === "njm").length}
              </p>
            </div>
          </div>

          {todayLegs.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-400">
                TODAY&apos;S FLIGHTS
              </h2>
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
                      <span className="text-zinc-500 text-xs">
                        {leg.ac_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-center">
                      <p className="text-xl font-bold">{leg.origin}</p>
                      <p className="text-sm text-zinc-500">
                        {leg.depart_local}
                      </p>
                    </div>
                    <div className="flex-1 mx-4 border-t border-dashed border-zinc-700" />
                    <div className="text-center">
                      <p className="text-xl font-bold">{leg.destination}</p>
                      <p className="text-sm text-zinc-500">
                        {leg.arrive_local}
                      </p>
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

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-400">UPCOMING</h2>
            {upcomingPairings.map((p, i) => (
              <Link
                key={i}
                href="/schedule"
                className="block bg-zinc-900 rounded-xl p-4 border border-zinc-800 active:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${getEventTypeColor(
                        p.event_type
                      )} text-white`}
                    >
                      {getEventTypeLabel(p.event_type)}
                    </span>
                    <span className="text-sm font-medium">{p.summary}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                  <span>
                    {new Date(p.start_utc).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {" - "}
                    {new Date(p.end_utc).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {p.total_block && <span>Block: {p.total_block}</span>}
                  {p.total_credit && <span>Credit: {p.total_credit}</span>}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
