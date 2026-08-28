import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, Copy, ExternalLink, SquareTerminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import {
  generateHarnessRecipe,
  HARNESS_IDS,
  type HarnessId,
  type HarnessRecipe,
  type RecipeSnippet,
} from '@/lib/harness-recipes';
import type { ProviderMetadata } from '@/types/model';

interface HarnessSetupGuideProps {
  modelId: string;
  providerMeta: ProviderMetadata;
  providerId?: string;
}

const HARNESS_LABELS: Record<HarnessId, string> = {
  'claude-code': 'Claude Code',
  pi: 'Pi',
  opencode: 'OpenCode',
  codex: 'Codex',
};

type CopyState = { id: string; result: 'copied' | 'failed' } | null;

function StatusLabel({ status }: { status: HarnessRecipe['status'] }) {
  const label = status === 'supported' ? 'Supported' : status === 'experimental' ? 'Experimental' : 'Unsupported';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${status === 'unsupported' ? 'border-amber-500/40 text-amber-600 dark:text-amber-400' : 'border-[var(--highlight)]/40 text-[var(--highlight)]'}`}>
      {label}
    </span>
  );
}

function ExternalDocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[var(--highlight)] hover:underline">
      {children}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

function Snippet({ snippet, copyState, onCopy }: { snippet: RecipeSnippet; copyState: CopyState; onCopy: () => void }) {
  const copied = copyState?.id === snippet.id && copyState.result === 'copied';
  const failed = copyState?.id === snippet.id && copyState.result === 'failed';
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{snippet.label}</span>
        <button type="button" onClick={onCopy} aria-label={`Copy ${snippet.label}`} className="inline-flex shrink-0 items-center gap-1 rounded-md p-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {copied ? <Check className="h-4 w-4 text-[var(--highlight)]" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground"><code>{snippet.content}</code></pre>
      {failed && <p role="status" className="mt-2 text-xs text-amber-600 dark:text-amber-400">Copy failed. Select the snippet manually, then copy it.</p>}
    </div>
  );
}

function RecipePanel({
  id,
  recipe,
  providerName,
  providerDocsUrl,
  providerSignupUrl,
  copyState,
  onCopy,
  onCopyAll,
  hidden,
}: {
  id: HarnessId;
  recipe: HarnessRecipe;
  hidden: boolean;
  providerName: string;
  providerDocsUrl: string | null;
  providerSignupUrl: string | null;
  copyState: CopyState;
  onCopy: (snippet: RecipeSnippet) => void;
  onCopyAll: (recipe: HarnessRecipe) => void;
}) {
  return (
    <section hidden={hidden} id={`harness-panel-${id}`} role="tabpanel" aria-labelledby={`harness-tab-${id}`} tabIndex={0} className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{HARNESS_LABELS[id]}</h3>
        <StatusLabel status={recipe.status} />
      </div>
      {recipe.status === 'unsupported' ? (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>This combination is not advertised as runnable: the provider and {HARNESS_LABELS[id]} use different protocols or this route has not been verified. No setup command is shown.</p>
          {recipe.caveats?.map((caveat) => <p key={caveat}>{caveat}</p>)}
          <ExternalDocLink href={recipe.docsUrl}>Read the official {HARNESS_LABELS[id]} docs</ExternalDocLink>
        </div>
      ) : (
        <>
          {recipe.caveats?.map((caveat) => <p key={caveat} className="text-sm text-muted-foreground">{caveat}</p>)}
          <ol className="space-y-4" aria-label={`${HARNESS_LABELS[id]} setup steps`}>
            {recipe.steps.map((step, index) => (
              <li key={step.id} className="space-y-3">
                <div>
                  <h4 className="font-medium"><span className="mr-2 text-[var(--highlight)]">{index + 1}.</span>{step.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
                <div className="space-y-2">
                  {step.snippets.map((snippet) => <Snippet key={snippet.id} snippet={snippet} copyState={copyState} onCopy={() => onCopy(snippet)} />)}
                </div>
              </li>
            ))}
          </ol>
          {recipe.copyAllSafe && recipe.copyAll !== null && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
              <button type="button" aria-label="Copy all" onClick={() => onCopyAll(recipe)} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {copyState?.id === 'all' && copyState.result === 'copied' ? <Check className="h-4 w-4 text-[var(--highlight)]" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copyState?.id === 'all' && copyState.result === 'copied' ? 'Copied all' : 'Copy all'}
              </button>
              {copyState?.id === 'all' && copyState.result === 'failed' && <span role="status" className="text-xs text-amber-600 dark:text-amber-400">Copy failed; copy snippets individually.</span>}
            </div>
          )}
        </>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <ExternalDocLink href={recipe.docsUrl}>Official {HARNESS_LABELS[id]} docs</ExternalDocLink>
        {providerDocsUrl && <ExternalDocLink href={providerDocsUrl}>{providerName} provider docs</ExternalDocLink>}
        {providerSignupUrl && <ExternalDocLink href={providerSignupUrl}>Get {providerName} credentials</ExternalDocLink>}
        <span>Verified {recipe.provenance?.verificationDate ?? recipe.lastVerified}</span>
      </div>
    </section>
  );
}

export function HarnessSetupGuide({ modelId, providerMeta, providerId }: HarnessSetupGuideProps) {
  const effectiveProviderId = providerId ?? providerMeta.id;
  const [activeId, setActiveId] = useState<HarnessId>(HARNESS_IDS[0]);
  const [copyState, setCopyState] = useState<CopyState>(null);
  const { copy } = useCopyToClipboard();
  const recipes = HARNESS_IDS.map((id) => generateHarnessRecipe(id, effectiveProviderId, modelId));
  const activeRecipe = recipes[HARNESS_IDS.indexOf(activeId)];
  const provenance = activeRecipe.provenance;
  const providerName = provenance?.providerDisplayName ?? providerMeta.displayName;
  const providerDocsUrl = provenance?.providerDocsUrl ?? (providerMeta.id === effectiveProviderId ? providerMeta.docsUrl : null);
  const providerSignupUrl = provenance?.providerSignupUrl ?? (providerMeta.id === effectiveProviderId ? providerMeta.apiKeySignupUrl : null);

  const copySnippet = async (snippet: RecipeSnippet) => {
    const ok = await copy(snippet.content);
    setCopyState({ id: snippet.id, result: ok ? 'copied' : 'failed' });
  };

  const copyAll = async (recipe: HarnessRecipe) => {
    if (!recipe.copyAllSafe || recipe.copyAll === null) return;
    const ok = await copy(recipe.copyAll);
    setCopyState({ id: 'all', result: ok ? 'copied' : 'failed' });
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = HARNESS_IDS.indexOf(activeId);
    const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? (index + 1) % HARNESS_IDS.length
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? (index - 1 + HARNESS_IDS.length) % HARNESS_IDS.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? HARNESS_IDS.length - 1
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextId = HARNESS_IDS[nextIndex];
    setActiveId(nextId);
    setCopyState(null);
    document.getElementById(`harness-tab-${nextId}`)?.focus();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg"><SquareTerminal className="h-4.5 w-4.5 text-[var(--highlight)]" aria-hidden="true" />Set up a coding harness</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Use <span className="font-medium text-foreground">{providerName}</span> with your preferred coding harness. Credentials may be required, free quotas can change, and prompts or tool output leave your machine when sent to a provider. For local model setups (Ollama, LM Studio, llama.cpp), see the <a href="https://github.com/luongnv89/blogs/blob/main/blog-posts/2026-04-03-run-claude-code-codex-local-gemma4/draft-v0.2.md" target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--highlight)] hover:underline">full local model guide</a>.</p>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/50 p-1" role="tablist" aria-label="Choose a coding harness">
          {HARNESS_IDS.map((id) => {
            const selected = id === activeId;
            return <button key={id} id={`harness-tab-${id}`} type="button" role="tab" aria-selected={selected} aria-controls={`harness-panel-${id}`} tabIndex={selected ? 0 : -1} onClick={() => { setActiveId(id); setCopyState(null); }} onKeyDown={handleTabKeyDown} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{HARNESS_LABELS[id]}</button>;
          })}
        </div>
        {HARNESS_IDS.map((id, index) => (
          <RecipePanel key={id} id={id} recipe={recipes[index]} hidden={id !== activeId} providerName={id === activeId ? providerName : (recipes[index].provenance?.providerDisplayName ?? providerName)} providerDocsUrl={recipes[index].provenance?.providerDocsUrl ?? providerDocsUrl} providerSignupUrl={recipes[index].provenance?.providerSignupUrl ?? providerSignupUrl} copyState={copyState} onCopy={copySnippet} onCopyAll={copyAll} />
        ))}
        <span className="sr-only">Active recipe status: {activeRecipe.status}</span>
      </CardContent>
    </Card>
  );
}
