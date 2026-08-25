'use strict';

const { defineProviderMetadata } = require('./schema');

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODELS_PATH = '/models';
const MODEL_NAME_PREFIX = 'models/';
const FREE_GENERATION_METHOD = 'generateContent';

/**
 * Free-tier predicate for Google AI Studio.
 *
 * Google does not tag individual catalog entries as "free". Instead, the
 * Gemini API exposes a free tier via per-model free-tier rate limits, and
 * every model eligible for those limits accepts text generation requests
 * through `generateContent`. A practical, documented predicate is therefore:
 * the model supports `generateContent` (models restricted to other methods,
 * e.g. embeddings, are excluded). See https://ai.google.dev/gemini-api/docs
 * for the free-tier rate-limit tables backing this decision.
 *
 * @param {Object} [raw] Raw Google model entry.
 * @returns {boolean}
 */
const isGoogleFree = (raw) => {
  const methods = raw?.supportedGenerationMethods;
  return Array.isArray(methods) && methods.includes(FREE_GENERATION_METHOD);
};

/**
 * Strip the "models/" prefix Google puts on catalog entry names
 * (e.g. "models/gemini-2.5-flash" → "gemini-2.5-flash").
 *
 * @param {*} name Raw entry name.
 * @returns {*} Name without the prefix (or the input when not prefixed).
 */
const googleModelId = (name) => {
  if (typeof name !== 'string') return name;
  return name.startsWith(MODEL_NAME_PREFIX)
    ? name.slice(MODEL_NAME_PREFIX.length)
    : name;
};

/**
 * Create the Google AI Studio provider adapter.
 *
 * @param {Object} [options]
 * @param {string} [options.apiKey] Google AI Studio API key (defaults to
 *   GOOGLE_AI_API_KEY env var).
 * @param {string} [options.baseUrl] API base URL.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation (for tests).
 */
function createGoogleAdapter({
  apiKey = process.env.GOOGLE_AI_API_KEY || '',
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch.bind(globalThis),
} = {}) {
  const metadata = defineProviderMetadata({
    id: 'google',
    displayName: 'Google AI Studio',
    baseUrl,
    apiKeySignupUrl: 'https://aistudio.google.com/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
  });

  function modelsUrl() {
    const url = `${baseUrl}${MODELS_PATH}`;
    return apiKey ? `${url}?key=${encodeURIComponent(apiKey)}` : url;
  }

  async function fetchJson(url) {
    const res = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'openrouter-free-models-updater',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }

  return {
    id: 'google',
    name: 'Google AI Studio',
    metadata,

    /** True when an API key is configured. */
    hasApiKey() {
      return Boolean(apiKey && String(apiKey).trim());
    },

    /** Fetch the raw model catalog entries. */
    async fetchModels() {
      const payload = await fetchJson(modelsUrl());
      return payload.models;
    },

    /** Decide whether a raw model entry qualifies as free. */
    isFree(raw) {
      return isGoogleFree(raw);
    },

    /**
     * Map a raw Google model entry to a CanonicalModel.
     *
     * The Gemini API catalog does not expose pricing, creation timestamps or
     * modality metadata. Rather than inventing data:
     * - `pricing` is reported as flat "0" strings because free-tier rate
     *   limits cover these models (see isGoogleFree);
     * - `created` is reported as 0 because the catalog carries no timestamp;
     * - `id` drops Google's "models/" name prefix and `name` mirrors the
     *   catalog `displayName` (falling back to the derived id);
     * - `context_length` maps `inputTokenLimit`, falling back to null when
     *   absent;
     * - `architecture` reflects that these are text-in/text-out generation
     *   models (only such models qualify as free, see isGoogleFree).
     *
     * The mapping is idempotent: feeding an already-canonical model back
     * through `normalize` yields an equivalent canonical model (the shared
     * adapter contract harness relies on this).
     *
     * @param {Object} raw Raw Google model entry (or canonical model).
     * @returns {Object} CanonicalModel.
     */
    normalize(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new TypeError('google model must be a plain object');
      }

      // Raw entries identify via `name` ("models/gemini-…"); canonical
      // shapes already carry the stripped `id`. Prefer `id` so that
      // re-normalizing a canonical model is stable.
      const identity =
        typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : raw.name;
      const id = googleModelId(identity);
      const tokenLimit =
        typeof raw.inputTokenLimit === 'number' &&
        Number.isFinite(raw.inputTokenLimit)
          ? raw.inputTokenLimit
          : raw.context_length;

      return {
        id,
        // Only honor displayName when an id could be derived, so entries
        // lacking any identity never get "repaired" by re-normalization.
        name:
          typeof raw.displayName === 'string' &&
          raw.displayName.length > 0 &&
          typeof id === 'string' &&
          id.length > 0
            ? raw.displayName
            : String(id ?? ''),
        created: 0,
        description:
          typeof raw.description === 'string' ? raw.description : '',
        context_length:
          typeof tokenLimit === 'number' && Number.isFinite(tokenLimit)
            ? tokenLimit
            : null,
        pricing: { prompt: '0', completion: '0' },
        architecture: {
          modality: 'text->text',
          input_modalities: ['text'],
          output_modalities: ['text'],
        },
        providerId: 'google',
        sourceUrl: `${baseUrl}${MODELS_PATH}`,
      };
    },
  };
}

const googleAdapter = createGoogleAdapter();

module.exports = {
  isGoogleFree,
  createGoogleAdapter,
  googleAdapter,
};
