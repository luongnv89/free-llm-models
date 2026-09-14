import type { SourceOption } from "@/types/model";
import { cn } from "@/lib/utils";

interface ProviderQuickFilterProps {
  options: SourceOption[];
  selectedSources: string[];
  onSourceToggle: (sourceId: string) => void;
  onAll: () => void;
}

function chipClass(selected: boolean): string {
  return cn(
    "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm transition-colors",
    selected
      ? "border-foreground bg-foreground text-background"
      : "border-border hover:border-foreground/40",
  );
}

export function ProviderQuickFilter({
  options,
  selectedSources,
  onSourceToggle,
  onAll,
}: ProviderQuickFilterProps) {
  const allSelected = selectedSources.length === 0;

  return (
    <div
      role="group"
      aria-label="Filter models by provider"
      className="flex flex-wrap items-center gap-2 pt-3"
    >
      <button
        type="button"
        aria-label="All"
        aria-pressed={allSelected}
        onClick={onAll}
        className={chipClass(allSelected)}
      >
        All
      </button>
      {options.map((option) => {
        const selected = selectedSources.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-label={option.displayName}
            aria-pressed={selected}
            onClick={() => onSourceToggle(option.id)}
            className={chipClass(selected)}
          >
            {option.displayName}
            <span
              aria-hidden="true"
              className={cn(
                "font-mono text-xs",
                selected ? "opacity-70" : "text-muted-foreground",
              )}
            >
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
