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

const DISCLAIMER_ENABLED = process.env.NEXT_PUBLIC_DISCLAIMER_ENABLED === "true";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const resolvedTheme = useResolvedTheme();
  const disclaimerAccepted = useSettingsStore((s) => s.disclaimerAccepted);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    html.classList.add(resolvedTheme);
  }, [resolvedTheme]);

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
