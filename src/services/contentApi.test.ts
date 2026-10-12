import { createProducersApi } from "./contentApi";
import type { ApiRequester } from "./apiClient";

it("preserves the default producer request for existing callers", async () => {
  const request = vi.fn() as unknown as ApiRequester;
  await createProducersApi(request).show("unknown-producer");
  expect(request).toHaveBeenCalledWith("/producers/unknown-producer");
});

it("requests minimal authenticated responses for article and review status changes", async () => {
  const { createArticlesApi, createReviewsApi } = await import("./contentApi");
  const request = vi.fn() as unknown as ApiRequester;
  for (const [kind, api] of [["article", createArticlesApi(request)], ["review", createReviewsApi(request)]] as const) {
    await api.updateStatus(7, { status: "published" });
    expect(request).toHaveBeenLastCalledWith(`/${kind}s/7`, {
      method: "PATCH", auth: true, headers: { Prefer: "return=minimal" },
      body: { [kind]: { status: "published" } },
    });
  }
});
