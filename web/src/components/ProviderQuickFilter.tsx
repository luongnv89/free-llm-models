import { Button } from '@/components/ui/button';
import type { SourceOption } from '@/types/model';

interface ProviderQuickFilterProps {
  options: SourceOption[];
  selectedSources: string[];
  onSourceToggle: (sourceId: string) => void;
  onAll: () => void;
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
      <Button
        type="button"
        variant={allSelected ? 'default' : 'outline'}
        size="sm"
        aria-label="All"
        aria-pressed={allSelected}
        onClick={onAll}
      >
        All
      </Button>
      {options.map((option) => {
        const selected = selectedSources.includes(option.id);
        return (
          <Button
            key={option.id}
            type="button"
            variant={selected ? 'default' : 'outline'}
            size="sm"
            aria-label={option.displayName}
            aria-pressed={selected}
            onClick={() => onSourceToggle(option.id)}
          >
            {option.displayName}
            <span aria-hidden="true" className="text-xs opacity-70">
              {option.count}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
