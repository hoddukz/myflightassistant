// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/lib/api.ts

import { supabase } from "@/lib/supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function uploadICS(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const headers = await getAuthHeaders();

  const res = await fetch(`${API_BASE}/api/schedule/upload/ics`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to upload ICS file");
  }

  return res.json();
}

export async function uploadCSV(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const headers = await getAuthHeaders();

  const res = await fetch(`${API_BASE}/api/schedule/upload/csv`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to upload CSV file");
  }

  return res.json();
}

export async function fetchSchedule() {
  const headers = await getAuthHeaders();

  const res = await fetch(`${API_BASE}/api/schedule`, {
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to fetch schedule");
  }

  return res.json();
}

export async function fetchFullBriefing(station: string) {
  const res = await fetch(`${API_BASE}/api/briefing/full/${station}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch briefing for ${station}`);
  }
  return res.json();
}

export async function fetchRouteBriefing(origin: string, destination: string) {
  const res = await fetch(
    `${API_BASE}/api/briefing/route?origin=${origin}&destination=${destination}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch route briefing");
  }
  return res.json();
}
