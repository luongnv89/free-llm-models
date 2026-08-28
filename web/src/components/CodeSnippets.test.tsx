// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CodeSnippets } from "./CodeSnippets";
import type { ProviderMetadata } from "@/types/model";

const MODEL_ID = "acme/test-model";

const ACME_PROVIDER: ProviderMetadata = {
  id: "acme",
  displayName: "Acme AI",
  baseUrl: "https://api.acme.ai/v1",
  apiKeySignupUrl: "https://console.acme.ai/api-keys",
  docsUrl: "https://docs.acme.ai",
  notes: null,
};

let container: HTMLElement;
let root: Root | null = null;

async function render(modelId = MODEL_ID, provider?: ProviderMetadata) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(CodeSnippets, { modelId, provider }));
  });
}

function tabLabels(): string[] {
  return [...container.querySelectorAll("button")]
    .map((button) => button.textContent?.trim() ?? "")
    .filter((label) =>
      ["cURL", "Node.js", "Python", "Claude Code"].includes(label),
    );
}

describe("CodeSnippets", () => {
  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
  });

  it("does not render a Claude Code tab", async () => {
    await render();

    expect(container.textContent).not.toContain("Claude Code");
    expect(tabLabels()).not.toContain("Claude Code");
  });

  it("renders cURL, Node.js, and Python tabs with the model id", async () => {
    await render();

    expect(tabLabels()).toEqual(["cURL", "Node.js", "Python"]);
    expect(container.textContent).toContain(MODEL_ID);
    expect(container.textContent).toContain("Quick Start");
  });

  it("switches snippets when a language tab is clicked", async () => {
    await render();

    const pythonTab = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Python"),
    );
    expect(pythonTab).toBeTruthy();

    await act(async () => {
      pythonTab!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(container.textContent).toContain("pip install openai");
    expect(container.textContent).toContain(`model="${MODEL_ID}"`);
    expect(container.textContent).not.toContain("Claude Code");
  });

  it("falls back to OpenRouter defaults when provider metadata is absent", async () => {
    await render();

    expect(container.textContent).toContain(
      "https://openrouter.ai/api/v1/chat/completions",
    );
    expect(container.textContent).toContain("OPENROUTER_API_KEY");
    const keysLink = container.querySelector(
      'a[href="https://openrouter.ai/keys"]',
    );
    expect(keysLink?.textContent).toBe("openrouter.ai/keys");
  });

  it("renders snippets with the selected model provider metadata", async () => {
    await render(MODEL_ID, ACME_PROVIDER);

    expect(container.textContent).toContain(
      "https://api.acme.ai/v1/chat/completions",
    );
    expect(container.textContent).toContain("ACME_AI_API_KEY");
    const keysLink = container.querySelector(
      'a[href="https://console.acme.ai/api-keys"]',
    );
    expect(keysLink?.textContent).toBe("console.acme.ai/api-keys");
  });

  it("uses the OpenAI-compatible endpoint for providers whose native API differs", async () => {
    await render("google/gemini-flash", {
      ...ACME_PROVIDER,
      id: "google",
      displayName: "Google AI Studio",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      openaiCompatibleBaseUrl:
        "https://generativelanguage.googleapis.com/openai/v1",
      apiKeySignupUrl: "https://aistudio.google.com/apikey",
    });

    expect(container.textContent).toContain(
      "https://generativelanguage.googleapis.com/openai/v1/chat/completions",
    );
    expect(container.textContent).not.toContain("/v1beta/chat/completions");
    expect(container.textContent).toContain("GOOGLE_AI_STUDIO_API_KEY");
  });

  it("uses the provider base URL in Node.js and Python snippets", async () => {
    await render(MODEL_ID, ACME_PROVIDER);

    for (const label of ["Node.js", "Python"]) {
      const tab = [...container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes(label),
      );
      await act(async () => {
        tab!.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
      });
      expect(container.textContent).toContain("https://api.acme.ai/v1");
      expect(container.textContent).not.toContain("openrouter.ai");
    }
  });

  it("does not mark a step copied when the clipboard write fails", async () => {
    const original = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
    try {
      await render();

      const copyButton = [...container.querySelectorAll("button")].find(
        (button) =>
          button.getAttribute("aria-label") === "Copy: Set your API key",
      );
      expect(copyButton).toBeTruthy();

      await act(async () => {
        copyButton!.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
      });

      expect(container.textContent).toContain("0/2");
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: original,
      });
    }
  });
});
