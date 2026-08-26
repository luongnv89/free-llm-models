'use strict';

const { defineProviderMetadata } = require('./schema');

const DEFAULT_BASE_URL = 'https://models.github.ai';
const MODELS_PATH = '/catalog/models';

/**
 * Free-tier predicate for GitHub Models.
 *
 * GitHub Models serves its whole catalog through a single endpoint where
 * every listed model can be used at no cost under the plan-dependent free
 * tier (rate limits vary by Copilot subscription). The catalog carries no
 * explicit "free" flag, so the predicate keys on the only required identity
 * field: a non-empty string `id`.
 *
 * @param {Object} [raw] Raw GitHub Models catalog entry.
 * @returns {boolean}
 */
const isGitHubModelsFree = (raw) => {
  return typeof raw?.id === 'string' && raw.id.length > 0;
};

/**
 * Derive a human-readable display name from a GitHub Models catalog id
 * (e.g. "openai/gpt-4o-mini" → "Openai/gpt 4o Mini").
 *
 * @param {string} id Catalog model id.
 * @returns {string}
 */
const githubModelsModelName = (id) => {
  if (typeof id !== 'string' || id.length === 0) return '';
  const words = id.split(/[-_.]/g).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/**
 * Pick the modality list from catalog metadata, falling back to text-only.
 *
 * @param {unknown} value Raw `supported_*_modalities` field.
 * @returns {string[]}
 */
const modalitiesFrom = (value) => {
  if (!Array.isArray(value)) return ['text'];
  const mods = value.filter((m) => typeof m === 'string' && m.length > 0);
  return mods.length > 0 ? mods : ['text'];
};

/**
 * Create the GitHub Models provider adapter.
 *
 * @param {Object} [options]
 * @param {string} [options.apiKey] GitHub token (defaults to GITHUB_TOKEN
 *   env var).
 * @param {string} [options.baseUrl] API base URL.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation (for tests).
 */
function createGitHubModelsAdapter({
  apiKey = process.env.GITHUB_TOKEN || '',
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch.bind(globalThis),
} = {}) {
  const metadata = defineProviderMetadata({
    id: 'github-models',
    displayName: 'GitHub Models',
    baseUrl,
    apiKeySignupUrl: 'https://github.com/settings/tokens',
    docsUrl: 'https://docs.github.com/en/github-models',
    notes:
      'Free tier covers the whole catalog with rate limits that vary by ' +
      'Copilot plan; requests use a GitHub personal access token.',
  });

  function requestHeaders() {
    const headers = {
      Accept: 'application/json',
      'User-Agent': 'openrouter-free-models-updater',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    return headers;
  }

  async function fetchJson(url) {
    const res = await fetchImpl(url, { headers: requestHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }

  return {
    id: 'github-models',
    name: 'GitHub Models',
    metadata,

    /** True when a token is configured. */
    hasApiKey() {
      return Boolean(apiKey && String(apiKey).trim());
    },

    /** Fetch the raw model catalog entries. */
    async fetchModels() {
      const payload = await fetchJson(`${baseUrl}${MODELS_PATH}`);
      // The catalog endpoint returns a bare JSON array; tolerate an
      // OpenAI-style `{ data: [...] }` envelope for forward compatibility.
      const models = Array.isArray(payload) ? payload : payload?.data;
      if (!Array.isArray(models)) {
        throw new Error(
          'github-models: unexpected catalog response shape ' +
            '(expected a JSON array or { data: [... ] })'
        );
      }
      return models;
    },

    /** Decide whether a raw model entry qualifies as free. */
    isFree(raw) {
      return isGitHubModelsFree(raw);
    },

    /**
     * Map a raw GitHub Models catalog entry to a CanonicalModel.
     *
     * The GitHub Models catalog does not expose per-token pricing or
     * creation timestamps. Rather than inventing data:
     * - `pricing` is reported as flat "0" strings because every entry on
     *   this endpoint belongs to GitHub Models' free tier;
     * - `created` is reported as 0 because the catalog carries no timestamp;
     * - `name` mirrors the catalog display name (falling back to one derived
     *   from the id) and `description` maps the `summary` field;
     * - `architecture` derives from `supported_input_modalities` /
     *   `supported_output_modalities`, falling back to text-only;
     * - unknown `context_window` values fall back to null.
     *
     * @param {Object} raw Raw GitHub Models catalog entry.
     * @returns {Object} CanonicalModel.
     */
    normalize(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new TypeError('github-models model must be a plain object');
      }

      const inputModalities = modalitiesFrom(raw.supported_input_modalities);
      const outputModalities = modalitiesFrom(raw.supported_output_modalities);

      return {
        id: raw.id,
        name:
          typeof raw.name === 'string' && raw.name.length > 0
            ? raw.name
            : githubModelsModelName(raw.id),
        created: 0,
        description:
          typeof raw.summary === 'string' ? raw.summary : '',
        context_length:
          typeof raw.context_window === 'number' &&
          Number.isFinite(raw.context_window)
            ? raw.context_window
            : null,
        pricing: { prompt: '0', completion: '0' },
        architecture: {
          modality: `${inputModalities.join('+')}->${outputModalities.join('+')}`,
          input_modalities: inputModalities,
          output_modalities: outputModalities,
        },
        providerId: 'github-models',
        sourceUrl: `${baseUrl}${MODELS_PATH}`,
      };
    },
  };
}

const githubModelsAdapter = createGitHubModelsAdapter();

module.exports = {
  isGitHubModelsFree,
  createGitHubModelsAdapter,
  githubModelsAdapter,
};
