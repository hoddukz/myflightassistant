// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/hooks/useActivityTracker.ts

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { heartbeatSession } from "@/lib/api";

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5분
const INACTIVITY_LIMIT = 30 * 60 * 1000;  // 30분

export function useActivityTracker() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const lastActivityRef = useRef(Date.now());
  const hadActivityRef = useRef(false);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    hadActivityRef.current = true;
  }, []);

  useEffect(() => {
    if (!user) return;

    const events = ["mousemove", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));

    // Heartbeat: 5분 간격, 활동 있었을 때만
    const heartbeatTimer = setInterval(async () => {
      const idle = Date.now() - lastActivityRef.current;

      // 30분 비활동 → 자동 로그아웃
      if (idle >= INACTIVITY_LIMIT) {
        clearInterval(heartbeatTimer);
        await signOut();
        router.replace("/login");
        return;
      }

      // 활동이 있었으면 heartbeat
      if (hadActivityRef.current) {
        hadActivityRef.current = false;
        try {
          await heartbeatSession();
        } catch {
          // 무시
        }
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActivity));
      clearInterval(heartbeatTimer);
    };
  }, [user, signOut, router, markActivity]);
}
