// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/stores/notesStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Note {
  id: string;
  text: string;
  createdAt: string;
  flightNumber: string | null;
  origin: string | null;
  destination: string | null;
  localTime: string;
  utcTime: string;
}

interface NotesState {
  notes: Note[];
  addNote: (note: Note) => void;
  deleteNote: (id: string) => void;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: [],
      addNote: (note) =>
        set((state) => ({ notes: [note, ...state.notes] })),
      deleteNote: (id) =>
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),
    }),
    { name: "mfa-notes" }
  )
);
