import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Turnstile from "./Turnstile"

describe("Turnstile", () => {
  afterEach(() => {
    delete window.turnstile
    vi.restoreAllMocks()
  })

  it("explains that verification is unconfigured and emits no token", () => {
    const onToken = vi.fn()
    render(<Turnstile onToken={onToken} />)

    expect(screen.getByRole("note")).toHaveTextContent(/not configured/i)
    expect(onToken).toHaveBeenCalledWith(null)
  })

  it("renders with the public site key and forwards tokens and expiry", async () => {
    const onToken = vi.fn()
    const renderWidget = vi.fn().mockReturnValue("widget-1")
    const remove = vi.fn()

    window.turnstile = {
      render: renderWidget,
      reset: vi.fn(),
      remove,
    } as unknown as NonNullable<Window["turnstile"]>

    const { unmount } = render(
      <Turnstile siteKey="public-site-key" action="contact" onToken={onToken} />,
    )

    await waitFor(() => expect(renderWidget).toHaveBeenCalled())
    const [, options] = renderWidget.mock.calls[0] as [
      HTMLElement,
      Record<string, unknown>,
    ]
    expect(options.sitekey).toBe("public-site-key")
    expect(options.action).toBe("contact")

    const callbacks = options as Record<string, ((value?: string) => void) | undefined>
    callbacks.callback?.("token-123")
    expect(onToken).toHaveBeenCalledWith("token-123")

    callbacks["expired-callback"]?.()
    expect(onToken).toHaveBeenLastCalledWith(null)

    unmount()
    expect(remove).toHaveBeenCalledWith("widget-1")
  })
})
