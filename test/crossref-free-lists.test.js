const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  parseCommunityList,
  providerIdForHeading,
  normalizeName,
  namesMatch,
  compareProviders,
  loadLocalDatasets,
} = require('../scripts/crossref-free-lists');

test('providerIdForHeading maps community headings onto adapter ids', () => {
  assert.strictEqual(providerIdForHeading('[OpenRouter](https://openrouter.ai)'), 'openrouter');
  assert.strictEqual(providerIdForHeading('Google AI Studio'), 'google');
  assert.strictEqual(providerIdForHeading('[NVIDIA NIM](https://build.nvidia.com)'), 'nvidia-nim');
  assert.strictEqual(providerIdForHeading('[Mistral (La Plateforme)](https://console.mistral.ai/)'), 'mistral');
  assert.strictEqual(providerIdForHeading('[Mistral (Codestral)](https://codestral.mistral.ai/)'), 'mistral');
  assert.strictEqual(providerIdForHeading('[HuggingFace Inference Providers](https://huggingface.co)'), 'huggingface');
  assert.strictEqual(providerIdForHeading('[GitHub Models](https://github.com/marketplace/models)'), 'github-models');
  assert.strictEqual(providerIdForHeading('Cohere'), null);
});

test('parseCommunityList extracts models from bullets, HTML tables and pipe tables', () => {
  const markdown = [
    '# Free LLM API resources',
    '## Free Providers',
    '### [OpenRouter](https://openrouter.ai)',
    '- [Gemma 3 12B Instruct](https://openrouter.ai/google/gemma-3-12b-it:free)',
    '- [z-ai/glm-4.5-air:free](https://openrouter.ai/z-ai/glm-4.5-air:free)',
    '',
    '### [Google AI Studio](https://aistudio.google.com)',
    '<table><thead><tr><th>Model Name</th><th>Model Limits</th></tr></thead><tbody>',
    '<tr><td>Gemini 2.5 Flash</td><td>20 requests/day</td></tr>',
    '</tbody></table>',
    '',
    '### [Groq](https://console.groq.com)',
    '| Model Name | Requests/Day |',
    '| ---------- | ------------ |',
    '| Llama 3.3 70B | 1,000 |',
    '### [Cohere](https://cohere.com)',
    '- [Command R7B](https://cohere.com)',
  ].join('\n');

  const parsed = parseCommunityList(markdown);

  assert.ok(parsed.get('openrouter').includes('google/gemma-3-12b-it'));
  assert.ok(parsed.get('openrouter').includes('z-ai/glm-4.5-air:free'));
  assert.ok(parsed.get('openrouter').includes('Gemma 3 12B Instruct'));
  assert.deepStrictEqual(parsed.get('google'), ['Gemini 2.5 Flash']);
  assert.deepStrictEqual(parsed.get('groq'), ['Llama 3.3 70B']);
  // Providers we do not track are not collected.
  assert.strictEqual(parsed.get('cohere'), undefined);
});

test('parseCommunityList handles the Mintlify mirror page shapes', () => {
  const markdown = [
    '# OpenRouter',
    '## Available Models',
    '* **Llama 3.3 70B Instruct** - [View model](https://openrouter.ai/meta-llama/llama-3.3-70b-instruct:free)',
    '* openai/gpt-oss-120b:free',
    '* Fastest inference speeds in the industry',
    '',
    '# Groq',
    '| Model Name | Requests/Day |',
    '| ---------- | ------------ |',
    '| Llama 4 Scout | 1,000 |',
    '| Requests per minute | 30 |',
  ].join('\n');

  const parsed = parseCommunityList(markdown);

  const openrouter = parsed.get('openrouter');
  assert.ok(openrouter.includes('meta-llama/llama-3.3-70b-instruct'));
  assert.ok(openrouter.includes('openai/gpt-oss-120b:free'));
  assert.ok(openrouter.includes('Llama 3.3 70B Instruct'));
  // Prose bullets are not treated as models.
  assert.ok(!openrouter.some((n) => n.includes('Fastest inference')));
  assert.deepStrictEqual(parsed.get('groq'), ['Llama 4 Scout']);
});

test('namesMatch fuzzy-matches display names against api ids', () => {
  assert.ok(namesMatch('Llama 3.3 70B Instruct', { id: 'llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct' }));
  assert.ok(namesMatch('Gemini 2.5 Flash', { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }));
  assert.ok(!namesMatch('Qwen 3 32B', { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' }));
});

test('compareProviders reports missing models on both sides and no-local-data', () => {
  const community = new Map([
    ['groq', ['Llama 3.3 70B', 'Brand New Model']],
    ['cerebras', ['Llama 4 Scout']],
  ]);
  const local = new Map([
    ['groq', [{ id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' }]],
  ]);

  const rows = compareProviders(community, local);
  const groq = rows.find((r) => r.providerId === 'groq');
  assert.strictEqual(groq.status, 'ok');
  assert.deepStrictEqual(groq.missingFromOurs, ['Brand New Model']);
  assert.deepStrictEqual(groq.missingFromCommunityList, []);

  const cerebras = rows.find((r) => r.providerId === 'cerebras');
  assert.strictEqual(cerebras.status, 'no-local-data');
  assert.deepStrictEqual(cerebras.missingFromOurs, ['Llama 4 Scout']);
});

test('loadLocalDatasets reads per-provider files and ignores index.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crossref-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'groq.json'),
      JSON.stringify({ providerId: 'groq', models: [{ id: 'gemma2-9b-it', name: 'Gemma2 9B it' }] })
    );
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ providers: [] }));

    const { providers, missing } = loadLocalDatasets(dir);
    assert.strictEqual(missing, false);
    assert.deepStrictEqual(providers.get('groq'), [{ id: 'gemma2-9b-it', name: 'Gemma2 9B it' }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('loadLocalDatasets flags a missing directory', () => {
  const { missing } = loadLocalDatasets(path.join(os.tmpdir(), 'crossref-does-not-exist'));
  assert.strictEqual(missing, true);
});
