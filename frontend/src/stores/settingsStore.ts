// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/stores/settingsStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TempUnit = "C" | "F";
export type PressureUnit = "inHg" | "hPa";
export type AltitudeUnit = "ft" | "m";
export type TimezoneDisplay = "dual" | "utc" | "local";
export type Theme = "dark" | "light";

interface SettingsState {
  tempUnit: TempUnit;
  pressureUnit: PressureUnit;
  altitudeUnit: AltitudeUnit;
  timezoneDisplay: TimezoneDisplay;
  theme: Theme;
  disclaimerAccepted: boolean;
  setTempUnit: (unit: TempUnit) => void;
  setPressureUnit: (unit: PressureUnit) => void;
  setAltitudeUnit: (unit: AltitudeUnit) => void;
  setTimezoneDisplay: (display: TimezoneDisplay) => void;
  setTheme: (theme: Theme) => void;
  setDisclaimerAccepted: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      tempUnit: "C",
      pressureUnit: "inHg",
      altitudeUnit: "ft",
      timezoneDisplay: "dual",
      theme: "dark",
      disclaimerAccepted: false,
      setTempUnit: (unit) => set({ tempUnit: unit }),
      setPressureUnit: (unit) => set({ pressureUnit: unit }),
      setAltitudeUnit: (unit) => set({ altitudeUnit: unit }),
      setTimezoneDisplay: (display) => set({ timezoneDisplay: display }),
      setTheme: (theme) => set({ theme }),
      setDisclaimerAccepted: (v) => set({ disclaimerAccepted: v }),
    }),
    { name: "mfa-settings" }
  )
);
