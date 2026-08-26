import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  filterAndSortModels,
  findModelById,
  getArchivedModels,
  getProvider,
  getUniqueModalities,
  getUniqueProviders,
  getSourceOptions,
  isNewModel,
  normalizeModelsData,
} from './useModels';
import type { FilterState, Model, ModelsData, SortField, SortOrder } from '@/types/model';

function makeModel(overrides: Partial<Model> & Pick<Model, 'id' | 'name'>): Model {
  return {
    canonical_slug: '',
    hugging_face_id: null,
    created: 1700000000,
    description: '',
    context_length: 8192,
    architecture: {
      modality: 'text->text',
      input_modalities: ['text'],
      output_modalities: ['text'],
      tokenizer: 'GPT',
      instruct_type: null,
    },
    pricing: { prompt: '0', completion: '0' },
    top_provider: { context_length: 8192, max_completion_tokens: null, is_moderated: false },
    per_request_limits: null,
    supported_parameters: [],
    default_parameters: {},
    expiration_date: null,
    ...overrides,
  };
}

const models: Model[] = [
  makeModel({
    id: 'openai/gpt-a',
    name: 'GPT Alpha',
    description: 'Fast chat model',
    context_length: 128000,
    created: 1750000000,
    supported_parameters: ['reasoning', 'tools'],
    architecture: {
      modality: 'text->text',
      input_modalities: ['text'],
      output_modalities: ['text'],
      tokenizer: 'GPT',
      instruct_type: null,
    },
  }),
  makeModel({
    id: 'meta/llama-b',
    name: 'Llama Beta',
    description: 'Open weights model',
    context_length: 4096,
    created: 1700000000,
    supported_parameters: ['tools'],
  }),
  makeModel({
    id: 'anthropic/claude-c',
    name: 'Claude Gamma',
    description: 'Long-context assistant',
    context_length: 200000,
    created: 1760000000,
    supported_parameters: ['reasoning'],
    architecture: {
      modality: 'text->image',
      input_modalities: ['text'],
      output_modalities: ['image'],
      tokenizer: 'Claude',
      instruct_type: null,
    },
  }),
];

function sourceTag(providerId: string): Record<string, string> {
  return { providerId };
}

const noFilters: FilterState = {
  search: '',
  sources: [],
  providers: [],
  modalities: [],
  contextLengthMin: null,
  contextLengthMax: null,
  hasReasoning: null,
  hasTools: null,
};

describe('getProvider', () => {
  it('extracts the prefix before the first slash', () => {
    expect(getProvider(models[0])).toBe('openai');
  });

  it('returns the whole id when there is no slash', () => {
    expect(getProvider(makeModel({ id: 'orphan', name: 'Orphan' }))).toBe('orphan');
  });

  it('falls back to Unknown when the id is empty', () => {
    expect(getProvider(makeModel({ id: '', name: 'Anonymous' }))).toBe('Unknown');
  });
});

describe('isNewModel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true within three days of addedToFreeList', () => {
    const recent = makeModel({
      id: 'a/b',
      name: 'A',
      addedToFreeList: '2026-08-24T00:00:00Z',
    });
    expect(isNewModel(recent)).toBe(true);
  });

  it('returns true at exactly the three-day boundary', () => {
    const boundary = makeModel({
      id: 'a/b',
      name: 'A',
      addedToFreeList: '2026-08-22T00:00:00Z',
    });
    expect(isNewModel(boundary)).toBe(true);
  });

  it('returns false after three days from addedToFreeList', () => {
    const old = makeModel({
      id: 'a/b',
      name: 'A',
      addedToFreeList: '2026-08-21T00:00:00Z',
    });
    expect(isNewModel(old)).toBe(false);
  });

  it('returns false when addedToFreeList is missing even if created is recent', () => {
    const nowS = Math.floor(new Date('2026-08-25T00:00:00Z').getTime() / 1000);
    expect(isNewModel(makeModel({ id: 'a/b', name: 'A', created: nowS }))).toBe(false);
  });
});

describe('getUniqueProviders', () => {
  it('returns sorted unique provider names', () => {
    expect(getUniqueProviders([...models, models[0]])).toEqual([
      'anthropic',
      'meta',
      'openai',
    ]);
  });

  it('returns an empty array for an empty list', () => {
    expect(getUniqueProviders([])).toEqual([]);
  });
});

describe('getUniqueModalities', () => {
  it('returns sorted unique modality strings', () => {
    expect(getUniqueModalities(models)).toEqual(['text->image', 'text->text']);
  });

  it('returns an empty array for an empty list', () => {
    expect(getUniqueModalities([])).toEqual([]);
  });
});

