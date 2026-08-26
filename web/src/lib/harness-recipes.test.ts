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

const EXPECTED_MATRIX: Array<{
  harnessId: HarnessId;
  providerId: ProviderId;
  status: CompatibilityStatus;
}> = [
  { harnessId: 'claude-code', providerId: 'openrouter', status: 'experimental' },
  { harnessId: 'claude-code', providerId: 'google', status: 'unsupported' },
  { harnessId: 'claude-code', providerId: 'mistral', status: 'unsupported' },
  { harnessId: 'claude-code', providerId: 'nvidia-nim', status: 'unsupported' },
  { harnessId: 'claude-code', providerId: 'groq', status: 'unsupported' },
  { harnessId: 'claude-code', providerId: 'cerebras', status: 'unsupported' },
  { harnessId: 'pi', providerId: 'openrouter', status: 'supported' },
  { harnessId: 'pi', providerId: 'google', status: 'supported' },
  { harnessId: 'pi', providerId: 'mistral', status: 'supported' },
  { harnessId: 'pi', providerId: 'nvidia-nim', status: 'supported' },
  { harnessId: 'pi', providerId: 'groq', status: 'supported' },
  { harnessId: 'pi', providerId: 'cerebras', status: 'supported' },
  { harnessId: 'opencode', providerId: 'openrouter', status: 'supported' },
  { harnessId: 'opencode', providerId: 'google', status: 'supported' },
  { harnessId: 'opencode', providerId: 'mistral', status: 'supported' },
  { harnessId: 'opencode', providerId: 'nvidia-nim', status: 'supported' },
  { harnessId: 'opencode', providerId: 'groq', status: 'supported' },
  { harnessId: 'opencode', providerId: 'cerebras', status: 'supported' },
  { harnessId: 'codex', providerId: 'openrouter', status: 'supported' },
  { harnessId: 'codex', providerId: 'google', status: 'unsupported' },
  { harnessId: 'codex', providerId: 'mistral', status: 'supported' },
  { harnessId: 'codex', providerId: 'nvidia-nim', status: 'unsupported' },
  { harnessId: 'codex', providerId: 'groq', status: 'experimental' },
  { harnessId: 'codex', providerId: 'cerebras', status: 'unsupported' },
];

describe('harness compatibility registry', () => {
  it.each(EXPECTED_MATRIX)('records $providerId × $harnessId as $status', (expected) => {
    expect(COMPATIBILITY_REGISTRY[expected.harnessId][expected.providerId]).toMatchObject(expected);
  });

  it('contains one explicit entry for every provider × harness pair', () => {
    const entries = HARNESS_IDS.flatMap((harnessId) =>
      PROVIDER_IDS.map((providerId) => COMPATIBILITY_REGISTRY[harnessId][providerId]),
    );

    expect(entries).toHaveLength(24);
    expect(new Set(entries.map((entry) => `${entry.providerId}:${entry.harnessId}`)).size).toBe(24);
    expect(entries.every((entry) => entry.lastVerified === '2026-08-26')).toBe(true);
  });
});

