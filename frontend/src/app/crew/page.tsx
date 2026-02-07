// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/crew/page.tsx

"use client";

import { useState, useMemo } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";

interface DayCrewInfo {
  date: string;
  dateFormatted: string;
  pairingSummary: string;
  crew: { position: string; name: string; employee_id: string }[];
  hotel: { name: string; phone: string } | null;
  passed: boolean;
}

const positionOrder: Record<string, number> = { CA: 0, FO: 1, FA: 2, FF: 3 };

export default function CrewPage() {
  const { pairings } = useScheduleStore();
  const [now] = useState(new Date());

  const days: DayCrewInfo[] = useMemo(() => {
    const dayList: DayCrewInfo[] = [];
    for (const p of pairings) {
      if (p.event_type !== "pairing") continue;
      for (const d of p.days) {
        if (d.legs.length === 0) continue;

        const crewMap = new Map<string, { position: string; name: string; employee_id: string }>();
        for (const leg of d.legs) {
          for (const c of leg.crew) {
            crewMap.set(c.employee_id, c);
          }
        }
        const crew = Array.from(crewMap.values()).sort(
          (a, b) => (positionOrder[a.position] ?? 9) - (positionOrder[b.position] ?? 9)
        );

        let hotel: { name: string; phone: string } | null = null;
        if (d.layover?.hotel_name) {
          hotel = {
            name: d.layover.hotel_name,
            phone: d.layover.hotel_phone || "",
          };
        }

        const dateObj = new Date(d.flight_date + "T23:59:59Z");
        const passed = dateObj < now;

        dayList.push({
          date: d.flight_date,
          dateFormatted: new Date(d.flight_date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          pairingSummary: p.summary,
          crew,
          hotel,
          passed,
        });
      }
    }

    // 순환식: 지나간 날은 뒤로
    const firstUpcoming = dayList.findIndex((d) => !d.passed);
    if (firstUpcoming > 0) {
      return [...dayList.slice(firstUpcoming), ...dayList.slice(0, firstUpcoming)];
    }
    return dayList;
  }, [pairings, now]);

  return (
    <div className="space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-bold">Crew & Hotel</h1>
        <p className="text-zinc-500 text-sm mt-1">Flight crew & layover info</p>
      </div>

      {days.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-3xl mb-3">👥</p>
          <p>Upload schedule to see crew info</p>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day, i) => (
            <div
              key={day.date + i}
              className={`bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3 ${
                day.passed ? "opacity-40" : ""
              }`}
            >
              {/* Day 헤더 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-300">
                  {day.pairingSummary}
                </span>
                <div className="flex items-center gap-2">
                  {day.passed && (
                    <span className="text-xs bg-zinc-700 text-zinc-500 px-1.5 py-0.5 rounded">
                      DONE
                    </span>
                  )}
                  <span className="text-xs text-zinc-500">{day.dateFormatted}</span>
                </div>
              </div>

              {/* Crew */}
              {day.crew.length > 0 && (
                <div className="space-y-1.5">
                  {day.crew.map((c, ci) => (
                    <div
                      key={ci}
                      className="bg-zinc-800/50 rounded-lg px-3 py-2.5 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        <p className="text-xs text-zinc-500">#{c.employee_id}</p>
                      </div>
                      <span className="text-xs font-bold bg-zinc-700 px-2.5 py-1 rounded text-zinc-300">
                        {c.position}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Hotel */}
              {day.hotel && (
                <div className="border-t border-zinc-800 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-purple-400">🏨</span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.hotel.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-zinc-300 hover:text-purple-300 underline underline-offset-2 decoration-zinc-600"
                    >
                      {day.hotel.name}
                    </a>
                  </div>
                  {day.hotel.phone && (
                    <a
                      href={`tel:${day.hotel.phone.replace(/[^\d]/g, "")}`}
                      className="text-xs text-blue-400 hover:text-blue-300 mt-1 block ml-6"
                    >
                      {day.hotel.phone}
                    </a>
                  )}
                </div>
              )}

              {/* 크루도 호텔도 없는 경우 */}
              {day.crew.length === 0 && !day.hotel && (
                <p className="text-center text-zinc-600 text-sm py-2">
                  No crew or hotel info
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
