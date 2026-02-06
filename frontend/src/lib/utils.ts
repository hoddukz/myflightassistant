// Tag: util
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/lib/utils.ts

import { format, toZonedTime } from "date-fns-tz";

export function formatUTC(date: Date): string {
  return format(toZonedTime(date, "UTC"), "HH:mm", { timeZone: "UTC" });
}

export function formatLocal(date: Date, tz: string): string {
  return format(toZonedTime(date, tz), "HH:mm", { timeZone: tz });
}

export function formatDateUTC(date: Date): string {
  return format(toZonedTime(date, "UTC"), "dd MMM yyyy", { timeZone: "UTC" });
}

export function getEventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    pairing: "TRIP",
    njm: "OFF",
    mov: "MOV",
    vac: "VAC",
    training: "TRN",
    other: "OTHER",
  };
  return labels[type] || type.toUpperCase();
}

export function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    pairing: "bg-blue-600",
    njm: "bg-emerald-700",
    mov: "bg-amber-600",
    vac: "bg-purple-600",
    training: "bg-cyan-600",
    other: "bg-gray-600",
  };
  return colors[type] || "bg-gray-600";
}

export function getTailTrackingUrl(tailNumber: string): string {
  return `https://flightaware.com/live/flight/${tailNumber}`;
}

export function getFlightAwareUrl(tailNumber: string): string {
  return `https://www.flightaware.com/live/flight/${tailNumber}`;
}
