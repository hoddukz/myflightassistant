// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/app/settings/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useSettingsStore,
  type TempUnit,
  type PressureUnit,
  type AltitudeUnit,
  type TimezoneDisplay,
} from "@/stores/settingsStore";
import { useNotesStore, type Note } from "@/stores/notesStore";
import { useScheduleStore } from "@/stores/scheduleStore";
import { useAuthStore } from "@/stores/authStore";

type Tab = "settings" | "converter" | "notes";

/* ── Toggle Group ── */
function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 mt-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            value === opt.value
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ── Settings Tab ── */
function SettingsTab() {
  const {
    tempUnit, pressureUnit, altitudeUnit, timezoneDisplay,
    setTempUnit, setPressureUnit, setAltitudeUnit, setTimezoneDisplay,
  } = useSettingsStore();

  return (
    <div className="space-y-3">
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <p className="text-sm font-medium">Temperature</p>
        <ToggleGroup<TempUnit>
          options={[
            { label: "\u00B0C", value: "C" },
            { label: "\u00B0F", value: "F" },
          ]}
          value={tempUnit}
          onChange={setTempUnit}
        />
      </div>
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <p className="text-sm font-medium">Pressure</p>
        <ToggleGroup<PressureUnit>
          options={[
            { label: "inHg", value: "inHg" },
            { label: "hPa", value: "hPa" },
          ]}
          value={pressureUnit}
          onChange={setPressureUnit}
        />
      </div>
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <p className="text-sm font-medium">Altitude</p>
        <ToggleGroup<AltitudeUnit>
          options={[
            { label: "ft", value: "ft" },
            { label: "m", value: "m" },
          ]}
          value={altitudeUnit}
          onChange={setAltitudeUnit}
        />
      </div>
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <p className="text-sm font-medium">Timezone Display</p>
        <ToggleGroup<TimezoneDisplay>
          options={[
            { label: "UTC + Local", value: "dual" },
            { label: "UTC Only", value: "utc" },
            { label: "Local Only", value: "local" },
          ]}
          value={timezoneDisplay}
          onChange={setTimezoneDisplay}
        />
      </div>
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <p className="text-sm font-medium">Theme</p>
        <p className="text-xs text-zinc-500 mt-2">Cockpit Mode (Dark)</p>
      </div>
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <p className="text-sm font-medium">Version</p>
        <p className="text-xs text-zinc-500 mt-2">MFA v0.1.0</p>
      </div>
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
          const depTime = new Date(`${d.flight_date}T${leg.depart_utc}:00Z`);
          const arrTime = new Date(`${d.flight_date}T${leg.arrive_utc}:00Z`);
          // arrive가 depart보다 작으면 자정 넘김 → arrive를 다음날로
          const arrAdj = arrTime.getTime() < depTime.getTime()
            ? new Date(arrTime.getTime() + 24 * 60 * 60 * 1000)
            : arrTime;
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

/* ── Main Page ── */
export default function SettingsPage() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("settings");

  const tabs: { key: Tab; label: string }[] = [
    { key: "settings", label: "Settings" },
    { key: "converter", label: "Converter" },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div className="space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 border border-zinc-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" && <SettingsTab />}
      {tab === "converter" && <ConverterTab />}
      {tab === "notes" && <NotesTab />}

      {/* Account */}
      <div className="pt-4 space-y-3">
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
