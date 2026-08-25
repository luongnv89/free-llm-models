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

export interface ModelsData {
  fetchedAt: string;
  totalModels: number;
  newModelIds: string[];
  models: Model[];
  archivedModels?: ArchivedModel[];
}

export type SortField = 'name' | 'provider' | 'context_length' | 'created' | 'addedToFreeList';
export type SortOrder = 'asc' | 'desc';

export interface FilterState {
  search: string;
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
