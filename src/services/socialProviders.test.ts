import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { GoogleInitializeConfig, GoogleSdk } from "../types/socialAuth";

let config: GoogleInitializeConfig;
let google: GoogleSdk;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com");
  vi.spyOn(document.head, "appendChild").mockImplementation((element) => {
    queueMicrotask(() => element.dispatchEvent(new Event("load")));
    return element;
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  google = { accounts: { id: {
    initialize: vi.fn((value) => { config = value; }),
    renderButton: vi.fn(),
    prompt: vi.fn(),
  } } };
  window.google = google;
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete window.google;
});

async function start() {
  const module = await import("./socialProviders");
  const result = module.signInWithGoogle();
  // Attach rejection handling before a cancel/error event.
  const outcome = result.then(value => ({ value }), error => ({ error }));
  await vi.waitFor(() => expect(google.accounts.id.renderButton).toHaveBeenCalled());
  return { outcome, module };
}

describe("explicit Google sign-in", () => {
  it("uses the official button instead of suppressible One Tap and returns the token", async () => {
    const { outcome } = await start();
    expect(google.accounts.id.prompt).not.toHaveBeenCalled();
    expect(document.querySelector('dialog[open]')).not.toBeNull();
    config.callback({ credential: "provider-issued-id-token" });
    expect(await outcome).toEqual({ value: { credential: "provider-issued-id-token" } });
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("cancels cleanly and ignores a late provider callback", async () => {
    const { outcome, module } = await start();
    document.querySelector<HTMLButtonElement>("dialog > button")!.click();
    expect(await outcome).toEqual({ error: expect.any(module.ProviderCancelledError) });
    config.callback({ credential: "late-token" });
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("handles Escape cancellation", async () => {
    const { outcome, module } = await start();
    document.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(await outcome).toEqual({ error: expect.any(module.ProviderCancelledError) });
  });

  it("rejects an empty provider response", async () => {
    const { outcome, module } = await start();
    config.callback({});
    expect(await outcome).toEqual({ error: expect.any(module.ProviderCancelledError) });
  });

  it("does not launch an unconfigured provider", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "  ");
    const module = await import("./socialProviders");
    await expect(module.signInWithGoogle()).rejects.toBeInstanceOf(module.ProviderUnavailableError);
    expect(google.accounts.id.initialize).not.toHaveBeenCalled();
  });
});
