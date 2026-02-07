// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/lib/api.ts

import { supabase } from "@/lib/supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function getAuthHeaders(): Promise<Record<string, string>> {
  let {
    data: { session },
  } = await supabase.auth.getSession();

  // 세션이 없거나 access_token 만료 시 refresh 시도
  if (!session?.access_token) {
    const { data } = await supabase.auth.refreshSession();
    session = data.session;
  } else {
    // JWT exp 체크: 만료 60초 전이면 미리 갱신
    try {
      const payload = JSON.parse(atob(session.access_token.split(".")[1]));
      if (payload.exp && payload.exp * 1000 < Date.now() + 60_000) {
        const { data } = await supabase.auth.refreshSession();
        if (data.session) session = data.session;
      }
    } catch {
      // JWT 디코딩 실패 시 기존 토큰 사용
    }
  }

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

export async function saveCalendarUrl(icsUrl: string) {
  const headers = await getAuthHeaders();

  const res = await fetch(`${API_BASE}/api/schedule/calendar-url`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ics_url: icsUrl }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to save calendar URL");
  }

  return res.json();
}

export async function getCalendarUrl() {
  const headers = await getAuthHeaders();

  const res = await fetch(`${API_BASE}/api/schedule/calendar-url`, {
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to fetch calendar URL");
  }

  return res.json();
}

export async function deleteCalendarUrl() {
  const headers = await getAuthHeaders();

  const res = await fetch(`${API_BASE}/api/schedule/calendar-url`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to delete calendar URL");
  }

  return res.json();
}

export async function fetchSyncStatus() {
  const headers = await getAuthHeaders();

  const res = await fetch(`${API_BASE}/api/schedule/sync-status`, {
    headers,
  });

  if (!res.ok) return null;
  return res.json();
}

export async function syncNow() {
  const headers = await getAuthHeaders();

  const res = await fetch(`${API_BASE}/api/schedule/sync-now`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Sync failed");
  }

  return res.json();
}
