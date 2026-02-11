// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/lib/api.ts

import { supabase } from "@/lib/supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

/* ── Device ID ── */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("mfa-device-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("mfa-device-id", id);
  }
  return id;
}

/* ── Session expired handler (set by authStore) ── */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

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

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  };

  const deviceId = getDeviceId();
  if (deviceId) {
    headers["X-Device-ID"] = deviceId;
  }

  return headers;
}

/* ── 401 session_expired 감지 래퍼 ── */
async function handleResponse(res: Response) {
  if (res.status === 401) {
    const body = await safeJson(res);
    if (body?.detail === "session_expired" && onSessionExpired) {
      onSessionExpired();
    }
    throw new Error(body?.detail || "Unauthorized");
  }
  return res;
}

/* ── Session API ── */
export async function registerSession(): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/session/register`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      device_id: getDeviceId(),
      device_info: navigator.userAgent,
    }),
  });
  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Failed to register session");
  }
}

export async function heartbeatSession(): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/session/heartbeat`, {
    method: "POST",
    headers,
  });
  // heartbeat 실패는 조용히 무시
  if (res.status === 401) {
    const body = await safeJson(res);
    if (body?.detail === "session_expired" && onSessionExpired) {
      onSessionExpired();
    }
  }
}

export async function logoutSession(): Promise<void> {
  const headers = await getAuthHeaders();
  await fetch(`${API_BASE}/api/session/logout`, {
    method: "DELETE",
    headers,
  });
}

/* ── Schedule API ── */
export async function uploadICS(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const headers = await getAuthHeaders();

  const res = await handleResponse(
    await fetch(`${API_BASE}/api/schedule/upload/ics`, {
      method: "POST",
      headers,
      body: formData,
    })
  );

  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Failed to upload ICS file");
  }

  return safeJson(res);
}

export async function uploadCSV(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const headers = await getAuthHeaders();

  const res = await handleResponse(
    await fetch(`${API_BASE}/api/schedule/upload/csv`, {
      method: "POST",
      headers,
      body: formData,
    })
  );

  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Failed to upload CSV file");
  }

  return safeJson(res);
}

export async function fetchSchedule() {
  const headers = await getAuthHeaders();

  const res = await handleResponse(
    await fetch(`${API_BASE}/api/schedule`, {
      headers,
    })
  );

  if (!res.ok) {
    throw new Error("Failed to fetch schedule");
  }

  return safeJson(res);
}

export async function deleteSchedule() {
  const headers = await getAuthHeaders();

  const res = await handleResponse(
    await fetch(`${API_BASE}/api/schedule`, {
      method: "DELETE",
      headers,
    })
  );

  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Failed to delete schedule");
  }

  return safeJson(res);
}

export async function fetchFullBriefing(station: string) {
  const res = await fetch(`${API_BASE}/api/briefing/full/${station}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch briefing for ${station}`);
  }
  return safeJson(res);
}

export async function fetchAirSigmet(origin: string, destination: string) {
  const res = await fetch(
    `${API_BASE}/api/briefing/airsigmet?origin=${origin}&destination=${destination}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch SIGMET/AIRMET data");
  }
  return safeJson(res);
}

export async function fetchRouteBriefing(origin: string, destination: string) {
  const res = await fetch(
    `${API_BASE}/api/briefing/route?origin=${origin}&destination=${destination}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch route briefing");
  }
  return safeJson(res);
}

export async function saveCalendarUrl(icsUrl: string) {
  const headers = await getAuthHeaders();

  const res = await handleResponse(
    await fetch(`${API_BASE}/api/schedule/calendar-url`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ics_url: icsUrl }),
    })
  );

  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Failed to save calendar URL");
  }

  return safeJson(res);
}

export async function getCalendarUrl() {
  const headers = await getAuthHeaders();

  const res = await handleResponse(
    await fetch(`${API_BASE}/api/schedule/calendar-url`, {
      headers,
    })
  );

  if (!res.ok) {
    throw new Error("Failed to fetch calendar URL");
  }

  return safeJson(res);
}

