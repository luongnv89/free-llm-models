// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage";
import { resetModelsCacheForTests } from "@/hooks/useModels";
import type { ModelsData } from "@/types/model";

function makeModelsData(): ModelsData {
  return {
    fetchedAt: "2026-08-20T12:00:00Z",
    totalModels: 2,
    newModelIds: ["acme/fresh"],
    models: [
      {
        canonical_slug: "",
        hugging_face_id: null,
        created: Math.floor(Date.now() / 1000),
        description: "Fresh model",
        context_length: 128000,
        architecture: {
          modality: "text->text",
          input_modalities: ["text"],
          output_modalities: ["text"],
          tokenizer: "GPT",
          instruct_type: null,
        },
        pricing: { prompt: "0", completion: "0" },
        top_provider: {
          context_length: 128000,
          max_completion_tokens: null,
          is_moderated: false,
        },
        per_request_limits: null,
        supported_parameters: ["reasoning"],
        default_parameters: {},
        expiration_date: null,
        id: "acme/fresh",
        name: "Fresh Model",
        providerId: "google",
        addedToFreeList: new Date().toISOString(),
      },
      {
        canonical_slug: "",
        hugging_face_id: null,
        created: Math.floor(Date.now() / 1000),
        description: "Old model",
        context_length: 8192,
        architecture: {
          modality: "text->text",
          input_modalities: ["text"],
          output_modalities: ["text"],
          tokenizer: "GPT",
          instruct_type: null,
        },
        pricing: { prompt: "0", completion: "0" },
        top_provider: {
          context_length: 8192,
          max_completion_tokens: null,
          is_moderated: false,
        },
        per_request_limits: null,
        supported_parameters: [],
        default_parameters: {},
        expiration_date: null,
        id: "acme/old",
        name: "Old Model",
        providerId: "openrouter",
      },
    ],
  };
}

let container: HTMLElement;
let root: Root | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

