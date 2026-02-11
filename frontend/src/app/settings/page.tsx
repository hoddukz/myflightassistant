// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/settings/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useNotesStore, type Note } from "@/stores/notesStore";
import { useScheduleStore } from "@/stores/scheduleStore";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore, type Theme } from "@/stores/settingsStore";
import { saveCalendarUrl, getCalendarUrl, deleteCalendarUrl, syncNow, uploadICS, uploadCSV, deleteSchedule, getVapidKey, subscribePush, unsubscribePush, sendTestPush, getReminderSettings, saveReminderSettings, getWeatherAlertSettings, saveWeatherAlertSettings } from "@/lib/api";
import type { ScheduleResponse } from "@/types";
import { toUtcDate } from "@/lib/utils";

type SettingsView = "main" | "schedule" | "utilities" | "notifications";
type PushStatus = "loading" | "enabled" | "disabled" | "unsupported";

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
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="material-icons text-zinc-500 text-lg">link</span>
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://calendar.google.com/...basic.ics"
            className="w-full bg-zinc-800 rounded-lg pl-10 pr-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
            disabled={loading || syncing}
          />
        </div>
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
            : "border-blue-400/40 bg-blue-400/5 hover:bg-blue-400/10"
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
          className="cursor-pointer flex flex-col items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-full bg-blue-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <span className="material-icons text-blue-400">{uploading ? "hourglass_empty" : "cloud_upload"}</span>
          </div>
          <span className="text-sm font-medium">
            {uploading ? "Parsing schedule..." : "Import Roster"}
          </span>
          <span className="text-xs text-zinc-500">
            {uploading ? "" : "Tap or drop .ics / .csv file"}
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
                  className="w-full bg-transparent px-3 py-2 text-sm text-foreground outline-none"
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
                  className="w-full bg-transparent px-3 py-2 text-sm text-foreground outline-none"
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
          className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-foreground outline-none resize-none placeholder:text-zinc-600"
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
              <p className="text-sm text-foreground whitespace-pre-wrap flex-1">{note.text}</p>
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
                ? "bg-zinc-700 text-foreground"
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

/* ── Push Main Row (settings main page) ── */
function PushMainRow({ onOpenDetail }: { onOpenDetail: () => void }) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setStatus(sub ? "enabled" : "disabled");
      });
    });
  }, []);

  const handleToggle = async () => {
    if (status === "loading" || status === "unsupported") return;
    setLoading(true);
    try {
      if (status === "disabled") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setLoading(false);
          return;
        }
        const vapidKeyStr = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || await getVapidKey();
        const padding = "=".repeat((4 - (vapidKeyStr.length % 4)) % 4);
        const base64 = (vapidKeyStr + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(base64);
        const vapidKeyBytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) vapidKeyBytes[i] = raw.charCodeAt(i);
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyBytes,
        });
        await subscribePush(subscription.toJSON());
        setStatus("enabled");
      } else {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();
        await unsubscribePush();
        setStatus("disabled");
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  if (status === "unsupported") {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-700/50 flex items-center justify-center">
            <span className="material-icons text-zinc-500 text-sm">notifications_off</span>
          </div>
          <p className="text-sm text-zinc-500">Push not supported in this browser</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
      {/* Push toggle row */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
            <span className="material-icons text-orange-400 text-sm">notifications</span>
          </div>
          <div>
            <p className="text-sm font-medium">Push Notifications</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {status === "loading" ? "Loading..." : status === "enabled" ? "Enabled" : "Disabled"}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading || status === "loading"}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            status === "enabled" ? "bg-blue-600" : "bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              status === "enabled" ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      {/* Notification settings → sub-view */}
      {status === "enabled" && (
        <button
          onClick={onOpenDetail}
          className="w-full p-4 flex items-center justify-between active:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <span className="material-icons text-blue-400 text-sm">tune</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Notification Settings</p>
              <p className="text-xs text-zinc-500 mt-0.5">Weather, reminders, test push</p>
            </div>
          </div>
          <span className="material-icons text-zinc-600 text-lg">chevron_right</span>
        </button>
      )}
    </div>
  );
}

