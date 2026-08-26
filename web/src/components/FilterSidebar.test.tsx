// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FilterSidebar } from './FilterSidebar';
import type { FilterState, SourceOption } from '@/types/model';

let container: HTMLElement;
let root: Root | null = null;

const captured: { filterChanges: FilterState[] } = { filterChanges: [] };

const emptyFilters: FilterState = {
  search: '',
  sources: [],
  providers: [],
  modalities: [],
  contextLengthMin: null,
  contextLengthMax: null,
  hasReasoning: null,
  hasTools: null,
};

const sources: SourceOption[] = [
  { id: 'or', displayName: 'OpenRouter', count: 12 },
  { id: 'chutes', displayName: 'Chutes', count: 3 },
];

interface Props {
  filters?: FilterState;
}

function harness(props: Props) {
  return createElement(FilterSidebar, {
    filters: props.filters ?? emptyFilters,
    onFiltersChange: (filters: FilterState) => captured.filterChanges.push(filters),
    sources,
    providers: ['openai', 'meta'],
    modalities: ['text->text'],
  });
}

async function render(props: Props = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(harness(props));
  });
}

async function clickOption(label: string) {
  const button = [...container.querySelectorAll('button')].find(
    (b) => b.textContent?.includes(label)
  );
  expect(button).toBeTruthy();
  await act(async () => {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('FilterSidebar source filter', () => {
  beforeEach(() => {
    captured.filterChanges = [];
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
  });

  it('renders data-derived sources with per-source counts', async () => {
    await render();
    const sourceSection = [...container.querySelectorAll('h3')].find(
      (h) => h.textContent === 'Source'
    );
    expect(sourceSection).toBeTruthy();
    expect(container.textContent).toContain('OpenRouter');
    expect(container.textContent).toContain('Chutes');
    expect(container.textContent).toContain('12');
    expect(container.textContent).toContain('3');
  });

  it('emits updated filters when a source is selected', async () => {
    await render();
    await clickOption('OpenRouter');
    expect(captured.filterChanges).toEqual([
      { ...emptyFilters, sources: ['or'] },
    ]);
  });

  it('deselects an already selected source', async () => {
    await render({ filters: { ...emptyFilters, sources: ['or'] } });
    await clickOption('OpenRouter');
    expect(captured.filterChanges).toEqual([{ ...emptyFilters, sources: [] }]);
  });

  it('includes the source filter in the active count and clears it', async () => {
    await render({
      filters: { ...emptyFilters, sources: ['or'], search: 'llama' },
    });
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge?.textContent).toBe('1');

    await clickOption('Clear');
    expect(captured.filterChanges).toEqual([
      { ...emptyFilters, search: 'llama' },
    ]);
  });
});
