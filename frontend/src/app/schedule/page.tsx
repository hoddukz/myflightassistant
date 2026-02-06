// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/schedule/page.tsx

"use client";

import { useState, useCallback } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";
import { uploadICS, uploadCSV } from "@/lib/api";
import { getEventTypeLabel, getEventTypeColor } from "@/lib/utils";
import type { Pairing, ScheduleResponse } from "@/types";

export default function SchedulePage() {
  const { pairings, setPairings, clearSchedule } = useScheduleStore();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPairing, setExpandedPairing] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        let data: ScheduleResponse;
        if (file.name.endsWith(".ics")) {
          data = await uploadICS(file);
        } else if (file.name.endsWith(".csv")) {
          // CSV는 별도 처리 (보조 데이터)
          await uploadCSV(file);
          setUploading(false);
          return;
        } else {
          throw new Error("Unsupported file type. Use .ics or .csv");
        }
        setPairings(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [setPairings]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-6">
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Schedule</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {pairings.length > 0
              ? `${pairings.length} events loaded`
              : "Upload your schedule"}
          </p>
        </div>
        {pairings.length > 0 && (
          <button
            onClick={clearSchedule}
            className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 px-3 py-1.5 rounded-lg"
          >
            Clear
          </button>
        )}
      </div>

      {/* Upload Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-400/10"
            : "border-zinc-700 hover:border-zinc-500"
        }`}
      >
        <input
          type="file"
          accept=".ics,.csv"
          onChange={handleInputChange}
          className="hidden"
          id="file-upload"
          disabled={uploading}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center gap-3"
        >
          <span className="text-3xl">{uploading ? "..." : "\u{1F4E4}"}</span>
          <span className="text-sm text-zinc-400">
            {uploading
              ? "Parsing schedule..."
              : "Drop .ics or .csv file here, or tap to browse"}
          </span>
        </label>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Timeline */}
      {pairings.length > 0 && (
        <div className="space-y-2">
          {pairings.map((p) => (
            <PairingCard
              key={p.pairing_id + p.start_utc}
              pairing={p}
              expanded={expandedPairing === p.pairing_id + p.start_utc}
              onToggle={() =>
                setExpandedPairing(
                  expandedPairing === p.pairing_id + p.start_utc
                    ? null
                    : p.pairing_id + p.start_utc
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PairingCard({
  pairing,
  expanded,
  onToggle,
}: {
  pairing: Pairing;
  expanded: boolean;
  onToggle: () => void;
}) {
  const startDate = new Date(pairing.start_utc).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endDate = new Date(pairing.end_utc).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded ${getEventTypeColor(
              pairing.event_type
            )} text-white`}
          >
            {getEventTypeLabel(pairing.event_type)}
          </span>
          <div>
            <p className="text-sm font-medium">{pairing.summary}</p>
            <p className="text-xs text-zinc-500">
              {startDate} - {endDate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pairing.total_block && (
            <span className="text-xs text-zinc-500">
              Blk {pairing.total_block}
            </span>
          )}
          <span className="text-zinc-500 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && pairing.days.length > 0 && (
        <div className="border-t border-zinc-800 px-4 pb-4">
          {pairing.days.map((day, di) => (
            <div key={di} className="mt-3">
              {/* Day Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-400">
                  {new Date(day.flight_date + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { weekday: "short", month: "short", day: "numeric" }
                  )}
                </span>
                {day.report_time && (
                  <span className="text-xs text-amber-400">
                    Report: {day.report_time}
                    {day.report_tz && (
                      <span className="text-zinc-500 ml-1">{day.report_tz}</span>
                    )}
                    {day.report_time_utc && (
                      <span className="text-zinc-500 ml-1">({day.report_time_utc}Z)</span>
                    )}
                  </span>
                )}
              </div>

              {/* Flight Legs */}
              {day.legs.map((leg, li) => (
                <div
                  key={li}
                  className={`ml-2 pl-3 border-l-2 ${
                    leg.is_deadhead ? "border-zinc-700" : "border-blue-600"
                  } py-3`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-blue-400">
                        {leg.flight_number}
                      </span>
                      {leg.ac_type && (
                        <span className="text-xs text-zinc-500">
                          {leg.ac_type}
                        </span>
                      )}
                      {leg.is_deadhead && (
                        <span className="text-xs bg-zinc-700 text-zinc-400 px-1 py-0.5 rounded">
                          DH
                        </span>
                      )}
                    </div>
                    {leg.tail_number && (
                      <a
                        href={`https://flightaware.com/live/flight/${leg.tail_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-400 hover:text-amber-300 font-mono"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {leg.tail_number} {"\u2197"}
                      </a>
                    )}
                  </div>
                  {/* Line 1: Airport codes + block time */}
                  <div className="flex items-center gap-2 mt-2 text-base">
                    <span className="font-bold">{leg.origin}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="font-bold">{leg.destination}</span>
                    {leg.block_time && (
                      <span className="text-xs text-zinc-600 ml-auto">
                        {leg.block_time}
                      </span>
                    )}
                  </div>
                  {/* Line 2: Times with timezone + UTC */}
                  <div className="flex items-center gap-2 mt-0.5 text-sm text-zinc-500">
                    <span>
                      {leg.depart_local}
                      {leg.depart_tz && (
                        <span className="text-zinc-600 text-xs ml-0.5">{leg.depart_tz}</span>
                      )}
                      {leg.depart_utc && (
                        <span className="text-zinc-600 text-xs ml-0.5">({leg.depart_utc}Z)</span>
                      )}
                    </span>
                    <span className="text-zinc-700">→</span>
                    <span>
                      {leg.arrive_local}
                      {leg.arrive_tz && (
                        <span className="text-zinc-600 text-xs ml-0.5">{leg.arrive_tz}</span>
                      )}
                      {leg.arrive_utc && (
                        <span className="text-zinc-600 text-xs ml-0.5">({leg.arrive_utc}Z)</span>
                      )}
                    </span>
                  </div>
                  {leg.crew.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {leg.crew.map((c, ci) => (
                        <span
                          key={ci}
                          className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded"
                        >
                          {c.position}: {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Layover */}
              {day.layover?.hotel_name && (
                <div className="ml-2 pl-3 border-l-2 border-purple-600 py-3 mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-purple-400">🏨</span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.layover.hotel_name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-zinc-300 hover:text-purple-300 underline underline-offset-2 decoration-zinc-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {day.layover.hotel_name}
                    </a>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {day.layover.hotel_phone && (
                      <a
                        href={`tel:${day.layover.hotel_phone.replace(/[^\d]/g, "")}`}
                        className="text-xs text-blue-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {day.layover.hotel_phone}
                      </a>
                    )}
                    {day.layover.layover_duration && (
                      <span className="text-xs text-zinc-500">
                        Layover: {day.layover.layover_duration}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Day Summary */}
              {day.duty_time && (
                <div className="ml-2 mt-1 flex gap-3 text-xs text-zinc-600">
                  {day.day_block && <span>Block: {day.day_block}</span>}
                  {day.day_credit && <span>Credit: {day.day_credit}</span>}
                  <span>Duty: {day.duty_time}</span>
                </div>
              )}
            </div>
          ))}

          {/* Trip Summary */}
          {pairing.tafb && (
            <div className="mt-3 pt-3 border-t border-zinc-800 flex gap-4 text-xs text-zinc-500">
              <span>TAFB: {pairing.tafb}</span>
              {pairing.total_block && (
                <span>Total Block: {pairing.total_block}</span>
              )}
              {pairing.total_credit && (
                <span>Total Credit: {pairing.total_credit}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
