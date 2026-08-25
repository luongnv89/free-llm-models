'use strict';

const { defineProviderMetadata } = require('./schema');

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Free-tier predicate for Groq.
 *
 * Groq's public /models endpoint lists every model served on its permanent
 * free tier; each entry carries an `active` flag telling whether the model
 * is currently servable. A model is free-tier-listable when it is active.
 *
 * @param {Object} [raw] Raw Groq model entry.
 * @returns {boolean}
 */
const isGroqFree = (raw) => {
  return raw?.active === true;
};

/**
 * Derive a human-readable display name from a Groq model id
 * (e.g. "llama-3.3-70b-versatile" → "Llama 3.3 70b Versatile").
 *
 * @param {string} id Groq model id.
 * @returns {string}
 */
const groqModelName = (id) => {
  if (typeof id !== 'string' || id.length === 0) return '';
  const words = id.split(/[-_.]/g).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/**
 * Create the Groq provider adapter.
 *
 * @param {Object} [options]
 * @param {string} [options.apiKey] Groq API key (defaults to GROQ_API_KEY
 *   env var).
 * @param {string} [options.baseUrl] API base URL.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation (for tests).
 */
function createGroqAdapter({
  apiKey = process.env.GROQ_API_KEY || '',
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch.bind(globalThis),
} = {}) {
  const metadata = defineProviderMetadata({
    id: 'groq',
    displayName: 'Groq',
    baseUrl,
    apiKeySignupUrl: 'https://console.groq.com/keys',
    docsUrl: 'https://console.groq.com/docs',
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
    id: 'groq',
    name: 'Groq',
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
      return isGroqFree(raw);
    },

    /**
     * Map a raw Groq model entry to a CanonicalModel.
     *
     * The Groq catalog does not expose per-token pricing, display names,
     * descriptions or modality metadata. Rather than inventing data:
     * - `pricing` is reported as flat "0" strings because every entry on
     *   this endpoint belongs to Groq's permanent free tier;
     * - `name` is derived from the model id and `description` is empty;
     * - `architecture` reflects that these are OpenAI-compatible text
     *   chat models (text in → text out);
     * - unknown `context_window` values fall back to null.
     *
     * @param {Object} raw Raw Groq model entry.
     * @returns {Object} CanonicalModel.
     */
    normalize(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new TypeError('groq model must be a plain object');
      }

      return {
        id: raw.id,
        name: groqModelName(raw.id),
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
        providerId: 'groq',
        sourceUrl: `${baseUrl}/models`,
      };
    },
  };
}

const groqAdapter = createGroqAdapter();

module.exports = {
  isGroqFree,
  createGroqAdapter,
  groqAdapter,
};
