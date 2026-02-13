// Tag: core
// Path: frontend/src/components/far117/FdpCalculatorModal.tsx

"use client";

import { useState, useMemo } from "react";

// FAR 117.11 Table B — FDP 상한 (시간)
// (start_hour, end_hour): [1-2legs, 3legs, 4legs, 5legs, 6legs, 7+legs]
const FDP_TABLE: [number, number, number[]][] = [
  [0, 3, [9, 9, 9, 9, 9, 9]],
  [4, 4, [10, 10, 10, 9, 9, 9]],
  [5, 5, [12, 12, 11, 11, 10, 9]],
  [6, 6, [13, 13, 12, 12, 11, 10]],
  [7, 12, [14, 14, 13, 13, 12, 11]],
  [13, 16, [13, 13, 12, 12, 11, 10]],
  [17, 21, [12, 12, 11, 11, 10, 9]],
  [22, 23, [11, 11, 10, 10, 9, 9]],
];

function getFdpLimit(reportHour: number, numLegs: number): number {
  let col: number;
  if (numLegs <= 2) col = 0;
  else if (numLegs >= 7) col = 5;
  else col = numLegs - 2;

  for (const [start, end, limits] of FDP_TABLE) {
    if (reportHour >= start && reportHour <= end) return limits[col];
  }
  return 9;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const LEG_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const DELAY_PRESETS = [30, 60, 120, 180];

export default function FdpCalculatorModal({ open, onClose }: Props) {
  const [reportHour, setReportHour] = useState(7);
  const [reportMinute, setReportMinute] = useState(0);
  const [numLegs, setNumLegs] = useState(3);

  const fdpLimit = useMemo(
    () => getFdpLimit(reportHour, numLegs),
    [reportHour, numLegs]
  );

  const releaseTime = useMemo(() => {
    const totalMin = reportHour * 60 + reportMinute + fdpLimit * 60;
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }, [reportHour, reportMinute, fdpLimit]);

  const delayImpacts = useMemo(() => {
    return DELAY_PRESETS.map((mins) => {
      const newFdp = fdpLimit + mins / 60;
      const hardLimit = fdpLimit + 2;
      let status: "ok" | "warn" | "danger";
      let label: string;

      if (newFdp <= fdpLimit) {
        status = "ok";
        label = "OK";
      } else if (newFdp <= hardLimit) {
        status = "warn";
        label = "Extension Req.";
      } else {
        status = "danger";
        label = "Exceeds Limit";
      }

      return { mins, newFdp: newFdp.toFixed(1), status, label };
    });
  }, [fdpLimit]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      {/* modal */}
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl p-5 space-y-5 max-h-[85vh] overflow-y-auto">
        {/* header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">FDP Calculator</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <span className="material-icons text-sm">close</span>
          </button>
        </div>

        {/* Report Time */}
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Report Time (local)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={23}
              value={reportHour}
              onChange={(e) =>
                setReportHour(
                  Math.max(0, Math.min(23, parseInt(e.target.value) || 0))
                )
              }
              className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-center font-mono text-lg focus:outline-none focus:border-blue-500"
            />
            <span className="text-zinc-500 text-xl font-bold">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={reportMinute}
              onChange={(e) =>
                setReportMinute(
                  Math.max(0, Math.min(59, parseInt(e.target.value) || 0))
                )
              }
              className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-center font-mono text-lg focus:outline-none focus:border-blue-500"
            />
            <span className="text-zinc-500 text-sm ml-1">L</span>
          </div>
        </div>

        {/* Number of Legs */}
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Number of Legs</label>
          <div className="flex gap-1.5">
            {LEG_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setNumLegs(n)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                  numLegs === n
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {n}{n === 7 ? "+" : ""}
              </button>
            ))}
          </div>
        </div>

        {/* 결과 */}
        <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-zinc-400">Max FDP</span>
            <span className="text-2xl font-bold font-mono text-blue-400">
              {fdpLimit}h
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-zinc-400">Latest Release</span>
            <span className="text-lg font-mono">
              {releaseTime} <span className="text-zinc-500 text-sm">local</span>
            </span>
          </div>
        </div>

        {/* Delay Impact */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-400">DELAY IMPACT</h3>
          <div className="space-y-1.5">
            {delayImpacts.map(({ mins, newFdp, status, label }) => (
              <div
                key={mins}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                  status === "ok"
                    ? "border-zinc-700 bg-zinc-800/30"
                    : status === "warn"
                    ? "border-amber-800/50 bg-amber-900/20"
                    : "border-red-800/50 bg-red-900/20"
                }`}
              >
                <span className="text-sm font-mono">
                  +{mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                </span>
                <span className="text-sm font-mono">{newFdp}h / {fdpLimit}h</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    status === "ok"
                      ? "text-emerald-400"
                      : status === "warn"
                      ? "text-amber-400"
                      : "text-red-400"
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* disclaimer */}
        <p className="text-xs text-zinc-600 text-center">
          This is a reference tool only and does not replace official calculations.
        </p>
      </div>
    </div>
  );
}
