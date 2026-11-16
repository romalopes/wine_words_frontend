import type { ApiRequester } from "./apiClient"
import { createTradeApi } from "./tradeApi"

describe("createTradeApi", () => {
  const request = vi.fn() as unknown as ApiRequester
  const api = createTradeApi(request)

  beforeEach(() => {
    vi.mocked(request).mockReset()
  })

  // Regression: `request()` has no `query` option, so passing `{ query }` sent
  // no email at all and the backend answered 400 (blank lookup), surfacing as
  // "Request failed with status 400" after clicking Submit.
  it("sends the email as a query string when checking an account", async () => {
    vi.mocked(request).mockResolvedValueOnce({ exists: true })

    await api.checkEmail("aaaa@yahoo.com")

    expect(request).toHaveBeenCalledWith(
      "/trade/submissions/check_email?email=aaaa%40yahoo.com",
    )
  })

  it("submits anonymously with the idempotency key header", async () => {
    vi.mocked(request).mockResolvedValueOnce({ package_reference: 36 })

    await api.submit({ wines: [] }, "key-1")

    expect(request).toHaveBeenCalledWith("/trade/submissions", {
      method: "POST",
      body: { wines: [] },
      headers: { "X-Idempotency-Key": "key-1" },
    })
  })
})
