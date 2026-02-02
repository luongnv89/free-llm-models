import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ModelCard } from '@/components/ModelCard';
import { FilterSidebar } from '@/components/FilterSidebar';
import { SearchBar } from '@/components/SearchBar';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { FAQTip } from '@/components/FAQTip';
import { Button } from '@/components/ui/button';
import {
  useModels,
  useFilteredModels,
  getUniqueProviders,
  getUniqueModalities,
  isNewModel,
} from '@/hooks/useModels';
import { VERSION, COMMIT_HASH } from '@/version';
import type { FilterState, SortField, SortOrder } from '@/types/model';
import { Loader2, AlertCircle, Zap, HelpCircle } from 'lucide-react';

export function HomePage() {
  const { data, loading, error } = useModels();
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    providers: [],
    modalities: [],
    contextLengthMin: null,
    contextLengthMax: null,
    hasReasoning: null,
    hasTools: null,
  });
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredModels = useFilteredModels(
    data?.models ?? [],
    [],
    filters,
    sortField,
    sortOrder
  );

  const providers = getUniqueProviders(data?.models ?? []);
  const modalities = getUniqueModalities(data?.models ?? []);

  // Count new models (added in last 3 days)
  const newModelsCount = useMemo(() => {
    return data?.models.filter(isNewModel).length ?? 0;
  }, [data?.models]);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to load models</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-20">
        <div className="px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-black rounded-lg flex items-center justify-center">
                <Zap className="h-6 w-6 text-[var(--highlight)]" />
              </div>
              <div>
                <h1 className="text-xl font-bold">OpenRouter Free Models</h1>
                <p className="text-xs text-muted-foreground">
                  {data?.totalModels} free models available
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <FAQTip />
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Last updated</p>
                <p className="text-sm font-medium">
                  {data?.fetchedAt ? formatDate(data.fetchedAt) : 'Unknown'}
                </p>
              </div>
              <Link to="/faq">
                <Button variant="ghost" size="icon" title="FAQ" className="h-9 w-9">
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </Link>
              <DarkModeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 flex-col lg:flex-row min-w-0">
        {/* Sidebar */}
        <FilterSidebar
          filters={filters}
          onFiltersChange={setFilters}
          providers={providers}
          modalities={modalities}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-visible lg:overflow-auto min-w-0">
          {/* New Models Banner */}
          {newModelsCount > 0 && (
            <div className="mb-6 p-4 border border-[var(--highlight)] rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[var(--highlight)] font-semibold text-sm">
                  {newModelsCount} New Model{newModelsCount > 1 ? 's' : ''} (added in last 3 days)
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                New models are highlighted with a green border on the left side.
              </p>
            </div>
          )}

          {/* Search and Sort */}
          <SearchBar
            search={filters.search}
            onSearchChange={(value) => setFilters({ ...filters, search: value })}
            sortField={sortField}
            sortOrder={sortOrder}
            onSortChange={(field, order) => {
              setSortField(field);
              setSortOrder(order);
            }}
            totalCount={data?.models.length ?? 0}
            filteredCount={filteredModels.length}
          />

          {/* Model Grid */}
          {filteredModels.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No models match your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {filteredModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isNew={isNewModel(model)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="px-4 py-6">
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <span>
                Data sourced from{' '}
                <a
                  href="https://openrouter.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--highlight)] hover:underline"
                >
                  OpenRouter API
                </a>
              </span>
              <span>·</span>
              <Link to="/faq" className="hover:text-[var(--highlight)] transition-colors">
                FAQ
              </Link>
              <span>·</span>
              <a
                href="https://luongnv.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--highlight)] transition-colors"
              >
                luongnv.com
              </a>
              <span>·</span>
              <a
                href="https://luongnv.com/claude-tools"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--highlight)] transition-colors"
              >
                Claude Tools
              </a>
            </div>
            <div className="text-xs text-muted-foreground/60">
              v{VERSION} ({COMMIT_HASH})
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
