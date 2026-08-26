import { useState, useEffect, useMemo } from 'react';
import type {
  Model,
  ModelsData,
  ModelsIndex,
  ProviderModelsPayload,
  ProviderMetadata,
  FilterState,
  SourceOption,
  SortField,
  SortOrder,
  ArchivedModel,
  ResolvedModel,
} from '@/types/model';
import { modelCapabilities } from '@/lib/model-utils';

let cachedData: ModelsData | null = null;

export function resetModelsCacheForTests() {
  cachedData = null;
}

export function getModelsDataUrl(): string {
  return `${import.meta.env.BASE_URL}openrouter_free_models.json`;
}

export function getModelsIndexUrl(): string {
  return `${import.meta.env.BASE_URL}models/index.json`;
}

export function getProviderFileUrl(providerId: string): string {
  return `${import.meta.env.BASE_URL}models/${encodeURIComponent(providerId)}.json`;
}

export function normalizeModelsData(json: ModelsData): ModelsData {
  return {
    ...json,
    models: Array.isArray(json.models) ? json.models : [],
    newModelIds: Array.isArray(json.newModelIds) ? json.newModelIds : [],
    archivedModels: Array.isArray(json.archivedModels) ? json.archivedModels : [],
  };
}

export function mergeProviderPayloads(
  indexJson: ModelsIndex,
  payloads: (ProviderModelsPayload | null)[]
): ModelsData {
  const providers: ProviderMetadata[] = [];
  const models: Model[] = [];
  const archived: ArchivedModel[] = [];
  const newModelIds: string[] = [];
  let latestFetchedAt = '';

  for (const entry of indexJson.providers ?? []) {
    const payload = payloads.find(
      (p): p is ProviderModelsPayload => p?.providerId === entry.id
    );
    if (!payload || !Array.isArray(payload.models)) continue;

    if (entry.metadata) providers.push(entry.metadata);
    else
      providers.push({
        id: entry.id,
        displayName: entry.name || entry.id,
        baseUrl: null,
        apiKeySignupUrl: null,
        docsUrl: null,
        notes: null,
      });

    for (const model of payload.models) {
      models.push({ ...model, providerId: payload.providerId } as Model);
    }
    if (Array.isArray(payload.newModelIds)) newModelIds.push(...payload.newModelIds);
    if (Array.isArray(payload.archivedModels)) {
      archived.push(
        ...payload.archivedModels.map((a) => ({
          ...a,
          model: { ...a.model, providerId: payload.providerId } as Model,
        }))
      );
    }

    const fetchedAt = Date.parse(payload.fetchedAt);
    const currentLatest = Date.parse(latestFetchedAt);
    if (!Number.isNaN(fetchedAt) && (Number.isNaN(currentLatest) || fetchedAt > currentLatest)) {
      latestFetchedAt = payload.fetchedAt;
    }
  }

  return normalizeModelsData({
    fetchedAt: latestFetchedAt || new Date().toISOString(),
    totalModels: models.length,
    newModelIds,
    models,
    archivedModels: archived,
    providers,
  });
}

export function isMultiProviderIndex(json: unknown): json is ModelsIndex {
  return (
    typeof json === 'object' &&
    json !== null &&
    Array.isArray((json as ModelsIndex).providers)
  );
}

export function getArchivedModels(data: ModelsData | null | undefined): ArchivedModel[] {
  return data?.archivedModels ?? [];
}

// Entries written before multi-provider tracking carry no providerId and are
// treated as belonging to OpenRouter (the original single source).
export function getArchiveProviderId(entry: ArchivedModel): string {
  const model = entry.model;
  if ('providerId' in model && typeof model.providerId === 'string' && model.providerId) {
    return model.providerId;
  }
  return 'openrouter';
}

