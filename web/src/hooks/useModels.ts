import { useState, useEffect, useMemo } from 'react';
import type {
  Model,
  ModelsData,
  FilterState,
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

export function normalizeModelsData(json: ModelsData): ModelsData {
  return {
    ...json,
    models: Array.isArray(json.models) ? json.models : [],
    newModelIds: Array.isArray(json.newModelIds) ? json.newModelIds : [],
    archivedModels: Array.isArray(json.archivedModels) ? json.archivedModels : [],
  };
}

export function getArchivedModels(data: ModelsData | null | undefined): ArchivedModel[] {
  return data?.archivedModels ?? [];
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

export function useModels() {
  const [data, setData] = useState<ModelsData | null>(cachedData);
  const [loading, setLoading] = useState(cachedData === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedData) return;

    const controller = new AbortController();
    let cancelled = false;

    fetch(getModelsDataUrl(), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load models');
        return res.json();
      })
      .then((json: ModelsData) => {
        if (cancelled) return;
        const normalized = normalizeModelsData(json);
        cachedData = normalized;
        setData(normalized);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { data, loading, error };
}

export function getProvider(model: Model): string {
  return model.id.split('/')[0] || 'Unknown';
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

export function getUniqueModalities(models: Model[]): string[] {
  const modalities = new Set(models.map((m) => m.architecture.modality));
  return Array.from(modalities).sort();
}
