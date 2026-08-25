// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ArchivePage } from './ArchivePage';
import { resetModelsCacheForTests } from '@/hooks/useModels';
import type { Model, ModelsData } from '@/types/model';

function makeModel(overrides: Partial<Model> & Pick<Model, 'id' | 'name'>): Model {
  return {
    canonical_slug: '',
    hugging_face_id: null,
    created: 1700000000,
    description: 'Archived model',
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
    addedToFreeList: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeData(archived: Model[]): ModelsData {
  return {
    fetchedAt: '2026-08-20T12:00:00Z',
    totalModels: 1,
    newModelIds: [],
    models: [makeModel({ id: 'acme/live', name: 'Live Model', description: 'Still free' })],
    archivedModels: archived.map((model) => ({
      id: model.id,
      removedAt: '2026-08-01T00:00:00Z',
      lastSeenAt: '2026-07-31T00:00:00Z',
      addedToFreeList: model.addedToFreeList,
      model,
    })),
  };
}

let container: HTMLElement;
let root: Root | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

async function renderPage() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      createElement(MemoryRouter, {
        initialEntries: ['/archive'],
        children: [createElement(ArchivePage)],
      }),
    );
  });
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('ArchivePage', () => {
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

  it('renders the loading state first', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    await renderPage();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows an empty state when there are no archived models', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeData([])),
    });
    await renderPage();
    await settle();

    expect(container.textContent).toContain('Former free models');
    expect(container.textContent).toContain('No archived models yet');
    expect(container.textContent).not.toContain('Gone Model');
    expect(container.querySelector('a[href="/"]')).toBeTruthy();
  });

  it('lists archived models with detail links and omits live models', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(
          makeData([makeModel({ id: 'acme/gone', name: 'Gone Model' })]),
        ),
    });
    await renderPage();
    await settle();

    expect(container.textContent).toContain('1 archived model');
    expect(container.textContent).toContain('Gone Model');
    expect(container.textContent).toContain('Removed');
    expect(container.textContent).not.toContain('Live Model');
    expect(container.querySelector('a[href="/model/acme%2Fgone"]')).toBeTruthy();
  });
});
