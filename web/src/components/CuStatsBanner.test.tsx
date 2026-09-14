// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CuStatsBanner } from "./CuStatsBanner";

let container: HTMLElement;
let root: Root | null = null;
let storage: Record<string, string>;

async function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(CuStatsBanner));
  });
}

describe("CuStatsBanner", () => {
  beforeEach(() => {
    storage = {};
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => {
          storage[key] = value;
        },
        removeItem: (key: string) => {
          delete storage[key];
        },
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

  it("describes CuStats as a free AI usage and cost tracker", async () => {
    await render();

    expect(container.textContent).toContain("CuStats");
    expect(container.textContent).toContain("free AI usage & cost tracking");
    expect(container.textContent).toContain("Learn more");
  });

  it("links to custats.com in a new tab", async () => {
    await render();

    const link = container.querySelector("a");
    expect(link).toBeTruthy();
    expect(link!.getAttribute("href")).toBe("https://custats.com");
    expect(link!.getAttribute("target")).toBe("_blank");
    expect(link!.getAttribute("rel")).toContain("noopener");
  });

  it("dismisses the bar and persists the choice", async () => {
    await render();

    const dismiss = container.querySelector('button[aria-label="Dismiss"]');
    expect(dismiss).toBeTruthy();
    await act(async () => {
      dismiss!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(storage.custatsBarDismissed).toBe("1");
    expect(container.querySelector("a")).toBeNull();
  });

  it("stays hidden when previously dismissed", async () => {
    storage.custatsBarDismissed = "1";
    await render();

    expect(container.querySelector("a")).toBeNull();
  });
});
