// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/components/layout/BottomNav.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/schedule", label: "Schedule", icon: "calendar_month" },
  { href: "/briefing", label: "Briefing", icon: "cloud" },
  { href: "/crew", label: "Crew", icon: "group" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur border-t border-zinc-800">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                isActive
                  ? "text-blue-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className="material-icons text-2xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
