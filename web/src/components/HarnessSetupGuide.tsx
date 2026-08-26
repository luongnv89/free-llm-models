import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, Copy, ExternalLink, SquareTerminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import type { ProviderMetadata } from '@/types/model';

interface HarnessOption {
  id: string;
  label: string;
  command: string;
  docsUrl: string;
  description: string;
}

interface HarnessSetupGuideProps {
  modelId: string;
  providerMeta: ProviderMetadata;
}

const HARNESSES: Omit<HarnessOption, 'command'>[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    docsUrl: 'https://code.claude.com/docs/en/llm-gateway',
    description: 'Configure the provider in Claude Code, then start a session with this model.',
  },
  {
    id: 'pi',
    label: 'Pi',
    docsUrl: 'https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md',
    description: 'Make the provider credentials available to Pi before launching the model.',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    docsUrl: 'https://opencode.ai/docs/providers/',
    description: 'Configure the provider in OpenCode, then launch the selected model.',
  },
  {
    id: 'codex',
    label: 'Codex',
    docsUrl: 'https://developers.openai.com/codex/config-advanced/',
    description: 'Add the provider to Codex configuration before starting a session.',
  },
];

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"")}'`;
}

export function HarnessSetupGuide({ modelId, providerMeta }: HarnessSetupGuideProps) {
  const [activeId, setActiveId] = useState(HARNESSES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const activeHarness = HARNESSES.find((harness) => harness.id === activeId) ?? HARNESSES[0];
  const activeCommand = `${activeHarness.id === 'claude-code' ? 'claude' : activeHarness.id} --model ${shellQuote(modelId)}`;

  const selectHarness = (id: string) => {
    setActiveId(id);
    setCopiedId(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = HARNESSES.findIndex((harness) => harness.id === activeId);
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % HARNESSES.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + HARNESSES.length) % HARNESSES.length
          : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextHarness = HARNESSES[nextIndex];
    selectHarness(nextHarness.id);
    document.getElementById(`harness-tab-${nextHarness.id}`)?.focus();
  };

  const copyCommand = async () => {
    const ok = await copy(activeCommand);
    if (ok) setCopiedId(activeHarness.id);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <SquareTerminal className="h-4.5 w-4.5 text-[var(--highlight)]" aria-hidden="true" />
          Set up a coding harness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Use <span className="font-medium text-foreground">{providerMeta.displayName}</span> with
          the coding harness you already use. Configure credentials through the provider and
          harness documentation; never paste a real key into a shared command or file.
        </p>

        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/50 p-1" role="tablist" aria-label="Choose a coding harness">
          {HARNESSES.map((harness) => {
            const selected = harness.id === activeHarness.id;
            return (
              <button
                key={harness.id}
                id={`harness-tab-${harness.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`harness-panel-${harness.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectHarness(harness.id)}
                onKeyDown={handleKeyDown}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {harness.label}
              </button>
            );
          })}
        </div>

        <section
          id={`harness-panel-${activeHarness.id}`}
          role="tabpanel"
          aria-labelledby={`harness-tab-${activeHarness.id}`}
          tabIndex={0}
          className="space-y-3 rounded-lg border border-border p-4"
        >
          <div>
            <h3 className="font-medium">{activeHarness.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{activeHarness.description}</p>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 font-mono text-sm">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all">{activeCommand}</code>
            <button
              type="button"
              onClick={copyCommand}
              aria-label={`Copy ${activeHarness.label} command`}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied && copiedId === activeHarness.id ? (
                <Check className="h-4 w-4 text-[var(--highlight)]" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <a
              href={activeHarness.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[var(--highlight)] hover:underline"
            >
              Official {activeHarness.label} docs
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            {providerMeta.docsUrl && (
              <a
                href={providerMeta.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--highlight)] hover:underline"
              >
                {providerMeta.displayName} provider docs
              </a>
            )}
            {providerMeta.apiKeySignupUrl && (
              <a
                href={providerMeta.apiKeySignupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--highlight)] hover:underline"
              >
                Get provider credentials
              </a>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