export function getArchiveSourceOptions(
  entries: ArchivedModel[],
  providersMetadata: ProviderMetadata[] = []
): SourceOption[] {
  const displayNames = new Map(
    providersMetadata.map((p) => [p.id, p.displayName])
  );
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const source = getArchiveProviderId(entry);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([id, count]) => ({
      id,
      displayName: displayNames.get(id) ?? id,
      count,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function groupArchivedByProvider(
  entries: ArchivedModel[],
  providersMetadata: ProviderMetadata[] = []
): Array<{ providerId: string; displayName: string; entries: ArchivedModel[] }> {
  const displayNames = new Map(
    providersMetadata.map((p) => [p.id, p.displayName])
  );
  const groups = new Map<string, ArchivedModel[]>();
  for (const entry of entries) {
    const source = getArchiveProviderId(entry);
    const bucket = groups.get(source);
    if (bucket) bucket.push(entry);
    else groups.set(source, [entry]);
  }
  return Array.from(groups.entries())
    .map(([providerId, grouped]) => ({
      providerId,
      displayName: displayNames.get(providerId) ?? providerId,
      entries: grouped,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function findModelById(
  data: ModelsData | null | undefined,
  id: string
): ResolvedModel | null {
  if (!data || !id) return null;
  const live = data.models.find((m) => m.id === id);
  if (live) return { model: live, archived: false };

  const archive = getArchivedModels(data).find((entry) => entry.id === id);
  if (!archive?.model) return null;

  const model: Model = {
    ...archive.model,
    addedToFreeList: archive.addedToFreeList ?? archive.model.addedToFreeList,
  };
  return { model, archived: true, archive };
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json() as Promise<T>;
}

export function useModels() {
  const [data, setData] = useState<ModelsData | null>(cachedData);
  const [loading, setLoading] = useState(cachedData === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedData) return;

    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      try {
        let indexJson: ModelsIndex;
        try {
          const json = await fetchJson<unknown>(getModelsIndexUrl(), controller.signal);
          if (!isMultiProviderIndex(json)) throw new Error('Invalid models index');
          indexJson = json;
        } catch (indexErr) {
          if (
            cancelled ||
            controller.signal.aborted ||
            (indexErr instanceof DOMException && indexErr.name === 'AbortError')
          ) {
            return;
          }
          // Stale deploy without valid per-provider files: legacy single file.
          const json = await fetchJson<ModelsData>(getModelsDataUrl(), controller.signal);
          if (cancelled) return;
          cachedData = normalizeModelsData(json);
          setData(cachedData);
          setLoading(false);
          return;
        }
        const settled = await Promise.allSettled(
          indexJson.providers.map((entry) =>
            fetchJson<ProviderModelsPayload>(getProviderFileUrl(entry.id), controller.signal)
          )
        );
        if (cancelled) return;

        const payloads = settled.map((result) =>
          result.status === 'fulfilled' ? result.value : null
        );

        if (payloads.every((p) => p === null)) {
          throw new Error('Failed to load models');
        }

        const merged = mergeProviderPayloads(indexJson, payloads);
        cachedData = merged;
        setData(merged);
        setLoading(false);
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { data, loading, error };
}

export function getProvider(model: Model): string {
  if ('providerId' in model && typeof model.providerId === 'string' && model.providerId) {
    return model.providerId;
  }
  return model.id.split('/')[0] || 'Unknown';
}

export const OPENROUTER_DEFAULT_METADATA: ProviderMetadata = {
  id: 'openrouter',
  displayName: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKeySignupUrl: 'https://openrouter.ai/keys',
  docsUrl: 'https://openrouter.ai/docs',
  notes: null,
};

export function resolveProviderMetadata(
  model: Model,
  providers?: ProviderMetadata[] | null
): ProviderMetadata {
  const providerId = getProvider(model);
  const meta = providers?.find((p) => p.id === providerId);
  if (!meta) return OPENROUTER_DEFAULT_METADATA;
  return {
    id: meta.id,
    displayName: meta.displayName || OPENROUTER_DEFAULT_METADATA.displayName,
    baseUrl: meta.baseUrl ?? OPENROUTER_DEFAULT_METADATA.baseUrl,
    openaiCompatibleBaseUrl: meta.openaiCompatibleBaseUrl ?? null,
    apiKeySignupUrl: meta.apiKeySignupUrl ?? OPENROUTER_DEFAULT_METADATA.apiKeySignupUrl,
    docsUrl: meta.docsUrl ?? OPENROUTER_DEFAULT_METADATA.docsUrl,
    notes: meta.notes ?? null,
  };
}

export function providerApiKeyEnvVar(meta: ProviderMetadata): string {
  const base = (meta.displayName || meta.id || '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return `${base || 'API'}_API_KEY`;
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function isNewModel(model: Model): boolean {
  if (!model.addedToFreeList) return false;
  const addedMs = Date.parse(model.addedToFreeList);
  if (Number.isNaN(addedMs)) return false;
  return Date.now() - addedMs <= THREE_DAYS_MS;
}

function addedToFreeListMs(model: Model): number {
  if (model.addedToFreeList) {
    const parsed = Date.parse(model.addedToFreeList);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return model.created * 1000;
}

export function useFilteredModels(
  models: Model[],
  filters: FilterState,
  sortField: SortField,
  sortOrder: SortOrder
) {
  return useMemo(
    () => filterAndSortModels(models, filters, sortField, sortOrder),
    [models, filters, sortField, sortOrder]
  );
}

export function filterAndSortModels(
  models: Model[],
  filters: FilterState,
  sortField: SortField,
  sortOrder: SortOrder
): Model[] {
  let filtered = [...models];

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.name.toLowerCase().includes(searchLower) ||
        m.description.toLowerCase().includes(searchLower) ||
        m.id.toLowerCase().includes(searchLower)
    );
  }

  // Source filter (providerId of the loaded data)
  if (filters.sources.length > 0) {
    filtered = filtered.filter((m) => filters.sources.includes(getProvider(m)));
  }

  // Provider filter
  if (filters.providers.length > 0) {
    filtered = filtered.filter((m) =>
      filters.providers.includes(getProvider(m))
    );
  }

  // Modality filter
  if (filters.modalities.length > 0) {
    filtered = filtered.filter((m) =>
      filters.modalities.includes(m.architecture.modality)
    );
  }

  // Context length filter
  if (filters.contextLengthMin !== null) {
    filtered = filtered.filter(
      (m) => m.context_length >= filters.contextLengthMin!
    );
  }
  if (filters.contextLengthMax !== null) {
    filtered = filtered.filter(
      (m) => m.context_length <= filters.contextLengthMax!
    );
  }

  // Reasoning support filter
  if (filters.hasReasoning !== null) {
    filtered = filtered.filter((m) => {
      const hasReasoning = modelCapabilities(m).reasoning;
      return filters.hasReasoning ? hasReasoning : !hasReasoning;
    });
  }

  // Tools support filter
  if (filters.hasTools !== null) {
    filtered = filtered.filter((m) => {
      const hasTools = modelCapabilities(m).tools;
      return filters.hasTools ? hasTools : !hasTools;
    });
  }

  // Sort
  filtered.sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'provider':
        comparison = getProvider(a).localeCompare(getProvider(b));
        break;
      case 'context_length':
        comparison = a.context_length - b.context_length;
        break;
      case 'created':
        comparison = a.created - b.created;
        break;
      case 'addedToFreeList':
        comparison = addedToFreeListMs(a) - addedToFreeListMs(b);
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return filtered;
}

export function getUniqueProviders(models: Model[]): string[] {
  const providers = new Set(models.map(getProvider));
  return Array.from(providers).sort();
}

export function getSourceOptions(
  models: Model[],
  providersMetadata: ProviderMetadata[] = []
): SourceOption[] {
  const displayNames = new Map(
    providersMetadata.map((p) => [p.id, p.displayName])
  );
  const counts = new Map<string, number>();
  for (const model of models) {
    const source = getProvider(model);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([id, count]) => ({
      id,
      displayName: displayNames.get(id) ?? id,
      count,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getUniqueModalities(models: Model[]): string[] {
  const modalities = new Set(models.map((m) => m.architecture.modality));
  return Array.from(modalities).sort();
}
