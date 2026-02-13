// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/components/dashboard/InboundAircraft.tsx

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchFlightTrack } from "@/lib/api";
import { getTailTrackingUrl } from "@/lib/utils";
import type { FlightTrackData, FlightPhase } from "@/types";

interface Props {
  tailNumber: string | null;
  destination: string; // 내 출발 공항 = inbound 항공기가 도착할 공항
  origin?: string; // 인바운드 항공기 출발 공항
  scheduledDep?: string; // 인바운드 스케줄 출발 (ISO)
  scheduledArr?: string; // 인바운드 스케줄 도착 (ISO)
}

// 비행 단계 아이콘 매핑 (material icons)
const PHASE_ICONS: Record<FlightPhase, string> = {
  gate_departure: "local_parking",
  takeoff: "flight_takeoff",
  climbing: "trending_up",
  cruise: "flight",
  step_descent: "swap_vert",
  level_off: "trending_flat",
  reclimb: "north_east",
  initial_descent: "trending_down",
  approach: "south",
  final: "flight_land",
  holding: "sync",
  arrived: "check_circle",
};

// 비행 단계 색상
const PHASE_COLORS: Record<string, string> = {
  gate_departure: "text-zinc-400",
  takeoff: "text-blue-400",
  climbing: "text-blue-400",
  cruise: "text-emerald-400",
  step_descent: "text-amber-400",
  level_off: "text-amber-400",
  reclimb: "text-amber-400",
  initial_descent: "text-orange-400",
  approach: "text-orange-400",
  final: "text-red-400",
  holding: "text-red-400",
  arrived: "text-emerald-400",
};

export default function InboundAircraft({
  tailNumber,
  destination,
  origin,
  scheduledDep,
  scheduledArr,
}: Props) {
  const [data, setData] = useState<FlightTrackData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // 1분마다 카운트다운 갱신
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // tail_number로 자동 조회 (스케줄 컨텍스트 포함)
  const doFetch = useCallback(
    async (tn: string, dest: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchFlightTrack({
          tail_number: tn,
          destination: dest,
          origin,
          scheduled_dep: scheduledDep,
          scheduled_arr: scheduledArr,
        });
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [origin, scheduledDep, scheduledArr]
  );

  // 마운트 시 자동 조회
  useEffect(() => {
    if (tailNumber) {
      doFetch(tailNumber, destination);
    }
  }, [tailNumber, destination, doFetch]);

  const handleRefresh = () => {
    if (tailNumber) {
      doFetch(tailNumber, destination);
    }
  };

  // tail_number 없으면 스케줄에 tail 정보 없음
  if (!tailNumber) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <p className="text-xs text-zinc-500 font-semibold">INBOUND AIRCRAFT</p>
        <p className="text-sm text-zinc-500 mt-2">No tail number in schedule</p>
      </div>
    );
  }

  // 로딩
  if (loading && !data) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 animate-pulse">
        <p className="text-xs text-zinc-500 font-semibold">INBOUND AIRCRAFT</p>
        <p className="text-sm text-zinc-500 mt-2">Tracking {tailNumber}...</p>
      </div>
    );
  }

  // 데이터 없음 또는 no_data
  if (!data || !data.available) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500 font-semibold">INBOUND AIRCRAFT</p>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40"
          >
            {loading ? "..." : "Refresh"}
          </button>
        </div>
        <p className="text-sm text-zinc-500">
          {data?.reason === "no_data"
            ? "No active flight found"
            : error || "Unable to track"}
        </p>
        <a
          href={getTailTrackingUrl(tailNumber)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-amber-400 hover:text-amber-300 font-mono"
        >
          {tailNumber} — FlightAware {"\u2197"}
        </a>
      </div>
    );
  }

  // 정상 데이터
  return (
    <InboundCard
      data={data}
      tailNumber={tailNumber}
      destination={destination}
      loading={loading}
      onRefresh={handleRefresh}
      now={now}
    />
  );
}

/* ─────────── Inbound Card (정상 데이터 표시) ─────────── */

