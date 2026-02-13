// Tag: core
// Path: frontend/src/components/far117/Far117DetailTab.tsx

"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchFar117Status, fetchFar117DelaySimulation } from "@/lib/api";
import type { Far117Status, Far117DelayResult } from "@/types";

function ProgressBar({
  value,
  max,
  label,
  sub,
}: {
  value: number;
  max: number;
  label: string;
  sub?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  let barColor = "bg-emerald-500";
  let textColor = "text-emerald-400";
  if (pct > 90) {
    barColor = "bg-red-500";
    textColor = "text-red-400";
  } else if (pct > 70) {
    barColor = "bg-amber-500";
    textColor = "text-amber-400";
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-zinc-400">{label}</span>
        <span className={`text-sm font-bold font-mono ${textColor}`}>
          {value}h / {max}h
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

const DELAY_PRESETS = [30, 60, 120, 180];

export default function Far117DetailTab() {
  const [status, setStatus] = useState<Far117Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDelay, setSelectedDelay] = useState<number | null>(null);
  const [delayResult, setDelayResult] = useState<Far117DelayResult | null>(null);
  const [delayLoading, setDelayLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFar117Status();
      setStatus(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelaySimulation = useCallback(async (mins: number) => {
    setSelectedDelay(mins);
    setDelayLoading(true);
    try {
      const data = await fetchFar117DelaySimulation(mins);
      setDelayResult(data);
    } catch {
      setDelayResult(null);
    } finally {
      setDelayLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-zinc-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!status || !status.has_schedule || !status.fdp) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">No schedule data for FAR 117 calculation</p>
      </div>
    );
  }

  const { fdp, flight_time, rest, warnings } = status;

  return (
    <div className="space-y-4 py-2">
      {/* FDP */}
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-4">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase">
          Flight Duty Period {fdp.on_duty ? "(On Duty)" : "(Off Duty)"}
        </h3>
        {fdp.on_duty ? (
          <ProgressBar
            value={fdp.current_hours}
            max={fdp.limit_hours}
            label={`${fdp.legs} legs, ${String(fdp.report_hour_local).padStart(2, "0")}:00 report`}
            sub={`${fdp.remaining_hours}h remaining`}
          />
        ) : (
          <div>
            <p className="text-sm">
              Max FDP:{" "}
              <span className="font-bold font-mono text-blue-400">
                {fdp.limit_hours}h
              </span>
              <span className="text-zinc-500 ml-2">
                ({fdp.legs} legs, {String(fdp.report_hour_local).padStart(2, "0")}:00 report)
              </span>
            </p>
            {fdp.next_duty_date && (
              <p className="text-xs text-zinc-500 mt-1">
                Next duty: {fdp.next_duty_date}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Cumulative Flight Time */}
      {flight_time && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-4">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase">
            Cumulative Flight Time
          </h3>
          <ProgressBar
            value={flight_time.last_28d}
            max={flight_time.limit_28d}
            label="Last 28 Days"
          />
          <ProgressBar
            value={flight_time.last_365d}
            max={flight_time.limit_365d}
            label="Last 365 Days"
          />
        </div>
      )}

      {/* Rest */}
      {rest && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-2">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase">Rest</h3>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Last Rest</span>
            <span className="font-mono">
              {rest.last_rest_hours}h{" "}
              <span className="text-zinc-500">/ {rest.min_required}h min</span>
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">56h Rest (168h window)</span>
            <span
              className={`font-bold ${
                rest.rest_56h_met ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {rest.rest_56h_met ? "Met" : "Not Met"}{" "}
              <span className="font-normal text-zinc-500">
                ({rest.longest_rest_168h}h)
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-900/20 rounded-xl p-4 border border-amber-800/50 space-y-1.5">
          <h3 className="text-xs font-semibold text-amber-400 uppercase">
            Warnings
          </h3>
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-300">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Delay Simulator */}
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase">
          Delay Simulator
        </h3>
        <div className="flex gap-2">
          {DELAY_PRESETS.map((mins) => (
            <button
              key={mins}
              onClick={() => handleDelaySimulation(mins)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                selectedDelay === mins
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              +{mins >= 60 ? `${mins / 60}h` : `${mins}m`}
            </button>
          ))}
        </div>

        {delayLoading && (
          <div className="h-12 bg-zinc-800/50 rounded-lg animate-pulse" />
        )}

        {delayResult && !delayLoading && (
          <div
            className={`p-3 rounded-lg border ${
              delayResult.feasible
                ? delayResult.warnings.length > 0
                  ? "border-amber-800/50 bg-amber-900/20"
                  : "border-zinc-700 bg-zinc-800/30"
                : "border-red-800/50 bg-red-900/20"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono">
                FDP {delayResult.new_fdp_hours}h / {delayResult.fdp_limit}h
              </span>
              <span
                className={`text-xs font-bold ${
                  delayResult.feasible
                    ? delayResult.warnings.length > 0
                      ? "text-amber-400"
                      : "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {delayResult.feasible
                  ? delayResult.warnings.length > 0
                    ? "Caution"
                    : "OK"
                  : "Exceeds Limit"}
              </span>
            </div>
            {delayResult.warnings.map((w, i) => (
              <p key={i} className="text-xs text-zinc-400 mt-1">
                {w}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-zinc-600 text-center px-4">
        This is a reference tool only and does not replace official calculations.
        Augmented crew, split duty, and unforeseen circumstances are not supported.
      </p>
    </div>
  );
}
