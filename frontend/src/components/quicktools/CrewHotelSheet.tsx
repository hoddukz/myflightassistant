// Tag: core
// Path: frontend/src/components/quicktools/CrewHotelSheet.tsx

"use client";

import { useMemo } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

const positionOrder: Record<string, number> = { CA: 0, FO: 1, FA: 2, FF: 3 };
const positionColor: Record<string, string> = {
  CA: "bg-blue-900/60 text-blue-400 border border-blue-800/50",
  FO: "bg-emerald-900/60 text-emerald-400 border border-emerald-800/50",
  FA: "bg-zinc-700/60 text-zinc-400 border border-zinc-600/50",
  FF: "bg-zinc-700/60 text-zinc-400 border border-zinc-600/50",
};

export default function CrewHotelSheet({ open, onClose }: Props) {
  const { pairings } = useScheduleStore();
  const now = useMemo(() => new Date(), []);

  const days = useMemo(() => {
    const result: {
      date: string;
      dateFormatted: string;
      dayIndex: number;
      totalDays: number;
      crew: { position: string; name: string; employee_id: string }[];
      hotel: { name: string; phone: string } | null;
    }[] = [];

    // Find current or next trip
    const trip = pairings.find(
      (p) =>
        p.event_type === "pairing" &&
        new Date(p.end_utc) >= now
    );
    if (!trip) return result;

    const pairingDays = trip.days.filter((d) => d.legs.length > 0);
    const totalDays = pairingDays.length;

    for (let idx = 0; idx < pairingDays.length; idx++) {
      const d = pairingDays[idx];
      const crewMap = new Map<
        string,
        { position: string; name: string; employee_id: string }
      >();
      for (const leg of d.legs) {
        for (const c of leg.crew) {
          crewMap.set(c.employee_id, c);
        }
      }
      const crew = Array.from(crewMap.values()).sort(
        (a, b) =>
          (positionOrder[a.position] ?? 9) - (positionOrder[b.position] ?? 9)
      );

      let hotel: { name: string; phone: string } | null = null;
      if (d.layover?.hotel_name) {
        hotel = {
          name: d.layover.hotel_name,
          phone: d.layover.hotel_phone || "",
        };
      }

      result.push({
        date: d.flight_date,
        dateFormatted: new Date(d.flight_date + "T00:00:00").toLocaleDateString(
          "en-US",
          { weekday: "short", month: "short", day: "numeric" }
        ),
        dayIndex: idx + 1,
        totalDays,
        crew,
        hotel,
      });
    }

    return result;
  }, [pairings, now]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[70]"
        style={{ animation: "slideUp 0.3s ease-out forwards" }}
      >
        <div className="max-w-lg mx-auto bg-zinc-900 rounded-t-3xl border-t border-x border-zinc-700 max-h-[85vh] overflow-y-auto">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-zinc-700 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-4">
            <div className="flex items-center gap-2.5">
              <span
                className="material-icons text-blue-400"
                style={{ fontSize: 22 }}
              >
                group
              </span>
              <h2 className="text-lg font-bold">Crew / Hotel</h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors active:bg-zinc-700"
            >
              <span className="material-icons" style={{ fontSize: 20 }}>
                close
              </span>
            </button>
          </div>

          {/* Content */}
          <div className="px-5 pb-10 space-y-5">
            {days.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <span
                  className="material-icons text-3xl mb-2 block"
                >
                  group
                </span>
                <p className="text-sm">No trip data available</p>
              </div>
            ) : (
              days.map((day) => (
                <div key={day.date} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-400 font-bold">
                      Day {day.dayIndex}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {day.dateFormatted}
                    </span>
                  </div>

                  {/* Crew */}
                  {day.crew.map((c, ci) => (
                    <div
                      key={ci}
                      className="flex items-center gap-3 bg-zinc-800/40 rounded-xl p-4 border border-zinc-800"
                    >
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          positionColor[c.position] ||
                          positionColor.FF
                        }`}
                      >
                        {c.position}
                      </span>
                      <span className="text-sm font-medium flex-1">
                        {c.name}
                      </span>
                      <span className="text-xs text-zinc-600 font-mono">
                        {c.employee_id}
                      </span>
                    </div>
                  ))}

                  {/* Hotel */}
                  {day.hotel && (
                    <div className="flex items-start gap-3 bg-zinc-800/40 rounded-xl p-4 border border-zinc-800">
                      <span className="text-lg mt-0.5">{"\uD83C\uDFE8"}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{day.hotel.name}</p>
                        {day.hotel.phone && (
                          <a
                            href={`tel:${day.hotel.phone.replace(
                              /[^\d+]/g,
                              ""
                            )}`}
                            className="text-sm text-blue-400 hover:text-blue-300 font-mono mt-1 inline-block"
                          >
                            {day.hotel.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
