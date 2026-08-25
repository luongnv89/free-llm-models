// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ModelsData } from '@/types/model';

function makeModelsData(): ModelsData {
  return {
    fetchedAt: '2026-08-20T12:00:00Z',
    totalModels: 1,
    newModelIds: [],
    models: [
      {
        canonical_slug: '',
        hugging_face_id: null,
        created: 1700000000,
        description: 'A model',
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
        id: 'acme/old',
        name: 'Old Model',
      },
    ],
  };
}

let container: HTMLElement;
let root: Root | null = null;
let fetchMock: ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useModels: any;

async function renderHook() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  function Probe() {
    const { data, loading, error } = useModels();
    if (loading) return createElement('div', { 'data-state': 'loading' });
    if (error) return createElement('div', { 'data-state': 'error' }, error);
    return createElement(
      'div',
      { 'data-state': 'loaded' },
      String(data?.models.length ?? -1),
    );
  }

  await act(async () => {
    root!.render(createElement(Probe));
  });
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useModels fetching', () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./useModels');
    useModels = mod.useModels;
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
    vi.restoreAllMocks();
  });

  it('fetches from the BASE_URL-derived path', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeModelsData()),
    });
    await renderHook();
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/openrouter_free_models.json');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('serves the dataset from cache on remount without refetching', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeModelsData()),
    });

    await renderHook();
    await settle();
    expect(container.textContent).toContain('1');

    await act(async () => {
      root?.unmount();
    });
    container.remove();

    await renderHook();
    expect(container.querySelector('[data-state="loaded"]')).toBeTruthy();

    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts an in-flight request on unmount', async () => {
    let capturedSignal: AbortSignal | null | undefined = null;
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          capturedSignal = init?.signal;
          capturedSignal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    await renderHook();
    expect(container.querySelector('[data-state="loading"]')).toBeTruthy();

    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;

    const signal = capturedSignal as unknown as AbortSignal;
    expect(signal.aborted).toBe(true);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows the error state when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await renderHook();
    await settle();

    expect(container.textContent).toContain('network down');
  });

  it('does not surface abort errors as load failures', async () => {
    fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    await renderHook();
    await settle();

    expect(container.querySelector('[data-state="error"]')).toBeFalsy();
    expect(container.querySelector('[data-state="loading"]')).toBeTruthy();
  });
});