describe('filterAndSortModels', () => {
  const sort = (
    field: SortField,
    order: SortOrder,
    filters: Partial<FilterState> = {}
  ) =>
    filterAndSortModels(models, { ...noFilters, ...filters }, field, order).map(
      (m) => m.id
    );

  it('returns all models unchanged when no filters apply and does not mutate input', () => {
    const result = filterAndSortModels(models, noFilters, 'name', 'asc');
    expect(result).toHaveLength(3);
    expect(result).not.toBe(models);
    expect(models).toHaveLength(3);
  });

  it('filters by case-insensitive search across name, description, and id', () => {
    expect(sort('name', 'asc', { search: 'llama' })).toEqual(['meta/llama-b']);
    expect(sort('name', 'asc', { search: 'LONG-CONTEXT' })).toEqual([
      'anthropic/claude-c',
    ]);
    expect(sort('name', 'asc', { search: 'gpt-a' })).toEqual(['openai/gpt-a']);
  });

  it('filters by selected providers', () => {
    expect(sort('name', 'asc', { providers: ['openai'] })).toEqual([
      'openai/gpt-a',
    ]);
    expect(sort('name', 'asc', { providers: ['openai', 'meta'] })).toEqual([
      'openai/gpt-a',
      'meta/llama-b',
    ]);
  });

  it('filters by source providerId', () => {
    const withSources: Model[] = [
      { ...models[0], ...sourceTag('or') },
      { ...models[1], ...sourceTag('chutes') },
      { ...models[2], ...sourceTag('or') },
    ] as Model[];
    const ids = (sources: string[]) =>
      filterAndSortModels(
        withSources,
        { ...noFilters, sources },
        'name',
        'asc'
      ).map((m) => m.id);

    expect(ids(['or'])).toEqual(['anthropic/claude-c', 'openai/gpt-a']);
    expect(ids(['chutes'])).toEqual(['meta/llama-b']);
    expect(ids([])).toHaveLength(3);
  });

  it('intersects the source filter with search and other filters', () => {
    const withSources = [models[0], models[1]].map((m) => ({
      ...m,
      ...sourceTag('or'),
    })) as Model[];
    const ids = (filters: Partial<FilterState>) =>
      filterAndSortModels(
        withSources,
        { ...noFilters, ...filters },
        'name',
        'asc'
      ).map((m) => m.id);

    expect(ids({ sources: ['or'], search: 'llama' })).toEqual([
      'meta/llama-b',
    ]);
    expect(ids({ sources: ['or'], contextLengthMax: 8192 })).toEqual([
      'meta/llama-b',
    ]);
    expect(ids({ sources: ['chutes'] })).toEqual([]);
  });

  it('filters by modality', () => {
    expect(sort('name', 'asc', { modalities: ['text->image'] })).toEqual([
      'anthropic/claude-c',
    ]);
  });

  it('filters by minimum and maximum context length', () => {
    expect(sort('name', 'asc', { contextLengthMin: 100000 })).toEqual([
      'anthropic/claude-c',
      'openai/gpt-a',
    ]);
    expect(sort('name', 'asc', { contextLengthMax: 8192 })).toEqual([
      'meta/llama-b',
    ]);
    expect(
      sort('name', 'asc', { contextLengthMin: 5000, contextLengthMax: 150000 })
    ).toEqual(['openai/gpt-a']);
  });

  it('filters by reasoning support both ways', () => {
    expect(sort('created', 'desc', { hasReasoning: true })).toEqual([
      'anthropic/claude-c',
      'openai/gpt-a',
    ]);
    expect(sort('created', 'desc', { hasReasoning: false })).toEqual([
      'meta/llama-b',
    ]);
  });

  it('treats include_reasoning as reasoning support', () => {
    const withLegacyFlag = [
      makeModel({
        id: 'legacy/model',
        name: 'Legacy',
        supported_parameters: ['include_reasoning'],
      }),
    ];
    const result = filterAndSortModels(
      withLegacyFlag,
      { ...noFilters, hasReasoning: true },
      'name',
      'asc'
    );
    expect(result).toHaveLength(1);
  });

  it('filters by tools support both ways', () => {
    expect(sort('created', 'desc', { hasTools: true })).toEqual([
      'openai/gpt-a',
      'meta/llama-b',
    ]);
    expect(sort('created', 'desc', { hasTools: false })).toEqual([
      'anthropic/claude-c',
    ]);
  });

  it('sorts by name ascending and descending', () => {
    expect(sort('name', 'asc')).toEqual([
      'anthropic/claude-c',
      'openai/gpt-a',
      'meta/llama-b',
    ]);
    expect(sort('name', 'desc')).toEqual([
      'meta/llama-b',
      'openai/gpt-a',
      'anthropic/claude-c',
    ]);
  });

  it('sorts by provider alphabetically regardless of model name order', () => {
    expect(sort('provider', 'asc')).toEqual([
      'anthropic/claude-c',
      'meta/llama-b',
      'openai/gpt-a',
    ]);
  });

  it('sorts by context length numerically, not lexicographically', () => {
    expect(sort('context_length', 'asc')).toEqual([
      'meta/llama-b',
      'openai/gpt-a',
      'anthropic/claude-c',
    ]);
    expect(sort('context_length', 'desc')).toEqual([
      'anthropic/claude-c',
      'openai/gpt-a',
      'meta/llama-b',
    ]);
  });

  it('sorts by creation date newest-first when descending', () => {
    expect(sort('created', 'desc')).toEqual([
      'anthropic/claude-c',
      'openai/gpt-a',
      'meta/llama-b',
    ]);
  });

  it('sorts by addedToFreeList and falls back to created when missing', () => {
    const dated = [
      makeModel({
        id: 'a/old-join',
        name: 'Old Join',
        created: 1760000000,
        addedToFreeList: '2026-01-01T00:00:00Z',
      }),
      makeModel({
        id: 'a/new-join',
        name: 'New Join',
        created: 1700000000,
        addedToFreeList: '2026-08-01T00:00:00Z',
      }),
      makeModel({
        id: 'a/no-join',
        name: 'No Join',
        created: 1750000000,
      }),
    ];
    const ids = (field: SortField, order: SortOrder) =>
      filterAndSortModels(dated, noFilters, field, order).map((m) => m.id);

    expect(ids('addedToFreeList', 'asc')).toEqual([
      'a/no-join',
      'a/old-join',
      'a/new-join',
    ]);
    expect(ids('addedToFreeList', 'desc')).toEqual([
      'a/new-join',
      'a/old-join',
      'a/no-join',
    ]);
  });

  it('combines filters and sorting together', () => {
    expect(
      sort('context_length', 'desc', {
        hasTools: true,
        contextLengthMin: 100000,
      })
    ).toEqual(['openai/gpt-a']);
  });
});

