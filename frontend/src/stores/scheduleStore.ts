// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/stores/scheduleStore.ts

import { create } from "zustand";
import type { Pairing, ScheduleResponse } from "@/types";
import { fetchSchedule as apiFetchSchedule, uploadICS } from "@/lib/api";

interface ScheduleState {
  pairings: Pairing[];
  totalFlights: number;
  selectedDate: string | null;
  loading: boolean;
  setPairings: (data: ScheduleResponse) => void;
  setSelectedDate: (date: string | null) => void;
  clearSchedule: () => void;
  fetchSchedule: () => Promise<void>;
  uploadSchedule: (file: File) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>()((set) => ({
  pairings: [],
  totalFlights: 0,
  selectedDate: null,
  loading: false,

  setPairings: (data) =>
    set({ pairings: data.pairings, totalFlights: data.total_flights }),

  setSelectedDate: (date) => set({ selectedDate: date }),

  clearSchedule: () => set({ pairings: [], totalFlights: 0 }),

  fetchSchedule: async () => {
    set({ loading: true });
    try {
      const data: ScheduleResponse = await apiFetchSchedule();
      console.log("[scheduleStore] API returned:", data.pairings.length, "pairings,", data.total_flights, "flights");
      set({ pairings: data.pairings, totalFlights: data.total_flights });
    } catch (err) {
      console.error("[scheduleStore] fetchSchedule failed:", err);
    } finally {
      set({ loading: false });
    }
  },

  uploadSchedule: async (file: File) => {
    set({ loading: true });
    try {
      const data: ScheduleResponse = await uploadICS(file);
      set({ pairings: data.pairings, totalFlights: data.total_flights });
    } finally {
      set({ loading: false });
    }
  },
}));
