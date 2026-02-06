// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/stores/settingsStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TempUnit = "C" | "F";
export type PressureUnit = "inHg" | "hPa";
export type AltitudeUnit = "ft" | "m";
export type TimezoneDisplay = "dual" | "utc" | "local";

interface SettingsState {
  tempUnit: TempUnit;
  pressureUnit: PressureUnit;
  altitudeUnit: AltitudeUnit;
  timezoneDisplay: TimezoneDisplay;
  setTempUnit: (unit: TempUnit) => void;
  setPressureUnit: (unit: PressureUnit) => void;
  setAltitudeUnit: (unit: AltitudeUnit) => void;
  setTimezoneDisplay: (display: TimezoneDisplay) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      tempUnit: "C",
      pressureUnit: "inHg",
      altitudeUnit: "ft",
      timezoneDisplay: "dual",
      setTempUnit: (unit) => set({ tempUnit: unit }),
      setPressureUnit: (unit) => set({ pressureUnit: unit }),
      setAltitudeUnit: (unit) => set({ altitudeUnit: unit }),
      setTimezoneDisplay: (display) => set({ timezoneDisplay: display }),
    }),
    { name: "mfa-settings" }
  )
);
