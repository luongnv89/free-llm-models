import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Check } from 'lucide-react';
import type { FilterState } from '@/types/model';

interface FilterSidebarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  providers: string[];
  modalities: string[];
}

const contextLengthOptions = [
  { label: '< 32K', min: null, max: 32768 },
  { label: '32K - 128K', min: 32768, max: 131072 },
  { label: '> 128K', min: 131072, max: null },
];

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
}

function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FiltersContent({
  filters,
  providers,
  modalities,
  hasActiveFilters,
  activeFilterCount,
  clearFilters,
  toggleArrayFilter,
  toggleContextLength,
  updateFilter,
  showHeader = true,
}: {
  filters: FilterState;
  providers: string[];
  modalities: string[];
  hasActiveFilters: boolean;
  activeFilterCount: number;
  clearFilters: () => void;
  toggleArrayFilter: (key: 'providers' | 'modalities', value: string) => void;
  toggleContextLength: (min: number | null, max: number | null) => void;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  showHeader?: boolean;
}) {
  return (
    <>
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Filters</h2>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Modalities */}
      <FilterSection title="Modality">
        <div className="space-y-1">
          {modalities.map((modality) => (
            <FilterOption
              key={modality}
              label={modality}
              selected={filters.modalities.includes(modality)}
              onClick={() => toggleArrayFilter('modalities', modality)}
            />
          ))}
        </div>
      </FilterSection>

      {/* Context Length */}
      <FilterSection title="Context Length">
        <div className="space-y-1">
          {contextLengthOptions.map((opt) => (
            <FilterOption
              key={opt.label}
              label={opt.label}
              selected={
                filters.contextLengthMin === opt.min &&
                filters.contextLengthMax === opt.max
              }
              onClick={() => toggleContextLength(opt.min, opt.max)}
            />
          ))}
        </div>
      </FilterSection>

      {/* Capabilities */}
      <FilterSection title="Capabilities">
        <div className="space-y-1">
          <FilterOption
            label="Reasoning"
            selected={filters.hasReasoning === true}
            onClick={() =>
              updateFilter(
                'hasReasoning',
                filters.hasReasoning === true ? null : true
              )
            }
          />
          <FilterOption
            label="Tool Use"
            selected={filters.hasTools === true}
            onClick={() =>
              updateFilter(
                'hasTools',
                filters.hasTools === true ? null : true
              )
            }
          />
        </div>
      </FilterSection>

      {/* Providers */}
      <FilterSection title="Provider">
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {providers.map((provider) => (
            <FilterOption
              key={provider}
              label={provider}
              selected={filters.providers.includes(provider)}
              onClick={() => toggleArrayFilter('providers', provider)}
            />
          ))}
        </div>
      </FilterSection>
    </>
  );
}

interface FilterOptionProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  count?: number;
}

function FilterOption({ label, selected, onClick, count }: FilterOptionProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors text-left ${
        selected
          ? 'bg-black text-white'
          : 'hover:bg-muted text-foreground'
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`w-4 h-4 rounded border flex items-center justify-center ${
            selected
              ? 'bg-[var(--highlight)] border-[var(--highlight)]'
              : 'border-gray-300'
          }`}
        >
          {selected && <Check className="w-3 h-3 text-black" />}
        </span>
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

export function FilterSidebar({
  filters,
  onFiltersChange,
  providers,
  modalities,
}: FilterSidebarProps) {
  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (
    key: 'providers' | 'modalities',
    value: string
  ) => {
    const current = filters[key];
    if (current.includes(value)) {
      updateFilter(
        key,
        current.filter((v) => v !== value)
      );
    } else {
      updateFilter(key, [...current, value]);
    }
  };

  const toggleContextLength = (min: number | null, max: number | null) => {
    const isSelected =
      filters.contextLengthMin === min && filters.contextLengthMax === max;
    if (isSelected) {
      onFiltersChange({
        ...filters,
        contextLengthMin: null,
        contextLengthMax: null,
      });
    } else {
      onFiltersChange({
        ...filters,
        contextLengthMin: min,
        contextLengthMax: max,
      });
    }
  };

  const clearFilters = () => {
    onFiltersChange({
      search: filters.search, // Keep search
      providers: [],
      modalities: [],
      contextLengthMin: null,
      contextLengthMax: null,
      hasReasoning: null,
      hasTools: null,
    });
  };

  const hasActiveFilters =
    filters.providers.length > 0 ||
    filters.modalities.length > 0 ||
    filters.contextLengthMin !== null ||
    filters.contextLengthMax !== null ||
    filters.hasReasoning !== null ||
    filters.hasTools !== null;

  const activeFilterCount =
    filters.providers.length +
    filters.modalities.length +
    (filters.contextLengthMin !== null || filters.contextLengthMax !== null ? 1 : 0) +
    (filters.hasReasoning !== null ? 1 : 0) +
    (filters.hasTools !== null ? 1 : 0);

  return (
    <aside className="w-full lg:w-64 shrink-0 lg:border-r border-border bg-card border-b lg:border-b-0">
      {/* Mobile: collapsible */}
      <div className="p-4 lg:hidden">
        <details>
          <summary className="list-none cursor-pointer select-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Filters</h2>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">Tap to expand</span>
            </div>
          </summary>
          <div className="pt-4 space-y-6">
            <FiltersContent
              filters={filters}
              providers={providers}
              modalities={modalities}
              hasActiveFilters={hasActiveFilters}
              activeFilterCount={activeFilterCount}
              clearFilters={clearFilters}
              toggleArrayFilter={toggleArrayFilter}
              toggleContextLength={toggleContextLength}
              updateFilter={updateFilter}
              showHeader={false}
            />
          </div>
        </details>
      </div>

      {/* Desktop: always open + sticky */}
      <div className="hidden lg:block lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] overflow-y-auto p-4 space-y-6">
        <FiltersContent
          filters={filters}
          providers={providers}
          modalities={modalities}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          clearFilters={clearFilters}
          toggleArrayFilter={toggleArrayFilter}
          toggleContextLength={toggleContextLength}
          updateFilter={updateFilter}
        />
      </div>
    </aside>
  );
}
