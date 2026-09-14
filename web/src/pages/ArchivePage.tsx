import { useMemo, useState } from "react";
import { ModelListItem } from "@/components/ModelListItem";
import { SiteShell } from "@/components/SiteShell";
import { SeoHead } from "@/components/SeoHead";
import {
  useModels,
  getArchivedModels,
  getArchiveProviderId,
  getArchiveSourceOptions,
  groupArchivedByProvider,
} from "@/hooks/useModels";
import type { SourceOption } from "@/types/model";
import {
  ARCHIVE_DESCRIPTION,
  ARCHIVE_TITLE,
  buildPageStructuredData,
  canonicalUrl,
} from "@/lib/seo";
import { LoaderCircle, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProviderGroupProps {
  displayName: string;
  count: number;
  children: React.ReactNode;
}

function ProviderGroup({ displayName, count, children }: ProviderGroupProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold">{displayName}</h2>
        <span className="text-xs text-muted-foreground">
          {count} archived model{count === 1 ? "" : "s"}
        </span>
      </div>
      {children}
    </section>
  );
}

function SourceChip({
  option,
  selected,
  onClick,
}: {
  option: SourceOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm transition-colors",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border hover:border-foreground/40",
      )}
    >
      <span>{option.displayName}</span>
      <span
        className={cn(
          "font-mono text-xs",
          selected ? "opacity-70" : "text-muted-foreground",
        )}
      >
        {option.count}
      </span>
    </button>
  );
}

export function ArchivePage() {
  const { data, loading, error } = useModels();
  const archived = getArchivedModels(data);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const sourceOptions = useMemo(
    () => getArchiveSourceOptions(archived, data?.providers ?? []),
    [archived, data],
  );

  const filtered =
    selectedSources.length > 0
      ? archived.filter((entry) =>
          selectedSources.includes(getArchiveProviderId(entry)),
        )
      : archived;

  const groups = useMemo(
    () => groupArchivedByProvider(filtered, data?.providers ?? []),
    [filtered, data],
  );

  const toggleSource = (id: string) => {
    setSelectedSources((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );
  };

  if (loading) {
    return (
      <SiteShell>
        <div className="flex-1 flex items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SiteShell>
    );
  }

  return (
    <>
      <SeoHead
        metadata={{
          title: ARCHIVE_TITLE,
          description: ARCHIVE_DESCRIPTION,
          canonicalPath: canonicalUrl("/archive"),
        }}
        structuredData={buildPageStructuredData(
          ARCHIVE_TITLE,
          ARCHIVE_DESCRIPTION,
          "/archive",
          [
            { name: "Free LLM Models", path: "/" },
            { name: "Archive", path: "/archive" },
          ],
        )}
      />
      <SiteShell modelCount={data?.totalModels} fetchedAt={data?.fetchedAt}>
        {error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <CircleAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Failed to load models
              </h2>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : (
          <main className="flex-1 px-4 py-6 lg:px-6">
            <div className="mb-8">
              <p className="eyebrow">Archive</p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Former free models
              </h1>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {archived.length} archived model
                {archived.length === 1 ? "" : "s"}
              </p>
            </div>

            {sourceOptions.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="eyebrow mr-1">Source</span>
                {sourceOptions.map((option) => (
                  <SourceChip
                    key={option.id}
                    option={option}
                    selected={selectedSources.includes(option.id)}
                    onClick={() => toggleSource(option.id)}
                  />
                ))}
              </div>
            )}

            {archived.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No archived models yet</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Models that leave the free list will appear here after the
                  next updater run.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No archived models for the selected providers
                </p>
              </div>
            ) : (
              groups.map((group) => (
                <ProviderGroup
                  key={group.providerId}
                  displayName={group.displayName}
                  count={group.entries.length}
                >
                  <ol
                    aria-label={`${group.displayName} archived models`}
                    role="list"
                    className="list-none"
                  >
                    {group.entries.map((entry, index) => (
                      <ModelListItem
                        key={entry.id}
                        model={entry.model}
                        rank={index + 1}
                        isNew={false}
                        providerLabel={group.displayName}
                        removedAt={entry.removedAt}
                      />
                    ))}
                  </ol>
                </ProviderGroup>
              ))
            )}
          </main>
        )}
      </SiteShell>
    </>
  );
}
