import type { CSSProperties, ReactNode } from "react";
import { Zap } from "lucide-react";

interface CuStatsPageShellProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function CuStatsPageShell({
  children,
  className = "min-h-screen bg-background flex flex-col",
  style,
}: CuStatsPageShellProps) {
  return (
    <div className={className} style={style}>
      <CuStatsBanner />
      {children}
    </div>
  );
}

export function CuStatsBanner() {
  return (
    <a
      href="https://custats.info"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-4 py-2 bg-card border border-[var(--highlight)]"
    >
      <Zap className="h-4 w-4 shrink-0 text-[var(--highlight)]" aria-hidden="true" />
      <span className="text-xs font-semibold text-[var(--highlight)]">
        Track Your AI Usage
      </span>{" "}
      <span className="text-xs text-muted-foreground">
        CuStats is a free AI usage tracking tool — monitor your AI costs and usage.{" "}
        <span className="text-[var(--highlight)] underline decoration-[var(--highlight)] decoration-2 underline-offset-4">
          Learn more
        </span>
      </span>
    </a>
  );
}