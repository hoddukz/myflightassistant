// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/components/layout/AppShell.tsx

"use client";

import { usePathname } from "next/navigation";
import AuthGuard from "@/components/auth/AuthGuard";
import DualTimeBar from "@/components/layout/DualTimeBar";
import BottomNav from "@/components/layout/BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
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
