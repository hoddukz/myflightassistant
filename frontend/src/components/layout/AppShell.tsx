// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/components/layout/AppShell.tsx

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import AuthGuard from "@/components/auth/AuthGuard";
import DualTimeBar from "@/components/layout/DualTimeBar";
import BottomNav from "@/components/layout/BottomNav";
import DisclaimerOverlay from "@/components/layout/DisclaimerOverlay";
import { useSettingsStore } from "@/stores/settingsStore";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";

// 프로덕션 빌드에서만 Disclaimer 표시, 로컬 개발환경에서는 자동 OFF
const DISCLAIMER_ENABLED = process.env.NODE_ENV === "production";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const resolvedTheme = useResolvedTheme();
  const disclaimerAccepted = useSettingsStore((s) => s.disclaimerAccepted);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    html.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (DISCLAIMER_ENABLED && !disclaimerAccepted) {
    return <DisclaimerOverlay />;
  }

  return (
    <AuthGuard>
      <DualTimeBar />
      <main className="pt-10 pb-20 px-4 max-w-lg mx-auto min-h-screen">
        {children}
      </main>
      <BottomNav />
    </AuthGuard>
  );
}
