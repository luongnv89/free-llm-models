import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getProvider, isNewModel } from '@/hooks/useModels';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import {
  capabilityTags,
  formatContextLength,
  formatDateTime,
  formatIsoDate,
} from '@/lib/model-utils';
import type { Model } from '@/types/model';

export interface ModelListItemProps {
  model: Model;
  rank: number;
  isNew?: boolean;
  providerLabel?: string;
  removedAt?: string;
}

export function ModelListItem({
  model,
  rank,
  isNew = isNewModel(model),
  providerLabel,
  removedAt,
}: ModelListItemProps) {
  const { copied, copy } = useCopyToClipboard();
  const [copyFailed, setCopyFailed] = useState(false);
  const provider = providerLabel ?? getProvider(model);
  const tags = capabilityTags(model);

  const copyModelId = async () => {
    const success = await copy(model.id);
    setCopyFailed(!success);
  };

  return (
    <li className="group border-b border-border/70 py-3 transition-colors hover:bg-muted/40 first:border-t">
      <div className="flex min-w-0 items-start gap-3 px-2 sm:px-3">
        <span className="w-6 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground" aria-label={`Rank ${rank}`}>
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              to={`/model/${encodeURIComponent(model.id)}`}
              className="min-w-0 break-words text-sm font-semibold leading-tight hover:text-[var(--highlight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {model.name}
            </Link>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {provider}
            </span>
            {isNew && (
              <Badge
                variant="outline"
                className="border-[var(--highlight)] px-1.5 py-0 text-xs text-[var(--highlight)]"
              >
                <Sparkles aria-hidden="true" />
                New
              </Badge>
            )}
          </div>

          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <code className="min-w-0 max-w-full break-all font-mono">{model.id}</code>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="-ml-2 focus-visible:ring-2"
              onClick={copyModelId}
              aria-label={`Copy model ID ${model.id}`}
              title="Copy model ID"
            >
              {!copyFailed && copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </Button>
            <span>{formatContextLength(model.context_length)} ctx</span>
            <span>
              Added {model.addedToFreeList ? formatIsoDate(model.addedToFreeList) : 'Unknown'}
            </span>
            {removedAt && <span>Removed {formatDateTime(removedAt)}</span>}
            {tags.map((tag) => {
              const Icon = tag.icon;
              return (
                <Badge key={tag.key} variant={tag.variant} className="px-1.5 py-0 text-xs">
                  <Icon aria-hidden="true" />
                  {tag.label}
                </Badge>
              );
            })}
          </div>

          {model.description && (
            <p className="mt-1 truncate text-xs text-muted-foreground" title={model.description}>
              {model.description}
            </p>
          )}
          <span className="sr-only" role="status" aria-live="polite">
            {copyFailed ? 'Unable to copy model ID' : copied ? 'Model ID copied' : ''}
          </span>
        </div>
      </div>
    </li>
  );
}
