// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/components/layout/DisclaimerOverlay.tsx

"use client";

import { useRouter } from "next/navigation";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAuthStore } from "@/stores/authStore";

export default function DisclaimerOverlay() {
  const router = useRouter();
  const setDisclaimerAccepted = useSettingsStore((s) => s.setDisclaimerAccepted);
  const signOut = useAuthStore((s) => s.signOut);

  const handleDisagree = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">My Flight Assistant</h1>
          <p className="text-zinc-500 text-sm">v1.0.0</p>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-lg">&#9888;</span>
            <h2 className="text-base font-semibold text-amber-400">Disclaimer</h2>
          </div>

          <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
            <p>
              This application is a <strong className="text-foreground font-semibold">personal reference tool only</strong> and
              is <strong className="text-red-400">NOT</strong> approved for official flight planning,
              dispatch, or operational decision-making.
            </p>
            <p>
              Weather data (METAR, TAF, NOTAM, SIGMET) is sourced from public APIs and
              may be <strong className="text-foreground font-semibold">delayed, incomplete, or inaccurate</strong>.
            </p>
            <p>
              Always use <strong className="text-foreground font-semibold">official airline systems and approved sources</strong> for
              all operational decisions. The developer assumes no liability for any use of this application.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDisagree}
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm font-semibold rounded-xl transition-colors"
          >
            Disagree
          </button>
          <button
            onClick={() => setDisclaimerAccepted(true)}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Agree
          </button>
        </div>
      </div>
    </div>
  );
}
