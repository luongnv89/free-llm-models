// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ModelDetailPage } from './ModelDetailPage';
import { resetModelsCacheForTests } from '@/hooks/useModels';
import type { Model, ModelsData, Popularity } from '@/types/model';

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

function makeData(model: Model): ModelsData {
  return {
    fetchedAt: '2026-08-20T12:00:00Z',
    totalModels: 1,
    newModelIds: [],
    models: [model],
  };
}

let container: HTMLElement;
let root: Root | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

async function renderPage(modelId: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      createElement(MemoryRouter, {
        initialEntries: [`/model/${encodeURIComponent(modelId)}`],
        children: createElement(Routes, {
          children: createElement(Route, {
            path: '/model/:modelId',
            element: createElement(ModelDetailPage),
          }),
        }),
      }),
    );
  });
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderModel(popularity?: Popularity) {
  const model = makeModel({
    id: 'acme/pop',
    name: 'Pop Model',
    popularity,
  });
  fetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(makeData(model)),
  });
  await renderPage(model.id);
  await settle();
}

describe('ModelDetailPage', () => {
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
    vi.restoreAllMocks();
  });

  it('renders provider metadata in docs link and code snippets when available', async () => {
    const model = {
      ...makeModel({ id: 'acme/pop', name: 'Pop Model' }),
      providerId: 'acme',
    } as Model;
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          providerId: 'acme',
          ...makeData(model),
          providers: [
            {
              id: 'acme',
              name: 'Acme AI',
              modelCount: 1,
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
    await renderPage(model.id);
    await settle();
    await settle();

    expect(container.textContent).toContain('Acme AI Docs');
    expect(container.querySelector('a[href="https://docs.acme.ai"]')).toBeTruthy();
    expect(container.textContent).toContain('https://api.acme.ai/v1/chat/completions');
    expect(container.textContent).not.toContain('openrouter.ai/api/v1');
  });

  it('shows rank and tokens when popularity is present', async () => {
    await renderModel({
      rank: 3,
      tokens: 1500,
      source: 'rankings-daily',
      asOf: '2026-08-20T12:00:00Z',
    });

    expect(container.textContent).toContain('Rank #3');
    expect(container.textContent).toContain('1,500 tokens');
    expect(container.textContent).toContain('OpenRouter daily rankings');
    expect(container.textContent).not.toContain('Unavailable');
  });

  it('maps unmatched popularity to user-facing copy', async () => {
    await renderModel({
      rank: null,
      tokens: null,
      source: 'rankings-daily',
      reason: 'unmatched',
      asOf: '2026-08-20T12:00:00Z',
    });

    expect(container.textContent).toContain('Not in OpenRouter rankings');
    expect(container.textContent).not.toContain('Unavailable (unmatched)');
    expect(container.textContent).not.toContain('(unmatched)');
  });

  it('maps unavailable popularity without repeating Unavailable', async () => {
    await renderModel({
      rank: null,
      tokens: null,
      source: 'rankings-daily',
      reason: 'unavailable',
      asOf: '2026-08-20T12:00:00Z',
    });

    expect(container.textContent).toContain('Rankings unavailable');
    expect(container.textContent).not.toContain('Unavailable (unavailable)');
    expect(container.textContent).not.toContain('(unavailable)');
  });
});
