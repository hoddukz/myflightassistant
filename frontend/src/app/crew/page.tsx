// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/crew/page.tsx

"use client";

import { useScheduleStore } from "@/stores/scheduleStore";

export default function CrewPage() {
  const { pairings } = useScheduleStore();

  const now = new Date();
  const activePairings = pairings.filter(
    (p) => p.event_type === "pairing" && new Date(p.end_utc) >= now
  );

  const crewMap = new Map<string, { position: string; name: string; employee_id: string }>();
  const hotels: { name: string; phone: string; date: string }[] = [];

  for (const p of activePairings) {
    for (const d of p.days) {
      for (const leg of d.legs) {
        for (const c of leg.crew) {
          crewMap.set(c.employee_id, c);
        }
      }
      if (d.layover?.hotel_name) {
        hotels.push({
          name: d.layover.hotel_name,
          phone: d.layover.hotel_phone || "",
          date: d.flight_date,
        });
      }
    }
  }

  const crewMembers = Array.from(crewMap.values());
  const positionOrder = { CA: 0, FO: 1, FA: 2, FF: 3 };
  crewMembers.sort(
    (a, b) =>
      (positionOrder[a.position as keyof typeof positionOrder] ?? 9) -
      (positionOrder[b.position as keyof typeof positionOrder] ?? 9)
  );

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h1 className="text-xl font-bold">Crew & Hotel</h1>
        <p className="text-zinc-500 text-sm mt-1">Flight crew & layover info</p>
      </div>

      {crewMembers.length === 0 && hotels.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-3xl mb-3">👥</p>
          <p>Upload schedule to see crew info</p>
        </div>
      ) : (
        <>
          {crewMembers.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-400">CREW</h2>
              {crewMembers.map((c, i) => (
                <div
                  key={i}
                  className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-base">{c.name}</p>
                    <p className="text-sm text-zinc-500">#{c.employee_id}</p>
                  </div>
                  <span className="text-sm font-bold bg-zinc-800 px-3 py-1.5 rounded text-zinc-300">
                    {c.position}
                  </span>
                </div>
              ))}
            </div>
          )}

          {hotels.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-400">HOTELS</h2>
              {hotels.map((h, i) => (
                <div
                  key={i}
                  className="bg-zinc-900 rounded-xl p-4 border border-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-base">{h.name}</p>
                    <span className="text-sm text-zinc-500">{h.date}</span>
                  </div>
                  {h.phone && (
                    <a
                      href={`tel:${h.phone.replace(/[^\d]/g, "")}`}
                      className="text-sm text-blue-400 hover:text-blue-300 mt-1 inline-block"
                    >
                      {h.phone}
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
