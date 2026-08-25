// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CodeSnippets } from './CodeSnippets';

const MODEL_ID = 'acme/test-model';

let container: HTMLElement;
let root: Root | null = null;

async function render(modelId = MODEL_ID) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(CodeSnippets, { modelId }));
  });
}

function tabLabels(): string[] {
  return [...container.querySelectorAll('button')]
    .map((button) => button.textContent?.trim() ?? '')
    .filter((label) => ['cURL', 'Node.js', 'Python', 'Claude Code'].includes(label));
}

describe('CodeSnippets', () => {
  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
  });

  it('does not render a Claude Code tab', async () => {
    await render();

    expect(container.textContent).not.toContain('Claude Code');
    expect(tabLabels()).not.toContain('Claude Code');
  });

  it('renders cURL, Node.js, and Python tabs with the model id', async () => {
    await render();

    expect(tabLabels()).toEqual(['cURL', 'Node.js', 'Python']);
    expect(container.textContent).toContain(MODEL_ID);
    expect(container.textContent).toContain('Quick Start');
  });

  it('switches snippets when a language tab is clicked', async () => {
    await render();

    const pythonTab = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Python'),
    );
    expect(pythonTab).toBeTruthy();

    await act(async () => {
      pythonTab!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('pip install openai');
    expect(container.textContent).toContain(`model="${MODEL_ID}"`);
    expect(container.textContent).not.toContain('Claude Code');
  });
});
