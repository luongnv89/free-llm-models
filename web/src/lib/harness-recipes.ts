export const HARNESS_IDS = ['claude-code', 'pi', 'opencode', 'codex'] as const;
export type HarnessId = (typeof HARNESS_IDS)[number];

export const PROVIDER_IDS = [
  'openrouter',
  'google',
  'mistral',
  'nvidia-nim',
  'groq',
  'cerebras',
  'huggingface',
  'github-models',
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

export interface RecipeProvenance {
  providerDisplayName: string;
  providerSignupUrl: string;
  providerDocsUrl: string;
  harnessDocsUrl: string;
  verificationDate: '2026-08-27';
}

export interface CompatibilityEntry {
  providerId: ProviderId;
  harnessId: HarnessId;
  status: CompatibilityStatus;
  harnessProviderId: string;
  docsUrl: string;
  providerSignupUrl: string;
  providerDocsUrl: string;
  lastVerified: '2026-08-27';
  caveats?: string[];
  minimumKnownVersion?: string;
}

export interface HarnessRecipe {
  harnessId: HarnessId;
  providerId: string;
  harnessProviderId: string | null;
  status: CompatibilityStatus;
  sourceModelId: string;
  modelId: string;
  steps: RecipeStep[];
  snippets: RecipeSnippet[];
  /** Non-null only when joining every snippet is safe and useful. */
  copyAll: string | null;
  copyAllSafe: boolean;
  caveats?: string[];
  providerSignupUrl?: string;
  providerDocsUrl?: string;
  minimumKnownVersion?: string;
  docsUrl: string;
  lastVerified: '2026-08-27';
  provenance: RecipeProvenance | null;
}

export type RecipeModel = string | { id: string };

const LAST_VERIFIED = '2026-08-27' as const;

const HARNESS_DOCS: Record<HarnessId, string> = {
  'claude-code': 'https://code.claude.com/docs/en/llm-gateway',
  pi: 'https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md',
  opencode: 'https://opencode.ai/docs/providers/',
  codex: 'https://developers.openai.com/codex/config-advanced/',
};

const HARNESS_LABELS: Record<HarnessId, string> = {
  'claude-code': 'Claude Code',
  pi: 'Pi',
  opencode: 'OpenCode',
  codex: 'Codex CLI',
};

const PROVIDER_INFO: Record<ProviderId, Omit<RecipeProvenance, 'harnessDocsUrl' | 'verificationDate'>> = {
  openrouter: {
    providerDisplayName: 'OpenRouter',
    providerSignupUrl: 'https://openrouter.ai/keys',
    providerDocsUrl: 'https://openrouter.ai/docs',
  },
  google: {
    providerDisplayName: 'Google AI Studio',
    providerSignupUrl: 'https://aistudio.google.com/apikey',
    providerDocsUrl: 'https://ai.google.dev/gemini-api/docs',
  },
  mistral: {
    providerDisplayName: 'Mistral AI',
    providerSignupUrl: 'https://console.mistral.ai',
    providerDocsUrl: 'https://docs.mistral.ai',
  },
  'nvidia-nim': {
    providerDisplayName: 'NVIDIA NIM',
    providerSignupUrl: 'https://build.nvidia.com',
    providerDocsUrl: 'https://docs.api.nvidia.com',
  },
  groq: {
    providerDisplayName: 'Groq',
    providerSignupUrl: 'https://console.groq.com/keys',
    providerDocsUrl: 'https://console.groq.com/docs',
  },
  cerebras: {
    providerDisplayName: 'Cerebras',
    providerSignupUrl: 'https://cloud.cerebras.ai',
    providerDocsUrl: 'https://inference-docs.cerebras.ai',
  },
  huggingface: {
    providerDisplayName: 'Hugging Face',
    providerSignupUrl: 'https://huggingface.co/settings/tokens',
    providerDocsUrl: 'https://huggingface.co/docs/router/quickstart',
  },
  'github-models': {
    providerDisplayName: 'GitHub Models',
    providerSignupUrl: 'https://github.com/settings/tokens',
    providerDocsUrl: 'https://docs.github.com/en/github-models',
  },
};

const API_KEY_ENV: Record<ProviderId, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  google: 'GEMINI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  'nvidia-nim': 'NVIDIA_API_KEY',
  groq: 'GROQ_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  huggingface: 'HF_TOKEN',
  'github-models': 'GITHUB_TOKEN',
};

