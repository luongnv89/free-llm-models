import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import { Link, NavLink } from "react-router-dom";
import { X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { formatDateTime, formatShortDateTime } from "@/lib/model-utils";
import { cn } from "@/lib/utils";

const TOP_BAR_DISMISS_KEY = "custatsBarDismissed";

export function TopBar() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(TOP_BAR_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(TOP_BAR_DISMISS_KEY, "1");
    } catch {
      // Storage can be unavailable (e.g. private mode); dismissal still applies.
    }
    setDismissed(true);
  };

  return (
    <div className="h-8 border-b border-border bg-card">
      <div className="flex h-full items-center gap-2 px-4 lg:px-6">
        <a
          href="https://custats.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <span aria-hidden="true" className="led" />
          <span className="shrink-0 text-xs font-semibold text-[var(--highlight)]">
            CuStats
          </span>
          <span className="truncate text-xs text-muted-foreground">
            — free AI usage &amp; cost tracking{" "}
            <span className="text-[var(--highlight)] underline">
              Learn more →
            </span>
          </span>
        </a>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { to: "/", label: "Catalog", end: true },
  { to: "/archive", label: "Archive" },
  { to: "/faq", label: "FAQ" },
] as const;

interface SiteHeaderProps {
  modelCount?: number;
  fetchedAt?: string;
  ref?: Ref<HTMLElement>;
}

export function SiteHeader({ modelCount, fetchedAt, ref }: SiteHeaderProps) {
  return (
    <header
      ref={ref}
      className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur"
    >
      <div className="flex h-14 items-center gap-3 px-4 lg:gap-5 lg:px-6">
        <Link to="/" className="flex min-w-0 shrink-0 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-black dark:bg-white">
            <Zap
              className="h-6 w-6 text-[var(--highlight)]"
              aria-hidden="true"
            />
          </span>
          <span className="hidden font-display text-lg font-semibold tracking-tight whitespace-nowrap min-[420px]:inline">
            Free LLM Models
          </span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-3 sm:gap-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item && item.end}
              className={({ isActive }) =>
                cn(
                  "border-b-2 pb-0.5 text-sm transition-colors",
                  isActive
                    ? "border-[var(--highlight)] text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          {modelCount != null && fetchedAt && (
            <span className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground tabular-nums sm:inline-flex">
              <span aria-hidden="true" className="led" />
              {modelCount} live · {formatShortDateTime(fetchedAt)}
            </span>
          )}
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <a
              href="https://github.com/luongnv89/free-llm-models"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              title="GitHub repository"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="h-5 w-5"
              >
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>
          </Button>
          <DarkModeToggle />
        </div>
      </div>
    </header>
  );
}

const FOOTER_BROWSE_LINKS = [
  { to: "/", label: "Catalog" },
  { to: "/archive", label: "Archive" },
  { to: "/faq", label: "FAQ" },
] as const;

export function SiteFooter({ fetchedAt }: { fetchedAt?: string }) {
  const baseUrl = import.meta.env.BASE_URL;
  return (
    <footer className="mt-auto border-t border-border">
      <div className="grid gap-8 px-4 py-10 md:grid-cols-3 lg:px-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black dark:bg-white">
              <Zap
                className="h-4 w-4 text-[var(--highlight)]"
                aria-hidden="true"
              />
            </span>
            <span className="font-display font-semibold tracking-tight">
              Free LLM Models
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            A live catalog of AI models with $0 input and output tokens,
            refreshed from provider APIs.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <nav aria-label="Browse">
            <p className="eyebrow">Browse</p>
            <ul className="mt-3 space-y-2 text-sm">
              {FOOTER_BROWSE_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Data">
            <p className="eyebrow">Data</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href={`${baseUrl}free_models.json`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  free_models.json
                </a>
              </li>
              <li>
                <a
                  href={`${baseUrl}llms.txt`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  llms.txt
                </a>
              </li>
              <li>
                <a
                  href={`${baseUrl}sitemap.xml`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  sitemap.xml
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/luongnv89/free-llm-models"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="space-y-1.5 font-mono text-xs text-muted-foreground">
          {fetchedAt && <p>updated {formatDateTime(fetchedAt)}</p>}
          <p>
            v{__APP_VERSION__} · {__COMMIT_HASH__}
          </p>
          <p>
            <a
              href="https://luongnv.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              luongnv.com
            </a>
            {" · "}
            <a
              href="https://luongnv.com/claude-tools"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Claude Tools
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

interface SiteShellProps {
  children: ReactNode;
  modelCount?: number;
  fetchedAt?: string;
  className?: string;
}

export function SiteShell({
  children,
  modelCount,
  fetchedAt,
  className,
}: SiteShellProps) {
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(73);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn("min-h-screen bg-background flex flex-col", className)}
      style={{ "--header-height": `${headerHeight}px` } as CSSProperties}
    >
      <TopBar />
      <SiteHeader
        ref={headerRef}
        modelCount={modelCount}
        fetchedAt={fetchedAt}
      />
      {children}
      <SiteFooter fetchedAt={fetchedAt} />
    </div>
  );
}
