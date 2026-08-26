const DEFAULT_PROVIDER_ID = 'openrouter';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

const isPlainObject = (value) => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

function openRouterModelToCanonical(model, options = {}) {
  const {
    providerId = DEFAULT_PROVIDER_ID,
    sourceUrl = OPENROUTER_MODELS_URL,
    rateLimits = null,
  } = options;

  if (!isPlainObject(model)) {
    throw new TypeError('model must be a plain object');
  }

  const canonical = { ...model, providerId };

  if (sourceUrl !== null) {
    canonical.sourceUrl = sourceUrl;
  }
  if (rateLimits !== null) {
    canonical.rateLimits = rateLimits;
  }

  return canonical;
}

function canonicalToOpenRouterModel(canonical) {
  if (!isPlainObject(canonical)) {
    throw new TypeError('canonical model must be a plain object');
  }

  const raw = { ...canonical };
  delete raw.providerId;
  delete raw.sourceUrl;
  delete raw.rateLimits;
  return raw;
}

function validateCanonicalModel(model) {
  const errors = [];

  if (!isPlainObject(model)) {
    return { valid: false, errors: ['model must be a plain object'] };
  }

  if (typeof model.id !== 'string' || model.id.length === 0) {
    errors.push('id must be a non-empty string');
  }
  if (typeof model.name !== 'string') {
    errors.push('name must be a string');
  }
  if (typeof model.created !== 'number' || !Number.isFinite(model.created)) {
    errors.push('created must be a finite number');
  }
  if (typeof model.description !== 'string') {
    errors.push('description must be a string');
  }
  if (
    model.context_length !== null &&
    (typeof model.context_length !== 'number' || !Number.isFinite(model.context_length))
  ) {
    errors.push('context_length must be a finite number or null');
  }
  if (!isPlainObject(model.pricing)) {
    errors.push('pricing must be an object');
  } else {
    if (typeof model.pricing.prompt !== 'string') {
      errors.push('pricing.prompt must be a string');
    }
    if (typeof model.pricing.completion !== 'string') {
      errors.push('pricing.completion must be a string');
    }
  }
  if (!isPlainObject(model.architecture)) {
    errors.push('architecture must be an object');
  } else {
    if (typeof model.architecture.modality !== 'string') {
      errors.push('architecture.modality must be a string');
    }
    if (!Array.isArray(model.architecture.input_modalities)) {
      errors.push('architecture.input_modalities must be an array');
    }
    if (!Array.isArray(model.architecture.output_modalities)) {
      errors.push('architecture.output_modalities must be an array');
    }
  }
  if (
    model.supported_parameters !== undefined &&
    model.supported_parameters !== null &&
    !Array.isArray(model.supported_parameters)
  ) {
    errors.push('supported_parameters must be an array or null');
  }
  if (typeof model.providerId !== 'string' || model.providerId.length === 0) {
    errors.push('providerId must be a non-empty string');
  }
  if (model.sourceUrl !== undefined && model.sourceUrl !== null && typeof model.sourceUrl !== 'string') {
    errors.push('sourceUrl must be a string or null');
  }
  if (model.rateLimits !== undefined && model.rateLimits !== null && !isPlainObject(model.rateLimits)) {
    errors.push('rateLimits must be an object or null');
  }

  return { valid: errors.length === 0, errors };
}

function defineProviderMetadata(provider) {
  if (!isPlainObject(provider)) {
    throw new TypeError('provider metadata must be a plain object');
  }

  const errors = [];
  if (typeof provider.id !== 'string' || provider.id.length === 0) {
    errors.push('provider metadata id must be a non-empty string');
  }
  if (typeof provider.displayName !== 'string' || provider.displayName.length === 0) {
    errors.push('provider metadata displayName must be a non-empty string');
  }
  if (provider.baseUrl !== undefined && provider.baseUrl !== null && typeof provider.baseUrl !== 'string') {
    errors.push('provider metadata baseUrl must be a string or null');
  }
  if (
    provider.apiKeySignupUrl !== undefined &&
    provider.apiKeySignupUrl !== null &&
    typeof provider.apiKeySignupUrl !== 'string'
  ) {
    errors.push('provider metadata apiKeySignupUrl must be a string or null');
  }
  if (provider.docsUrl !== undefined && provider.docsUrl !== null && typeof provider.docsUrl !== 'string') {
    errors.push('provider metadata docsUrl must be a string or null');
  }
  if (
    provider.openaiCompatibleBaseUrl !== undefined &&
    provider.openaiCompatibleBaseUrl !== null &&
    typeof provider.openaiCompatibleBaseUrl !== 'string'
  ) {
    errors.push('provider metadata openaiCompatibleBaseUrl must be a string or null');
  }
  if (provider.notes !== undefined && provider.notes !== null && typeof provider.notes !== 'string') {
    errors.push('provider metadata notes must be a string or null');
  }
  if (errors.length > 0) {
    throw new TypeError(errors.join('; '));
  }

  return {
    id: provider.id,
    displayName: provider.displayName,
    baseUrl: provider.baseUrl ?? null,
    apiKeySignupUrl: provider.apiKeySignupUrl ?? null,
    docsUrl: provider.docsUrl ?? null,
    openaiCompatibleBaseUrl: provider.openaiCompatibleBaseUrl ?? null,
    notes: provider.notes ?? null,
  };
}

module.exports = {
  DEFAULT_PROVIDER_ID,
  OPENROUTER_MODELS_URL,
  openRouterModelToCanonical,
  canonicalToOpenRouterModel,
  validateCanonicalModel,
  defineProviderMetadata,
};
