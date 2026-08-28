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

async function render(providerMeta: ProviderMetadata = PROVIDER, providerId?: string, modelId = MODEL_ID) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(HarnessSetupGuide, { modelId, providerMeta, providerId }));
  });
}

describe('HarnessSetupGuide', () => {
  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
    root = null;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders four accessible tabs and one visible associated panel', async () => {
    await render();
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Claude Code', 'Pi', 'OpenCode', 'Codex']);
    expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    expect(tabs.every((tab) => container.querySelector(`#${tab.getAttribute('aria-controls')}`))).toBe(true);
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(4);
    expect(container.querySelectorAll('[role="tabpanel"][hidden]')).toHaveLength(3);
  });

  it('shows provenance links, verification date, and the access warning', async () => {
    await render();
    expect(container.querySelector('a[href="https://code.claude.com/docs/en/llm-gateway"]')).toBeTruthy();
    expect(container.querySelector('a[href="https://openrouter.ai/docs"]')).toBeTruthy();
    expect(container.querySelector('a[href="https://openrouter.ai/keys"]')).toBeTruthy();
    expect(container.textContent).toContain('Verified 2026-08-27');
    expect(container.textContent).toContain('Credentials may be required');
    expect(container.textContent).toContain('free quotas can change');
    expect(container.textContent).toContain('prompts or tool output leave your machine');
    for (const link of container.querySelectorAll('a')) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });

  it('switches panels and renders numbered, copyable supported steps', async () => {
    await render();
    const piTab = container.querySelector<HTMLButtonElement>('#harness-tab-pi')!;
    await act(async () => piTab.click());
    const panel = container.querySelector<HTMLElement>('#harness-panel-pi')!;
    expect(panel.hidden).toBe(false);
    expect(panel.querySelectorAll('ol > li')).toHaveLength(2);
    expect(panel.textContent).toContain('1.');
    expect(panel.textContent).toContain('2.');
    expect(panel.querySelectorAll('button[aria-label^="Copy "]')).not.toHaveLength(0);
    expect(panel.textContent).toContain('/login');
    expect(panel.textContent).toContain("pi --provider 'openrouter'");
    expect(container.querySelector('#harness-panel-claude-code')?.hasAttribute('hidden')).toBe(true);
  });

  it('only shows Copy all for safe shell concatenation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await render(PROVIDER, undefined, 'anthropic/claude-3');
    expect(container.querySelector('#harness-panel-claude-code button')?.textContent).toContain('Copy');
    expect(container.querySelector('#harness-panel-claude-code button[aria-label="Copy all"]')).toBeTruthy();
    await act(async () => container.querySelector<HTMLButtonElement>('#harness-panel-claude-code button[aria-label="Copy all"]')!.click());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('OPENAI_API_KEY'));
    await act(async () => container.querySelector<HTMLButtonElement>('#harness-tab-pi')!.click());
    expect(container.querySelector('#harness-panel-pi button[aria-label="Copy all"]')).toBeNull();
  });

  it('explains unsupported combinations without rendering setup commands', async () => {
    const google: ProviderMetadata = { ...PROVIDER, id: 'google', displayName: 'Google AI Studio' };
    await render(google, 'google');
    const panel = container.querySelector<HTMLElement>('#harness-panel-claude-code')!;
    expect(panel.textContent).toContain('Unsupported');
    expect(panel.textContent).toContain('No setup command is shown');
    expect(panel.textContent).toContain('different protocols');
    expect(panel.querySelector('a[href="https://code.claude.com/docs/en/llm-gateway"]')).toBeTruthy();
    expect(panel.querySelector('pre')).toBeNull();
  });

  it('reports a manual-copy fallback when clipboard and execCommand fail', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    document.execCommand = vi.fn(() => false);
    await render(PROVIDER, undefined, 'anthropic/claude-3');
    const copyButton = container.querySelector<HTMLButtonElement>('#harness-panel-claude-code button[aria-label="Copy Check OPENROUTER_API_KEY"]')!;
    await act(async () => copyButton.click());
    expect(container.textContent).toContain('Copy failed. Select the snippet manually');
  });
});
