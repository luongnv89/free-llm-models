// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ModelCard } from './ModelCard';
import { getProvider } from '@/hooks/useModels';
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
    ...overrides,
  };
}

let container: HTMLElement;
let root: Root | null = null;

async function render(model: Model, isNew = false) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      createElement(MemoryRouter, {
        children: [createElement(ModelCard, { model, isNew })],
      }),
    );
  });
}

describe('ModelCard', () => {
  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
  });

  it('renders provider, name, description and model id', async () => {
    const model = makeModel({ id: 'acme/test-model', name: 'Test Model' });
    await render(model);

    expect(container.textContent).toContain(getProvider(model));
    expect(container.textContent).toContain('Test Model');
    expect(container.textContent).toContain('A test model');
    expect(container.textContent).toContain('8K ctx');
    expect(container.textContent).toContain('acme/test-model');
    const link = container.querySelector('a');
    expect(link!.getAttribute('href')).toBe('/model/acme%2Ftest-model');
  });

  it('shows a fallback when the description is empty', async () => {
    await render(makeModel({ id: 'acme/x', name: 'X', description: '' }));
    expect(container.textContent).toContain('No description available');
  });

  it('hides the New badge for old models and shows it for new ones', async () => {
    await render(makeModel({ id: 'acme/old', name: 'Old' }), false);
    expect(container.textContent).not.toContain('New');

    await act(async () => {
      root!.render(
        createElement(MemoryRouter, {
          children: [
            createElement(ModelCard, {
              model: makeModel({ id: 'acme/new', name: 'New Model' }),
              isNew: true,
            }),
          ],
        }),
      );
    });
    expect(container.textContent).toContain('New');
  });

  it.each([
    [
      'vision',
      'Vision',
      { input_modalities: ['text', 'image'] as string[], output_modalities: ['text'] as string[] },
    ],
    [
      'video',
      'Video',
      { input_modalities: ['text', 'video'] as string[], output_modalities: ['text'] as string[] },
    ],
    ['reasoning', 'Reasoning', null],
    ['tools', 'Tools', null],
  ] as const)('shows the %s badge when supported', async (param, label, modalities) => {
    const base = {
      modality: 'text->text',
      input_modalities: ['text'],
      output_modalities: ['text'],
      tokenizer: 'GPT',
      instruct_type: null,
    };
    await render(
      makeModel({
        id: `acme/${param}`,
        name: 'Caps',
        supported_parameters: modalities ? [] : [param],
        architecture: modalities ? { ...base, ...modalities } : base,
      }),
    );
    expect(container.textContent).toContain(label);
  });

  it('renders capability tags with icons and color variants', async () => {
    await render(
      makeModel({
        id: 'acme/full',
        name: 'Full',
        supported_parameters: ['reasoning', 'tools'],
        architecture: {
          modality: 'text->text',
          input_modalities: ['text', 'image', 'video'],
          output_modalities: ['text'],
          tokenizer: 'GPT',
          instruct_type: null,
        },
      }),
    );

    for (const variant of ['vision', 'video', 'reasoning', 'tools'] as const) {
      const badge = container.querySelector(`[data-variant="${variant}"]`);
      expect(badge).toBeTruthy();
      expect(badge!.querySelector('svg')).toBeTruthy();
    }
  });

  it('copies the model id on copy-button click without navigating', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });


    await render(makeModel({ id: 'acme/copy-me', name: 'Copy Me' }));

    await act(async () => {
      const button = [...container.querySelectorAll('button')].find(
        (b) => b.getAttribute('title') === 'Copy model ID',
      );
      expect(button).toBeTruthy();
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(writeText).toHaveBeenCalledWith('acme/copy-me');
  });
});
