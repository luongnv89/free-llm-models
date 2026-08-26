import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ModelListItem } from '@/components/ModelListItem';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import {
  useModels,
  getArchivedModels,
  getArchiveProviderId,
  getArchiveSourceOptions,
  groupArchivedByProvider,
} from '@/hooks/useModels';
import type { SourceOption } from '@/types/model';
import {
  ArrowLeft,
  Archive,
  LoaderCircle,
  CircleAlert,
  Check,
} from 'lucide-react';

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
          {count} archived model{count === 1 ? '' : 's'}
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
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors ${
        selected
          ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
          : 'border-border hover:bg-muted text-foreground'
      }`}
    >
      {selected && <Check className="w-3 h-3" />}
      <span>{option.displayName}</span>
      <span className={`text-xs ${selected ? 'opacity-70' : 'text-muted-foreground'}`}>
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
    [archived, data]
  );

  const filtered =
    selectedSources.length > 0
      ? archived.filter((entry) => selectedSources.includes(getArchiveProviderId(entry)))
      : archived;

  const groups = useMemo(
    () => groupArchivedByProvider(filtered, data?.providers ?? []),
    [filtered, data]
  );

  const toggleSource = (id: string) => {
    setSelectedSources((current) =>
      current.includes(id)
        ? current.filter((v) => v !== id)
        : [...current, id]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-20">
        <div className="px-4 py-4 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Models
          </Link>
          <DarkModeToggle />
        </div>
      </header>

      {error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <CircleAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Failed to load models</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : (
        <main className="flex-1 p-4 lg:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 bg-black dark:bg-white rounded-lg flex items-center justify-center">
              <Archive className="h-6 w-6 text-[var(--highlight)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Former free models</h1>
              <p className="text-xs text-muted-foreground">
                {archived.length} archived model{archived.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {sourceOptions.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-1">
                Source
              </span>
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
                Models that leave the free list will appear here after the next updater run.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No archived models for the selected providers</p>
            </div>
          ) : (
            groups.map((group) => (
              <ProviderGroup key={group.providerId} displayName={group.displayName} count={group.entries.length}>
                <ol aria-label={`${group.displayName} archived models`} className="list-none">
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
    </div>
  );
}
