import { useState, useEffect, useMemo } from 'react';
import type { Model, ModelsData, FilterState, SortField, SortOrder } from '@/types/model';
import { modelCapabilities } from '@/lib/model-utils';

let cachedData: ModelsData | null = null;

export function getModelsDataUrl(): string {
  return `${import.meta.env.BASE_URL}openrouter_free_models.json`;
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
        cachedData = json;
        setData(json);
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
  const now = Date.now();
  const createdMs = model.created * 1000; // created is in seconds
  return now - createdMs <= THREE_DAYS_MS;
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
