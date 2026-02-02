import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, ArrowUpDown, Filter } from 'lucide-react';
import type { FilterState, SortField, SortOrder } from '@/types/model';

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  providers: string[];
  modalities: string[];
  totalCount: number;
  filteredCount: number;
}

const contextLengthOptions = [
  { label: 'Any', min: null, max: null },
  { label: '< 32K', min: null, max: 32768 },
  { label: '32K - 128K', min: 32768, max: 131072 },
  { label: '> 128K', min: 131072, max: null },
];

export function FilterBar({
  filters,
  onFiltersChange,
  sortField,
  sortOrder,
  onSortChange,
  providers,
  modalities,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      providers: [],
      modalities: [],
      contextLengthMin: null,
      contextLengthMax: null,
      hasReasoning: null,
      hasTools: null,
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.providers.length > 0 ||
    filters.modalities.length > 0 ||
    filters.contextLengthMin !== null ||
    filters.contextLengthMax !== null ||
    filters.hasReasoning !== null ||
    filters.hasTools !== null;

  return (
    <div className="space-y-4 pb-4 border-b border-border">
      {/* Search and Sort Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models by name, description, or ID..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={sortField}
            onValueChange={(v) => onSortChange(v as SortField, sortOrder)}
          >
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="provider">Provider</SelectItem>
              <SelectItem value="context_length">Context</SelectItem>
              <SelectItem value="created">Date Added</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              onSortChange(sortField, sortOrder === 'asc' ? 'desc' : 'asc')
            }
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <span className="text-xs font-medium">
              {sortOrder === 'asc' ? 'A↑' : 'Z↓'}
            </span>
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />

        {/* Provider Filter */}
        <Select
          value={filters.providers.length === 1 ? filters.providers[0] : ''}
          onValueChange={(v) => {
            if (v === 'all') {
              updateFilter('providers', []);
            } else {
              updateFilter('providers', [v]);
            }
          }}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            {providers.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Modality Filter */}
        <Select
          value={filters.modalities.length === 1 ? filters.modalities[0] : ''}
          onValueChange={(v) => {
            if (v === 'all') {
              updateFilter('modalities', []);
            } else {
              updateFilter('modalities', [v]);
            }
          }}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Modality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modalities</SelectItem>
            {modalities.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Context Length Filter */}
        <Select
          value={
            filters.contextLengthMin === null && filters.contextLengthMax === null
              ? 'any'
              : `${filters.contextLengthMin ?? ''}-${filters.contextLengthMax ?? ''}`
          }
          onValueChange={(v) => {
            if (v === 'any') {
              updateFilter('contextLengthMin', null);
              updateFilter('contextLengthMax', null);
            } else {
              const opt = contextLengthOptions.find(
                (o) => `${o.min ?? ''}-${o.max ?? ''}` === v
              );
              if (opt) {
                onFiltersChange({
                  ...filters,
                  contextLengthMin: opt.min,
                  contextLengthMax: opt.max,
                });
              }
            }
          }}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Context" />
          </SelectTrigger>
          <SelectContent>
            {contextLengthOptions.map((opt) => (
              <SelectItem
                key={opt.label}
                value={
                  opt.min === null && opt.max === null
                    ? 'any'
                    : `${opt.min ?? ''}-${opt.max ?? ''}`
                }
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Quick Filters */}
        <Badge
          variant={filters.hasReasoning === true ? 'default' : 'outline'}
          className="cursor-pointer h-8 px-3"
          onClick={() =>
            updateFilter(
              'hasReasoning',
              filters.hasReasoning === true ? null : true
            )
          }
        >
          Reasoning
        </Badge>
        <Badge
          variant={filters.hasTools === true ? 'default' : 'outline'}
          className="cursor-pointer h-8 px-3"
          onClick={() =>
            updateFilter('hasTools', filters.hasTools === true ? null : true)
          }
        >
          Tools
        </Badge>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          Showing {filteredCount} of {totalCount} models
        </span>
      </div>
    </div>
  );
}
