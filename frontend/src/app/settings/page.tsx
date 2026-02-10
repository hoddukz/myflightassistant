// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/settings/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useNotesStore, type Note } from "@/stores/notesStore";
import { useScheduleStore } from "@/stores/scheduleStore";
import { useAuthStore } from "@/stores/authStore";
import { saveCalendarUrl, getCalendarUrl, deleteCalendarUrl, syncNow, uploadICS, uploadCSV, deleteSchedule } from "@/lib/api";
import type { ScheduleResponse } from "@/types";
import { toUtcDate } from "@/lib/utils";

type SettingsView = "main" | "schedule" | "utilities";

/* ── Calendar Sync Section ── */
function CalendarSyncSection() {
  const [url, setUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { fetchSchedule } = useScheduleStore();

  const loadCalendarUrl = useCallback(async () => {
    try {
      const data = await getCalendarUrl();
      if (data) {
        setSavedUrl(data.ics_url);
        setUrl(data.ics_url);
        setLastSynced(data.last_synced_at);
        setSyncEnabled(data.sync_enabled);
      }
    } catch {
      // 등록된 URL 없음
    }
  }, []);

  useEffect(() => {
    loadCalendarUrl();
  }, [loadCalendarUrl]);

  const handleSave = async () => {
    if (!url.trim()) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const data = await saveCalendarUrl(url.trim());
      setSavedUrl(data.ics_url);
      setLastSynced(data.last_synced_at);
      setSyncEnabled(data.sync_enabled);
      setSuccess("Calendar URL saved and synced");
      await fetchSchedule();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save URL");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setError(null);
    setSuccess(null);
    setSyncing(true);
    try {
      await syncNow();
      setSuccess("Sync completed");
      await loadCalendarUrl();
      await fetchSchedule();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await deleteCalendarUrl();
      setSavedUrl(null);
      setUrl("");
      setLastSynced(null);
      setSyncEnabled(false);
      setSuccess("Calendar URL removed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete URL");
    } finally {
      setLoading(false);
    }
  };

  const formatSyncTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
      <p className="text-sm font-medium">Calendar Sync</p>
      <p className="text-xs text-zinc-500">
        Enter your Google Calendar private iCal URL to auto-sync your schedule.
      </p>

      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendar.google.com/...basic.ics"
          className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
          disabled={loading || syncing}
        />
        <button
          onClick={handleSave}
          disabled={loading || syncing || !url.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          {loading ? "..." : "Save"}
        </button>
      </div>

      {savedUrl && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-zinc-400">Connected</span>
            </div>
            {lastSynced && (
              <span className="text-xs text-zinc-500">
                Last sync: {formatSyncTime(lastSynced)}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSyncNow}
              disabled={syncing || loading}
              className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
            <button
              onClick={handleDelete}
              disabled={loading || syncing}
              className="px-4 py-2 border border-red-400/30 text-red-400 hover:bg-red-400/10 disabled:opacity-50 text-sm font-medium rounded-lg transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      {success && (
        <p className="text-xs text-green-400">{success}</p>
      )}
    </div>
  );
}

/* ── Schedule Management Tab ── */
function ScheduleManageTab() {
  const { pairings, setPairings, clearSchedule, fetchSchedule } = useScheduleStore();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        if (file.name.endsWith(".ics")) {
          const data: ScheduleResponse = await uploadICS(file);
          setPairings(data);
        } else if (file.name.endsWith(".csv")) {
          await uploadCSV(file);
          await fetchSchedule();
        } else {
          throw new Error("Unsupported file type. Use .ics or .csv");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [setPairings, fetchSchedule]
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
    <div className="space-y-3">
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
          id="schedule-upload"
          disabled={uploading}
        />
        <label
          htmlFor="schedule-upload"
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

      {/* Divider */}
      <div className="flex items-center gap-2 pt-1">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-xs text-zinc-600">OR</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      {/* Calendar Sync */}
      <CalendarSyncSection />

      {/* Schedule Info */}
      {pairings.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{pairings.length} events loaded</p>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 px-3 py-1.5 rounded-lg"
            >
              Clear Schedule
            </button>
          </div>
        </div>
      )}

      {/* Clear Confirm Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-white">Clear Schedule</h3>
            <p className="text-sm text-zinc-400 mt-2">
              Are you sure you want to clear your schedule? This cannot be undone.
            </p>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setClearing(true);
                  try {
                    await deleteSchedule();
                    clearSchedule();
                    setShowClearConfirm(false);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed to clear schedule");
                    setShowClearConfirm(false);
                  } finally {
                    setClearing(false);
                  }
                }}
                disabled={clearing}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:text-red-300 rounded-lg transition-colors font-medium"
              >
                {clearing ? "Clearing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Converter Tab ── */
const converters = [
  { label: "Temperature", from: "\u00B0C", to: "\u00B0F", fwd: (v: number) => v * 9 / 5 + 32, rev: (v: number) => (v - 32) * 5 / 9 },
  { label: "Pressure", from: "inHg", to: "hPa", fwd: (v: number) => v * 33.8639, rev: (v: number) => v / 33.8639 },
  { label: "Altitude", from: "ft", to: "m", fwd: (v: number) => v * 0.3048, rev: (v: number) => v / 0.3048 },
  { label: "Distance (nm/km)", from: "nm", to: "km", fwd: (v: number) => v * 1.852, rev: (v: number) => v / 1.852 },
  { label: "Distance (nm/sm)", from: "nm", to: "sm", fwd: (v: number) => v * 1.15078, rev: (v: number) => v / 1.15078 },
  { label: "Speed (kt/km/h)", from: "kt", to: "km/h", fwd: (v: number) => v * 1.852, rev: (v: number) => v / 1.852 },
  { label: "Speed (kt/mph)", from: "kt", to: "mph", fwd: (v: number) => v * 1.15078, rev: (v: number) => v / 1.15078 },
  { label: "Weight", from: "lbs", to: "kg", fwd: (v: number) => v * 0.453592, rev: (v: number) => v / 0.453592 },
];

function ConverterTab() {
  const [values, setValues] = useState<Record<string, { left: string; right: string }>>(
    () => Object.fromEntries(converters.map((c) => [c.label, { left: "", right: "" }]))
  );

  const handleLeft = (label: string, val: string, fwd: (v: number) => number) => {
    const num = parseFloat(val);
    setValues((prev) => ({
      ...prev,
      [label]: {
        left: val,
        right: val === "" || isNaN(num) ? "" : fwd(num).toFixed(2),
      },
    }));
  };

  const handleRight = (label: string, val: string, rev: (v: number) => number) => {
    const num = parseFloat(val);
    setValues((prev) => ({
      ...prev,
      [label]: {
        left: val === "" || isNaN(num) ? "" : rev(num).toFixed(2),
        right: val,
      },
    }));
  };

  return (
    <div className="space-y-3">
      {converters.map((c) => (
        <div key={c.label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <p className="text-sm font-medium mb-2">{c.label}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center bg-zinc-800 rounded-lg overflow-hidden">
                <input
                  type="number"
                  inputMode="decimal"
                  value={values[c.label]?.left ?? ""}
                  onChange={(e) => handleLeft(c.label, e.target.value, c.fwd)}
                  className="w-full bg-transparent px-3 py-2 text-sm text-white outline-none"
                  placeholder="0"
                />
                <span className="text-xs text-zinc-400 pr-3 whitespace-nowrap">{c.from}</span>
              </div>
            </div>
            <span className="text-zinc-600 text-sm">=</span>
            <div className="flex-1">
              <div className="flex items-center bg-zinc-800 rounded-lg overflow-hidden">
                <input
                  type="number"
                  inputMode="decimal"
                  value={values[c.label]?.right ?? ""}
                  onChange={(e) => handleRight(c.label, e.target.value, c.rev)}
                  className="w-full bg-transparent px-3 py-2 text-sm text-white outline-none"
                  placeholder="0"
                />
                <span className="text-xs text-zinc-400 pr-3 whitespace-nowrap">{c.to}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Notes Tab ── */
function NotesTab() {
  const { notes, addNote, deleteNote } = useNotesStore();
  const { pairings } = useScheduleStore();
  const [text, setText] = useState("");

  const getCurrentLeg = () => {
    const now = new Date();
    const nowUtc = now.getTime();
    for (const p of pairings) {
      if (p.event_type !== "pairing") continue;
      if (new Date(p.start_utc).getTime() > nowUtc || new Date(p.end_utc).getTime() < nowUtc) continue;
      for (const d of p.days) {
        for (const leg of d.legs) {
          // UTC 시간이 없으면 레그 판정 불가 → 스킵
          if (!leg.depart_utc || !leg.arrive_utc) continue;
          const depTime = toUtcDate(leg.depart_utc, d.flight_date);
          const arrAdj = toUtcDate(leg.arrive_utc, d.flight_date);
          const windowStart = new Date(depTime.getTime() - 60 * 60 * 1000);
          if (nowUtc >= windowStart.getTime() && nowUtc <= arrAdj.getTime()) {
            return leg;
          }
          if (nowUtc < depTime.getTime()) {
            return leg;
          }
        }
      }
    }
    return null;
  };

  const handleAdd = () => {
    if (!text.trim()) return;
    const now = new Date();
    const leg = getCurrentLeg();

    const note: Note = {
      id: Date.now().toString(),
      text: text.trim(),
      createdAt: now.toISOString(),
      flightNumber: leg?.flight_number ?? null,
      origin: leg?.origin ?? null,
      destination: leg?.destination ?? null,
      localTime: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      utcTime: now.toISOString().slice(11, 16),
    };
    addNote(note);
    setText("");
  };

  return (
    <div className="space-y-3">
      {/* Input */}
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a note..."
          rows={3}
          className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none placeholder:text-zinc-600"
        />
        <button
          onClick={handleAdd}
          disabled={!text.trim()}
          className="mt-2 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          Add Note
        </button>
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        <p className="text-center text-zinc-600 text-sm py-8">No notes yet</p>
      ) : (
        notes.map((note) => (
          <div key={note.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-zinc-200 whitespace-pre-wrap flex-1">{note.text}</p>
              <button
                onClick={() => deleteNote(note.id)}
                className="text-zinc-600 hover:text-red-400 text-xs shrink-0"
              >
                X
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {note.flightNumber && (
                <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded font-mono">
                  {note.flightNumber} {note.origin}&rarr;{note.destination}
                </span>
              )}
              <span className="text-xs text-zinc-500">
                {note.localTime} L / {note.utcTime}Z
              </span>
              <span className="text-xs text-zinc-600">
                {new Date(note.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ── Utilities View (Converter + Notes) ── */
function UtilitiesView() {
  const [activeTab, setActiveTab] = useState<"converter" | "notes">("converter");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 border border-zinc-800">
        {(["converter", "notes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "converter" ? "Converter" : "Notes"}
          </button>
        ))}
      </div>
      {activeTab === "converter" && <ConverterTab />}
      {activeTab === "notes" && <NotesTab />}
    </div>
  );
}

/* ── Sub-view Header ── */
function SubViewHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="pt-2 flex items-center gap-3">
      <button
        onClick={onBack}
        className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 className="text-xl font-bold">{title}</h1>
    </div>
  );
}

/* ── Main Page ── */
export default function SettingsPage() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const [view, setView] = useState<SettingsView>("main");

  return (
    <div className="flex flex-col min-h-[calc(100dvh-5rem)]">
      <div className="flex-1 space-y-4">
        {view === "main" && (
          <>
            <div className="pt-2">
              <h1 className="text-xl font-bold">Settings</h1>
            </div>

            <div className="space-y-2">
              {/* Schedule Management */}
              <button
                onClick={() => setView("schedule")}
                className="w-full bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center justify-between active:bg-zinc-800 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-medium">Schedule Management</p>
                  <p className="text-xs text-zinc-500 mt-1">Upload, sync, and manage schedule</p>
                </div>
                <span className="text-zinc-600 text-sm">{"\u203A"}</span>
              </button>

              {/* Utilities */}
              <button
                onClick={() => setView("utilities")}
                className="w-full bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center justify-between active:bg-zinc-800 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-medium">Utilities</p>
                  <p className="text-xs text-zinc-500 mt-1">Unit converter, flight notes</p>
                </div>
                <span className="text-zinc-600 text-sm">{"\u203A"}</span>
              </button>

              {/* Theme */}
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-zinc-500 mt-1">Cockpit Mode (Dark)</p>
              </div>

              {/* Version */}
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <p className="text-sm font-medium">Version</p>
                <p className="text-xs text-zinc-500 mt-1">MFA v0.1.0</p>
              </div>
            </div>
          </>
        )}

        {view === "schedule" && (
          <>
            <SubViewHeader title="Schedule" onBack={() => setView("main")} />
            <ScheduleManageTab />
          </>
        )}

        {view === "utilities" && (
          <>
            <SubViewHeader title="Utilities" onBack={() => setView("main")} />
            <UtilitiesView />
          </>
        )}
      </div>

      {/* Account - always at bottom */}
      <div className="pt-4 pb-2 space-y-3">
        {user && (
          <p className="text-xs text-zinc-600 text-center">{user.email}</p>
        )}
        <button
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
          className="w-full bg-zinc-900 border border-zinc-800 text-red-400 hover:bg-zinc-800 text-sm font-medium py-3 rounded-xl transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
