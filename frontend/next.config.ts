import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";

// 프로젝트 루트의 .env에서 NEXT_PUBLIC_* 환경변수 로드
function loadRootEnv(): Record<string, string> {
  try {
    const content = readFileSync(resolve(process.cwd(), "../.env"), "utf-8");
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex);
      const value = trimmed.slice(eqIndex + 1);
      if (key.startsWith("NEXT_PUBLIC_")) {
        env[key] = value;
      }
    }
    return env;
  } catch {
    return {};
  }
}

const rootEnv = loadRootEnv();

const nextConfig: NextConfig = {
  output: "standalone",
  ...(Object.keys(rootEnv).length > 0 ? { env: rootEnv } : {}),
  async rewrites() {
    const backend = process.env.BACKEND_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
