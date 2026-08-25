'use strict';

const { defineProviderMetadata } = require('./schema');

const DEFAULT_BASE_URL = 'https://openrouter.ai';

const isFreePricing = (pricing = {}) => {
  return pricing.prompt === '0' && pricing.completion === '0';
};

/**
 * Create the OpenRouter provider adapter.
 *
 * @param {Object} [options]
 * @param {string} [options.apiKey] OpenRouter API key (defaults to
 *   OPENROUTER_API_KEY env var).
 * @param {string} [options.baseUrl] API base URL.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation (for tests).
 */
function createOpenRouterAdapter({
  apiKey = process.env.OPENROUTER_API_KEY || '',
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch.bind(globalThis),
} = {}) {
  const metadata = defineProviderMetadata({
    id: 'openrouter',
    displayName: 'OpenRouter',
    baseUrl,
    apiKeySignupUrl: 'https://openrouter.ai/keys',
    docsUrl: 'https://openrouter.ai/docs',
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
    id: 'openrouter',
    name: 'OpenRouter',
    metadata,

    /** The public models endpoint works without an API key. */
    allowKeylessFetch: true,

    /** True when an API key is configured. */
    hasApiKey() {
      return Boolean(apiKey && String(apiKey).trim());
    },

    /** Fetch the raw model catalog entries. */
    async fetchModels() {
      const payload = await fetchJson(`${baseUrl}/api/v1/models`);
      return payload.data;
    },

    /** Decide whether a raw model entry qualifies as free. */
    isFree(raw) {
      return isFreePricing(raw?.pricing);
    },

    /**
     * Map a raw model entry to its canonical form.
     *
     * The canonical shape for OpenRouter models is the raw API object itself;
     * injecting extra fields (providerId, sourceUrl) here would change the
     * committed snapshot format, so normalization is a defensive copy.
     */
    normalize(raw) {
      return { ...raw };
    },

    /** Fetch the rankings-daily dataset payload (requires an API key). */
    async fetchRankingsDaily() {
      return fetchJson(`${baseUrl}/api/v1/datasets/rankings-daily`);
    },

    /** Fetch the top-weekly model list. */
    async fetchTopWeekly() {
      const payload = await fetchJson(`${baseUrl}/api/v1/models?sort=top-weekly`);
      return payload.data || [];
    },
  };
}

const openRouterAdapter = createOpenRouterAdapter();

module.exports = {
  isFreePricing,
  createOpenRouterAdapter,
  openRouterAdapter,
};
