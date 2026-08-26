export const HARNESS_IDS = ['claude-code', 'pi', 'opencode', 'codex'] as const;
export type HarnessId = (typeof HARNESS_IDS)[number];

export const PROVIDER_IDS = [
  'openrouter',
  'google',
  'mistral',
  'nvidia-nim',
  'groq',
  'cerebras',
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type CompatibilityStatus = 'supported' | 'experimental' | 'unsupported';
export type RecipeSnippetLanguage = 'shell' | 'json' | 'toml' | 'text';

export interface RecipeSnippet {
  id: string;
  label: string;
  language: RecipeSnippetLanguage;
  content: string;
}

export interface RecipeStep {
  id: string;
  title: string;
  description: string;
  snippets: RecipeSnippet[];
}

export interface CompatibilityEntry {
  providerId: ProviderId;
  harnessId: HarnessId;
  status: CompatibilityStatus;
  harnessProviderId: string;
  docsUrl: string;
  lastVerified: '2026-08-26';
  caveats?: string[];
  minimumKnownVersion?: string;
}

export interface HarnessRecipe {
  harnessId: HarnessId;
  providerId: string;
  harnessProviderId: string | null;
  status: CompatibilityStatus;
  /** The model ID from the provider catalog, before harness-specific mapping. */
  sourceModelId: string;
  /** The exact model ID passed to the selected harness. */
  modelId: string;
  steps: RecipeStep[];
  snippets: RecipeSnippet[];
  caveats?: string[];
  minimumKnownVersion?: string;
  docsUrl: string;
  lastVerified: '2026-08-26';
}

export type RecipeModel = string | { id: string };

const LAST_VERIFIED = '2026-08-26' as const;

const HARNESS_DOCS: Record<HarnessId, string> = {
  'claude-code': 'https://code.claude.com/docs/en/llm-gateway',
  pi: 'https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md',
  opencode: 'https://opencode.ai/docs/providers/',
  codex: 'https://developers.openai.com/codex/config-advanced/',
};

const API_KEY_ENV: Record<ProviderId, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  google: 'GEMINI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  'nvidia-nim': 'NVIDIA_API_KEY',
  groq: 'GROQ_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
};

const PROVIDER_BASE_URL: Record<ProviderId, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai',
  mistral: 'https://api.mistral.ai/v1',
  'nvidia-nim': 'https://integrate.api.nvidia.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  cerebras: 'https://api.cerebras.ai/v1',
};

const OPENROUTER_CLAUDE_CAVEAT =
  'Only Anthropic Claude models are known to work through this gateway; other OpenRouter models are unsupported for Claude Code.';

function entry(
  providerId: ProviderId,
  harnessId: HarnessId,
  status: CompatibilityStatus,
  options: Pick<CompatibilityEntry, 'harnessProviderId'> &
    Partial<Pick<CompatibilityEntry, 'caveats' | 'minimumKnownVersion'>>,
): CompatibilityEntry {
  return {
    providerId,
    harnessId,
    status,
    ...options,
    docsUrl: HARNESS_DOCS[harnessId],
    lastVerified: LAST_VERIFIED,
  };
}

/**
 * The complete supported-provider matrix. Keep every pair explicit so adding a
 * provider or harness cannot silently inherit another provider's recipe.
 */
export const COMPATIBILITY_REGISTRY = {
  'claude-code': {
    openrouter: entry('openrouter', 'claude-code', 'experimental', {
      harnessProviderId: 'openrouter',
      caveats: [OPENROUTER_CLAUDE_CAVEAT],
    }),
    google: entry('google', 'claude-code', 'unsupported', { harnessProviderId: 'google' }),
    mistral: entry('mistral', 'claude-code', 'unsupported', { harnessProviderId: 'mistral' }),
    'nvidia-nim': entry('nvidia-nim', 'claude-code', 'unsupported', {
      harnessProviderId: 'nvidia',
    }),
    groq: entry('groq', 'claude-code', 'unsupported', { harnessProviderId: 'groq' }),
    cerebras: entry('cerebras', 'claude-code', 'unsupported', {
      harnessProviderId: 'cerebras',
    }),
  },
  pi: {
    openrouter: entry('openrouter', 'pi', 'supported', { harnessProviderId: 'openrouter' }),
    google: entry('google', 'pi', 'supported', { harnessProviderId: 'google' }),
    mistral: entry('mistral', 'pi', 'supported', { harnessProviderId: 'mistral' }),
    'nvidia-nim': entry('nvidia-nim', 'pi', 'supported', { harnessProviderId: 'nvidia' }),
    groq: entry('groq', 'pi', 'supported', { harnessProviderId: 'groq' }),
    cerebras: entry('cerebras', 'pi', 'supported', { harnessProviderId: 'cerebras' }),
  },
  opencode: {
    openrouter: entry('openrouter', 'opencode', 'supported', { harnessProviderId: 'openrouter' }),
    google: entry('google', 'opencode', 'supported', { harnessProviderId: 'google' }),
    mistral: entry('mistral', 'opencode', 'supported', { harnessProviderId: 'mistral' }),
    'nvidia-nim': entry('nvidia-nim', 'opencode', 'supported', { harnessProviderId: 'nvidia' }),
    groq: entry('groq', 'opencode', 'supported', { harnessProviderId: 'groq' }),
    cerebras: entry('cerebras', 'opencode', 'supported', { harnessProviderId: 'cerebras' }),
  },
  codex: {
    openrouter: entry('openrouter', 'codex', 'supported', { harnessProviderId: 'openrouter' }),
    google: entry('google', 'codex', 'unsupported', { harnessProviderId: 'google' }),
    mistral: entry('mistral', 'codex', 'supported', { harnessProviderId: 'mistral' }),
    'nvidia-nim': entry('nvidia-nim', 'codex', 'unsupported', { harnessProviderId: 'nvidia' }),
    groq: entry('groq', 'codex', 'experimental', {
      harnessProviderId: 'groq',
      caveats: ['Tool calls, streaming, and multi-turn Responses behavior still require manual verification.'],
    }),
    cerebras: entry('cerebras', 'codex', 'unsupported', { harnessProviderId: 'cerebras' }),
  },
} as const satisfies Record<HarnessId, Record<ProviderId, CompatibilityEntry>>;

