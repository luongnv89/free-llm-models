// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ModelDetailPage } from "./ModelDetailPage";
import { resetModelsCacheForTests } from "@/hooks/useModels";
import type { Model, ModelsData, Popularity } from "@/types/model";

function makeModel(
  overrides: Partial<Model> & Pick<Model, "id" | "name">,
): Model {
  return {
    canonical_slug: "",
    hugging_face_id: null,
    created: 1700000000,
    description: "A test model",
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
    addedToFreeList: "2026-02-02T10:30:00Z",
    ...overrides,
  };
}

function makeData(model: Model): ModelsData {
  return {
    fetchedAt: "2026-08-20T12:00:00Z",
    totalModels: 1,
    newModelIds: [],
    models: [model],
  };
}

let container: HTMLElement;
let root: Root | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

async function renderPage(modelId: string) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      createElement(MemoryRouter, {
        initialEntries: [`/model/${encodeURIComponent(modelId)}`],
        children: createElement(Routes, {
          children: createElement(Route, {
            path: "/model/:modelId",
            element: createElement(ModelDetailPage),
          }),
        }),
      }),
    );
  });
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderModel(popularity?: Popularity) {
  const model = makeModel({
    id: "acme/pop",
    name: "Pop Model",
    popularity,
  });
  fetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(makeData(model)),
  });
  await renderPage(model.id);
  await settle();
}