async function renderPage(initialEntry = "/") {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      createElement(MemoryRouter, {
        initialEntries: [initialEntry],
        children: [createElement(HomePage)],
      }),
    );
  });
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("HomePage", () => {
  beforeEach(() => {
    resetModelsCacheForTests();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn().mockReturnValue("false"),
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

  it("renders the loading state first", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    await renderPage();

    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(container.textContent).not.toContain("OpenRouter Free Models");
  });

  it("renders the error state when fetching fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await renderPage();
    await settle();

    expect(container.textContent).toContain("Failed to load models");
    expect(container.textContent).toContain("network down");
  });

  it("renders models with counts and data URL after loading", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeModelsData()),
    });
    await renderPage();
    await settle();

    expect(container.textContent).toContain("2 free models available");
    expect(container.textContent).toContain(
      "1 New Model (added in last 3 days)",
    );
    expect(container.textContent).toContain("visible “New” badge");
    expect(container.textContent).toContain("Fresh Model");
    expect(container.textContent).toContain("Old Model");
    expect(container.textContent).toContain("/free_models.json");
    expect(container.textContent).toContain("Last updated");
    const archiveLinks = [...container.querySelectorAll('a[href="/archive"]')];
    const headerArchive = archiveLinks.find(
      (a) => a.getAttribute("aria-label") === "Former free models",
    );
    expect(headerArchive).toBeTruthy();
    expect(headerArchive!.querySelector("button")).toBeNull();
    expect(headerArchive!.tagName).toBe("A");
    expect(container.textContent).toContain("Archive");

    const list = container.querySelector('ol[aria-label="Free models"]');
    expect(list).toBeTruthy();
    expect(list!.getAttribute("role")).toBe("list");
    expect(list!.querySelectorAll(":scope > li")).toHaveLength(2);
    expect(list!.querySelector('[aria-label="Rank 1"]')?.textContent).toBe("1");
    expect(list!.querySelector('[aria-label="Rank 2"]')?.textContent).toBe("2");
  });

  it("re-ranks rows after filtering the sorted result", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeModelsData()),
    });
    await renderPage();
    await settle();

    const input = container.querySelector("input")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, "Old Model");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const list = container.querySelector('ol[aria-label="Free models"]');
    expect(list!.querySelectorAll(":scope > li")).toHaveLength(1);
    expect(list!.querySelector('[aria-label="Rank 1"]')?.textContent).toBe("1");
    expect(list!.textContent).toContain("Old Model");
  });

  it("renders ordered provider quick filters with accessible pressed state", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeModelsData()),
    });
    await renderPage();
    await settle();

    const group = container.querySelector(
      '[role="group"][aria-label="Filter models by provider"]',
    )!;
    const buttons = [...group.querySelectorAll("button")];
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "All",
      "OpenRouter",
      "Google",
      "Mistral",
      "Nvidia",
      "Groq",
      "Cerebras",
    ]);
    expect(
      buttons.every((button) => button.getAttribute("type") === "button"),
    ).toBe(true);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(
      buttons.slice(1).map((button) => button.getAttribute("aria-pressed")),
    ).toEqual(["false", "false", "false", "false", "false", "false"]);
    expect(group.textContent).toContain("OpenRouter1");
    expect(group.textContent).toContain("Google1");
    expect(group.textContent).toContain("Mistral0");
  });

  it("supports multi-select, sidebar synchronization, intersection, and All reset", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeModelsData()),
    });
    await renderPage();
    await settle();

    const group = container.querySelector(
      '[role="group"][aria-label="Filter models by provider"]',
    )!;
    const quickButton = (label: string) =>
      [...group.querySelectorAll("button")].find(
        (button) => button.getAttribute("aria-label") === label,
      )!;

    await act(async () => {
      quickButton("Google").click();
    });
    expect(quickButton("Google").getAttribute("aria-pressed")).toBe("true");
    expect(quickButton("All").getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).toContain("Fresh Model");
    expect(container.textContent).not.toContain("Old Model");

    const openRouterSidebarButton = [
      ...container.querySelectorAll("aside button"),
    ].find((button) =>
      button.textContent?.toLowerCase().includes("openrouter"),
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      openRouterSidebarButton!.click();
    });
    expect(quickButton("Google").getAttribute("aria-pressed")).toBe("true");
    expect(quickButton("OpenRouter").getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Old Model");

    await act(async () => {
      quickButton("Google").click();
    });
    expect(quickButton("Google").getAttribute("aria-pressed")).toBe("false");
    expect(quickButton("OpenRouter").getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).not.toContain("Fresh Model");

    await act(async () => {
      quickButton("All").click();
    });
    expect(quickButton("All").getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Fresh Model");
    expect(container.textContent).toContain("Old Model");
  });

  it("keeps duplicate model IDs distinct when filtering by provider", async () => {
    const data = makeModelsData();
    data.models = data.models.map((model, index) => ({
      ...model,
      id: "openai/gpt-oss-20b",
      name: index === 0 ? "Groq GPT OSS 20B" : "Nvidia GPT OSS 20B",
      providerId: index === 0 ? "groq" : "nvidia-nim",
      addedToFreeList: `2026-08-${26 - index}T08:00:00Z`,
    }));
    data.totalModels = data.models.length;

    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await renderPage();
    await settle();

    const duplicateKeyWarning = errorSpy.mock.calls.some(([message]) =>
      String(message).includes("same key"),
    );
    expect(duplicateKeyWarning).toBe(false);

    const group = container.querySelector(
      '[role="group"][aria-label="Filter models by provider"]',
    )!;
    const nvidiaButton = [...group.querySelectorAll("button")].find(
      (button) => button.getAttribute("aria-label") === "Nvidia",
    )!;
    await act(async () => {
      nvidiaButton.click();
    });

    const list = container.querySelector('ol[aria-label="Free models"]')!;
    expect(list.querySelectorAll(":scope > li")).toHaveLength(1);
    expect(list.textContent).toContain("Nvidia GPT OSS 20B");
    expect(list.textContent).not.toContain("Groq GPT OSS 20B");
  });

  it("shows the empty-state message when filters match nothing", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeModelsData()),
    });
    await renderPage();
    await settle();

    const input = container.querySelector("input")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, "zzz-no-such-model-zzz");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.textContent).toContain("No models match your filters");
    expect(container.textContent).toContain("0 of 2");
  });
});