function modelIdOf(model: RecipeModel): string {
  return typeof model === 'string' ? model : model.id;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function tomlString(value: string): string {
  let escaped = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    switch (character) {
      case '\\':
        escaped += '\\\\';
        break;
      case '"':
        escaped += '\\"';
        break;
      case '\b':
        escaped += '\\b';
        break;
      case '\t':
        escaped += '\\t';
        break;
      case '\n':
        escaped += '\\n';
        break;
      case '\f':
        escaped += '\\f';
        break;
      case '\r':
        escaped += '\\r';
        break;
      default:
        escaped +=
          codePoint < 0x20 || codePoint === 0x7f
            ? `\\u${codePoint.toString(16).padStart(4, '0')}`
            : character;
    }
  }
  return `"${escaped}"`;
}

function jsonSnippet(value: Record<string, string>): string {
  return JSON.stringify(value, null, 2);
}

function envCheck(envVar: string): RecipeSnippet {
  return {
    id: 'credentials',
    label: 'Check the API key environment variable',
    language: 'shell',
    content: `test -n "$${envVar}" || { printf '%s\\n' 'Set ${envVar} before continuing.' >&2; exit 1; }`,
  };
}

function unsupportedCaveats(entryForPair: CompatibilityEntry, providerId: string): string[] {
  return [
    ...(entryForPair.caveats ?? []),
    `There is no documented direct ${entryForPair.harnessId} integration for provider "${providerId}". Use the official documentation to evaluate a compatible route.`,
  ];
}

function claudeCodeSteps(providerId: ProviderId, modelId: string): RecipeStep[] {
  const model = shellQuote(modelId);
  const envVar = API_KEY_ENV[providerId];
  return [
    {
      id: 'configure-gateway',
      title: 'Configure the Anthropic gateway',
      description: 'Keep the API key in your environment and point Claude Code at the gateway.',
      snippets: [
        envCheck(envVar),
        {
          id: 'gateway-environment',
          label: 'Set gateway environment variables',
          language: 'shell',
          content: [
            `export ANTHROPIC_BASE_URL=${shellQuote(PROVIDER_BASE_URL[providerId].replace('/v1', ''))}`,
            `export ANTHROPIC_AUTH_TOKEN="$${envVar}"`,
            `export ANTHROPIC_MODEL=${model}`,
          ].join('\n'),
        },
      ],
    },
    {
      id: 'run',
      title: 'Start Claude Code',
      description: 'Claude Code reads the gateway settings from the current shell.',
      snippets: [{ id: 'run', label: 'Start Claude Code', language: 'shell', content: 'claude' }],
    },
  ];
}

function piSteps(entryForPair: CompatibilityEntry, modelId: string): RecipeStep[] {
  const envVar = API_KEY_ENV[entryForPair.providerId];
  return [
    {
      id: 'authenticate',
      title: 'Authenticate with the provider',
      description: 'Use Pi login or make the provider key available as an environment variable.',
      snippets: [
        envCheck(envVar),
        { id: 'login', label: 'Open Pi provider login', language: 'text', content: '/login' },
      ],
    },
    {
      id: 'run',
      title: 'Run the model',
      description: 'Pi uses the canonical model ID exactly as published by the provider.',
      snippets: [
        {
          id: 'run',
          label: 'Start Pi with this model',
          language: 'shell',
          content: `pi --provider ${shellQuote(entryForPair.harnessProviderId)} --model ${shellQuote(modelId)}`,
        },
      ],
    },
  ];
}

function harnessModelId(entryForPair: CompatibilityEntry, modelId: string): string {
  if (entryForPair.harnessId !== 'opencode') return modelId;
  const sourceModel =
    entryForPair.providerId === 'openrouter' && modelId.startsWith('openrouter/')
      ? modelId.slice('openrouter/'.length)
      : modelId;
  return `${entryForPair.harnessProviderId}/${sourceModel}`;
}