describe('generateHarnessRecipe', () => {
  it('preserves canonical provider and model IDs while mapping NVIDIA for Pi and OpenCode', () => {
    const nvidiaPi = generateHarnessRecipe('pi', 'nvidia-nim', MODEL_ID);
    const nvidiaOpenCode = generateHarnessRecipe('opencode', 'nvidia-nim', MODEL_ID);

    expect(nvidiaPi).toMatchObject({
      providerId: 'nvidia-nim',
      harnessProviderId: 'nvidia',
      sourceModelId: MODEL_ID,
      modelId: MODEL_ID,
    });
    expect(nvidiaPi.snippets.at(-1)?.content).toContain("--provider 'nvidia'");
    expect(nvidiaPi.snippets.at(-1)?.content).toContain(`--model '${MODEL_ID}'`);
    expect(nvidiaOpenCode).toMatchObject({
      sourceModelId: MODEL_ID,
      modelId: 'nvidia/owner/model',
    });
    expect(nvidiaOpenCode.snippets.at(-1)?.content).toContain("'nvidia/owner/model'");
  });

  it('adds the OpenRouter namespace once for OpenCode and preserves nested model IDs', () => {
    expect(generateHarnessRecipe('opencode', 'openrouter', 'anthropic/claude-3')).toMatchObject({
      sourceModelId: 'anthropic/claude-3',
      modelId: 'openrouter/anthropic/claude-3',
    });
    expect(generateHarnessRecipe('opencode', 'openrouter', 'anthropic/claude-3').snippets.at(-1)?.content).toContain(
      "'openrouter/anthropic/claude-3'",
    );
    expect(
      generateHarnessRecipe('opencode', 'openrouter', 'openrouter/anthropic/claude-3').snippets.at(-1)?.content,
    ).toContain("'openrouter/anthropic/claude-3'");
  });

  it('only treats an eligible Anthropic OpenRouter model as experimental in Claude Code', () => {
    expect(generateHarnessRecipe('claude-code', 'openrouter', 'anthropic/claude-3').status).toBe(
      'experimental',
    );
    expect(generateHarnessRecipe('claude-code', 'openrouter', 'google/gemini-2').status).toBe(
      'unsupported',
    );
    expect(generateHarnessRecipe('claude-code', 'openrouter', 'google/gemini-2').steps).toEqual([]);
  });

  it('returns unsupported for every harness when a future provider is unknown', () => {
    for (const harnessId of HARNESS_IDS) {
      const recipe = generateHarnessRecipe(harnessId, 'future-provider', MODEL_ID);
      expect(recipe).toMatchObject({
        harnessId,
        providerId: 'future-provider',
        harnessProviderId: null,
        status: 'unsupported',
        sourceModelId: MODEL_ID,
        modelId: MODEL_ID,
        steps: [],
        snippets: [],
      });
      expect(recipe.docsUrl).not.toContain('openrouter');
      expect(recipe.caveats?.join(' ')).toContain('future-provider');
    }
  });

  it('creates ordered, independently copyable snippets and keeps metadata on every recipe', () => {
    for (const expected of EXPECTED_MATRIX) {
      const model = expected.harnessId === 'claude-code' ? 'anthropic/claude-3' : MODEL_ID;
      const recipe = generateHarnessRecipe(expected.harnessId, expected.providerId, model);
      expect(recipe.lastVerified).toBe('2026-08-26');
      expect(recipe.docsUrl).toMatch(/^https:\/\//);
      expect(recipe.snippets).toEqual(recipe.steps.flatMap((step) => step.snippets));
      expect(new Set(recipe.snippets.map((snippet) => snippet.id)).size).toBe(recipe.snippets.length);

      const expectedStepIds =
        expected.status === 'unsupported'
          ? []
          : expected.harnessId === 'pi'
            ? ['authenticate', 'run']
            : expected.harnessId === 'codex'
              ? ['configure', 'run']
              : expected.harnessId === 'opencode'
                ? ['connect', 'run']
                : ['configure-gateway', 'run'];
      expect(recipe.steps.map((step) => step.id)).toEqual(expectedStepIds);
      for (const snippet of recipe.snippets.filter((snippet) => snippet.language === 'json')) {
        expect(() => JSON.parse(snippet.content)).not.toThrow();
      }
      for (const snippet of recipe.snippets.filter((snippet) => snippet.language === 'toml')) {
        expect(snippet.content).toMatch(/^model_provider = "[^"]+"\n\n\[model_providers\.[^\]]+\]/);
        expect(snippet.content).toMatch(/^(?:[^=]+ = (?:"(?:[^"\\]|\\.)*"|[^\n]+)\n?)+$/m);
      }
    }
  });

  it('serializes hostile model IDs safely in shell, JSON, and TOML snippets', () => {
    const hostileModel = `owner/"quoted'\\model\n${'${MODEL_INJECTION}'}\u0007`;
    const openCode = generateHarnessRecipe('opencode', 'openrouter', hostileModel);
    const codex = generateHarnessRecipe('codex', 'openrouter', hostileModel);

    const json = openCode.snippets.find((snippet) => snippet.language === 'json')?.content;
    const toml = codex.snippets.find((snippet) => snippet.language === 'toml')?.content;
    expect(json).toBeDefined();
    expect(toml).toBeDefined();
    expect(() => JSON.parse(json!)).not.toThrow();
    expect(json).toContain('owner/\\"quoted');
    expect(toml).toContain('model_provider = "openrouter"');
    expect(toml).toContain('[model_providers.openrouter]');
    expect(codex.snippets.find((snippet) => snippet.id === 'run')?.content).toContain("'\"'\"'");
    expect([...openCode.snippets, ...codex.snippets].some((snippet) => snippet.content.includes('sk-'))).toBe(false);
  });

  it('uses environment references instead of credential-looking values', () => {
    for (const expected of EXPECTED_MATRIX.filter(({ status }) => status !== 'unsupported')) {
      const model = expected.harnessId === 'claude-code' ? 'anthropic/claude-3' : MODEL_ID;
      const recipe = generateHarnessRecipe(expected.harnessId, expected.providerId, model);
      expect(recipe.snippets.some((snippet) => /\$[A-Z][A-Z0-9_]+/.test(snippet.content))).toBe(true);
      expect(recipe.snippets.every((snippet) => !/(sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,})/.test(snippet.content))).toBe(
        true,
      );
    }
  });

  it('is deterministic, does not mutate a model object, and does not expose registry arrays', () => {
    const model = { id: MODEL_ID };
    const first = generateHarnessRecipe('claude-code', 'openrouter', model);
    const second = generateHarnessRecipe('claude-code', 'openrouter', model);

    expect(first).toEqual(second);
    expect(model).toEqual({ id: MODEL_ID });
    expect(first.steps).not.toBe(second.steps);
    expect(first.snippets).not.toBe(second.snippets);
    expect(first.caveats).not.toBe(second.caveats);
  });
});
