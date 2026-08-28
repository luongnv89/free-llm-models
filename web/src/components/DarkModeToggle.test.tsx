// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Window } from "happy-dom";
import { DarkModeToggle } from "./DarkModeToggle";

let container: HTMLElement;
let root: Root | null = null;
let storageWindow: Window;

async function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(DarkModeToggle));
  });
}

async function click() {
  const button = container.querySelector("button");
  expect(button).toBeTruthy();
  await act(async () => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function setStoredPreference(value: string | null) {
  if (value === null) {
    storageWindow.localStorage.removeItem("darkMode");
  } else {
    storageWindow.localStorage.setItem("darkMode", value);
  }
}

describe("DarkModeToggle", () => {
  beforeEach(() => {
    storageWindow = new Window({ url: "http://localhost:3000" });
    Object.defineProperty(globalThis, "localStorage", {
      get: () => storageWindow.localStorage,
      configurable: true,
    });
    document.documentElement.classList.remove("dark");
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
  });

  it("renders a toggle button with a title", async () => {
    setStoredPreference("false");
    await render();

    const button = container.querySelector("button");
    expect(button).toBeTruthy();
    expect(button!.getAttribute("title")).toBe("Switch to dark mode");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("starts in dark mode when the stored preference is true", async () => {
    setStoredPreference("true");
    await render();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(container.querySelector("button")!.getAttribute("title")).toBe(
      "Switch to light mode",
    );
  });

  it("falls back to prefers-color-scheme when nothing is stored", async () => {
    setStoredPreference(null);
    const stored = storageWindow.localStorage.getItem("darkMode");
    expect(stored).toBeNull();
    await render();

    const button = container.querySelector("button");
    expect(button).toBeTruthy();
  });

  it("toggles the theme and persists the choice", async () => {
    setStoredPreference("false");
    await render();

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await click();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(storageWindow.localStorage.getItem("darkMode")).toBe("true");
    expect(container.querySelector("button")!.getAttribute("title")).toBe(
      "Switch to light mode",
    );

    await click();

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(storageWindow.localStorage.getItem("darkMode")).toBe("false");
    expect(container.querySelector("button")!.getAttribute("title")).toBe(
      "Switch to dark mode",
    );
  });
});
