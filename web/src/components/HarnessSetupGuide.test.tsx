// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HarnessSetupGuide } from './HarnessSetupGuide';
import type { ProviderMetadata } from '@/types/model';

const MODEL_ID = 'meta/llama-3.1-8b-instruct';
const PROVIDER: ProviderMetadata = {
  id: 'openrouter',
  displayName: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKeySignupUrl: 'https://openrouter.ai/keys',
  docsUrl: 'https://openrouter.ai/docs',
  notes: null,
};

let container: HTMLElement;
let root: Root | null = null;

async function render() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(HarnessSetupGuide, { modelId: MODEL_ID, providerMeta: PROVIDER }));
  });
}

describe('HarnessSetupGuide', () => {
  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
    vi.restoreAllMocks();
  });

  it('renders four accessible harness tabs and the initial panel', async () => {
    await render();

    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Claude Code',
      'Pi',
      'OpenCode',
      'Codex',
    ]);
    expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    expect(container.textContent).toContain(MODEL_ID);
  });

  it('switches the active tab and panel', async () => {
    await render();

    const openCodeTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (tab) => tab.textContent === 'OpenCode',
    );
    expect(openCodeTab).toBeTruthy();
    await act(async () => {
      openCodeTab!.click();
    });

    expect(openCodeTab!.getAttribute('aria-selected')).toBe('true');
    expect(container.textContent).toContain('Official OpenCode docs');
    expect(container.textContent).toContain(MODEL_ID);
    expect(container.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe(
      'harness-tab-opencode',
    );
  });

  it('links to provider and official harness documentation', async () => {
    await render();

    expect(container.querySelector('a[href="https://code.claude.com/docs/en/llm-gateway"]')).toBeTruthy();
    expect(container.querySelector('a[href="https://openrouter.ai/docs"]')).toBeTruthy();
    expect(container.querySelector('a[href="https://openrouter.ai/keys"]')).toBeTruthy();
    for (const link of container.querySelectorAll('a')) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });

  it('copies the active harness command', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    await render();

    const copyButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy Claude Code model ID"]',
    );
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton!.click();
    });

    expect(writeText).toHaveBeenCalledWith(MODEL_ID);
    expect(container.querySelector('button[aria-label="Copy Claude Code model ID"] svg')).toBeTruthy();
  });
});