describe("ModelDetailPage", () => {
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

  it("renders the banner while loading", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    await renderPage("acme/loading");

    expect(container.querySelector('a[href="https://custats.info"]')).toBeTruthy();
  });

  it("renders the banner when the model cannot be loaded", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await renderPage("acme/missing");
    await settle();

    expect(container.textContent).toContain("Model not found");
    expect(container.querySelector('a[href="https://custats.info"]')).toBeTruthy();
  });

  it("renders provider metadata in docs link and code snippets when available", async () => {
    const model = {
      ...makeModel({ id: "acme/pop", name: "Pop Model" }),
      providerId: "acme",
    } as Model;
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          providerId: "acme",
          ...makeData(model),
          providers: [
            {
              id: "acme",
              name: "Acme AI",
              modelCount: 1,
              metadata: {
                id: "acme",
                displayName: "Acme AI",
                baseUrl: "https://api.acme.ai/v1",
                apiKeySignupUrl: "https://console.acme.ai/api-keys",
                docsUrl: "https://docs.acme.ai",
                notes: null,
              },
            },
          ],
        }),
    });
    await renderPage(model.id);
    await settle();
    await settle();

    expect(container.textContent).toContain("Acme AI Docs");
    expect(
      container.querySelector('a[href="https://docs.acme.ai"]'),
    ).toBeTruthy();
    expect(container.textContent).toContain(
      "https://api.acme.ai/v1/chat/completions",
    );
    expect(container.textContent).not.toContain("openrouter.ai/api/v1");
  });

  it("renders the general guide for non-OpenRouter providers without showing Ori", async () => {
    const model = {
      ...makeModel({ id: "google-gemini-2", name: "Gemini 2" }),
      providerId: "google",
    } as Model;
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          providerId: "google",
          ...makeData(model),
          providers: [
            {
              id: "google",
              displayName: "Google AI Studio",
              baseUrl: "https://generativelanguage.googleapis.com",
              apiKeySignupUrl: "https://aistudio.google.com/apikey",
              docsUrl: "https://ai.google.dev/gemini-api/docs",
              notes: null,
            },
          ],
        }),
    });
    await renderPage(model.id);
    await settle();
    await settle();

    expect(container.textContent).toContain("Set up a coding harness");
    expect(container.textContent).toContain("Google AI Studio provider docs");
    expect(container.textContent).not.toContain("Use in any harness via Ori");
    expect(container.textContent).toContain("No setup command is shown");
  });

  it("shows rank and tokens when popularity is present", async () => {
    await renderModel({
      rank: 3,
      tokens: 1500,
      source: "rankings-daily",
      asOf: "2026-08-20T12:00:00Z",
    });

    expect(container.textContent).toContain("Rank #3");
    expect(container.textContent).toContain("1,500 tokens");
    expect(container.textContent).toContain("OpenRouter daily rankings");
    expect(container.textContent).not.toContain("Unavailable");
  });

  it("maps unmatched popularity to user-facing copy", async () => {
    await renderModel({
      rank: null,
      tokens: null,
      source: "rankings-daily",
      reason: "unmatched",
      asOf: "2026-08-20T12:00:00Z",
    });

    expect(container.textContent).toContain("Not in OpenRouter rankings");
    expect(container.textContent).not.toContain("Unavailable (unmatched)");
    expect(container.textContent).not.toContain("(unmatched)");
  });

  it("renders the general harness guide before Ori for a nested OpenRouter model", async () => {
    const model = {
      ...makeModel({ id: "meta/llama-3.1-8b-instruct", name: "Llama" }),
      providerId: "openrouter",
    } as Model;
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          providerId: "openrouter",
          ...makeData(model),
          providers: [
            {
              id: "openrouter",
              displayName: "OpenRouter",
              baseUrl: "https://openrouter.ai/api/v1",
              apiKeySignupUrl: "https://openrouter.ai/keys",
              docsUrl: "https://openrouter.ai/docs",
              notes: null,
            },
          ],
        }),
    });
    await renderPage(model.id);
    await settle();
    await settle();

    expect(
      container.querySelectorAll(
        '[role="tablist"][aria-label="Choose a coding harness"] [role="tab"]',
      ),
    ).toHaveLength(4);
    const guidePosition = container.textContent!.indexOf(
      "Set up a coding harness",
    );
    const oriPosition = container.textContent!.indexOf(
      "Use in any harness via Ori",
    );
    expect(guidePosition).toBeGreaterThanOrEqual(0);
    expect(oriPosition).toBeGreaterThan(guidePosition);
  });

  it("renders the general harness guide for archived models", async () => {
    const model = {
      ...makeModel({ id: "acme/archived", name: "Archived Model" }),
      providerId: "acme",
    } as Model;
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          providerId: "acme",
          ...makeData(model),
          models: [],
          archivedModels: [
            {
              id: model.id,
              removedAt: "2026-08-10T12:00:00Z",
              lastSeenAt: "2026-08-09T12:00:00Z",
              model,
            },
          ],
          providers: [
            {
              id: "acme",
              displayName: "Acme AI",
              baseUrl: "https://api.acme.ai/v1",
              apiKeySignupUrl: "https://console.acme.ai/api-keys",
              docsUrl: "https://docs.acme.ai",
              notes: null,
            },
          ],
        }),
    });
    await renderPage(model.id);
    await settle();
    await settle();

    expect(container.textContent).toContain("Former free model");
    expect(container.textContent).toContain("Set up a coding harness");
    expect(
      container.querySelectorAll(
        '[role="tablist"][aria-label="Choose a coding harness"] [role="tab"]',
      ),
    ).toHaveLength(4);
    expect(container.textContent).not.toContain("Use in any harness via Ori");
  });

  it("uses canonical provider metadata instead of an OpenRouter-looking model ID for Ori", async () => {
    const model = {
      ...makeModel({
        id: "openrouter/looks-like-openrouter",
        name: "Provider Model",
      }),
      providerId: "acme",
    } as Model;
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          providerId: "acme",
          ...makeData(model),
          providers: [
            {
              id: "acme",
              displayName: "Acme AI",
              baseUrl: "https://api.acme.ai/v1",
              apiKeySignupUrl: "https://console.acme.ai/api-keys",
              docsUrl: "https://docs.acme.ai",
              notes: null,
            },
          ],
        }),
    });
    await renderPage(model.id);
    await settle();
    await settle();

    expect(container.textContent).toContain("acme");
    expect(container.textContent).not.toContain("Use in any harness via Ori");
  });

  it("does not inherit OpenRouter metadata for an explicit provider without metadata", async () => {
    const model = {
      ...makeModel({
        id: "openrouter/without-metadata",
        name: "Unlisted Provider Model",
      }),
      providerId: "acme",
    } as Model;
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeData(model)),
    });
    await renderPage(model.id);
    await settle();
    await settle();

    expect(container.textContent).toContain("Set up a coding harness");
    expect(container.textContent).not.toContain("Use in any harness via Ori");
    expect(container.textContent).not.toContain("https://openrouter.ai/api/v1");
    expect(container.textContent).not.toContain("Quick Start");
  });

  it("does not show Ori for models without providerId (legacy OpenRouter snapshots)", async () => {
    const model = makeModel({ id: "stealth/ox-alpha", name: "Ox Alpha" });
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeData(model)),
    });
    await renderPage(model.id);
    await settle();
    await settle();

    expect(container.textContent).toContain("Set up a coding harness");
    expect(container.textContent).not.toContain("Use in any harness via Ori");
  });
});