const PROVIDER_BASE_URL: Record<ProviderId, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai',
  mistral: 'https://api.mistral.ai/v1',
  'nvidia-nim': 'https://integrate.api.nvidia.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  huggingface: 'https://router.huggingface.co/v1',
  'github-models': 'https://models.github.ai/v1',
};

const OPENROUTER_CLAUDE_CAVEAT =
  'Only Anthropic Claude models are known to work through this gateway; other OpenRouter models are unsupported for Claude Code.';

function entry(
  providerId: ProviderId,
  harnessId: HarnessId,
  status: CompatibilityStatus,
  harnessProviderId: string,
  caveats?: string[],
): CompatibilityEntry {
  const info = PROVIDER_INFO[providerId];
  return {
    providerId,
    harnessId,
    status,
    harnessProviderId,
    docsUrl: HARNESS_DOCS[harnessId],
    providerSignupUrl: info.providerSignupUrl,
    providerDocsUrl: info.providerDocsUrl,
    lastVerified: LAST_VERIFIED,
    ...(caveats ? { caveats } : {}),
  };
}

export const COMPATIBILITY_REGISTRY = {
  'claude-code': {
    openrouter: entry('openrouter', 'claude-code', 'experimental', 'openrouter', [OPENROUTER_CLAUDE_CAVEAT]),
    google: entry('google', 'claude-code', 'unsupported', 'google'),
    mistral: entry('mistral', 'claude-code', 'unsupported', 'mistral'),
    'nvidia-nim': entry('nvidia-nim', 'claude-code', 'unsupported', 'nvidia'),
    groq: entry('groq', 'claude-code', 'unsupported', 'groq'),
    cerebras: entry('cerebras', 'claude-code', 'unsupported', 'cerebras'),
    huggingface: entry('huggingface', 'claude-code', 'unsupported', 'huggingface'),
    'github-models': entry('github-models', 'claude-code', 'unsupported', 'github'),
  },
  pi: {
    openrouter: entry('openrouter', 'pi', 'supported', 'openrouter'),
    google: entry('google', 'pi', 'supported', 'google'),
    mistral: entry('mistral', 'pi', 'supported', 'mistral'),
    'nvidia-nim': entry('nvidia-nim', 'pi', 'supported', 'nvidia'),
    groq: entry('groq', 'pi', 'supported', 'groq'),
    cerebras: entry('cerebras', 'pi', 'supported', 'cerebras'),
    huggingface: entry('huggingface', 'pi', 'supported', 'huggingface'),
    'github-models': entry('github-models', 'pi', 'supported', 'github'),
  },
  opencode: {
    openrouter: entry('openrouter', 'opencode', 'supported', 'openrouter'),
    google: entry('google', 'opencode', 'supported', 'google'),
    mistral: entry('mistral', 'opencode', 'supported', 'mistral'),
    'nvidia-nim': entry('nvidia-nim', 'opencode', 'supported', 'nvidia'),
    groq: entry('groq', 'opencode', 'supported', 'groq'),
    cerebras: entry('cerebras', 'opencode', 'supported', 'cerebras'),
    huggingface: entry('huggingface', 'opencode', 'supported', 'huggingface'),
    'github-models': entry('github-models', 'opencode', 'supported', 'github'),
  },
  codex: {
    openrouter: entry('openrouter', 'codex', 'supported', 'openrouter'),
    google: entry('google', 'codex', 'supported', 'google'),
    mistral: entry('mistral', 'codex', 'supported', 'mistral'),
    'nvidia-nim': entry('nvidia-nim', 'codex', 'supported', 'nvidia'),
    groq: entry('groq', 'codex', 'experimental', 'groq', [
      'Tool calls, streaming, and multi-turn Responses behavior still require manual verification.',
    ]),
    cerebras: entry('cerebras', 'codex', 'supported', 'cerebras'),
    huggingface: entry('huggingface', 'codex', 'supported', 'huggingface'),
    'github-models': entry('github-models', 'codex', 'supported', 'github'),
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
      case '\\': escaped += '\\\\'; break;
      case '"': escaped += '\\"'; break;
      case '\b': escaped += '\\b'; break;
      case '\t': escaped += '\\t'; break;
      case '\n': escaped += '\\n'; break;
      case '\f': escaped += '\\f'; break;
      case '\r': escaped += '\\r'; break;
      default:
        escaped += codePoint < 0x20 || codePoint === 0x7f
          ? `\\u${codePoint.toString(16).padStart(4, '0')}`
          : character;
    }
  }
  return `"${escaped}"`;
}

