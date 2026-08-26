'use strict';

const { defineProviderMetadata } = require('./schema');

const DEFAULT_BASE_URL = 'https://api.cerebras.ai/v1';

/**
 * Free-tier predicate for Cerebras.
 *
 * Cerebras' entire model catalog is served on its free API tier (~1M free
 * tokens/day), so every entry returned by the public /models endpoint is
 * free-tier-listable. The predicate therefore keys on the only required
 * OpenAI-compatible identity field: a non-empty string `id`.
 *
 * @param {Object} [raw] Raw Cerebras model entry.
 * @returns {boolean}
 */
const isCerebrasFree = (raw) => {
  return typeof raw?.id === 'string' && raw.id.length > 0;
};

/**
 * Derive a human-readable display name from a Cerebras model id
 * (e.g. "llama3.1-8b" → "Llama3 1 8b").
 *
 * @param {string} id Cerebras model id.
 * @returns {string}
 */
const cerebrasModelName = (id) => {
  if (typeof id !== 'string' || id.length === 0) return '';
  const words = id.split(/[-_.]/g).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/**
 * Create the Cerebras provider adapter.
 *
 * @param {Object} [options]
 * @param {string} [options.apiKey] Cerebras API key (defaults to
 *   CEREBRAS_API_KEY env var).
 * @param {string} [options.baseUrl] API base URL.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation (for tests).
 */
function createCerebrasAdapter({
  apiKey = process.env.CEREBRAS_API_KEY || '',
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch.bind(globalThis),
} = {}) {
  const metadata = defineProviderMetadata({
    id: 'cerebras',
    displayName: 'Cerebras',
    baseUrl,
    apiKeySignupUrl: 'https://cloud.cerebras.ai',
    docsUrl: 'https://inference-docs.cerebras.ai',
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
    id: 'cerebras',
    name: 'Cerebras',
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
      return isCerebrasFree(raw);
    },

    /**
     * Map a raw Cerebras model entry to a CanonicalModel.
     *
     * The Cerebras catalog does not expose per-token pricing, display names
     * or modality metadata. Rather than inventing data:
     * - `pricing` is reported as flat "0" strings because every entry on
     *   this endpoint belongs to Cerebras' free tier (~1M tokens/day);
     * - `name` is derived from the model id and `description` is empty;
     * - `architecture` reflects that these are OpenAI-compatible text
     *   chat models (text in → text out);
     * - unknown `context_window` values fall back to null.
     *
     * @param {Object} raw Raw Cerebras model entry.
     * @returns {Object} CanonicalModel.
     */
    normalize(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new TypeError('cerebras model must be a plain object');
      }

      return {
        id: raw.id,
        name: cerebrasModelName(raw.id),
        created: raw.created,
        description: '',
        context_length:
          typeof raw.context_window === 'number' && Number.isFinite(raw.context_window)
            ? raw.context_window
            : null,
        pricing: { prompt: '0', completion: '0' },
        architecture: {
          modality: 'text->text',
          input_modalities: ['text'],
          output_modalities: ['text'],
        },
        providerId: 'cerebras',
        sourceUrl: `${baseUrl}/models`,
      };
    },
  };
}

const cerebrasAdapter = createCerebrasAdapter();

module.exports = {
  isCerebrasFree,
  createCerebrasAdapter,
  cerebrasAdapter,
};
