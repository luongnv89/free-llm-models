import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeSnippets } from '@/components/CodeSnippets';
import { OriHarnessGuide } from '@/components/OriHarnessGuide';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { useModels, getProvider, isNewModel, findModelById } from '@/hooks/useModels';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import {
  formatDate,
  formatIsoDate,
  formatContextLength,
  modelCapabilities,
  capabilityTags,
  calendarDay,
  popularitySummary,
  popularitySourceLabel,
} from '@/lib/model-utils';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  TriangleAlert,
  Archive,
} from 'lucide-react';

const reveal = (delayMs: number) => ({
  className:
    'animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-500',
  style: { animationDelay: `${delayMs}ms` },
});

export function ModelDetailPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const { data, loading, error } = useModels();
  const { copied, copy } = useCopyToClipboard();

  const decodedModelId = modelId ? decodeURIComponent(modelId) : '';
  const resolved = findModelById(data, decodedModelId);
  const model = resolved?.model;
  const isArchived = resolved?.archived ?? false;
  const isNew = model && !isArchived ? isNewModel(model) : false;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-mono">Loading…</div>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <TriangleAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Model not found</h2>
          <p className="text-muted-foreground mb-4">
            {error || 'The requested model could not be found.'}
          </p>
          <Link to="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Models
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const provider = getProvider(model);
  const { reasoning: hasReasoning, tools: hasTools, vision: hasVision, video: hasVideo } =
    modelCapabilities(model);
  const tags = capabilityTags(model);
  const addedLabel = model.addedToFreeList
    ? formatIsoDate(model.addedToFreeList)
    : 'Unknown';
  const showCreated =
    !model.addedToFreeList ||
    calendarDay(model.addedToFreeList) !== calendarDay(model.created);
  const popularity = model.popularity;
  const isFree =
    model.pricing.prompt === '0' &&
    (!model.pricing.completion || model.pricing.completion === '0');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to={isArchived ? '/archive' : '/'}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isArchived ? 'Back to Archive' : 'Back to Models'}
          </Link>
          <DarkModeToggle />
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-4 pb-16">
        {/* Blueprint grid texture behind the hero */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden"
        >
          <div className="bg-grid h-full w-full opacity-60 [mask-image:linear-gradient(to_bottom,black_20%,transparent)]" />
        </div>

        {isArchived && (
          <div className="relative mt-6 p-4 border border-amber-500/30 rounded-lg bg-amber-500/10 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 mb-1">
              <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Former free model
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              This model is no longer on the free list
              {resolved?.archive?.removedAt
                ? ` (removed ${formatIsoDate(resolved.archive.removedAt)})`
                : ''}
              .{' '}
              <Link
                to="/archive"
                className="underline decoration-[var(--highlight)] decoration-2 underline-offset-4 hover:decoration-foreground"
              >
                View archive
              </Link>
            </p>
          </div>
        )}

        {/* Hero */}
        <section className="relative pt-10 pb-10">
          <div {...reveal(0)}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
                {provider}
              </span>
              {isNew && (
                <Badge
                  variant="outline"
                  className="text-[var(--highlight)] border-[var(--highlight)]"
                >
                  <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" />
                  New
                </Badge>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              {model.name}
            </h1>

            {/* Terminal-style model ID chip */}
            <div className="inline-flex max-w-full items-center gap-0 rounded-lg border border-border bg-muted/60 py-1 pl-3 pr-1 font-mono text-sm">
              <span aria-hidden="true" className="select-none text-muted-foreground">
                $
              </span>
              <code className="truncate px-1">{model.id}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label={`Copy model ID ${model.id}`}
                onClick={() => copy(decodedModelId)}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-[var(--highlight)]" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {tags.map((tag) => {
                  const Icon = tag.icon;
                  return (
                    <Badge key={tag.key} variant={tag.variant} className="text-xs">
                      <Icon aria-hidden="true" />
                      {tag.label}
                    </Badge>
                  );
                })}
              </div>
            )}

            {model.description && (
              <p className="mt-5 max-w-3xl text-muted-foreground leading-relaxed">
                {model.description}
              </p>
            )}

            {/* Stat strip */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <span className="font-mono text-sm">
                <span className="text-muted-foreground">ctx</span>{' '}
                {formatContextLength(model.context_length)}
              </span>
              <span aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />
              <span className="font-mono text-sm">
                <span className="text-muted-foreground">io</span>{' '}
                {model.architecture.modality}
              </span>
              <span aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />
              {isFree ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--highlight)] px-2.5 py-0.5 font-mono text-xs">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-[var(--highlight)]"
                  />
                  FREE
                </span>
              ) : (
                <span className="font-mono text-sm">
                  <span className="text-muted-foreground">in</span>{' '}
                  {model.pricing.prompt}{' '}
                  <span className="text-muted-foreground">out</span>{' '}
                  {model.pricing.completion}
                </span>
              )}
              {model.hugging_face_id && (
                <a
                  href={`https://huggingface.co/${model.hugging_face_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Hugging Face
                  </Button>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — run it now */}
          <div className="lg:col-span-2 space-y-6">
            <div {...reveal(75)}>
              <CodeSnippets modelId={model.id} />
            </div>

            <div {...reveal(150)}>
              <OriHarnessGuide modelId={model.id} />
            </div>

            <Card {...reveal(225)}>
              <CardHeader>
                <CardTitle className="text-lg">Supported Parameters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {model.supported_parameters.map((param) => (
                    <Badge key={param} variant="secondary" className="font-mono text-xs">
                      {param}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column — reference */}
          <div className="space-y-6">
            <Card {...reveal(100)}>
              <CardHeader>
                <CardTitle className="text-lg">Specifications</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border">
                  <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                    <dt className="text-sm text-muted-foreground">Context length</dt>
                    <dd className="text-sm font-medium font-mono text-right">
                      {formatContextLength(model.context_length)} tokens
                    </dd>
                  </div>
                  {model.top_provider.max_completion_tokens != null && (
                    <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                      <dt className="text-sm text-muted-foreground">Max completion</dt>
                      <dd className="text-sm font-medium font-mono text-right">
                        {model.top_provider.max_completion_tokens.toLocaleString()} tokens
                      </dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                    <dt className="text-sm text-muted-foreground">Tokenizer</dt>
                    <dd className="text-sm font-medium font-mono text-right">
                      {model.architecture.tokenizer}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                    <dt className="text-sm text-muted-foreground">Added to free list</dt>
                    <dd className="text-sm font-medium text-right">{addedLabel}</dd>
                  </div>
                  {showCreated && (
                    <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                      <dt className="text-sm text-muted-foreground">Created</dt>
                      <dd className="text-sm font-medium text-right">
                        {formatDate(model.created)}
                      </dd>
                    </div>
                  )}
                  {popularity && (
                    <div className="py-2.5 first:pt-0 last:pb-0">
                      <dt className="text-sm text-muted-foreground mb-1">Popularity</dt>
                      <dd>
                        <p className="text-sm font-medium">
                          {popularitySummary(popularity)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Source: {popularitySourceLabel(popularity.source)}
                          {popularity.asOf ? ` · as of ${formatIsoDate(popularity.asOf)}` : ''}
                        </p>
                        <a
                          href="https://openrouter.ai/rankings"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs underline decoration-[var(--highlight)] decoration-2 underline-offset-4 hover:decoration-foreground"
                        >
                          OpenRouter rankings
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
                {model.expiration_date && (
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      <span className="font-medium">Expires:</span>{' '}
                      {model.expiration_date}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card {...reveal(175)}>
              <CardHeader>
                <CardTitle className="text-lg">Capabilities</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border">
                  {(
                    [
                      ['Vision', hasVision],
                      ['Video', hasVideo],
                      ['Reasoning', hasReasoning],
                      ['Tool Use', hasTools],
                      ['Moderated', model.top_provider.is_moderated],
                    ] as const
                  ).map(([label, enabled]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                    >
                      <dt className="text-sm">{label}</dt>
                      <dd>
                        {enabled ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                            <Check
                              className="h-3.5 w-3.5 text-[var(--highlight)]"
                              aria-hidden="true"
                            />
                            yes
                          </span>
                        ) : (
                          <Badge variant="secondary">no</Badge>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card {...reveal(250)}>
              <CardHeader>
                <CardTitle className="text-lg">Input / Output</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                    Input
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {model.architecture.input_modalities.map((m) => (
                      <Badge key={m} variant="outline" className="font-mono text-xs">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                    Output
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {model.architecture.output_modalities.map((m) => (
                      <Badge key={m} variant="outline" className="font-mono text-xs">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
