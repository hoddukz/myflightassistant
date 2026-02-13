// Tag: core
// Path: frontend/src/components/far117/Far117Card.tsx

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchFar117Status } from "@/lib/api";
import type { Far117Status } from "@/types";

interface Props {
  hasPairings: boolean;
}

export default function Far117Card({ hasPairings }: Props) {
  const [status, setStatus] = useState<Far117Status | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!hasPairings) return;
    setLoading(true);
    try {
      const data = await fetchFar117Status();
      setStatus(data);
    } catch {
      // 실패 시 조용히 무시
    } finally {
      setLoading(false);
    }
  }, [hasPairings]);

  useEffect(() => {
    load();
  }, [load]);

  // 스케줄 없으면 Duty 페이지 링크만
  if (!hasPairings) {
    return (
      <Link href="/duty" className="block">
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">FAR 117</span>
            <span className="text-xs text-blue-400 font-medium">
              Pickup Simulator {"\u203A"}
            </span>
          </div>
          <p className="text-xs text-zinc-600 mt-1">Upload schedule to see FDP status</p>
        </div>
      </Link>
    );
  }

  if (loading || !status || !status.fdp) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">FAR 117</span>
          <span className="text-xs text-zinc-600">{loading ? "Loading..." : ""}</span>
        </div>
        {loading && (
          <div className="mt-2 h-2 bg-zinc-800 rounded-full animate-pulse" />
        )}
      </div>
    );
  }

  const { fdp, warnings } = status;
  const pct = fdp.limit_hours > 0
    ? Math.min((fdp.current_hours / fdp.limit_hours) * 100, 100)
    : 0;

  // 색상 결정
  let barColor = "bg-emerald-500";
  let textColor = "text-emerald-400";
  if (pct > 90) {
    barColor = "bg-red-500";
    textColor = "text-red-400";
  } else if (pct > 70) {
    barColor = "bg-amber-500";
    textColor = "text-amber-400";
  }

  // Off duty 표시
  const fdpLabel = fdp.on_duty
    ? `${fdp.current_hours}h / ${fdp.limit_hours}h`
    : fdp.next_duty_date
    ? `Off Duty`
    : `No upcoming duty`;

  const fdpSub = fdp.on_duty
    ? `${fdp.remaining_hours}h remaining`
    : fdp.next_duty_date
    ? `Next: ${fdp.next_duty_date}`
    : null;

  return (
    <Link href="/duty" className="block">
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3 active:bg-zinc-800 transition-colors">
        {/* Header + FDP */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">FDP</span>
            <span className={`text-sm font-bold font-mono ${textColor}`}>
              {fdpLabel}
            </span>
          </div>
          {fdpSub && (
            <span className="text-xs text-zinc-500">{fdpSub}</span>
          )}
        </div>

        {/* 프로그레스 바 (on_duty일 때만) */}
        {fdp.on_duty && (
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {/* 경고 (첫 번째만) */}
        {warnings.length > 0 && (
          <p className="text-xs text-amber-400">{warnings[0]}</p>
        )}

        {/* Tap for more */}
        <div className="flex justify-between text-xs text-zinc-600">
          <span>{fdp.legs} legs{fdp.on_duty ? ` \u00B7 Report ${fdp.report_hour_local}:00` : ""}</span>
          <span>Tap for more {"\u203A"}</span>
        </div>
      </div>
    </Link>
  );
}
