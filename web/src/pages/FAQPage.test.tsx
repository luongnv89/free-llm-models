// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { FAQPage } from './FAQPage';

let container: HTMLElement;
let root: Root | null = null;

async function renderPage(hash = '') {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      createElement(MemoryRouter, {
        initialEntries: [`/${hash}`],
        children: [createElement(FAQPage)],
      }),
    );
  });
}

describe('FAQPage', () => {
  beforeEach(() => {
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
  });

  it('renders the header with a back link and FAQ sections', async () => {
    await renderPage();

    expect(container.textContent).toContain('Back to Models');
    expect(container.querySelectorAll('header').length).toBeGreaterThan(0);
    expect(container.textContent.length).toBeGreaterThan(200);
  });

  it('renders without a hash target', async () => {
    await renderPage('#getting-started');

    expect(container.textContent).toContain('Back to Models');
  });
});
