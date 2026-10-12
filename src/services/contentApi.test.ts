import { createProducersApi } from "./contentApi";
import type { ApiRequester } from "./apiClient";

it("preserves the default producer request for existing callers", async () => {
  const request = vi.fn() as unknown as ApiRequester;
  await createProducersApi(request).show("unknown-producer");
  expect(request).toHaveBeenCalledWith("/producers/unknown-producer");
});