describe('getSourceOptions', () => {
  it('derives options from data with metadata display names and counts', () => {
    const sourced = [
      { ...models[0], ...sourceTag('or') },
      { ...models[1], ...sourceTag('chutes') },
      { ...models[2], ...sourceTag('or') },
    ] as Model[];
    expect(
      getSourceOptions(sourced, [
        { id: 'or', displayName: 'OpenRouter', baseUrl: null, apiKeySignupUrl: null, docsUrl: null, notes: null },
        { id: 'chutes', displayName: 'Chutes', baseUrl: null, apiKeySignupUrl: null, docsUrl: null, notes: null },
      ])
    ).toEqual([
      { id: 'chutes', displayName: 'Chutes', count: 1 },
      { id: 'or', displayName: 'OpenRouter', count: 2 },
    ]);
  });

  it('falls back to the id when metadata is missing and sorts by display name', () => {
    const sourced = [
      { ...models[0], ...sourceTag('zeta') },
      { ...models[1], ...sourceTag('alpha') },
    ] as Model[];
    expect(getSourceOptions(sourced)).toEqual([
      { id: 'alpha', displayName: 'alpha', count: 1 },
      { id: 'zeta', displayName: 'zeta', count: 1 },
    ]);
  });

  it('returns an empty array for an empty list', () => {
    expect(getSourceOptions([])).toEqual([]);
  });
});

describe('archive resolution', () => {
  const live = makeModel({ id: 'acme/live', name: 'Live' });
  const archivedModel = makeModel({
    id: 'acme/gone',
    name: 'Gone',
    addedToFreeList: '2026-01-01T00:00:00Z',
  });
  const data: ModelsData = {
    fetchedAt: '2026-08-25T00:00:00Z',
    totalModels: 1,
    newModelIds: [],
    models: [live],
    archivedModels: [
      {
        id: 'acme/gone',
        removedAt: '2026-08-01T00:00:00Z',
        lastSeenAt: '2026-07-31T00:00:00Z',
        addedToFreeList: '2026-01-01T00:00:00Z',
        model: archivedModel,
      },
    ],
  };

  it('resolves a live model by id', () => {
    const resolved = findModelById(data, 'acme/live');
    expect(resolved?.archived).toBe(false);
    expect(resolved?.model.name).toBe('Live');
  });

  it('resolves an archived model by id without mixing it into the live list', () => {
    const resolved = findModelById(data, 'acme/gone');
    expect(resolved?.archived).toBe(true);
    expect(resolved?.model.name).toBe('Gone');
    expect(resolved?.archive?.removedAt).toBe('2026-08-01T00:00:00Z');
    expect(data.models.map((m) => m.id)).toEqual(['acme/live']);
  });

  it('returns null for unknown ids', () => {
    expect(findModelById(data, 'nope')).toBeNull();
  });

  it('defaults missing archivedModels to an empty list', () => {
    expect(
      getArchivedModels(
        normalizeModelsData({
          fetchedAt: '2026-08-25T00:00:00Z',
          totalModels: 0,
          newModelIds: [],
          models: [],
        })
      )
    ).toEqual([]);
  });
});