function opencodeSteps(entryForPair: CompatibilityEntry, modelId: string): RecipeStep[] {
  const envVar = API_KEY_ENV[entryForPair.providerId];
  const opencodeModel = harnessModelId(entryForPair, modelId);
  return [
    {
      id: 'connect',
      title: 'Connect the provider',
      description: 'Open OpenCode and use its provider connection flow.',
      snippets: [
        envCheck(envVar),
        { id: 'connect', label: 'Connect a provider', language: 'text', content: '/connect' },
        { id: 'models', label: 'List available models', language: 'text', content: '/models' },
        {
          id: 'config',
          label: 'Optional model configuration',
          language: 'json',
          content: jsonSnippet({ model: opencodeModel }),
        },
      ],
    },
    {
      id: 'run',
      title: 'Run the model',
      description: 'The provider prefix keeps the harness route explicit.',
      snippets: [
        {
          id: 'run',
          label: 'Start OpenCode with this model',
          language: 'shell',
          content: `opencode --model ${shellQuote(opencodeModel)}`,
        },
      ],
    },
  ];
}

function codexSteps(entryForPair: CompatibilityEntry, modelId: string): RecipeStep[] {
  const providerId = entryForPair.harnessProviderId;
  const envVar = API_KEY_ENV[entryForPair.providerId];
  return [
    {
      id: 'configure',
      title: 'Merge a custom provider into Codex config',
      description: 'Add this table to ~/.codex/config.toml; do not overwrite your existing file.',
      snippets: [
        envCheck(envVar),
        {
          id: 'config',
          label: 'Add provider configuration to ~/.codex/config.toml',
          language: 'toml',
          content: [
            `model_provider = ${tomlString(providerId)}`,
            '',
            `[model_providers.${providerId}]`,
            `name = ${tomlString(providerId)}`,
            `base_url = ${tomlString(PROVIDER_BASE_URL[entryForPair.providerId])}`,
            `env_key = ${tomlString(envVar)}`,
            'wire_api = "responses"',
          ].join('\n'),
        },
      ],
    },
    {
      id: 'run',
      title: 'Run the model',
      description: 'Codex uses the Responses API for custom providers.',
      snippets: [
        {
          id: 'run',
          label: 'Start Codex with this model',
          language: 'shell',
          content: `codex --model ${shellQuote(modelId)}`,
        },
      ],
    },
  ];
}

function knownEntry(harnessId: HarnessId, providerId: string): CompatibilityEntry | null {
  if (!PROVIDER_IDS.includes(providerId as ProviderId)) return null;
  return COMPATIBILITY_REGISTRY[harnessId][providerId as ProviderId];
}

function modelSupportsClaudeCode(providerId: string, modelId: string): boolean {
  return providerId === 'openrouter' && /^anthropic\/claude(?:[-/]|$)/.test(modelId);
}

/**
 * Generate a deterministic recipe without reading browser, environment, or
 * provider state. Unknown providers intentionally get an unsupported recipe.
 */
export function generateHarnessRecipe(
  harnessId: HarnessId,
  providerId: string,
  model: RecipeModel,
): HarnessRecipe {
  const modelId = modelIdOf(model);
  const pair = knownEntry(harnessId, providerId);

  if (!pair) {
    const fallback: HarnessRecipe = {
      harnessId,
      providerId,
      harnessProviderId: null,
      status: 'unsupported',
      sourceModelId: modelId,
      modelId,
      steps: [],
      snippets: [],
      caveats: [
        `Provider "${providerId}" is not in the compatibility registry. It is unsupported until explicitly verified.`,
      ],
      docsUrl: HARNESS_DOCS[harnessId],
      lastVerified: LAST_VERIFIED,
    };
    return fallback;
  }

  const modelAllowed =
    harnessId !== 'claude-code' || pair.status === 'unsupported' || modelSupportsClaudeCode(providerId, modelId);
  const status = modelAllowed ? pair.status : 'unsupported';
  const caveats = modelAllowed ? pair.caveats : unsupportedCaveats(pair, providerId);
  const exactHarnessModelId = harnessModelId(pair, modelId);
  const steps =
    status === 'unsupported'
      ? []
      : harnessId === 'claude-code'
        ? claudeCodeSteps(pair.providerId, modelId)
        : harnessId === 'pi'
          ? piSteps(pair, modelId)
          : harnessId === 'opencode'
            ? opencodeSteps(pair, modelId)
            : codexSteps(pair, modelId);

  return {
    harnessId,
    providerId,
    harnessProviderId: pair.harnessProviderId,
    status,
    sourceModelId: modelId,
    modelId: exactHarnessModelId,
    steps,
    snippets: steps.flatMap((step) => step.snippets),
    ...(caveats && caveats.length > 0 ? { caveats: [...caveats] } : {}),
    ...(pair.minimumKnownVersion ? { minimumKnownVersion: pair.minimumKnownVersion } : {}),
    docsUrl: pair.docsUrl,
    lastVerified: pair.lastVerified,
  };
}