function InboundCard({
  data,
  tailNumber,
  destination,
  loading,
  onRefresh,
  now,
}: {
  data: FlightTrackData;
  tailNumber: string | null;
  destination: string;
  loading: boolean;
  onRefresh: () => void;
  now: Date;
}) {
  const dep = data.departure;
  const arr = data.arrival;
  const live = data.live;
  const isOpenSky = data.provider === "opensky";

  const phase = live?.phase as FlightPhase | undefined;
  const phaseLabel = live?.phase_label;
  const phaseShort = live?.phase_short;
  const isShortLeg = live?.short_leg;
  const isHolding = phase === "holding";

  // 지연 색상 (OpenSky에는 delay 정보 없음)
  const delayMin = arr?.delay_minutes ?? 0;
  const delayColor = useMemo(() => {
    if (delayMin == null || delayMin <= 0) return "text-emerald-400";
    if (delayMin <= 15) return "text-amber-400";
    return "text-red-400";
  }, [delayMin]);

  const statusColor = useMemo(() => {
    switch (data.status) {
      case "en-route":
        return "bg-blue-600";
      case "landed":
        return "bg-emerald-600";
      case "on-ground":
        return "bg-amber-600";
      case "scheduled":
        return "bg-zinc-600";
      case "cancelled":
        return "bg-red-600";
      default:
        return "bg-zinc-600";
    }
  }, [data.status]);

  // ETA 카운트다운
  const etaTime = arr?.estimated || arr?.scheduled;
  const countdown = useMemo(() => {
    if (!etaTime) return null;
    const eta = new Date(etaTime);
    const diff = eta.getTime() - now.getTime();
    if (diff <= 0) return { text: "Arrived", minutes: 0 };
    const totalMin = Math.floor(diff / 60000);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hours > 0) return { text: `${hours}h ${mins}m`, minutes: totalMin };
    return { text: `${mins} min`, minutes: totalMin };
  }, [etaTime, now]);

  // 프로그레스 바 — 서버 progress 우선, 없으면 기존 로직
  const progress = useMemo(() => {
    if (live?.progress != null) {
      return Math.max(0, Math.min(100, live.progress));
    }
    if (isOpenSky && live?.distance_nm != null) {
      const maxDist = live.total_distance || 1500;
      const remaining = Math.min(live.distance_nm, maxDist);
      return Math.max(0, Math.min(100, ((maxDist - remaining) / maxDist) * 100));
    }
    if (!dep?.actual && !dep?.estimated && !dep?.scheduled) return 0;
    if (!etaTime) return 0;
    const depTime = dep?.actual || dep?.estimated || dep?.scheduled;
    if (!depTime) return 0;
    const depDate = new Date(depTime);
    const arrDate = new Date(etaTime);
    const total = arrDate.getTime() - depDate.getTime();
    if (total <= 0) return 100;
    const elapsed = now.getTime() - depDate.getTime();
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }, [live, isOpenSky, dep, etaTime, now]);

  // 시간 포맷 (로컬)
  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return "--:--";
    try {
      return new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "--:--";
    }
  };

  // Provider 표시
  const providerLabel = useMemo(() => {
    switch (data.provider) {
      case "opensky":
        return "OpenSky";
      case "flightlabs":
        return "FlightLabs";
      case "aviationstack":
        return "AviationStack";
      default:
        return data.provider;
    }
  }, [data.provider]);

  // 고도 표시 (FL 또는 ft)
  const altitudeDisplay = useMemo(() => {
    if (!live?.altitude) return null;
    if (live.altitude >= 18000) {
      return `FL${Math.round(live.altitude / 100)}`;
    }
    return `${live.altitude.toLocaleString()} ft`;
  }, [live?.altitude]);

  // 프로그레스 바 색상 (단계 기반)
  const progressBarColor = useMemo(() => {
    if (isHolding) return "bg-red-500";
    if (phase === "approach" || phase === "final") return "bg-orange-500";
    if (phase === "initial_descent") return "bg-amber-500";
    return "bg-blue-500";
  }, [phase, isHolding]);

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 font-semibold">INBOUND AIRCRAFT</p>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 border border-blue-400/30 px-2 py-1 rounded"
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {/* Tail + Flight Number */}
      <div className="flex items-center gap-2">
        {(data.tail_number || tailNumber) && (
          <a
            href={getTailTrackingUrl(data.tail_number || tailNumber || "")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono font-bold text-amber-400 hover:text-amber-300"
          >
            {data.tail_number || tailNumber}
          </a>
        )}
        {(data.tail_number || tailNumber) && data.flight_number && (
          <span className="text-zinc-600">{"\u00B7"}</span>
        )}
        {data.flight_number && (
          <a
            href={getTailTrackingUrl(data.flight_number)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono font-bold text-blue-400 hover:text-blue-300"
          >
            {data.flight_number}
          </a>
        )}
      </div>

      {/* Route + Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-base">
          <span className="font-bold">{dep?.airport || "---"}</span>
          <span className="text-zinc-600">{"\u2192"}</span>
          <span className="font-bold">{arr?.airport || destination || "---"}</span>
        </div>
        <span
          className={`text-xs font-bold text-white px-2 py-0.5 rounded ${statusColor}`}
        >
          {(data.status || "unknown").toUpperCase().replace("-", " ")}
        </span>
      </div>

      {/* Flight Phase (OpenSky + en-route) */}
      {isOpenSky && phase && data.status === "en-route" && (
        <div className="flex items-center gap-2">
          <span
            className={`material-icons text-base ${PHASE_COLORS[phase] || "text-zinc-400"}`}
          >
            {PHASE_ICONS[phase] || "help_outline"}
          </span>
          <span className={`text-sm font-medium ${PHASE_COLORS[phase] || "text-zinc-400"}`}>
            {phaseLabel}
          </span>
          {phaseShort && (
            <span className="text-xs text-zinc-600 font-mono">({phaseShort})</span>
          )}
        </div>
      )}

      {/* Holding Warning */}
      {isHolding && (
        <div className="bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400 font-medium">
            Holding pattern detected — possible arrival delay
          </p>
        </div>
      )}

      {/* ETA */}
      {etaTime && (
        <div className="text-sm text-zinc-400">
          <span>ETA: </span>
          <span className="font-mono font-bold text-white">
            {formatTime(etaTime)}L
          </span>
          {arr?.scheduled && arr?.estimated && arr.scheduled !== arr.estimated && (
            <span className="text-zinc-600 ml-1">
              (sched {formatTime(arr.scheduled)}L)
            </span>
          )}
        </div>
      )}

      {/* Progress bar + countdown/distance */}
      {data.status === "en-route" && countdown && countdown.minutes > 0 && (
        <div className="space-y-1">
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            {live?.distance_nm != null && (
              <span className="text-xs font-mono text-zinc-500">
                {live.distance_nm} NM{live.total_distance ? ` / ${live.total_distance} NM` : ""}
              </span>
            )}
            <span className="text-sm font-mono text-blue-400 ml-auto">
              {isShortLeg ? "~" : ""}
              {countdown.text}
            </span>
          </div>
        </div>
      )}

      {/* OpenSky 실시간 데이터: 고도, 속도, 헤딩, 수직속도 */}
      {isOpenSky && live && data.status === "en-route" && !isShortLeg && (
        <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
          {altitudeDisplay && <span>{altitudeDisplay}</span>}
          {live.speed != null && <span>{live.speed} kts</span>}
          {live.heading != null && (
            <span>Hdg {Math.round(live.heading)}{"\u00B0"}</span>
          )}
          {live.vertical_rate != null && live.vertical_rate !== 0 && (
            <span
              className={
                live.vertical_rate < 0 ? "text-amber-400" : "text-emerald-400"
              }
            >
              {live.vertical_rate > 0 ? "+" : ""}
              {live.vertical_rate} fpm
            </span>
          )}
        </div>
      )}

      {/* Short leg simplified view */}
      {isOpenSky && live && data.status === "en-route" && isShortLeg && (
        <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
          {altitudeDisplay && <span>{altitudeDisplay}</span>}
          {live.speed != null && <span>{live.speed} kts</span>}
          {live.distance_nm != null && <span>{live.distance_nm} NM left</span>}
        </div>
      )}

      {/* Delay (OpenSky 아닐 때) + Provider */}
      <div className="flex items-center justify-between">
        {!isOpenSky && delayMin != null && delayMin !== 0 ? (
          <span
            className={`text-xs font-bold ${delayColor} bg-zinc-800 px-2 py-1 rounded`}
          >
            {delayMin > 0 ? `+${delayMin} min DELAYED` : `${delayMin} min EARLY`}
          </span>
        ) : !isOpenSky ? (
          <span className="text-xs font-bold text-emerald-400 bg-zinc-800 px-2 py-1 rounded">
            ON TIME
          </span>
        ) : (
          <span />
        )}
        {data.provider && (
          <span className="text-xs text-zinc-600">via {providerLabel}</span>
        )}
      </div>

      {/* ADS-B Disclaimer */}
      {isOpenSky && phase && (
        <p className="text-[10px] text-zinc-700 leading-tight">
          Flight phase estimated from ADS-B data. Do not use as sole source for
          operational decisions.
        </p>
      )}
    </div>
  );
}
