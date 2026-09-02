'use strict';

const { defineProviderMetadata } = require('./schema');

const DEFAULT_BASE_URL = 'https://developer.amd.com.cn/radeon';

/**
 * Free-tier predicate for AMD Radeon Token Factory.
 *
 * The Token Factory bootstrap endpoint lists only models in the "public_free"
 * gallery — every entry is served as a shared, points-based free endpoint
 * (points are usage metering, not charges). A model qualifies as free when
 * it has a non-empty string identity field. The `display_status` and badge
 * fields always contain "free" for this gallery but the check keys on `id`
 * / `model` so the predicate stays robust if the API adds non-free sections
 * in the future.
 *
 * @param {Object} [raw] Raw AMD Token Factory model entry (the `model` object
 *   from GET /api/tokenfactory/model).
 * @returns {boolean}
 */
const isAmdTokenFactoryFree = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const identity =
    (typeof raw.model === 'string' && raw.model.length > 0 && raw.model) ||
    (typeof raw.id === 'string' && raw.id.length > 0 && raw.id) ||
    (typeof raw.label === 'string' && raw.label.length > 0 && raw.label) ||
    '';
  if (!identity) return false;
  if (raw.enabled === false) return false;
  if (raw.status === 'offline') return false;
  return true;
};

/**
 * Create the AMD Radeon Token Factory provider adapter.
 *
 * Discovery is two-step: POST /api/tokenfactory/bootstrap?directory=true
 * returns the card list, then GET /api/tokenfactory/model?id=... is fetched
 * for each card to obtain the full model record.
 *
 * @param {Object} [options]
 * @param {string} [options.baseUrl] API base URL.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation (for tests).
 */
function createAmdTokenFactoryAdapter({
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch.bind(globalThis),
} = {}) {
  const metadata = defineProviderMetadata({
    id: 'amd-tokenfactory',
    displayName: 'AMD Radeon Token Factory',
    baseUrl,
    apiKeySignupUrl: 'https://developer.amd.com.cn/radeon/tokenfactory',
    docsUrl: 'https://developer.amd.com.cn/radeon/tokenfactory',
    notes:
      'Shared Model APIs served on AMD Radeon Cloud (Token Factory). ' +
      'Free to use with points-based metering (pts / 1M tokens) — not charges.',
  });

  async function fetchJson(url, options = {}) {
    const res = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'openrouter-free-models-updater',
      },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }

  return {
    id: 'amd-tokenfactory',
    name: 'AMD Radeon Token Factory',
    metadata,

    /** The Token Factory catalog is public; no API key required. */
    allowKeylessFetch: true,

    /** Token Factory does not use an API key for catalog listing. */
    hasApiKey() {
      return false;
    },

    /** Fetch the raw model catalog entries. */
    async fetchModels() {
      const bootstrapUrl = `${baseUrl}/api/tokenfactory/bootstrap?directory=true`;
      const bootstrap = await fetchJson(bootstrapUrl, { method: 'POST' });
      const cards = Array.isArray(bootstrap.cards) ? bootstrap.cards : [];
      if (cards.length === 0) return [];

      const details = await Promise.all(
        cards.map(async (card) => {
          const modelId = card.id;
          if (typeof modelId !== 'string' || modelId.length === 0) return null;
          const detailUrl = `${baseUrl}/api/tokenfactory/model?id=${encodeURIComponent(modelId)}`;
          const payload = await fetchJson(detailUrl);
          if (payload && payload.model) return payload.model;
          if (payload && payload.template) return payload.template;
          return payload;
        })
      );

      return details.filter((m) => m !== null && typeof m === 'object');
    },

    /** Decide whether a raw model entry qualifies as free. */
    isFree(raw) {
      return isAmdTokenFactoryFree(raw);
    },

    /**
     * Map a raw AMD Token Factory model entry to a CanonicalModel.
     *
     * The gallery catalog does not expose creation timestamps as epoch
     * seconds and its pricing is points-based (free). Rather than inventing
     * data:
     * - `pricing` is reported as flat "0" strings because every entry in
     *   the public_free gallery is a shared free endpoint (see
     *   isAmdTokenFactoryFree);
     * - `created` is reported as 0; no catalog timestamp exists;
     * - `name` mirrors `display_config.name` (falling back to the serving
     *   model id) and `description` mirrors display_config.description;
     * - `context_length` maps the model `context_length` when present;
     * - `architecture` reflects that these are OpenAI-compatible text
     *   chat models (text in → text out).
     *
     * @param {Object} raw Raw AMD Token Factory model entry.
     * @returns {Object} CanonicalModel.
     */
    normalize(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new TypeError('amd-tokenfactory model must be a plain object');
      }

      const modelId =
        (typeof raw.model === 'string' && raw.model.length > 0 && raw.model) ||
        (typeof raw.id === 'string' && raw.id.length > 0
          ? raw.id.includes(':')
            ? raw.id.split(':').pop()
            : raw.id
          : '') ||
        (typeof raw.label === 'string' && raw.label.length > 0 && raw.label) ||
        '';

      const displayName =
        (raw.display_config &&
          typeof raw.display_config.name === 'string' &&
          raw.display_config.name.length > 0 &&
          raw.display_config.name) ||
        (typeof raw.label === 'string' && raw.label.length > 0 && raw.label) ||
        String(modelId);

      const description =
        (raw.display_config &&
          typeof raw.display_config.description === 'string' &&
          raw.display_config.description) ||
        (typeof raw.description === 'string' && raw.description) ||
        '';

      const contextLength =
        typeof raw.context_length === 'number' && Number.isFinite(raw.context_length)
          ? raw.context_length
          : null;

      return {
        id: modelId,
        name: modelId && displayName ? displayName : String(modelId),
        created: 0,
        description,
        context_length: contextLength,
        pricing: { prompt: '0', completion: '0' },
        architecture: {
          modality: 'text->text',
          input_modalities: ['text'],
          output_modalities: ['text'],
        },
        providerId: 'amd-tokenfactory',
        sourceUrl: 'https://developer.amd.com.cn/radeon/tokenfactory',
      };
    },
  };
}

const amdTokenFactoryAdapter = createAmdTokenFactoryAdapter();

module.exports = {
  isAmdTokenFactoryFree,
  createAmdTokenFactoryAdapter,
  amdTokenFactoryAdapter,
};
