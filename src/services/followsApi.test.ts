import type { ApiRequester } from "./apiClient"
import { createFollowsApi } from "./followsApi"

describe("createFollowsApi", () => {
  const request = vi.fn() as unknown as ApiRequester
  const api = createFollowsApi(request)

  beforeEach(() => {
    vi.mocked(request).mockReset()
  })

  it("loads follow status by slug for detail-page identifiers", async () => {
    vi.mocked(request).mockResolvedValueOnce({
      followable_type: "Wine",
      followable_id: 7,
      follow_id: 42,
      following: true,
    })

    await api.status("Wine", "00-vgw-chardonnay")

    expect(request).toHaveBeenCalledWith(
      "/follows/status?followable_type=Wine&followable_slug=00-vgw-chardonnay",
      { auth: true },
    )
  })

  it.each([7, "7"])("loads follow status by id for numeric identifier %s", async (identifier) => {
    vi.mocked(request).mockResolvedValueOnce({
      followable_type: "Wine",
      followable_id: 7,
      follow_id: null,
      following: false,
    })

    await api.status("Wine", identifier)

    expect(request).toHaveBeenCalledWith(
      "/follows/status?followable_type=Wine&followable_id=7",
      { auth: true },
    )
  })
})