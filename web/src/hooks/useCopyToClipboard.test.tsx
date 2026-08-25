// @vitest-environment happy-dom
/* eslint-disable react-hooks/immutability */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useCopyToClipboard } from './useCopyToClipboard';

type Hook = ReturnType<typeof useCopyToClipboard>;

let container: HTMLElement;
let root: Root | null = null;
const capture: { current?: Hook } = {};

function Probe({ feedbackMs }: { feedbackMs?: number }) {
  capture.current = useCopyToClipboard(feedbackMs);
  return null;
}

async function renderHook(feedbackMs?: number) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(Probe, { feedbackMs }));
  });
}

async function unmount() {
  await act(async () => {
    root?.unmount();
  });
  root = null;
}

describe('useCopyToClipboard', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
  });

  afterEach(async () => {
    if (root) await unmount();
    document.body.innerHTML = '';
    delete (document as unknown as Record<string, unknown>).execCommand;
    writeText.mockRestore();
    vi.useRealTimers();
  });

  it('writes via navigator.clipboard and flips copied to true', async () => {
    writeText.mockResolvedValue(undefined);
    await renderHook();

    expect(capture.current!.copied).toBe(false);

    let result = false;
    await act(async () => {
      result = await capture.current!.copy('hello');
    });

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(result).toBe(true);
    expect(capture.current!.copied).toBe(true);
  });

  it('resets copied after the feedback timeout', async () => {
    writeText.mockResolvedValue(undefined);
    await renderHook(2000);

    await act(async () => {
      await capture.current!.copy('hello');
    });
    expect(capture.current!.copied).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(capture.current!.copied).toBe(false);
  });

  it('falls back to execCommand when the Clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    await renderHook();

    let result = false;
    await act(async () => {
      result = await capture.current!.copy('fallback');
    });

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(result).toBe(true);
    expect(capture.current!.copied).toBe(true);
  });

  it('degrades gracefully (returns false, no throw) when every path fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    document.execCommand = vi.fn(() => false);
    await renderHook();

    let result = true;
    await act(async () => {
      result = await capture.current!.copy('doomed');
    });

    expect(result).toBe(false);
    expect(capture.current!.copied).toBe(false);
  });

  it('clears the feedback timer on unmount (no state update after unmount)', async () => {
    writeText.mockResolvedValue(undefined);
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    await renderHook();

    await act(async () => {
      await capture.current!.copy('hello');
    });
    expect(capture.current!.copied).toBe(true);

    clearTimeoutSpy.mockClear();
    await unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Advancing past the timeout after unmount must not blow up.
    vi.advanceTimersByTime(2000);
  });
});
