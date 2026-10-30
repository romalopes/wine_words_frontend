import { copyText } from "./clipboard";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalSecureContext = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");

function setClipboard(value: { writeText: (text: string) => Promise<void> } | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value,
  });
}

function setSecureContext(value: boolean) {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value,
  });
}

function setExecCommand(value: () => boolean) {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else delete (navigator as { clipboard?: Clipboard }).clipboard;
  if (originalSecureContext) Object.defineProperty(window, "isSecureContext", originalSecureContext);
  else delete (window as { isSecureContext?: boolean }).isSecureContext;
  if (originalExecCommand) Object.defineProperty(document, "execCommand", originalExecCommand);
  else delete (document as { execCommand?: (command: string) => boolean }).execCommand;
  document.body.replaceChildren();
});

describe("copyText", () => {
  it("uses the async Clipboard API in a secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    setSecureContext(true);

    await expect(copyText("Wine Words")).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledExactlyOnceWith("Wine Words");
  });

  it("falls back to execCommand and removes its temporary textarea", async () => {
    setClipboard(undefined);
    setSecureContext(false);
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);

    await expect(copyText("fallback text")).resolves.toBeUndefined();
    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");
    expect(document.querySelector("textarea")).not.toBeInTheDocument();
  });

  it("rejects when the fallback reports failure", async () => {
    setClipboard(undefined);
    setSecureContext(false);
    setExecCommand(() => false);

    await expect(copyText("uncopied")).rejects.toThrow("copy failed");
    expect(document.querySelector("textarea")).not.toBeInTheDocument();
  });

  it("rejects and cleans up when execCommand throws", async () => {
    setClipboard(undefined);
    setSecureContext(false);
    setExecCommand(() => {
      throw new Error("clipboard blocked");
    });

    await expect(copyText("blocked")).rejects.toThrow("clipboard blocked");
    expect(document.querySelector("textarea")).not.toBeInTheDocument();
  });
});