/* ── Notifications Detail View ── */
function NotificationsDetailView() {
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const weatherAlerts = useSettingsStore((s) => s.weatherAlerts);
  const setWeatherAlerts = useSettingsStore((s) => s.setWeatherAlerts);
  const [weatherSaving, setWeatherSaving] = useState(false);

  useEffect(() => {
    getWeatherAlertSettings()
      .then((data) => setWeatherAlerts(data.weather_alerts_enabled))
      .catch(() => {});
  }, [setWeatherAlerts]);

  const handleTest = async () => {
    setError(null);
    setSuccess(null);
    setTestLoading(true);
    try {
      await sendTestPush();
      setSuccess("Test notification sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send test notification");
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Test Push */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
            <span className="material-icons text-blue-400 text-sm">send</span>
          </div>
          <div>
            <p className="text-sm font-medium">Test Notification</p>
            <p className="text-xs text-zinc-500 mt-0.5">Send a test push to verify setup</p>
          </div>
        </div>
        <button
          onClick={handleTest}
          disabled={testLoading}
          className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
        >
          {testLoading ? "Sending..." : "Send Test Push"}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-green-400">{success}</p>}
      </div>

      {/* Alert Types */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-1">Alert Types</h2>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
          {/* Weather Alerts */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <span className="material-icons text-amber-400 text-sm">cloud</span>
              </div>
              <div>
                <p className="text-sm font-medium">Weather Alerts</p>
                <p className="text-xs text-zinc-500 mt-0.5">Significant weather changes</p>
              </div>
            </div>
            <button
              disabled={weatherSaving}
              onClick={async () => {
                const next = !weatherAlerts;
                setWeatherAlerts(next);
                setWeatherSaving(true);
                try {
                  await saveWeatherAlertSettings(next);
                } catch {
                  setWeatherAlerts(!next);
                } finally {
                  setWeatherSaving(false);
                }
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                weatherAlerts ? "bg-blue-600" : "bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  weatherAlerts ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
          {/* Pre-departure Reminder */}
          <div className="p-4">
            <ReminderSection />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reminder Section ── */
const PRESETS = [
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
];

function ReminderSection() {
  const [enabled, setEnabled] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getReminderSettings()
      .then((data) => {
        setEnabled(data.reminder_enabled);
        setSelected(data.reminder_minutes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(
    async (newEnabled: boolean, newMinutes: number[]) => {
      setSaving(true);
      try {
        await saveReminderSettings(newEnabled, newMinutes);
      } catch {
        // 실패 시 무시
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    save(next, selected);
  };

  const togglePreset = (minutes: number) => {
    const next = selected.includes(minutes)
      ? selected.filter((m) => m !== minutes)
      : [...selected, minutes].sort((a, b) => a - b);
    setSelected(next);
    save(enabled, next);
  };

  const addCustom = () => {
    const val = parseInt(customInput, 10);
    if (isNaN(val) || val < 15 || val > 1440) return;
    if (selected.includes(val)) {
      setCustomInput("");
      return;
    }
    if (selected.length >= 5) return;
    const next = [...selected, val].sort((a, b) => a - b);
    setSelected(next);
    setCustomInput("");
    save(enabled, next);
  };

  const removeMinute = (minutes: number) => {
    const next = selected.filter((m) => m !== minutes);
    setSelected(next);
    save(enabled, next);
  };

  const formatMinutes = (m: number) => {
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return min ? `${h}h ${min}m` : `${h}h`;
    }
    return `${m}m`;
  };

  if (loading) {
    return <p className="text-xs text-zinc-500">Loading reminder settings...</p>;
  }

  return (
    <div className="space-y-3">
      {/* Master toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
            <span className="material-icons text-purple-400 text-sm">alarm</span>
          </div>
          <div>
            <p className="text-sm font-medium">Pre-departure Reminder</p>
            <p className="text-xs text-zinc-500 mt-0.5">Get notified before report time</p>
          </div>
        </div>
        <button
          onClick={toggleEnabled}
          disabled={saving}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          {/* Preset pills */}
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.minutes}
                onClick={() => togglePreset(p.minutes)}
                disabled={saving}
                className={`flex-1 py-2 rounded-full text-xs font-medium transition-colors ${
                  selected.includes(p.minutes)
                    ? "bg-blue-400 text-white border border-blue-400"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Custom (min)"
              min={15}
              max={1440}
              className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <button
              onClick={addCustom}
              disabled={saving || !customInput || selected.length >= 5}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
            >
              Add
            </button>
          </div>

          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-300 text-xs px-2.5 py-1 rounded-full"
                >
                  {formatMinutes(m)}
                  <button
                    onClick={() => removeMinute(m)}
                    className="text-zinc-500 hover:text-red-400 ml-0.5"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}

          {selected.length >= 5 && (
            <p className="text-xs text-zinc-500">Maximum 5 reminders</p>
          )}
        </>
      )}
    </div>
  );
}

/* ── Theme Toggle ── */
const themeOptions: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "light_mode" },
  { value: "auto", label: "Auto", icon: "brightness_auto" },
  { value: "dark", label: "Dark", icon: "dark_mode" },
];

function ThemeToggle() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-1">
      <div className="grid grid-cols-3 gap-1 bg-zinc-800 rounded-lg p-1">
        {themeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`flex items-center justify-center py-2 text-xs font-medium rounded-md transition-all ${
              theme === opt.value
                ? "bg-zinc-900 text-blue-400 shadow-sm ring-1 ring-white/10"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span className="material-icons text-base mr-1">{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>
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
        <span className="material-icons text-lg">chevron_left</span>
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
    <div className="space-y-6">
      {view === "main" && (
        <>
          <div className="pt-2">
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          </div>

          {/* Account Section (Top) */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-1">Account</h2>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
              {user && (
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-zinc-200">
                      {user.email?.charAt(0).toUpperCase() || "U"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                  </div>
                </div>
              )}
              <button
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
                className="w-full p-4 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-icons text-lg">logout</span>
                Sign Out
              </button>
            </div>
          </div>

          {/* Schedule Management */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-1">Schedule Management</h2>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
              <button
                onClick={() => setView("schedule")}
                className="w-full p-4 flex items-center justify-between active:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <span className="material-icons text-blue-400 text-sm">cloud_upload</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Roster</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Import roster, sync calendar</p>
                  </div>
                </div>
                <span className="material-icons text-zinc-600 text-lg">chevron_right</span>
              </button>
            </div>
          </div>

          {/* Tools */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-1">Tools</h2>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
              <button
                onClick={() => setView("utilities")}
                className="w-full p-4 flex items-center justify-between active:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <span className="material-icons text-blue-400 text-sm">calculate</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Utilities</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Unit converter, flight notes</p>
                  </div>
                </div>
                <span className="material-icons text-zinc-600 text-lg">chevron_right</span>
              </button>
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-1">Notifications</h2>
            <PushMainRow onOpenDetail={() => setView("notifications")} />
          </div>

          {/* Appearance */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-1">Appearance</h2>
            <ThemeToggle />
          </div>

          {/* Version */}
          <div className="py-2">
            <p className="text-xs text-zinc-500 text-center">MFA v1.0.0</p>
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

      {view === "notifications" && (
        <>
          <SubViewHeader title="Notifications" onBack={() => setView("main")} />
          <NotificationsDetailView />
        </>
      )}
    </div>
  );
}
