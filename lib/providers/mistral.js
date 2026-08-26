'use strict';

const { defineProviderMetadata } = require('./schema');

const DEFAULT_BASE_URL = 'https://api.mistral.ai/v1';

/**
 * Free-tier predicate for Mistral.
 *
 * Mistral's "La Plateforme" experiment plan serves the entire model catalog
 * at no cost with low per-minute rate limits, so every entry returned by the
 * public /models endpoint is free-tier-listable. The predicate therefore
 * keys on the only required identity field: a non-empty string `id`.
 *
 * @param {Object} [raw] Raw Mistral model entry.
 * @returns {boolean}
 */
const isMistralFree = (raw) => {
  return typeof raw?.id === 'string' && raw.id.length > 0;
};

/**
 * Derive a human-readable display name from a Mistral model id
 * (e.g. "mistral-small-latest" → "Mistral Small Latest").
 *
 * @param {string} id Mistral model id.
 * @returns {string}
 */
const mistralModelName = (id) => {
  if (typeof id !== 'string' || id.length === 0) return '';
  const words = id.split(/[-_.]/g).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/**
 * Create the Mistral provider adapter.
 *
 * @param {Object} [options]
 * @param {string} [options.apiKey] Mistral API key (defaults to
 *   MISTRAL_API_KEY env var).
 * @param {string} [options.baseUrl] API base URL.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation (for tests).
 */
function createMistralAdapter({
  apiKey = process.env.MISTRAL_API_KEY || '',
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch.bind(globalThis),
} = {}) {
  const metadata = defineProviderMetadata({
    id: 'mistral',
    displayName: 'Mistral AI',
    baseUrl,
    apiKeySignupUrl: 'https://console.mistral.ai',
    docsUrl: 'https://docs.mistral.ai',
    notes:
      'Free tier ("La Plateforme" experiment plan) serves the whole catalog ' +
      'at no cost but with low per-minute rate limits.',
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
    id: 'mistral',
    name: 'Mistral AI',
    metadata,

    /** True when an API key is configured. */
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
      return isMistralFree(raw);
    },

    /**
     * Map a raw Mistral model entry to a CanonicalModel.
     *
     * The Mistral catalog does not expose per-token pricing, display names
     * or modality metadata. Rather than inventing data:
     * - `pricing` is reported as flat "0" strings because every entry on
     *   this endpoint belongs to Mistral's free experiment tier;
     * - `name` is derived from the model id and `description` is empty;
     * - `architecture` reflects that these are OpenAI-compatible text
     *   chat models (text in → text out);
     * - unknown `max_context_length` values fall back to null and the
     *   optional `capabilities` object is not interpreted.
     *
     * @param {Object} raw Raw Mistral model entry.
     * @returns {Object} CanonicalModel.
     */
    normalize(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new TypeError('mistral model must be a plain object');
      }

      return {
        id: raw.id,
        name: mistralModelName(raw.id),
        created: raw.created,
        description: '',
        context_length:
          typeof raw.max_context_length === 'number' &&
          Number.isFinite(raw.max_context_length)
            ? raw.max_context_length
            : null,
        pricing: { prompt: '0', completion: '0' },
        architecture: {
          modality: 'text->text',
          input_modalities: ['text'],
          output_modalities: ['text'],
        },
        providerId: 'mistral',
        sourceUrl: `${baseUrl}/models`,
      };
    },
  };
}

const mistralAdapter = createMistralAdapter();

module.exports = {
  isMistralFree,
  createMistralAdapter,
  mistralAdapter,
};
