// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/stores/scheduleStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Pairing, ScheduleResponse } from "@/types";

interface ScheduleState {
  pairings: Pairing[];
  totalFlights: number;
  selectedDate: string | null;
  setPairings: (data: ScheduleResponse) => void;
  setSelectedDate: (date: string | null) => void;
  clearSchedule: () => void;
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set) => ({
      pairings: [],
      totalFlights: 0,
      selectedDate: null,
      setPairings: (data) =>
        set({ pairings: data.pairings, totalFlights: data.total_flights }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      clearSchedule: () => set({ pairings: [], totalFlights: 0 }),
    }),
    { name: "mfa-schedule" }
  )
);
