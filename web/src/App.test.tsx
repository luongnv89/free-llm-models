// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from './App';
import { resetModelsCacheForTests } from '@/hooks/useModels';
import type { Model } from '@/types/model';

function makeModel(overrides: Partial<Model> & Pick<Model, 'id' | 'name'>): Model {
  return {
    canonical_slug: '',
    hugging_face_id: null,
    created: 1700000000,
    description: 'A test model',
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
    addedToFreeList: '2026-02-02T10:30:00Z',
    ...overrides,
  };
}

let container: HTMLElement;
let root: Root | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

function mockCatalog(models: Model[]) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        providers: [
          {
            id: 'acme',
            name: 'Acme AI',
            modelCount: models.length,
            fetchedAt: '2026-08-20T12:00:00Z',
            metadata: {
              id: 'acme',
              displayName: 'Acme AI',
              baseUrl: 'https://api.acme.ai/v1',
              apiKeySignupUrl: 'https://console.acme.ai/api-keys',
              docsUrl: 'https://docs.acme.ai',
              notes: null,
            },
          },
        ],
      }),
  });
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        providerId: 'acme',
        fetchedAt: '2026-08-20T12:00:00Z',
        newModelIds: [],
        models,
      }),
  });
}

async function renderAt(path: string, models: Model[]) {
  window.history.replaceState(null, '', path);
  mockCatalog(models);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(App));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('App deep links', () => {
  beforeEach(() => {
    resetModelsCacheForTests();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue('false'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      configurable: true,
    });
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  it('initializes the model route from an encoded direct URL', async () => {
    const model = makeModel({ id: 'acme/direct-model', name: 'Direct Model' });

    await renderAt(`/model/${encodeURIComponent(model.id)}`, [model]);

    expect(window.location.pathname).toBe('/model/acme%2Fdirect-model');
    expect(container.textContent).toContain('Direct Model');
    expect(container.textContent).not.toContain('Model not found');
  });

  it('navigates into a model detail page and back without a full page reload', async () => {
    const model = makeModel({ id: 'acme/navigation-model', name: 'Navigation Model' });

    await renderAt('/', [model]);

    const modelLink = container.querySelector(
      'a[href="/model/acme%2Fnavigation-model"]',
    ) as HTMLAnchorElement | null;
    expect(modelLink).toBeTruthy();

    await act(async () => {
      modelLink!.click();
    });

    expect(window.location.pathname).toBe('/model/acme%2Fnavigation-model');
    expect(container.textContent).toContain('Navigation Model');
    expect(container.textContent).not.toContain('Model not found');

    const backLink = [...container.querySelectorAll('a')].find(
      (link) => link.textContent?.includes('Back to Models'),
    );
    expect(backLink).toBeTruthy();

    await act(async () => {
      backLink!.click();
    });

    expect(window.location.pathname).toBe('/');
    expect(container.querySelector('ol[aria-label="Free models"]')).toBeTruthy();
    expect(container.textContent).toContain('Navigation Model');
  });

  it('keeps the model-not-found state for an unknown direct URL', async () => {
    await renderAt('/model/acme%2Fmissing-model', []);

    expect(container.textContent).toContain('Model not found');
    expect(container.textContent).toContain('The requested model could not be found.');
  });

  it('keeps the model-not-found state for a malformed encoded direct URL', async () => {
    await renderAt('/model/%E0%A4%A', []);

    expect(container.textContent).toContain('Model not found');
    expect(container.textContent).toContain('The requested model could not be found.');
  });
});
