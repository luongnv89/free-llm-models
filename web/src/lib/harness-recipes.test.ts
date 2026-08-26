import { describe, expect, it } from 'vitest';
import {
  COMPATIBILITY_REGISTRY,
  HARNESS_IDS,
  PROVIDER_IDS,
  generateHarnessRecipe,
  type CompatibilityStatus,
  type HarnessId,
  type ProviderId,
} from './harness-recipes';

const MODEL_ID = 'owner/model';
const EXPECTED: Array<{ harnessId: HarnessId; providerId: ProviderId; status: CompatibilityStatus }> = [
  ...(['openrouter', 'google', 'mistral', 'nvidia-nim', 'groq', 'cerebras'] as ProviderId[]).map((providerId) => ({
    harnessId: 'claude-code' as const,
    providerId,
    status: providerId === 'openrouter' ? 'experimental' as const : 'unsupported' as const,
  })),
  ...PROVIDER_IDS.map((providerId) => ({ harnessId: 'pi' as const, providerId, status: 'supported' as const })),
  ...PROVIDER_IDS.map((providerId) => ({ harnessId: 'opencode' as const, providerId, status: 'supported' as const })),
  ...PROVIDER_IDS.map((providerId) => ({
    harnessId: 'codex' as const,
    providerId,
    status: providerId === 'google' || providerId === 'nvidia-nim' || providerId === 'cerebras'
      ? 'unsupported' as const
      : providerId === 'groq' ? 'experimental' as const : 'supported' as const,
  })),
];

describe('harness compatibility registry', () => {
  it.each(EXPECTED)('records $providerId × $harnessId as $status', (expected) => {
    expect(COMPATIBILITY_REGISTRY[expected.harnessId][expected.providerId]).toMatchObject(expected);
  });

  it('has exactly one provenance-backed entry for all 24 combinations', () => {
    const entries = HARNESS_IDS.flatMap((harnessId) => PROVIDER_IDS.map((providerId) => COMPATIBILITY_REGISTRY[harnessId][providerId]));
    expect(entries).toHaveLength(24);
    expect(new Set(entries.map((entry) => `${entry.providerId}:${entry.harnessId}`)).size).toBe(24);
    expect(entries.every((entry) => entry.lastVerified === '2026-08-26')).toBe(true);
    expect(entries.every((entry) => entry.providerSignupUrl.startsWith('https://'))).toBe(true);
    expect(entries.every((entry) => entry.providerDocsUrl.startsWith('https://'))).toBe(true);
  });
});

describe('generateHarnessRecipe', () => {
  it('maps NVIDIA for Pi and OpenCode while preserving the source model ID', () => {
    const pi = generateHarnessRecipe('pi', 'nvidia-nim', MODEL_ID);
    const opencode = generateHarnessRecipe('opencode', 'nvidia-nim', MODEL_ID);
    expect(pi).toMatchObject({ providerId: 'nvidia-nim', harnessProviderId: 'nvidia', sourceModelId: MODEL_ID, modelId: MODEL_ID });
    expect(pi.snippets.find((snippet) => snippet.id === 'run')?.content).toContain("--provider 'nvidia'");
    expect(opencode).toMatchObject({ sourceModelId: MODEL_ID, modelId: 'nvidia/owner/model' });
    expect(opencode.snippets.find((snippet) => snippet.id === 'run')?.content).toContain("'nvidia/owner/model'");
  });

  it('adds the OpenRouter namespace once for OpenCode nested IDs', () => {
    expect(generateHarnessRecipe('opencode', 'openrouter', 'anthropic/claude-3').modelId).toBe('openrouter/anthropic/claude-3');
    expect(generateHarnessRecipe('opencode', 'openrouter', 'openrouter/anthropic/claude-3').modelId).toBe('openrouter/anthropic/claude-3');
  });

  it('only advertises Claude Code for eligible Anthropic OpenRouter models', () => {
    expect(generateHarnessRecipe('claude-code', 'openrouter', 'anthropic/claude-3').status).toBe('experimental');
    const unsupported = generateHarnessRecipe('claude-code', 'openrouter', 'google/gemini-2');
    expect(unsupported.status).toBe('unsupported');
    expect(unsupported.steps).toEqual([]);
    expect(unsupported.snippets).toEqual([]);
  });

  it('returns an explicit unsupported result for unknown providers', () => {
    for (const harnessId of HARNESS_IDS) {
      const recipe = generateHarnessRecipe(harnessId, 'future-provider', MODEL_ID);
      expect(recipe).toMatchObject({ harnessId, providerId: 'future-provider', status: 'unsupported', modelId: MODEL_ID, steps: [], snippets: [], copyAll: null, copyAllSafe: false, provenance: null });
      expect(recipe.caveats?.join(' ')).toContain('future-provider');
      expect(recipe.docsUrl).not.toContain('openrouter');
    }
  });

  it('renders ordered steps with unique copy targets and provenance', () => {
    for (const expected of EXPECTED) {
      const recipe = generateHarnessRecipe(expected.harnessId, expected.providerId, expected.harnessId === 'claude-code' ? 'anthropic/claude-3' : MODEL_ID);
      expect(recipe.lastVerified).toBe('2026-08-26');
      expect(recipe.provenance?.harnessDocsUrl).toBe(recipe.docsUrl);
      expect(recipe.snippets).toEqual(recipe.steps.flatMap((step) => step.snippets));
      expect(new Set(recipe.snippets.map((snippet) => snippet.id)).size).toBe(recipe.snippets.length);
      if (expected.status === 'unsupported') {
        expect(recipe.steps).toEqual([]);
      } else {
        expect(recipe.steps.length).toBeGreaterThan(0);
      }
    }
  });

  it('only enables Copy all when all targets are safe shell commands', () => {
    expect(generateHarnessRecipe('claude-code', 'openrouter', 'anthropic/claude-3').copyAllSafe).toBe(true);
    for (const pair of [
      ['pi', 'google'], ['opencode', 'google'], ['codex', 'openrouter'],
    ] as const) {
      const recipe = generateHarnessRecipe(pair[0], pair[1], MODEL_ID);
      expect(recipe.copyAllSafe).toBe(false);
      expect(recipe.copyAll).toBeNull();
    }
  });

  it('uses environment references and mergeable Codex TOML without overwrite commands', () => {
    const codex = generateHarnessRecipe('codex', 'openrouter', MODEL_ID);
    const config = codex.snippets.find((snippet) => snippet.language === 'toml')?.content;
    expect(config).toContain('wire_api = "responses"');
    expect(config).toContain('[model_providers.openrouter]');
    expect(config).not.toMatch(/(^|\n)\s*(cat|tee)\s+.*[>]/);
    expect(codex.snippets.some((snippet) => snippet.content.includes('$OPENROUTER_API_KEY'))).toBe(true);
  });

  it('serializes hostile IDs safely and remains deterministic', () => {
    const hostile = `owner/"quoted'\\model\n\u0007`;
    const openCode = generateHarnessRecipe('opencode', 'openrouter', hostile);
    const codex = generateHarnessRecipe('codex', 'openrouter', hostile);
    const json = openCode.snippets.find((snippet) => snippet.language === 'json')?.content;
    expect(() => JSON.parse(json!)).not.toThrow();
    expect(codex.snippets.find((snippet) => snippet.id === 'run')?.content).toContain("'\"'\"'");
    expect([...openCode.snippets, ...codex.snippets].some((snippet) => snippet.content.includes('sk-'))).toBe(false);
    expect(generateHarnessRecipe('codex', 'openrouter', hostile)).toEqual(codex);
  });
});
