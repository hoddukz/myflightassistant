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
  error: string | null;
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
  error: null,

  setPairings: (data) =>
    set({ pairings: data.pairings, totalFlights: data.total_flights }),

  setSelectedDate: (date) => set({ selectedDate: date }),

  clearSchedule: () => set({ pairings: [], totalFlights: 0 }),

  fetchSchedule: async () => {
    set({ loading: true, error: null });
    try {
      const data: ScheduleResponse = await apiFetchSchedule();
      set({ pairings: data.pairings, totalFlights: data.total_flights });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch schedule" });
    } finally {
      set({ loading: false });
    }
  },

  uploadSchedule: async (file: File) => {
    set({ loading: true, error: null });
    try {
      const data: ScheduleResponse = await uploadICS(file);
      set({ pairings: data.pairings, totalFlights: data.total_flights });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to upload schedule" });
    } finally {
      set({ loading: false });
    }
  },
}));