function jsonSnippet(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function envCheck(envVar: string): RecipeSnippet {
  return {
    id: 'credentials',
    label: `Check ${envVar}`,
    language: 'shell',
    content: `test -n "$${envVar}" || { printf '%s\\n' 'Set ${envVar} before continuing.' >&2; exit 1; }`,
  };
}

function unsupportedCaveat(pair: CompatibilityEntry, providerId: string): string[] {
  return [
    ...(pair.caveats ?? []),
    `There is no documented direct ${HARNESS_LABELS[pair.harnessId]} integration for ${providerId}; the provider and harness use different protocols or have not been verified together.`,
  ];
}

function claudeCodeSteps(providerId: ProviderId, modelId: string): RecipeStep[] {
  const envVar = API_KEY_ENV[providerId];
  return [
    {
      id: 'use-api-key',
      title: '1. Use API key',
      description: `Point Claude Code at ${PROVIDER_INFO[providerId].providerDisplayName} using its OpenAI-compatible endpoint.`,
      snippets: [
        envCheck(envVar),
        {
          id: 'provider-config',
          label: `Run with ${PROVIDER_INFO[providerId].providerDisplayName}`,
          language: 'shell',
          content: [
            `export OPENAI_BASE_URL=${shellQuote(PROVIDER_BASE_URL[providerId])}`,
            `export OPENAI_API_KEY="$${envVar}"`,
            `claude --model ${shellQuote(modelId)}`,
          ].join('\n'),
        },
      ],
    },
    {
      id: 'use-login',
      title: '2. Use connect/login',
      description: 'Use Claude Code\'s built-in authentication to connect to the provider.',
      snippets: [
        { id: 'login', label: 'Start Claude Code and authenticate', language: 'text', content: 'claude' },
        { id: 'login-prompt', label: 'When prompted, enter provider URL and key', language: 'text', content: 'Enter API base URL: ' + PROVIDER_BASE_URL[providerId] + '\nEnter API key: ' + '$' + envVar },
      ],
    },
    {
      id: 'run',
      title: 'Start Claude Code',
      description: 'Claude Code reads these settings from the current shell.',
      snippets: [{ id: 'run', label: 'Start Claude Code', language: 'shell', content: 'claude' }],
    },
  ];
}

function piSteps(pair: CompatibilityEntry, modelId: string): RecipeStep[] {
  const envVar = API_KEY_ENV[pair.providerId];
  return [
    {
      id: 'use-api-key',
      title: '1. Use API key',
      description: `Add ${PROVIDER_INFO[pair.providerId].providerDisplayName} to ~/.pi/agent/models.json.`,
      snippets: [
        envCheck(envVar),
        {
          id: 'provider-config',
          label: `models.json for ${PROVIDER_INFO[pair.providerId].providerDisplayName}`,
          language: 'json',
          content: jsonSnippet({
            providers: {
              [pair.providerId]: {
                baseUrl: PROVIDER_BASE_URL[pair.providerId],
                api: 'openai-completions',
                apiKey: `$${API_KEY_ENV[pair.providerId]}`,
                models: [{ id: modelId, name: modelId }],
              },
            },
          }),
        },
      ],
    },
    {
      id: 'use-login',
      title: '2. Use connect/login',
      description: 'Authenticate with /login, then select the model.',
      snippets: [
        { id: 'login', label: 'Open Pi provider login', language: 'text', content: '/login' },
        { id: 'model-picker', label: 'Open the Pi model picker', language: 'text', content: '/model' },
        {
          id: 'run',
          label: 'Start Pi with this model',
          language: 'shell',
          content: `pi --provider ${shellQuote(pair.harnessProviderId)} --model ${shellQuote(modelId)}`,
        },
      ],
    },
  ];
}

function openCodeModelId(pair: CompatibilityEntry, modelId: string): string {
  const sourceModel = pair.providerId === 'openrouter' && modelId.startsWith('openrouter/')
    ? modelId.slice('openrouter/'.length)
    : modelId;
  return `${pair.harnessProviderId}/${sourceModel}`;
}

function opencodeSteps(pair: CompatibilityEntry, modelId: string): RecipeStep[] {
  const envVar = API_KEY_ENV[pair.providerId];
  const exactModelId = openCodeModelId(pair, modelId);
  return [
    {
      id: 'use-api-key',
      title: '1. Use API key',
      description: `Add ${PROVIDER_INFO[pair.providerId].providerDisplayName} to opencode.json.`,
      snippets: [
        envCheck(envVar),
        {
          id: 'provider-config',
          label: `opencode.json for ${PROVIDER_INFO[pair.providerId].providerDisplayName}`,
          language: 'json',
          content: jsonSnippet({
            providers: {
              [pair.providerId]: {
                type: 'openai',
                apiKey: `$${API_KEY_ENV[pair.providerId]}`,
                apiBase: PROVIDER_BASE_URL[pair.providerId],
              },
            },
          }),
        },
      ],
    },
    {
      id: 'use-login',
      title: '2. Use connect/login',
      description: 'Connect the provider, then select the model.',
      snippets: [
        { id: 'connect', label: 'Connect a provider', language: 'text', content: '/connect' },
        { id: 'models', label: 'List available models', language: 'text', content: '/models' },
        {
          id: 'config',
          label: 'Optional model configuration',
          language: 'json',
          content: jsonSnippet({ model: exactModelId }),
        },
      ],
    },
    {
      id: 'run',
      title: 'Run the model',
      description: 'The provider prefix keeps the route explicit.',
      snippets: [{
        id: 'run',
        label: 'Start OpenCode with this model',
        language: 'shell',
        content: `opencode --model ${shellQuote(exactModelId)}`,
      }],
    },
  ];
}

function codexSteps(pair: CompatibilityEntry, modelId: string): RecipeStep[] {
  const providerId = pair.harnessProviderId;
  const envVar = API_KEY_ENV[pair.providerId];
  return [
    {
      id: 'use-api-key',
      title: '1. Use API key',
      description: `Merge ${PROVIDER_INFO[pair.providerId].providerDisplayName} into ~/.codex/config.toml.`,
      snippets: [
        envCheck(envVar),
        {
          id: 'provider-config',
          label: `config.toml for ${PROVIDER_INFO[pair.providerId].providerDisplayName}`,
          language: 'toml',
          content: [
            `[model_providers.${providerId}]`,
            `name = ${tomlString(PROVIDER_INFO[pair.providerId].providerDisplayName)}`,
            `base_url = ${tomlString(PROVIDER_BASE_URL[pair.providerId])}`,
            `env_key = ${tomlString(envVar)}`,
            'wire_api = "responses"',
            '',
            `[profiles.${providerId}]`,
            `model = ${tomlString(modelId)}`,
            `model_provider = ${tomlString(providerId)}`,
          ].join('\n'),
        },
      ],
    },
    {
      id: 'use-login',
      title: '2. Use connect/login',
      description: 'Use Codex\'s interactive provider setup.',
      snippets: [
        { id: 'connect', label: 'Start Codex and configure provider', language: 'text', content: 'codex --model ' + modelId },
        { id: 'connect-prompt', label: 'When prompted, enter provider details', language: 'text', content: 'Enter API base URL: ' + PROVIDER_BASE_URL[pair.providerId] + '\nEnter API key: ' + '$' + envVar },
      ],
    },
    {
      id: 'run',
      title: 'Run the model',
      description: 'Codex uses the Responses API for these custom providers.',
      snippets: [{
        id: 'run',
        label: 'Start Codex with this model',
        language: 'shell',
        content: `codex --model ${shellQuote(modelId)}`,
      }],
    },
  ];
}

function knownEntry(harnessId: HarnessId, providerId: string): CompatibilityEntry | null {
  return PROVIDER_IDS.includes(providerId as ProviderId)
    ? COMPATIBILITY_REGISTRY[harnessId][providerId as ProviderId]
    : null;
}

function supportsClaudeCode(providerId: string, modelId: string): boolean {
  const sourceModel = modelId.startsWith('openrouter/') ? modelId.slice('openrouter/'.length) : modelId;
  return providerId === 'openrouter' && /^anthropic\/claude(?:[-/]|$)/.test(sourceModel);
}

function provenanceFor(pair: CompatibilityEntry): RecipeProvenance {
  const info = PROVIDER_INFO[pair.providerId];
  return {
    ...info,
    harnessDocsUrl: pair.docsUrl,
    verificationDate: pair.lastVerified,
  };
}

export function generateHarnessRecipe(
  harnessId: HarnessId,
  providerId: string,
  model: RecipeModel,
): HarnessRecipe {
  const sourceModelId = modelIdOf(model);
  const pair = knownEntry(harnessId, providerId);

  if (!pair) {
    return {
      harnessId,
      providerId,
      harnessProviderId: null,
      status: 'unsupported',
      sourceModelId,
      modelId: sourceModelId,
      steps: [],
      snippets: [],
      copyAll: null,
      copyAllSafe: false,
      caveats: [`Provider "${providerId}" is not in the compatibility registry. It is unsupported until explicitly verified.`],
      docsUrl: HARNESS_DOCS[harnessId],
      lastVerified: LAST_VERIFIED,
      provenance: null,
    };
  }

  const modelSupported = harnessId !== 'claude-code' || supportsClaudeCode(providerId, sourceModelId);
  const status = modelSupported ? pair.status : 'unsupported';
  const caveats = modelSupported ? pair.caveats : unsupportedCaveat(pair, providerId);
  const steps = status === 'unsupported'
    ? []
    : harnessId === 'claude-code'
      ? claudeCodeSteps(pair.providerId, sourceModelId)
      : harnessId === 'pi'
        ? piSteps(pair, sourceModelId)
        : harnessId === 'opencode'
          ? opencodeSteps(pair, sourceModelId)
          : codexSteps(pair, sourceModelId);
  const snippets = steps.flatMap((step) => step.snippets);
  const copyAllSafe = harnessId === 'claude-code' && status !== 'unsupported' && snippets.length > 0 && snippets.every((snippet) => snippet.language === 'shell');

  return {
    harnessId,
    providerId,
    harnessProviderId: pair.harnessProviderId,
    status,
    sourceModelId,
    modelId: harnessId === 'opencode' ? openCodeModelId(pair, sourceModelId) : sourceModelId,
    steps,
    snippets,
    copyAll: copyAllSafe ? snippets.map((snippet) => snippet.content).join('\n') : null,
    copyAllSafe,
    ...(caveats?.length ? { caveats: [...caveats] } : {}),
    ...(pair.minimumKnownVersion ? { minimumKnownVersion: pair.minimumKnownVersion } : {}),
    providerSignupUrl: pair.providerSignupUrl,
    providerDocsUrl: pair.providerDocsUrl,
    docsUrl: pair.docsUrl,
    lastVerified: pair.lastVerified,
    provenance: provenanceFor(pair),
  };
}
