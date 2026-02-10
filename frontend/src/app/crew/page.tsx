// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/crew/page.tsx

"use client";

import { useState, useMemo } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";

interface DayCrewInfo {
  date: string;
  dateFormatted: string;
  dayIndex: number;
  totalDays: number;
  crew: { position: string; name: string; employee_id: string }[];
  hotel: { name: string; phone: string } | null;
  passed: boolean;
}

interface TripCrewGroup {
  pairingId: string;
  summary: string;
  allPassed: boolean;
  days: DayCrewInfo[];
}

const positionOrder: Record<string, number> = { CA: 0, FO: 1, FA: 2, FF: 3 };

export default function CrewPage() {
  const { pairings } = useScheduleStore();
  const [now] = useState(new Date());
  const todayStr = now.toISOString().slice(0, 10);

  const trips: TripCrewGroup[] = useMemo(() => {
    const tripList: TripCrewGroup[] = [];

    for (const p of pairings) {
      if (p.event_type !== "pairing") continue;
      const pairingDays = p.days.filter((d) => d.legs.length > 0);
      if (pairingDays.length === 0) continue;
      const totalDays = pairingDays.length;

      const dayList: DayCrewInfo[] = pairingDays.map((d, idx) => {
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

        return {
          date: d.flight_date,
          dateFormatted: new Date(d.flight_date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          dayIndex: idx + 1,
          totalDays,
          crew,
          hotel,
          passed,
        };
      });

      // 트립 내 순환: 지나간 날은 트립 하단으로
      const firstUpcoming = dayList.findIndex((d) => !d.passed);
      const sortedDays = firstUpcoming > 0
        ? [...dayList.slice(firstUpcoming), ...dayList.slice(0, firstUpcoming)]
        : dayList;

      const allPassed = sortedDays.every((d) => d.passed);

      tripList.push({
        pairingId: p.pairing_id,
        summary: p.summary,
        allPassed,
        days: sortedDays,
      });
    }

    // 트립 순환: 완전히 지나간 트립은 하단으로
    const firstActive = tripList.findIndex((t) => !t.allPassed);
    if (firstActive > 0) {
      return [...tripList.slice(firstActive), ...tripList.slice(0, firstActive)];
    }
    return tripList;
  }, [pairings, now]);

  // 오늘만 기본 펼침
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set([todayStr]));

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const hasDays = trips.some((t) => t.days.length > 0);

  return (
    <div className="space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-bold">Crew & Hotel</h1>
        <p className="text-zinc-500 text-sm mt-1">Flight crew & layover info</p>
      </div>

      {!hasDays ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-3xl mb-3">{"\uD83D\uDC65"}</p>
          <p>Upload schedule to see crew info</p>
        </div>
      ) : (
        <div className="space-y-6">
          {trips.map((trip) => (
            <div key={trip.pairingId} className={trip.allPassed ? "opacity-40" : ""}>
              {/* 트립 헤더 */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="text-xs font-bold text-blue-400 shrink-0">
                  {trip.summary}
                </span>
                {trip.allPassed && (
                  <span className="text-xs bg-zinc-700 text-zinc-500 px-1.5 py-0.5 rounded font-bold shrink-0">
                    DONE
                  </span>
                )}
                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              {/* 트립 내 Day 카드들 */}
              <div className="space-y-2">
                {trip.days.map((day, i) => {
                  const isExpanded = expandedDays.has(day.date);
                  return (
                    <div
                      key={day.date + i}
                      className={`bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden ${
                        day.passed && !trip.allPassed ? "opacity-40" : ""
                      }`}
                    >
                      {/* Day 헤더 (클릭으로 토글) */}
                      <button
                        onClick={() => toggleDay(day.date)}
                        className="w-full p-4 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-2">
                          {day.passed && (
                            <span className="text-xs bg-zinc-700 text-zinc-500 px-1.5 py-0.5 rounded font-bold">
                              DONE
                            </span>
                          )}
                          <span className="text-xs text-zinc-500">
                            {day.dateFormatted}
                          </span>
                          <span className="text-xs text-blue-400 font-bold">
                            Day {day.dayIndex}/{day.totalDays}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isExpanded && day.crew.length > 0 && (
                            <span className="text-xs text-zinc-600">
                              {day.crew.length} crew
                            </span>
                          )}
                          <span className="text-zinc-500 text-sm">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                        </div>
                      </button>

                      {/* 펼침 내용 */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3">
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
                                <span className="text-sm text-purple-400">{"\uD83C\uDFE8"}</span>
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
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
