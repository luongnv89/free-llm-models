import { Link } from 'react-router-dom';
import { ModelCard } from '@/components/ModelCard';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { useModels, getArchivedModels } from '@/hooks/useModels';
import { formatDateTime } from '@/lib/model-utils';
import {
  ArrowLeft,
  Archive,
  LoaderCircle,
  CircleAlert,
} from 'lucide-react';

export function ArchivePage() {
  const { data, loading, error } = useModels();
  const archived = getArchivedModels(data);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <CircleAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to load models</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
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

        {archived.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No archived models yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              Models that leave the free list will appear here after the next updater run.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((entry) => (
              <div key={entry.id}>
                <ModelCard model={entry.model} isNew={false} />
                <p className="text-xs text-muted-foreground mt-2 px-1">
                  Removed {formatDateTime(entry.removedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