export async function deleteCalendarUrl() {
  const headers = await getAuthHeaders();

  const res = await handleResponse(
    await fetch(`${API_BASE}/api/schedule/calendar-url`, {
      method: "DELETE",
      headers,
    })
  );

  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Failed to delete calendar URL");
  }

  return safeJson(res);
}

export async function fetchSyncStatus() {
  const headers = await getAuthHeaders();

  const res = await fetch(`${API_BASE}/api/schedule/sync-status`, {
    headers,
  });

  if (!res.ok) return null;
  return safeJson(res);
}

export async function syncNow() {
  const headers = await getAuthHeaders();

  const res = await handleResponse(
    await fetch(`${API_BASE}/api/schedule/sync-now`, {
      method: "POST",
      headers,
    })
  );

  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Sync failed");
  }

  return safeJson(res);
}

/* ── Flight API ── */
export async function fetchFlightTrack({
  tail_number,
  flight_number,
  provider,
  destination,
}: {
  tail_number?: string;
  flight_number?: string;
  provider?: string;
  destination?: string;
}) {
  const params = new URLSearchParams();
  if (tail_number) params.set("tail_number", tail_number);
  if (flight_number) params.set("flight_number", flight_number);
  if (provider) params.set("provider", provider);
  if (destination) params.set("destination", destination);

  const res = await fetch(`${API_BASE}/api/flight/track?${params.toString()}`);
  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Failed to fetch flight track");
  }
  return safeJson(res);
}

export async function fetchTrackerStatus() {
  const res = await fetch(`${API_BASE}/api/flight/status`);
  if (!res.ok) {
    throw new Error("Failed to fetch tracker status");
  }
  return safeJson(res);
}

/* ── Push API ── */
export async function getVapidKey(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/push/vapid-key`);
  if (!res.ok) {
    throw new Error("Failed to fetch VAPID key");
  }
  const data = await safeJson(res);
  return data.public_key;
}

export async function subscribePush(subscription: PushSubscriptionJSON): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await handleResponse(
    await fetch(`${API_BASE}/api/push/subscribe`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    })
  );
  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Failed to subscribe push");
  }
}

export async function unsubscribePush(): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await handleResponse(
    await fetch(`${API_BASE}/api/push/subscribe`, {
      method: "DELETE",
      headers,
    })
  );
  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Failed to unsubscribe push");
  }
}

export async function sendTestPush(): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await handleResponse(
    await fetch(`${API_BASE}/api/push/test`, {
      method: "POST",
      headers,
    })
  );
  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Failed to send test push");
  }
}

export async function getReminderSettings(): Promise<{
  reminder_enabled: boolean;
  reminder_minutes: number[];
}> {
  const headers = await getAuthHeaders();
  const res = await handleResponse(
    await fetch(`${API_BASE}/api/push/reminder-settings`, {
      headers,
    })
  );
  if (!res.ok) {
    throw new Error("Failed to fetch reminder settings");
  }
  return safeJson(res);
}

export async function saveReminderSettings(
  enabled: boolean,
  minutes: number[]
): Promise<{ reminder_enabled: boolean; reminder_minutes: number[] }> {
  const headers = await getAuthHeaders();
  const res = await handleResponse(
    await fetch(`${API_BASE}/api/push/reminder-settings`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ reminder_enabled: enabled, reminder_minutes: minutes }),
    })
  );
  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Failed to save reminder settings");
  }
  return safeJson(res);
}

export async function getWeatherAlertSettings(): Promise<{
  weather_alerts_enabled: boolean;
}> {
  const headers = await getAuthHeaders();
  const res = await handleResponse(
    await fetch(`${API_BASE}/api/push/weather-alert-settings`, {
      headers,
    })
  );
  if (!res.ok) {
    throw new Error("Failed to fetch weather alert settings");
  }
  return safeJson(res);
}

export async function saveWeatherAlertSettings(
  enabled: boolean
): Promise<{ weather_alerts_enabled: boolean }> {
  const headers = await getAuthHeaders();
  const res = await handleResponse(
    await fetch(`${API_BASE}/api/push/weather-alert-settings`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ weather_alerts_enabled: enabled }),
    })
  );
  if (!res.ok) {
    const error = await safeJson(res);
    throw new Error(error?.detail || "Failed to save weather alert settings");
  }
  return safeJson(res);
}
