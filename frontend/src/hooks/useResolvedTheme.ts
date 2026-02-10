// Tag: util
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/hooks/useResolvedTheme.ts

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

export function useResolvedTheme() {
  const theme = useSettingsStore((s) => s.theme);
  const [resolved, setResolved] = useState<"dark" | "light">(theme === "light" ? "light" : "dark");

  useEffect(() => {
    if (theme !== "auto") {
      setResolved(theme as "dark" | "light");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = (e: MediaQueryListEvent | MediaQueryList) => setResolved(e.matches ? "dark" : "light");
    update(mq);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [theme]);

  return resolved;
}
