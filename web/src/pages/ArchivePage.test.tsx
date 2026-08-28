// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ArchivePage } from "./ArchivePage";
import { resetModelsCacheForTests } from "@/hooks/useModels";
import { formatDateTime } from "@/lib/model-utils";
import type { Model } from "@/types/model";

const FETCHED_AT = "2026-08-20T12:00:00Z";

function makeModel(
  overrides: Partial<Model> & Pick<Model, "id" | "name">,
): Model {
  return {
    canonical_slug: "",
    hugging_face_id: null,
    created: 1700000000,
    description: "Archived model",
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
    addedToFreeList: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

interface ProviderFixture {
  id: string;
  name: string;
  models?: Model[];
  archived?: Model[];
}

function providerMetadata(id: string, name: string) {
  return {
    id,
    displayName: name,
    baseUrl: null,
    apiKeySignupUrl: null,
    docsUrl: null,
    notes: null,
  };
}

/**
 * Serves a multi-provider index plus one JSON payload per provider,
 * mirroring what useModels() fetches on a current deploy.
 */
function mockMultiProviderFetch(
  providers: ProviderFixture[],
): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    let body: unknown;
    if (url.endsWith("/models/index.json")) {
      body = {
        providers: providers.map((p) => ({
          id: p.id,
          name: p.name,
          metadata: providerMetadata(p.id, p.name),
          modelCount: p.models?.length ?? 0,
          fetchedAt: FETCHED_AT,
        })),
      };
    } else {
      const match = providers.find((p) => url.endsWith(`/models/${p.id}.json`));
      if (!match) {
        return { ok: false, status: 404, json: () => Promise.resolve({}) };
      }
      body = {
        providerId: match.id,
        fetchedAt: FETCHED_AT,
        models: match.models ?? [],
        archivedModels: (match.archived ?? []).map((model) => ({
          id: model.id,
          removedAt: "2026-08-01T00:00:00Z",
          lastSeenAt: "2026-07-31T00:00:00Z",
          addedToFreeList: model.addedToFreeList,
          model,
        })),
      };
    }
    return { ok: true, json: () => Promise.resolve(body) };
  });
}

let container: HTMLElement;
let root: Root | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

async function renderPage() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      createElement(MemoryRouter, {
        initialEntries: ["/archive"],
        children: [createElement(ArchivePage)],
      }),
    );
  });
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("ArchivePage", () => {
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
  });

  it("shows an empty state when there are no archived models", async () => {
    fetchMock = mockMultiProviderFetch([
      {
        id: "openrouter",
        name: "OpenRouter",
        models: [makeModel({ id: "acme/live", name: "Live Model" })],
      },
    ]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await renderPage();
    await settle();

    expect(container.textContent).toContain("Former free models");
    expect(container.textContent).toContain("No archived models yet");
    expect(container.textContent).not.toContain("Gone Model");
    expect(container.querySelector('a[href="/"]')).toBeTruthy();
  });

  it("keeps a Back to Models path when fetching fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await renderPage();
    await settle();

    expect(container.textContent).toContain("Failed to load models");
    expect(container.textContent).toContain("network down");
    expect(container.textContent).toContain("Back to Models");
    expect(container.querySelector('a[href="/"]')).toBeTruthy();
  });

  it("lists archived models with detail links and omits live models", async () => {
    fetchMock = mockMultiProviderFetch([
      {
        id: "openrouter",
        name: "OpenRouter",
        models: [
          makeModel({
            id: "acme/live",
            name: "Live Model",
            description: "Still free",
          }),
        ],
        archived: [makeModel({ id: "acme/gone", name: "Gone Model" })],
      },
    ]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await renderPage();
    await settle();

    expect(container.textContent).toContain("1 archived model");
    expect(container.textContent).toContain("Gone Model");
    expect(container.textContent).toContain(
      `Removed ${formatDateTime("2026-08-01T00:00:00Z")}`,
    );
    expect(container.textContent).not.toContain("Live Model");
    expect(
      container.querySelector('a[href="/model/acme%2Fgone"]'),
    ).toBeTruthy();
    const list = container.querySelector(
      'ol[aria-label="OpenRouter archived models"]',
    );
    expect(list).toBeTruthy();
    expect(list!.getAttribute("role")).toBe("list");
    expect(list!.querySelectorAll(":scope > li")).toHaveLength(1);
    expect(list!.querySelector('[aria-label="Rank 1"]')?.textContent).toBe("1");
  });

  it("groups legacy entries under OpenRouter and tagged entries under their provider", async () => {
    const legacy = makeModel({ id: "acme/gone", name: "Gone Model" });
    const groqEntry = makeModel({
      id: "groq/gone-fast",
      name: "Gone Fast",
    }) as Model & {
      providerId?: string;
    };
    groqEntry.providerId = "groq";

    fetchMock = mockMultiProviderFetch([
      { id: "openrouter", name: "OpenRouter", archived: [legacy] },
      { id: "groq", name: "Groq", archived: [groqEntry] },
    ]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await renderPage();
    await settle();

    expect(container.textContent).toContain("2 archived models");
    expect(container.textContent).toContain("OpenRouter");
    expect(container.textContent).toContain("Groq");
    expect(container.textContent).toContain("Gone Fast");
    expect(
      container.querySelector('ol[aria-label="Groq archived models"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('ol[aria-label="OpenRouter archived models"]'),
    ).toBeTruthy();
    expect(container.querySelectorAll("ol > li")).toHaveLength(2);
  });
});
