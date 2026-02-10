// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/components/layout/DualTimeBar.tsx

"use client";

import { useEffect, useState, useMemo } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";
import { toUtcDate } from "@/lib/utils";

export default function DualTimeBar() {
  const [now, setNow] = useState(new Date());
  const { pairings } = useScheduleStore();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const utc = now.toISOString().slice(11, 19);
  const utcDate = now.toISOString().slice(0, 10);

  // 다음 리포트 시간 찾기 (UTC 기준)
  const nextReport = useMemo(() => {
    const nowUtc = now.getTime();
    for (const p of pairings) {
      if (p.event_type !== "pairing") continue;
      if (new Date(p.end_utc).getTime() < nowUtc) continue;
      for (const d of p.days) {
        // report_time_utc 우선, 없으면 report_time을 UTC로 해석
        const rtUtc = d.report_time_utc || d.report_time;
        if (!rtUtc) continue;
        const reportDateTime = toUtcDate(rtUtc, d.flight_date);
        if (reportDateTime.getTime() > nowUtc) {
          return reportDateTime;
        }
      }
    }
    return null;
  }, [pairings, now]);

  // 카운트다운 계산
  const countdown = useMemo(() => {
    if (!nextReport) return null;
    const diffMs = nextReport.getTime() - now.getTime();
    if (diffMs <= 0) return null;
    const totalMin = Math.floor(diffMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }, [nextReport, now]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 text-xs font-mono">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">UTC</span>
        <span className="text-emerald-400 font-bold text-sm">{utc}</span>
        <span className="text-zinc-600">{utcDate}</span>
      </div>
      <div className="flex items-center gap-2">
        {countdown ? (
          <>
            <span className="text-zinc-500">Report in</span>
            <span className="text-amber-400 font-bold text-sm">
              {countdown}
            </span>
          </>
        ) : (
          <>
            <span className="text-zinc-500">LCL</span>
            <span className="text-amber-400 font-bold text-sm">
              {now.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
