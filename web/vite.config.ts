import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "child_process";

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === "/") return "/";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return `${withLeadingSlash.replace(/\/+$/, "")}/`;
}

let commitHash = "dev";
try {
  commitHash = execSync("git rev-parse --short HEAD", {
    encoding: "utf-8",
  }).trim();
} catch {
  // Not a git checkout (e.g. source archive); fall back to "dev".
}

const buildDate = new Date().toISOString().split("T")[0];

const config = ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = normalizeBasePath(
    process.env.VITE_BASE_PATH ?? env.VITE_BASE_PATH,
  );

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify("1.0.0"),
      __COMMIT_HASH__: JSON.stringify(commitHash),
      __BUILD_DATE__: JSON.stringify(buildDate),
    },
    test: {
      coverage: {
        reporter: ["text", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/**/*.test.{ts,tsx}",
          "src/main.tsx",
          "src/components/ui/**",
        ],
      },
    },
  };
};

export default defineConfig(config);
