// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/briefing/page.tsx

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";
import { fetchFullBriefing } from "@/lib/api";
import type { FlightLeg } from "@/types";

const CATEGORY_COLORS: Record<string, string> = {
  VFR: "text-emerald-400 border-emerald-400",
  MVFR: "text-blue-400 border-blue-400",
  IFR: "text-red-400 border-red-400",
  LIFR: "text-purple-400 border-purple-400",
};

const CATEGORY_BG: Record<string, string> = {
  VFR: "bg-emerald-400/10",
  MVFR: "bg-blue-400/10",
  IFR: "bg-red-400/10",
  LIFR: "bg-purple-400/10",
};

const HIGHLIGHT_KEYWORDS = [
  "RWY", "RUNWAY", "TWY", "TAXIWAY", "CLSD", "CLOSED",
  "ILS", "LOC", "GS", "APCH", "OBST", "TFR",
];

interface DayInfo {
  date: string;
  dateFormatted: string;
  legs: FlightLeg[];
  airports: string[];
}

type SortedLeg = FlightLeg & { passed: boolean };

export default function BriefingPage() {
  const { pairings } = useScheduleStore();
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchBriefing, setSearchBriefing] = useState<any>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [briefingCache, setBriefingCache] = useState<Record<string, any>>({});
  const [loadingAirports, setLoadingAirports] = useState<Set<string>>(new Set());
  const [errorAirports, setErrorAirports] = useState<Record<string, string>>({});
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const fetchedRef = useRef(new Set<string>());

  // 1분마다 현재 시간 갱신 (레그 순환용)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 스케줄에서 비행일 추출
  const days: DayInfo[] = useMemo(() => {
    const dayList: DayInfo[] = [];
    for (const p of pairings) {
      if (p.event_type !== "pairing") continue;
      if (new Date(p.end_utc) < now) continue;
      for (const d of p.days) {
        if (d.legs.length === 0) continue;
        const airports = new Set<string>();
        for (const leg of d.legs) {
          airports.add(leg.origin);
          airports.add(leg.destination);
        }
        const dateObj = new Date(d.flight_date + "T00:00:00");
        dayList.push({
          date: d.flight_date,
          dateFormatted: dateObj.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          legs: d.legs,
          airports: Array.from(airports),
        });
      }
    }
    return dayList;
  }, [pairings, now]);

  // 스케줄 없으면 검색 모드
  useEffect(() => {
    if (days.length === 0) setSearchOpen(true);
  }, [days.length]);

  // 레그 시간 기반 순환 정렬: 지나간 레그 하단, 다음 레그 상단
  const sortedLegs: SortedLeg[] = useMemo(() => {
    const currentDay = days[activeDayIndex];
    if (!currentDay) return [];

    const nowUtc = new Date(now.toISOString());
    const legs: SortedLeg[] = currentDay.legs.map((leg) => {
      let passed = false;
      // 도착 시간 기준으로 passed 판정 (비행이 끝나야 DONE)
      const arrStr = leg.arrive_utc;
      const depStr = leg.depart_utc;
      if (arrStr && leg.flight_date) {
        let arriveUtc = new Date(`${leg.flight_date}T${arrStr}:00Z`);
        // 자정 넘김 처리: arrive가 depart보다 이르면 다음날
        if (depStr) {
          const departUtc = new Date(`${leg.flight_date}T${depStr}:00Z`);
          if (arriveUtc < departUtc) {
            arriveUtc = new Date(arriveUtc.getTime() + 24 * 60 * 60 * 1000);
          }
        }
        passed = nowUtc > arriveUtc;
      }
      return { ...leg, passed };
    });

    const firstUpcoming = legs.findIndex((l) => !l.passed);
    if (firstUpcoming <= 0) return legs;

    // 순환: 다음 레그부터, 지나간 레그는 뒤로
    return [...legs.slice(firstUpcoming), ...legs.slice(0, firstUpcoming)];
  }, [days, activeDayIndex, now]);

  // 브리핑 일괄 로딩 (ref 기반으로 중복 호출 방지)
  const loadBriefings = useCallback(async (airports: string[]) => {
    const toFetch = airports.filter((a) => !fetchedRef.current.has(a));
    if (toFetch.length === 0) return;

    toFetch.forEach((a) => fetchedRef.current.add(a));
    setLoadingAirports((prev) => new Set([...prev, ...toFetch]));

    const results = await Promise.allSettled(
      toFetch.map((apt) => fetchFullBriefing(apt))
    );

    setBriefingCache((prev) => {
      const updated = { ...prev };
      results.forEach((result, i) => {
        if (result.status === "fulfilled") updated[toFetch[i]] = result.value;
      });
      return updated;
    });

    setErrorAirports((prev) => {
      const updated = { ...prev };
      results.forEach((result, i) => {
        if (result.status === "rejected") {
          updated[toFetch[i]] = "Failed to fetch";
        } else {
          delete updated[toFetch[i]];
        }
      });
      return updated;
    });

    setLoadingAirports((prev) => {
      const updated = new Set(prev);
      toFetch.forEach((a) => updated.delete(a));
      return updated;
    });
  }, []);

  // Day 탭 변경 시 자동 로딩
  useEffect(() => {
    if (days[activeDayIndex]) {
      loadBriefings(days[activeDayIndex].airports);
    }
  }, [activeDayIndex, days, loadBriefings]);

  // 재시도
  const retryAirport = useCallback(
    (apt: string) => {
      fetchedRef.current.delete(apt);
      setErrorAirports((prev) => {
        const updated = { ...prev };
        delete updated[apt];
        return updated;
      });
      loadBriefings([apt]);
    },
    [loadBriefings]
  );

  // 검색
  const handleSearch = useCallback(async () => {
    const val = searchInput.trim().toUpperCase();
    if (val.length < 3) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const data = await fetchFullBriefing(val);
      setSearchBriefing(data);
      setBriefingCache((prev) => ({ ...prev, [val]: data }));
      fetchedRef.current.add(val);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Failed to fetch");
      setSearchBriefing(null);
    } finally {
      setSearchLoading(false);
    }
  }, [searchInput]);

  const currentDay = days[activeDayIndex];

  return (
    <div className="space-y-4">
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Briefing</h1>
          <p className="text-zinc-500 text-sm mt-1">METAR / TAF / NOTAM</p>
        </div>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
            searchOpen
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>
      </div>

      {/* Day 탭 */}
      {days.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {days.map((day, i) => (
            <button
              key={i}
              onClick={() => setActiveDayIndex(i)}
              className={`shrink-0 px-3 py-2 rounded-lg transition-colors ${
                activeDayIndex === i
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <div className="text-xs font-bold">Day {i + 1}</div>
              <div className="text-xs opacity-70">{day.dateFormatted}</div>
            </button>
          ))}
        </div>
      )}

      {/* 검색 팝업 (돋보기 클릭 시 아래로 펼침) */}
      {searchOpen && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-3 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Airport (e.g. DTW, KDTW)"
              maxLength={4}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={searchLoading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {searchLoading ? "..." : "Go"}
            </button>
          </div>
          {searchError && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-2 text-sm text-red-300">
              {searchError}
            </div>
          )}
          {searchBriefing && (
            <AirportBriefingCard
              station={searchBriefing.station || searchInput}
              briefing={searchBriefing}
              loading={false}
              expanded={true}
              onToggle={() => {}}
            />
          )}
        </div>
      )}

      {/* 레그별 브리핑 블록 */}
      {currentDay && (
        <div className="space-y-5">
          {sortedLegs.map((leg) => (
            <LegBriefingBlock
              key={`${leg.flight_date}-${leg.leg_number}`}
              leg={leg}
              briefingCache={briefingCache}
              loadingAirports={loadingAirports}
              errorAirports={errorAirports}
              expandedCard={expandedCard}
              onToggleCard={(key) =>
                setExpandedCard(expandedCard === key ? null : key)
              }
              onRetry={retryAirport}
            />
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {days.length === 0 && !searchOpen && (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-3xl mb-3">{"\u2601"}</p>
          <p>Upload schedule or tap search</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Leg Briefing Block ─────────────── */

function LegBriefingBlock({
  leg,
  briefingCache,
  loadingAirports,
  errorAirports,
  expandedCard,
  onToggleCard,
  onRetry,
}: {
  leg: SortedLeg;
  briefingCache: Record<string, any>;
  loadingAirports: Set<string>;
  errorAirports: Record<string, string>;
  expandedCard: string | null;
  onToggleCard: (key: string) => void;
  onRetry: (apt: string) => void;
}) {
  const cardKeyOrigin = `${leg.leg_number}-${leg.origin}`;
  const cardKeyDest = `${leg.leg_number}-${leg.destination}`;

  return (
    <div className={`space-y-2 ${leg.passed ? "opacity-40" : ""}`}>
      {/* 레그 헤더 */}
      <div className="flex items-center gap-2">
        <div
          className={`h-px flex-1 ${
            leg.passed ? "bg-zinc-800" : "bg-blue-600/40"
          }`}
        />
        <div className="flex items-center gap-2 shrink-0">
          {leg.passed && (
            <span className="text-xs bg-zinc-700 text-zinc-500 px-1.5 py-0.5 rounded">
              DONE
            </span>
          )}
          <span className="text-sm font-mono font-bold text-blue-400">
            {leg.flight_number}
          </span>
          <span className="text-sm font-bold">{leg.origin}</span>
          <span className="text-zinc-600">{"\u2192"}</span>
          <span className="text-sm font-bold">{leg.destination}</span>
          {leg.ac_type && (
            <span className="text-xs text-zinc-500">{leg.ac_type}</span>
          )}
          {leg.is_deadhead && (
            <span className="text-xs bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">
              DH
            </span>
          )}
        </div>
        <div
          className={`h-px flex-1 ${
            leg.passed ? "bg-zinc-800" : "bg-blue-600/40"
          }`}
        />
      </div>

      {/* 시간 정보 */}
      {leg.depart_local && leg.arrive_local && (
        <table className="text-xs font-mono text-zinc-500 mx-auto">
          <tbody>
            <tr>
              <td className="text-right pr-1">{leg.depart_local}{leg.depart_tz || ""}</td>
              <td className="text-center text-zinc-600 px-1">{"\u2192"}</td>
              <td className="pr-1">{leg.arrive_local}{leg.arrive_tz || ""}</td>
              <td className="text-zinc-600 pl-2">block</td>
            </tr>
            <tr className="text-zinc-600">
              <td className="text-right pr-1">{leg.depart_utc ? `${leg.depart_utc}Z` : ""}</td>
              <td />
              <td className="pr-1">{leg.arrive_utc ? `${leg.arrive_utc}Z` : ""}</td>
              <td className="pl-2">{leg.block_time || ""}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* 출발 공항 브리핑 */}
      <AirportBriefingCard
        station={leg.origin}
        briefing={briefingCache[leg.origin]}
        loading={loadingAirports.has(leg.origin)}
        error={errorAirports[leg.origin]}
        expanded={expandedCard === cardKeyOrigin}
        onToggle={() => onToggleCard(cardKeyOrigin)}
        onRetry={() => onRetry(leg.origin)}
        label="DEP"
      />

      {/* 도착 공항 브리핑 */}
      <AirportBriefingCard
        station={leg.destination}
        briefing={briefingCache[leg.destination]}
        loading={loadingAirports.has(leg.destination)}
        error={errorAirports[leg.destination]}
        expanded={expandedCard === cardKeyDest}
        onToggle={() => onToggleCard(cardKeyDest)}
        onRetry={() => onRetry(leg.destination)}
        label="ARR"
      />
    </div>
  );
}

/* ─────────────── Airport Briefing Card ─────────────── */

function AirportBriefingCard({
  station,
  briefing,
  loading,
  error,
  expanded,
  onToggle,
  onRetry,
  label,
}: {
  station: string;
  briefing: any;
  loading: boolean;
  error?: string;
  expanded: boolean;
  onToggle: () => void;
  onRetry?: () => void;
  label?: string;
}) {
  const [detailTab, setDetailTab] = useState<"metar" | "taf" | "notam">(
    "metar"
  );

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 animate-pulse">
        <div className="flex items-center gap-3">
          {label && (
            <span className="text-xs font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
              {label}
            </span>
          )}
          <span className="text-lg font-bold font-mono">{station}</span>
          <span className="text-sm text-zinc-500">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-red-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {label && (
              <span className="text-xs font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                {label}
              </span>
            )}
            <span className="text-lg font-bold font-mono">{station}</span>
            <span className="text-sm text-red-400">{error}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs text-blue-400 hover:text-blue-300 border border-blue-400/30 px-2 py-1 rounded"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  const metar = briefing.metar;
  const taf = briefing.taf;
  const notams = briefing.notams || [];
  const category = metar?.category || "VFR";

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        CATEGORY_COLORS[category] || ""
      } ${CATEGORY_BG[category] || ""}`}
    >
      {/* 헤더 (항상 표시) */}
      <button onClick={onToggle} className="w-full p-3 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {label && (
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  label === "DEP"
                    ? "bg-blue-600/20 text-blue-400"
                    : "bg-amber-600/20 text-amber-400"
                }`}
              >
                {label}
              </span>
            )}
            <span className="text-lg font-bold font-mono">
              {briefing.station || station}
            </span>
            <span
              className={`text-xl font-black ${
                CATEGORY_COLORS[category] || ""
              }`}
            >
              {category}
            </span>
          </div>
          <span className="text-zinc-500 text-sm">
            {expanded ? "\u25B2" : "\u25BC"}
          </span>
        </div>
        {metar && (
          <div className="grid grid-cols-4 gap-2 mt-2 text-center">
            <MiniStat
              label="Temp"
              value={
                metar.temperature != null ? `${metar.temperature}\u00B0` : "\u2014"
              }
            />
            <MiniStat
              label="Wind"
              value={
                metar.wind_speed != null
                  ? `${metar.wind_direction}\u00B0/${metar.wind_speed}kt`
                  : "\u2014"
              }
            />
            <MiniStat
              label="Vis"
              value={
                metar.visibility != null ? `${metar.visibility}sm` : "\u2014"
              }
            />
            <MiniStat
              label="Ceil"
              value={
                metar.ceiling != null ? `${metar.ceiling}ft` : "CLR"
              }
            />
          </div>
        )}
        {briefing.airport && (
          <p className="text-xs text-zinc-400 mt-1">{briefing.airport.name}</p>
        )}
      </button>

      {/* 펼침 상세 */}
      {expanded && (
        <div className="border-t border-zinc-800/50 px-3 pb-3">
          {/* METAR / TAF / NOTAM 탭 */}
          <div className="flex gap-1 bg-zinc-900/50 rounded-lg p-1 mt-3">
            {(["metar", "taf", "notam"] as const).map((tab) => (
              <button
                key={tab}
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailTab(tab);
                }}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  detailTab === tab
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.toUpperCase()}
                {tab === "notam" && briefing.notam_critical_count > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs px-1 rounded-full">
                    {briefing.notam_critical_count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* METAR */}
          {detailTab === "metar" && metar && (
            <div className="space-y-2 mt-3">
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-xs text-zinc-500 mb-1">Raw METAR</p>
                <p className="text-sm font-mono leading-relaxed text-zinc-200 break-all">
                  {metar.raw}
                </p>
              </div>
              {metar.weather && (
                <div className="bg-zinc-900/50 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Weather</p>
                  <p className="text-sm font-mono text-amber-400">
                    {metar.weather}
                  </p>
                </div>
              )}
              {metar.clouds && metar.clouds.length > 0 && (
                <div className="bg-zinc-900/50 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Cloud Layers</p>
                  {metar.clouds.map((c: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between text-sm font-mono"
                    >
                      <span className="text-zinc-300">{c.cover}</span>
                      <span className="text-zinc-500">
                        {c.base ? `${c.base} ft` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-zinc-600 text-right">
                Updated:{" "}
                {new Date(metar.fetched_at * 1000).toLocaleTimeString()}
              </p>
            </div>
          )}

          {/* TAF */}
          {detailTab === "taf" && taf && (
            <div className="space-y-2 mt-3">
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-xs text-zinc-500 mb-1">Raw TAF</p>
                <p className="text-sm font-mono leading-relaxed text-zinc-200 break-all">
                  {taf.raw}
                </p>
              </div>
              {taf.forecasts && taf.forecasts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Forecast Periods</p>
                  {taf.forecasts.map((fc: any, i: number) => {
                    const fcCat = _determineFcCategory(fc);
                    return (
                      <div
                        key={i}
                        className={`bg-zinc-900/50 rounded-lg p-3 ${
                          CATEGORY_BG[fcCat] || ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-zinc-500 font-mono">
                            {fc.timeFrom || ""} {"\u2192"} {fc.timeTo || ""}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              CATEGORY_COLORS[fcCat] || ""
                            }`}
                          >
                            {fcCat}
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs font-mono text-zinc-400">
                          {fc.wdir != null && (
                            <span>
                              W {fc.wdir}\u00B0/{fc.wspd}kt
                            </span>
                          )}
                          {fc.visib != null && <span>V {fc.visib}sm</span>}
                          {fc.wxString && (
                            <span className="text-amber-400">
                              {fc.wxString}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-zinc-600 text-right">
                Updated:{" "}
                {new Date(taf.fetched_at * 1000).toLocaleTimeString()}
              </p>
            </div>
          )}

          {/* NOTAM */}
          {detailTab === "notam" && (
            <div className="space-y-2 mt-3">
              <p className="text-xs text-zinc-500">
                {notams.length} NOTAMs ({briefing.notam_critical_count}{" "}
                critical)
              </p>
              {notams.length === 0 ? (
                <div className="text-center py-4 text-zinc-500 text-sm">
                  No NOTAMs available
                </div>
              ) : (
                notams.map((n: any, i: number) => (
                  <div
                    key={i}
                    className={`bg-zinc-900/50 rounded-lg p-3 border ${
                      n.is_critical
                        ? "border-red-600 bg-red-900/10"
                        : "border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {n.is_critical && (
                        <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">
                          CRITICAL
                        </span>
                      )}
                      <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                        {n.category}
                      </span>
                      {n.id && (
                        <span className="text-xs text-zinc-600 font-mono">
                          {n.id}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-mono leading-relaxed text-zinc-300 break-all">
                      <HighlightedText text={n.text} />
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Helper Components ─────────────── */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-base font-mono font-bold">{value}</p>
    </div>
  );
}

function HighlightedText({ text }: { text: string }) {
  if (!text) return null;
  const regex = new RegExp(`\\b(${HIGHLIGHT_KEYWORDS.join("|")})\\b`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const isKeyword = HIGHLIGHT_KEYWORDS.some(
          (kw) => kw.toUpperCase() === part.toUpperCase()
        );
        return isKeyword ? (
          <span key={i} className="text-amber-400 font-bold">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

function _determineFcCategory(fc: any): string {
  const vis = fc.visib;
  const ceil = fc.clouds?.find(
    (c: any) => c.cover === "BKN" || c.cover === "OVC"
  )?.base;

  let cat = "VFR";
  if (ceil != null) {
    if (ceil < 500) cat = "LIFR";
    else if (ceil < 1000) cat = "IFR";
    else if (ceil <= 3000) cat = "MVFR";
  }
  if (vis != null) {
    if (vis < 1 && _catOrder(cat) < _catOrder("LIFR")) cat = "LIFR";
    else if (vis < 3 && _catOrder(cat) < _catOrder("IFR")) cat = "IFR";
    else if (vis <= 5 && _catOrder(cat) < _catOrder("MVFR")) cat = "MVFR";
  }
  return cat;
}

function _catOrder(cat: string): number {
  return { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 }[cat] || 0;
}
