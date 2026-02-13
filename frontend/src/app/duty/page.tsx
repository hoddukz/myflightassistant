// Tag: core
// Path: frontend/src/app/duty/page.tsx

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";
import { fetchFar117Status } from "@/lib/api";
import type { Far117Status } from "@/types";
import {
  FDP_TABLE,
  PICKUP_PRESETS,
  getFdpLimit,
  formatFdpTime,
  addHoursToTime,
  getFdpStatus,
  simulatePickup,
  getCumulativeFlightTime,
  getLastRelease,
  type PickupInput,
  type PickupResult,
} from "@/lib/far117";

export default function DutyPage() {
  const { pairings } = useScheduleStore();
  const hasPairings = pairings.length > 0;

  // Backend FAR 117 status
  const [apiStatus, setApiStatus] = useState<Far117Status | null>(null);
  const [tableOpen, setTableOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!hasPairings) return;
    try {
      const data = await fetchFar117Status();
      setApiStatus(data);
    } catch {
      // silent
    }
  }, [hasPairings]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Pickup Simulator state
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [reportH, setReportH] = useState(7);
  const [reportM, setReportM] = useState(0);
  const [legs, setLegs] = useState(3);
  const [blockH, setBlockH] = useState(6);
  const [blockM, setBlockM] = useState(0);

  const applyPreset = (idx: number) => {
    const p = PICKUP_PRESETS[idx];
    setActivePreset(idx);
    setReportH(p.reportH);
    setReportM(p.reportM);
    setLegs(p.legs);
    setBlockH(p.blockH);
    setBlockM(p.blockM);
  };

  // Clear preset when manually changing values
  const clearPreset = () => setActivePreset(null);

  // Schedule-derived data for pickup simulation
  const scheduleData = useMemo(() => {
    if (!hasPairings) return undefined;
    const ft28 = getCumulativeFlightTime(pairings, 28);
    const lr = getLastRelease(pairings);
    if (lr === null) return undefined;
    return { flightTime28d: ft28, lastReleaseUtc: lr };
  }, [pairings, hasPairings]);

  // Pickup result
  const pickupResult: PickupResult = useMemo(() => {
    const input: PickupInput = { reportH, reportM, legs, blockH, blockM };
    return simulatePickup(input, scheduleData);
  }, [reportH, reportM, legs, blockH, blockM, scheduleData]);

  // FDP calc for progress bar
  const estFdp = blockH + blockM / 60 + 1.0;
  const fdpLimit = getFdpLimit(reportH, legs);
  const fdpStatus = getFdpStatus(estFdp, fdpLimit);
  const pct = Math.min((estFdp / fdpLimit) * 100, 120);
  const remaining = fdpLimit - estFdp;
  const hardLimit = fdpLimit + 2;

  const barColor =
    fdpStatus === "critical"
      ? "bg-red-500"
      : fdpStatus === "extend"
      ? "bg-amber-500"
      : fdpStatus === "warning"
      ? "bg-amber-500"
      : "bg-blue-500";

  // Stepper component
  const Stepper = ({
    label,
    value,
    onDec,
    onInc,
    width = "w-10",
  }: {
    label: string;
    value: string | number;
    onDec: () => void;
    onInc: () => void;
    width?: string;
  }) => (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs text-zinc-500 font-medium">{label}</span>
      <div className="flex items-center">
        <button
          onClick={onDec}
          className="w-10 h-11 rounded-l-xl bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 flex items-center justify-center text-lg font-bold transition-colors active:bg-zinc-600"
        >
          -
        </button>
        <div
          className={`${width} h-11 bg-zinc-800/50 border-x border-zinc-700 flex items-center justify-center`}
        >
          <span className="font-mono text-base font-bold text-white">
            {value}
          </span>
        </div>
        <button
          onClick={onInc}
          className="w-10 h-11 rounded-r-xl bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 flex items-center justify-center text-lg font-bold transition-colors active:bg-zinc-600"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pt-2 flex items-center justify-between">
        <h1 className="text-xl font-bold">Duty</h1>
        <button
          onClick={() => setTableOpen(!tableOpen)}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded-lg bg-zinc-800/50"
        >
          {tableOpen ? "Hide Table" : "\u00A7117 Table"}
        </button>
      </div>

      {/* Table B Viewer (collapsible) */}
      {tableOpen && (
        <TableBViewer reportHour={reportH} numLegs={legs} />
      )}

      {/* Section A: FDP Status (from backend, on duty only) */}
      {apiStatus?.fdp && (
        <FdpStatusSection status={apiStatus} />
      )}

      {/* Section B: Cumulative Limits */}
      {apiStatus?.flight_time && apiStatus?.rest && (
        <CumulativeSection status={apiStatus} />
      )}

      {/* Section C: Pickup Simulator */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-400">PICKUP SIMULATOR</h2>

        {/* Preset chips */}
        <div className="flex gap-2">
          {PICKUP_PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => applyPreset(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                activePreset === i
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Steppers */}
        <div className="flex justify-between items-start px-1">
          <Stepper
            label="Report"
            value={`${reportH.toString().padStart(2, "0")}:${reportM
              .toString()
              .padStart(2, "0")}`}
            onDec={() => {
              clearPreset();
              let t = reportH * 60 + reportM - 30;
              if (t < 0) t += 1440;
              setReportH(Math.floor(t / 60));
              setReportM(t % 60);
            }}
            onInc={() => {
              clearPreset();
              let t = (reportH * 60 + reportM + 30) % 1440;
              setReportH(Math.floor(t / 60));
              setReportM(t % 60);
            }}
            width="w-14"
          />
          <Stepper
            label="Legs"
            value={legs}
            onDec={() => {
              clearPreset();
              setLegs((p) => Math.max(1, p - 1));
            }}
            onInc={() => {
              clearPreset();
              setLegs((p) => Math.min(9, p + 1));
            }}
          />
          <Stepper
            label="Block"
            value={`${blockH}:${blockM.toString().padStart(2, "0")}`}
            onDec={() => {
              clearPreset();
              let t = blockH * 60 + blockM - 15;
              if (t < 0) t = 0;
              setBlockH(Math.floor(t / 60));
              setBlockM(t % 60);
            }}
            onInc={() => {
              clearPreset();
              let t = blockH * 60 + blockM + 15;
              if (t > 960) t = 960;
              setBlockH(Math.floor(t / 60));
              setBlockM(t % 60);
            }}
            width="w-14"
          />
        </div>

        {/* FDP Progress */}
        <div
          className={`rounded-2xl p-5 border ${
            fdpStatus === "critical"
              ? "bg-red-950/40 border-red-800/50"
              : fdpStatus === "extend"
              ? "bg-amber-950/30 border-amber-800/40"
              : "bg-zinc-800/40 border-zinc-700/50"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="text-3xl font-mono font-bold">
                {formatFdpTime(estFdp)}
              </span>
              <span className="text-zinc-500 text-sm ml-2">
                / {fdpLimit}h max
              </span>
            </div>
            <span
              className={`text-xs font-bold mt-1.5 ${
                fdpStatus === "critical"
                  ? "text-red-400"
                  : fdpStatus === "extend" || fdpStatus === "warning"
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {fdpStatus === "critical"
                ? "Exceeds Hard Limit"
                : fdpStatus === "extend"
                ? "Extension Required"
                : fdpStatus === "warning"
                ? "Approaching Limit"
                : "Within Limits"}
            </span>
          </div>
          <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <div>
              <p className="text-zinc-500">Est. Release</p>
              <p className="font-mono font-bold text-zinc-300 mt-0.5">
                {addHoursToTime(reportH, reportM, estFdp)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-zinc-500">Remaining</p>
              <p
                className={`font-mono font-bold mt-0.5 ${
                  remaining > 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {remaining > 0 ? formatFdpTime(remaining) : "OVER"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-zinc-500">Max Release</p>
              <p className="font-mono font-bold text-blue-400 mt-0.5">
                {addHoursToTime(reportH, reportM, fdpLimit)}
              </p>
            </div>
          </div>
        </div>

        {/* Pickup Result Card */}
        <div
          className={`rounded-2xl p-4 border space-y-2 ${
            pickupResult.canPickup
              ? "bg-emerald-950/20 border-emerald-800/30"
              : pickupResult.fdpOk
              ? "bg-amber-950/20 border-amber-800/30"
              : "bg-red-950/20 border-red-800/30"
          }`}
        >
          {/* FDP check */}
          <CheckRow
            label="FDP"
            value={`${pickupResult.fdpHours}h / ${pickupResult.fdpLimit}h`}
            ok={pickupResult.fdpOk}
          />

          {/* 28d check */}
          {pickupResult.flight28dOk !== null ? (
            <CheckRow
              label="28d"
              value={`${pickupResult.flight28dAfter}h / 100h`}
              ok={pickupResult.flight28dOk}
            />
          ) : (
            <CheckRow label="28d" value="Schedule required" ok={null} />
          )}

          {/* Rest gap check */}
          {pickupResult.restGapOk !== null ? (
            <CheckRow
              label="Rest gap"
              value={`${pickupResult.restGapHours}h (\u226510h)`}
              ok={pickupResult.restGapOk}
            />
          ) : (
            <CheckRow label="Rest gap" value="Schedule required" ok={null} />
          )}

          {/* Overall */}
          <div className="pt-2 border-t border-zinc-700/50 text-center">
            <span
              className={`text-sm font-bold ${
                pickupResult.canPickup
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {pickupResult.canPickup
                ? "\u2705 Pickup OK"
                : "\uD83D\uDEA8 Cannot Pick Up"}
            </span>
            {pickupResult.warnings.length > 0 && (
              <p className="text-xs text-zinc-500 mt-1">
                {pickupResult.warnings[0]}
              </p>
            )}
          </div>
        </div>

        {/* Rest info */}
        <div className="flex justify-between items-center bg-zinc-800/30 rounded-2xl px-4 py-3 border border-zinc-800">
          <div>
            <p className="text-xs text-zinc-500">Min Rest</p>
            <p className="font-mono font-bold text-white">10h</p>
          </div>
          <div className="h-8 w-px bg-zinc-700" />
          <div className="text-right">
            <p className="text-xs text-zinc-500">Next Report Earliest</p>
            <p className="font-mono font-bold text-blue-400">
              {addHoursToTime(reportH, reportM, estFdp + 10)}
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-zinc-600 pt-1 pb-4">
        Reference only. Does not replace official duty time calculations.
        Augmented crew, split duty, and UOC extensions may apply.
      </p>
    </div>
  );
}

// ── Sub-components ──

function CheckRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono">{value}</span>
        <span className="text-sm">
          {ok === null ? "\u2796" : ok ? "\u2705" : "\uD83D\uDEA8"}
        </span>
      </div>
    </div>
  );
}

function FdpStatusSection({ status }: { status: Far117Status }) {
  const fdp = status.fdp!;
  const pct =
    fdp.limit_hours > 0
      ? Math.min((fdp.current_hours / fdp.limit_hours) * 100, 100)
      : 0;

  let barColor = "bg-emerald-500";
  let textColor = "text-emerald-400";
  if (pct > 90) {
    barColor = "bg-red-500";
    textColor = "text-red-400";
  } else if (pct > 70) {
    barColor = "bg-amber-500";
    textColor = "text-amber-400";
  }

  if (!fdp.on_duty) {
    return (
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-400">FDP STATUS</h2>
        <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">No active duty</span>
            {fdp.next_duty_date && (
              <span className="text-xs text-zinc-500">
                Next: {fdp.next_duty_date}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-400">FDP STATUS</h2>
      <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/50 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-2xl font-mono font-bold">
              {formatFdpTime(fdp.current_hours)}
            </span>
            <span className="text-zinc-500 text-sm ml-1">
              / {fdp.limit_hours}h max
            </span>
          </div>
          <span className={`text-sm font-mono font-bold ${textColor}`}>
            {formatFdpTime(fdp.remaining_hours)} left
          </span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{fdp.legs} legs \u00B7 Report {fdp.report_hour_local}:00</span>
        </div>
        {status.warnings.length > 0 && (
          <p className="text-xs text-amber-400">{status.warnings[0]}</p>
        )}
      </div>
    </div>
  );
}

function CumulativeSection({ status }: { status: Far117Status }) {
  const ft = status.flight_time!;
  const rest = status.rest!;

  const pct28 = Math.min((ft.last_28d / ft.limit_28d) * 100, 100);
  const pct365 = Math.min((ft.last_365d / ft.limit_365d) * 100, 100);

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-400">CUMULATIVE</h2>
      <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/50 space-y-4">
        {/* 28d */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-500">28d Flight Time</span>
            <span className="font-mono">
              {ft.last_28d}h / {ft.limit_28d}h
            </span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                pct28 > 90 ? "bg-red-500" : pct28 > 70 ? "bg-amber-500" : "bg-blue-500"
              }`}
              style={{ width: `${pct28}%` }}
            />
          </div>
        </div>

        {/* 365d */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-500">365d Flight Time</span>
            <span className="font-mono">
              {ft.last_365d}h / {ft.limit_365d}h
            </span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                pct365 > 90 ? "bg-red-500" : pct365 > 70 ? "bg-amber-500" : "bg-blue-500"
              }`}
              style={{ width: `${pct365}%` }}
            />
          </div>
        </div>

        {/* 56h rest */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">56h+ rest in 168h</span>
          <span className="font-mono">
            {rest.longest_rest_168h}h{" "}
            <span className={rest.rest_56h_met ? "text-emerald-400" : "text-red-400"}>
              {rest.rest_56h_met ? "\u2705" : "\uD83D\uDEA8"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function TableBViewer({
  reportHour,
  numLegs,
}: {
  reportHour: number;
  numLegs: number;
}) {
  const legCols = ["1-2", "3", "4", "5", "6", "7+"];
  const activeCol = numLegs <= 2 ? 0 : numLegs >= 7 ? 5 : numLegs - 2;

  return (
    <div className="bg-zinc-800/40 rounded-xl p-3 border border-zinc-700/50 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-zinc-500 font-medium py-1 px-1">
              Report
            </th>
            {legCols.map((col, i) => (
              <th
                key={col}
                className={`text-center font-medium py-1 px-1 ${
                  i === activeCol ? "text-blue-400" : "text-zinc-500"
                }`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FDP_TABLE.map((row) => {
            const isActiveRow =
              reportHour >= row.range[0] && reportHour <= row.range[1];
            return (
              <tr key={row.range.join("-")}>
                <td
                  className={`py-1 px-1 font-mono ${
                    isActiveRow ? "text-blue-400 font-bold" : "text-zinc-500"
                  }`}
                >
                  {row.range[0].toString().padStart(2, "0")}-
                  {row.range[1].toString().padStart(2, "0")}
                </td>
                {row.limits.map((limit, i) => (
                  <td
                    key={i}
                    className={`text-center py-1 px-1 font-mono ${
                      isActiveRow && i === activeCol
                        ? "bg-blue-900/20 text-blue-300 font-bold rounded"
                        : isActiveRow || i === activeCol
                        ? "text-zinc-300"
                        : "text-zinc-600"
                    }`}
                  >
                    {limit}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
