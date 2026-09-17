import { useState, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ModelListItem } from "@/components/ModelListItem";
import { FilterSidebar } from "@/components/FilterSidebar";
import { SearchBar } from "@/components/SearchBar";
import { ProviderQuickFilter } from "@/components/ProviderQuickFilter";
import { FAQTip } from "@/components/FAQTip";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import {
  useModels,
  useFilteredModels,
  getUniqueProviders,
  getUniqueModalities,
  getSourceOptions,
  getProviderQuickFilterOptions,
  getModelsDataUrl,
  getProvider,
  isNewModel,
} from "@/hooks/useModels";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { SeoHead } from "@/components/SeoHead";

import type { FilterState, SortField, SortOrder } from "@/types/model";
import { formatDateTime, formatShortDateTime } from "@/lib/model-utils";
import {
  HOME_TITLE,
  buildHomeDescription,
  buildHomeStructuredData,
  canonicalUrl,
} from "@/lib/seo";
import { LoaderCircle, CircleAlert, Copy, Check } from "lucide-react";

function StatCell({
  value,
  label,
  shortLabel,
}: {
  value: ReactNode;
  label: string;
  shortLabel?: string;
}) {
  return (
    <div className="bg-card px-3 py-3 sm:px-5 sm:py-4">
      <p className="font-mono text-xl font-medium tabular-nums sm:text-2xl">
        {value}
      </p>
      <p className="eyebrow mt-1">
        {shortLabel ? (
          <>
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </p>
    </div>
  );
}

export function HomePage() {
  const { data, loading, error } = useModels();

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    sources: [],
    providers: [],
    modalities: [],
    contextLengthMin: null,
    contextLengthMax: null,
    hasReasoning: null,
    hasTools: null,
  });
  const [sortField, setSortField] = useState<SortField>("addedToFreeList");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const { copied, copy } = useCopyToClipboard();

  const dataUrl = new URL(getModelsDataUrl(), window.location.origin).href;

  const copyDataUrl = () => copy(dataUrl);

  const filteredModels = useFilteredModels(
    data?.models ?? [],
    filters,
    sortField,
    sortOrder,
  );

  const providers = getUniqueProviders(data?.models ?? []);
  const modalities = getUniqueModalities(data?.models ?? []);
  const sources = getSourceOptions(data?.models ?? [], data?.providers ?? []);
  const providerQuickFilterOptions = getProviderQuickFilterOptions(
    data?.models ?? [],
  );
  const providerCount = data?.providers?.length || sources.length;
  const homeDescription = buildHomeDescription(
    data?.totalModels ?? 0,
    (data?.providers ?? []).map((provider) => provider.displayName),
  );

  const toggleSource = (sourceId: string) => {
    setFilters((current) => ({
      ...current,
      sources: current.sources.includes(sourceId)
        ? current.sources.filter((id) => id !== sourceId)
        : [...current.sources, sourceId],
    }));
  };

  const clearSources = () => {
    setFilters((current) => ({ ...current, sources: [] }));
  };

  const clearAllFilters = () => {
    setFilters((current) => ({
      ...current,
      sources: [],
      providers: [],
      modalities: [],
      contextLengthMin: null,
      contextLengthMax: null,
      hasReasoning: null,
      hasTools: null,
    }));
  };

  // Count new models (added in last 3 days)
  const newModelsCount = useMemo(() => {
    return data?.models.filter(isNewModel).length ?? 0;
  }, [data?.models]);

  if (loading) {
    return (
      <SiteShell>
        <div className="flex-1 flex items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SiteShell>
    );
  }

  if (error) {
    return (
      <SiteShell>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <CircleAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              Failed to load models
            </h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <>
      <SeoHead
        metadata={{
          title: HOME_TITLE,
          description: homeDescription,
          canonicalPath: canonicalUrl("/"),
        }}
        structuredData={buildHomeStructuredData(
          data?.models ?? [],
          data?.fetchedAt,
          homeDescription,
        )}
      />
      <SiteShell modelCount={data?.totalModels} fetchedAt={data?.fetchedAt}>
        {/* Hero band */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <div className="bg-grid h-full w-full opacity-60 [mask-image:linear-gradient(to_bottom,black_20%,transparent)]" />
          </div>
          <div className="relative grid grid-cols-[minmax(0,1fr)] gap-8 px-4 pt-10 pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-6 lg:pt-14">
            <div className="min-w-0">
              <p className="eyebrow flex items-center gap-2">
                <span aria-hidden="true" className="led" />
                Live catalog · updated{" "}
                {data?.fetchedAt ? (
                  <>
                    <span className="sm:hidden">
                      {formatShortDateTime(data.fetchedAt)}
                    </span>
                    <span className="hidden sm:inline">
                      {formatDateTime(data.fetchedAt)}
                    </span>
                  </>
                ) : (
                  "…"
                )}
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Free LLM models,
                <br />
                one live catalog.
              </h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                {data?.totalModels} models with $0 input and output tokens
                across {providerCount} providers. Refreshed daily from the
                provider APIs.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="flex w-full min-w-0 max-w-full items-center gap-0 rounded-lg border border-border bg-muted/60 py-1 pl-3 pr-1 font-mono text-sm sm:w-auto">
                  <span
                    aria-hidden="true"
                    className="select-none text-muted-foreground"
                  >
                    $
                  </span>
                  <code className="min-w-0 flex-1 truncate px-1">
                    curl -s {dataUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label="Copy data URL"
                    onClick={copyDataUrl}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-[var(--highlight)]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Link
                  to="/faq"
                  className="text-sm underline decoration-[var(--highlight)] decoration-2 underline-offset-4"
                >
                  How to get an API key →
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border lg:hidden">
                <StatCell value={data?.totalModels} label="Models" />
                <StatCell value={providerCount} label="Providers" />
                <StatCell
                  value={newModelsCount}
                  label="New (3 days)"
                  shortLabel="New · 3d"
                />
              </div>
            </div>
            <div className="hidden grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid">
              <StatCell value={data?.totalModels} label="Models" />
              <StatCell value={providerCount} label="Providers" />
              <StatCell value={newModelsCount} label="New (3 days)" />
            </div>
          </div>
          <div className="relative px-4 pb-8 lg:px-6">
            <FAQTip />
          </div>
        </section>

        {/* Catalog */}
        <div className="flex flex-1 min-w-0 flex-col lg:flex-row">
          <FilterSidebar
            filters={filters}
            onFiltersChange={setFilters}
            sources={sources}
            providers={providers}
            modalities={modalities}
          />

          <main className="flex-1 min-w-0 px-4 py-6 lg:px-6">
            {/* Search and Sort (sticky on mobile) */}
            <div className="sticky top-[var(--header-height)] z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-3 lg:static lg:z-auto lg:bg-transparent lg:backdrop-blur-0 lg:mx-0 lg:px-0 lg:pt-0">
              <SearchBar
                search={filters.search}
                onSearchChange={(value) =>
                  setFilters((current) => ({ ...current, search: value }))
                }
                sortField={sortField}
                sortOrder={sortOrder}
                onSortChange={(field, order) => {
                  setSortField(field);
                  setSortOrder(order);
                }}
                totalCount={data?.models.length ?? 0}
                filteredCount={filteredModels.length}
              />
              <ProviderQuickFilter
                options={providerQuickFilterOptions}
                selectedSources={filters.sources}
                onSourceToggle={toggleSource}
                onAll={clearSources}
              />
              {newModelsCount > 0 && (
                <p className="flex items-center gap-1.5 pt-3 font-mono text-xs text-muted-foreground">
                  <span aria-hidden="true" className="led" />
                  {newModelsCount} new in the last 3 days
                </p>
              )}
            </div>

            {/* Ranked model list */}
            {filteredModels.length === 0 ? (
              <div className="panel mt-6 p-10 text-center">
                <p className="text-muted-foreground">
                  No models match your filters.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={clearAllFilters}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <ol
                aria-label="Free models"
                role="list"
                className="mt-6 list-none"
              >
                {filteredModels.map((model, index) => (
                  <ModelListItem
                    key={`${getProvider(model)}:${model.id}`}
                    model={model}
                    rank={index + 1}
                    isNew={isNewModel(model)}
                  />
                ))}
              </ol>
            )}
          </main>
        </div>
      </SiteShell>
    </>
  );
}
