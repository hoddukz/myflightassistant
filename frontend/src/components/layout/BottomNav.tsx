// Tag: core
// Path: frontend/src/components/layout/BottomNav.tsx

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/schedule", label: "Schedule", icon: "calendar_month" },
  // center = FAB
  { href: "/briefing", label: "Briefing", icon: "cloud" },
  { href: "/duty", label: "Duty", icon: "calculate" },
];

const expandedMenuItems = [
  {
    id: "crew",
    label: "Crew/Hotel",
    icon: "group",
    color: "from-emerald-600 to-emerald-400",
    href: "/crew",
  },
  {
    id: "schedule-upload",
    label: "Schedule",
    icon: "cloud_upload",
    color: "from-blue-600 to-blue-400",
    href: "/settings?tab=schedule",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "settings",
    color: "from-zinc-500 to-zinc-400",
    href: "/settings",
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [fabOpen, setFabOpen] = useState(false);

  const handleMenuClick = useCallback(
    (item: (typeof expandedMenuItems)[number]) => {
      setFabOpen(false);
      if (item.href) {
        router.push(item.href);
      }
    },
    [router]
  );

  return (
    <>
      {/* Backdrop */}
      {fabOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* Bottom Nav + Expanding Panel */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-lg mx-auto">
          {/* Expanded Menu Panel */}
          <div
            className="overflow-hidden transition-all duration-300 ease-out"
            style={{
              maxHeight: fabOpen ? 200 : 0,
              opacity: fabOpen ? 1 : 0,
            }}
          >
            <div className="bg-zinc-900 border-t border-x border-zinc-800 rounded-t-2xl px-4 pt-5 pb-3">
              <div className="grid grid-cols-3 gap-3">
                {expandedMenuItems.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => handleMenuClick(item)}
                    className="flex flex-col items-center gap-2 py-3 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 hover:bg-zinc-800 active:scale-95 transition-all"
                    style={{
                      opacity: fabOpen ? 1 : 0,
                      transform: fabOpen
                        ? "translateY(0)"
                        : "translateY(12px)",
                      transitionDelay: fabOpen ? `${i * 50 + 100}ms` : "0ms",
                      transitionDuration: "250ms",
                    }}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md`}
                    >
                      <span
                        className="material-icons text-white"
                        style={{ fontSize: 24 }}
                      >
                        {item.icon}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-300 font-medium">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nav Bar */}
          <nav className="bg-zinc-900/95 backdrop-blur border-t border-zinc-800">
            <div className="flex justify-around items-center h-16">
              {navItems.map((item, index) => {
                const isActive = pathname === item.href;
                return (
                  <div key={item.href} className="contents">
                    {/* FAB at center (after index 1) */}
                    {index === 2 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFabOpen(!fabOpen);
                        }}
                        className="flex flex-col items-center"
                      >
                        <div
                          className="w-14 h-14 -mt-7 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90"
                          style={{
                            background: fabOpen
                              ? "linear-gradient(135deg, #ef4444, #dc2626)"
                              : "linear-gradient(135deg, #3b82f6, #2563eb)",
                            boxShadow: fabOpen
                              ? "0 6px 20px rgba(239,68,68,0.35)"
                              : "0 6px 20px rgba(59,130,246,0.35)",
                          }}
                        >
                          <span
                            className="material-icons text-white transition-transform duration-300"
                            style={{
                              fontSize: 26,
                              transform: fabOpen
                                ? "rotate(45deg)"
                                : "rotate(0)",
                            }}
                          >
                            add
                          </span>
                        </div>
                      </button>
                    )}
                    <Link
                      href={item.href}
                      onClick={() => setFabOpen(false)}
                      className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                        isActive
                          ? "text-blue-400"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <span className="material-icons text-2xl">
                        {item.icon}
                      </span>
                      <span className="text-xs font-medium">{item.label}</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
