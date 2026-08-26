'use strict';

const { defineProviderMetadata } = require('./schema');

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/**
 * Free-tier predicate for NVIDIA NIM.
 *
 * NVIDIA's integrate.api.nvidia.com endpoint lists every model available
 * through the hosted NIM API. Access is covered by trial credits rather
 * than a permanent free tier, but the whole catalog is listable and usable
 * while credits last, so the predicate keys on the only required
 * OpenAI-compatible identity field: a non-empty string `id`.
 *
 * Note: NVIDIA's own documentation commonly uses the NVAPI_KEY env var
 * name; this adapter reads NVIDIA_API_KEY for consistency with the other
 * providers in this repo.
 *
 * @param {Object} [raw] Raw NVIDIA NIM model entry.
 * @returns {boolean}
 */
const isNvidiaNimFree = (raw) => {
  return typeof raw?.id === 'string' && raw.id.length > 0;
};

/**
 * Derive a human-readable display name from a NVIDIA NIM model id
 * (e.g. "meta/llama-3.3-70b-instruct" → "Meta/llama 3 3 70b Instruct").
 *
 * @param {string} id NVIDIA NIM model id.
 * @returns {string}
 */
const nvidiaNimModelName = (id) => {
  if (typeof id !== 'string' || id.length === 0) return '';
  const words = id.split(/[-_.]/g).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/**
 * Create the NVIDIA NIM provider adapter.
 *
 * @param {Object} [options]
 * @param {string} [options.apiKey] NVIDIA API key (defaults to
 *   NVIDIA_API_KEY env var).
 * @param {string} [options.baseUrl] API base URL.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation (for tests).
 */
function createNvidiaNimAdapter({
  apiKey = process.env.NVIDIA_API_KEY || '',
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch.bind(globalThis),
} = {}) {
  const metadata = defineProviderMetadata({
    id: 'nvidia-nim',
    displayName: 'NVIDIA NIM',
    baseUrl,
    apiKeySignupUrl: 'https://build.nvidia.com',
    docsUrl: 'https://docs.api.nvidia.com',
    notes:
      'Hosted NIM API access is granted via trial credits (NVAPI_KEY in ' +
      "NVIDIA's own docs); models are trial-credit eligible, not " +
      'permanently free.',
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
    id: 'nvidia-nim',
    name: 'NVIDIA NIM',
    metadata,

    /** The NIM catalog is public; fetch without an API key. */
    allowKeylessFetch: true,

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
      return isNvidiaNimFree(raw);
    },

    /**
     * Map a raw NVIDIA NIM model entry to a CanonicalModel.
     *
     * The NVIDIA NIM catalog does not expose per-token pricing, display
     * names or modality metadata. Rather than inventing data:
     * - `pricing` is reported as flat "0" strings because every entry on
     *   this endpoint is usable with NVIDIA's trial credits (trial-credit
     *   eligibility, not permanent freeness — see metadata.notes);
     * - `name` is derived from the model id and `description` is empty;
     * - `architecture` reflects that these are OpenAI-compatible text
     *   chat models (text in → text out);
     * - unknown `context_length` values fall back to null.
     *
     * @param {Object} raw Raw NVIDIA NIM model entry.
     * @returns {Object} CanonicalModel.
     */
    normalize(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new TypeError('nvidia-nim model must be a plain object');
      }

      return {
        id: raw.id,
        name: nvidiaNimModelName(raw.id),
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
        providerId: 'nvidia-nim',
        sourceUrl: `${baseUrl}/models`,
      };
    },
  };
}

const nvidiaNimAdapter = createNvidiaNimAdapter();

module.exports = {
  isNvidiaNimFree,
  createNvidiaNimAdapter,
  nvidiaNimAdapter,
};
