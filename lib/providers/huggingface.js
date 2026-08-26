'use strict';

const { defineProviderMetadata } = require('./schema');

const DEFAULT_BASE_URL = 'https://router.huggingface.co/v1';

/**
 * Free-tier predicate for Hugging Face Inference Providers.
 *
 * The HF Router exposes the OpenAI-compatible catalog of every model served
 * through Inference Providers. Hugging Face free-tier accounts receive a
 * monthly allowance of inference credits that can be spent on any model in
 * this catalog, so every entry returned by the router endpoint is
 * free-tier-accessible. The predicate therefore keys on the only required
 * OpenAI-compatible identity field: a non-empty string `id`.
 *
 * @param {Object} [raw] Raw HF Router model entry.
 * @returns {boolean}
 */
const isHuggingFaceFree = (raw) => {
  return typeof raw?.id === 'string' && raw.id.length > 0;
};

/**
 * Derive a human-readable display name from an HF Router model id
 * (e.g. "meta-llama/Llama-3.1-8B-Instruct" → "Meta llama/Llama 3 1 8B Instruct").
 *
 * @param {string} id HF Router model id.
 * @returns {string}
 */
const huggingFaceModelName = (id) => {
  if (typeof id !== 'string' || id.length === 0) return '';
  const words = id.split(/[-_.]/g).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/**
 * Create the Hugging Face provider adapter.
 *
 * @param {Object} [options]
 * @param {string} [options.apiKey] Hugging Face token (defaults to HF_TOKEN
 *   env var).
 * @param {string} [options.baseUrl] API base URL.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation (for tests).
 */
function createHuggingFaceAdapter({
  apiKey = process.env.HF_TOKEN || '',
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch.bind(globalThis),
} = {}) {
  const metadata = defineProviderMetadata({
    id: 'huggingface',
    displayName: 'Hugging Face',
    baseUrl,
    apiKeySignupUrl: 'https://huggingface.co/settings/tokens',
    docsUrl: 'https://huggingface.co/docs/inference-providers',
    notes:
      'Catalog served through the HF Router (Inference Providers). Free-tier ' +
      'accounts get monthly inference credits; usage draws down those credits ' +
      'rather than being permanently free.',
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
    id: 'huggingface',
    name: 'Hugging Face',
    metadata,

    /** True when a token is configured. */
    hasApiKey() {
      return Boolean(apiKey && String(apiKey).trim());
    },

    /** Fetch the raw model catalog entries. */
    async fetchModels() {
      const payload = await fetchJson(`${baseUrl}/models`);
      return payload.data;
    },

    /** Decide whether a raw model entry qualifies as free. */
    isFree(raw) {
      return isHuggingFaceFree(raw);
    },

    /**
     * Map a raw HF Router model entry to a CanonicalModel.
     *
     * The HF Router catalog does not expose per-token pricing or display
     * names. Rather than inventing data:
     * - `pricing` is reported as flat "0" strings because every entry on
     *   this endpoint is reachable with HF's monthly free inference credits;
     * - `name` is derived from the model id and `description` is empty;
     * - `architecture` reflects that these are OpenAI-compatible text
     *   chat models (text in → text out);
     * - unknown `context_length` values fall back to null.
     *
     * @param {Object} raw Raw HF Router model entry.
     * @returns {Object} CanonicalModel.
     */
    normalize(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new TypeError('huggingface model must be a plain object');
      }

      return {
        id: raw.id,
        name: huggingFaceModelName(raw.id),
        created: raw.created,
        description: '',
        context_length:
          typeof raw.context_length === 'number' && Number.isFinite(raw.context_length)
            ? raw.context_length
            : null,
        pricing: { prompt: '0', completion: '0' },
        architecture: {
          modality: 'text->text',
          input_modalities: ['text'],
          output_modalities: ['text'],
        },
        providerId: 'huggingface',
        sourceUrl: `${baseUrl}/models`,
      };
    },
  };
}

const huggingFaceAdapter = createHuggingFaceAdapter();

module.exports = {
  isHuggingFaceFree,
  createHuggingFaceAdapter,
  huggingFaceAdapter,
};
