import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { Check, CircleCheck, Code, Copy, Terminal } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { OPENROUTER_DEFAULT_METADATA, providerApiKeyEnvVar } from '@/hooks/useModels';
import type { ProviderMetadata } from '@/types/model';

interface CodeSnippetsProps {
  modelId: string;
  provider?: ProviderMetadata;
}

type Language = 'curl' | 'nodejs' | 'python';

const prismLanguageMap: Record<Language, string> = {
  curl: 'bash',
  nodejs: 'javascript',
  python: 'python',
};

function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    return url;
  }
}

function KeysLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline decoration-[var(--highlight)] decoration-2 underline-offset-4 hover:decoration-foreground"
    >
      {displayUrl(url)}
    </a>
  );
}

interface RunStep {
  title: string;
  hint?: ReactNode;
  language: string;
  code: string;
}

function buildSteps(modelId: string, provider: ProviderMetadata): Record<Language, RunStep[]> {
  const baseUrl =
    provider.openaiCompatibleBaseUrl ??
    provider.baseUrl ??
    OPENROUTER_DEFAULT_METADATA.baseUrl!;
  const signupUrl = provider.apiKeySignupUrl ?? OPENROUTER_DEFAULT_METADATA.apiKeySignupUrl!;
  const envVar = providerApiKeyEnvVar(provider);

  const apiKeyStep: RunStep = {
    title: 'Set your API key',
    hint: (
      <>
        Create a key at <KeysLink url={signupUrl} />, then paste this into your terminal with your
        real key.
      </>
    ),
    language: 'bash',
    code: `export ${envVar}="sk-or-v1-...your-key..."`,
  };

  return {
    curl: [
      apiKeyStep,
      {
        title: 'Run the request',
        hint: 'Reads the key from your environment — nothing to edit.',
        language: 'bash',
        code: `curl ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $${envVar}" \\
  -d '{
    "model": "${modelId}",
    "messages": [
      { "role": "user", "content": "Hello, how are you?" }
    ]
  }'`,
      },
    ],
    nodejs: [
      apiKeyStep,
      {
        title: 'Install the OpenAI SDK',
        hint: `${provider.displayName} speaks the OpenAI API format.`,
        language: 'bash',
        code: 'npm install openai',
      },
      {
        title: 'Save as app.mjs and run it',
        hint: 'Then run: node app.mjs',
        language: 'javascript',
        code: `import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: process.env.${envVar},
});

const completion = await openai.chat.completions.create({
  model: "${modelId}",
  messages: [{ role: "user", content: "Hello, how are you?" }],
});

console.log(completion.choices[0].message.content);`,
      },
    ],
    python: [
      apiKeyStep,
      {
        title: 'Install the OpenAI SDK',
        hint: `${provider.displayName} speaks the OpenAI API format.`,
        language: 'bash',
        code: 'pip install openai',
      },
      {
        title: 'Save as main.py and run it',
        hint: 'Then run: python main.py',
        language: 'python',
        code: `import os
from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key=os.environ["${envVar}"],
)

completion = client.chat.completions.create(
    model="${modelId}",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(completion.choices[0].message.content)`,
      },
    ],
  };
}

const TABS: { key: Language; label: string; icon: ReactNode }[] = [
  { key: 'curl', label: 'cURL', icon: <Terminal className="h-4 w-4" /> },
  { key: 'nodejs', label: 'Node.js', icon: <Code className="h-4 w-4" /> },
  { key: 'python', label: 'Python', icon: <Code className="h-4 w-4" /> },
];

export function CodeSnippets({ modelId, provider }: CodeSnippetsProps) {
  const [activeTab, setActiveTab] = useState<Language>('curl');
  const [copiedKeys, setCopiedKeys] = useState<ReadonlySet<string>>(new Set());
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const { copy } = useCopyToClipboard();
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const resolvedProvider = provider ?? OPENROUTER_DEFAULT_METADATA;
  const allSteps = buildSteps(modelId, resolvedProvider);
  const steps = allSteps[activeTab];
  const doneCount = steps.filter((_, i) => copiedKeys.has(`${activeTab}:${i}`)).length;

  const handleCopy = async (key: string, code: string) => {
    const ok = await copy(code);
    if (!ok) return;
    setCopiedKeys((prev) => new Set(prev).add(key));
    setFlashKey(key);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashKey(null), 2000);
  };

  return (
    <section
      aria-label="Quick Start"
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-500"
    >
      {/* Terminal window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
        </span>
        <h2 className="ml-1 text-sm font-semibold">Quick Start</h2>
        <span className="hidden truncate font-mono text-xs text-muted-foreground sm:inline">
          ~/run-{modelId.split('/').pop() ?? modelId}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div
            className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={doneCount}
            aria-label={`${doneCount} of ${steps.length} steps copied`}
          >
            <div
              className="h-full rounded-full bg-[var(--highlight)] transition-all duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {doneCount}/{steps.length}
          </span>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {/* Language tabs */}
        <div
          className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1"
          role="tablist"
          aria-label="Language"
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 font-mono text-sm transition-colors ${
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Steps */}
        <ol className="space-y-5">
          {steps.map((step, i) => {
            const key = `${activeTab}:${i}`;
            const isDone = copiedKeys.has(key);
            const justCopied = flashKey === key;
            return (
              <li
                key={key}
                className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-500"
                style={{ animationDelay: `${75 * (i + 1)}ms` }}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border font-mono text-xs ${
                    isDone
                      ? 'border-[var(--highlight)] text-[var(--highlight)]'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-medium">
                    {step.title}
                    <span
                      role="status"
                      className={`ml-2 font-mono text-xs font-normal text-[var(--highlight)] transition-opacity ${
                        justCopied ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      copied
                    </span>
                  </p>
                  {step.hint && (
                    <p className="text-xs leading-relaxed text-muted-foreground">{step.hint}</p>
                  )}
                  <div className="group relative overflow-hidden rounded-lg border border-border">
                    <button
                      onClick={() => handleCopy(key, step.code)}
                      aria-label={`Copy: ${step.title}`}
                      className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                        isDone
                          ? 'text-[var(--highlight)]'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <Highlight theme={themes.nightOwl} code={step.code} language={prismLanguageMap[step.language as Language] ?? step.language}>
                      {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                          className={`${className} overflow-x-auto p-4 pr-12 text-[13px] leading-relaxed`}
                          style={{ ...style, margin: 0 }}
                        >
                          {tokens.map((line, li) => (
                            <div key={li} {...getLineProps({ line })}>
                              {line.map((token, tk) => (
                                <span key={tk} {...getTokenProps({ token })} />
                              ))}
                            </div>
                          ))}
                        </pre>
                      )}
                    </Highlight>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Completion state */}
        {doneCount === steps.length && (
          <p className="flex items-center gap-2 rounded-lg border border-[var(--highlight)]/40 bg-muted/40 px-3 py-2.5 text-sm animate-in fade-in duration-300">
            <CircleCheck className="h-4 w-4 shrink-0 text-[var(--highlight)]" aria-hidden="true" />
            All set — paste the blocks in your terminal in order and the last one answers.
          </p>
        )}
      </div>
    </section>
  );
}
