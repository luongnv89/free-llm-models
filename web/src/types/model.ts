export interface ModelArchitecture {
  modality: string;
  input_modalities: string[];
  output_modalities: string[];
  tokenizer: string;
  instruct_type: string | null;
}

export interface ModelPricing {
  prompt: string;
  completion: string;
}

export interface TopProvider {
  context_length: number;
  max_completion_tokens: number | null;
  is_moderated: boolean;
}

export interface Popularity {
  rank: number | null;
  tokens?: number | null;
  source: string;
  asOf: string;
  reason?: string;
}

export interface Model {
  id: string;
  canonical_slug: string;
  hugging_face_id: string | null;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: ModelArchitecture;
  pricing: ModelPricing;
  top_provider: TopProvider;
  per_request_limits: unknown;
  supported_parameters: string[];
  default_parameters: Record<string, unknown>;
  expiration_date: string | null;
  addedToFreeList?: string;
  popularity?: Popularity;
}

export interface ArchivedModel {
  id: string;
  removedAt: string;
  lastSeenAt: string;
  addedToFreeList?: string;
  model: Model;
}

export interface ProviderIndexEntry {
  id: string;
  name: string;
  metadata: ProviderMetadata;
  modelCount: number;
  fetchedAt: string;
}

export interface ModelsIndex {
  providers: ProviderIndexEntry[];
}

export interface ProviderModelsPayload {
  providerId: string;
  fetchedAt: string;
  newModelIds?: string[];
  archivedModels?: ArchivedModel[];
  models: Model[];
}

export interface ModelsData {
  fetchedAt: string;
  totalModels: number;
  newModelIds: string[];
  models: Model[];
  archivedModels?: ArchivedModel[];
  providers?: ProviderMetadata[];
}

export type SortField = 'name' | 'provider' | 'context_length' | 'created' | 'addedToFreeList';
export type SortOrder = 'asc' | 'desc';

export interface FilterState {
  search: string;
  sources: string[];
  providers: string[];
  modalities: string[];
  contextLengthMin: number | null;
  contextLengthMax: number | null;
  hasReasoning: boolean | null;
  hasTools: boolean | null;
}

export interface ResolvedModel {
  model: Model;
  archived: boolean;
  archive?: ArchivedModel;
}

export interface RateLimits {
  requestsPerMinute?: number | null;
  tokensPerMinute?: number | null;
  requestsPerDay?: number | null;
}

export type CanonicalModel = Model & {
  providerId: string;
  sourceUrl?: string | null;
  rateLimits?: RateLimits | null;
};

export interface SourceOption {
  id: string;
  displayName: string;
  count: number;
}

export interface ProviderMetadata {
  id: string;
  displayName: string;
  baseUrl: string | null;
  /** OpenAI-compatible endpoint for chat/completions snippets, when the native baseUrl is not OpenAI-compatible. */
  openaiCompatibleBaseUrl?: string | null;
  apiKeySignupUrl: string | null;
  docsUrl: string | null;
  notes: string | null;
}
