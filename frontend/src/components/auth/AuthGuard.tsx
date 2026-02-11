// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/components/auth/AuthGuard.tsx

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useScheduleStore } from "@/stores/scheduleStore";
import { useActivityTracker } from "@/hooks/useActivityTracker";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, initialize } = useAuthStore();
  const fetchSchedule = useScheduleStore((s) => s.fetchSchedule);

  useActivityTracker();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
    if (!loading && user) {
      fetchSchedule();
    }
  }, [loading, user, router, fetchSchedule]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
